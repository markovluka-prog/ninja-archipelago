// core.js — игровой «сервер» ОДНОЙ комнаты, который работает в браузере судьи (первого игрока комнаты) — без своего сервера, на Supabase Realtime (см. rt.js).
// СГЕНЕРИРОВАНО из server.js (логика режимов, голосования, очков, хода игры не меняется). Обычный server.js остаётся для игры по локальной сети/туннелю.
// deliver(id, obj) — отправить одному игроку; deliverAll(obj, exceptId) — всем в комнате; onCoins(coins) — сохранить монеты.
export function createCore({ deliver, deliverAll, onCoins, initialCoins = {}, relaySt = true }) {
  const CHARS = ['richard', 'sokolin', 'ben', 'zantio', 'zhenshi'];
  let players = new Map(), shipPoses = {}, coins = { ...initialCoins };
  const send = (pl, obj) => { try { deliver(pl.id, obj); } catch { /* */ } };
  const broadcast = (obj, exceptId) => { try { deliverAll(obj, exceptId); } catch { /* */ } };
  const roster = () => ({ t: 'roster', list: [...players].map(([id, p]) => ({ id, name: p.name, ch: p.ch, play: p.play, coins: coins[p.name] || 0 })) });
function handle(pl, msg) {
  const id = pl.id;
  if (msg.t === 'lobby') {                          // имя / выбор персонажа / «в игре или нет»; сервер — единственный судья уникальности
    const nm = String(msg.name || '').replace(/[<>&"]/g, '').trim().slice(0, 16); if (nm) pl.name = nm;
    if (msg.ch === null) pl.ch = null;
    else if (CHARS.includes(msg.ch) && ![...players].some(([i, p]) => i !== id && p.ch === msg.ch)) pl.ch = msg.ch;
    const was = pl.play; pl.play = !!msg.play && !!pl.ch;
    if (!pl.play) pl.vote = null;
    if (was && !pl.play) { if (pl.g) { dropFlag(pl); delete pl.g; } broadcast({ t: 'leave', id, dead: false }, id); }           // убрал себя из игры сам — просто исчезает
    if (!was && pl.play && game.phase === 'play') joinLate(pl);
    if (was !== pl.play) autoPaused = false;
    broadcast(roster()); autoStart(); broadcast(snapshot());
  }
  else if (msg.t === 'st' && pl.play) {                                            // состояние игрока — остальным (персонаж берётся с сервера)
    if ([msg.x, msg.y, msg.z].every(Number.isFinite)) pl.pos = { x: msg.x, y: msg.y, z: msg.z };
    pl.dg = !!(msg.dg && !msg.dg.l);      // в воздухе/в седле дракона
    if (relaySt) broadcast({ ...msg, id, ch: pl.ch }, id);
  }
  else if (msg.t === 'ivote') { if (pl.play && ivote) { pl.iv = Number.isInteger(msg.i) ? msg.i : null; broadcast(snapshot()); } }          // голос за остров
  else if (msg.t === 'vote') { if (pl.play && votingOpen()) { pl.vote = MODES[msg.mode] ? msg.mode : null; broadcast(snapshot()); } }          // голос за режим
  else if (msg.t === 'ship') {                                                           // поза корабля от того, кто им правит — остальным в комнате
    if (![msg.x, msg.z, msg.yaw].every(Number.isFinite)) return;
    if (game.phase === 'play' && game.mode === 'naval') {                                // морской бой: только свой корабль
      if (pl.g && pl.g.ship != null) { pl.g.pose = { x: msg.x, z: msg.z, yaw: msg.yaw }; broadcast({ t: 'ship', id, k: pl.g.ship, x: msg.x, z: msg.z, yaw: msg.yaw, su: msg.su ? 1 : 0 }, id); }
    } else if (Number.isInteger(msg.k) && msg.k >= 0 && msg.k < 100) { shipPoses[msg.k] = { x: msg.x, z: msg.z, yaw: msg.yaw, su: msg.su ? 1 : 0 }; broadcast({ t: 'ship', id, k: msg.k, ...shipPoses[msg.k] }, id); }      // свободная игра: корабли тоже общие
  }
  else if (msg.t === 'fire') onFire(pl, msg);
  else if (msg.t === 'repair') onRepair(pl, msg.auto);
  else if (msg.t === 'start') { if (pl.play && MODES[msg.mode] && votingOpen()) { pl.vote = msg.mode; broadcast(snapshot()); } }          // ручного старта нет: это просто голос; игра начнётся сама (когда проголосуют все или через 20 секунд при 2+ игроках)
  else if (msg.t === 'stop') { /* ручного завершения нет: игра заканчивается по условиям режима */ }
  else if (msg.t === 'home') { if (pl.g && pl.g.alive && pl.pos && game.mode === 'capture' && game.phase === 'play') { const mine = game.points.filter(q => q.owner === pl.g.team), c = (mine.length ? mine : [game.bases[pl.g.team]]).sort((a, b) => dxz(a, pl.pos) - dxz(b, pl.pos))[0]; if (c) send(pl, { t: 'spawn', x: c.x + 3, z: c.z, yaw: 0 }); } }
  else if (msg.t === 'inv') { if (pl.g && game.mode === 'dragons') pl.g.invUntil = nowS() + 0.5; }
  else if (msg.t === 'hit') onHit(pl, msg);
  else if (msg.t === 'decoy') onDecoy(pl, msg);
  else if (msg.t === 'died') onDied(pl, msg);
  else if (msg.t === 'grab') onGrab(pl, msg);
  else if (msg.t === 'pick') onPick(pl, msg);
  else if (msg.t === 'pass') passFlag(pl);
  else if (msg.t === 'fx') { const k = msg.k === 'f' ? 'f' : 'e'; broadcast({ t: 'fx', id, name: pl.name, k, v: String(msg.v || '').slice(0, 4), x: +msg.x || 0, z: +msg.z || 0 }, id); }      // эмоции и флажки на карте (Изучение) — просто пересылаем
  else if (msg.t === 'chat') { const text = String(msg.text || '').trim().slice(0, 200); if (text) broadcast({ t: 'chat', id, name: pl.name, ch: pl.ch, text }, id); }
}

/* ───────────── РЕЖИМЫ ИГРЫ ─────────────
   Сервер — судья: клиенты присылают позиции (st), удары (hit), гибель (died), подбор реликвии (grab); сервер считает очки, захват точек, флаги, прятки и раз в 0.1 с рассылает снимок игры (game).
   Монеты за победу хранятся в coins.json по имени игрока. */
const saveCoins = () => { if (onCoins) onCoins(coins); };
const MODES = {
  battle:  { name: 'Битва',            min: 2, pvp: true,  limit: 10, secs: 480 },     // 10 побед или 8 минут (побеждает лидер)
  relics:  { name: 'Поиск реликвий',   min: 2, pvp: false, limit: 10, secs: 600 },                 // 10 реликвий
  capture: { name: 'Захват точек',     min: 2, pvp: true,  teams: true, secs: 720 },                                     // побеждает команда, первой захватившая БОЛЬШЕ ПОЛОВИНЫ точек (без таймера)
  ctf:     { name: 'Битва флагов',     min: 2, pvp: true,  teams: true, limit: 3, secs: 720 },                          // 3 захвата флага соперника (без таймера)
  dragons: { name: 'Поединки драконов', min: 2, pvp: true, limit: 10, secs: 600 },     // верхом на драконах: сжечь пламенем всадника чужого дракона; 10 побед
  hide:    { name: 'Прятки',           min: 2, pvp: false },
  explore: { name: 'Изучение',        min: 1, pvp: false },    // без целей: гулять и общаться. Пока в игре ОДИН игрок — идёт само и без конца (game.solo); если выбрали голосованием вдвоём — 10 минут
  naval:   { name: 'Морской бой',      min: 2, pvp: false },     // у каждого свой корабль; побеждает последний на плаву
};
const TEAM_NAME = { red: 'Красные', blue: 'Синие' };
let WORLD = null;                                         // { spots:[{n,x,y,z,yaw}], relic:[[x,y,z]] } — присылает первый клиент
let game = { mode: null, phase: 'idle' };
let armed = false;                                     // режим, выбранный при одном игроке: стартует САМ, как только в игре появится второй
function votes() { const c = {}; for (const [, p] of playing()) if (MODES[p.vote]) c[p.vote] = (c[p.vote] || 0) + 1; return c; }
function pickMode() {                                     // победил режим с наибольшим числом голосов; при ничьей — выбор первого игрока (кто раньше вошёл)
  const c = votes(), top = Math.max(0, ...Object.values(c)); if (!top) return null;
  for (const [, p] of playing().sort((a, b) => a[0] - b[0])) if (MODES[p.vote] && c[p.vote] === top) return p.vote;
  return null;
}
const firstPlayer = () => { const l = playing().sort((a, b) => a[0] - b[0]); return l.length ? l[0][0] : null; };
const MIN_PLAYERS = 2, AUTO_SEC = 20, ISLE_SEC = 15;
const votingOpen = () => game.phase === 'idle' && !ivote && !pend;      // голоса принимаются только пока идёт выбор: раньше голос, поданный во время игры, оставался и запускал следующий раунд без голосования
const resetVoting = () => { ivote = null; pend = null; autoAt = 0; for (const [, p] of players) { p.vote = null; delete p.iv; } };
let pend = null;                                           // выбор сделан: на пару секунд показываем название, потом спавнится вся игра { mode, isl, endAt, text }
let ivote = null;                                          // второй этап голосования (остров) для режимов «на одном острове»: { mode, endAt }
const ISLAND_MODES = new Set(['hide']);
function islandOpts() {                                    // острова, на которых есть точки появления: [{ i, n: «названия мест» }]
  const m = new Map(); for (const q of (WORLD && WORLD.spots) || []) if (q.i != null && q.i >= 0) { if (!m.has(q.i)) m.set(q.i, []); m.get(q.i).push(q.n); }
  return [...m].map(([i, ns]) => ({ i, n: ns.slice(0, 3).join(', ') + (ns.length > 3 ? '…' : '') }));
}
function islandVotes() { const c = {}; for (const [, p] of playing()) if (p.iv != null) c[p.iv] = (c[p.iv] || 0) + 1; return c; }
function pickIsland() {
  const opts = islandOpts().map(o => o.i), c = islandVotes(), top = Math.max(0, ...opts.map(i => c[i] || 0)), best = opts.filter(i => (c[i] || 0) === top);
  return best[Math.floor(Math.random() * best.length)];
}
function launch(mode) {
  console.debug('[голосование] выбран режим: ' + mode);                                    // выбранный режим: если нужен остров — сначала голосуем за него
  if (ISLAND_MODES.has(mode) && islandOpts().length >= 2) {
    ivote = { mode, endAt: nowS() + ISLE_SEC }; autoAt = 0; for (const [, p] of players) { delete p.iv; }
    ev(`🗺 Режим «${MODES[mode].name}» выбран. Теперь голосуем за остров (${ISLE_SEC} секунд)`, true); broadcast(snapshot()); return;
  }
  pend = { mode, isl: undefined, endAt: nowS() + 3, text: `Выбран режим: «${MODES[mode].name}»` }; autoAt = 0; broadcast(snapshot());
}
let autoAt = 0, autoPaused = false;                       // отсчёт до автозапуска, когда в игре двое; autoPaused — игру закончили вручную                                    // пока в игре меньше двух — игра не идёт, все ходят свободно
const playing = () => [...players].filter(([, p]) => p.play && p.ch);
const nowS = () => Date.now() / 1000;
const dxz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const inGame = () => [...players].filter(([, p]) => p.g);
const ev = (text, big) => broadcast({ t: 'ev', text, big: !!big });
const toast = (pl, text) => send(pl, { t: 'ev', text });

/* зона сужения («Битва»): круг, который со временем уменьшается; вне круга игрок получает урон (считает клиент). Центр — точка у середины карты, начальный радиус накрывает все точки возрождения */
const ZONE_DELAY = 45, ZONE_SHRINK = 270, ZONE_END_R = 70;
function makeZone(spots, t) {
  const mx = spots.reduce((a, q) => a + q.x, 0) / spots.length, mz = spots.reduce((a, q) => a + q.z, 0) / spots.length;
  const c = spots.reduce((b, q) => (dxz(q, { x: mx, z: mz }) < dxz(b, { x: mx, z: mz }) ? q : b), spots[0]);
  return { x: c.x, z: c.z, r0: Math.max(...spots.map(q => dxz(q, c))) + 120, t0: t + ZONE_DELAY };
}
function zoneR(t) { const z = game.zone; if (!z) return 0; const k = Math.max(0, Math.min(1, (t - z.t0) / ZONE_SHRINK)); return z.r0 + (ZONE_END_R - z.r0) * k; }
function zoneInfo(t) { const z = game.zone; return z ? [Math.round(z.x), Math.round(z.z), Math.round(zoneR(t)), t < z.t0 ? Math.ceil(z.t0 - t) : 0] : null; }
function spawnPool() {                                     // «Битва»: возрождаемся только внутри зоны (с запасом), иначе — у центра
  const t = nowS(), r = zoneR(t) - 25, ok = WORLD.spots.filter(q => dxz(q, game.zone) <= r);
  return ok.length ? ok : [game.zone];
}
function spawnFor(p, first) {
  if (p.g.ship != null && WORLD.ships[p.g.ship]) { const sh = WORLD.ships[p.g.ship]; return { x: sh.x, z: sh.z, yaw: sh.yaw }; }                              // старт раунда: каждому своё место (команде — её база); возрождение в битве — случайная точка
  const s = game.bases && p.g.team ? game.bases[p.g.team] : game.mode === 'battle' && !first && game.zone && pickFar(p) ? pickFar(p) : first && p.g.spawn ? p.g.spawn : (game.hideSpots || (game.zone && game.mode === 'battle' ? spawnPool() : WORLD.spots))[Math.floor(Math.random() * (game.hideSpots || (game.zone && game.mode === 'battle' ? spawnPool() : WORLD.spots)).length)], a = Math.random() * 6.283, r = 8 + Math.random() * 14;
  return { x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r, yaw: s.yaw || 0 };
}
function pickFar(p) {                                       // «Битва»: точка респавна, максимально далёкая от врагов
  const en = inGame().filter(([, q]) => q !== p && q.g.alive && q.pos), pool = spawnPool(); if (!en.length) return null;
  let best = null, bd = -1; for (const c of pool) { const d = Math.min(...en.map(([, q]) => dxz(c, q.pos))); if (d > bd) { bd = d; best = c; } }
  return best;
}
const sendSpawn = (p, first) => send(p, { t: 'spawn', ...spawnFor(p, first), ship: p.g.ship });
const newG = () => ({ hp: 100, ship: null, pose: null, reload: {}, spawn: null, score: 0, kills: 0, team: null, alive: true, carry: null, seeker: false, respawnAt: 0, lastHit: {} });

function snapshot() {
  const t = nowS(), M = MODES[game.mode];
  const mk = game.mode === 'battle' && game.phase === 'play' ? inGame().filter(([, p]) => p.pos && p.g.alive && (p.g.mkUntil > t || p.g.score >= 9)).map(([, p]) => [Math.round(p.pos.x), Math.round(p.pos.z), p.g.mkUntil > t ? '🔥' : '👑']) : null;
  return {
    mk, pk: game.mode === 'battle' && game.pk ? game.pk.filter(a => a.at <= t).map(a => [a.id, a.x, a.y, a.z, a.k]) : null,
    t: 'game', ver: 4, world: !!WORLD, armed: armed ? pickMode() : null, an: pend ? { text: pend.text, cd: Math.max(0, Math.ceil(pend.endAt - nowS())) } : null, iv: ivote ? { mode: ivote.mode, cd: Math.max(0, Math.ceil(ivote.endAt - nowS())), opts: islandOpts(), votes: islandVotes(), pv: playing().filter(([, p]) => p.iv != null).map(([id, p]) => [id, p.iv]) } : null, cd: autoAt && !ivote && !pend ? Math.max(0, Math.ceil(autoAt - nowS())) : null, dm: pickMode(), np: playing().length, votes: votes(), first: firstPlayer(), pv: playing().filter(([, p]) => MODES[p.vote]).map(([id, p]) => [id, p.vote]), mode: game.mode, mn: M && M.name, phase: game.phase, sub: game.sub, left: game.endAt ? Math.max(0, Math.round(game.endAt - t)) : null,
    hideLeft: game.sub === 'hiding' ? Math.max(0, Math.round(game.seekAt - t)) : 0, isl: game.mode === 'hide' ? game.hideIsl : null, zn: game.zone ? zoneInfo(t) : null, limit: game.limit != null ? game.limit : M && M.limit, winner: game.winner,
    sc: game.scores && { red: Math.floor(game.scores.red), blue: Math.floor(game.scores.blue) },
    pl: inGame().map(([id, p]) => [id, p.g.score, p.g.kills, p.g.team, p.g.alive ? 1 : 0, p.g.carry || '', p.g.seeker ? 1 : 0, Math.max(0, Math.round(p.g.hp)), p.g.ship]),
    relics: game.relics, bases: game.bases, nv: game.nhp && Object.entries(game.nhp).map(([k, hp]) => [+k, Math.round(hp)]),
    points: game.points && game.points.map(q => ({ n: q.n, x: q.x, y: q.y, z: q.z, o: q.owner, p: +q.prog.toFixed(2), w: q.w || 1 })),
    flags: game.flags && Object.values(game.flags).map(f => ({ team: f.team, st: f.st, x: f.x, y: f.y, z: f.z })),
    crates: game.mode === 'ctf' && game.crates ? game.crates.map(c => [c.x, c.y, c.z, c.at > t ? 0 : 1]) : undefined,
  };
}

function startGame(starter, mode, chosenIsl) {
  const M = MODES[mode]; if (!M) return;
  if (game.phase === 'play') return starter && toast(starter, 'Игра уже идёт — сначала закончите её');
  if (!WORLD) return starter && toast(starter, 'Мир ещё не передал данные — подождите пару секунд и повторите');
  const ps = playing();
  if (ps.length < M.min) {          // одному играть нельзя: режим «взводится» и запустится сам, когда войдёт второй
    armed = true; if (starter) toast(starter, `Режим «${M.name}» выбран. Игра начнётся сама, когда войдёт второй игрок — пока ходите где хотите`);
    console.debug(`[игра] режим ${M.name} ждёт второго игрока`); return broadcast(snapshot());
  }
  if (mode === 'naval' && (WORLD.ships || []).length < ps.length) { armed = false; for (const [, p] of players) delete p.vote; broadcast(snapshot()); return starter && toast(starter, `Для морского боя нужно кораблей: ${ps.length}, на карте их ${(WORLD.ships || []).length}`); }
  armed = false; autoAt = 0; ivote = null; pend = null; for (const [, p] of players) { delete p.vote; delete p.iv; } const t = nowS();
  if (mode !== 'hide') players.hs = null;
  game = { mode, phase: 'play', t0: t, endAt: M.secs ? t + M.secs : null, scores: { red: 0, blue: 0 }, rid: 0 };
  for (const [, p] of ps) p.g = newG();
  if (M.teams) { shuffle(ps).forEach(([, p], i) => { p.g.team = i % 2 ? 'blue' : 'red'; }); }
  let S = WORLD.spots;
  if (mode === 'hide') {                                  // прятки — на одном случайном острове (остальные острова вне игры)
    const ids = [...new Set(S.filter(q => q.i != null && q.i >= 0).map(q => q.i))];
    if (ids.length) { game.hideIsl = ids.includes(chosenIsl) ? chosenIsl : ids[Math.floor(Math.random() * ids.length)]; S = S.filter(q => q.i === game.hideIsl); game.hideSpots = S; }
  }
  { const sp = shuffle(S.slice()); ps.forEach(([, p], i) => { p.g.spawn = mode === 'relics' || mode === 'explore' ? sp[0] : sp[i % sp.length]; }); game.avoid = mode === 'relics' ? sp[0] : null; }      // реликвии: все стартуют в одном месте; остальные режимы — у каждого своя точка
  const isl = s => s.i != null ? 'i' + s.i : 'n' + s.n, far = L => { let best = -1, A = L[0], B = L[1] || L[0]; for (const a of L) for (const b of L) { const d = dxz(a, b); if (d > best) { best = d; A = a; B = b; } } return [A, B]; };
  const bs = s => ({ n: s.n, x: s.x, y: s.y, z: s.z, yaw: s.yaw });
  if (mode === 'ctf') {                                   // флаги — на большом острове: базы = две самые удалённые точки на нём
    const big = S.filter(s => s.big), [A, B] = far(big.length >= 2 ? big : S); game.bases = { red: bs(A), blue: bs(B) };
  } else if (mode === 'capture') {                        // по точке на остров; команды стартуют на двух самых удалённых островах
    const reps = []; for (const s of S) if (!reps.some(r => isl(r) === isl(s))) reps.push(s);
    const [A, B] = far(reps); game.bases = { red: bs(A), blue: bs(B) };
    game.points = reps.map(r => { const o = S.find(s => isl(s) === isl(r) && s.n !== A.n && s.n !== B.n) || r; return { n: o.n, x: o.x, y: o.y, z: o.z, owner: null, prog: 0, w: 1 }; });
    game.hold = { red: 0, blue: 0 }; game.dblAt = t + 120;
    game.limit = Math.floor(game.points.length / 2) + 1;      // нужно удерживать больше половины точек
  }
  if (mode === 'naval') {                                 // каждому — свой корабль на старте (случайные, подальше друг от друга)
    const sh = WORLD.ships || [];
    for (const k of Object.keys(shipPoses)) delete shipPoses[k];      // морской бой начинается с исходных позиций кораблей
    const anchor = sh[Math.floor(Math.random() * sh.length)], order = sh.map((q, k) => k).sort((a, b) => Math.hypot(sh[a].x - anchor.x, sh[a].z - anchor.z) - Math.hypot(sh[b].x - anchor.x, sh[b].z - anchor.z));
    const pick = shuffle(order.slice(0, ps.length)).concat(order.slice(ps.length)); game.balls = []; game.bid = 0;      // игроки — на ближайших друг к другу кораблях, чтобы бой начался быстро
    ps.forEach(([, p], i) => { p.g.ship = pick[i]; p.g.pose = null; });
    game.nhp = {}; for (const k of pick.slice(ps.length)) game.nhp[k] = 100;      // остальные корабли — пустые: их тоже можно потопить, но очков за них нет
  }
  if (mode === 'battle') { game.zone = makeZone(WORLD.spots, t); game.pk = shuffle(WORLD.spots.slice()).slice(0, 8).map((q, i) => ({ id: i + 1, x: q.x + 6, y: q.y, z: q.z, k: i % 2 ? 's' : 'h', at: 0 })); }
  if (mode === 'naval') { const sp = ps.map(([, p]) => WORLD.ships[p.g.ship]).filter(Boolean), cx = sp.reduce((a, q) => a + q.x, 0) / sp.length, cz = sp.reduce((a, q) => a + q.z, 0) / sp.length; game.zone = { x: cx, z: cz, r0: Math.max(...sp.map(q => dxz(q, { x: cx, z: cz }))) + 150, t0: t + 90 }; }
  if (mode === 'relics') { game.relics = []; game.relicQ = []; for (let i = 0; i < 12; i++) addRelic(); }
  if (mode === 'ctf') game.crates = [];
  if (mode === 'ctf') game.flags = { red: { team: 'red', st: 'home', ...game.bases.red, by: null }, blue: { team: 'blue', st: 'home', ...game.bases.blue, by: null } };
  if (mode === 'hide') { game.sub = 'hiding'; game.seekAt = t + 30; game.endAt = t + 30 + 180; const hs = HS(); if (hs.n >= 3) { hs.tot = {}; hs.n = 0; hs.next = null; } hs.n++; const sk0 = ps.find(([, p]) => p.name === hs.next), [, sk] = sk0 || ps[Math.floor(Math.random() * ps.length)]; sk.g.seeker = true; ev(`🔍 Искатель — ${sk.name}. На прятки 30 секунд!`); }
  for (const [, p] of ps) sendSpawn(p, true);
  ev(starter ? `🎮 Игра началась! ${starter.name} запустил «${M.name}»` : `🎮 Игра началась! Режим «${M.name}»`);
  console.debug(`[игра] ${M.name}, игроков: ${ps.length}`); broadcast(snapshot());
}
function stopGame(by, rearm) {
  if (game.phase === 'idle') { if (armed && by) { armed = false; ev(`⏹ ${by.name} отменил запуск`); broadcast(snapshot()); } return; }
  const was = game.mode; if (was === 'naval') for (const k of Object.keys(shipPoses)) delete shipPoses[k]; game = { mode: null, phase: 'idle' }; for (const [, p] of players) delete p.g;
  resetVoting(); autoPaused = !rearm && !!by; armed = !!rearm; if (rearm) for (const [, p] of playing()) p.vote = was;
  ev(rearm ? '⏸ Игрок вышел — игра остановлена. Режим стартует снова, когда будет двое' : `⏹ ${by ? by.name : 'Сервер'} закончил игру`, true); broadcast(snapshot());
}
function randomMode() {                                    // никто не проголосовал — случайный режим (морской бой только если хватает кораблей)
  const n = playing().length, ok = Object.keys(MODES).filter(k => k !== 'naval' || ((WORLD && WORLD.ships) || []).length >= n);
  return ok[Math.floor(Math.random() * ok.length)];
}
function autoStart() {                                     // второй игрок появился — режим запускается сам, всё появляется разом
  if (game.phase === 'idle' && WORLD && playing().length === 1) {      // один игрок: само идёт «Изучение» (голосование начинается только при 2+ игроках)
    autoAt = 0; armed = false; startGame(null, 'explore'); if (game.mode === 'explore' && game.phase === 'play') { game.solo = true; game.endAt = null; broadcast(snapshot()); } return;
  }
  if (game.phase !== 'idle' || !WORLD || playing().length < MIN_PLAYERS) { autoAt = 0; if (ivote || pend) { ivote = null; pend = null; broadcast(snapshot()); } return; }
  if (pend) { if (nowS() >= pend.endAt) { const q = pend; pend = null; startGame(null, q.mode, q.isl); } else broadcast(snapshot()); return; }
  if (ivote) {                                             // идёт голосование за остров
    if (nowS() >= ivote.endAt || playing().every(([, q]) => q.iv != null)) { const m = ivote.mode, i = pickIsland(), ops = islandOpts().find(o => o.i === i); ivote = null; pend = { mode: m, isl: i, endAt: nowS() + 3, text: `«${MODES[m].name}» · остров ${i + 1}${ops ? ' (' + ops.n + ')' : ''}` }; broadcast(snapshot()); } else broadcast(snapshot());
    return;
  }
  if (armed) { autoAt = 0; const m = pickMode(); if (m) launch(m); else armed = false; return; }
  if (autoPaused) { autoAt = 0; return; }
  if (!autoAt) { autoAt = nowS() + AUTO_SEC; console.debug('[голосование] открыто, игроков: ' + playing().length); ev(`👥 Игроков достаточно! Выберите режим голосованием — игра начнётся через ${AUTO_SEC} секунд (или когда проголосуют все)`, true); broadcast(snapshot()); }
  else if (nowS() >= autoAt || playing().every(([, p]) => MODES[p.vote])) { autoAt = 0; launch(pickMode() || randomMode()); }      // время вышло или все проголосовали
  else broadcast(snapshot());
}
function joinLate(pl) {                                    // зашёл в игру посреди раунда
  if (!WORLD) { console.debug(`[вход] ${pl.name}: данных карты ещё нет — игра подождёт`); return; } pl.g = newG(); console.debug(`[вход] ${pl.name} вошёл в идущую игру (${game.mode})`);
  if (MODES[game.mode].teams) { const c = { red: 0, blue: 0 }; for (const [, p] of inGame()) if (p !== pl) c[p.g.team]++; pl.g.team = c.red <= c.blue ? 'red' : 'blue'; }
  if (game.mode === 'hide') pl.g.seeker = true;
  if (game.mode === 'naval') { const used = new Set(inGame().map(([, p]) => p.g.ship)), free = (WORLD.ships || []).map((q, k) => k).filter(k => !used.has(k) && (game.nhp[k] == null || game.nhp[k] > 0)); if (!free.length) { pl.g.alive = false; pl.g.hp = 0; pl.g.respawnAt = Infinity; ev(`${pl.name} наблюдает: свободных кораблей нет`); return; } pl.g.ship = free[Math.floor(Math.random() * free.length)]; delete game.nhp[pl.g.ship]; }
  sendSpawn(pl); ev(`${pl.name} присоединился к игре`);
}
function endGame(text, winners) {
  if (game.phase !== 'play') return;
  if (game.mode === 'naval') text += ' · ' + inGame().map(([, p]) => `${p.name}: точность ${p.g.shots ? Math.round(100 * (p.g.hits || 0) / p.g.shots) : 0}%, урон ${Math.round(p.g.dmg || 0)}, потоплено ${p.g.kills}`).join('; ');
  if (game.mode === 'dragons') text += ' · сожжено всадников: ' + inGame().map(([, p]) => `${p.name} ${p.g.kills}`).join(', ');
  if (game.mode === 'hide') {                              // итог пряток: очки = секунды выживания; серия до 3 раундов, следующий искатель — первый найденный
    const hs = HS(), end = Math.min(nowS(), game.endAt || nowS()), rows = [];
    for (const [, p] of inGame()) { const s = p.g.surv != null ? p.g.surv : p.g.seeker ? 0 : Math.max(0, Math.round(end - game.seekAt)); hs.tot[p.name] = (hs.tot[p.name] || 0) + s; rows.push(p.name + ' ' + s + ' с'); }
    hs.next = game.firstFound || null;
    text += ` · Раунд ${hs.n}/3 · выживание: ${rows.join(', ')} · Всего: ${Object.entries(hs.tot).sort((a, b) => b[1] - a[1]).map(e => e[0] + ' ' + e[1]).join(', ')}${hs.next ? ' · Следующий искатель: ' + hs.next : ''}`;
  }
  game.phase = 'over'; game.overAt = nowS() + 9; game.winner = text;
  for (const p of winners) coins[p.name] = (coins[p.name] || 0) + 1; if (winners.length) saveCoins();
  ev(`🏆 ${text}${winners.length ? ' · +1 🪙' : ''}`, true); broadcast(roster()); console.debug('[игра] конец: ' + text);
}
function timeUp() {
  const ps = inGame(), M = MODES[game.mode];
  if (game.mode === 'battle' || game.mode === 'dragons') { const top = Math.max(...ps.map(([, p]) => p.g.score)), w = ps.filter(([, p]) => p.g.score === top).map(([, p]) => p); return endGame(w.length === 1 ? `${w[0].name} победил по очкам (${top})` : 'Время вышло — ничья', w.length === 1 ? w : []); }
  if (game.mode === 'capture' && game.hold) { const a = game.scores.red, b = game.scores.blue, h = game.hold; const T = a !== b ? (a > b ? 'red' : 'blue') : h.red !== h.blue ? (h.red > h.blue ? 'red' : 'blue') : null; if (!T) return endGame('Время вышло — ничья', []); return endGame(`${TEAM_NAME[T]} победили ${a !== b ? 'по очкам' : 'по времени удержания'}`, ps.filter(([, p]) => p.g.team === T).map(([, p]) => p)); }
  if (M.teams) { const a = game.scores.red, b = game.scores.blue; if (Math.floor(a) === Math.floor(b)) return endGame('Время вышло — ничья', []); const T = a > b ? 'red' : 'blue'; return endGame(`${TEAM_NAME[T]} победили по очкам`, ps.filter(([, p]) => p.g.team === T).map(([, p]) => p)); }
  if (game.mode === 'naval') { const top = Math.max(...ps.map(([, p]) => p.g.hp)), w = ps.filter(([, p]) => p.g.hp === top).map(([, p]) => p); return endGame(w.length === 1 ? `${w[0].name} — самый целый корабль (${Math.round(top)}%)` : 'Время вышло — ничья', w.length === 1 ? w : []); }
  if (game.mode === 'relics') { const top = Math.max(...ps.map(([, p]) => p.g.score)), w = ps.filter(([, p]) => p.g.score === top).map(([, p]) => p); return endGame(w.length === 1 ? `${w[0].name} победил по очкам (${top})` : 'Время вышло — ничья', w.length === 1 ? w : []); }
  if (game.mode === 'hide') return endGame('Прячущиеся продержались!', ps.filter(([, p]) => !p.g.seeker).map(([, p]) => p));
  endGame('Время вышло — спасибо за игру!', []);      // «Изучение» и другие режимы без победителя
}
function addRelic() {
  const C = WORLD.relic; if (!C.length) return;
  const lead = Math.max(0, ...inGame().map(([, p]) => p.g.score)), gap = lead >= 8 ? 30 : 80;      // у лидера с 8+ реликвиями они появляются теснее
  const gold = Math.random() < 0.15 && !game.relics.some(r => r.v === 3), hi = gold ? C.slice().sort((a, b) => b[1] - a[1]).slice(0, 12) : C;      // золотая (3 очка) — на самых высоких местах
  for (let k = 0; k < 25; k++) { const c = hi[Math.floor(Math.random() * hi.length)]; if (game.relics.every(r => Math.hypot(r.x - c[0], r.z - c[2]) > gap) && (!game.avoid || Math.hypot(game.avoid.x - c[0], game.avoid.z - c[2]) > 120)) { game.relics.push({ id: ++game.rid, x: c[0], y: c[1], z: c[2], v: gold ? 3 : 1 }); return; } }
}
function dropFlag(pl) {
  if (!game.flags || !pl.g || !pl.g.carry) return;
  const f = game.flags[pl.g.carry]; if (f && f.st === 'carried' && f.by === pl.id) { f.st = 'dropped'; f.dropAt = nowS(); if (pl.pos) { f.x = pl.pos.x; f.y = pl.pos.y; f.z = pl.pos.z; } f.by = null; ev(`🚩 ${pl.name} потерял флаг!`); }
  pl.g.carry = null;
}
function returnFlag(f) {
  const b = game.bases[f.team]; f.st = 'home'; f.x = b.x; f.y = b.y; f.z = b.z; f.by = null;
  for (const [, p] of inGame()) if (p.g.carry === f.team) p.g.carry = null;
}

function onHit(pl, msg) {                                  // удар по другому игроку (атакующий определяет попадание, сервер проверяет)
  if (game.phase !== 'play' || !pl.g || !pl.g.alive) return;
  const tg = players.get(+msg.to); if (!tg || tg === pl || !tg.g || !tg.g.alive || !pl.pos || !tg.pos) return;
  const dr = game.mode === 'dragons'; if (dxz(pl.pos, tg.pos) > (dr ? 130 : 14) || Math.abs(pl.pos.y - tg.pos.y) > (dr ? 130 : 14)) return;
  const t = nowS(); if (tg.g.invUntil > t) return; if ((pl.g.lastHit[tg.id] || 0) > t - 0.25) return; pl.g.lastHit[tg.id] = t;
  if (game.mode === 'relics') {                            // кража: удар отнимает у цели 1 очко (раз в 3 с на цель) и отдаёт ударившему
    if (tg.g.score > 0 && (pl.g.stealAt || 0) < t - 3) { pl.g.stealAt = t; tg.g.score--; pl.g.score++; ev(`🗡 ${pl.name} отобрал реликвию у ${tg.name}`); if (pl.g.score >= MODES.relics.limit) endGame(`${pl.name} собрал ${MODES.relics.limit} реликвий`, [pl]); }
    return;
  }
  if (game.mode === 'hide') {                              // ловят только искатели; найденный сам становится искателем
    if (game.sub === 'seek' && pl.g.seeker && !tg.g.seeker) { tg.g.seeker = true; tg.g.surv = Math.max(0, Math.round(t - game.seekAt)); if (!game.firstFound) game.firstFound = tg.name; ev(`👀 ${pl.name} нашёл игрока ${tg.name}! Продержался ${tg.g.surv} с`); }
    return;
  }
  if (!MODES[game.mode].pvp) return;
  if (MODES[game.mode].teams && pl.g.team === tg.g.team) return;           // по своим не бьём
  if (msg.st === 'bash' && game.mode === 'battle') send(tg, { t: 'slow', s: 0.4 });
  send(tg, { t: 'hurt', from: pl.id, dmg: Math.min(dr ? 45 : 35, Math.max(1, +msg.dmg || 15)), x: pl.pos.x, y: pl.pos.y, z: pl.pos.z });
}
const HS = () => players.hs || (players.hs = { tot: {}, n: 0, next: null });      // серия пряток по комнате
function onDecoy(pl, msg) {                                // приманка: один раз за раунд звук в другой точке (слышат все)
  if (game.mode !== 'hide' || game.sub !== 'seek' || !pl.g || pl.g.seeker || pl.g.decoyUsed || !pl.pos) return;
  const x = +msg.x, z = +msg.z; if (!isFinite(x) || !isFinite(z) || Math.hypot(x - pl.pos.x, z - pl.pos.z) > 80) return;
  pl.g.decoyUsed = true; broadcast({ t: 'decoy', x, z });
}
function onDied(pl, msg) {
  if (game.phase !== 'play' || !pl.g || !pl.g.alive || !MODES[game.mode].pvp) return;
  pl.g.alive = false; pl.g.respawnAt = nowS() + (game.mode === 'capture' && game.respT ? (pl.g.team === game.respT ? 2 : 4) : 3); dropFlag(pl);
  const k = players.get(+msg.by); const killer = k && k !== pl && k.g && k.play ? k : null;
  if (killer) { killer.g.kills++; if (game.mode === 'battle' || game.mode === 'dragons') killer.g.score++; }
  ev(killer ? `⚔ ${killer.name} ➜ ${pl.name}` : `☠ ${pl.name} погиб`);
  if (game.mode === 'battle') {
    pl.g.streak = 0; pl.g.mkUntil = 0; pl.g.rev = killer ? killer.id : 0; send(pl, { t: 'ev', text: killer ? `☠ Вас убил ${killer.name} (${killer.g.score} побед)` : '☠ Вы погибли', big: true });
    if (killer) { killer.g.streak = (killer.g.streak || 0) + 1; if (killer.g.streak >= 3) { killer.g.mkUntil = nowS() + 5; if (killer.g.streak === 3) ev(`🔥 Неудержим: ${killer.name}!`, true); } }
  }
  if (killer && (game.mode === 'battle' || game.mode === 'dragons') && killer.g.score >= MODES[game.mode].limit) endGame(`${killer.name} победил ${game.mode === 'dragons' ? 'в поединке драконов' : 'в битве'} (${killer.g.score})`, [killer]);
}
function passFlag(pl) {                                    // CTF: носитель бросает флаг союзнику рядом (G)
  if (game.phase !== 'play' || game.mode !== 'ctf' || !pl.g || !pl.g.alive || !pl.g.carry || !pl.pos) return;
  const f = game.flags[pl.g.carry]; if (!f || f.st !== 'carried' || f.by !== pl.id) return;
  for (const [, q] of inGame()) if (q !== pl && q.g.alive && !q.g.carry && q.g.team === pl.g.team && q.pos && dxz(q.pos, pl.pos) <= 14) { f.by = q.id; q.g.carry = pl.g.carry; pl.g.carry = null; ev(`🚩 ${pl.name} передал флаг игроку ${q.name}!`); return; }
}
function onPick(pl, msg) {                                 // «Битва»: аптечка (h) / щит (s); возрождается через 30 с
  if (game.phase !== 'play' || game.mode !== 'battle' || !pl.g || !pl.g.alive || !pl.pos || !game.pk) return;
  const a = game.pk.find(q => q.id === +msg.id), t = nowS(); if (!a || a.at > t || dxz(pl.pos, a) > 8) return;
  a.at = t + 30; send(pl, { t: 'pk', k: a.k }); broadcast(snapshot());
}
function onGrab(pl, msg) {
  if (game.phase !== 'play' || game.mode !== 'relics' || !pl.g || !pl.pos || pl.dg) return;
  const i = game.relics.findIndex(r => r.id === +msg.id); if (i < 0) return;
  const r = game.relics[i]; if (dxz(pl.pos, r) > 16 || Math.abs(pl.pos.y - r.y) > 16) return;
  game.relics.splice(i, 1); game.relicQ.push(nowS() + 25);        // реликвия восстановится в другом месте
  pl.g.score += r.v || 1; ev(`${pl.name} нашёл ${r.v === 3 ? 'ЗОЛОТУЮ реликвию (+3)' : 'реликвию'} (${pl.g.score}/${MODES.relics.limit})`);
  for (const [, q] of inGame()) if (q !== pl && q.pos && dxz(q.pos, r) < 40) toast(q, `💎 Рядом кто-то подобрал реликвию — ${pl.name} где-то близко!`);      // слышно в радиусе 40 м
  if (pl.g.score >= MODES.relics.limit) endGame(`${pl.name} собрал ${MODES.relics.limit} реликвий`, [pl]);
}

/* ───── морской бой: пушки, снаряды, урон, потопление ───── */
const BALL = { speed: 88, g: 30, dmg: 12, reload: 1, elMin: 0.03, elMax: 0.62, relMax: 1.1 };
const shipPose = p => p.g.pose || (WORLD.ships && WORLD.ships[p.g.ship]);
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
function gunSlot(sh, meta, idx) {                          // слоты 0–2 — левый борт, 3–5 — правый; те же формулы, что при постройке пушек на клиенте
  const side = idx < 3 ? -1 : 1, along = [-0.25, 0, 0.25][idx % 3] * meta.L, off = meta.W * 0.5 - 1.3;
  const fx = Math.sin(sh.yaw), fz = Math.cos(sh.yaw), rx = Math.cos(sh.yaw) * side, rz = -Math.sin(sh.yaw) * side;
  return { x: sh.x + rx * off + fx * along, z: sh.z + rz * off + fz * along, side };
}
function onFire(pl, msg) {                                 // выстрел из ОДНОЙ пушки: игрок стоит у неё и сам навёл (направление yaw и угол el)
  if (game.phase !== 'play' || game.mode !== 'naval' || !pl.g || !pl.g.alive || pl.g.ship == null) return;
  const sh = shipPose(pl), meta = WORLD.ships[pl.g.ship], idx = msg.gun | 0; if (!sh || !meta || idx < 0 || idx > 5) return;
  const gun = gunSlot(sh, meta, idx), t = nowS(); if ((pl.g.reload[idx] || 0) > t) return;
  if (!pl.pos || Math.hypot(pl.pos.x - gun.x, pl.pos.z - gun.z) > 9) return;                       // стрелять можно, только стоя у пушки
  if (![msg.yaw, msg.el].every(Number.isFinite)) return;
  pl.g.reload[idx] = t + BALL.reload; pl.g.shots = (pl.g.shots || 0) + 1;
  const normal = sh.yaw + gun.side * Math.PI / 2, rel = Math.max(-BALL.relMax, Math.min(BALL.relMax, angDiff(normal, msg.yaw)));      // ствол поворачивается вправо-влево ограниченно
  const yaw = normal + rel + (Math.random() - 0.5) * 0.012, el = Math.max(BALL.elMin, Math.min(BALL.elMax, msg.el)) + (Math.random() - 0.5) * 0.008, sp = BALL.speed * (0.99 + Math.random() * 0.02), hv = sp * Math.cos(el);
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  const b = { id: ++game.bid, o: pl.id, x: gun.x + dx * 2.6, y: 3.4, z: gun.z + dz * 2.6, vx: dx * hv, vy: sp * Math.sin(el), vz: dz * hv, age: 0, ch: msg.ch ? 1 : 0 };
  game.balls.push(b); broadcast({ t: 'shot', b: b.id, o: b.o, s: pl.g.ship, gun: idx, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz });
}
function onRepair(pl, quiet) {                                    // ремонт: стоя на своём корабле, E/«ремонт» — 3 с без движения, +8% корпуса, раз в 20 с
  if (game.phase !== 'play' || game.mode !== 'naval' || !pl.g || !pl.g.alive || pl.g.ship == null || !pl.pos) return;
  const t = nowS(); if ((pl.g.repCd || 0) > t) return quiet || toast(pl, `🔧 Ремонт будет готов через ${Math.ceil(pl.g.repCd - t)} с`);
  const sh = shipPose(pl), m = WORLD.ships[pl.g.ship]; if (!sh || !m) return;
  const dx = pl.pos.x - sh.x, dz = pl.pos.z - sh.z, al = dx * Math.sin(sh.yaw) + dz * Math.cos(sh.yaw), ac = dx * Math.cos(sh.yaw) - dz * Math.sin(sh.yaw);
  if (Math.abs(al) > m.L * 0.5 + 2 || Math.abs(ac) > m.W * 0.5 + 2) return quiet || toast(pl, '🔧 Ремонтировать можно, стоя на своём корабле');
  pl.g.rep = { at: t + 3, x: pl.pos.x, z: pl.pos.z }; quiet || toast(pl, '🔧 Ремонт 3 с — не двигайтесь');
}
function repairTick(t) {
  for (const [, p] of inGame()) { const r = p.g.rep; if (!r) continue; if (!p.g.alive || !p.pos || Math.hypot(p.pos.x - r.x, p.pos.z - r.z) > 4) { p.g.rep = null; toast(p, '🔧 Ремонт прерван'); continue; } if (t >= r.at) { p.g.rep = null; p.g.repCd = t + 20; p.g.hp = Math.min(100, p.g.hp + 8); toast(p, '🔧 Корпус починен (+8%)'); } }
}
function stepBalls(dt) {
  const ps = inGame().filter(([, p]) => p.g.alive && p.g.ship != null);
  game.balls = game.balls.filter(b => {
    if (game.phase !== 'play') return false;
    for (let k = 0; k < 4; k++) {
      const h = dt / 4; b.x += b.vx * h; b.z += b.vz * h; b.y += b.vy * h; b.vy -= BALL.g * h; b.age += h;
      for (const [, p] of ps) {                                              // попадание в корпус чужого корабля
        if (p.id === b.o) continue; const sh = shipPose(p), m = WORLD.ships[p.g.ship]; if (!sh || !m) continue;
        const dx = b.x - sh.x, dz = b.z - sh.z, al = dx * Math.sin(sh.yaw) + dz * Math.cos(sh.yaw), ac = dx * Math.cos(sh.yaw) - dz * Math.sin(sh.yaw);
        if (Math.abs(al) < m.L * 0.5 && Math.abs(ac) < m.W * 0.5 + 1 && b.y > -3 && b.y < 16) { const bl = Math.hypot(b.vx, b.vz) || 1, rs = (-b.vx * Math.cos(sh.yaw) + b.vz * Math.sin(sh.yaw)) / bl, fs = (-b.vx * Math.sin(sh.yaw) - b.vz * Math.cos(sh.yaw)) / bl; toast(p, `💥 По вам попали — стреляют с ${Math.abs(fs) > 0.7 ? (fs > 0 ? 'носа' : 'кормы') : rs > 0 ? 'правого борта' : 'левого борта'}`); if (b.ch) { p.g.slowUntil = nowS() + 6; send(p, { t: 'slow', s: 6 }); } hitShip(p, players.get(b.o), null, b.ch ? 0.5 : 1); broadcast({ t: 'boom', b: b.id, x: b.x, y: b.y, z: b.z, h: 1 }); return false; }
      }
      for (const k of Object.keys(game.nhp || {})) {                          // пустые корабли: урон есть, очков нет
        if (game.nhp[k] <= 0) continue; const sh = WORLD.ships[k]; if (!sh) continue;
        const dx = b.x - sh.x, dz = b.z - sh.z, al = dx * Math.sin(sh.yaw) + dz * Math.cos(sh.yaw), ac = dx * Math.cos(sh.yaw) - dz * Math.sin(sh.yaw);
        if (Math.abs(al) < sh.L * 0.5 && Math.abs(ac) < sh.W * 0.5 + 1 && b.y > -3 && b.y < 16) {
          game.nhp[k] -= BALL.dmg * (0.85 + Math.random() * 0.3); if (game.nhp[k] <= 0) { game.nhp[k] = 0; ev('💥 Пустой корабль потоплен (очков за него нет)'); }
          broadcast({ t: 'boom', b: b.id, x: b.x, y: b.y, z: b.z, h: 1 }); return false;
        }
      }
      if (b.y < 0 || b.age > 7) { broadcast({ t: 'boom', b: b.id, x: b.x, y: Math.max(b.y, 0), z: b.z, h: 0 }); return false; }
    }
    return true;
  });
}
function hitShip(tg, by, amt, k) {
  if (!tg.g.alive) return; const dm = amt != null ? amt : BALL.dmg * (k || 1) * (0.85 + Math.random() * 0.3); tg.g.hp -= dm;
  if (amt == null && by && by.g && by !== tg) { by.g.hits = (by.g.hits || 0) + 1; by.g.dmg = (by.g.dmg || 0) + Math.min(dm, Math.max(0, tg.g.hp + dm)); }      // статистика для итогов
  if (tg.g.hp > 0) return;
  tg.g.hp = 0; tg.g.alive = false; tg.g.respawnAt = Infinity;
  if (by && by.g) { by.g.kills++; by.g.score++; }
  ev(by && by !== tg ? `⚓💥 ${by.name} потопил корабль ${tg.name}!` : `⚓ Корабль ${tg.name} потоплен`, true);
  const left = inGame().filter(([, p]) => p.g.alive && p.g.ship != null);
  if (left.length <= 1) { const w = left.length ? left[0][1] : by; endGame(w ? `${w.name} — последний корабль на плаву` : 'Все корабли потоплены', w ? [w] : []); }
}

function tick() {
  const t = nowS(), dt = 0.1;
  if (game.phase === 'over') { if (t > game.overAt) { if (game.mode === 'naval') for (const k of Object.keys(shipPoses)) delete shipPoses[k]; game = { mode: null, phase: 'idle' }; for (const [, p] of players) delete p.g; resetVoting(); armed = false; } broadcast(snapshot()); return; }
  if (game.phase === 'idle') { autoStart(); return; }
  if (game.phase !== 'play') return;
  for (const [, p] of playing()) if (!p.g) joinLate(p);      // подстраховка: играющий без игровых данных (не успел при входе) — досоздаём, иначе он не спавнится и голосование не начинается
  const ps = inGame();
  if (game.solo && ps.length >= 2) { if (!game.pairAt) game.pairAt = t + 1; if (t >= game.pairAt) { console.debug('[вход] второй игрок в игре — «Изучение» заканчивается, открывается голосование'); stopGame(null, false); } return; }      // второй появился: секунду оба просто стоят в мире (первый не исчезает), потом табличка голосования      // вошёл второй игрок: одиночное «Изучение» заканчивается и открывается голосование
  if (ps.length < (MODES[game.mode] ? MODES[game.mode].min : MIN_PLAYERS)) { stopGame(null, true); return; }
  for (const [, p] of ps) if (!p.g.alive && t >= p.g.respawnAt) { p.g.alive = true; if (game.mode === 'battle' || game.mode === 'ctf') p.g.invUntil = t + 2; if (p.g.rev) { send(p, { t: 'rev', id: p.g.rev }); p.g.rev = 0; } sendSpawn(p); }
  const side = p => p.g.team;
  if (game.mode === 'relics') {
    game.relicQ = game.relicQ.filter(at => { if (t >= at) { addRelic(); return false; } return true; });
  } else if (game.mode === 'capture') {
    if (t >= game.dblAt) { game.dblAt = t + 120; const pp = game.points; pp.forEach(q => { q.w = 1; }); const q = pp[Math.floor(Math.random() * pp.length)]; q.w = 2; ev(`✨ ${q.n} — ДВОЙНАЯ точка (2 очка)!`, true); }
    for (const pt of game.points) {
      let r = 0, b = 0; for (const [, p] of ps) if (p.g.alive && p.pos && dxz(p.pos, pt) <= 30 && Math.abs(p.pos.y - pt.y) < 12) side(p) === 'red' ? r++ : b++;
      if (r && !b) pt.prog = Math.min(1, pt.prog + 0.012 * Math.min(r, 3)); else if (b && !r) pt.prog = Math.max(-1, pt.prog - 0.012 * Math.min(b, 3));
      if (!r && !b && Math.abs(pt.prog) < 0.999) pt.prog -= Math.sign(pt.prog) * Math.min(Math.abs(pt.prog), 0.004);      // никого нет: прогресс откатывается к нейтрали
      if (!pt.ann && (r || b) && !(r && b) && pt.owner !== (r ? 'red' : 'blue') && Math.abs(pt.prog) > 0.05) { pt.ann = true; ev(`⚑ ${TEAM_NAME[r ? 'red' : 'blue']} захватывают ${pt.n}!`); }
      if (Math.abs(pt.prog) < 0.02) pt.ann = false;
      const po = pt.owner;
      pt.owner = pt.prog >= 0.999 ? 'red' : pt.prog <= -0.999 ? 'blue' : null;
      if (pt.owner !== po) broadcast({ t: 'snd', k: pt.owner ? 'cap' : 'lost', team: pt.owner || po });
      if (pt.owner !== po) ev(pt.owner ? `⚑ ${TEAM_NAME[pt.owner]} захватили ${pt.n}!` : `⚐ ${TEAM_NAME[po]} потеряли ${pt.n}`);
    }
    game.scores = { red: game.points.filter(q => q.owner === 'red').reduce((a, q) => a + (q.w || 1), 0), blue: game.points.filter(q => q.owner === 'blue').reduce((a, q) => a + (q.w || 1), 0) };
    if (game.hold) { if (game.scores.red > game.scores.blue) game.hold.red += dt; else if (game.scores.blue > game.scores.red) game.hold.blue += dt; }
    game.respT = game.scores.red > game.scores.blue ? 'red' : game.scores.blue > game.scores.red ? 'blue' : null;      // большинство точек: быстрый респавн      // очки = число удерживаемых точек
    for (const T of ['red', 'blue']) if (game.scores[T] >= game.limit) return endGame(`${TEAM_NAME[T]} захватили больше половины точек (${game.scores[T]} из ${game.points.length})`, ps.filter(([, p]) => side(p) === T).map(([, p]) => p));
  } else if (game.mode === 'ctf') {
    for (const f of Object.values(game.flags)) {
      if (f.st === 'carried') { const c = players.get(f.by); if (c && c.pos && c.g && c.g.alive) { f.x = c.pos.x; f.y = c.pos.y; f.z = c.pos.z; } else { f.st = 'dropped'; f.dropAt = t; f.by = null; if (c && c.g) c.g.carry = null; } }
      else if (f.st === 'dropped' && t - f.dropAt > 20) { returnFlag(f); ev(`↩ Флаг ${TEAM_NAME[f.team]} возвращён на базу`); }              // брошенный флаг сам возвращается через 20 с
    }
    if (!game.crates.length && WORLD.relic.length) {          // 3 лечащих ящика на нейтральной территории — ближайшие к середине между базами точки
      const a = game.bases.red, b = game.bases.blue, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, ok = [];
      for (const r of [...WORLD.relic].sort((u, v) => Math.hypot(u[0] - mx, u[2] - mz) - Math.hypot(v[0] - mx, v[2] - mz))) if (Math.hypot(r[0] - a.x, r[2] - a.z) > 40 && Math.hypot(r[0] - b.x, r[2] - b.z) > 40 && ok.every(o => Math.hypot(o.x - r[0], o.z - r[2]) > 40)) ok.push({ x: r[0], y: r[1], z: r[2], at: 0 });
      game.crates = ok.slice(0, 3); if (!game.crates.length) game.crates = [{ x: mx, y: (a.y + b.y) / 2, z: mz, at: 0 }];
    }
    for (const [, p] of ps) {
      if (!p.g.alive || !p.pos) continue;
      for (const c of game.crates) if (c.at <= t && p.g.hp < 100 && dxz(p.pos, c) <= 4 && Math.abs(p.pos.y - c.y) < 20) { c.at = t + 25; send(p, { t: 'heal', hp: 40 }); }
      const T = p.g.team, E = T === 'red' ? 'blue' : 'red', own = game.flags[T], enemy = game.flags[E];
      if (!p.g.carry && enemy.st !== 'carried' && dxz(p.pos, enemy) <= 7 && Math.abs(p.pos.y - enemy.y) < 14) { enemy.st = 'carried'; enemy.by = p.id; p.g.carry = E; ev(`🚩 ${p.name} несёт флаг (${TEAM_NAME[E]})!`, true); }
      if (own.st === 'dropped' && dxz(p.pos, own) <= 7) { returnFlag(own); ev(`↩ ${p.name} вернул свой флаг — флаг возвращён`); }
      if (p.g.carry && own.st === 'home' && dxz(p.pos, game.bases[T]) <= 10) {
        game.scores[T]++; p.g.score++; returnFlag(game.flags[E]); ev(`🏴 ${p.name} принёс флаг! ${TEAM_NAME[T]}: ${game.scores[T]}/${MODES.ctf.limit}`, true);
        if (game.scores[T] === MODES.ctf.limit - 1) ev(`⚠ МАТЧ-ПОЙНТ: ${TEAM_NAME[T]} в шаге от победы!`, true);
        if (game.scores[T] >= MODES.ctf.limit) return endGame(`${TEAM_NAME[T]} победили`, ps.filter(([, q]) => side(q) === T).map(([, q]) => q));
      }
    }
  } else if (game.mode === 'naval') {
    stepBalls(dt); repairTick(t);
    if (game.zone) { const zr = zoneR(t); for (const [, p] of inGame()) { if (!p.g.alive || p.g.ship == null) continue; const sh = shipPose(p); if (sh && dxz(sh, game.zone) > zr && game.phase === 'play') hitShip(p, null, 1.5 * dt); } }      // вне безопасного круга корпус теряет ~1.5% за тик
  } else if (game.mode === 'hide') {
    if (game.sub === 'hiding' && t >= game.seekAt) { game.sub = 'seek'; ev('🔍 Искатель пошёл искать!', true); }
    const hiders = ps.filter(([, p]) => !p.g.seeker), seekers = ps.filter(([, p]) => p.g.seeker);
    if (!seekers.length && hiders.length) { const [, p] = hiders[Math.floor(Math.random() * hiders.length)]; p.g.seeker = true; ev(`🔍 Новый искатель — ${p.name}`); }
    else if (!hiders.length) return endGame('Искатели нашли всех', seekers.map(([, p]) => p));
    if (game.sub === 'seek' && t >= (game.radarAt || game.seekAt + 40)) {      // радар: раз в 40 с искателям круг 60 м, где кто-то есть
      game.radarAt = t + 40; const h = hiders.length ? hiders[Math.floor(Math.random() * hiders.length)][1] : null;
      if (h && h.pos) { const a = Math.random() * 6.283, d = Math.random() * 35; for (const [, s] of seekers) send(s, { t: 'radar', x: h.pos.x + Math.cos(a) * d, z: h.pos.z + Math.sin(a) * d, r: 60 }); }
    }
  }
  if (game.endAt && t >= game.endAt) return timeUp();
  broadcast(snapshot());
}

  const WORLD_MSG = msg => { if (!WORLD && Array.isArray(msg.spots) && msg.spots.length >= 2) WORLD = { spots: msg.spots.slice(0, 40), relic: (Array.isArray(msg.relic) ? msg.relic : []).slice(0, 400), ships: (Array.isArray(msg.ships) ? msg.ships : []).filter(q => [q.x, q.z, q.yaw, q.L, q.W].every(Number.isFinite)).slice(0, 60) }; };
  const timer = setInterval(() => { try { tick(); } catch (e) { console.error('[core] tick', e); } }, 100);
  return {
    join(id) {                                         // игрок вошёл в комнату
      if (players.has(id)) return players.get(id);
      const pl = { id, pos: null, name: 'Игрок ' + id, ch: null, play: false, vote: null }; players.set(id, pl);
      send(pl, snapshot()); for (const [k, q] of Object.entries(shipPoses)) send(pl, { t: 'ship', id: 0, k: +k, ...q }); broadcast(roster()); return pl;
    },
    leave(id) {                                        // игрок вышел (или закрыл вкладку)
      const pl = players.get(id); if (!pl) return;
      const was = pl.play; if (pl.g) dropFlag(pl); players.delete(id); autoPaused = false; autoAt = 0;
      broadcast({ t: 'leave', id, dead: was }); broadcast(roster()); broadcast(snapshot());
    },
    message(id, msg) {
      if (!msg) return; if (msg.t === 'world') { WORLD_MSG(msg); return; }
      const pl = players.get(id); if (pl) handle(pl, msg);
    },
    get size() { return players.size; },
    get playing() { return game.phase === 'play'; },
    destroy() { clearInterval(timer); },
  };
}
