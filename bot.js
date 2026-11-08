// bot.js — тестовый соперник для проверки режимов без второго человека.
//   node bot.js [комната=777] [режим=naval] [--shoot] [порт=8080]
// Заходит в комнату как «Бот», голосует за режим и стоит на своём корабле (мишень для пушек). С --shoot ещё и отстреливается.
'use strict';
const args = process.argv.slice(2), flags = args.filter(a => a.startsWith('--')), pos = args.filter(a => !a.startsWith('--'));
const ROOM = /^\d{3}$/.test(pos[0] || '') ? pos[0] : '777', MODE = pos[1] || 'naval', PORT = +(pos[2] || 8080), SHOOT = flags.includes('--shoot');
const J = JSON.stringify, sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, myId = null, spawn = null, G = null, voted = false, target = null, lastFire = 0, tick = null;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const log = (...a) => console.log(new Date().toLocaleTimeString(), '[бот]', ...a);

function connect() {
  ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  ws.onopen = () => log(`подключился к :${PORT}`);
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'hello') { myId = m.id; voted = false; spawn = null; ws.send(J({ t: 'join', code: ROOM })); ws.send(J({ t: 'lobby', name: 'Бот', ch: 'sokolin', play: true })); log(`в комнате ${ROOM}, жду игрока…`); }
    else if (m.t === 'spawn') { spawn = m; log(`стою на корабле №${m.ship} (${Math.round(m.x)}, ${Math.round(m.z)})`); }
    else if (m.t === 'st' && m.id !== myId) target = { x: m.x, z: m.z };
    else if (m.t === 'game') {
      const was = G && G.phase; G = m;
      if (m.phase === 'play' && was !== 'play') { voted = false; log(`игра началась: ${m.mode}`); }
      if (m.phase === 'idle' && !voted && (m.pv || []).every(a => a[0] !== myId)) { voted = true; ws.send(J({ t: 'vote', mode: MODE })); log(`голосую за «${MODE}»`); }
      if (m.phase === 'over') { spawn = null; target = null; log('игра окончена: ' + m.winner); }
    }
  };
  ws.onclose = () => { log('соединение закрыто, переподключаюсь…'); clearInterval(tick); setTimeout(connect, 2000); };
  ws.onerror = () => {};
  clearInterval(tick); tick = setInterval(loop, 200);
}
function loop() {
  if (!spawn || !G || G.phase !== 'play' || ws.readyState !== 1) return;
  // стоим у середины правого борта (там пушка №5): сервер разрешает стрелять только рядом с пушкой
  const rx = Math.cos(spawn.yaw), rz = -Math.sin(spawn.yaw), me = { x: spawn.x + rx * 3.7, z: spawn.z + rz * 3.7 };
  ws.send(J({ t: 'st', x: me.x, y: 3.5, z: me.z, yaw: spawn.yaw, a: 'Стойка' }));
  if (!SHOOT || !target || Date.now() - lastFire < 4000) return;
  const dx = target.x - me.x, dz = target.z - me.z, dist = Math.hypot(dx, dz), want = Math.atan2(dx, dz);
  for (const [side, gun] of [[1, 4], [-1, 1]]) {
    const normal = spawn.yaw + side * Math.PI / 2, rel = angDiff(normal, want);
    if (Math.abs(rel) > 1.0 || dist < 35 || dist > 230) continue;
    const el = Math.min(0.6, Math.max(0.05, 0.5 * Math.asin(Math.min(1, dist * 30 / (88 * 88)))));      // дальность = v²·sin(2·угол)/g
    ws.send(J({ t: 'fire', gun, yaw: want + (Math.random() - 0.5) * 0.06, el: el + (Math.random() - 0.5) * 0.03 })); lastFire = Date.now(); log(`стреляю: дистанция ${Math.round(dist)} м`); return;
  }
}
connect();
