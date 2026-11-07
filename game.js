// game.js — клиентская часть режимов игры (судья — server.js): HUD, 3D-объекты (реликвии, флаги, точки захвата), удары между игроками,
// гибель/возрождение, «слепой» искатель в прятках, запрет телепорта. Режимы: battle, relics, capture, ctf, hide.
export const MODE_INFO = {
  battle:  { icon: '⚔️', name: 'Битва', desc: 'Бей соперников — первый, у кого 10 побед, получает 🪙. Телепорт выключен.',
    goal: 'Первым одержать 10 побед над соперниками.', rules: ['Бейте других игроков — каждое убийство = 1 победа', 'После гибели вы возрождаетесь через 3 секунды в случайном месте', 'Телепорт выключен. Время раунда — 8 минут (при ничьей победителя нет)'] },
  relics:  { icon: '💎', name: 'Поиск реликвий', desc: 'Реликвии спрятаны в сложных местах (крыши, вершины) и издалека не видны — ищите! Кто соберёт 10 — победил. Подобранные появляются снова в других местах.',
    goal: 'Первым собрать 10 реликвий.', rules: ['Все стартуют в одном месте, реликвии разбросаны случайно по миру', 'Реликвии спрятаны на крышах и вершинах — видны только вблизи (≈28 м)', 'Подойдите вплотную, чтобы подобрать', 'Подобранная реликвия через 25 секунд появится в другом месте'] },
  capture: { icon: '🚩', name: 'Захват точек', desc: 'Две команды бьются за острова: стойте у флага, чтобы захватить. Каждая точка даёт очко в секунду, до 200.',
    goal: 'Набрать 200 очков раньше другой команды.', rules: ['На каждом острове — одна точка; стойте у её флага, чтобы захватить (чем больше вас — тем быстрее)', 'Каждая удерживаемая точка даёт команде 1 очко в секунду', 'Бейте соперников, не давайте им захватить точки. Раунд — 7 минут'] },
  ctf:     { icon: '🏴', name: 'Битва флагов', desc: 'Командная битва: украдите флаг соперника и принесите на свою базу. До 3 захватов.',
    goal: 'Первой команде совершить 3 захвата флага.', rules: ['Бой идёт на самом большом острове — там базы и флаги', 'Подбегите к флагу соперника — вы понесёте его', 'Принесите его на свою базу, пока ваш флаг лежит дома', 'Убитый носитель роняет флаг; упавший флаг сам вернётся через 20 с. Раунд — 10 минут'] },
  hide:    { icon: '🙈', name: 'Прятки', desc: 'Один искатель (30 с слепой), остальные прячутся. Найденный (удар) становится искателем. Продержись 3 минуты!',
    goal: 'Прячущимся — продержаться 3 минуты. Искателю — найти всех.', rules: ['Один случайный игрок — искатель: первые 30 секунд он слеп, но потом бегает в 1.75 раза быстрее',  'Остальные прячутся (имена над головами скрыты)', 'Найденный (удар искателя) сам становится искателем'] },
  naval:   { icon: '🚢', name: 'Морской бой', desc: 'У каждого свой корабль. Стреляйте из пушек бортовыми залпами и топите чужие корабли — побеждает последний на плаву.',
    goal: 'Потопить корабли соперников и остаться на плаву последним.', rules: ['Каждый стартует на своём корабле у штурвала: Q — паруса, A/D — поворот', 'Z — залп левого борта, X — залп правого (перезарядка 1 с). Цельтесь бортом: ядра летят в стороны', 'Пустые корабли тоже можно топить, но очков за них нет. Корабли сталкиваться не могут. Корпус держит ≈17 попаданий, потопленный игрок выбывает', 'Время — 8 минут: потом побеждает самый целый корабль'] },
  explore: { icon: '🧭', name: 'Изучение', desc: 'Без целей и времени: просто гуляйте по архипелагу и общайтесь вдвоём. Телепорт и чат работают.',
    goal: 'Никаких целей — исследуйте острова и общайтесь.', rules: ['Все стартуют в одном месте и гуляют вместе', 'Enter — чат, N — карта с положением друга, T — телепорт по карте', 'Игра идёт, пока вы сами не закончите её в меню (M)'] },
};
const COL = { red: 0xe0453a, blue: 0x3a7be0 }, CSS = { red: '#ff6b6b', blue: '#6bb6ff' }, TEAM = { red: '🔴 Красные', blue: '🔵 Синие' };
const SWING = { attack: [0.22, 20, 7.5], kick: [0.2, 12, 6.5], bash: [0.25, 15, 6.5] };      // состояние → [когда в клипе бьём (с), урон, дальность]
const SEEKER_SPEED = 1.75;      // искатель в прятках быстрее остальных в 1.75 раза (между 1.5 и 2)
const PVP = new Set(['battle', 'capture', 'ctf', 'hide']);

