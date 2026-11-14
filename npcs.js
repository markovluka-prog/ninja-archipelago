// npcs.js — жители острова (npc/npc.js: 15 видов) ходят по улицам и тропам, останавливаются, работают и болтают.
// Это просто декорации-люди: у них нет здоровья и коллизий с ударами, поэтому убить их нельзя.
// npc/npc.js только импортируется (не изменяется): правки модели жителей подхватываются автоматически.
import * as THREE from 'three';

// реплики по ролям (облачко над головой)
const PHRASES = {
  merchant: ['Свежий товар!', 'Покупайте, недорого!', 'Лучшие цены в городе!', 'Что желаете?'],
  kid: ['Поиграем?', 'Смотри, что я нашёл!', 'Догони меня!'],
  healer: ['Нужна помощь?', 'Береги руки, путник.', 'Травы от любой хвори!'],
  noble: ['Какой чудесный день.', 'Не мешайте, мне некогда.'],
  monk: ['Мир тебе, путник.', 'Тишина — лучший учитель.'],
  carpenter: ['Доски, доски, доски!', 'Крепкий дом — крепкий дух.'],
  harbor_guard: ['Стой, кто идёт?', 'Порядок в порту!', 'Проходите, не задерживайтесь.'],
  smith: ['Железо горячее!', 'Клинок будет крепкий!', 'Раздуй мехи!'],
  sailor: ['Попутного ветра!', 'Море зовёт!', 'Качка сегодня сильная.'],
  fisher: ['Свежая рыба!', 'Клёв сегодня хороший!', 'Какой улов!'],
  innkeeper: ['Добро пожаловать!', 'Ужин готов!', 'Комната свободна.'],
  farmer: ['Урожай будет славный!', 'Коровы сыты.', 'Жарко сегодня.'],
  samurai_guard: ['Стой! Назови имя.', 'Служу государю.'],
  pirate: ['Йо-хо-хо!', 'Золото где-то здесь!', 'Эй, приятель!'],
  ninja_sentinel: ['Тсс… тише.', 'Тень видит всё.', 'Мы следим за островом.'],
};
const DEFAULT_PHRASES = ['Добрый день!', 'Хорошая погода.'];
const SCALE = 3.9;          // 1 «метр» NPC → 3.9 ед. мира (рост ≈ 7; Ричард ≈ 9)

