// rt.js — сеть игры через Supabase Realtime, без своего сервера: «WebSocket»-подобный объект для network.js.
// Комната = канал Realtime «ninja-r-<код>». Судья комнаты — тот, кто вошёл первым (по presence): в его браузере работает игровой «сервер» core.js
// (голосование, режимы, очки). Остальные шлют ему команды (c2s) и получают ответы (s2c). Позиции игроков (st) летят напрямую всем, минуя судью.
// Вышел судья — судьёй становится следующий, а комната начинает с чистого состояния (игроки переотправляют имя/персонажа сами).
// Ключ — только публичный (publishable/anon). Секретный ключ sb_secret_… сюда нельзя: страница открыта всем.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCore } from './core.js';

const CHARS = ['richard', 'sokolin', 'ben', 'zantio', 'zhenshi'], ROOM_MAX = 5, ST_MIN_MS = 90;

export function createRTSocket({ url, key }) {
  const sock = { readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null };
  const myId = (Date.now() % 1e9) * 10 + Math.floor(Math.random() * 10);      // растёт со временем входа: «кто раньше» = меньший id
  let sb = null, lobby = null, room = null, code = null, members = [], core = null, wasRef = false;
  let lastLobby = null, lastWorld = null, myCh = null, lastSt = 0, coinsCache = {};
  const toNet = obj => {
    if (obj && obj.t === 'roster') { const me = obj.list.find(p => p.id === myId); myCh = me ? me.ch : null; }      // свой персонаж нужен для подписи позиций (st)
    if (sock.onmessage) sock.onmessage({ data: JSON.stringify(obj) });
  };
  const fail = e => { console.error('[rt]', e); sock.readyState = 3; sock.onerror && sock.onerror(e); sock.onclose && sock.onclose(); };

  /* ───── монеты: таблица ninja_coins (supabase/ninja_schema.sql); нет таблицы/прав — игра идёт без сохранения ───── */
  const rest = (p, opt = {}) => fetch(url + '/rest/v1' + p, { ...opt, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  const loadCoins = async () => { try { const r = await rest('/ninja_coins?select=name,coins&limit=5000'); if (!r.ok) return {}; const o = {}; for (const x of await r.json()) o[x.name] = x.coins | 0; return o; } catch { return {}; } };
  const saveCoins = async coins => {
    const rows = []; for (const [name, n] of Object.entries(coins)) if (coinsCache[name] !== n) rows.push({ name, coins: n | 0, updated_at: new Date().toISOString() });
    if (!rows.length) return;
    try { const r = await rest('/ninja_coins?on_conflict=name', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) }); if (r.ok) for (const x of rows) coinsCache[x.name] = x.coins; } catch { /* без сохранения */ }
  };

  /* ───── доставка из ядра судьи ───── */
  const sendRoom = (event, payload) => { try { room && room.send({ type: 'broadcast', event, payload }); } catch { /* */ } };
  const fromCore = (id, obj) => { if (id === myId) toNet(obj); else sendRoom('s2c', { to: id, msg: obj }); };
  const fromCoreAll = (obj, except) => { if (except !== myId) toNet(obj); sendRoom('s2c', { to: '*', except: except ?? null, msg: obj }); };

  function startCore() {
    if (core) return;
    loadCoins().then(coins => {
      coinsCache = { ...coins };
      if (core) return;       // уже создан
      core = createCore({ deliver: fromCore, deliverAll: fromCoreAll, onCoins: saveCoins, initialCoins: coins, relaySt: false });
      for (const id of members) core.join(id);
      sendRoom('sync', {}); onSync();      // просим всех переслать имя/персонажа/мир
      if (lastWorld) core.message(myId, lastWorld); if (lastLobby) core.message(myId, lastLobby);
    });
  }
  const onSync = () => { if (!room) return; if (lastWorld && wasRef === false) c2s(lastWorld); if (lastLobby && wasRef === false) c2s(lastLobby); };

  /* ───── клиент → судье ───── */
  function c2s(msg) {
    if (core && wasRef) core.message(myId, msg);
    else sendRoom('c2s', { from: myId, msg });
  }

  /* ───── членство и судья ───── */
  function onPresence() {
    const st = room.presenceState(), list = [];
    for (const arr of Object.values(st)) for (const p of arr) if (p && Number.isFinite(p.id)) list.push({ id: p.id, at: p.at || 0 });
    list.sort((a, b) => a.at - b.at || a.id - b.id);
    const ids = list.map(x => x.id), refId = ids[0], iAmRef = refId === myId;
    const prev = members; members = ids;
    if (iAmRef && !wasRef) { wasRef = true; startCore(); }
    else if (!iAmRef && wasRef) { wasRef = false; if (core) { core.destroy(); core = null; } }
    if (core && wasRef) {
      for (const id of ids) if (!prev.includes(id)) core.join(id);
      for (const id of prev) if (!ids.includes(id)) core.leave(id);
    }
    if (!iAmRef && ids.length) { c2s(lastWorld || { t: 'noop' }); if (lastLobby) c2s(lastLobby); }      // судья сменился/появился — переотправляем своё состояние
  }

  function onRoomMessage(ev, payload) {
    if (ev === 'c2s') { if (core && wasRef && payload.from !== myId) core.message(payload.from, payload.msg); }
    else if (ev === 's2c') { if (payload.to === myId || (payload.to === '*' && payload.except !== myId)) { toNet(payload.msg); } }
    else if (ev === 'st') { if (payload.id !== myId) { toNet(payload); if (core && wasRef) core.message(payload.id, payload); } }
    else if (ev === 'sync') { if (!wasRef) onSync(); }
  }

  /* ───── вход/выход из комнаты ───── */
  function lobbyList() {
    const counts = {}; for (const arr of Object.values(lobby.presenceState())) for (const p of arr) if (p.code) counts[p.code] = (counts[p.code] || 0) + 1;
    return counts;
  }
  async function leaveRoom(silent) {
    const old = room; room = null; code = null; members = []; wasRef = false; if (core) { core.destroy(); core = null; }
    if (old) { try { await sb.removeChannel(old); } catch { /* */ } }
    try { lobby && lobby.track({ id: myId, code: null }); } catch { /* */ }
    if (!silent) { toNet({ t: 'room', code: null }); toNet({ t: 'roster', list: [] }); toNet({ t: 'game', phase: 'idle', mode: null, pl: [], ver: 4, world: false }); }
  }
  async function joinRoom(msg) {
    let c = String(msg.code == null ? '' : msg.code).trim(); const counts = lobbyList();
    if (msg.create || c === 'new') { const free = []; for (let k = 100; k <= 999; k++) if (!counts[String(k)]) free.push(String(k)); if (!free.length) return toNet({ t: 'room', err: 'Все комнаты заняты' }); c = free[Math.floor(Math.random() * free.length)]; }
    if (!/^\d{3}$/.test(c)) return toNet({ t: 'room', err: 'Код комнаты — ровно 3 цифры' });
    if (code === c) return toNet({ t: 'room', code: c });
    if ((counts[c] || 0) >= ROOM_MAX) return toNet({ t: 'room', err: `Комната ${c} полна (макс. ${ROOM_MAX})` });
    if (room) await leaveRoom(true);
    code = c; myCh = null;
    const ch = sb.channel('ninja-r-' + c, { config: { broadcast: { self: false, ack: false }, presence: { key: String(myId) } } });
    room = ch;
    ch.on('broadcast', { event: 'c2s' }, ({ payload }) => onRoomMessage('c2s', payload)).on('broadcast', { event: 's2c' }, ({ payload }) => onRoomMessage('s2c', payload))
      .on('broadcast', { event: 'st' }, ({ payload }) => onRoomMessage('st', payload)).on('broadcast', { event: 'sync' }, () => onRoomMessage('sync', {}))
      .on('presence', { event: 'sync' }, () => { if (room === ch) onPresence(); });
    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') { await ch.track({ id: myId, at: Date.now() }); lobby.track({ id: myId, code: c }); toNet({ t: 'room', code: c }); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') toNet({ t: 'room', err: 'Нет связи с комнатой — повторите' });
    });
  }

  /* ───── то, что network.js считает WebSocket ───── */
  sock.send = str => {
    let m; try { m = JSON.parse(str); } catch { return; } if (!m) return;
    if (m.t === 'join') { joinRoom(m); return; }
    if (m.t === 'leaveRoom') { leaveRoom(false); return; }
    if (m.t === 'rooms') { toNet({ t: 'rooms', list: Object.entries(lobbyList()).map(([c, n]) => ({ code: c, n, playing: false })) }); return; }
    if (!room) return;
    if (m.t === 'world') lastWorld = m; else if (m.t === 'lobby') lastLobby = m;
    if (m.t === 'st') {                                  // позиция — всем напрямую (не чаще ~11 раз в секунду), судье она нужна для ядра
      const now = performance.now(); if (now - lastSt < ST_MIN_MS) return; lastSt = now;
      const p = { ...m, id: myId, ch: myCh }; sendRoom('st', p); if (core && wasRef) core.message(myId, p); return;
    }
    c2s(m);
  };
  sock.close = () => { sock.readyState = 3; leaveRoom(true); try { sb && sb.removeAllChannels(); } catch { /* */ } sock.onclose && sock.onclose(); };

  try {
    if (!key) throw new Error('В config.js не задан публичный ключ Supabase (SUPABASE_KEY)');
    sb = createClient(url, key, { realtime: { params: { eventsPerSecond: 40 } } });
    lobby = sb.channel('ninja-lobby', { config: { presence: { key: String(myId) } } });
    lobby.on('presence', { event: 'sync' }, () => { /* список комнат строится по запросу */ });
    lobby.subscribe(status => {
      if (status === 'SUBSCRIBED') { lobby.track({ id: myId, code: null }); sock.readyState = 1; sock.onopen && sock.onopen(); toNet({ t: 'hello', id: myId, chars: CHARS }); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { if (sock.readyState === 0) fail(new Error('Supabase Realtime недоступен: ' + status)); }
    });
  } catch (e) { setTimeout(() => fail(e), 0); }
  addEventListener('pagehide', () => { try { sb && sb.removeAllChannels(); } catch { /* */ } });
  return sock;
}
