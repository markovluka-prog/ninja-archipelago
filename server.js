// server.js — раздаёт проект по HTTP и работает как сервер для игры вдвоём (WebSocket /ws), без внешних зависимостей.
// Запуск:  node server.js [порт]      (по умолчанию 8080)   →  открыть http://localhost:8080/karta3d.html
// Для второго игрока: открыть тот же адрес с другого окна/компьютера (в локальной сети — http://<IP-этого-компьютера>:8080/karta3d.html).
// Лобби: каждый вошедший сначала в меню — выбирает имя и персонажа (одинаковых нельзя), нажимает «Добавить игрока» / «Убрать игрока».
// Закрыл вкладку — его персонаж у остальных погибает (leave с dead:true), а сам персонаж освобождается.
'use strict';
// Автоперезапуск: сервер запускает сам себя под `node --watch`, поэтому после правки server.js он перезапускается сам
// (раньше приходилось вручную останавливать и запускать заново, и игра «не начиналась» из-за старой версии сервера).
if (!process.env.NINJA_WATCH && !process.execArgv.some(a => a.startsWith('--watch'))) {
  const child = require('child_process').spawn(process.execPath, ['--watch-path=' + __filename, '--watch', __filename, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, NINJA_WATCH: '1' } });
  child.on('exit', code => process.exit(code || 0)); for (const sg of ['SIGINT', 'SIGTERM']) process.on(sg, () => { child.kill(sg); });
  return;
}
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = __dirname, PORT = +(process.argv[2] || process.env.PORT || 8080);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.heic': 'image/heic' };

/* ───── HTTP: статические файлы ───── */
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('bad url'); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
});

/* ───── WebSocket (RFC 6455, только текстовые кадры) ───── */
const CHARS = ['richard', 'sokolin', 'ben', 'zantio', 'zhenshi'];                 // персонажи, которых умеет игра
const conns = new Map();        // id → все подключения (в т.ч. ещё не вошедшие в комнату)
const rooms = new Map();        // код (3 цифры) → { code, players: Map, game, armed, autoAt, autoPaused }
let players = new Map();        // игроки ТЕКУЩЕЙ комнаты (см. inRoom): вся логика режимов работает с ней
const ROOM_MAX = 5;
let nextId = 1;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function frame(str, op = 1) {
  const payload = Buffer.from(str), n = payload.length; let head;
  if (n < 126) head = Buffer.from([0x80 | op, n]); else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(n, 2); } else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([head, payload]);
}
const send = (pl, obj) => { try { pl.sock.write(frame(JSON.stringify(obj))); } catch { /* сокет закрыт */ } };
const broadcast = (obj, exceptId) => { for (const [id, pl] of players) if (id !== exceptId) send(pl, obj); };
const roster = () => ({ t: 'roster', list: [...players].map(([id, p]) => ({ id, name: p.name, ch: p.ch, play: p.play, coins: coins[p.name] || 0 })) });

server.on('upgrade', (req, sock) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws' || !req.headers['sec-websocket-key']) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const id = nextId++, pl = { id, pos: null, sock, name: 'Игрок ' + id, ch: null, play: false, room: null, buf: Buffer.alloc(0) }; conns.set(id, pl);
  send(pl, { t: 'hello', id, chars: CHARS });
  console.log(`[+] подключился ${id}; на сайте: ${conns.size}`);
  const drop = () => { if (!conns.has(id)) return; leaveRoom(pl); conns.delete(id); console.log(`[-] отключился ${id}; на сайте: ${conns.size}`); };
  sock.on('close', drop); sock.on('error', drop);
  sock.on('data', chunk => {
    pl.buf = Buffer.concat([pl.buf, chunk]);
    for (;;) {                                           // разбор кадров
      const b = pl.buf; if (b.length < 2) return;
      const op = b[0] & 0x0f, masked = !!(b[1] & 0x80); let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; } else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      const need = off + (masked ? 4 : 0) + len; if (b.length < need) return;
      let data = b.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const m = b.subarray(off, off + 4); data = Buffer.from(data); for (let i = 0; i < data.length; i++) data[i] ^= m[i & 3]; }
      pl.buf = b.subarray(need);
      if (op === 8) { try { sock.end(frame('', 8)); } catch { /* */ } drop(); return; }
      if (op === 9) { try { sock.write(frame(data.toString(), 10)); } catch { /* */ } continue; }
      if (op !== 1) continue;
      let msg; try { msg = JSON.parse(data.toString()); } catch { continue; }
      if (!msg) continue;
      if (msg.t === 'world') { if (!WORLD && Array.isArray(msg.spots) && msg.spots.length >= 2) WORLD = { spots: msg.spots.slice(0, 40), relic: (Array.isArray(msg.relic) ? msg.relic : []).slice(0, 400), ships: (Array.isArray(msg.ships) ? msg.ships : []).filter(q => [q.x, q.z, q.yaw, q.L, q.W].every(Number.isFinite)).slice(0, 60) }; continue; }
      if (msg.t === 'join') { joinRoom(pl, msg); continue; }
      if (msg.t === 'leaveRoom') { leaveRoom(pl); continue; }
      if (msg.t === 'rooms') { send(pl, roomsMsg()); continue; }
      const room = pl.room && rooms.get(pl.room); if (!room) continue;                // всё остальное — только внутри комнаты
      inRoom(room, () => handle(pl, msg));
    }
  });
});


