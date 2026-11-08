// animals.js — заселяет карту животными (animals/*.html) и пускает их по маршрутам:
//  • наземные ходят по замкнутым маршрутам вокруг дома (с остановками: пасутся/клюют/стоят), по улицам города — туда-обратно;
//  • утки плавают по озеру; голуби, вороны, соколы летают кругами над городами, горами и лесами / вдоль морских путей.
// Модели создаются лениво (только рядом с камерой) и переиспользуются — иначе 100+ животных съели бы все draw-calls.
import { loadAnimal } from './animal-loader.js';

// len — желаемая длина тела в мировых единицах (персонаж 6.5), v — скорость шага, fly — скорость полёта
const SP = {
  horse: { len: 12, v: 9 }, palfrey: { len: 11.5, v: 9 }, 'draft-horse': { len: 14, v: 6 }, donkey: { len: 8, v: 6 },
  ox: { len: 13, v: 5 }, bull: { len: 13, v: 5 }, cow: { len: 12.5, v: 4.5 }, pig: { len: 7.5, v: 4 }, boar: { len: 7.5, v: 6 },
  sheep: { len: 6, v: 4 }, goat: { len: 5.5, v: 5 }, dog: { len: 4.5, v: 8 }, cat: { len: 2.8, v: 5 }, wolf: { len: 7, v: 9 },
  hen: { len: 1.8, v: 3 }, rooster: { len: 2.2, v: 3 }, goose: { len: 3.6, v: 3.5 }, duck: { len: 2.8, v: 3 },
  dove: { len: 2.8, v: 4, fly: 26 }, raven: { len: 4, v: 4, fly: 22 }, falcon: { len: 5.5, v: 4, fly: 30 },
};
const RIDE = new Set(['horse', 'palfrey', 'draft-horse', 'donkey']);      // сесть можно на любую
const CTRL = new Set(['palfrey']);                                      // управлять — только верховой лошадью (единственная с седлом в модели)
const ROLE = { idle: /idle|покой/i, walk: /^walk|шаг|ходьба/i, graze: /graze|peck|dabble|рытьё|рытьe|пасть|клю/i, fly: /^fly|^flap/i, glide: /glide/i };
const clipFor = (clips, role, i = 0) => clips.find(c => ROLE[role].test(c)) || clips[Math.min(i, clips.length - 1)];

