// network.js — игра вдвоём + лобби. Подключается к server.js по WebSocket (/ws).
// Источник правды о том, кто в игре и кем играет, — список (roster), который рассылает сервер. На каждого игрока в мире ровно ОДНА фигура:
// remotes — Map по id, фигура пересоздаётся только при смене персонажа (старая сначала удаляется). Свой персонаж в remotes не попадает.
// Если игрок закрыл вкладку, сервер шлёт leave{dead:true}: его фигура падает (клип «Смерть»), лежит несколько секунд и исчезает.
// Без server.js (например, python -m http.server) сеть тихо отключается: лобби работает локально, одиночная игра как раньше.
import { SUPABASE_URL, SUPABASE_KEY, FORCE_RT } from './config.js';
const qpRt = new URLSearchParams(location.search).get('rt');
const USE_RT = qpRt === '1' || (qpRt !== '0' && (FORCE_RT || /github\.io$/.test(location.hostname)));      // на GitHub Pages своего сервера нет
export const CHARS = {
  richard: { name: 'Ричард', role: 'Главный ниндзя', icon: '🦁', img: null },
  sokolin: { name: 'Соколин', role: 'Меч и щит, злой ниндзя', icon: '🦅', img: 'Соколин/3D/preview_front.png' },
  ben: { name: 'Бэн', role: 'Преемник Ричарда, друг', icon: '🛡️', img: 'Бэн/3D/preview_front.png' },
  zantio: { name: 'Зантио', role: 'Капитан, шпагоносец', icon: '🎩', img: 'Зантио/3D/preview_front.png' },
  zhenshi: { name: 'Чжэнь Ши', role: 'Самурай, абордажник', icon: '🗡️', img: 'Чжен Ши/3D/preview_three.png' },
};
const CORPSE_SEC = 7;