/* ───── комнаты: у каждой свои игроки, голоса, режим и отсчёт. inRoom «переключает» глобальные players/game/armed/... на нужную комнату ───── */
function inRoom(room, fn) {
  players = room.players; game = room.game; armed = room.armed; autoAt = room.autoAt; autoPaused = room.autoPaused;
  try { return fn(); } finally { room.game = game; room.armed = armed; room.autoAt = autoAt; room.autoPaused = autoPaused; players = new Map(); }
}
function roomsMsg() { return { t: 'rooms', list: [...rooms.values()].map(r => ({ code: r.code, n: r.players.size, playing: r.game.phase === 'play' })) }; }
function joinRoom(pl, msg) {
  let code = String(msg.code == null ? '' : msg.code).trim();
  if (msg.create || code === 'new') {                                              // новая комната со случайным свободным кодом
    const free = []; for (let c = 100; c <= 999; c++) if (!rooms.has(String(c))) free.push(String(c));
    if (!free.length) return send(pl, { t: 'room', err: 'Все комнаты заняты' });
    code = free[Math.floor(Math.random() * free.length)];
  }
  if (!/^\d{3}$/.test(code)) return send(pl, { t: 'room', err: 'Код комнаты — ровно 3 цифры' });
  if (pl.room === code) return send(pl, { t: 'room', code });
  let room = rooms.get(code);
  if (room && room.players.size >= ROOM_MAX) return send(pl, { t: 'room', err: `Комната ${code} полна (макс. ${ROOM_MAX})` });
  if (pl.room) leaveRoom(pl);
  if (!room) { room = { code, players: new Map(), game: { mode: null, phase: 'idle' }, armed: false, autoAt: 0, autoPaused: false }; rooms.set(code, room); console.log(`[комната ${code}] создана`); }
  pl.room = code; pl.ch = null; pl.play = false; pl.vote = null; delete pl.g; pl.pos = null;
  send(pl, { t: 'room', code });
  inRoom(room, () => { players.set(pl.id, pl); send(pl, snapshot()); broadcast(roster()); });
  console.log(`[комната ${code}] вошёл ${pl.id}; в комнате: ${room.players.size}`);
}
function leaveRoom(pl) {
  const room = pl.room && rooms.get(pl.room); pl.room = null; if (!room) return;
  inRoom(room, () => {
    const was = pl.play; if (pl.g) dropFlag(pl); players.delete(pl.id); autoPaused = false; autoAt = 0;
    broadcast({ t: 'leave', id: pl.id, dead: was }); broadcast(roster()); broadcast(snapshot());
  });
  pl.play = false; pl.ch = null; pl.vote = null; delete pl.g;
  send(pl, { t: 'room', code: null }); send(pl, { t: 'roster', list: [] }); send(pl, { t: 'game', phase: 'idle', mode: null, pl: [], ver: 4, world: !!WORLD });
  console.log(`[комната ${room.code}] вышел ${pl.id}; осталось: ${room.players.size}`);
  if (!room.players.size) { rooms.delete(room.code); console.log(`[комната ${room.code}] закрыта (пусто)`); }
}

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
    broadcast({ ...msg, id, ch: pl.ch }, id);
  }
  else if (msg.t === 'vote') { if (pl.play) { pl.vote = MODES[msg.mode] ? msg.mode : null; broadcast(snapshot()); } }          // голос за режим
  else if (msg.t === 'ship' && pl.g && pl.g.ship != null && game.mode === 'naval') {            // хозяин корабля присылает его позу — остальным
    if ([msg.x, msg.z, msg.yaw].every(Number.isFinite)) { pl.g.pose = { x: msg.x, z: msg.z, yaw: msg.yaw }; broadcast({ t: 'ship', id, x: msg.x, z: msg.z, yaw: msg.yaw, su: msg.su ? 1 : 0 }, id); }
  }
  else if (msg.t === 'fire') onFire(pl, msg);
  else if (msg.t === 'start') { if (pl.play && MODES[msg.mode]) pl.vote = msg.mode; if (game.phase === 'idle') { const m = pl.play && playing().length >= MIN_PLAYERS ? pickMode() : MODES[msg.mode] ? msg.mode : null; if (m) startGame(pl, m); } else startGame(pl, String(msg.mode)); }
  else if (msg.t === 'stop') stopGame(pl);
  else if (msg.t === 'hit') onHit(pl, msg);
  else if (msg.t === 'died') onDied(pl, msg);
  else if (msg.t === 'grab') onGrab(pl, msg);
  else if (msg.t === 'chat') { const text = String(msg.text || '').trim().slice(0, 200); if (text) broadcast({ t: 'chat', id, name: pl.name, ch: pl.ch, text }, id); }
}