export function createAnimals({ THREE, scene, world, base = './' }) {
  const rnd = (() => { let s = 777; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
  const S = world.S || 1, W = 1600, H = 1100, P2W = (x, y) => [(x - W / 2) * S, (y - H / 2) * S];
  const ctrls = [], pool = {}, queue = [];
  let building = false;
  const hAt = world.heightAt;
  const slope = (x, z) => Math.hypot(hAt(x + 2, z) - hAt(x - 2, z), hAt(x, z + 2) - hAt(x, z - 2)) / 4;
  const nearBld = (x, z, pad) => { for (const k of world.colliders) if ((k.x - x) ** 2 + (k.z - z) ** 2 < (k.r + pad) ** 2) return true; return false; };
  const okLand = (x, z) => { const h = hAt(x, z); return h > 0.7 && h < 14 && slope(x, z) < 0.55 && !nearBld(x, z, 3) && !(world.blockedAt && world.blockedAt(x, z, 2.5)) && !world.lakeAt(x, z); };
  const segOk = (a, b) => { for (let i = 1; i <= 6; i++) if (!okLand(a[0] + (b[0] - a[0]) * i / 6, a[1] + (b[1] - a[1]) * i / 6)) return false; return true; };

  /* ——— маршруты ——— */
  function loopRoute(cx, cz, r, tries = 30) {     // замкнутый маршрут по 4–6 точкам вокруг дома
    for (let attempt = 0; attempt < tries; attempt++) {
      const n = 4 + Math.floor(rnd() * 3), a0 = rnd() * 6.28, pts = [];
      for (let i = 0; i < n; i++) { const a = a0 + i / n * 6.283 + (rnd() - 0.5) * 0.5, d = r * (0.45 + rnd() * 0.55); pts.push([cx + Math.cos(a) * d, cz + Math.sin(a) * d]); }
      if (pts.every(p => okLand(p[0], p[1])) && pts.every((p, i) => segOk(p, pts[(i + 1) % n]))) return pts;
    }
    return null;
  }
  const streets = world.ops.lines.filter(l => l.k === 'street' || l.k === 'road').map(l => l.pts.map(p => P2W(p[0], p[1])));
  function pathRoute(cx, cz, maxD = 90) {          // ping-pong по ближайшей улице; вода и постройки отбрасываются (берём самый длинный сухой участок)
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
  const isWater = (x, z) => world.lakeAt(x, z) && hAt(x, z) < -1.5;
  const lakeRoute = (cx, cz, rx, rz) => {       // только настоящая вода озера; точки по кругу, соседние соединены водой
    const pts = [];
    for (let t = 0; t < 300 && pts.length < 6; t++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * 1.2, x = cx + Math.cos(a) * rx * d, z = cz + Math.sin(a) * rz * d; if (isWater(x, z)) pts.push([x, z, Math.atan2(z - cz, x - cx)]); }
    pts.sort((p, q) => p[2] - q[2]);
    const ok = pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; for (let k = 1; k < 8; k++) if (!isWater(p[0] + (q[0] - p[0]) * k / 8, p[1] + (q[1] - p[1]) * k / 8)) return false; return true; });
    return ok.length >= 3 ? ok.map(p => [p[0], p[1]]) : null;
  };

  /* ——— заселение ——— */
  const add = (sp, mode, o) => {
    if (rnd() < ((mode === 'loop' || mode === 'path') ? 0.75 : 0.5)) return;
    const c = { sp, mode, x: 0, z: 0, yaw: rnd() * 6.28, inst: null, wi: 0, state: 'rest', timer: rnd() * 4, t: rnd() * 100, v: SP[sp].v * (0.85 + rnd() * 0.3), dir: 1, ...o };
    if (mode === 'path') { c.laneAbs = 2.5 + rnd() * 1.5; c.laneCur = c.laneTarget = c.dir * c.laneAbs; }      // полоса: идущие вперёд и назад ходят по разным сторонам улицы (±2.5..4)
    ctrls.push(c);
  };
  const walkers = (sp, n, cx, cz, r, opt = {}) => {
    r *= S; if (opt.street) opt = { ...opt, street: opt.street * S };
    for (let i = 0; i < n; i++) {
      const hx = cx + (rnd() - 0.5) * r * 0.7, hz = cz + (rnd() - 0.5) * r * 0.7;
      // каскад запасных маршрутов: улица → круг → круг побольше с большим числом попыток → улица в большом радиусе → маленький круг у суши
      let mode = 'path', route = opt.street ? pathRoute(hx, hz, opt.street) : null;
      if (!route) { mode = 'loop'; route = loopRoute(hx, hz, r) || loopRoute(hx, hz, r * 1.8, 80); }
      if (!route) { mode = 'path'; route = pathRoute(hx, hz, 260 * S); }
      if (!route) { mode = 'loop'; route = ringRoute(hx, hz); }
      if (!route) continue;                       // суши вокруг нет вовсе
      const start = route[Math.floor(rnd() * route.length)];
      add(sp, mode, { route, acts: route.map(() => rnd() < 0.7 ? (opt.rest || 'graze') : 'idle'), x: start[0], z: start[1], wi: 0, restRole: opt.rest || 'graze', restMin: opt.restMin ?? 2, restMax: opt.restMax ?? 8 });
    }
  };
  const fliers = (sp, n, cx, cz, r, alt, o = {}) => { r *= S; for (let i = 0; i < n; i++) add(sp, 'orbit', { cx: cx + (rnd() - 0.5) * 20, cz: cz + (rnd() - 0.5) * 20, r: r * (0.7 + rnd() * 0.6), a: rnd() * 6.28, alt: alt + (rnd() - 0.5) * 14, dir: rnd() < 0.5 ? 1 : -1, ph: rnd() * 6, ...o }); };
  const swimmers = (sp, n, cx, cz, rx, rz) => { rx *= S; rz *= S; for (let i = 0; i < n; i++) { const route = lakeRoute(cx, cz, rx, rz); if (!route) continue; add(sp, 'swim', { route, x: route[0][0], z: route[0][1], restRole: 'graze', restMin: 1, restMax: 4, v: 2.4 }); } };
  const P = (x, y) => P2W(x, y);

  // фермы: каждая ферма — своё стадо
  const farms = world.places.filter(p => p.t === 'farm'), mixes = [['cow', 3], ['sheep', 5], ['ox', 2], ['goat', 4], ['pig', 3]];
  farms.forEach((f, i) => {
    const [a, b] = [mixes[i % mixes.length], mixes[(i + 2) % mixes.length]];
    walkers(a[0], a[1], f.x, f.z, 26); walkers(b[0], b[1], f.x, f.z, 30);
    walkers('hen', 3, f.x, f.z, 14, { rest: 'graze', restMax: 5 }); if (i % 2 === 0) walkers('rooster', 1, f.x, f.z, 14);
    if (i % 3 === 0) walkers('dog', 1, f.x, f.z, 30, { rest: 'idle' });
  });
  places('windmill').forEach(p => { walkers('donkey', 2, p.x, p.z, 30); walkers('draft-horse', 1, p.x, p.z, 34); });
  function places(t) { return world.places.filter(p => p.t === t); }
  // луга главного острова
  [[940, 390], [1000, 380], [905, 420]].forEach(([x, y]) => { const [wx, wz] = P(x, y); walkers('horse', 3, wx, wz, 45); walkers('palfrey', 1, wx, wz, 45); walkers('sheep', 4, wx, wz, 40); });
  // озеро: утки плавают, гуси ходят по берегу
  { const [lx, lz] = P(1045, 482); swimmers('duck', 5, lx, lz, 52, 28); walkers('goose', 3, lx - 40, lz + 36, 24, { rest: 'idle' }); walkers('duck', 2, lx + 40, lz + 34, 20); walkers('hen', 3, lx, lz - 70, 30); }
  // север: волки, козы, вороны, соколы
  { const [fx, fz] = P(850, 240); walkers('wolf', 3, fx, fz, 70, { rest: 'idle', restMax: 12 }); const [gx, gz] = P(820, 330); walkers('goat', 5, gx, gz, 45); const [mx, mz] = P(800, 260); fliers('falcon', 2, mx, mz, 110, 90, {}); fliers('raven', 4, fx, fz, 80, 55); }
  // джунгли юга: кабаны, голуби над кронами, лошади на опушке
  { const [jx, jz] = P(880, 620); walkers('boar', 5, jx, jz, 80, { restMin: 3, restMax: 9 }); fliers('dove', 4, jx, jz, 120, 60); const [hx, hz] = P(700, 690); walkers('horse', 2, hx, hz, 40); }
  // королевский город: собаки и кошки по улицам, куры у рынка, лошади у дворца, голуби над собором
  { const [kx, kz] = P(255, 392); walkers('dog', 4, kx, kz, 80, { street: 60, rest: 'idle', restMax: 6 }); walkers('cat', 5, kx, kz, 80, { street: 60, rest: 'idle', restMax: 10 });
    walkers('hen', 4, kx, kz + 28, 24); walkers('rooster', 1, kx + 8, kz + 30, 20); walkers('donkey', 2, kx, kz, 60, { street: 50, rest: 'graze', restMax: 8 });
    const [cx, cz] = P(312, 352); walkers('palfrey', 2, cx, cz + 30, 40); walkers('horse', 1, cx, cz + 30, 30);
    const [px, pz] = P(349, 417); walkers('draft-horse', 2, px - 30, pz, 25, { rest: 'idle', restMax: 12 });
    const [sx, sz] = P(252, 344); fliers('dove', 6, sx, sz, 45, 48); }
  // рыбацкая деревня
  { const [rx, rz] = P(1075, 665); walkers('cat', 2, rx, rz, 40, { rest: 'idle' }); walkers('dog', 2, rx, rz, 50, { rest: 'idle' }); walkers('goose', 3, rx, rz - 20, 28, { rest: 'idle' }); walkers('duck', 2, rx - 10, rz + 20, 24); walkers('hen', 3, rx, rz, 24); fliers('dove', 3, rx + 80, rz, 80, 40); }
  // пиратский остров
  { const [px, pz] = P(368, 842); fliers('raven', 5, px, pz, 90, 50); walkers('boar', 2, px, pz + 30, 36); walkers('cat', 2, px, pz + 20, 40, { rest: 'idle' }); walkers('dog', 1, px, pz + 20, 40, { rest: 'idle' }); }
  // остров ниндзей
  { const [nx, nz] = P(1230, 200); fliers('falcon', 2, nx, nz, 60, 55); fliers('dove', 3, nx, nz, 50, 40); walkers('cat', 2, nx, nz + 20, 36, { rest: 'idle' }); }
  // Губа смерти
  { const [gx, gz] = P(1385, 600); fliers('raven', 5, gx, gz, 100, 60); fliers('falcon', 1, gx, gz, 130, 100); walkers('wolf', 3, gx - 10, gz + 100, 70, { rest: 'idle', restMax: 14 }); walkers('wolf', 2, gx, gz - 150, 60, { rest: 'idle' }); }
  // морские пути: голуби-«чайки» летят вдоль маршрутов туда-обратно
  for (const l of world.ops.lines.filter(l => l.k === 'route')) { const pts = l.pts.map(p => P2W(p[0], p[1])); for (let i = 0; i < 2; i++) add('dove', 'route', { route: pts, x: pts[0][0], z: pts[0][1], alt: 30 + rnd() * 20, wi: 0, ph: rnd() * 6, prog: rnd() * pts.length }); }

  /* ——— жизненный цикл моделей ——— */
  async function build(c) {
    let it = (pool[c.sp] ||= []).pop();
    if (!it) { try { it = await loadAnimal(new URL(`animals/${c.sp}.html`, new URL(base, location.href)).href); } catch (e) { console.warn('животное', c.sp, e.message); c.failed = true; return; } it.sp = c.sp; it.holder = it.root; }
    c.inst = it; const k = SP[c.sp].len / it.length; it.root.scale.setScalar(k); it.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = true; } });
    scene.add(it.root); c.clip = null; applyClip(c, c.state === 'walk' ? 'walk' : 'idle');
  }
  function release(c) { const it = c.inst; scene.remove(it.root); (pool[it.sp] ||= []).push(it); c.inst = null; }
  function applyClip(c, role) {
    if (!c.inst || c.clip === role) return; c.clip = role; const cl = c.inst.clips;
    const name = role === 'walk' ? clipFor(cl, 'walk', 1) : role === 'graze' ? clipFor(cl, 'graze', 2) : role === 'fly' ? (c.sp === 'falcon' ? (c.glide ? clipFor(cl, 'glide', 3) : clipFor(cl, 'fly', 2)) : clipFor(cl, 'fly', 2)) : clipFor(cl, 'idle', 0);
    c.inst.setClip(name);
  }
  const turn = (yaw, want, rate) => { let d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)); const m = Math.max(-rate, Math.min(rate, d)); return { yaw: yaw + m, diff: d }; };

  // ближайшая свободная точка рядом (спираль до 36 ед.): застрявшее животное выходит из препятствия, а не «респавнится» на маршрут
  const freeSpot = (x, z) => { const ok = (px, pz) => !(world.blockedAt && world.blockedAt(px, pz, 1.2)) && hAt(px, pz) >= 0.6 && !world.lakeAt(px, pz); if (ok(x, z)) return null; for (let r = 3; r <= 36; r += 3) for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (ok(px, pz)) return [px, pz]; } return null; };
  function stepWalker(c, dt, swim) {
    const ox = c.x, oz = c.z, ph = world.tod ? world.tod.phase : 'day';
    if (ph !== 'day' && !c.ridden) {                   // вечер/ночь: идут «домой» (к началу своего маршрута) и там спят — стоят в покое
      if (c.homeX === undefined) { c.homeX = c.route[0][0] + (rnd() - 0.5) * 60; c.homeZ = c.route[0][1] + (rnd() - 0.5) * 60; }      // дом — не одна точка, а площадка: иначе на ночь все стада сбиваются в кучу
      const dx = c.homeX - c.x, dz = c.homeZ - c.z, d = Math.hypot(dx, dz);
      if (swim || d < 4) { c.state = 'rest'; c.restClip = 'idle'; c.timer = 2; }
      else {
        c.state = 'walk'; const { yaw, diff } = turn(c.yaw, Math.atan2(dx, dz), 2.2 * dt); c.yaw = yaw;
        const sp = c.v * 1.15 * Math.max(0.15, 1 - Math.abs(diff) / 1.2) * dt; c.x += Math.sin(c.yaw) * Math.min(sp, d); c.z += Math.cos(c.yaw) * Math.min(sp, d);
      }
    } else if (c.state === 'rest') {
      c.timer -= dt; if (c.timer <= 0) c.state = 'walk';
    } else {
      const tgt = c.route[c.wi];
      let tx = tgt[0], tz = tgt[1];
      if (c.mode === 'path' && c.laneAbs && c.route.length > 1) {      // разъезд по полосам: боковой сдвиг перпендикулярно сегменту маршрута, плавная смена стороны при развороте
        c.laneTarget = c.dir * c.laneAbs; c.laneCur += (c.laneTarget - c.laneCur) * Math.min(1, dt * 2);
        const k = Math.min(c.wi, c.route.length - 2), p0 = c.route[k], p1 = c.route[k + 1], sx = p1[0] - p0[0], sz = p1[1] - p0[1], sl = Math.hypot(sx, sz);
        if (sl > 1e-6) { tx += (-sz / sl) * c.laneCur; tz += (sx / sl) * c.laneCur; }
      }
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
      const { yaw, diff } = turn(c.yaw, Math.atan2(dx, dz), 2.2 * dt); c.yaw = yaw;
      const sp = c.v * Math.max(0.15, 1 - Math.abs(diff) / 1.2) * dt;
      c.x += Math.sin(c.yaw) * Math.min(sp, d + 1); c.z += Math.cos(c.yaw) * Math.min(sp, d + 1);
      if (d < 3.5) { const reached = c.wi;      // действие привязано к точке маршрута
        if (c.mode === 'path') { let n = c.wi + c.dir; if (n < 0 || n >= c.route.length) { c.dir *= -1; n = c.wi + c.dir; } c.wi = n; }
        else c.wi = (c.wi + 1) % c.route.length;
        if (rnd() < 0.55) { c.state = 'rest'; c.timer = c.restMin + rnd() * (c.restMax - c.restMin); c.restClip = c.acts ? c.acts[reached] : (rnd() < 0.65 ? c.restRole : 'idle'); }
      }
    }
    if (!swim && ((world.blockedAt && world.blockedAt(c.x, c.z, 0.8)) || hAt(c.x, c.z) < 0.5 || world.lakeAt(c.x, c.z))) { c.x = ox; c.z = oz; c.wi = (c.wi + 1) % c.route.length; c.state = 'rest'; c.timer = 1; c.stuck = (c.stuck || 0) + 1; if (c.stuck >= 2) { c.stuck = 0; if (freeSpot) { const f = freeSpot(c.x, c.z); if (f) { c.x = f[0]; c.z = f[1]; } } } } else c.stuck = 0;      // застряла: выходит на ближайшую свободную точку и берёт следующую точку маршрута; на маршрут больше не «респавнится» (ни с всадником, ни без)   // не лезем сквозь здания, деревья и камни; застряли — на свободную точку маршрута
    c.y = swim ? -0.5 + Math.sin(c.t * 1.6) * 0.06 : Math.max(0, hAt(c.x, c.z)) - 0.05;
    c.pitch = 0;
  }
  function stepFlier(c, dt) {
    if (c.mode === 'orbit') {
      const v = SP[c.sp].fly, w = v / c.r * c.dir; c.a += w * dt;
      const nx = c.cx + Math.cos(c.a) * c.r, nz = c.cz + Math.sin(c.a) * c.r;
      c.yaw = Math.atan2(nx - c.x, nz - c.z); if (!c.init) { c.init = true; } c.x = nx; c.z = nz;
      c.y = Math.max(hAt(nx, nz) + 18, c.alt + Math.sin(c.t * 0.5 + c.ph) * 5); c.roll = -c.dir * 0.45;
      c.glide = c.sp === 'falcon' && Math.sin(c.t * 0.3 + c.ph) > -0.3;
    } else {                                    // route: летим вдоль ломаной туда-обратно
      const v = SP[c.sp].fly, pts = c.route; let tgt = pts[Math.min(pts.length - 1, Math.max(0, Math.floor(c.prog)))];
      const nxt = pts[Math.min(pts.length - 1, Math.max(0, Math.floor(c.prog) + (c.dir > 0 ? 1 : 0)))] || tgt;
      const dx = nxt[0] - c.x, dz = nxt[1] - c.z, d = Math.hypot(dx, dz);
      const r = turn(c.yaw, Math.atan2(dx, dz), 1.5 * dt); c.yaw = r.yaw; c.roll = Math.max(-0.5, Math.min(0.5, -r.diff * 0.8));
      c.x += Math.sin(c.yaw) * v * dt; c.z += Math.cos(c.yaw) * v * dt; c.y = c.alt + Math.sin(c.t * 0.7 + c.ph) * 4;
      if (d < 12) { c.prog += c.dir; if (c.prog >= pts.length - 1 || c.prog < 0) { c.dir *= -1; c.prog = Math.max(0, Math.min(pts.length - 1, c.prog)); } }
    }
  }

  // стартовые позиции облётчиков (чтобы не «телепортироваться» из нуля)
  for (const c of ctrls) if (c.mode === 'orbit') { c.x = c.cx + Math.cos(c.a) * c.r; c.z = c.cz + Math.sin(c.a) * c.r; } else if (c.mode === 'route') { c.dir = 1; c.prog = c.prog % c.route.length; const p = c.route[Math.floor(c.prog)]; c.x = p[0]; c.z = p[1]; c.yaw = 0; }

  let frame = 0, view = null; const fm = new THREE.Matrix4(), sph = new THREE.Sphere(), pt = new THREE.Vector3();
  return {
    count: ctrls.length,
    info() { return ctrls.map(c => ({ sp: c.sp, mode: c.mode, route: c.route || null, orbit: c.mode === 'orbit' ? { cx: c.cx, cz: c.cz, r: c.r } : null, x: c.x, z: c.z, state: c.state, ridden: !!c.ridden })); },
    nearRideable(x, z, maxD) { let best = null, bd = maxD * maxD; for (const c of ctrls) if (c.inst && !c.ridden && RIDE.has(c.sp)) { const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < bd) { bd = d; best = c; } } return best; },
    mount(c) { c.ridden = true; c.rv = 0; c.jy = 0; c.jv = 0; c.state = 'rest'; },
    jump(c) { if ((c.jy || 0) < 0.05 && !(c.jv > 0)) { c.jv = 21; c.jy = 0.06; } },
    controllable(c) { return CTRL.has(c.sp); },
    dismount(c) {          // слезли: лошадь получает новый маршрут вокруг того места, где стоит (старый мог остаться далеко — раньше она «телепортировалась» к нему)
      c.ridden = false; c.rv = 0; c.jy = 0; c.jv = 0; c.pitch = 0; c.stuck = 0;
      const r = loopRoute(c.x, c.z, 30 * S, 60) || ringRoute(c.x, c.z); if (r) { c.route = r; c.mode = 'loop'; c.wi = 0; c.acts = r.map(() => 'graze'); }
      c.state = 'rest'; c.timer = 3;
    },
    seat(c) { return { x: c.x, y: c.y + SP[c.sp].len * 0.58, z: c.z, yaw: c.yaw }; },      // седло ≈ 0.58 длины тела над землёй (холка лошади ~1.45 м при длине ~2.4 м)
    rideStep(c, fwd, turn, run, dt) {          // управление верхом: W/S вперёд-назад, A/D поворот, Shift — галоп
      c.rv += ((fwd < 0 ? -5 : fwd * (run ? 34 : 18)) - c.rv) * Math.min(1, dt * 2.5);
      c.yaw += turn * 2.0 * dt * Math.min(1, 0.3 + Math.abs(c.rv) / 10);
      const nx = c.x + Math.sin(c.yaw) * c.rv * dt, nz = c.z + Math.cos(c.yaw) * c.rv * dt, B = world.bounds;
      const bad = (x, z) => hAt(x, z) <= 0.4 || x <= B.x0 || x >= B.x1 || z <= B.z0 || z >= B.z1, hit = (x, z) => world.blockedAt && world.blockedAt(x, z, 1.2), inside = hit(c.x, c.z);
      // если стоим вплотную к препятствию (или внутри его зоны) — не застреваем: выход разрешён, а вдоль препятствия скользим по одной оси
      if (!bad(nx, nz) && (inside || !hit(nx, nz))) { c.x = nx; c.z = nz; } else if (!bad(nx, c.z) && (inside || !hit(nx, c.z))) c.x = nx; else if (!bad(c.x, nz) && (inside || !hit(c.x, nz))) c.z = nz; else c.rv *= 0.2;
      if ((c.jy || 0) > 0 || c.jv > 0) { c.jv -= 48 * dt; c.jy = Math.max(0, (c.jy || 0) + c.jv * dt); if (c.jy === 0) c.jv = 0; }      // прыжок: дуга ~4.5 ед., нос вверх на взлёте и вниз на посадке
      c.pitch = c.jy > 0 ? -c.jv * 0.02 : 0;
      c.y = Math.max(0, hAt(c.x, c.z)) - 0.05 + (c.jy || 0); c.state = Math.abs(c.rv) > 0.8 || c.jy > 0 ? 'walk' : 'rest'; c.restClip = 'idle';
    },
    bodies() { const o = []; for (const c of ctrls) if (c.inst && c.mode !== 'orbit' && c.mode !== 'route') o.push({ x: c.x, z: c.z, y: c.y, r: Math.max(0.8, SP[c.sp].len * 0.32) }); return o; },
    update(t, dt, cam, camera) {
      const inView = c => view && view.intersectsSphere(sph.set(pt.set(c.x, (c.y || 0) + 3, c.z), 9));      // животные появляются и исчезают только вне поля зрения камеры
      if (camera) { fm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); view = view || new THREE.Frustum(); view.setFromProjectionMatrix(fm); }
      dt = Math.min(dt, 0.1); frame++;
      let want = null, wd = 1e9; const loaded = [];
      const night = world.tod && world.tod.phase === 'night';
      for (const c of ctrls) {
        c.t += dt; c.px = c.x; c.pz = c.z;
        if ((c.mode === 'orbit' || c.mode === 'route') && night) { if (c.inst) release(c); continue; }      // птицы ночью спят: не летают и не показываются
        if (c.mode === 'orbit' || c.mode === 'route') stepFlier(c, dt); else if (!c.ridden || !CTRL.has(c.sp)) stepWalker(c, dt, c.mode === 'swim');      // без седла лошадь идёт сама, всадник просто сидит
        const dx = c.x - cam.x, dz = c.z - cam.z, d = Math.hypot(dx, dz), big = SP[c.sp].len > 6 || SP[c.sp].fly;
        const loadR = (big ? 300 : 190) + (c.mode === 'orbit' ? 80 : 0), unloadR = loadR + 60;
        if (!c.inst) { if (!c.failed && d < loadR && d < wd && !inView(c)) { want = c; wd = d; } continue; }
        if (d > unloadR && !c.ridden && !inView(c)) { release(c); continue; }
        const it = c.inst, flying = c.mode === 'orbit' || c.mode === 'route';
        applyClip(c, flying ? 'fly' : c.mode === 'swim' && c.state === 'walk' ? 'idle' : c.state === 'walk' ? 'walk' : (c.restClip === 'graze' ? 'graze' : 'idle'));
        it.root.position.set(c.x, c.y, c.z); it.root.rotation.set(flying ? 0 : (c.pitch || 0), c.yaw, flying ? (c.roll || 0) : 0, 'YXZ');
        if (d < 110 || (frame & 1) === 0 || inView(c)) it.tick(t * 1000);      // далёкие и невидимые — анимация через кадр (время абсолютное, скачков нет)
        if (!flying) loaded.push(c);
      }
      for (const c of loaded) {          // морда всегда смотрит туда, куда животное реально движется (расталкивание, откат от препятствий и скольжение раньше давали «хождение боком»)
        if (c.ridden || c.state !== 'walk') continue; const mx = c.x - c.px, mz = c.z - c.pz;
        if (Math.hypot(mx, mz) > 0.03) { const want = Math.atan2(mx, mz); if (Math.abs(Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw))) > 0.5) c.yaw = turn(c.yaw, want, 8 * dt).yaw; }
      }
      for (let i = 0; i < loaded.length; i++) for (let j = i + 1; j < loaded.length; j++) {       // животные не проходят друг сквозь друга
        const a = loaded[i], b = loaded[j], m = SP[a.sp].len * 0.32 + SP[b.sp].len * 0.32, dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        // встреча лицом к лицу: оба идут навстречу друг другу и касаются — второй останавливается на 1.5 с, первый проходит
        if (d2 < m * m && d2 > 1e-6 && !a.ridden && !b.ridden && a.mode !== 'swim' && b.mode !== 'swim' && a.state === 'walk' && b.state === 'walk') {
          const avx = a.x - a.px, avz = a.z - a.pz, bvx = b.x - b.px, bvz = b.z - b.pz;
          if (Math.hypot(avx, avz) > 0.01 && Math.hypot(bvx, bvz) > 0.01 && avx * bvx + avz * bvz < 0 && avx * dx + avz * dz > 0 && bvx * dx + bvz * dz < 0) { b.state = 'rest'; b.timer = 1.5; b.restClip = 'idle'; }
        }
        if (d2 < 1e-6) { b.x += 0.3; b.z += 0.2; }
        if (d2 < (0.85 * m) * (0.85 * m) && d2 > 1e-6) { const d = Math.sqrt(d2), k = (m - d) / d * 0.3, ax = a.x - dx * k, az = a.z - dz * k, bx = b.x + dx * k, bz = b.z + dz * k; if (!world.blockedAt || (a.mode === 'swim' || !world.blockedAt(ax, az, 0.5))) { a.x = ax; a.z = az; } if (!world.blockedAt || (b.mode === 'swim' || !world.blockedAt(bx, bz, 0.5))) { b.x = bx; b.z = bz; } }
      }
      if (want && !building) { building = true; build(want).finally(() => { building = false; }); }
    },
  };
}
