// magic.js — магия Древнего языка + «алхимическая» физика стихий (по мотивам Magician: перевод, грамматика и реакции веществ).
// Y — окно заклинаний. Пишешь фразу на древнем языке («brisingr», «adurna galba») или по-русски («огонь», «лёд и ветер») — переводчик (ancient.js) разбирает слова,
// грамматика влияет на силу: прилагательное «большой/малый/сильный» меняет размер, множественное число даёт веер из трёх снарядов, прошедшее время — заклинание не работает.
// Стихии взаимодействуют по-настоящему: вода тушит пожар и мочит землю (там не загорится), огонь + вода = пар, ветер раздувает пожар по ветру, лёд на воде — мост, камень — стена с коллизией.
// Заклинание тратит запас сил (регенерирует). Чужие заклинания видны всем по сети (сообщение 'spell'), урон по игрокам считает кастер, сервер проверяет.
import { parseSpell, translate, SPELL_WORDS } from './ancient.js';

const COL = { fire: [1, .5, .15], water: [.3, .65, 1], wind: [.85, 1, .95], ice: [.7, .92, 1], bolt: [.82, .86, 1], light: [1, .93, .6], stone: [.72, .64, .5], heal: [.5, 1, .6], shield: [.4, .8, 1], lev: [.8, .7, 1], dispel: [.95, .95, 1], steam: [.9, .92, .95] };
const COST = { fire: 14, water: 12, ice: 16, bolt: 26, wind: 10, stone: 22, heal: 20, shield: 18, lev: 14, light: 6, dispel: 10 };
const ORDER = ['bolt', 'fire', 'ice', 'water', 'stone', 'wind', 'heal', 'shield', 'lev', 'light', 'dispel'];
const NAME = { fire: '🔥 огонь', water: '💧 вода', ice: '❄ лёд', bolt: '⚡ молния', wind: '🌬 ветер', stone: '🪨 камень', heal: '💚 исцеление', shield: '🛡 щит', lev: '🕊 полёт', light: '✨ свет', dispel: '🌀 рассеять' };
const MAXMANA = 100;