export async function createNPCs({ scene, world, base = './' }) {
  const mod = await import(new URL('npc/npc.js', new URL(base, location.href)).href);
  const DEF = Object.fromEntries(mod.NPC_LIST.map(d => [d.id, d]));
  const rnd = (() => { let s = 4242; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const S = world.S || 1, W = 1600, H = 1100, P = (x, y) => [(x - W / 2) * S, (y - H / 2) * S];
  const hAt = world.heightAt;
  const slope = (x, z) => Math.hypot(hAt(x + 2, z) - hAt(x - 2, z), hAt(x, z + 2) - hAt(x, z - 2)) / 4;
  const nearBld = (x, z, pad) => { for (const k of world.colliders) if ((k.x - x) ** 2 + (k.z - z) ** 2 < (k.r + pad) ** 2) return true; return false; };
  const okLand = (x, z) => { const h = hAt(x, z); return h > 0.7 && h < 10 && slope(x, z) < 0.45 && !nearBld(x, z, 4) && !(world.blockedAt && world.blockedAt(x, z, 3)) && !world.lakeAt(x, z); };
  const segOk = (a, b) => { for (let i = 1; i <= 6; i++) if (!okLand(a[0] + (b[0] - a[0]) * i / 6, a[1] + (b[1] - a[1]) * i / 6)) return false; return true; };
  const streets = world.ops.lines.filter(l => l.k === 'street' || l.k === 'road').map(l => l.pts.map(p => P(p[0], p[1])));

  function loopRoute(cx, cz, r, tries = 40) {
    for (let a = 0; a < tries; a++) {
      const n = 4 + Math.floor(rnd() * 3), a0 = rnd() * 6.28, pts = [];
      for (let i = 0; i < n; i++) { const ang = a0 + i / n * 6.283 + (rnd() - 0.5) * 0.5, d = r * (0.5 + rnd() * 0.5); pts.push([cx + Math.cos(ang) * d, cz + Math.sin(ang) * d]); }
      if (pts.every(p => okLand(p[0], p[1])) && pts.every((p, i) => segOk(p, pts[(i + 1) % n]))) return pts;
    }
    return null;
  }
  function pathRoute(cx, cz, maxD) {              // вода и постройки отбрасываются (берём самый длинный сухой участок улицы)
    const cand = streets.map(s => [Math.min(...s.map(p => (p[0] - cx) ** 2 + (p[1] - cz) ** 2)), s]).filter(c => c[0] < maxD * maxD).sort((a, b) => a[0] - b[0]);
    for (const [, s] of cand) {
      let run = [], best = [];
      for (const p of s) {
        const q = [p[0] + (rnd() - 0.5) * 3, p[1] + (rnd() - 0.5) * 3];
        if (okLand(q[0], q[1])) { run.push(q); if (run.length > best.length) best = run; } else run = [];
      }
      if (best.length > 1) {                       // у каждого свой короткий участок улицы и свой сдвиг — иначе все идут одним «караваном»
        const len = Math.min(best.length, 2 + Math.floor(rnd() * 3)), s0 = Math.floor(rnd() * (best.length - len + 1)), ox = (rnd() - 0.5) * 10, oz = (rnd() - 0.5) * 10;
        const w = best.slice(s0, s0 + len).map(q => [q[0] + ox, q[1] + oz]).filter(q => okLand(q[0], q[1]));
        return w.length > 1 ? w : best.slice(s0, s0 + len);
      }
    }
    return null;
  }
  function ringRoute(cx, cz) {                    // запасной: маленький кольцевой маршрут вокруг ближайшей точки суши
    let L = null;
    for (let rad = 0; rad <= 320 && !L; rad += 6)
      for (let k = 0; k < (rad ? 16 : 1) && !L; k++) { const a = k / 16 * 6.283, x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad; if (okLand(x, z)) L = [x, z]; }
    if (!L) return null;
    for (const rr of [8, 5, 3]) { const pts = loopRoute(L[0], L[1], rr, 40); if (pts) return pts; }
    return [L];
  }

  const crowd = [];
  function add(id, cx, cz, r, o = {}) {
    if (!DEF[id] || rnd() < 0.5) return;      // жителей вдвое меньше
    r *= S; if (o.street) o = { ...o, street: o.street * S };
    const hx = cx + (rnd() - 0.5) * r * 0.5, hz = cz + (rnd() - 0.5) * r * 0.5;
    // каскад: улица → круг → круг побольше с большим числом попыток → улица в большом радиусе → маленький круг у суши
    let path = o.street ? pathRoute(hx, hz, o.street) : null, route = path || loopRoute(hx, hz, r) || loopRoute(hx, hz, r * 1.8, 80);
    if (!route) { path = pathRoute(hx, hz, 260 * S); route = path; }  // в плотной застройке — по ближайшей улице
    if (!route) route = ringRoute(hx, hz);
    if (!route) return;                           // суши вокруг нет вовсе
    const st = route[Math.floor(rnd() * route.length)];
    // действие на каждой точке маршрута: работа (по доле work роли), разговор или покой — детерминированно по rnd
    const acts = route.map(() => rnd() < (o.work ?? 0.6) ? 'work' : rnd() < 0.5 ? 'talk' : 'idle');
    crowd.push({ id, route, acts, stuck: 0, mode: path ? 'path' : 'loop', wi: 0, dir: 1, x: st[0], z: st[1], yaw: rnd() * 6.28, state: 'rest', timer: rnd() * 5, clip: 'idle', v: (o.v || 5) * (0.85 + rnd() * 0.3), work: o.work ?? 0.6, npc: null, t: 0, speakT: rnd() * 8, bubble: null });
  }
  // жители с заданным маршрутом (не режутся и не блуждают): фермеры работают на своих полях зигзагом по рядам
  function addFixed(id, route, o = {}) {
    if (!DEF[id]) return; const st = route[0];
    crowd.push({ id, route, acts: route.map(() => 'work'), stuck: 0, mode: 'loop', wi: 0, dir: 1, x: st[0], z: st[1], yaw: rnd() * 6.28, state: 'rest', timer: rnd() * 3, clip: 'idle', v: (o.v || 4.5) * (0.9 + rnd() * 0.2), work: 1, npc: null, t: 0, speakT: rnd() * 8, bubble: null });
  }
  const at = (px, py) => P(px, py);

  // королевский город
  { const [kx, kz] = at(255, 392), [mx, mz] = at(255, 424), [px, pz] = at(340, 400), [cx, cz] = at(312, 352);
    for (const id of ['merchant', 'merchant', 'kid', 'kid', 'healer', 'noble', 'monk', 'carpenter']) add(id, kx, kz, 80, { street: 60 });
    add('merchant', mx, mz, 24, { work: 0.9 }); add('innkeeper', ...at(232, 440), 14, { work: 0.9 }); add('noble', cx, cz + 30, 40); add('noble', cx - 20, cz + 40, 30);
    add('harbor_guard', px, pz - 30, 40, { work: 0.3 }); add('harbor_guard', px, pz + 40, 40, { work: 0.3 }); add('smith', px - 12, pz + 6, 22, { work: 0.95 });
    add('sailor', ...at(372, 374), 24); add('sailor', ...at(376, 452), 24); add('fisher', ...at(370, 380), 22); add('carpenter', ...at(336, 444), 24, { work: 0.9 }); }
  // деревня у озера и фермы
  { const [lx, lz] = at(1045, 440);
    for (const id of ['farmer', 'farmer', 'merchant', 'kid', 'healer', 'carpenter']) add(id, lx, lz, 60);
    add('innkeeper', ...at(1075, 430), 18, { work: 0.9 }); add('fisher', ...at(1045, 525), 36, { work: 0.9 }); add('monk', ...at(1068, 425), 24, { work: 0.9 });
    for (const f of world.places.filter(p => p.t === 'farm')) add('farmer', f.x, f.z, 22, { work: 0.9 }); }
  // рыбацкая деревня
  { const [rx, rz] = at(1075, 665);
    add('fisher', rx + 30, rz, 30, { work: 0.9 }); add('fisher', rx + 40, rz + 14, 26, { work: 0.9 }); add('sailor', rx, rz, 40); add('kid', rx, rz, 36); add('merchant', rx - 10, rz, 28); add('healer', rx - 20, rz + 10, 28); }
  // горная крепость и джунгли
  add('samurai_guard', ...at(800, 335), 24, { work: 0.85 }); add('samurai_guard', ...at(812, 335), 24, { work: 0.85 }); add('harbor_guard', ...at(870, 600), 60, { work: 0.3 });
  // пиратский остров
  { const [px, pz] = at(368, 860); for (let i = 0; i < 4; i++) add('pirate', px, pz, 44, { work: 0.8 }); add('sailor', px, pz + 10, 40); }
  // остров ниндзей
  { const [nx, nz] = at(1230, 205); add('ninja_sentinel', nx, nz, 40, { work: 0.9 }); add('ninja_sentinel', nx + 10, nz + 10, 40, { work: 0.9 }); add('samurai_guard', nx + 25, nz + 10, 24, { work: 0.9 }); add('monk', nx - 10, nz + 20, 28, { work: 0.9 }); }

  for (const f of world.fields || []) {         // на каждом поле — свой фермер
    const x0 = f.cx - f.hw + 6, x1 = f.cx + f.hw - 6, z0 = f.cz - f.hd + 5, z1 = f.cz + f.hd - 5, zm = (z0 + z1) / 2;
    addFixed('farmer', [[x0, z0], [x1, z0], [x1, zm], [x0, zm], [x0, z1], [x1, z1]]);
  }
  // «свой дом»: ближайший дом с дверью (≤ 60 ед. от начала маршрута); к нему житель иногда заходит, работает/отдыхает внутри и выходит
  // дом по профессии: ищем ближайший дом нужного типа (id модели) в радиусе R; если такого нет — ближайший любой в радиусе 60
  const HOME = {
    fisher: [/^fish_/, 260], sailor: [/^(fish_|pirate_|town_)/, 200], harbor_guard: [/^(warehouse|town_|hut_stone)/, 200], smith: [/^(warehouse|town_|hut_stone)/, 120],
    carpenter: [/^(warehouse|town_|hut_)/, 150], merchant: [/^(town_shop|town_|tavern|hut_)/, 150], innkeeper: [/^(tavern|inn)/, 120], healer: [/^(hut_|jp_tea|fish_)/, 200],
    noble: [/^(fortress|town_mansard|town_balcony|town_corner|big_hall|manor)/, 220], monk: [/^(church|jp_dojo|jp_tea)/, 500], farmer: [/^farm/, 140],
    kid: [/^(hut_|town_|fish_|farm)/, 120], samurai_guard: [/^(citadel|fortress|jp_)/, 300], ninja_sentinel: [/^jp_/, 200], pirate: [/^pirate_/, 200],
  };
  for (const c of crowd) {
    if (!world.houses) break;
    const [re, R] = HOME[c.id] || [/./, 60]; let best = null, bd = (R * S) ** 2;
    for (const h of world.houses) { if (!re.test(h.id)) continue; const d = (h.dx - c.x) ** 2 + (h.dz - c.z) ** 2; if (d < bd) { bd = d; best = h; } }
    if (!best) { bd = (60 * S) ** 2; for (const h of world.houses) { const d = (h.dx - c.x) ** 2 + (h.dz - c.z) ** 2; if (d < bd) { bd = d; best = h; } } }
    c.home = best;
  }

  /* ——— жизненный цикл ——— */
  const pool = {}; let frame = 0, view = null; const fm = new THREE.Matrix4(), sph = new THREE.Sphere(), pt = new THREE.Vector3();
  function acquire(c) {
    const it = (pool[c.id] ||= []).pop() || { n: mod.makeNPC(DEF[c.id]) };
    c.npc = it; it.n.root.scale.setScalar(SCALE); it.n.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(it.n.root); c.clip = null; return it;
  }
  function release(c) { c.hurt = null; c.hits = 0; const it = c.npc; if (it.n.station) it.n.station.visible = false; scene.remove(it.n.root); pool[c.id].push(it); c.npc = null; hideBubble(c); }
  // облачко-реплика: один спрайт на NPC, создаётся лениво, висит ~3.5 с
  function bubbleTex(text) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(4, 4, 504, 88, 26); g.fill();
    g.beginPath(); g.moveTo(240, 88); g.lineTo(256, 124); g.lineTo(272, 88); g.closePath(); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 46, 480);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function say(c, text) {
    const lines = PHRASES[c.id] || DEFAULT_PHRASES;
    if (!c.bubble) { c.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); c.bubble.scale.set(30, 7.5, 1); }
    const m = c.bubble.material; m.map?.dispose(); m.map = bubbleTex(text || lines[Math.floor(rnd() * lines.length)]); m.needsUpdate = true;
    c.bubble.timer = 3.5; c.bubble.visible = true; if (!c.bubble.parent) scene.add(c.bubble);
  }
  function hideBubble(c) { if (c.bubble) { c.bubble.visible = false; c.bubble.timer = 0; scene.remove(c.bubble); } }
  const turn = (yaw, want, rate) => { const d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)); return { yaw: yaw + Math.max(-rate, Math.min(rate, d)), diff: d }; };
  function setClip(c, name) {
    if (c.clip === name || !c.npc) return; c.clip = name; c.npc.n.setClip(name);
    c.stWant = name === 'work' ? 1 : 0;      // котёл/наковальня/ящик и т. п. не «выскакивают» мгновенно, а плавно вырастают (см. stationTick)
  }
  function stationTick(c, dt) {
    const st = c.npc && c.npc.n.station; if (!st) return;
    if (st.userData.s0 === undefined) { st.userData.s0 = st.scale.x; c.stK = c.stWant ? 1 : 0; }
    const w = c.stWant || 0; c.stK = (c.stK ?? 0) + (w - (c.stK ?? 0)) * Math.min(1, dt * (w ? 3 : 6));
    if (c.stK < 0.02 && !w) { st.visible = false; return; }
    st.visible = true; st.scale.setScalar(st.userData.s0 * Math.max(0.02, c.stK));
  }

  function hurtNpc(c, px, pz, fall) {
    const now = performance.now() / 1000; c.hits = now - (c.lastHit || -99) > 6 ? 1 : (c.hits || 0) + 1; c.lastHit = now;
    if (fall || c.hits >= 3) { c.hits = 0; c.hurt = { kind: 'fall', t: 0, dur: 3.1 }; say(c, 'Ай!'); }
    else { c.hurt = { kind: 'flinch', t: 0, dur: 0.5 }; if (rnd() < 0.5) say(c, 'Ой!'); }
    c.yaw = Math.atan2(px - c.x, pz - c.z);      // оборачивается к обидчику
  }
  return {
    count: crowd.length,
    info() { return crowd.map(c => ({ id: c.id, name: DEF[c.id].name, role: DEF[c.id].role, icon: DEF[c.id].icon, work: DEF[c.id].workLabel, route: c.route, acts: c.acts, mode: c.mode, x: c.x, z: c.z, home: c.home ? { x: c.home.dx, z: c.home.dz } : null, inside: !!c.visit, state: c.state, rest: c.rest })); },
    bodies() { const o = []; for (const c of crowd) if (c.npc) o.push({ x: c.x, z: c.z, y: hAt(c.x, c.z), r: 1.4 }); return o; },
    hit(px, pz, yaw, reach) {                        // удар игрока: два вздрагивания, на третий — падение (потом встаёт и идёт дальше); здоровья нет
      const fx = Math.sin(yaw), fz = Math.cos(yaw); let n = 0;
      for (const c of crowd) {
        if (!c.npc || c.hurt && c.hurt.kind === 'fall') continue;
        const dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz); if (d > reach + 1.4 || d < 0.05 || (dx * fx + dz * fz) / d < 0.3) continue;
        n++; hurtNpc(c, px, pz, false);
      }
      return n;
    },
    hitAt(x, z, r, fall) {                           // заклинание: всех жителей в радиусе вздрагивает (fall — сбивает с ног сразу); здоровья нет, как и при ударе
      let n = 0; for (const c of crowd) { if (!c.npc || c.hurt && c.hurt.kind === 'fall') continue; if (Math.hypot(c.x - x, c.z - z) > r) continue; n++; hurtNpc(c, x, z, !!fall); } return n;
    },
    update(dt, cam, camera) {
      if (camera) { fm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); view = view || new THREE.Frustum(); view.setFromProjectionMatrix(fm); }
      const inView = c => view && view.intersectsSphere(sph.set(pt.set(c.x, hAt(c.x, c.z) + 3, c.z), 8));      // жители появляются и исчезают только вне поля зрения камеры
      dt = Math.min(dt, 0.1); frame++;
      let built = 0;
      for (const c of crowd) {
        c.t += dt;
        const homeTime = world.tod && world.tod.phase !== 'day';        // вечер и ночь: все идут домой и спят (днём — работа и обычные маршруты)
        if (homeTime && c.home && !c.visit) c.visit = { h: c.home, stage: 'toOut', t: Infinity, sleep: true };
        else if (homeTime && c.visit && !c.visit.sleep) { c.visit.sleep = true; c.visit.t = Infinity; }
        else if (!homeTime && c.visit && c.visit.sleep) { c.visit.sleep = false; c.visit.t = 0; }          // утро: просыпаются, выходят и идут на работу
        if (c.hurt && Math.hypot(c.x - cam.x, c.z - cam.z) > 230) { c.hurt = null; c.hits = 0; }      // игрок далеко — ушиб забыт
        if (c.hurt) {                                    // по жителю ударили: стоит на месте, пока длится вздрагивание/падение/вставание (здоровья у него нет)
          c.hurt.t += dt; c.state = 'rest'; c.rest = 'idle';
          if (c.hurt.t >= c.hurt.dur) c.hurt = null;
        } else if (c.visit) {                            // заходит в дом: к двери → открывает → внутрь → дела → наружу → закрывает
          const v = c.visit, h = v.h, [nx, nz] = h.n, out = [h.dx + nx * 4, h.dz + nz * 4], inn = [(h.bx0 + h.bx1) / 2, (h.bz0 + h.bz1) / 2];
          const door = w => { if (h.doorObj) h.doorObj.want = w; };
          if (v.stage === 'stay') { v.t -= dt; c.state = 'rest'; c.rest = 'work'; if (v.t <= 0) { v.stage = 'out'; door(1); } }
          else {
            const tg = v.stage === 'toOut' || v.stage === 'out' ? out : inn, dx = tg[0] - c.x, dz = tg[1] - c.z, d = Math.hypot(dx, dz);
            c.state = 'walk'; c.yaw = turn(c.yaw, Math.atan2(dx, dz), 6 * dt).yaw;
            const sp = Math.min(c.v * (v.sleep ? 1.7 : 1) * dt, d), nx_ = c.x + dx / (d || 1) * sp, nz_ = c.z + dz / (d || 1) * sp;
            const nearH = nx_ > h.bx0 - 7 && nx_ < h.bx1 + 7 && nz_ > h.bz0 - 7 && nz_ < h.bz1 + 7;      // у своего дома можно подходить вплотную, везде больше — стены и здания не пересекаем
            if (!nearH && world.blockedAt && world.blockedAt(nx_, nz_, 1.2)) { v.blk = (v.blk || 0) + dt; c.state = 'rest'; c.rest = 'idle'; if (v.blk > 1.2) { c.visit = null; c.timer = 2; } }
            else { v.blk = 0; c.x = nx_; c.z = nz_; }
            if (d < 0.8) {
              if (v.stage === 'toOut') { door(1); v.stage = 'in'; }
              else if (v.stage === 'in') { v.stage = 'stay'; door(0); }
              else { door(0); c.visit = null; c.state = 'rest'; c.timer = 1.5; c.rest = 'idle'; }
            }
          }
        } else if (homeTime && !c.home) { c.state = 'rest'; c.rest = 'idle'; c.timer = 2;      // без дома — ночью просто стоит на месте
        } else if (c.state === 'rest') { c.timer -= dt; if (c.timer <= 0) c.state = 'walk'; }
        else {
          const tg = c.route[c.wi], dx = tg[0] - c.x, dz = tg[1] - c.z, d = Math.hypot(dx, dz);
          const ox = c.x, oz = c.z;
          const r = turn(c.yaw, Math.atan2(dx, dz), 3 * dt); c.yaw = r.yaw;
          const sp = c.v * Math.max(0.1, 1 - Math.abs(r.diff) / 1.1) * dt; c.x += Math.sin(c.yaw) * Math.min(sp, d + 1); c.z += Math.cos(c.yaw) * Math.min(sp, d + 1);
          if ((world.blockedAt && world.blockedAt(c.x, c.z, 1.2)) || hAt(c.x, c.z) < 0.6 || world.lakeAt(c.x, c.z)) {   // не в здания, деревья и воду: шаг отменяем, берём следующую точку
            c.x = ox; c.z = oz; c.wi = c.mode === 'path' ? (c.wi + c.dir >= 0 && c.wi + c.dir < c.route.length ? c.wi + c.dir : (c.dir *= -1, c.wi + c.dir)) : (c.wi + 1) % c.route.length; c.state = 'rest'; c.timer = 1.5; c.rest = 'idle';
            if (++c.stuck >= 2) { c.stuck = 0; const q = c.route[c.wi]; if (Math.hypot(q[0] - c.x, q[1] - c.z) < 30 && !(world.blockedAt && world.blockedAt(q[0], q[1], 1.2))) { c.x = q[0]; c.z = q[1]; } }      // на точку маршрута — только рядом и по свободной земле (раньше «перепрыгивали» через стену)      // застрял у препятствия — переходим на ближайшую свободную точку маршрута
          } else if (c.stuck = 0, d < 3) { const reached = c.wi;
            if (c.mode === 'path') { let n = c.wi + c.dir; if (n < 0 || n >= c.route.length) { c.dir *= -1; n = c.wi + c.dir; } c.wi = n; } else c.wi = (c.wi + 1) % c.route.length;
            if (rnd() < 0.6) { c.state = 'rest'; c.timer = 4 + rnd() * 9; c.rest = c.acts[reached]; }
            if (c.home && rnd() < 0.3 && Math.hypot(c.x - c.home.dx, c.z - c.home.dz) < 60 * S) c.visit = { h: c.home, stage: 'toOut', t: 10 + rnd() * 20 };
          }
        }
        if (c.visit && c.visit.stage === 'stay' && c.visit.sleep) { if (c.npc) release(c); continue; }      // спит дома — не показываем
        const dd = Math.hypot(c.x - cam.x, c.z - cam.z);
        if (!c.npc) { if (dd < 170 && built < 1 && frame % 2 === 0 && !inView(c)) { acquire(c); built++; } else continue; }
        if (dd > 230 && !inView(c)) { release(c); continue; }
        const root = c.npc.n.root;
        const vh = c.visit && c.x > c.visit.h.bx0 && c.x < c.visit.h.bx1 && c.z > c.visit.h.bz0 && c.z < c.visit.h.bz1 ? c.visit.h.gy : Math.max(0, hAt(c.x, c.z));
        root.position.set(c.x, vh, c.z); root.rotation.set(0, c.yaw, 0, 'YXZ');
        if (c.hurt) {                                    // вздрагивание: короткий наклон назад и дрожь; падение: на спину, лежит, поднимается
          const h = c.hurt, k = Math.min(1, h.t / h.dur); let tilt = 0, roll = 0;
          if (h.kind === 'flinch') { tilt = -0.32 * Math.sin(Math.PI * Math.min(1, k * 1.3)); roll = Math.sin(h.t * 45) * 0.09 * (1 - k); }
          else { const d1 = 0.3, d2 = 1.5, u = h.t < d1 ? h.t / d1 : h.t < d1 + d2 ? 1 : 1 - (h.t - d1 - d2) / (h.dur - d1 - d2); const e = u * u * (3 - 2 * u); tilt = -1.52 * e; roll = h.t < d1 ? Math.sin(h.t * 30) * 0.1 : 0; root.position.y += Math.sin(-tilt) * 0.7; }
          root.rotation.x = tilt; root.rotation.z = roll;
        }
        setClip(c, c.state === 'walk' ? 'walk' : (c.rest || 'idle'));
        stationTick(c, dt);
        // реплики: раз в 6–14 с, если игрок/камера рядом (<25) или NPC болтает
        c.speakT -= dt;
        if (c.speakT <= 0) { c.speakT = 6 + rnd() * 8; if (!homeTime && (Math.hypot(c.x - cam.x, c.z - cam.z) < 25 || (c.state === 'rest' && c.rest === 'talk'))) say(c); }
        if (c.bubble && c.bubble.visible) { c.bubble.timer -= dt; if (c.bubble.timer <= 0) hideBubble(c); else c.bubble.position.set(c.x, Math.max(0, hAt(c.x, c.z)) + 9, c.z); }
        c.ad = (c.ad || 0) + dt; if (dd < 90 || (frame & 1) === 0 || inView(c)) { c.npc.n.update(c.ad); c.ad = 0; }      // далёкие и невидимые — анимация через кадр с накопленным временем
      }
    },
  };
}