/* ───────────── РЕЖИМЫ ИГРЫ ─────────────
   Сервер — судья: клиенты присылают позиции (st), удары (hit), гибель (died), подбор реликвии (grab); сервер считает очки, захват точек, флаги, прятки и раз в 0.1 с рассылает снимок игры (game).
   Монеты за победу хранятся в coins.json по имени игрока. */
const COINS_FILE = path.join(ROOT, 'coins.json'); let coins = {};
try { coins = JSON.parse(fs.readFileSync(COINS_FILE, 'utf8')); } catch { /* файла ещё нет */ }
const saveCoins = () => fs.writeFile(COINS_FILE, JSON.stringify(coins), () => {});
const MODES = {
  battle:  { name: 'Битва',            min: 2, pvp: true,  limit: 10, secs: 480 },     // 10 побед
  relics:  { name: 'Поиск реликвий',   min: 2, pvp: false, limit: 10 },                 // 10 реликвий
  capture: { name: 'Захват точек',     min: 2, pvp: true,  teams: true, limit: 200, secs: 420 },
  ctf:     { name: 'Битва флагов',     min: 2, pvp: true,  teams: true, limit: 3, secs: 600 },
  hide:    { name: 'Прятки',           min: 2, pvp: false },
  explore: { name: 'Изучение',        min: 2, pvp: false },                // без целей и времени: гулять и общаться вдвоём; заканчивается кнопкой «Закончить игру»
  naval:   { name: 'Морской бой',      min: 2, pvp: false, secs: 480 },     // у каждого свой корабль; побеждает последний на плаву
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
const MIN_PLAYERS = 2, AUTO_SEC = 20;
let autoAt = 0, autoPaused = false;                       // отсчёт до автозапуска, когда в игре двое; autoPaused — игру закончили вручную                                    // пока в игре меньше двух — игра не идёт, все ходят свободно
const playing = () => [...players].filter(([, p]) => p.play && p.ch);
const nowS = () => Date.now() / 1000;
const dxz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const inGame = () => [...players].filter(([, p]) => p.g);
const ev = (text, big) => broadcast({ t: 'ev', text, big: !!big });
const toast = (pl, text) => send(pl, { t: 'ev', text });

function spawnFor(p, first) {
  if (p.g.ship != null && WORLD.ships[p.g.ship]) { const sh = WORLD.ships[p.g.ship]; return { x: sh.x, z: sh.z, yaw: sh.yaw }; }                              // старт раунда: каждому своё место (команде — её база); возрождение в битве — случайная точка
  const s = game.bases && p.g.team ? game.bases[p.g.team] : first && p.g.spawn ? p.g.spawn : WORLD.spots[Math.floor(Math.random() * WORLD.spots.length)], a = Math.random() * 6.283, r = 8 + Math.random() * 14;
  return { x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r, yaw: s.yaw || 0 };
}
const sendSpawn = (p, first) => send(p, { t: 'spawn', ...spawnFor(p, first), ship: p.g.ship });
const newG = () => ({ hp: 100, ship: null, pose: null, reload: { '-1': 0, '1': 0 }, spawn: null, score: 0, kills: 0, team: null, alive: true, carry: null, seeker: false, respawnAt: 0, lastHit: {} });

function snapshot() {
  const t = nowS(), M = MODES[game.mode];
  return {
    t: 'game', ver: 4, world: !!WORLD, armed: armed ? pickMode() : null, cd: autoAt ? Math.max(0, Math.ceil(autoAt - nowS())) : null, dm: pickMode(), np: playing().length, votes: votes(), first: firstPlayer(), pv: playing().filter(([, p]) => MODES[p.vote]).map(([id, p]) => [id, p.vote]), mode: game.mode, mn: M && M.name, phase: game.phase, sub: game.sub, left: game.endAt ? Math.max(0, Math.round(game.endAt - t)) : null,
    hideLeft: game.sub === 'hiding' ? Math.max(0, Math.round(game.seekAt - t)) : 0, limit: M && M.limit, winner: game.winner,
    sc: game.scores && { red: Math.floor(game.scores.red), blue: Math.floor(game.scores.blue) },
    pl: inGame().map(([id, p]) => [id, p.g.score, p.g.kills, p.g.team, p.g.alive ? 1 : 0, p.g.carry || '', p.g.seeker ? 1 : 0, Math.max(0, Math.round(p.g.hp)), p.g.ship]),
    relics: game.relics, bases: game.bases, nv: game.nhp && Object.entries(game.nhp).map(([k, hp]) => [+k, Math.round(hp)]),
    points: game.points && game.points.map(q => ({ n: q.n, x: q.x, y: q.y, z: q.z, o: q.owner, p: +q.prog.toFixed(2) })),
    flags: game.flags && Object.values(game.flags).map(f => ({ team: f.team, st: f.st, x: f.x, y: f.y, z: f.z })),
  };
}

function startGame(starter, mode) {
  const M = MODES[mode]; if (!M) return;
  if (game.phase === 'play') return starter && toast(starter, 'Игра уже идёт — сначала закончите её');
  if (!WORLD) return starter && toast(starter, 'Мир ещё не передал данные — подождите пару секунд и повторите');
  const ps = playing();
  if (ps.length < Math.max(MIN_PLAYERS, M.min)) {          // одному играть нельзя: режим «взводится» и запустится сам, когда войдёт второй
    armed = true; if (starter) toast(starter, `Режим «${M.name}» выбран. Игра начнётся сама, когда войдёт второй игрок — пока ходите где хотите`);
    console.log(`[игра] режим ${M.name} ждёт второго игрока`); return broadcast(snapshot());
  }
  if (mode === 'naval' && (WORLD.ships || []).length < ps.length) { armed = false; for (const [, p] of players) delete p.vote; broadcast(snapshot()); return starter && toast(starter, `Для морского боя нужно кораблей: ${ps.length}, на карте их ${(WORLD.ships || []).length}`); }
  armed = false; autoAt = 0; for (const [, p] of players) delete p.vote; const t = nowS();
  game = { mode, phase: 'play', t0: t, endAt: M.secs ? t + M.secs : null, scores: { red: 0, blue: 0 }, rid: 0 };
  for (const [, p] of ps) p.g = newG();
  if (M.teams) { shuffle(ps).forEach(([, p], i) => { p.g.team = i % 2 ? 'blue' : 'red'; }); }
  const S = WORLD.spots;
  { const sp = shuffle(S.slice()); ps.forEach(([, p], i) => { p.g.spawn = mode === 'relics' || mode === 'explore' ? sp[0] : sp[i % sp.length]; }); game.avoid = mode === 'relics' ? sp[0] : null; }      // реликвии: все стартуют в одном месте; остальные режимы — у каждого своя точка
  const isl = s => s.i != null ? 'i' + s.i : 'n' + s.n, far = L => { let best = -1, A = L[0], B = L[1] || L[0]; for (const a of L) for (const b of L) { const d = dxz(a, b); if (d > best) { best = d; A = a; B = b; } } return [A, B]; };
  const bs = s => ({ n: s.n, x: s.x, y: s.y, z: s.z, yaw: s.yaw });
  if (mode === 'ctf') {                                   // флаги — на большом острове: базы = две самые удалённые точки на нём
    const big = S.filter(s => s.big), [A, B] = far(big.length >= 2 ? big : S); game.bases = { red: bs(A), blue: bs(B) };
  } else if (mode === 'capture') {                        // по точке на остров; команды стартуют на двух самых удалённых островах
    const reps = []; for (const s of S) if (!reps.some(r => isl(r) === isl(s))) reps.push(s);
    const [A, B] = far(reps); game.bases = { red: bs(A), blue: bs(B) };
    game.points = reps.map(r => { const o = S.find(s => isl(s) === isl(r) && s.n !== A.n && s.n !== B.n) || r; return { n: o.n, x: o.x, y: o.y, z: o.z, owner: null, prog: 0 }; });
  }
  if (mode === 'naval') {                                 // каждому — свой корабль на старте (случайные, подальше друг от друга)
    const sh = WORLD.ships || [];
    const pick = shuffle(sh.map((q, k) => k)); game.balls = []; game.bid = 0;
    ps.forEach(([, p], i) => { p.g.ship = pick[i]; p.g.pose = null; });
    game.nhp = {}; for (const k of pick.slice(ps.length)) game.nhp[k] = 100;      // остальные корабли — пустые: их тоже можно потопить, но очков за них нет
  }
  if (mode === 'relics') { game.relics = []; game.relicQ = []; for (let i = 0; i < 12; i++) addRelic(); }
  if (mode === 'ctf') game.flags = { red: { team: 'red', st: 'home', ...game.bases.red, by: null }, blue: { team: 'blue', st: 'home', ...game.bases.blue, by: null } };
  if (mode === 'hide') { game.sub = 'hiding'; game.seekAt = t + 30; game.endAt = t + 30 + 180; const [, sk] = ps[Math.floor(Math.random() * ps.length)]; sk.g.seeker = true; ev(`🔍 Искатель — ${sk.name}. На прятки 30 секунд!`); }
  for (const [, p] of ps) sendSpawn(p, true);
  ev(starter ? `🎮 Игра началась! ${starter.name} запустил «${M.name}»` : `🎮 Игра началась! Режим «${M.name}»`);
  console.log(`[игра] ${M.name}, игроков: ${ps.length}`); broadcast(snapshot());
}
function stopGame(by, rearm) {
  if (game.phase === 'idle') { if (armed && by) { armed = false; ev(`⏹ ${by.name} отменил запуск`); broadcast(snapshot()); } return; }
  const was = game.mode; game = { mode: null, phase: 'idle' }; for (const [, p] of players) delete p.g;
  autoAt = 0; autoPaused = !rearm && !!by; armed = !!rearm; if (rearm) for (const [, p] of playing()) p.vote = was;
  ev(rearm ? '⏸ Игрок вышел — игра остановлена. Режим стартует снова, когда будет двое' : `⏹ ${by ? by.name : 'Сервер'} закончил игру`, true); broadcast(snapshot());
}
function randomMode() {                                    // никто не проголосовал — случайный режим (морской бой только если хватает кораблей)
  const n = playing().length, ok = Object.keys(MODES).filter(k => k !== 'naval' || ((WORLD && WORLD.ships) || []).length >= n);
  return ok[Math.floor(Math.random() * ok.length)];
}
function autoStart() {                                     // второй игрок появился — режим запускается сам, всё появляется разом
  if (game.phase !== 'idle' || !WORLD || playing().length < MIN_PLAYERS) { autoAt = 0; return; }
  if (armed) { autoAt = 0; const m = pickMode(); if (m) startGame(null, m); else armed = false; return; }
  if (autoPaused) { autoAt = 0; return; }
  if (!autoAt) { autoAt = nowS() + AUTO_SEC; ev(`👥 Игроков достаточно! Выберите режим голосованием — игра начнётся через ${AUTO_SEC} секунд (или когда проголосуют все)`, true); broadcast(snapshot()); }
  else if (nowS() >= autoAt || playing().every(([, p]) => MODES[p.vote])) { autoAt = 0; startGame(null, pickMode() || randomMode()); }      // время вышло или все проголосовали
  else broadcast(snapshot());
}
function joinLate(pl) {                                    // зашёл в игру посреди раунда
  if (!WORLD) return; pl.g = newG();
  if (MODES[game.mode].teams) { const c = { red: 0, blue: 0 }; for (const [, p] of inGame()) if (p !== pl) c[p.g.team]++; pl.g.team = c.red <= c.blue ? 'red' : 'blue'; }
  if (game.mode === 'hide') pl.g.seeker = true;
  if (game.mode === 'naval') { const used = new Set(inGame().map(([, p]) => p.g.ship)), free = (WORLD.ships || []).map((q, k) => k).filter(k => !used.has(k) && (game.nhp[k] == null || game.nhp[k] > 0)); if (!free.length) { pl.g.alive = false; pl.g.hp = 0; pl.g.respawnAt = Infinity; ev(`${pl.name} наблюдает: свободных кораблей нет`); return; } pl.g.ship = free[Math.floor(Math.random() * free.length)]; delete game.nhp[pl.g.ship]; }
  sendSpawn(pl); ev(`${pl.name} присоединился к игре`);
}
function endGame(text, winners) {
  if (game.phase !== 'play') return;
  game.phase = 'over'; game.overAt = nowS() + 9; game.winner = text;
  for (const p of winners) coins[p.name] = (coins[p.name] || 0) + 1; if (winners.length) saveCoins();
  ev(`🏆 ${text}${winners.length ? ' · +1 🪙' : ''}`, true); broadcast(roster()); console.log('[игра] конец: ' + text);
}
function timeUp() {
  const ps = inGame(), M = MODES[game.mode];
  if (game.mode === 'battle') { const top = Math.max(...ps.map(([, p]) => p.g.score)), w = ps.filter(([, p]) => p.g.score === top).map(([, p]) => p); return endGame(w.length === 1 ? `${w[0].name} победил по очкам (${top})` : 'Время вышло — ничья', w.length === 1 ? w : []); }
  if (M.teams) { const a = game.scores.red, b = game.scores.blue; if (Math.floor(a) === Math.floor(b)) return endGame('Время вышло — ничья', []); const T = a > b ? 'red' : 'blue'; return endGame(`${TEAM_NAME[T]} победили по очкам`, ps.filter(([, p]) => p.g.team === T).map(([, p]) => p)); }
  if (game.mode === 'naval') { const top = Math.max(...ps.map(([, p]) => p.g.hp)), w = ps.filter(([, p]) => p.g.hp === top).map(([, p]) => p); return endGame(w.length === 1 ? `${w[0].name} — самый целый корабль (${Math.round(top)}%)` : 'Время вышло — ничья', w.length === 1 ? w : []); }
  if (game.mode === 'hide') return endGame('Прячущиеся продержались!', ps.filter(([, p]) => !p.g.seeker).map(([, p]) => p));
}
function addRelic() {
  const C = WORLD.relic; if (!C.length) return;
  for (let k = 0; k < 25; k++) { const c = C[Math.floor(Math.random() * C.length)]; if (game.relics.every(r => Math.hypot(r.x - c[0], r.z - c[2]) > 80) && (!game.avoid || Math.hypot(game.avoid.x - c[0], game.avoid.z - c[2]) > 120)) { game.relics.push({ id: ++game.rid, x: c[0], y: c[1], z: c[2] }); return; } }
}
function dropFlag(pl) {
  if (!game.flags || !pl.g || !pl.g.carry) return;
  const f = game.flags[pl.g.carry]; if (f && f.st === 'carried' && f.by === pl.id) { f.st = 'dropped'; f.dropAt = nowS(); if (pl.pos) { f.x = pl.pos.x; f.y = pl.pos.y; f.z = pl.pos.z; } f.by = null; }
  pl.g.carry = null;
}
function returnFlag(f) {
  const b = game.bases[f.team]; f.st = 'home'; f.x = b.x; f.y = b.y; f.z = b.z; f.by = null;
  for (const [, p] of inGame()) if (p.g.carry === f.team) p.g.carry = null;
}

function onHit(pl, msg) {                                  // удар по другому игроку (атакующий определяет попадание, сервер проверяет)
  if (game.phase !== 'play' || !pl.g || !pl.g.alive) return;
  const tg = players.get(+msg.to); if (!tg || tg === pl || !tg.g || !tg.g.alive || !pl.pos || !tg.pos) return;
  if (dxz(pl.pos, tg.pos) > 14 || Math.abs(pl.pos.y - tg.pos.y) > 14) return;
  const t = nowS(); if ((pl.g.lastHit[tg.id] || 0) > t - 0.25) return; pl.g.lastHit[tg.id] = t;
  if (game.mode === 'hide') {                              // ловят только искатели; найденный сам становится искателем
    if (game.sub === 'seek' && pl.g.seeker && !tg.g.seeker) { tg.g.seeker = true; ev(`👀 ${pl.name} нашёл игрока ${tg.name}!`); }
    return;
  }
  if (!MODES[game.mode].pvp) return;
  if (MODES[game.mode].teams && pl.g.team === tg.g.team) return;           // по своим не бьём
  send(tg, { t: 'hurt', from: pl.id, dmg: Math.min(35, Math.max(1, +msg.dmg || 15)), x: pl.pos.x, y: pl.pos.y, z: pl.pos.z });
}
function onDied(pl, msg) {
  if (game.phase !== 'play' || !pl.g || !pl.g.alive || !MODES[game.mode].pvp) return;
  pl.g.alive = false; pl.g.respawnAt = nowS() + 3; dropFlag(pl);
  const k = players.get(+msg.by); const killer = k && k !== pl && k.g && k.play ? k : null;
  if (killer) { killer.g.kills++; if (game.mode === 'battle') killer.g.score++; }
  ev(killer ? `⚔ ${killer.name} ➜ ${pl.name}` : `☠ ${pl.name} погиб`);
  if (killer && game.mode === 'battle' && killer.g.score >= MODES.battle.limit) endGame(`${killer.name} победил в битве (${killer.g.score})`, [killer]);
}
function onGrab(pl, msg) {
  if (game.phase !== 'play' || game.mode !== 'relics' || !pl.g || !pl.pos) return;
  const i = game.relics.findIndex(r => r.id === +msg.id); if (i < 0) return;
  const r = game.relics[i]; if (dxz(pl.pos, r) > 16 || Math.abs(pl.pos.y - r.y) > 16) return;
  game.relics.splice(i, 1); game.relicQ.push(nowS() + 25);        // реликвия восстановится в другом месте
  pl.g.score++; ev(`💎 ${pl.name} нашёл реликвию (${pl.g.score}/${MODES.relics.limit})`);
  if (pl.g.score >= MODES.relics.limit) endGame(`${pl.name} собрал ${MODES.relics.limit} реликвий`, [pl]);
}

/* ───── морской бой: пушки, снаряды, урон, потопление ───── */
const BALL = { speed: 88, elev: 0.17, g: 30, dmg: 6, reload: 1, guns: 3 };
const shipPose = p => p.g.pose || (WORLD.ships && WORLD.ships[p.g.ship]);
function onFire(pl, msg) {
  if (game.phase !== 'play' || game.mode !== 'naval' || !pl.g || !pl.g.alive || pl.g.ship == null) return;
  const sh = shipPose(pl), meta = WORLD.ships[pl.g.ship]; if (!sh || !meta) return;
  const side = +msg.side > 0 ? 1 : -1, t = nowS(); if (pl.g.reload[side] > t) return; pl.g.reload[side] = t + BALL.reload;
  const fx = Math.sin(sh.yaw), fz = Math.cos(sh.yaw), rx = Math.cos(sh.yaw) * side, rz = -Math.sin(sh.yaw) * side;
  for (let i = 0; i < BALL.guns; i++) {
    const off = (i - (BALL.guns - 1) / 2) * meta.L * 0.22, sp = BALL.speed * (0.94 + Math.random() * 0.12), a = (Math.random() - 0.5) * 0.07, el = BALL.elev + (Math.random() - 0.5) * 0.04;
    const dx = rx * Math.cos(a) - fx * Math.sin(a) * side, dz = rz * Math.cos(a) - fz * Math.sin(a) * side, hv = sp * Math.cos(el);
    const b = { id: ++game.bid, o: pl.id, x: sh.x + rx * meta.W * 0.5 + fx * off, y: 3.2, z: sh.z + rz * meta.W * 0.5 + fz * off, vx: dx * hv, vy: sp * Math.sin(el), vz: dz * hv, age: 0 };
    game.balls.push(b); broadcast({ t: 'shot', b: b.id, o: b.o, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz });
  }
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
        if (Math.abs(al) < m.L * 0.5 && Math.abs(ac) < m.W * 0.5 + 1 && b.y > -3 && b.y < 16) { hitShip(p, players.get(b.o)); broadcast({ t: 'boom', b: b.id, x: b.x, y: b.y, z: b.z, h: 1 }); return false; }
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
function hitShip(tg, by) {
  if (!tg.g.alive) return; tg.g.hp -= BALL.dmg * (0.85 + Math.random() * 0.3);
  if (tg.g.hp > 0) return;
  tg.g.hp = 0; tg.g.alive = false; tg.g.respawnAt = Infinity;
  if (by && by.g) { by.g.kills++; by.g.score++; }
  ev(by && by !== tg ? `⚓💥 ${by.name} потопил корабль ${tg.name}!` : `⚓ Корабль ${tg.name} потоплен`, true);
  const left = inGame().filter(([, p]) => p.g.alive && p.g.ship != null);
  if (left.length <= 1) { const w = left.length ? left[0][1] : by; endGame(w ? `${w.name} — последний корабль на плаву` : 'Все корабли потоплены', w ? [w] : []); }
}

function tick() {
  const t = nowS(), dt = 0.1;
  if (game.phase === 'over') { if (t > game.overAt) { game = { mode: null, phase: 'idle' }; for (const [, p] of players) delete p.g; } broadcast(snapshot()); return; }
  if (game.phase === 'idle') { autoStart(); return; }
  if (game.phase !== 'play') return;
  const ps = inGame(); if (ps.length < MIN_PLAYERS) { stopGame(null, true); return; }
  for (const [, p] of ps) if (!p.g.alive && t >= p.g.respawnAt) { p.g.alive = true; sendSpawn(p); }
  const side = p => p.g.team;
  if (game.mode === 'relics') {
    game.relicQ = game.relicQ.filter(at => { if (t >= at) { addRelic(); return false; } return true; });
  } else if (game.mode === 'capture') {
    for (const pt of game.points) {
      let r = 0, b = 0; for (const [, p] of ps) if (p.g.alive && p.pos && dxz(p.pos, pt) <= 30 && Math.abs(p.pos.y - pt.y) < 40) side(p) === 'red' ? r++ : b++;
      if (r && !b) pt.prog = Math.min(1, pt.prog + 0.012 * Math.min(r, 3)); else if (b && !r) pt.prog = Math.max(-1, pt.prog - 0.012 * Math.min(b, 3));
      pt.owner = pt.prog >= 0.999 ? 'red' : pt.prog <= -0.999 ? 'blue' : null;
      if (pt.owner) game.scores[pt.owner] += dt;                                  // 1 очко в секунду за каждую удерживаемую точку
    }
    for (const T of ['red', 'blue']) if (game.scores[T] >= MODES.capture.limit) return endGame(`${TEAM_NAME[T]} захватили острова`, ps.filter(([, p]) => side(p) === T).map(([, p]) => p));
  } else if (game.mode === 'ctf') {
    for (const f of Object.values(game.flags)) {
      if (f.st === 'carried') { const c = players.get(f.by); if (c && c.pos && c.g && c.g.alive) { f.x = c.pos.x; f.y = c.pos.y; f.z = c.pos.z; } else { f.st = 'dropped'; f.dropAt = t; f.by = null; if (c && c.g) c.g.carry = null; } }
      else if (f.st === 'dropped' && t - f.dropAt > 20) returnFlag(f);              // брошенный флаг сам возвращается через 20 с
    }
    for (const [, p] of ps) {
      if (!p.g.alive || !p.pos) continue;
      const T = p.g.team, E = T === 'red' ? 'blue' : 'red', own = game.flags[T], enemy = game.flags[E];
      if (!p.g.carry && enemy.st !== 'carried' && dxz(p.pos, enemy) <= 7 && Math.abs(p.pos.y - enemy.y) < 14) { enemy.st = 'carried'; enemy.by = p.id; p.g.carry = E; ev(`🚩 ${p.name} несёт флаг (${TEAM_NAME[E]})`); }
      if (own.st === 'dropped' && dxz(p.pos, own) <= 7) { returnFlag(own); ev(`↩ ${p.name} вернул свой флаг`); }
      if (p.g.carry && own.st === 'home' && dxz(p.pos, game.bases[T]) <= 10) {
        game.scores[T]++; p.g.score++; returnFlag(game.flags[E]); ev(`🏴 ${p.name} принёс флаг! ${TEAM_NAME[T]}: ${game.scores[T]}/${MODES.ctf.limit}`);
        if (game.scores[T] >= MODES.ctf.limit) return endGame(`${TEAM_NAME[T]} победили`, ps.filter(([, q]) => side(q) === T).map(([, q]) => q));
      }
    }
  } else if (game.mode === 'naval') {
    stepBalls(dt);
  } else if (game.mode === 'hide') {
    if (game.sub === 'hiding' && t >= game.seekAt) { game.sub = 'seek'; ev('🔍 Искатель пошёл искать!', true); }
    const hiders = ps.filter(([, p]) => !p.g.seeker), seekers = ps.filter(([, p]) => p.g.seeker);
    if (!seekers.length && hiders.length) { const [, p] = hiders[Math.floor(Math.random() * hiders.length)]; p.g.seeker = true; ev(`🔍 Новый искатель — ${p.name}`); }
    else if (!hiders.length) return endGame('Искатели нашли всех', seekers.map(([, p]) => p));
  }
  if (game.endAt && t >= game.endAt) return timeUp();
  broadcast(snapshot());
}
setInterval(() => { for (const room of [...rooms.values()]) inRoom(room, tick); }, 100);

server.listen(PORT, () => {
  const nets = require('os').networkInterfaces(), ips = Object.values(nets).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log(`Сервер игры: http://localhost:${PORT}/karta3d.html`);
  for (const ip of ips) console.log(`  для второго игрока в сети: http://${ip}:${PORT}/karta3d.html`);
});