export function createMagic({ THREE, scene, world, richard, net, camera, renderer, npcs, dragons }) {
  const V = THREE.Vector3, P = richard.P, hAt = (x, z) => world.heightAt(x, z), rnd = (a, b) => a + Math.random() * (b - a);
  const isWater = (x, z) => hAt(x, z) < 0.3;
  const _a = new V(), _b = new V();
  let mana = MAXMANA, cd = 0;

  /* ───── частицы (общий пул, аддитивные) ───── */
  const N = 1500, pp = new Float32Array(N * 3), ps = new Float32Array(N), pc = new Float32Array(N * 4);
  const q = { x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), vz: new Float32Array(N), g: new Float32Array(N), dr: new Float32Array(N), age: new Float32Array(N).fill(9), life: new Float32Array(N).fill(1), s0: new Float32Array(N), s1: new Float32Array(N), r: new Float32Array(N), gg: new Float32Array(N), b: new Float32Array(N), a: new Float32Array(N) };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pp, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aSize', new THREE.BufferAttribute(ps, 1).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('aCol', new THREE.BufferAttribute(pc, 4).setUsage(THREE.DynamicDrawUsage));
  const uScale = { value: 600 };
  const pmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale },
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nattribute float aSize; attribute vec4 aCol; uniform float uScale; varying vec4 vC; void main(){ vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=max(1.0,aSize*uScale/max(1.0,-mv.z)); gl_Position=projectionMatrix*mv;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: '#include <common>\n#include <logdepthbuf_pars_fragment>\nvarying vec4 vC; void main(){\n#include <logdepthbuf_fragment>\n float r=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,r); gl_FragColor=vec4(vC.rgb, vC.a*a); }' });
  const pts = new THREE.Points(geo, pmat); pts.frustumCulled = false; pts.renderOrder = 31; scene.add(pts);
  let cur = 0;
  function spawn(x, y, z, vx, vy, vz, c, s0, s1, life, a = 0.8, grav = 0, drag = 1) {
    const i = cur; cur = (cur + 1) % N;
    q.x[i] = x; q.y[i] = y; q.z[i] = z; q.vx[i] = vx; q.vy[i] = vy; q.vz[i] = vz; q.g[i] = grav; q.dr[i] = drag; q.age[i] = 0; q.life[i] = life; q.s0[i] = s0; q.s1[i] = s1; q.r[i] = c[0]; q.gg[i] = c[1]; q.b[i] = c[2]; q.a[i] = a;
  }
  function puff(p, c, n, o = {}) {      // облако: n частиц разлетаются сферой
    const { spd = 8, s0 = 1, s1 = 3, life = 0.8, grav = 0, up = 0, a = 0.8, drag = 1.5 } = o;
    for (let k = 0; k < n; k++) { const th = Math.random() * 6.283, ph = Math.acos(rnd(-1, 1)), sp = spd * rnd(0.3, 1); spawn(p.x, p.y, p.z, Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp + up, Math.sin(ph) * Math.sin(th) * sp, c, s0 * rnd(.7, 1.3), s1 * rnd(.7, 1.3), life * rnd(.7, 1.3), a, grav, drag); }
  }
  function partTick(dt) {
    for (let i = 0; i < N; i++) {
      if (q.age[i] >= q.life[i]) { ps[i] = 0; pc[i * 4 + 3] = 0; pp[i * 3 + 1] = -9999; continue; }
      q.age[i] += dt; const k = q.age[i] / q.life[i], f = Math.max(0, 1 - q.dr[i] * dt);
      q.vx[i] *= f; q.vz[i] *= f; q.vy[i] = q.vy[i] * f - q.g[i] * dt; q.x[i] += q.vx[i] * dt; q.y[i] += q.vy[i] * dt; q.z[i] += q.vz[i] * dt;
      pp[i * 3] = q.x[i]; pp[i * 3 + 1] = q.y[i]; pp[i * 3 + 2] = q.z[i]; ps[i] = q.s0[i] + (q.s1[i] - q.s0[i]) * Math.sqrt(k);
      pc[i * 4] = q.r[i]; pc[i * 4 + 1] = q.gg[i]; pc[i * 4 + 2] = q.b[i]; pc[i * 4 + 3] = q.a[i] * (1 - k) * Math.min(1, k * 8 + 0.2);
    }
    geo.attributes.position.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aCol.needsUpdate = true;
    if (renderer && camera) uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  }
  // два заранее созданных источника света (добавлять свет на лету нельзя — перекомпиляция шейдеров, фриз)
  const flashL = new THREE.PointLight(0xffffff, 0, 160, 1.3), orbL = new THREE.PointLight(0xfff0b0, 0, 140, 1.2); scene.add(flashL, orbL);
  let flashT = 0, flashI = 0;
  const flash = (c, i) => { flashL.color.setRGB(c[0], c[1], c[2]); flashI = i; flashT = 1; };

  /* ───── недолговечные вещи (кольца, кристаллы, стены, щит): mesh + срок + обновление ───── */
  const things = [];
  const add = (obj, life, upd, end) => { scene.add(obj); things.push({ obj, t: 0, life, upd, end }); };
  const gSph = new THREE.SphereGeometry(1, 16, 12), gCone = new THREE.ConeGeometry(0.9, 5, 5), gBox = new THREE.BoxGeometry(1, 1, 1);
  const mkMat = (c, o = 0.5, additive = true) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), transparent: true, opacity: o, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  function ring(p, c, R, dur) {      // расширяющаяся ударная волна
    const m = new THREE.Mesh(gSph, mkMat(c, 0.45)); m.position.copy(p); m.scale.setScalar(0.5); m.renderOrder = 30;
    add(m, dur, (th, k) => { m.scale.setScalar(0.5 + R * (1 - (1 - k) ** 2)); m.material.opacity = 0.45 * (1 - k) ** 1.5; });
  }
  const steam = (p, R) => { puff(p, COL.steam, Math.min(60, 20 + R * 3), { spd: R * 0.9, s0: 3, s1: 9, life: 1.8, up: 5, grav: -2.5, a: 0.5, drag: 1.2 }); };

  /* ───── мир: попадание луча/снаряда ───── */
  const walls = [];      // мои каменные стены и ледяные настилы (для столкновений снарядов)
  function solidAt(x, y, z) {
    for (const b of world.solidBoxes || []) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1) return true;
    for (const b of walls) if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z && y > b.min.y && y < b.max.y) return true;
    return false;
  }
  function rayHit(o, d, max, step = 1.5) {
    for (let s = 3; s < max; s += step) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s, h = hAt(x, z);
      if (y < Math.max(h, 0.2)) return { p: new V(x, Math.max(h, 0.2), z), s };
      if ((world.treeTopAt && world.treeTopAt(x, z, 1) > y) || solidAt(x, y, z)) return { p: new V(x, y, z), s };
    }
    return null;
  }
  const arenaEnemies = () => (window.__g && window.__g.enemies) || [];
  function areaHurt(p, R, dmg, st, push = 6) {      // урон считает кастер: игроки (сервер проверит), чучела арены, жители вздрагивают
    for (const b of net.bodies()) { const d = Math.hypot(b.x - p.x, b.y + 4.4 - p.y, b.z - p.z); if (d < R) net.send({ t: 'hit', to: b.id, dmg: Math.max(1, Math.round(dmg * (1 - 0.5 * d / R))), st }); }
    for (const e of arenaEnemies()) { if (e.state === 'dead' || !e.g) continue; const dx = e.g.position.x - p.x, dz = e.g.position.z - p.z; if (Math.hypot(dx, dz) < R && window.__g.damageEnemy) window.__g.damageEnemy(e, Math.round(dmg * 0.8), _a.set(dx, 0, dz).normalize(), push, 0.4); }
  }
  const nearBody = p => {      // снаряд попал в живое существо
    for (const b of net.bodies()) if (Math.hypot(b.x - p.x, b.z - p.z) < 2.6 && p.y > b.y - 1 && p.y < b.y + 10) return true;
    if (npcs && npcs.bodies) for (const b of npcs.bodies()) if (Math.hypot(b.x - p.x, b.z - p.z) < b.r + 1.4 && p.y > b.y - 1 && p.y < b.y + 10) return true;
    for (const e of arenaEnemies()) if (e.state !== 'dead' && e.g && Math.hypot(e.g.position.x - p.x, e.g.position.z - p.z) < 2.6 && p.y > e.g.position.y - 1 && p.y < e.g.position.y + 10) return true;
    return false;
  };

  /* ───── стихии ───── */
  const bolts = [];
  function launch(spec, o, d, own) {
    const main = spec.main, n = spec.count, sp = main === 'water' ? 100 : main === 'ice' ? 95 : 85 * (spec.fx.includes('wind') ? 1.25 : 1);
    for (let k = 0; k < n; k++) {
      const off = n === 1 ? 0 : (k - (n - 1) / 2) * 0.11, cs = Math.cos(off), sn = Math.sin(off);      // веер: поворот вокруг вертикали
      const v = new V(d.x * cs - d.z * sn, d.y, d.x * sn + d.z * cs).multiplyScalar(sp);
      bolts.push({ p: o.clone(), v, spec, own, t: 0, g: main === 'water' ? 18 : main === 'ice' ? 12 : 5, c: COL[main] });
    }
  }
  function impact(b) {
    const s = b.spec.size * (1 + 0.25 * b.spec.bright), has = k => b.spec.fx.includes(k), p = b.p, main = b.spec.main, own = b.own, wat = isWater(p.x, p.z) && p.y < 1.5;
    if (main === 'fire') {
      const R = 9 * s * (has('wind') ? 1.5 : 1), wet = has('water') || has('ice') || wat;
      flash(COL.fire, 22 * s); puff(p, COL.fire, 70, { spd: 14 * s, s0: 2, s1: 6, life: 0.9, up: 6, grav: -4 }); puff(p, [1, .85, .4], 20, { spd: 22 * s, s0: 0.8, s1: 0.2, life: 0.6, grav: 14 }); ring(p, COL.fire, R, 0.5);
      if (wet) { steam(p, R); dragons && dragons.extinguish(p.x, p.y, p.z, R); } else dragons && dragons.ignite(p.x, p.y, p.z, R);
      if (own) areaHurt(p, R, (wet ? 14 : 22) * s, 'spell'); npcs && npcs.hitAt && npcs.hitAt(p.x, p.z, R, false);
    } else if (main === 'water') {
      const R = 14 * s * (has('wind') ? 1.4 : 1); flash(COL.water, 6); puff(p, COL.water, 55, { spd: 16 * s, s0: 1.5, s1: 3.5, life: 1.0, up: 8, grav: 20 }); ring(p, COL.water, R, 0.6);
      const n = dragons ? dragons.wet(p.x, p.z, R, 45) : 0; if (n) steam(p, 8 + n * 2);      // потушили пожар — столб пара; земля мокрая, там не загорится
      if (own) areaHurt(p, R, 6 * s, 'spell'); npcs && npcs.hitAt && npcs.hitAt(p.x, p.z, R * 0.7, false);
    } else if (main === 'ice') {
      const R = 8 * s * (has('wind') ? 1.4 : 1); flash(COL.ice, 10); puff(p, COL.ice, 50, { spd: 14 * s, s0: 1, s1: 2.5, life: 1.1, up: 4, grav: 8 }); ring(p, COL.ice, R, 0.5);
      frost(p, R, s); if (dragons) dragons.extinguish(p.x, p.y, p.z, R);
      if (own) areaHurt(p, R, 12 * s, 'spell_ice'); npcs && npcs.hitAt && npcs.hitAt(p.x, p.z, R, false);
    }
  }
  function frost(p, R, s) {      // ледяные кристаллы; над водой — настил, по которому можно идти
    const n = Math.round(5 + R), grp = new THREE.Group(); grp.position.set(p.x, hAt(p.x, p.z) < 0.3 ? 0 : hAt(p.x, p.z), p.z); grp.userData.dispellable = true;
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x4fa8d8, emissiveIntensity: 0.35, transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.2 }), cr = [];
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(gCone, mat), a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R * 0.8, sc = rnd(0.5, 1.4) * Math.max(0.7, s); m.position.set(Math.cos(a) * r, 2.2 * sc, Math.sin(a) * r); m.rotation.set(rnd(-.35, .35), 0, rnd(-.35, .35)); m.userData.s = sc; m.scale.setScalar(0.01); grp.add(m); cr.push(m); }
    let plat = null;
    if (isWater(p.x, p.z)) { const h = R * 0.9; plat = { min: new V(p.x - h, -3, p.z - h), max: new V(p.x + h, 0.35, p.z + h), grab: false }; richard.solids.push(plat); walls.push(plat);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(h, h, 0.5, 20), mat); d.position.y = 0.1; grp.add(d); d.userData.s = 0; cr.push(d); }
    add(grp, 14, (th, k) => { const g = Math.min(1, k * 14) * (k > 0.85 ? (1 - k) / 0.15 : 1); for (const m of cr) { if (m.userData.s) m.scale.setScalar(Math.max(0.01, g * m.userData.s)); } mat.opacity = 0.85 * (k > 0.85 ? (1 - k) / 0.15 : 1); },
      () => { mat.dispose(); if (plat) { const i = richard.solids.indexOf(plat); if (i >= 0) richard.solids.splice(i, 1); walls.splice(walls.indexOf(plat), 1); } });
  }
  function lightning(spec, o, d, own) {      // мгновенный удар: линия от неба до цели из светящихся частиц; в воде бьёт шире
    const t = rayHit(o, d, 170), p = t ? t.p : new V(o.x + d.x * 120, 0, o.z + d.z * 120); if (!t) p.y = Math.max(hAt(p.x, p.z), 0.2);
    const s = spec.size * (1 + 0.25 * spec.bright), wat = isWater(p.x, p.z) || spec.fx.includes('water'), R = (wat ? 15 : 8) * s;
    const sx = p.x + rnd(-6, 6), sy = p.y + 85, sz = p.z + rnd(-6, 6), steps = 16; let x = sx, y = sy, z = sz;
    for (let i = 0; i < steps; i++) {
      const u = (i + 1) / steps, jit = 3.5 * (1 - u * 0.7), nx = sx + (p.x - sx) * u + (i < steps - 1 ? rnd(-jit, jit) : 0), ny = sy + (p.y - sy) * u, nz = sz + (p.z - sz) * u + (i < steps - 1 ? rnd(-jit, jit) : 0);
      for (let k = 0; k < 8; k++) { const w = k / 8; spawn(x + (nx - x) * w, y + (ny - y) * w, z + (nz - z) * w, 0, 0, 0, [.85, .9, 1], 2.6, 1.2, rnd(0.25, 0.45), 1, 0, 0); }
      if (Math.random() < 0.3) for (let k = 0; k < 5; k++) { const w = k / 5; spawn(nx + w * rnd(2, 6), ny - w * rnd(2, 5), nz + w * rnd(-4, 4), 0, 0, 0, COL.bolt, 1.4, 0.6, 0.3, 0.8, 0, 0); }
      x = nx; y = ny; z = nz;
    }
    flash([.8, .86, 1], 70 * Math.min(1.6, s)); puff(p, COL.bolt, 40, { spd: 20, s0: 1.2, s1: 0.4, life: 0.5, grav: 16 }); ring(p, COL.bolt, R, 0.35);
    if (dragons && !wat) dragons.ignite(p.x, p.y + 2, p.z, 4);
    if (own) areaHurt(p, R, 28 * s, 'spell'); npcs && npcs.hitAt && npcs.hitAt(p.x, p.z, R, true);
  }
  function gust(spec, o, d, own) {      // порыв ветра: конус; сбивает жителей, толкает игроков; раздувает пожар по ветру; вниз — подбрасывает самого мага
    const s = spec.size, range = 42 * s;
    if (own && d.y < -0.5 && hAt(o.x, o.z) + 24 > o.y) { boost(40 * Math.min(1.4, s)); puff(new V(P.pos.x, P.pos.y + 0.5, P.pos.z), COL.wind, 40, { spd: 16, s0: 2, s1: 5, life: 0.7, up: -2, a: 0.5 }); return; }
    for (let k = 0; k < 70; k++) { const w = rnd(0, 1), a = rnd(-.45, .45), b = rnd(-.25, .25), sp = rnd(50, 90); _a.set(d.x + a * -d.z + 0.0, d.y + b, d.z + a * d.x).normalize(); spawn(o.x + _a.x * 2, o.y + _a.y * 2 + rnd(-1, 1), o.z + _a.z * 2, _a.x * sp, _a.y * sp, _a.z * sp, COL.wind, 1.2, 4 + w * 4, rnd(0.4, 0.8), 0.35, 0, 1.2); }
    let burningAhead = false;
    for (let r = 10; r <= range; r += 10) { const x = o.x + d.x * r, z = o.z + d.z * r, y = o.y + d.y * r; if (dragons && dragons.burningNear(x, z, 9)) burningAhead = true; npcs && npcs.hitAt && npcs.hitAt(x, z, 8 + r * 0.25, r < 24); }
    if (burningAhead && dragons && !spec.fx.includes('water')) { const x = o.x + d.x * range, z = o.z + d.z * range; dragons.ignite(x, Math.max(hAt(x, z), 0) + 2, z, 8 * s); puff(new V(x, hAt(x, z) + 3, z), COL.fire, 25, { spd: 10, s0: 2, s1: 5, life: 0.9, up: 5, grav: -3 }); }
    if (own) for (const b of net.bodies()) { _b.set(b.x - o.x, 0, b.z - o.z); const L = _b.length(); if (L < range && L > 0.1 && _b.normalize().dot(_a.set(d.x, 0, d.z).normalize()) > 0.8) net.send({ t: 'hit', to: b.id, dmg: 4, st: 'spell' }); }
  }
  function wall(spec, o, d, own) {      // каменная стена перед магом: настоящее препятствие (для всех)
    const s = spec.size, t = rayHit(o, d, 55); let x = t ? t.p.x : o.x + d.x * 22, z = t ? t.p.z : o.z + d.z * 22; const dist = Math.hypot(x - o.x, z - o.z); if (dist < 9) { x = o.x + d.x * 9; z = o.z + d.z * 9; }
    const along = Math.abs(d.x) > Math.abs(d.z), W = 15 * s, Hh = 11 * s, T = 3.2, gy = Math.min(hAt(x, z), hAt(x + (along ? 0 : W / 2), z + (along ? W / 2 : 0)), hAt(x - (along ? 0 : W / 2), z - (along ? W / 2 : 0)));
    if (isWater(x, z)) { puff(new V(x, 0.5, z), COL.water, 20, { spd: 8, up: 6, grav: 14 }); return; }
    const sx = along ? T : W, sz = along ? W : T, g = new THREE.Group(); g.position.set(x, gy - 1, z); g.userData.dispellable = true;
    const mat = new THREE.MeshStandardMaterial({ color: 0x8d8372, roughness: 0.95, flatShading: true }), main = new THREE.Mesh(gBox, mat); main.scale.set(sx, Hh, sz); main.position.y = Hh / 2; g.add(main);
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(gBox, mat), hh = rnd(2, 5); m.scale.set(along ? T * 0.8 : rnd(2, 3.5), hh, along ? rnd(2, 3.5) : T * 0.8); m.position.set(along ? 0 : (i / 5 - 0.5) * (W - 3), Hh + hh / 2 - 0.5, along ? (i / 5 - 0.5) * (W - 3) : 0); m.rotation.y = rnd(-.4, .4); g.add(m); }
    const box = { min: new V(x - sx / 2, gy - 3, z - sz / 2), max: new V(x + sx / 2, gy + Hh, z + sz / 2), grab: false };
    const inside = P.pos.x > box.min.x - 2 && P.pos.x < box.max.x + 2 && P.pos.z > box.min.z - 2 && P.pos.z < box.max.z + 2;      // не замуровываем мага в камне
    if (!inside) { richard.solids.push(box); walls.push(box); }
    puff(new V(x, gy + 1, z), COL.stone, 40, { spd: 10, s0: 2, s1: 6, life: 1.2, up: 5, grav: 6, a: 0.55 });
    const life = 30; add(g, life, (th, k) => { const rise = Math.min(1, th.t / 0.5), sink = k > 0.93 ? (1 - k) / 0.07 : 1; g.scale.y = Math.max(0.02, rise * sink); g.position.y = gy - 1 + (1 - rise * sink) * -2; },
      () => { mat.dispose(); const i = richard.solids.indexOf(box); if (i >= 0) richard.solids.splice(i, 1); const j = walls.indexOf(box); if (j >= 0) walls.splice(j, 1); });
    npcs && npcs.hitAt && npcs.hitAt(x, z, 9, false);
  }
  // самонаведённые: исцеление, щит, полёт, свет, рассеять
  let shieldT = 0, levT = 0, orbT = 0, boostV = 0, boostW = 0, bubble = null, orb = null;
  function boost(vy) { if (P.state === 'ground') { window.__g && window.__g.press('Space'); boostV = vy; boostW = 0.08; } else P.vel.y = Math.max(P.vel.y, vy); }
  function selfSpell(main, spec, o, own, id) {
    const s = spec.size, c = COL[main], body = own ? P.pos : (net.bodies().find(b => b.id === id) || { x: o.x, y: o.y - 6, z: o.z });
    const at = new V(body.x, body.y + 5, body.z);
    if (main === 'heal') { if (own) { P.hp = Math.min(P.hpMax || 100, (P.hp || 0) + 32 * s); } for (let k = 0; k < 40; k++) spawn(body.x + rnd(-2.5, 2.5), body.y + rnd(0, 3), body.z + rnd(-2.5, 2.5), 0, rnd(6, 14), 0, c, 1.6, 0.4, rnd(0.8, 1.5), 0.8, -1, 0.5); flash(c, 5); }
    else if (main === 'shield') {
      if (!own) { puff(at, c, 20, { spd: 6, s0: 1.2, s1: 3, life: 1 }); return; } shieldT = 5 * s; if (bubble) { scene.remove(bubble); bubble.material.dispose(); }
      bubble = new THREE.Mesh(gSph, mkMat(c, 0.22)); bubble.scale.setScalar(6.5); bubble.renderOrder = 30; scene.add(bubble); flash(c, 8); ring(at, c, 9, 0.4);
    }
    else if (main === 'lev') { if (own) { levT = 4.2 * s; boost(24); } puff(new V(body.x, body.y + 0.5, body.z), c, 35, { spd: 9, s0: 1.5, s1: 4, life: 0.9, up: 2, a: 0.5 }); }
    else if (main === 'light') {
      if (own) { orbT = 120 * s; if (!orb) { orb = new THREE.Mesh(gSph, mkMat([1, .95, .7], 0.95)); orb.scale.setScalar(0.8); orb.renderOrder = 32; scene.add(orb); } orbL.intensity = 3.4 + spec.bright; orbL.distance = 130 + 20 * spec.bright; }
      puff(at, c, 30, { spd: 7, s0: 1.2, s1: 3, life: 0.9, a: 0.7 }); flash(c, 6 + spec.bright * 4);
    }
    else if (main === 'dispel') {      // рассеять: волна гасит огонь вокруг и растворяет стены мага
      const R = 30 * s; if (dragons) { const n = dragons.extinguish(at.x, at.y, at.z, R); if (n) steam(at, 10); } ring(at, c, R, 0.6); puff(at, c, 50, { spd: R * 0.8, s0: 1.5, s1: 3, life: 0.7, a: 0.5 }); flash(c, 8);
      for (const t of things) if (t.obj.userData && t.obj.userData.dispellable) t.life = Math.min(t.life, t.t + 0.3);
    }
  }

  /* ───── разыграть заклинание (своё и чужое) ───── */
  function perform(spec, o, d, own, id) {
    spec.main = ORDER.find(k => spec.fx.includes(k)); const m = spec.main;
    if (m === 'bolt') lightning(spec, o, d, own); else if (m === 'fire' || m === 'water' || m === 'ice') { launch(spec, o, d, own); puff(o, COL[m], 12, { spd: 8, s0: 1, s1: 2, life: 0.4 }); }
    else if (m === 'wind') gust(spec, o, d, own); else if (m === 'stone') wall(spec, o, d, own); else if (m) selfSpell(m, spec, o, own, id);
  }
  function aimRay() {
    camera.getWorldDirection(_a); const cd_ = _a.clone(), o = new V(P.pos.x, P.pos.y + 6.2, P.pos.z), hit = rayHit(camera.position, cd_, 230, 2.5);      // точка под прицелом
    const tgt = hit ? hit.p : camera.position.clone().addScaledVector(cd_, 200), d = tgt.sub(o).normalize(); if (d.dot(cd_) < 0.3) d.copy(cd_);
    return { o: o.addScaledVector(d, 2.5), d };
  }
  function cost(spec) { const m = ORDER.find(k => spec.fx.includes(k)); return Math.round((COST[m] || 10) * Math.pow(spec.size, 1.3) * Math.pow(spec.count, 0.85) * (1 + 0.35 * (spec.fx.length - 1)) * (1 + 0.15 * spec.bright)); }

  /* ───── окно заклинаний ───── */
  const css = document.createElement('style');
  css.textContent = `#spell{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);width:min(560px,92vw);z-index:40;font:13px/1.35 -apple-system,"Segoe UI",Roboto,sans-serif;display:none;background:rgba(18,12,34,.9);color:#efe9ff;border:2px solid #8a6cff;border-radius:14px;padding:11px 13px;box-shadow:0 8px 34px #000a}
  #spell.on{display:block} #spell h3{margin:0 0 6px;font-size:14px;color:#d6c7ff} #spell input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px 10px;border:2px solid #8a6cff;border-radius:9px;background:#fff;color:#222}
  #spell .pv{min-height:3.2em;margin:7px 0 5px;font-size:12.5px} #spell .pv b{color:#ffd36b} #spell .pv .bad{color:#ff9a8a} #spell .ch{display:flex;flex-wrap:wrap;gap:4px;max-height:96px;overflow:auto}
  #spell .ch button{border:1px solid #6b55c4;background:#2a1f55;color:#efe9ff;border-radius:7px;padding:2px 7px;cursor:pointer;font:11.5px ui-monospace,Menlo,monospace} #spell .ch button:hover{background:#44339b} #spell small{opacity:.65;display:block;margin-top:5px}
  #manaB{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:230px;z-index:30;pointer-events:none;display:none;text-align:center;font:11px -apple-system,Segoe UI,sans-serif;color:#d6c7ff;text-shadow:0 1px 3px #000}
  #manaB i{display:block;height:8px;margin-top:3px;border-radius:5px;background:rgba(10,6,30,.65);overflow:hidden;box-shadow:0 0 0 1px #8a6cff88} #manaB i u{display:block;height:100%;width:100%;background:linear-gradient(90deg,#6a4cff,#b69cff);text-decoration:none}
  #spellToast{position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:41;pointer-events:none;text-align:center;font:600 26px Georgia,serif;color:#e8dcff;text-shadow:0 0 14px #8a6cff,0 2px 4px #000;opacity:0;transition:opacity .5s} #spellToast small{display:block;font:13px -apple-system,sans-serif;color:#ffd36b;margin-top:3px}`;
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'spell';
  box.innerHTML = '<h3>✦ Древний язык — заклинание</h3><input maxlength="80" placeholder="brisingr  ·  adurna galba  ·  или по-русски: огонь, лёд и ветер…" autocomplete="off"><div class="pv"></div><div class="ch"></div><small>Enter — произнести (пустое — повторить прошлое) · Esc — закрыть · прилагательное: galba (большой), litil (малый), ramr (сильный) · множественное число — веер из трёх</small>';
  document.body.appendChild(box);
  const inp = box.querySelector('input'), pv = box.querySelector('.pv'), chips = box.querySelector('.ch');
  const manaB = document.createElement('div'); manaB.id = 'manaB'; manaB.innerHTML = '<span>✦ Y — заклинание</span><i><u></u></i>'; document.body.appendChild(manaB); const manaU = manaB.querySelector('u');
  const toast = document.createElement('div'); toast.id = 'spellToast'; document.body.appendChild(toast); let toastT = 0;
  for (const w of SPELL_WORDS) { const b = document.createElement('button'); b.textContent = w.a; b.title = w.ru + (NAME[w.fx] ? ' — ' + NAME[w.fx] : ''); b.onclick = () => { inp.value = (inp.value.trim() + ' ' + w.a).trim(); inp.focus(); refresh(); }; chips.appendChild(b); }
  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function refresh() {
    const t = inp.value.trim(); if (!t) { pv.innerHTML = 'Пиши слова силы. Нажми на слово ниже — оно подставится. Можно по-русски: переводчик сам переведёт на древний.<br><span style="opacity:.7">Запас сил: ' + Math.floor(mana) + '/' + MAXMANA + '</span>'; return; }
    const p = parseSpell(t), c = cost(p);
    let h = `<b>Древний:</b> ${esc(p.ancient)}<br><b>Смысл:</b> ${esc(p.ru)}<br>`;
    if (p.past) h += '<span class="bad">Прошедшее время: событие уже случилось — ничего не произойдёт.</span>';
    else if (!p.fx.length) h += '<span class="bad">Нет слова силы (огонь, вода, ветер, лёд, молния, камень, свет, исцелить, щит, летать, рассеять).</span>' + (p.unknown.length ? ' Нет слова: ' + esc(p.unknown.join(', ')) : '') + '<br><b>Перевод:</b> ' + esc(translate(t));
    else h += `Стихия: ${p.fx.map(f => NAME[f]).join(' + ')} · размер ×${p.size.toFixed(1)}${p.count > 1 ? ' · снарядов ' + p.count : ''} · цена <b>${c}</b> из ${Math.floor(mana)}` + (c > mana ? ' <span class="bad">— не хватит сил</span>' : '');
    pv.innerHTML = h;
  }
  let hist = [], hi = 0;
  const show = (a, b) => { toast.innerHTML = esc(a) + (b ? '<small>' + esc(b) + '</small>' : ''); toast.style.opacity = 1; toastT = 2.6; };
  const canCast = () => richard.active && !window.__dragonOn && !P.dead;
  function open() { if (!canCast()) return; if (document.pointerLockElement) document.exitPointerLock(); box.classList.add('on'); inp.value = ''; refresh(); inp.focus(); }
  function close(relock) { box.classList.remove('on'); inp.blur(); if (relock && richard.active) try { renderer.domElement.requestPointerLock(); } catch (e) {} }
  function cast(text) {
    const t = (text || '').trim() || hist[hist.length - 1]; if (!t) return false;
    if (cd > 0) { show('…', 'Дух ещё не отдышался'); return false; }
    const p = parseSpell(t);
    if (p.past) { show(p.ancient, 'Прошедшее время — событие уже случилось, ничего не произошло'); return false; }
    if (!p.fx.length) { show(p.ancient, p.unknown.length ? 'Нет слова: ' + p.unknown.join(', ') : 'В заклинании нет слова силы'); return false; }
    if (p.fx.includes('heal') && !p.fx.some(f => f !== 'heal') && (P.hp || 0) >= (P.hpMax || 100)) { show('✦', 'Ты и так здоров'); return false; }
    const c = cost(p); if (c > mana) { show(p.ancient, `Не хватает сил: нужно ${c}, есть ${Math.floor(mana)}`); return false; }
    mana -= c; cd = 0.55; if (hist[hist.length - 1] !== t) hist.push(t); hi = hist.length;
    const { o, d } = aimRay(), spec = { fx: p.fx, size: p.size, count: p.count, bright: p.bright };
    perform(spec, o, d, true, null);
    net.send({ t: 'spell', fx: p.fx, x: +o.x.toFixed(1), y: +o.y.toFixed(1), z: +o.z.toFixed(1), vx: +d.x.toFixed(3), vy: +d.y.toFixed(3), vz: +d.z.toFixed(3), size: +p.size.toFixed(2), count: p.count, bright: p.bright });
    show(p.ancient, p.ru); return true;
  }
  inp.addEventListener('input', refresh);
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { cast(inp.value); close(true); }
    else if (e.key === 'Escape') close(true);
    else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; inp.value = hist[hi] || ''; refresh(); } e.preventDefault(); }
    else if (e.key === 'ArrowDown') { if (hi < hist.length) { hi++; inp.value = hist[hi] || ''; refresh(); } e.preventDefault(); }
  });
  inp.addEventListener('keyup', e => e.stopPropagation());
  addEventListener('keydown', e => { if (e.code === 'KeyY' && !e.repeat && !box.classList.contains('on') && !/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) { e.preventDefault(); open(); } });
  net.on('spell', m => {      // чужое заклинание: рисуем у себя (урон по нам придёт отдельным сообщением от кастера)
    if (!Array.isArray(m.fx) || ![m.x, m.y, m.z, m.vx, m.vy, m.vz].every(Number.isFinite)) return;
    if (Math.hypot(m.x - camera.position.x, m.z - camera.position.z) > 500) return;
    perform({ fx: m.fx, size: m.size || 1, count: m.count || 1, bright: m.bright || 0 }, new V(m.x, m.y, m.z), new V(m.vx, m.vy, m.vz).normalize(), false, m.id);
  });

  /* ───── кадр ───── */
  function update(dt) {
    dt = Math.min(dt, 0.1); cd = Math.max(0, cd - dt);
    const active = richard.active && !window.__dragonOn; manaB.style.display = active ? 'block' : 'none';
    if (active) { mana = Math.min(MAXMANA, mana + 7 * dt); manaU.style.width = (mana / MAXMANA * 100) + '%'; if (box.classList.contains('on') && Math.random() < 0.05) refresh(); }
    if (window.__dragonOn && box.classList.contains('on')) close(false);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast.style.opacity = 0; }
    partTick(dt);
    if (flashT > 0) { flashT = Math.max(0, flashT - dt * 4); flashL.intensity = flashI * flashT; if (flashT <= 0) flashL.intensity = 0; }
    for (let i = things.length - 1; i >= 0; i--) { const t = things[i]; t.t += dt; const k = t.t / t.life; if (k >= 1) { scene.remove(t.obj); t.obj.traverse(o => { if (o.isMesh && o.material) o.material.dispose(); }); t.end && t.end(); things.splice(i, 1); continue; } t.upd && t.upd(t, k); }
    for (let i = bolts.length - 1; i >= 0; i--) {      // снаряды: огонь, вода, лёд
      const b = bolts[i]; b.t += dt; let dead = b.t > 3.2; const steps = Math.max(1, Math.ceil(b.v.length() * dt / 1.6)), sdt = dt / steps;
      for (let s = 0; s < steps && !dead; s++) {
        b.v.y -= b.g * sdt; b.p.addScaledVector(b.v, sdt);
        const h = hAt(b.p.x, b.p.z);
        if (b.p.y < Math.max(h, 0.2) || (world.treeTopAt && world.treeTopAt(b.p.x, b.p.z, 1) > b.p.y) || solidAt(b.p.x, b.p.y, b.p.z) || (b.t > 0.12 && nearBody(b.p))) { impact(b); dead = true; }
      }
      const m = b.spec.main, big = b.spec.size;
      spawn(b.p.x + rnd(-.4, .4), b.p.y + rnd(-.4, .4), b.p.z + rnd(-.4, .4), -b.v.x * 0.08, -b.v.y * 0.08 + (m === 'fire' ? 2 : 0), -b.v.z * 0.08, b.c, 2.2 * big, 0.5, rnd(0.25, 0.5), 0.9, m === 'fire' ? -3 : 6, 1.5);
      if (Math.random() < 0.6) spawn(b.p.x, b.p.y, b.p.z, rnd(-4, 4), rnd(-4, 4), rnd(-4, 4), m === 'fire' ? [1, .85, .4] : [1, 1, 1], 1.1, 0.2, 0.35, 0.8, 0, 2);
      if (dead) bolts.splice(i, 1);
    }
    if (boostW > 0) { boostW -= dt; if (boostW <= 0 || P.state !== 'ground') { window.__g && window.__g.release('Space'); if (boostV) { P.vel.y = boostV; boostV = 0; } boostW = 0; } }
    if (levT > 0 && !P.dead) { levT -= dt; if (P.state !== 'ground' && P.state !== 'dead') { const hold = levT < 3.0; if (hold) P.vel.y += (Math.sin(performance.now() / 350) * 1.5 - P.vel.y) * Math.min(1, dt * 5); if (Math.random() < 0.5) spawn(P.pos.x + rnd(-1.5, 1.5), P.pos.y + 0.3, P.pos.z + rnd(-1.5, 1.5), 0, -6, 0, COL.lev, 1.2, 0.3, 0.6, 0.6, 0, 0.5); } }
    if (shieldT > 0) { shieldT -= dt; P.inv = Math.max(P.inv || 0, 0.15); if (bubble) { bubble.position.set(P.pos.x, P.pos.y + 5, P.pos.z); bubble.material.opacity = 0.16 + 0.07 * Math.sin(performance.now() / 120); } if (shieldT <= 0 && bubble) { scene.remove(bubble); bubble.material.dispose(); bubble = null; } }
    if (orbT > 0 && orb) { orbT -= dt; const tm = performance.now() / 1000; orb.position.set(P.pos.x + Math.cos(tm * 1.3) * 4, P.pos.y + 11 + Math.sin(tm * 2) * 0.8, P.pos.z + Math.sin(tm * 1.3) * 4); orbL.position.copy(orb.position); if (Math.random() < 0.4) spawn(orb.position.x, orb.position.y, orb.position.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), COL.light, 1.6, 0.2, 0.7, 0.5, 0, 0.5); if (orbT <= 0) { orbL.intensity = 0; scene.remove(orb); orb.material.dispose(); orb = null; } }
  }
  return { update, cast, open, get mana() { return mana; }, set mana(v) { mana = v; } };
}