export function startGame({ net, richard, world, scene, THREE, ships: SH }) {
  const P = richard.P, shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let G = { phase: 'idle' }, lastHurtT = -99, lastAtk = { id: 0, t: -99 }, reported = false, fired = true, prevT = 0, prevState = '', grabT = 0, wasSeeker = false, lastPhase = 'idle';
  const T = () => performance.now() / 1000;

  /* ───── данные мира для сервера: точки (острова/места) и места для реликвий (верхушки построек, вершины рельефа) ───── */
  function markIslands(spots) {              // острова = связные участки суши (сетка 20 м); spot.i — номер острова, spot.big — точка на самом большом
    const B = world.bounds, ST = 20, nx = Math.ceil((B.x1 - B.x0) / ST), nz = Math.ceil((B.z1 - B.z0) / ST), lab = new Int16Array(nx * nz).fill(-1), area = [];
    const land = (ix, iz) => world.heightAt(B.x0 + ix * ST, B.z0 + iz * ST) > -1;
    for (let s = 0; s < nx * nz; s++) {
      if (lab[s] !== -1 || !land(s % nx, (s / nx) | 0)) continue;
      const id = area.length; let n = 0; const st = [s]; lab[s] = id;
      while (st.length) { const c = st.pop(); n++; const cx = c % nx, cz = (c / nx) | 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nx || z >= nz) continue; const k = z * nx + x; if (lab[k] === -1 && land(x, z)) { lab[k] = id; st.push(k); } } }
      area.push(n);
    }
    const near = sp => { const cx = Math.round((sp.x - B.x0) / ST), cz = Math.round((sp.z - B.z0) / ST);
      for (let r = 0; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, z = cz + dz; if (x >= 0 && z >= 0 && x < nx && z < nz && lab[z * nx + x] >= 0) return lab[z * nx + x]; } return -1; };
    for (const sp of spots) sp.i = near(sp);
    let bigId = -1; for (let i = 0; i < area.length; i++) if (bigId < 0 || area[i] > area[bigId]) bigId = i;
    for (const sp of spots) sp.big = sp.i === bigId;
    console.log('[острова]', spots.map(s => `${s.n}: остров ${s.i}${s.big ? ' (большой)' : ''}`).join('; '));
  }
  function buildInfo() {
    const spots = Object.entries(world.spots).map(([n, s]) => ({ n, x: +s.x.toFixed(1), z: +s.z.toFixed(1), y: +Math.max(0, world.heightAt(s.x, s.z)).toFixed(1), yaw: s.yaw || 0 }));
    markIslands(spots);
    const cand = [], B = world.bounds;
    const boxes = (world.solidBoxes || []).filter(b => { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, gr = Math.max(0, world.heightAt(cx, cz)); return b.y1 - gr >= 8 && b.x1 - b.x0 >= 4 && b.z1 - b.z0 >= 4 && b.y1 < 500; });
    for (const b of shuffle(boxes).slice(0, 70)) cand.push([(b.x0 + b.x1) / 2, b.y1 + 1.6, (b.z0 + b.z1) / 2]);
    const pts = []; for (let x = B.x0; x < B.x1; x += 60) for (let z = B.z0; z < B.z1; z += 60) { const h = world.heightAt(x, z); if (h > 25) pts.push([x, h, z]); }
    pts.sort((a, b) => b[1] - a[1]); for (const p of shuffle(pts.slice(0, Math.max(40, Math.floor(pts.length * 0.25)))).slice(0, 70)) cand.push([p[0], p[1] + 1.6, p[2]]);
    if (cand.length < 10) for (const s of spots) cand.push([s.x + 6, s.y + 1.6, s.z + 6]);
    const shipsInfo = SH ? SH.list.map((v, k) => ({ k, x: +v.g.position.x.toFixed(1), z: +v.g.position.z.toFixed(1), yaw: +v.yaw.toFixed(3), L: +v.L.toFixed(1), W: +v.W.toFixed(1) })) : [];
    return { spots, ships: shipsInfo, relic: cand.map(c => c.map(v => +v.toFixed(1))) };
  }
  let lastInfo = null, lastWorldT = -99;
  try { lastInfo = buildInfo(); } catch (e) { console.error('buildInfo', e); try { lastInfo = { spots: Object.entries(world.spots).map(([n, s]) => ({ n, x: s.x, z: s.z, y: Math.max(0, world.heightAt(s.x, s.z)), yaw: s.yaw || 0 })), ships: [], relic: [] }; } catch (e2) { console.error(e2); } }
  if (lastInfo) net.sendWorld(lastInfo);

  /* ───── HUD ───── */
  const css = document.createElement('style');
  css.textContent = `
  #gHud{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:46;display:none;text-align:center;color:#fff;font:700 15px -apple-system,"Segoe UI",sans-serif;text-shadow:0 1px 3px #000;pointer-events:none}
  #gHud .bx{background:rgba(10,20,30,.7);border-radius:12px;padding:6px 14px;display:inline-block;min-width:200px}
  #gHud small{font-weight:400;opacity:.9;display:block}
  #gBan{position:fixed;top:13%;left:50%;transform:translate(-50%,-50%);z-index:47;background:rgba(10,20,30,.82);color:#fff;border-radius:16px;padding:16px 28px;font:800 26px -apple-system,sans-serif;text-align:center;display:none;pointer-events:none;max-width:90vw}
  #gFeed{position:fixed;top:10px;right:10px;z-index:46;display:flex;flex-direction:column;gap:3px;align-items:flex-end;pointer-events:none;font:13px -apple-system,sans-serif}
  #gFeed div{background:rgba(10,20,30,.62);color:#fff;border-radius:8px;padding:3px 9px}
  #gBlind{position:fixed;inset:0;background:#000;z-index:44;display:none;place-items:center;color:#fff;font:800 28px -apple-system,sans-serif;text-align:center}
  #gIntro{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:48;display:none;width:min(520px,92vw);background:rgba(10,20,30,.88);color:#fff;border-radius:18px;padding:18px 24px;font:15px/1.45 -apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6);pointer-events:none;text-align:left}
  #gIntro h2{margin:0 0 2px;font-size:28px;text-align:center;color:#ffd84a} #gIntro h3{margin:0 0 10px;font-size:19px;text-align:center}
  #gIntro b{color:#ffd84a} #gIntro ul{margin:4px 0 0;padding-left:20px} #gIntro .who{margin-top:10px;text-align:center;font-weight:700}
  #gDead{position:fixed;inset:0;z-index:43;display:none;place-items:center;background:rgba(120,0,0,.35);color:#fff;font:800 26px -apple-system,sans-serif;pointer-events:none;text-shadow:0 2px 6px #000}`;
  document.head.appendChild(css);
  const mk = (id, cls) => { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); return d; };
  const hud = mk('gHud'), ban = mk('gBan'), feed = mk('gFeed'), blind = mk('gBlind'), dead = mk('gDead'), intro = mk('gIntro');
  let introT = 0;
  function showIntro() {                       // «Игра началась»: режим, цель, правила и кто вы — одним окном
    const info = MODE_INFO[G.mode]; if (!info) return; const a = my(), tm = a && a[3], sk = a && a[6];
    const who = G.mode === 'hide' ? (sk ? '👀 Вы — ИСКАТЕЛЬ' : '🙈 Вы прячетесь') : tm ? 'Ваша команда: ' + TEAM[tm] : '';
    intro.innerHTML = `<h2>🎮 Игра началась!</h2><h3>${info.icon} ${info.name}</h3><div>🎯 <b>Цель:</b> ${info.goal}</div><div style="margin-top:8px">📜 <b>Правила:</b></div><ul>${info.rules.map(r => `<li>${r}</li>`).join('')}</ul>${who ? `<div class="who">${who}</div>` : ''}`;
    intro.style.display = 'block'; introT = 11;
  }
  let banT = 0;
  const banner = (text, sec = 5) => { ban.textContent = text; ban.style.display = 'block'; banT = sec; };
  const feedAdd = text => { const d = document.createElement('div'); d.textContent = text; feed.appendChild(d); while (feed.children.length > 6) feed.firstChild.remove(); setTimeout(() => d.remove(), 9000); };

  /* ───── 3D-объекты ───── */
  const root = new THREE.Group(); scene.add(root);
  const relicObjs = new Map(), pointObjs = [], baseObjs = {}, flagObjs = {}, carryOnRemote = new Map();
  const makeRelic = () => {      // маленькая и незаметная: ни луча, ни кольца — найти её можно, только подойдя близко (видна ближе 28 м)
    const g = new THREE.Group(), gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshStandardMaterial({ color: 0xffd84a, emissive: 0xb87800, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 }));
    gem.scale.y = 1.4; g.add(gem); g.userData = { gem }; g.visible = false; return g;
  };
  const makeFlag = (color, k = 1) => {
    const g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * k, 0.25 * k, 14 * k, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd })); pole.position.y = 7 * k;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(6 * k, 3.6 * k), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); cloth.position.set(3 * k, 12 * k, 0);
    g.add(pole, cloth); g.userData.cloth = cloth; return g;
  };
  const makeRing = (r, color) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - 1.2, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; };
  const born = o => { o.userData.born = T(); o.scale.setScalar(0.01); return o; };        // объекты не «выскакивают», а вырастают за секунду
  const disposeObj = o => { o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); o.removeFromParent(); };
  const carryLocal = makeFlag(0xffffff, 0.8); carryLocal.visible = false; scene.add(carryLocal);

  function clearWorldObjs() {
    for (const o of relicObjs.values()) disposeObj(o); relicObjs.clear();
    for (const o of pointObjs) disposeObj(o.g); pointObjs.length = 0;
    for (const k of Object.keys(baseObjs)) { disposeObj(baseObjs[k]); delete baseObjs[k]; }
    for (const k of Object.keys(flagObjs)) { disposeObj(flagObjs[k]); delete flagObjs[k]; }
    for (const o of carryOnRemote.values()) disposeObj(o.m); carryOnRemote.clear(); carryLocal.visible = false;
  }

  const my = () => (G.pl || []).find(a => a[0] === net.id);
  const meIn = () => G.phase === 'play' && !!my();
  const mySeeker = () => { const a = my(); return !!(a && a[6]); };
  const myTeam = () => { const a = my(); return a ? a[3] : null; };

  /* ───── морской бой ───── */
  let navalUsed = false, sendShipT = 0; const balls = new Map(), fx = [], reloadAt = { '-1': 0, '1': 0 };
  const fxRoot = new THREE.Group(); scene.add(fxRoot);
  const mat = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
  const ballGeo = new THREE.SphereGeometry(0.55, 10, 8), ballMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.5, metalness: 0.6 });
  function puff(x, y, z, color, s0, s1, dur) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(color, 0.85)); m.position.set(x, y, z); m.scale.setScalar(s0); fxRoot.add(m); fx.push({ m, t: 0, dur, s0, s1 }); }
  function bang(vol) { try { const AC = window.AudioContext || window.webkitAudioContext; const ac = bang.ac || (bang.ac = new AC()), n = ac.sampleRate * 0.5, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain(); f.type = 'lowpass'; f.frequency.value = 500; gn.gain.value = vol; s.buffer = buf; s.connect(f); f.connect(gn); gn.connect(ac.destination); s.start(); } catch { /* звук необязателен */ } }
  const distTo = (x, z) => Math.hypot(x - P.pos.x, z - P.pos.z), vol = (x, z) => Math.max(0.05, Math.min(0.9, 90 / (30 + distTo(x, z))));
  function applyNaval(m, prev) {
    navalUsed = true; for (const v of SH.list) v.hp = null; for (const [k, hp] of m.nv || []) if (SH.list[k]) SH.list[k].hp = hp; const owned = new Set(m.pl.map(a => a[8]));
    SH.list.forEach((v, k) => { v.frozen = !owned.has(k); });
    for (const a of m.pl) { const v = SH.list[a[8]]; if (v) { v.remote = a[0] !== net.id; v.hp = a[7]; } }
    const was = (prev.pl || []).find(a => a[0] === net.id), now = m.pl.find(a => a[0] === net.id);
    if (was && now && was[7] > 0 && now[7] <= 0) banner('⚓ Ваш корабль потоплен! Вы выбыли — плывите к берегу', 6);
  }
  const myShip = () => { const a = my(); return a && a[8] != null && SH ? SH.list[a[8]] : null; };
  net.on('ship', m => { if (!SH) return; const a = (G.pl || []).find(x => x[0] === m.id), v = a && SH.list[a[8]]; if (v) { v.tgt = { x: m.x, z: m.z, yaw: m.yaw }; v.sailsUp = !!m.su; } });
  net.on('shot', m => {
    const mesh = new THREE.Mesh(ballGeo, ballMat); mesh.position.set(m.x, m.y, m.z); fxRoot.add(mesh); balls.set(m.b, { m: mesh, vx: m.vx, vy: m.vy, vz: m.vz });
    puff(m.x, m.y + 0.3, m.z, 0xdddddd, 0.6, 3.2, 1.1); bang(vol(m.x, m.z) * 0.6);
  });
  net.on('boom', m => {
    const b = balls.get(m.b); if (b) { b.m.removeFromParent(); balls.delete(m.b); }
    if (m.h) { puff(m.x, m.y, m.z, 0xff8a1f, 0.8, 5.5, 0.7); puff(m.x, m.y + 1, m.z, 0x333333, 0.6, 6.5, 1.6); bang(vol(m.x, m.z)); }
    else { puff(m.x, 0.3, m.z, 0xbfe6ff, 0.5, 4.2, 0.8); }
  });
  addEventListener('keydown', e => {
    if (e.repeat || !meIn() || G.mode !== 'naval' || (e.code !== 'KeyZ' && e.code !== 'KeyX')) return;
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) return;
    const a = my(); if (!a || a[7] <= 0) return; const side = e.code === 'KeyZ' ? -1 : 1, t = T(); if (reloadAt[side] > t) return;
    reloadAt[side] = t + 1; net.send({ t: 'fire', side });
  });
  function navalUpdate(dt) {
    const t = T();
    for (const [id, b] of balls) { b.m.position.x += b.vx * dt; b.m.position.z += b.vz * dt; b.m.position.y += b.vy * dt; b.vy -= 30 * dt; if (b.m.position.y < -3) { b.m.removeFromParent(); balls.delete(id); } }
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; const u = f.t / f.dur; if (u >= 1) { f.m.removeFromParent(); f.m.material.dispose(); f.m.geometry.dispose(); fx.splice(i, 1); continue; } f.m.scale.setScalar(f.s0 + (f.s1 - f.s0) * Math.sqrt(u)); f.m.material.opacity = 0.85 * (1 - u); }
    if (!SH || !navalUsed) return;
    const k = 1 - Math.exp(-10 * dt), mine = myShip();
    for (const v of SH.list) {
      if (v.hp != null && v.hp <= 0 && (G.mode === 'naval')) { SH.sink(v, dt); if (v === mine && SH.riding() === v) SH.release(); continue; }
      if (v.remote && v.tgt) { const x = v.g.position.x + (v.tgt.x - v.g.position.x) * k, z = v.g.position.z + (v.tgt.z - v.g.position.z) * k, d = Math.atan2(Math.sin(v.tgt.yaw - v.yaw), Math.cos(v.tgt.yaw - v.yaw)); SH.setPose(v, x, z, v.yaw + d * k); }
    }
    if (G.phase === 'play' && mine && mine.hp > 0 && (sendShipT += dt) > 0.1) { sendShipT = 0; net.send({ t: 'ship', x: +mine.g.position.x.toFixed(2), z: +mine.g.position.z.toFixed(2), yaw: +mine.yaw.toFixed(3), su: mine.sailsUp ? 1 : 0 }); }
  }

  function applyGame(m) {
    const prev = G; G = m;
    if (m.world === false && lastInfo && T() - lastWorldT > 3) { lastWorldT = T(); net.sendWorld(lastInfo); }      // сервер не получил данные карты — шлём ещё раз
    if (m.phase !== lastPhase) {
      if (m.phase !== 'play') { clearWorldObjs(); net.hideLabels = false; net.setTeams({}); intro.style.display = 'none'; introT = 0; if (P.dead) richard.respawnAt(P.pos.x, P.pos.z, 0); }
      if (m.phase === 'play') { clearWorldObjs(); G = m; showIntro(); if (SH && m.mode === 'naval') SH.reset(); }
      lastPhase = m.phase;
    }
    if (m.phase !== 'play') renderHud();
    window.__gameLock = meIn() && m.mode !== 'explore';     // телепорт и облёт выключены в любом активном режиме, кроме «Изучения»
    if (m.phase === 'over') banner('🏆 ' + (m.winner || 'Конец игры'), 9);
    if (SH && (m.phase === 'play' || m.phase === 'over') && m.mode === 'naval') applyNaval(m, prev);
    if (m.phase === 'idle' && navalUsed) { navalUsed = false; SH.release(); SH.reset(); for (const b of balls.values()) disposeObj(b.m); balls.clear(); }
    if (m.phase !== 'play') return;
    net.hideLabels = m.mode === 'hide';
    if (m.mode === 'capture' || m.mode === 'ctf') { const map = {}; for (const a of m.pl) if (a[3]) map[a[0]] = CSS[a[3]]; net.setTeams(map); }
    // реликвии
    if (m.relics) {
      const ids = new Set(m.relics.map(r => r.id));
      for (const [id, o] of [...relicObjs]) if (!ids.has(id)) { disposeObj(o); relicObjs.delete(id); }
      for (const r of m.relics) if (!relicObjs.has(r.id)) { const o = makeRelic(); o.position.set(r.x, r.y, r.z); o.userData.rid = r.id; born(o); root.add(o); relicObjs.set(r.id, o); }
    }
    // базы и точки
    if (m.bases) for (const T_ of ['red', 'blue']) if (!baseObjs[T_]) { const b = m.bases[T_], g = new THREE.Group(); g.add(makeRing(10, COL[T_])); g.position.set(b.x, b.y + 1, b.z); born(g); root.add(g); baseObjs[T_] = g; }
    if (m.points) {
      if (!pointObjs.length) for (const q of m.points) { const g = new THREE.Group(), f = makeFlag(0xaaaaaa, 1.3), r = makeRing(30, 0xaaaaaa); g.add(f, r); g.position.set(q.x, q.y + 1, q.z); born(g); root.add(g); pointObjs.push({ g, f, r }); }
      m.points.forEach((q, i) => { const o = pointObjs[i]; if (!o) return; const c = q.o ? COL[q.o] : Math.abs(q.p) > 0.02 ? COL[q.p > 0 ? 'red' : 'blue'] : 0xaaaaaa; o.f.userData.cloth.material.color.setHex(c); o.r.material.color.setHex(c); o.f.userData.cloth.position.y = (q.o ? 12 : 3 + 9 * Math.abs(q.p)) * 1.3; });
    }
    // флаги CTF: на базе/на земле — обычный флаг; несомый — на плече у носителя
    if (m.flags) for (const f of m.flags) {
      let o = flagObjs[f.team]; if (!o) { o = born(makeFlag(COL[f.team], 1.1)); root.add(o); flagObjs[f.team] = o; }
      o.visible = f.st !== 'carried'; o.position.set(f.x, f.y + 0.5, f.z);
    }
    const carriers = new Map(); for (const a of m.pl) if (a[5]) carriers.set(a[0], a[5]);
    for (const [id, o] of [...carryOnRemote]) if (!carriers.has(id) || o.m.parent !== net.group(id)) { disposeObj(o.m); carryOnRemote.delete(id); }
    for (const [id, tm] of carriers) if (id !== net.id && !carryOnRemote.has(id)) { const g = net.group(id); if (g) { const f = makeFlag(COL[tm], 0.7); f.position.set(0, 9, -1.4); g.add(f); carryOnRemote.set(id, { m: f }); } }
    const mc = my() && my()[5]; carryLocal.visible = !!mc; if (mc) carryLocal.userData.cloth.material.color.setHex(COL[mc]);
    // события «я искатель»
    if (m.mode === 'hide' && mySeeker() && !wasSeeker && prev.phase === 'play' && prev.sub === 'seek') banner('👀 Вас нашли — теперь вы ищете остальных!', 4);
    wasSeeker = mySeeker();
    renderHud();
  }

  const fmt = s => s == null ? '' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  function renderHud() {
    if (G.phase !== 'play' && G.phase !== 'over' && net.online && (net.roster || []).filter(p => p.play).length >= 2 && (G.ver !== 4 || G.world === false)) {
      hud.innerHTML = `<div class="bx">⚠ Игра не может начаться<small>${G.ver !== 4 ? 'Сервер запущен старой версией — остановите его и снова выполните: node server.js' : 'Сервер ещё не получил данные карты — обновите страницу (Cmd+R)'}</small></div>`; hud.style.display = 'block'; return;
    }
    if (G.phase !== 'play' && G.phase !== 'over') {      // игры нет: если режим выбран, ждём второго игрока — пока все ходят свободно
      const am = G.armed && MODE_INFO[G.armed];
      if (G.cd != null && !am) { const dm = G.dm && MODE_INFO[G.dm]; hud.innerHTML = `<div class="bx">👥 Выбор режима: осталось ${G.cd} с<small>${dm ? 'Лидирует: ' + dm.icon + ' ' + dm.name : 'Голосуйте в меню (M)'} · при ничьей решает первый игрок</small></div>`; hud.style.display = 'block'; return; }
      if (am) { hud.innerHTML = `<div class="bx">${am.icon} ${am.name}<small>⏳ Ждём второго игрока — игра начнётся сама. Пока ходите где хотите</small></div>`; hud.style.display = 'block'; } else hud.style.display = 'none';
      return;
    }
    if (!G.mode) { hud.style.display = 'none'; return; }
    const info = MODE_INFO[G.mode], a = my(); let l1 = `${info.icon} ${info.name}`, l2 = '';
    if (G.left != null && G.phase === 'play') l1 += ` · ${fmt(G.left)}`;
    if (G.mode === 'battle') l2 = `Ваши победы: ${a ? a[1] : 0} / ${G.limit}` + topLine();
    else if (G.mode === 'relics') l2 = `Реликвии: ${a ? a[1] : 0} / ${G.limit} · ищите по всему миру` + topLine();
    else if (G.mode === 'capture') l2 = `🔴 ${G.sc.red} : ${G.sc.blue} 🔵 (до ${G.limit})` + (myTeam() ? ` · вы: ${TEAM[myTeam()]}` : '');
    else if (G.mode === 'ctf') l2 = `🔴 ${G.sc.red} : ${G.sc.blue} 🔵 (до ${G.limit})` + (myTeam() ? ` · вы: ${TEAM[myTeam()]}` : '') + (a && a[5] ? ' · 🚩 вы несёте флаг!' : '');
    else if (G.mode === 'explore') { const nm = new Map((net.roster || []).map(p => [p.id, p.name])); l2 = 'Гуляйте и общайтесь (Enter — чат, N — карта, T — телепорт) · рядом: ' + ((G.pl || []).filter(x => x[0] !== net.id).map(x => nm.get(x[0]) || x[0]).join(', ') || 'никого'); }
    else if (G.mode === 'naval') { const rl = s => { const w = Math.ceil(reloadAt[s] - T()); return w > 0 ? w + ' с' : '✔'; }, nm = new Map((net.roster || []).map(p => [p.id, p.name])); l2 = a && a[7] <= 0 ? '⚓ Ваш корабль потоплен — вы выбыли' : `⚓ Корпус ${a ? a[7] : 0}% · потоплено ${a ? a[2] : 0} · Z левый борт ${rl(-1)} · X правый ${rl(1)}`; l2 += ' · ' + (G.pl || []).filter(x => x[0] !== net.id).map(x => `${nm.get(x[0]) || x[0]}: ${x[7]}%`).join(' | '); }
    else if (G.mode === 'hide') l2 = mySeeker() ? (G.sub === 'hiding' ? `Вы искатель: ждите ${G.hideLeft} с` : 'Вы ищете — бейте прячущихся!') : (G.sub === 'hiding' ? `Прячьтесь! ${G.hideLeft} с` : 'Не попадитесь искателю!');
    hud.innerHTML = `<div class="bx">${l1}<small>${l2}</small></div>`; hud.style.display = 'block';
  }
  function topLine() { const n = new Map((net.roster || []).map(p => [p.id, p.name])); const top = [...(G.pl || [])].sort((x, y) => y[1] - x[1]).slice(0, 3).map(a => `${n.get(a[0]) || a[0]}: ${a[1]}`); return top.length > 1 ? ' · ' + top.join(' | ') : ''; }
  function nearestRelic() { let b = null; for (const r of G.relics || []) { const d = Math.hypot(r.x - P.pos.x, r.z - P.pos.z); if (!b || d < b.d) b = { d, r }; } return b; }

  /* ───── сообщения сервера ───── */
  net.on('game', applyGame);
  net.onChange(() => { if (G.phase !== 'play' && G.phase !== 'over') renderHud(); });      // состав игроков изменился — обновить подсказку/отсчёт
  net.on('ev', m => { if (m.big) banner(m.text, 5); feedAdd(m.text); });
  net.on('hurt', m => { lastAtk = { id: m.from, t: T() }; lastHurtT = T(); richard.hurt(m.dmg, m.x, m.y, m.z); });
  net.on('spawn', m => {
    richard.respawnAt(m.x, m.z, m.yaw || 0); reported = false;
    if (m.ship != null && SH && SH.list[m.ship]) { SH.release(); if (G.phase !== 'play') SH.reset(); SH.board(SH.list[m.ship]); }      // морской бой: каждый стартует у штурвала своего корабля
  });

  /* ───── каждый кадр ───── */
  const _f = new THREE.Vector3();
  function strike(reach, dmg) {      // кто перед нами в пределах reach — тому уходит hit (сервер проверит)
    const yaw = P.yawVis ?? P.yaw; _f.set(Math.sin(yaw), 0, Math.cos(yaw));
    for (const b of net.bodies()) {
      const dx = b.x - P.pos.x, dz = b.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.1 || d > reach || Math.abs(b.y - P.pos.y) > 12) continue;
      if ((dx * _f.x + dz * _f.z) / d < 0.3) continue;          // только перед собой (≈ ±70°)
      net.send({ t: 'hit', to: b.id, dmg });
    }
  }
  addEventListener('mountedswing', () => { if (meIn() && PVP.has(G.mode) && !P.dead) strike(11, 20); });      // удар с лошади (дальше: всадник выше и длиннее хват)
  function update(dt) {
    const t = T(), inG = meIn();
    window.__gameLock = inG && G.mode !== 'explore';
    for (const o of root.children) if (o.userData.born != null && o.scale.x < 1) o.scale.setScalar(Math.min(1, 0.01 + (t - o.userData.born) / 1.2));
    if (introT > 0 && (introT -= dt) <= 0) intro.style.display = 'none';
    if (banT > 0 && (banT -= dt) <= 0) ban.style.display = 'none';
    for (const [id, o] of relicObjs) { o.userData.gem.rotation.y += dt * 1.8; o.visible = Math.hypot(o.position.x - P.pos.x, o.position.z - P.pos.z) < 28 && Math.abs(o.position.y - P.pos.y) < 40; }
    for (const o of pointObjs) o.f.userData.cloth.rotation.y = Math.sin(t * 3) * 0.15;
    for (const f of Object.values(flagObjs)) f.userData.cloth.rotation.y = Math.sin(t * 3) * 0.15;
    carryLocal.position.set(P.pos.x, P.pos.y + 9.5, P.pos.z); carryLocal.rotation.y = P.yawVis ?? P.yaw;
    const blindNow = inG && G.mode === 'hide' && G.sub === 'hiding' && mySeeker();
    blind.style.display = blindNow ? 'grid' : 'none'; if (blindNow) { blind.textContent = `🙈 Вы искатель. Глаза закрыты: ${G.hideLeft} с`; richard.clearKeys(); }
    dead.style.display = inG && P.dead && PVP.has(G.mode) && G.mode !== 'hide' ? 'grid' : 'none'; if (dead.style.display === 'grid') dead.textContent = '☠ Вы погибли — возрождение…';
    P.speedMul = inG && G.mode === 'hide' && mySeeker() ? SEEKER_SPEED : 1;      // искатель бегает быстрее прячущихся
    navalUpdate(dt);
    if (!inG) return;
    if (!P.dead && P.hp < P.hpMax && t - lastHurtT > 5) P.hp = Math.min(P.hpMax, P.hp + 6 * dt);    // без боя здоровье медленно восстанавливается
    // гибель → серверу
    if (P.dead && !reported && PVP.has(G.mode) && G.mode !== 'hide') { reported = true; net.send({ t: 'died', by: t - lastAtk.t < 8 ? lastAtk.id : 0 }); }
    if (!P.dead) reported = false;
    if (P.dead && window.__riding) dispatchEvent(new CustomEvent('forcedismount'));      // погибший не остаётся в седле
    // удар: в нужный момент клипа проверяем, кто перед нами
    const sw = SWING[P.state];
    if (sw && PVP.has(G.mode) && !P.dead && !blindNow) {
      if (prevState !== P.state || P.t < prevT) fired = false;
      if (!fired && P.t >= sw[0]) { fired = true; strike(sw[2], sw[1]); }
    } else fired = true;
    prevState = P.state; prevT = P.t;
    // реликвии: подобрать, если рядом
    if (G.mode === 'relics' && !P.dead && t - grabT > 0.4) for (const r of G.relics || []) {
      if (Math.hypot(r.x - P.pos.x, r.z - P.pos.z) < 5 && Math.abs(r.y - P.pos.y) < 8) { grabT = t; net.send({ t: 'grab', id: r.id }); break; }
    }
    if (G.mode === 'naval' || G.mode === 'relics' || G.mode === 'hide' || G.mode === 'capture' || G.mode === 'ctf') { if ((G._hudT = (G._hudT || 0) + dt) > 0.25) { G._hudT = 0; renderHud(); } }
  }
  return { update, get active() { return meIn(); }, get state() { return G; } };
}