export function startNetwork({ richard, scene, THREE, onStatus = () => {} }) {
  if (!richard || typeof WebSocket === 'undefined') return { update() {}, get online() { return false; }, roster: [], me: null, bodies: () => [], game: null, on() {}, send() {}, sendWorld() {}, group: () => null, setTeams() {}, onChat() {}, chat: () => false, setLobby() {}, onChange() {}, close() {}, room: null, roomErr: '', roomList: [], join() {}, createRoom() {}, leaveRoom() {}, requestRooms() {} };
  // Адрес сервера: по умолчанию тот же хост, откуда открыта страница. На GitHub Pages сервера нет — тогда его адрес задаётся ссылкой: ?server=xxx.trycloudflare.com
  const srv = new URLSearchParams(location.search).get('server');
  const url = srv ? (/^wss?:\/\//.test(srv) ? srv : (/^localhost|^\d+\.\d+\.\d+\.\d+/.test(srv) ? 'ws://' : 'wss://') + srv.replace(/^https?:\/\//, '')).replace(/\/+$/, '').replace(/\/ws$/, '') + '/ws'
    : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  const remotes = new Map();                     // id → { ch, name, av, lb, dying, init, x,y,z,yaw, tx,ty,tz,tyaw, anim }
  const listeners = new Set(), chatFns = new Set(), handlers = new Map(); let lastGameKey = '', pendingWorld = null;
  let ws = null, myId = null, tries = 0, closedByUs = false, online = false, sendT = 0, roster = [];
  let room = null, roomErr = '', roomList = []; try { room = sessionStorage.getItem('ninja.room') || null; } catch { /* нет sessionStorage */ }
  { const qr = new URLSearchParams(location.search).get('room'); if (qr && /^\d{3}$/.test(qr)) room = qr; }      // ссылка ?room=777 сразу заводит в комнату      // код комнаты хранится на вкладку: после обновления страницы вернёмся в неё
  const lobby = { name: (localStorage.getItem('ninja.name') || '').slice(0, 16), ch: null, play: false };   // то, чего хочет этот игрок

  const meOf = () => roster.find(p => p.id === myId) || null;
  const emit = () => { status(); listeners.forEach(f => f(roster, api)); };
  const status = () => {
    const n = roster.filter(p => p.play).length, me = meOf();
    onStatus(online || !closedByUs ? `${room ? '🏠 Комната ' + room + ' · ' : ''}👥 В игре: ${n}${me && me.play ? ` · вы — ${me.name} (${CHARS[me.ch]?.name})` : ' · вы смотрите'}${online ? '' : ' · без сервера'}` : '');
  };

  const label = (text, color = '#fff', hpk = null) => {                        // табличка над головой другого игрока: имя и полоска жизней
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 80; const g = cv.getContext('2d');
    g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(text, 128, 28); g.fillStyle = color; g.fillText(text, 128, 28);
    if (hpk != null) {
      const k = Math.max(0, Math.min(1, hpk)), x = 38, y = 54, w = 180, h = 14;
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      g.fillStyle = '#3a1512'; g.fillRect(x, y, w, h);
      g.fillStyle = `hsl(${Math.round(k * 120)},75%,48%)`; g.fillRect(x, y, w * k, h);
    }
    const tex = new THREE.CanvasTexture(cv), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(9, 2.8, 1); sp.position.y = 12; sp.renderOrder = 20; return sp;
  };
  const killLabel = r => { if (!r.lb) return; r.lb.parent && r.lb.parent.remove(r.lb); r.lb.material.map && r.lb.material.map.dispose(); r.lb.material.dispose(); r.lb = null; };
  const setLabel = (r, text) => { killLabel(r); r.name = text; r.hpShown = r.hpk; r.lb = label(text, r.col || '#fff', r.hpk); r.lb.visible = !api.hideLabels; r.av.group.add(r.lb); };
  const killAvatar = r => { killLabel(r); scene.remove(r.av.group); r.av.dispose && r.av.dispose(); };
  const makeAv = (r, ch) => { r.av = richard.makeRemoteAvatar(ch); r.ch = ch; scene.add(r.av.group); r.init = false; r.anim = ''; setLabel(r, r.name); };

  function removeRemote(id) { const r = remotes.get(id); if (!r) return; killAvatar(r); remotes.delete(id); }

  function syncRemotes() {                       // приводим фигуры в мире к списку сервера
    const want = new Map(roster.filter(p => p.play && p.ch && p.id !== myId).map(p => [p.id, p]));
    for (const [id, r] of [...remotes]) if (!want.has(id) && !r.dying) removeRemote(id);
    for (const [id, p] of want) {
      let r = remotes.get(id);
      if (r && r.dying) { removeRemote(id); r = null; }                          // умерший вернулся другим входом — старое тело убираем
      if (!r) { r = { name: p.name, dying: 0, x: 0, y: 0, z: 0, yaw: 0, tx: 0, ty: 0, tz: 0, tyaw: 0 }; remotes.set(id, r); makeAv(r, p.ch); }
      else if (r.ch !== p.ch) { killAvatar(r); makeAv(r, p.ch); }                // сменил персонажа: сначала убрали старую фигуру, потом новая
      else if (r.name !== p.name) setLabel(r, p.name);
    }
  }
  const pushLobby = () => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'lobby', name: lobby.name, ch: lobby.ch, play: lobby.play })); };

  function connect() {
    if (USE_RT) {                                  // без своего сервера: сеть через Supabase Realtime (rt.js)
      import('./rt.js').then(m => { ws = m.createRTSocket({ url: SUPABASE_URL, key: SUPABASE_KEY }); wire(); }).catch(e => { console.error('[rt] не загрузился', e); if (!closedByUs && ++tries <= 3) setTimeout(connect, 2000 * tries); });
      return;
    }
    try { ws = new WebSocket(url); } catch { return; }
    wire();
  }
  function wire() {
    ws.onopen = () => { online = true; tries = 0; };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      { const hs = handlers.get(m.t); if (hs) hs.forEach(f => f(m)); }
      if (m.t === 'game') { api.game = m; const k = m.phase + '|' + m.mode + '|' + m.armed + '|' + m.np + '|' + JSON.stringify(m.pv) + '|' + m.dm + '|' + m.cd + '|' + m.ver + '|' + m.world; if (k !== lastGameKey) { lastGameKey = k; emit(); } }
      if (m.t === 'hello') { myId = m.id; if (pendingWorld) ws.send(JSON.stringify({ t: 'world', ...pendingWorld })); if (room) ws.send(JSON.stringify({ t: 'join', code: room })); pushLobby(); }                                   // после переподключения повторяем своё состояние
      else if (m.t === 'room') {                                                       // сервер подтвердил вход/выход из комнаты или отклонил (err)
        if (m.err) roomErr = m.err; else if ('code' in m) { room = m.code; roomErr = ''; try { room ? sessionStorage.setItem('ninja.room', room) : sessionStorage.removeItem('ninja.room'); } catch { /* */ } if (room) pushLobby(); }
        emit();
      }
      else if (m.t === 'rooms') { roomList = m.list || []; emit(); }
      else if (m.t === 'chat') chatFns.forEach(f => f(m.name || 'Игрок ' + m.id, m.text, m.ch));
      else if (m.t === 'roster') { roster = m.list; syncRemotes(); emit(); }
      else if (m.t === 'leave') {
        const r = remotes.get(m.id); if (!r) return;
        if (m.dead) { r.dying = CORPSE_SEC; r.av.setAnim('Смерть', 1, true); setLabel(r, '✝ ' + r.name); }   // закрыл вкладку — персонаж погибает
        else removeRemote(m.id);
      } else if (m.t === 'st') {
        const r = remotes.get(m.id); if (!r || r.dying) return;
        r.tx = m.x; r.ty = m.y; r.tz = m.z; r.tyaw = m.yaw; if (m.hm) { r.hpk = Math.max(0, Math.min(1, m.hp / m.hm)); if (r.hpShown == null || Math.abs(r.hpShown - r.hpk) >= 0.02 || (r.hpk === 0) !== (r.hpShown === 0)) setLabel(r, r.name); } r.dg = m.dg || null; r.w = !!m.w; r.wOn = r.w && !/Плаван|Лестниц|Лаз|Вис|Подтяг|Планир|Стен/i.test(m.a || r.anim || ''); if (m.a && m.a !== r.anim) { r.anim = m.a; r.av.setAnim(m.a, m.s || 1, !!m.o); }
        if (!r.init) { r.x = r.tx; r.y = r.ty; r.z = r.tz; r.yaw = r.tyaw; r.init = true; }
      }
    };
    ws.onclose = () => {
      online = false; for (const id of [...remotes.keys()]) removeRemote(id); roster = []; emit();
      if (!closedByUs && ++tries <= 3) setTimeout(connect, 2000 * tries);
    };
    ws.onerror = () => { /* onclose разберётся */ };
  }
  connect();
  addEventListener('pagehide', () => { closedByUs = true; ws && ws.close(); });             // закрыли вкладку — сразу сообщаем серверу

  const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const api = {
    get room() { return room; }, get roomErr() { return roomErr; }, get roomList() { return roomList; },
    /** войти в комнату по коду из 3 цифр (нет такой — создастся) */
    join(code) { roomErr = ''; if (online && ws.readyState === 1) ws.send(JSON.stringify({ t: 'join', code: String(code).trim() })); },
    createRoom() { roomErr = ''; if (online && ws.readyState === 1) ws.send(JSON.stringify({ t: 'join', create: true })); },
    leaveRoom() { lobby.play = false; if (online && ws.readyState === 1) ws.send(JSON.stringify({ t: 'leaveRoom' })); },
    requestRooms() { if (online && ws.readyState === 1) ws.send(JSON.stringify({ t: 'rooms' })); },
    get online() { return online; }, get id() { return myId; }, get roster() { return roster; }, get me() { return meOf(); }, get lobby() { return lobby; },
    /** тела других живых игроков — для выталкивания (коллизия игрок↔игрок); мёртвые не мешают */
    bodies() { const out = []; for (const [id, r] of remotes) if (!r.dying && r.init) out.push({ id, x: r.x, y: r.y, z: r.z, r: 1.2 }); return out; },
    /** драконы других игроков (дракон = всадник + dg{тангаж, крен, огонь, окраска}) */
    dragonRiders() { const out = []; for (const [id, r] of remotes) if (r.dg && !r.dying) out.push({ id, dg: r.dg }); return out; },
    cloak(id, on) { const r = remotes.get(id); if (r) r.cloak = !!on; },      // невидимость другого игрока (сообщение 'spell' с fx cloak/uncloak)
    game: null, hideLabels: false,
    on(type, f) { (handlers.get(type) || handlers.set(type, new Set()).get(type)).add(f); },
    send(obj) { if (online && ws.readyState === 1) ws.send(JSON.stringify(obj)); },
    sendWorld(info) { pendingWorld = info; if (online && ws.readyState === 1 && myId != null) ws.send(JSON.stringify({ t: 'world', ...info })); },
    group(id) { const r = remotes.get(id); return r && !r.dying ? r.av.group : null; },
    setTeams(map) { for (const [id, r] of remotes) { const c = map[id] || null; if (c !== (r.col || null)) { r.col = c || undefined; setLabel(r, r.name.replace(/^✝ /, '')); } } },
    onChat(f) { chatFns.add(f); },
    /** отправить сообщение остальным (себе — показывает сам чат) */
    chat(text) { text = String(text || '').trim().slice(0, 200); if (text && online && ws.readyState === 1) ws.send(JSON.stringify({ t: 'chat', text })); return online; },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    /** patch: {name?, ch?, play?}. Онлайн — сервер решает и присылает roster; офлайн — решаем сами (персонаж один, конфликтов нет). */
    setLobby(patch) {
      Object.assign(lobby, patch); lobby.name = (lobby.name || '').slice(0, 16); localStorage.setItem('ninja.name', lobby.name);
      if (online) pushLobby();
      else { lobby.play = lobby.play && !!lobby.ch; roster = [{ id: 0, name: lobby.name || 'Игрок', ch: lobby.ch, play: lobby.play }]; myId = 0; emit(); }
    },
    update(dt) {
      const me = meOf();
      if (online && ws.readyState === 1 && me && me.play) {                 // своё состояние — 15 раз в секунду, только пока я в игре
        sendT += dt; if (sendT >= 0.066) { sendT = 0; const P = richard.P; ws.send(JSON.stringify({ t: 'st', x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +(P.yawVis ?? P.yaw).toFixed(3), a: richard.animName ? richard.animName() : '', hp: Math.round(richard.P.hp ?? 100), hm: richard.P.hpMax || 100, o: richard.animOnce && richard.animOnce() ? 1 : 0, w: richard.armed ? 1 : 0, dg: window.__dragonSend ? window.__dragonSend() : undefined })); }
      }
      const k = 1 - Math.exp(-14 * dt);
      for (const [id, r] of [...remotes]) {
        if (r.dying) { r.dying -= dt; r.av.update(dt); if (r.dying <= 0) removeRemote(id); continue; }
        r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k; r.yaw += angDiff(r.yaw, r.tyaw) * k;
        r.av.setPose(r.x, r.y, r.z, r.yaw); r.av.update(dt); if (richard.applyWeapon) richard.applyWeapon(r.av.group, !!r.wOn, dt); if (r.lb) r.lb.visible = !api.hideLabels; r.av.group.visible = !r.cloak;      // заклинание невидимости (magic.js): фигура и табличка скрыты
      }
    },
    close() { closedByUs = true; ws && ws.close(); },
  };
  return api;
}
