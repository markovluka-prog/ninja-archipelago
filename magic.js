// magic.js — магия Древнего языка по законам «Эрагона». Здесь НЕТ списка заклинаний. Фраза разбирается как предложение (ancient.js): глагол — что сделать, существительное — над чем.
//   • Мир подчиняется смыслу слова: reisa stenr — поднять камень; thrautha sverd — бросить меч; jierda — сломать то, на что смотришь; letta — остановить; brisingr traevam — поджечь дерево.
//   • Энергия берётся у мага и равна работе, которую пришлось бы совершить руками: поднять 60 кг на метр — 590 Дж, разогнать камень — ½mv². Всё делится на КПД (растёт с опытом).
//   • Не хватает сил — заклинание всё равно сбывается, но недостающее забирается у тебя самого: здоровьем. Можно умереть.
//   • Материя не берётся из ничего (aldanarí — «творить» — стоит ~250 Дж на килограмм); магия двигает, греет, ломает и меняет то, что уже есть. Предметы (items.js) — настоящие тела.
//   • Щит (vardi) копит энергию и гасит удары, пока она не кончится. Будущее время (weohnata) — ловушка: срабатывает, когда рядом кто-то окажется. Néiat — запрет.
//   • Мир живёт сам: огонь ползёт по ветру, вода тушит и мочит землю, дерево горит, металл раскаляется, лёд тает, дождь гасит пожары.
import { parse, render, WORDBOOK, MARK, VERB, NOUN, PRON } from './ancient.js';
import { createItems, KIND, MAT, U, matchesMat } from './items.js';

const COL = { fire: [1, .5, .15], water: [.3, .65, 1], wind: [.85, 1, .95], ice: [.7, .92, 1], bolt: [.82, .86, 1], light: [1, .93, .6], stone: [.72, .64, .5], heal: [.5, 1, .6], shield: [.4, .8, 1], lev: [.8, .7, 1], steam: [.9, .92, .95], mind: [.75, .55, 1], ash: [.35, .33, .32], shadow: [.45, .3, .65], mist: [.8, .85, .9] };
const EMAX = 3000, REGEN = 28, PMASS = 75, G0 = 9.8;
const MKCOL = ['#b9f0c0', '#ffe08a', '#9fd4ff', '#ff9a8a'];

export function createMagic({ THREE, scene, world, richard, net, camera, renderer, npcs, dragons }) {
  const V = THREE.Vector3, P = richard.P, hAt = (x, z) => world.heightAt(x, z), rnd = (a, b) => a + Math.random() * (b - a), isWater = (x, z) => hAt(x, z) < 0.3;
  const _a = new V(), _b = new V();
  let E = EMAX, cd = 0, xp = 0; try { xp = +localStorage.getItem('ninja.magic.xp') || 0; } catch (e) {}
  const eta = () => 0.5 + 0.4 * (1 - Math.exp(-xp / 14));      // КПД мага: растёт с опытом

  /* ───── частицы (общий пул) ───── */
  const N = 2600, pp = new Float32Array(N * 3), ps = new Float32Array(N), pc = new Float32Array(N * 4);
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
  function puff(p, c, n, o = {}) {
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
  const flashL = new THREE.PointLight(0xffffff, 0, 160, 1.3), orbL = new THREE.PointLight(0xfff0b0, 0, 140, 1.2); scene.add(flashL, orbL);      // два света заранее: добавлять на лету нельзя (фриз)
  let flashT = 0, flashI = 0; const flash = (c, i) => { flashL.color.setRGB(c[0], c[1], c[2]); flashI = i; flashT = 1; };

  /* ───── недолговечные вещи (кольца, кристаллы, стены) ───── */
  const things = []; const add = (obj, life, upd, end) => { scene.add(obj); things.push({ obj, t: 0, life, upd, end }); };
  const gSph = new THREE.SphereGeometry(1, 16, 12), gCone = new THREE.ConeGeometry(0.9, 5, 5), gBox = new THREE.BoxGeometry(1, 1, 1);
  const mkMat = (c, o = 0.5) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
  function ring(p, c, R, dur) { const m = new THREE.Mesh(gSph, mkMat(c, 0.45)); m.position.copy(p); m.scale.setScalar(0.5); m.renderOrder = 30; add(m, dur, (th, k) => { m.scale.setScalar(0.5 + R * (1 - (1 - k) ** 2)); m.material.opacity = 0.45 * (1 - k) ** 1.5; }); }
  const steam = (p, R) => puff(p, COL.steam, Math.min(60, 20 + R * 3), { spd: R * 0.9, s0: 3, s1: 9, life: 1.8, up: 5, grav: -2.5, a: 0.5, drag: 1.2 });

  /* ───── предметы мира ───── */
  const items = createItems({ THREE, scene, world });
  const walls = [];      // каменные стены и ледяные настилы мага
  const solidAt = (x, y, z) => { for (const b of world.solidBoxes || []) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1) return true; for (const b of walls) if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z && y > b.min.y && y < b.max.y) return true; return false; };
  const arena = () => (window.__g && window.__g.enemies) || [];
  const bodies = () => { const o = []; for (const b of net.bodies()) o.push({ x: b.x, y: b.y, z: b.z, r: 1.4, kind: 'player', id: b.id }); if (npcs && npcs.bodies) for (const b of npcs.bodies()) o.push({ x: b.x, y: b.y, z: b.z, r: b.r, kind: 'npc' }); for (const e of arena()) if (e.state !== 'dead' && e.g) o.push({ x: e.g.position.x, y: e.g.position.y, z: e.g.position.z, r: 1.4, kind: 'enemy', e }); return o; };
  function hurtBody(b, dmg, J, st) {
    if (b.kind === 'player') net.send({ t: 'hit', to: b.id, dmg: Math.max(1, Math.round(dmg)), st });
    else if (b.kind === 'npc') npcs && npcs.hitAt && npcs.hitAt(b.x, b.z, 2.5, J > 150);
    else if (b.kind === 'enemy' && window.__g.damageEnemy) window.__g.damageEnemy(b.e, Math.round(dmg * 0.8), _a.set(b.x - P.pos.x, 0, b.z - P.pos.z).normalize(), 6, 0.3);
  }
  const env = {
    get wind() { const w = dragons ? dragons.wind() : { x: 0, z: 0 }; return w; },
    boxes: () => (world.solidBoxes || []).concat(walls),
    fireNear: (x, z, r) => dragons ? dragons.burningNear(x, z, r) : false, wetAt: (x, z) => dragons ? dragons.wetAt(x, z) : false,
    ignite: (x, y, z, r) => dragons && dragons.ignite(x, y, z, r),
    puff: (p, kind, n) => { if (kind === 'fire') puff(p, COL.fire, n, { spd: 4, s0: 1.4, s1: 3, life: 0.6, up: 6, grav: -3 }); else if (kind === 'steam') puff(p, COL.steam, n, { spd: 4, s0: 1.5, s1: 4, life: 1.2, up: 4, grav: -2, a: 0.4 }); else puff(p, COL.ash, n, { spd: 6, s0: 1, s1: 3, life: 1.6, up: 3, a: 0.5 }); },
    bodies, splash: p => puff(new V(p.x, 0.5, p.z), COL.water, 12, { spd: 8, s0: 1, s1: 2, life: 0.7, up: 8, grav: 18 }),
    melt: p => dragons && dragons.wet(p.x, p.z, 5, 25), thud: (p, it, v) => { if (v > 14) puff(p, [.6, .55, .45], 6, { spd: 4, s0: 1, s1: 3, life: 0.6, a: 0.4 }); },
    onHit(it, b, J) { const sharp = ['sword', 'knife', 'arrow', 'spear'].includes(it.kind); hurtBody(b, Math.min(40, (J / 6) * (sharp ? 2 : 1)), J, 'spell'); puff(new V(it.p.x, it.p.y, it.p.z), [1, .8, .6], 6, { spd: 8, s0: 0.8, s1: 0.2, life: 0.4 }); },
  };
  const KINDS_W = [['stone', 30], ['stick', 15], ['log', 6], ['apple', 10], ['sword', 4], ['knife', 4], ['arrow', 6], ['spear', 3], ['shield', 2], ['bowl', 3], ['chest', 2], ['boulder', 5], ['feather', 3], ['leaf', 4], ['goldbar', 1], ['silverbar', 1], ['cloth', 2]];
  const pickKind = () => { let t = Math.random() * KINDS_W.reduce((s, k) => s + k[1], 0); for (const [k, w] of KINDS_W) { if ((t -= w) <= 0) return k; } return 'stone'; };
  function scatter(cx, cz, n, rMin, rMax) {      // разбросать вещи по суше вокруг: магии всегда есть над чем работать
    for (let k = 0; k < n * 6 && n > 0; k++) {
      const a = Math.random() * 6.283, d = rnd(rMin, rMax), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = hAt(x, z);
      if (y < 1.2 || (world.blockedAt && (() => { try { return world.blockedAt(x, z); } catch (e) { return false; } })()) || solidAt(x, y + 1, z) || (world.solidBoxes || []).some(b => x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3)) continue;
      items.spawn(pickKind(), x, y + 2, z); n--;
    }
  }
  let scT = 0, scatterDone = false;

  /* ───── поверхность: луч и цель ───── */
  function rayHit(o, d, max, step = 1.5) {
    for (let s = 3; s < max; s += step) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s, h = hAt(x, z);
      if (y < Math.max(h, 0.2)) return { p: new V(x, Math.max(h, 0.2), z), s };
      if ((world.treeTopAt && world.treeTopAt(x, z, 1) > y) || solidAt(x, y, z)) return { p: new V(x, y, z), s };
    }
    return null;
  }
  function aimRay() {
    camera.getWorldDirection(_a); const cd_ = _a.clone(), o = new V(P.pos.x, P.pos.y + 6.2, P.pos.z), hit = rayHit(camera.position, cd_, 230, 2.5);
    const tgt = hit ? hit.p.clone() : camera.position.clone().addScaledVector(cd_, 200), d = tgt.clone().sub(o).normalize(); if (d.dot(cd_) < 0.3) d.copy(cd_);
    return { o: o.addScaledVector(d, 2.5), d, tgt, hit: !!hit };
  }
  const distRay = (p, o, d) => { _b.copy(p).sub(o); const along = _b.dot(d); if (along < 0) return { perp: 1e9, along }; return { perp: _b.addScaledVector(d, -along).length(), along }; };

  /* ───── стихии-проявления (fortha / голое существительное): снаряды, молния, порыв, стена ───── */
  const bolts = [];
  function launch(spec, o, d, own) {
    const main = spec.main, n = spec.count, sp = (main === 'water' ? 100 : main === 'ice' ? 95 : 85) * (spec.fx.includes('wind') ? 1.25 : 1);
    for (let k = 0; k < n; k++) { const off = n === 1 ? 0 : (k - (n - 1) / 2) * 0.11, cs = Math.cos(off), sn = Math.sin(off), v = new V(d.x * cs - d.z * sn, d.y, d.x * sn + d.z * cs).multiplyScalar(sp); bolts.push({ p: o.clone(), v, spec, own, t: 0, g: main === 'water' ? 18 : main === 'ice' ? 12 : 5, c: COL[main] }); }
  }
  function areaHurt(p, R, dmg, st) {
    for (const b of bodies()) { const d = Math.hypot(b.x - p.x, b.y + 4.4 - p.y, b.z - p.z); if (d < R) hurtBody(b, Math.max(1, Math.round(dmg * (1 - 0.5 * d / R))), dmg * 12, st); }
    // предметы в радиусе отбрасывает взрывом
    for (const it of items.items) { const dx = it.p.x - p.x, dz = it.p.z - p.z, d = Math.hypot(dx, dz, it.p.y - p.y); if (d < R && d > 0.1) { const f = (1 - d / R) * dmg * 1.6 / Math.max(0.3, it.m ** 0.5); it.v.x += dx / d * f; it.v.z += dz / d * f; it.v.y += Math.abs(it.p.y - p.y) / d * f * 0.6 + f * 0.3; } }
  }
  function impact(b) {
    const s = b.spec.size * (1 + 0.25 * b.spec.bright), has = k => b.spec.fx.includes(k), p = b.p, main = b.spec.main, own = b.own, wat = isWater(p.x, p.z) && p.y < 1.5, pw = b.spec.pow || 1;
    if (main === 'fire') {
      const R = 9 * s * (has('wind') ? 1.5 : 1), wet = has('water') || has('ice') || wat;
      flash(COL.fire, 22 * s); puff(p, COL.fire, 70, { spd: 14 * s, s0: 2, s1: 6, life: 0.9, up: 6, grav: -4 }); puff(p, [1, .85, .4], 20, { spd: 22 * s, s0: 0.8, s1: 0.2, life: 0.6, grav: 14 }); ring(p, COL.fire, R, 0.5);
      if (wet) { steam(p, R); dragons && dragons.extinguish(p.x, p.y, p.z, R); } else dragons && dragons.ignite(p.x, p.y, p.z, R);
      if (own) areaHurt(p, R, (wet ? 14 : 22) * s * pw, 'spell'); npcs && npcs.hitAt && npcs.hitAt(p.x, p.z, R, false);
    } else if (main === 'water') {
      const R = 14 * s * (has('wind') ? 1.4 : 1); flash(COL.water, 6); puff(p, COL.water, 55, { spd: 16 * s, s0: 1.5, s1: 3.5, life: 1.0, up: 8, grav: 20 }); ring(p, COL.water, R, 0.6);
      const n = dragons ? dragons.wet(p.x, p.z, R, 45) : 0; if (n) steam(p, 8 + n * 2);
      for (const it of items.items) if (Math.hypot(it.p.x - p.x, it.p.z - p.z) < R) { it.wet = 1; it.T = Math.min(it.T, 40); }
      if (own) areaHurt(p, R, 6 * s, 'spell'); npcs && npcs.hitAt && npcs.hitAt(p.x, p.z, R * 0.7, false);
    } else if (main === 'ice') {
      const R = 8 * s * (has('wind') ? 1.4 : 1); flash(COL.ice, 10); puff(p, COL.ice, 50, { spd: 14 * s, s0: 1, s1: 2.5, life: 1.1, up: 4, grav: 8 }); ring(p, COL.ice, R, 0.5);
      frost(p, R, s); if (dragons) dragons.extinguish(p.x, p.y, p.z, R); for (const it of items.items) if (Math.hypot(it.p.x - p.x, it.p.z - p.z) < R) it.T = Math.min(it.T, -10);
      if (own) areaHurt(p, R, 12 * s * pw, 'spell_ice'); npcs && npcs.hitAt && npcs.hitAt(p.x, p.z, R, false);
    }
  }
  function frost(p, R, s) {
    const n = Math.round(5 + R), grp = new THREE.Group(); grp.position.set(p.x, hAt(p.x, p.z) < 0.3 ? 0 : hAt(p.x, p.z), p.z); grp.userData.dispellable = true;
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x4fa8d8, emissiveIntensity: 0.35, transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.2 }), cr = [];
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(gCone, mat), a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R * 0.8, sc = rnd(0.5, 1.4) * Math.max(0.7, s); m.position.set(Math.cos(a) * r, 2.2 * sc, Math.sin(a) * r); m.rotation.set(rnd(-.35, .35), 0, rnd(-.35, .35)); m.userData.s = sc; m.scale.setScalar(0.01); grp.add(m); cr.push(m); }
    let plat = null;
    if (isWater(p.x, p.z)) { const h = R * 0.9; plat = { min: new V(p.x - h, -3, p.z - h), max: new V(p.x + h, 0.35, p.z + h), grab: false }; richard.solids.push(plat); walls.push(plat); const d = new THREE.Mesh(new THREE.CylinderGeometry(h, h, 0.5, 20), mat); d.position.y = 0.1; grp.add(d); d.userData.s = 0; cr.push(d); }
    add(grp, 14, (th, k) => { const g = Math.min(1, k * 14) * (k > 0.85 ? (1 - k) / 0.15 : 1); for (const m of cr) if (m.userData.s) m.scale.setScalar(Math.max(0.01, g * m.userData.s)); mat.opacity = 0.85 * (k > 0.85 ? (1 - k) / 0.15 : 1); },
      () => { mat.dispose(); if (plat) { const i = richard.solids.indexOf(plat); if (i >= 0) richard.solids.splice(i, 1); const j = walls.indexOf(plat); if (j >= 0) walls.splice(j, 1); } });
  }
  function lightning(spec, o, d, own) {
    const t = rayHit(o, d, 170), p = t ? t.p : new V(o.x + d.x * 120, 0, o.z + d.z * 120); if (!t) p.y = Math.max(hAt(p.x, p.z), 0.2);
    const s = spec.size * (1 + 0.25 * spec.bright), wat = isWater(p.x, p.z) || spec.fx.includes('water'), R = (wat ? 15 : 8) * s * (spec.pow || 1);
    const sx = p.x + rnd(-6, 6), sy = p.y + 85, sz = p.z + rnd(-6, 6), steps = 16; let x = sx, y = sy, z = sz;
    for (let i = 0; i < steps; i++) {
      const u = (i + 1) / steps, jit = 3.5 * (1 - u * 0.7), nx = sx + (p.x - sx) * u + (i < steps - 1 ? rnd(-jit, jit) : 0), ny = sy + (p.y - sy) * u, nz = sz + (p.z - sz) * u + (i < steps - 1 ? rnd(-jit, jit) : 0);
      for (let k = 0; k < 8; k++) { const w = k / 8; spawn(x + (nx - x) * w, y + (ny - y) * w, z + (nz - z) * w, 0, 0, 0, [.85, .9, 1], 2.6, 1.2, rnd(0.25, 0.45), 1, 0, 0); }
      if (Math.random() < 0.3) for (let k = 0; k < 5; k++) { const w = k / 5; spawn(nx + w * rnd(2, 6), ny - w * rnd(2, 5), nz + w * rnd(-4, 4), 0, 0, 0, COL.bolt, 1.4, 0.6, 0.3, 0.8, 0, 0); }
      x = nx; y = ny; z = nz;
    }
    flash([.8, .86, 1], 70 * Math.min(1.6, s)); puff(p, COL.bolt, 40, { spd: 20, s0: 1.2, s1: 0.4, life: 0.5, grav: 16 }); ring(p, COL.bolt, R, 0.35);
    if (dragons && !wat) dragons.ignite(p.x, p.y + 2, p.z, 4);
    for (const it of items.items) if (Math.hypot(it.p.x - p.x, it.p.z - p.z) < R) { if (MAT[it.mat].cond) { it.T += 500; arc(it.p); } else if (MAT[it.mat].flam) it.T += 220; }      // металл проводит ток и раскаляется
    if (own) areaHurt(p, R, 28 * s * (spec.pow || 1), 'spell'); npcs && npcs.hitAt && npcs.hitAt(p.x, p.z, R, true);
  }
  function arc(p) { for (let k = 0; k < 3; k++) spawn(p.x, p.y + 1, p.z, rnd(-14, 14), rnd(2, 12), rnd(-14, 14), COL.bolt, 1.2, 0.3, 0.3, 0.9, 12, 0); }
  function gust(spec, o, d, own) {
    const s = spec.size * (spec.pow || 1), range = 42 * s;
    if (own && d.y < -0.5 && hAt(o.x, o.z) + 24 > o.y) { boost(40 * Math.min(1.4, s)); puff(new V(P.pos.x, P.pos.y + 0.5, P.pos.z), COL.wind, 40, { spd: 16, s0: 2, s1: 5, life: 0.7, up: -2, a: 0.5 }); return; }
    for (let k = 0; k < 70; k++) { const w = rnd(0, 1), a = rnd(-.45, .45), b = rnd(-.25, .25), sp = rnd(50, 90); _a.set(d.x + a * -d.z, d.y + b, d.z + a * d.x).normalize(); spawn(o.x + _a.x * 2, o.y + _a.y * 2 + rnd(-1, 1), o.z + _a.z * 2, _a.x * sp, _a.y * sp, _a.z * sp, COL.wind, 1.2, 4 + w * 4, rnd(0.4, 0.8), 0.35, 0, 1.2); }
    dragons && dragons.setWind(d.x * 32 * s, d.z * 32 * s, 14);      // порыв задаёт ветер: пожар ползёт по ветру, предметы сносит
    let burningAhead = false;
    for (let r = 10; r <= range; r += 10) { const x = o.x + d.x * r, z = o.z + d.z * r; if (dragons && dragons.burningNear(x, z, 9)) burningAhead = true; npcs && npcs.hitAt && npcs.hitAt(x, z, 8 + r * 0.25, r < 24); }
    for (const it of items.items) { const dd = distRay(it.p, o, d); if (dd.along < range && dd.perp < 6 + dd.along * 0.4) { const f = 60 * s / Math.max(0.5, it.m ** 0.5); it.v.x += d.x * f; it.v.z += d.z * f; it.v.y += 6 + f * 0.1; } }
    if (burningAhead && dragons) { const x = o.x + d.x * range, z = o.z + d.z * range; dragons.ignite(x, Math.max(hAt(x, z), 0) + 2, z, 8 * s); puff(new V(x, hAt(x, z) + 3, z), COL.fire, 25, { spd: 10, s0: 2, s1: 5, life: 0.9, up: 5, grav: -3 }); }
    if (own) for (const b of net.bodies()) { _b.set(b.x - o.x, 0, b.z - o.z); const L = _b.length(); if (L < range && L > 0.1 && _b.normalize().dot(_a.set(d.x, 0, d.z).normalize()) > 0.8) net.send({ t: 'hit', to: b.id, dmg: 4, st: 'spell' }); }
  }
  function wall(spec, o, d, own) {
    const s = spec.size * (spec.pow || 1), t = rayHit(o, d, 55); let x = t ? t.p.x : o.x + d.x * 22, z = t ? t.p.z : o.z + d.z * 22; if (Math.hypot(x - o.x, z - o.z) < 9) { x = o.x + d.x * 9; z = o.z + d.z * 9; }
    const along = Math.abs(d.x) > Math.abs(d.z), W = 15 * s, Hh = 11 * s, T = 3.2, gy = Math.min(hAt(x, z), hAt(x + (along ? 0 : W / 2), z + (along ? W / 2 : 0)), hAt(x - (along ? 0 : W / 2), z - (along ? W / 2 : 0)));
    if (isWater(x, z)) { puff(new V(x, 0.5, z), COL.water, 20, { spd: 8, up: 6, grav: 14 }); return; }
    const sx = along ? T : W, sz = along ? W : T, g = new THREE.Group(); g.position.set(x, gy - 1, z); g.userData.dispellable = true;
    const mat = new THREE.MeshStandardMaterial({ color: 0x8d8372, roughness: 0.95, flatShading: true }), main = new THREE.Mesh(gBox, mat); main.scale.set(sx, Hh, sz); main.position.y = Hh / 2; g.add(main);
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(gBox, mat), hh = rnd(2, 5); m.scale.set(along ? T * 0.8 : rnd(2, 3.5), hh, along ? rnd(2, 3.5) : T * 0.8); m.position.set(along ? 0 : (i / 5 - 0.5) * (W - 3), Hh + hh / 2 - 0.5, along ? (i / 5 - 0.5) * (W - 3) : 0); m.rotation.y = rnd(-.4, .4); g.add(m); }
    const box = { min: new V(x - sx / 2, gy - 3, z - sz / 2), max: new V(x + sx / 2, gy + Hh, z + sz / 2), grab: false };
    const inside = P.pos.x > box.min.x - 2 && P.pos.x < box.max.x + 2 && P.pos.z > box.min.z - 2 && P.pos.z < box.max.z + 2;
    if (!inside) { richard.solids.push(box); walls.push(box); }
    puff(new V(x, gy + 1, z), COL.stone, 40, { spd: 10, s0: 2, s1: 6, life: 1.2, up: 5, grav: 6, a: 0.55 });
    add(g, 30, (th, k) => { const rise = Math.min(1, th.t / 0.5), sink = k > 0.93 ? (1 - k) / 0.07 : 1; g.scale.y = Math.max(0.02, rise * sink); g.position.y = gy - 1 + (1 - rise * sink) * -2; },
      () => { mat.dispose(); const i = richard.solids.indexOf(box); if (i >= 0) richard.solids.splice(i, 1); const j = walls.indexOf(box); if (j >= 0) walls.splice(j, 1); });
    npcs && npcs.hitAt && npcs.hitAt(x, z, 9, false);
  }
  /* ───── состояния мага: щит-оберег, полёт, свет, хватка, ловушки ───── */
  let wardJ = 0, flyOn = false, flyT = 0, rooted = null, orbT = 0, boostV = 0, boostW = 0, bubble = null, orb = null, lastHp = P.hp, sprintT = 0; const traps = [];
  const selfUp = () => PMASS * G0 * 0.12 * U * 6;      // Дж/с, чтобы держать себя в воздухе
  const itemUp = it => it.m * G0 * 0.35 * U * 6;      // Дж/с, чтобы держать предмет против тяжести
  function procCount(scope) { let n = 0; if (scope !== 'items') { if (rooted) n++; if (flyOn) n++; } if (scope === 'all') { if (wardJ > 0) n++; if (orbT > 0) n++; if (rainT > 0) n++; } if (scope !== 'self') for (const it of items.items) if (it.held || it.hover || it.pin > 0) n++; return n; }
  function stopProcs(scope) { const n = procCount(scope); if (scope !== 'items') { rooted = null; flyOn = false; } if (scope === 'all') { wardJ = 0; orbT = 0; rainT = 0; } if (scope !== 'self') for (const it of items.items) { it.held = 0; it.hover = null; it.pin = 0; } return n; }
  function boost(vy) { if (P.state === 'ground') { window.__g && window.__g.press('Space'); boostV = vy; boostW = 0.08; } else P.vel.y = Math.max(P.vel.y, vy); }
  function selfVis(main, spec, o, own, id) {      // видимая часть самонаправленных заклинаний (у чужих — только картинка)
    const c = COL[main] || COL.mind, body = own ? P.pos : (net.bodies().find(b => b.id === id) || { x: o.x, y: o.y - 6, z: o.z }), at = new V(body.x, body.y + 5, body.z);
    if (main === 'heal') { for (let k = 0; k < 40; k++) spawn(body.x + rnd(-2.5, 2.5), body.y + rnd(0, 3), body.z + rnd(-2.5, 2.5), 0, rnd(6, 14), 0, c, 1.6, 0.4, rnd(0.8, 1.5), 0.8, -1, 0.5); flash(c, 5); }
    else if (main === 'shield') { if (!own) { puff(at, c, 20, { spd: 6, s0: 1.2, s1: 3, life: 1 }); return; } if (!bubble) { bubble = new THREE.Mesh(gSph, mkMat(c, 0.22)); bubble.scale.setScalar(6.5); bubble.renderOrder = 30; scene.add(bubble); } flash(c, 8); ring(at, c, 9, 0.4); }
    else if (main === 'lev') puff(new V(body.x, body.y + 0.5, body.z), c, 35, { spd: 9, s0: 1.5, s1: 4, life: 0.9, up: 2, a: 0.5 });
    else if (main === 'light') { if (own) { if (!orb) { orb = new THREE.Mesh(gSph, mkMat([1, .95, .7], 0.95)); orb.scale.setScalar(0.8); orb.renderOrder = 32; scene.add(orb); } orbL.intensity = 3.4 + spec.bright; orbL.distance = 130 + 20 * spec.bright; } puff(at, c, 30, { spd: 7, s0: 1.2, s1: 3, life: 0.9, a: 0.7 }); flash(c, 6 + spec.bright * 4); }
    else if (main === 'dispel') { const R = 30 * spec.size; ring(at, COL.steam, R, 0.6); puff(at, COL.steam, 50, { spd: R * 0.8, s0: 1.5, s1: 3, life: 0.7, a: 0.5 }); }
    else if (main === 'mind') puff(new V(o.x + (spec.dx || 0) * 14, o.y + (spec.dy || 0) * 14, o.z + (spec.dz || 0) * 14), COL.mind, 18, { spd: 6, s0: 1.4, s1: 3, life: 0.8, a: 0.6 });
    else if (main === 'rain') startRain(own);
  }
  function perform(spec, o, d, own, id) {      // проявление стихии (своё и чужое по сети)
    const ORDER = ['bolt', 'fire', 'ice', 'water', 'stone', 'wind']; spec.main = spec.main || ORDER.find(k => spec.fx.includes(k)) || spec.fx[0]; const m = spec.main;
    if (m === 'bolt') lightning(spec, o, d, own); else if (m === 'fire' || m === 'water' || m === 'ice') { launch(spec, o, d, own); puff(o, COL[m], 12, { spd: 8, s0: 1, s1: 2, life: 0.4 }); }
    else if (m === 'wind') gust(spec, o, d, own); else if (m === 'stone') wall(spec, o, d, own); else selfVis(m, { ...spec, dx: d.x, dy: d.y, dz: d.z }, o, own, id);
  }
  // дождь: настоящий — гасит пожары и мочит землю и вещи вокруг мага
  let rainT = 0; function startRain(own) { if (own) rainT = 45; }

  /* ───── план заклинания: предложение → физические действия с ценой в джоулях ───── */
  const kg = it => it.m; const Jlift = (m, hu) => m * G0 * hu * U;
  const fmtJ = j => j >= 1000 ? (j / 1000).toFixed(1) + ' кДж' : Math.round(j) + ' Дж';
  function npInfo(np) {      // что названо: стихии, материалы, вещи, растения, постройки, части тела, существа, местоимения
    const r = { elems: [], mats: [], kinds: [], flora: [], structs: [], parts: [], creatures: [], pron: [], num: 0, abs: [] };
    for (const t of np) {
      if (t.role === 'Q') { r.num = Math.max(r.num, t.num); continue; }
      if (t.role === 'R') { r.pron.push(PRON[t.a] || t.a); continue; }
      if (t.role !== 'N' && t.role !== 'A') continue;
      const s = NOUN[t.a]; if (!s) { if (t.e.theme === 'ppl') r.creatures.push(t.a); else if (t.e.theme === 'ani') r.creatures.push(t.a); else if (t.e.theme === 'bod') r.parts.push(t.a); else r.abs.push(t.a); continue; }
      const [k, id] = s; if (k === 'elem' || k === 'wea') r.elems.push(id); else if (k === 'mat') r.mats.push(id); else if (k === 'item') r.kinds.push(id); else if (k === 'flora') r.flora.push(id); else if (k === 'struct') r.structs.push(id); else if (k === 'part') r.parts.push(id);
    }
    return r;
  }
  function pickItems(info, aim, n, preferHeld) {
    const filt = it => (!info.kinds.length && !info.mats.length) || info.kinds.includes(it.kind) || (info.kinds.includes('sword') && false) || info.mats.some(m => matchesMat(it, m)) || (info.kinds.includes('stone') && it.kind === 'boulder' && false);
    let c = items.items.filter(it => filt(it) && it.p.distanceTo(P.pos) < 140);
    const scored = c.map(it => { const dd = distRay(it.p, aim.o, aim.d), dp = it.p.distanceTo(aim.tgt); return { it, s: Math.min(dd.perp + dd.along * 0.02, dp * 0.6 + 8), ok: (dd.along > 0 && dd.perp < 10 + dd.along * 0.3) || dp < 22, held: it.held }; }).filter(x => x.ok);
    scored.sort((a, b) => (preferHeld ? (b.held - a.held) : 0) || a.s - b.s);
    return scored.slice(0, n).map(x => x.it);
  }
  function pickBodies(aim, R) { const near = bodies().filter(b => Math.hypot(b.x - aim.tgt.x, b.z - aim.tgt.z) < R || (() => { const dd = distRay(_b.set(b.x, b.y + 4, b.z), aim.o, aim.d); return dd.along < 90 && dd.perp < 6; })()); near.sort((a, b) => Math.hypot(a.x - aim.tgt.x, a.z - aim.tgt.z) - Math.hypot(b.x - aim.tgt.x, b.z - aim.tgt.z)); return near; }
  function pickFlora(aim, R, kinds) { const out = []; if (world.flamNear) world.flamNear(aim.tgt.x, aim.tgt.z, R, o => { if (Math.hypot(o.x - aim.tgt.x, o.z - aim.tgt.z) < R + o.r && (!kinds || kinds.includes(o.k) || (kinds.includes('structs') && o.k === 'house'))) out.push(o); }); out.sort((a, b) => Math.hypot(a.x - aim.tgt.x, a.z - aim.tgt.z) - Math.hypot(b.x - aim.tgt.x, b.z - aim.tgt.z)); return out; }
  const sizeM = p => p.mods.size * p.mods.pow;
  const IGN = { wood: 700, organic: 220, leaf: 90, feather: 60, cloth: 320 };

  function planClause(cl, p, aim) {
    const info = npInfo(cl.np), act = cl.verb ? VERB[cl.verb] : null, M = p.mods, sz = sizeM(p), L = [], n = Math.max(1, info.num || (p.count > 1 && p.count !== info.num ? p.count : 1));
    const A = (label, J, run, vis) => L.push({ label, J, run, vis });
    const elem = info.elems[0], objectsNamed = info.kinds.length || info.mats.length || info.pron.length;
    const selfT = info.pron.includes('self'), heldItems = items.items.filter(i => i.held);
    const bareHeld = !objectsNamed && !elem && !info.flora.length && !info.structs.length && !info.creatures.length && !info.parts.length;
    const targetItems = () => (bareHeld && heldItems.length) ? heldItems.slice(0, n) : pickItems(info, aim, n, true);
    if (p.neg && cl.verb) { const e = elem; A(`запрет «${cl.verb}»` + (e ? ' — ' + e : ''), 350 * sz, () => { if (e === 'fire' && dragons) { dragons.wet(aim.tgt.x, aim.tgt.z, 22 * sz, 40); puff(aim.tgt, COL.water, 20, { spd: 8, up: 5, grav: 8 }); } else { npcs && npcs.afflict && npcs.afflict(aim.tgt.x, aim.tgt.z, 12, 'bind', 3); } }, 'mind'); return { acts: L }; }
    if (p.neg && elem === 'fire') { A('запрет огня: земля становится сырой', 350 * sz, () => dragons && dragons.wet(aim.tgt.x, aim.tgt.z, 22 * sz, 40), 'mind'); return { acts: L }; }
    // ───── голые существительные и стихия без глагола: проявление стихии, или стихия, действующая на названную вещь
    if (!act) {
      if (elem && (objectsNamed || info.flora.length || info.creatures.length) && !info.pron.includes('self')) return { acts: applyElem(elem, info, aim, p, n, sz) };
      if (elem) return { acts: manifest(elem, p, aim, sz, n) };
      A('осмотреть: ' + cl.np.filter(t => t.e).map(t => t.e.ru.split(/[;,(]/)[0]).join(', '), 20, () => inspect(aim, info), 'mind'); return { acts: L };
    }
    switch (act) {
      case 'manifest': case 'create': {
        if (act === 'create' && !elem) {
          const kind = info.kinds[0] || ({ stone: 'stone', wood: 'stick', metal: 'knife', gold: 'goldbar', silver: 'silverbar', cloth: 'cloth', ice: 'icechunk' })[info.mats[0]]; if (!kind) return { err: 'Творить нечего: назови вещь (stenr, sverd, hald…)' };
          const K = KIND[kind], J = 250 * K.m * sz; A(`сотворить: ${K.name} (${K.m} кг) из ничего`, J, () => { const at = new V(aim.o.x + aim.d.x * 6, Math.max(hAt(aim.o.x + aim.d.x * 6, aim.o.z + aim.d.z * 6) + 3, aim.o.y), aim.o.z + aim.d.z * 6); const it = items.spawn(kind, at.x, at.y, at.z, { mscale: sz }); if (it) puff(at, COL.mind, 22, { spd: 6, s0: 1.4, s1: 3, life: 0.8 }); }, 'mind'); return { acts: L };
        }
        if (elem) return { acts: manifest(elem, p, aim, sz, n) };
        return { err: 'Что являть? Назови стихию (brisingr, adurna, vindr…)' };
      }
      case 'lift': case 'fly': {
        if (selfT || (!objectsNamed && !heldItems.length && !elem && !info.flora.length)) {
          const hu = 6 * sz, J = Jlift(PMASS, hu) + 45 * 5 * (act === 'fly' ? 2 : 1); A(`взлететь на ${(hu * U).toFixed(1)} м и парить — ПРОЦЕСС: держать в воздухе ${fmtJ(selfUp())}/с, пока хватает сил (losna eka или U — прекратить)`, J, () => { flyOn = true; flyT = 0; rooted = null; boost(24 + 4 * sz); selfVis('lev', { size: 1, bright: 0 }, aim.o, true); }, 'lev'); return { acts: L };
        }
        if (elem === 'water') return { acts: manifest('water', p, { ...aim, d: new V(0, 1, 0).add(aim.d).normalize() }, sz, n) };
        const its = targetItems(); if (!its.length) return { err: 'Нечего поднимать: ' + (info.kinds[0] ? 'такой вещи рядом нет' : 'вещей рядом нет') };
        for (const it of its) { const hu = (act === 'fly' ? 9 : 7) * sz; A(`поднять ${it.name} (${kg(it).toFixed(1)} кг) на ${(hu * U).toFixed(1)} м и держать — ${fmtJ(itemUp(it))}/с (losna или U — отпустить)`, Jlift(it.m, hu) * (1 + M.dur * 0.4), () => { it.hover = { y: it.p.y + hu, t: Infinity }; it.held = 0; }, 'mind'); }
        return { acts: L };
      }
      case 'push': case 'throw': {
        if (elem === 'stone' || info.mats.includes('soil')) { A('толкнуть землю: ударная волна', 600 * sz, () => shockwave(aim.tgt, 18 * sz), 'mind'); return { acts: L }; }
        if (elem) return { acts: manifest(elem, p, aim, sz, n) };
        const its = targetItems();
        if (its.length) for (const it of its) { const v = (act === 'throw' ? 32 : 22) * M.pow * (M.slow ? 0.6 : 1), J = 0.5 * it.m * (v * U) ** 2; A(`${act === 'throw' ? 'бросить' : 'толкнуть'} ${it.name} (${kg(it).toFixed(1)} кг) со скоростью ${(v * U).toFixed(1)} м/с`, J, () => { it.held = 0; it.hover = null; const dir = aim.d.clone(); if (M.homing) { const bs = bodies().sort((a, b) => Math.hypot(a.x - aim.tgt.x, a.z - aim.tgt.z) - Math.hypot(b.x - aim.tgt.x, b.z - aim.tgt.z))[0]; if (bs) dir.set(bs.x - it.p.x, bs.y + 4 - it.p.y, bs.z - it.p.z).normalize(); } it.v.copy(dir).multiplyScalar(v); it.rest = 0; }, 'mind'); }
        else { const bs = pickBodies(aim, 12); if (!bs.length) return { err: 'Нечего толкать: цели не видно' }; A('толкнуть существо', 300 * sz, () => { for (const b of bs.slice(0, 3)) { npcs && npcs.hitAt && npcs.hitAt(b.x, b.z, 3, true); if (b.kind === 'player') net.send({ t: 'hit', to: b.id, dmg: 3, st: 'spell' }); } }, 'wind'); }
        return { acts: L };
      }
      case 'hold': {
        const its = targetItems(); if (!its.length) return { err: 'Нечего хватать: такой вещи у цели нет' };
        for (const it of its) A(`схватить ${it.name} (${kg(it).toFixed(1)} кг) — ПРОЦЕСС: держать ${fmtJ(itemUp(it))}/с (losna или U — отпустить)`, Jlift(it.m, 2) , () => { it.held = 1; it.hover = null; it.hd = Math.max(8, Math.min(26, it.p.distanceTo(P.pos))); }, 'mind');
        return { acts: L };
      }
      case 'release': case 'unbind': { const scope = selfT ? 'self' : (info.kinds.length || info.mats.length) ? 'items' : 'all'; if (!procCount(scope)) return { err: 'Нечего отпускать: ни одно заклинание-процесс не действует' }; A(`отпустить (${scope === 'self' ? 'себя' : scope === 'items' ? 'предметы' : 'всё'})`, 0, () => { stopProcs(scope); }, 'mind'); return { acts: L }; }
      case 'stop': {
        if (selfT) {      // Letta eka — остановить себя: гасит скорость (в падении — зависнуть в воздухе)
          const vm = Math.hypot(P.vel.x, P.vel.y, P.vel.z) * U, J = 0.5 * PMASS * vm * vm + 30;
          A(`остановить себя: погасить ${vm.toFixed(1)} м/с и ПРОДОЛЖАТЬ удерживать на месте — ${fmtJ(P.state === 'ground' ? 25 : selfUp())}/с (losna eka или U — отпустить)`, J, () => { P.vel.set(0, 0, 0); rooted = P.pos.clone(); flyOn = false; puff(new V(P.pos.x, P.pos.y + 4, P.pos.z), COL.mind, 20, { spd: 5, s0: 1.4, s1: 3, life: 0.7, a: 0.6 }); ring(new V(P.pos.x, P.pos.y + 4, P.pos.z), COL.mind, 7, 0.4); }, 'mind'); return { acts: L };
        }
        if (elem === 'fire') { A('остановить огонь: потушить', 150 * sz, () => { const n2 = dragons ? dragons.extinguish(aim.tgt.x, aim.tgt.y, aim.tgt.z, 16 * sz) : 0; if (n2) steam(aim.tgt, 8); ring(aim.tgt, COL.steam, 14 * sz, 0.5); }, 'mind'); return { acts: L }; }
        if (elem === 'water') return { acts: freezeIce(aim, sz) };
        const its = (objectsNamed || heldItems.length) ? targetItems() : items.items.filter(i => i.v.length() > 3 && i.p.distanceTo(aim.tgt) < 30);
        if (its.length) { for (const it of its) A(`остановить ${it.name}: поглотить ${fmtJ(items.energyJ(it))}`, items.energyJ(it) + 15, () => { it.v.set(0, 0, 0); it.pin = 4 * M.dur; it.hover = null; }, 'mind'); return { acts: L }; }
        const bs = pickBodies(aim, 10); if (bs.length) { A('остановить существо на 3 с', 250, () => { for (const b of bs.slice(0, 2)) npcs && npcs.afflict && npcs.afflict(b.x, b.z, 2.5, 'bind', 3 * M.dur); }, 'mind'); return { acts: L }; }
        A('остановить — всё и так неподвижно', 10, () => {}, 'mind'); return { acts: L };
      }
      case 'gather': case 'pull': case 'banish': case 'scatter': {
        const toMe = act === 'pull', out = act === 'banish' || act === 'scatter', ctr = toMe ? P.pos : aim.tgt;
        const its = (act === 'pull' ? targetItems() : items.items.filter(it => it.p.distanceTo(aim.tgt) < 26 * sz && ((!info.kinds.length && !info.mats.length) || info.kinds.includes(it.kind) || info.mats.some(m => matchesMat(it, m))))).slice(0, 12);
        if (!its.length && !(out && pickBodies(aim, 14).length)) return { err: 'Нечего ' + (out ? 'отбрасывать' : 'притягивать') };
        let J = 0; const v = 26 * M.pow; for (const it of its) J += 0.5 * it.m * (v * U) ** 2;
        A(`${out ? 'отбросить' : toMe ? 'притянуть к себе' : 'стянуть в точку'}: ${its.length} предм.`, J + (out ? 200 : 0), () => { for (const it of its) { _a.set(it.p.x - ctr.x, it.p.y - ctr.y, it.p.z - ctr.z); const d2 = _a.length() || 1; _a.normalize(); const s2 = out ? 1 : -1; it.v.addScaledVector(_a, s2 * v * (toMe ? 1.1 : 1)); it.v.y += 8; it.held = 0; it.hover = null; } if (out) { for (const b of pickBodies(aim, 14).slice(0, 4)) npcs && npcs.hitAt && npcs.hitAt(b.x, b.z, 3, true); ring(aim.tgt, COL.wind, 14, 0.5); } }, 'mind'); return { acts: L };
      }
      case 'break': {
        const its = targetItems(); if (its.length) { for (const it of its) { const mat = MAT[it.mat], area = Math.PI * (it.r * U) ** 2, J = mat.tough * area * 2 * (it.hard || 1); A(`разбить ${it.name} (${it.mat}, ${kg(it).toFixed(1)} кг): работа разрушения`, J, () => shatter(it), 'mind'); } return { acts: L }; }
        const ws = things.filter(t => t.obj.userData && t.obj.userData.dispellable && t.obj.position.distanceTo(aim.tgt) < 20); if (ws.length) { A('разрушить каменную/ледяную постройку мага', 300, () => { for (const t of ws) t.life = Math.min(t.life, t.t + 0.2); puff(aim.tgt, COL.stone, 30, { spd: 12, s0: 2, s1: 5, life: 1, grav: 14 }); }, 'mind'); return { acts: L }; }
        return { err: 'Ломать нечего: смотри на предмет' };
      }
      case 'cut': {
        const its = targetItems(); const bs = pickBodies(aim, 10).filter(b => Math.hypot(b.x - P.pos.x, b.z - P.pos.z) < 40);
        if (its.length) { for (const it of its) A(`рассечь ${it.name} на две части`, 140 * M.pow, () => splitItem(it), 'mind'); return { acts: L }; }
        A('рассечь воздух перед собой (клинок силы)', 180 * sz * M.pow, () => { for (let k = 0; k < 26; k++) { const a = rnd(-.7, .7); spawn(aim.o.x + aim.d.x * 3 + Math.cos(a) * -aim.d.z * 6 * a, aim.o.y + rnd(-1, 1), aim.o.z + aim.d.z * 3 + a * aim.d.x * 6, aim.d.x * 70, 0, aim.d.z * 70, [.9, .95, 1], 1.4, 0.4, 0.3, 0.8, 0, 1); } for (const b of bs.slice(0, 3)) { hurtBody(b, 12 * M.pow, 150, 'spell'); } }, 'wind'); return { acts: L };
      }
      case 'crush': {
        const its = targetItems(); if (its.length) { for (const it of its) A(`раздавить ${it.name}`, MAT[it.mat].tough * Math.PI * (it.r * U) ** 2 * 3, () => { puff(it.p, [.7, .65, .55], 14, { spd: 6, s0: 1, s1: 3, life: 0.8, grav: 8 }); items.remove(it); }, 'mind'); return { acts: L }; }
        const bs = pickBodies(aim, 8); if (!bs.length) return { err: 'Нечего сжимать' }; A('сжать существо (оглушение)', 500, () => { for (const b of bs.slice(0, 2)) { npcs && npcs.afflict && npcs.afflict(b.x, b.z, 2.5, 'bind', 3); if (b.kind === 'player') net.send({ t: 'hit', to: b.id, dmg: 8, st: 'spell' }); } }, 'mind'); return { acts: L };
      }
      case 'ignite': return { acts: applyElem('fire', info, aim, p, n, sz) };
      case 'dry': {
        if (elem === 'water' || (!objectsNamed && !info.creatures.length)) { A('высушить: испарить воду вокруг', 400 * sz, () => { steam(aim.tgt, 6 * sz); for (const it of items.items) if (it.p.distanceTo(aim.tgt) < 18 * sz) it.wet = 0; }, 'mind'); return { acts: L }; }
        const its = targetItems(); A('высушить ' + (its[0] ? its[0].name : 'вещь'), 60, () => { for (const it of its) { it.wet = 0; it.T += 30; } }, 'mind'); return { acts: L };
      }
      case 'harden': {
        if (elem === 'water') return { acts: freezeIce(aim, sz) };
        const its = targetItems(); if (!its.length) return { err: 'Нечего закалять' }; for (const it of its) A(`закалить ${it.name}`, 90 * it.m ** 0.5, () => { it.hard = (it.hard || 1) * 1.5; it.T = 15; puff(it.p, [.8, .9, 1], 10, { spd: 4, s0: 1, s1: 2, life: 0.6 }); }, 'mind'); return { acts: L };
      }
      case 'heal': {
        if (selfT || !info.creatures.length) { const hpMax = P.hpMax || 100, need = Math.max(0, hpMax - (P.hp || 0)), amt = Math.min(need, 32 * M.pow * sz); if (need < 1) return { err: 'Ты и так здоров' }; A(`исцелить раны: +${Math.round(amt)} здоровья (клетки растут за счёт твоей энергии)`, amt * 40, () => { P.hp = Math.min(hpMax, (P.hp || 0) + amt); selfVis('heal', { size: 1, bright: 0 }, aim.o, true); }, 'heal'); return { acts: L }; }
        const bs = pickBodies(aim, 10); A('исцелить существо', 600, () => { for (const b of bs.slice(0, 2)) if (b.kind === 'npc') npcs && npcs.shout && npcs.shout(b.x, b.z, 4, 'Спасибо!'); puff(new V(aim.tgt.x, aim.tgt.y + 4, aim.tgt.z), COL.heal, 24, { spd: 5, s0: 1.4, s1: 3, life: 1 }); }, 'heal'); return { acts: L };
      }
      case 'ward': {
        const W = 800 * sz * (M.pow > 1 ? 1 : 1) * M.dur; A(`оберег: вложить ${fmtJ(W)} — гасит удары по 40 Дж за 1 урона`, W, () => { wardJ += W; selfVis('shield', { size: 1, bright: 0 }, aim.o, true); }, 'shield'); return { acts: L };
      }
      case 'light': {
        if (info.kinds.length) { const its = targetItems(); if (its.length) { A(`заставить сиять: ${its[0].name}`, 60, () => { orbBind = its[0]; orbT = 1e9; selfVis('light', { size: 1, bright: M.bright }, aim.o, true); }, 'light'); return { acts: L }; } }
        A('зажечь светлячок (не пламя — свет) — ПРОЦЕСС: горит, пока хватает сил (~6 Дж/с)', 60 * (1 + M.bright), () => { orbT = 1e9; orbBind = null; selfVis('light', { size: 1, bright: M.bright }, aim.o, true); }, 'light'); return { acts: L };
      }
      case 'sleep': case 'bind': case 'slow': case 'wake': {
        const bs = pickBodies(aim, 12).filter(b => b.kind === 'npc'); if (!bs.length) return { err: act === 'wake' ? 'Некого будить' : 'Нет живой цели в поле зрения (усыпить можно только жителей)' };
        const sec = act === 'sleep' ? 14 * M.dur : act === 'bind' ? 9 * M.dur : act === 'slow' ? 4 * M.dur : 0, J = act === 'wake' ? 80 : 450 * Math.min(3, bs.length) * sz;
        A(`${({ sleep: 'усыпить', bind: 'связать', slow: 'замедлить', wake: 'разбудить' })[act]}: ${Math.min(3, bs.length)} чел.`, J, () => { for (const b of bs.slice(0, 3)) npcs.afflict(b.x, b.z, 2.5, act === 'wake' ? 'wake' : act === 'sleep' ? 'sleep' : 'bind', sec); puff(new V(aim.tgt.x, aim.tgt.y + 4, aim.tgt.z), COL.mind, 18, { spd: 5, s0: 1.4, s1: 3, life: 1 }); }, 'mind'); return { acts: L };
      }
      case 'kill': {
        const bs = pickBodies(aim, 10); if (!bs.length) return { err: 'Некого — цели не видно' };
        A('остановить жизнь: ' + (bs[0].kind === 'player' ? 'игрок' : 'существо'), 1800 * M.pow, () => { for (const b of bs.slice(0, 1)) { if (b.kind === 'player') net.send({ t: 'hit', to: b.id, dmg: 40, st: 'spell' }); else npcs && npcs.afflict && npcs.afflict(b.x, b.z, 2.5, 'sleep', 20); } flash(COL.shadow, 12); puff(new V(bs[0].x, bs[0].y + 5, bs[0].z), COL.shadow, 30, { spd: 8, s0: 2, s1: 4, life: 1.2, a: 0.6 }); }, 'mind'); return { acts: L };
      }
      case 'change': {
        const its = targetItems(), toMat = info.mats[1] || info.mats.find(m => !its[0] || m !== its[0].mat); const nm = toMat || (cl.np.filter(t => NOUN[t.a] && NOUN[t.a][0] === 'mat').map(t => NOUN[t.a][1]).pop());
        if (!its.length || !nm || !MAT[nm]) return { err: 'Превращать нечего: moi <вещь> <материал>, например moi sverd kuldr' };
        for (const it of its) A(`превратить ${it.name} из ${MAT[it.mat].n} в ${MAT[nm].n}`, 120 * it.m, () => { const ratio = MAT[nm].rho / MAT[it.mat].rho; it.m *= ratio; items.setMat(it, nm); puff(it.p, COL.mind, 16, { spd: 5, s0: 1.2, s1: 3, life: 0.8 }); }, 'mind'); return { acts: L };
      }
      case 'inspect': A('осмотреть', 20, () => inspect(aim, info), 'mind'); return { acts: L };
      case 'sprint': { const v = 7 * sz; A(`рывок вперёд (${(v * U * 5).toFixed(1)} м/с, масса мага ${PMASS} кг)`, 0.5 * PMASS * (v * U * 5) ** 2 * 0.2, () => { const yaw = P.yawVis ?? P.yaw; boost(14); P.vel.x += Math.sin(yaw) * v * 5; P.vel.z += Math.cos(yaw) * v * 5; puff(P.pos, COL.wind, 20, { spd: 8, s0: 1.5, s1: 3, life: 0.5, a: 0.5 }); }, 'wind'); return { acts: L }; }
      case 'conceal': A('скрыть: клубы тумана', 150, () => { puff(new V(P.pos.x, P.pos.y + 4, P.pos.z), COL.mist, 40, { spd: 6, s0: 4, s1: 10, life: 3, a: 0.35, drag: 1 }); }, 'mind'); return { acts: L };
      default: { A(`«${cl.verb}» — слово есть, но мир не знает, что менять`, 15, () => puff(new V(aim.tgt.x, aim.tgt.y + 2, aim.tgt.z), COL.mind, 8, { spd: 3, s0: 1, s1: 2, life: 0.6, a: 0.5 }), 'mind'); return { acts: L }; }
    }
  }
    let orbBind = null;
  function shockwave(p, R) { ring(p, COL.stone, R, 0.5); puff(new V(p.x, p.y + 0.5, p.z), COL.stone, 40, { spd: R * 0.9, s0: 2, s1: 6, life: 1.1, up: 2, grav: 6, a: 0.5 }); for (const it of items.items) { const d = it.p.distanceTo(p); if (d < R) { _a.set(it.p.x - p.x, 0.6, it.p.z - p.z).normalize(); it.v.addScaledVector(_a, 30 / Math.max(0.5, it.m ** 0.4)); it.v.y += 12; it.held = 0; } } npcs && npcs.hitAt && npcs.hitAt(p.x, p.z, R, true); areaHurt(p, R * 0.8, 6, 'spell'); }
  function shatter(it) { const frag = it.kind === 'stone' || it.kind === 'boulder' ? 'stone' : it.mat === 'wood' ? 'stick' : null; puff(it.p, [.7, .65, .55], 18, { spd: 9, s0: 1, s1: 3, life: 0.8, grav: 14 }); const n = Math.min(5, Math.max(2, Math.round(it.m ** 0.4 + 1))); if (frag) for (let k = 0; k < n; k++) { const f = items.spawn(frag, it.p.x, it.p.y + 0.5, it.p.z, { mscale: it.m / (KIND[frag].m * n) }); if (f) { f.scale = Math.max(0.4, Math.min(1, (it.m / n / KIND[frag].m) ** 0.33)); f.v.set(rnd(-14, 14), rnd(6, 16), rnd(-14, 14)); } } items.remove(it); }
  function splitItem(it) { puff(it.p, [.9, .92, 1], 8, { spd: 5, s0: 1, s1: 0.3, life: 0.4 }); const h = items.spawn(it.kind, it.p.x, it.p.y + 0.4, it.p.z, { mscale: it.m / KIND[it.kind].m / 2 }); if (h) { h.scale = it.scale * 0.85; h.v.set(rnd(-6, 6), 8, rnd(-6, 6)); items.setMat(h, it.mat); h.T = it.T; } it.m /= 2; it.scale *= 0.85; it.v.set(rnd(-6, 6), 8, rnd(-6, 6)); }
  function freezeIce(aim, sz) { return [{ label: 'заморозить воду: лёд', J: 700 * sz, run: () => { const R = 8 * sz; ring(aim.tgt, COL.ice, R, 0.5); frost(aim.tgt, R, sz); }, vis: 'ice' }]; }
  function manifest(elem, p, aim, sz, n) {      // стихия «из ничего»: цена — энергия, нагревающая/разгоняющая нужное количество вещества
    const spec = { fx: [elem], size: p.mods.size, count: Math.min(4, n), bright: p.mods.bright, pow: p.mods.pow }; const baseJ = { fire: 400, water: 250, ice: 500, bolt: 1500, wind: 200, light: 60, shadow: 150, mist: 100, rain: 700, heal: 0 }[elem];
    if (baseJ === undefined) return [{ label: 'стихия «' + elem + '» не проявляется', J: 20, run: () => {}, vis: 'mind' }];
    const names = { fire: 'огненный шар', water: 'струя воды', ice: 'ледяной удар', bolt: 'молния', wind: 'порыв ветра', light: 'светлячок', shadow: 'облако тьмы', mist: 'туман', rain: 'ливень' };
    const J = baseJ * Math.pow(sz, 1.3) * Math.pow(spec.count, 0.85) * (elem === 'fire' ? p.mods.heat : 1);
    return [{ label: `${names[elem]}${spec.count > 1 ? ' ×' + spec.count : ''}: ${elem === 'fire' ? 'нагрев' : elem === 'bolt' ? 'разряд' : 'разгон массы'}`, J, man: true, run: () => { if (elem === 'shadow' || elem === 'mist') puff(new V(aim.tgt.x, aim.tgt.y + 3, aim.tgt.z), elem === 'shadow' ? COL.shadow : COL.mist, 50, { spd: 7, s0: 4, s1: 11, life: 3, a: 0.4, drag: 1 }); else if (elem === 'light') { orbT = 1e9; orbBind = null; selfVis('light', spec, aim.o, true); } else if (elem === 'rain') startRain(true); else perform(spec, aim.o, aim.d, true, null); }, vis: elem }];
  }
  function applyElem(elem, info, aim, p, n, sz) {      // стихия действует на названную вещь (brisingr traevam, eldrvarí stenr, vindr sverd …)
    const L = [], M = p.mods, its = (info.kinds.length || info.mats.length || info.pron.length) ? pickItems(info, aim, n, true) : [];
    const A = (label, J, run, vis) => L.push({ label, J, run, vis });
    for (const it of its) {
      if (elem === 'fire') { const mat = MAT[it.mat], ign = IGN[it.mat] || (mat.cond ? 150 * it.m * 0.4 : 40); A(`нагреть ${it.name} (${it.m.toFixed(1)} кг, ${mat.n})${mat.flam ? ': займётся' : mat.cond ? ': раскалится' : ''}`, ign * M.heat * (mat.cond ? Math.max(1, it.m / 2) : 1), () => { it.T = Math.max(it.T, mat.flam ? mat.flam + 40 : 700 * M.heat); flash(COL.fire, 4); puff(it.p, COL.fire, 10, { spd: 3, s0: 1.2, s1: 3, life: 0.5, up: 4 }); }, 'fire'); }
      else if (elem === 'water') A(`намочить ${it.name}`, 40, () => { it.wet = 1; it.T = Math.min(it.T, 20); if (it.burn) { it.burn = 0; steam(it.p, 4); } puff(it.p, COL.water, 12, { spd: 5, up: 4, grav: 14 }); }, 'water');
      else if (elem === 'ice') A(`заморозить ${it.name}`, 120 * it.m ** 0.5, () => { it.T = -30; puff(it.p, COL.ice, 14, { spd: 4, s0: 1, s1: 2, life: 0.8 }); }, 'ice');
      else if (elem === 'wind') A(`обдуть ${it.name}`, 60, () => { it.v.x += aim.d.x * 40 / Math.max(0.5, it.m ** 0.5); it.v.z += aim.d.z * 40 / Math.max(0.5, it.m ** 0.5); it.v.y += 6; }, 'wind');
      else if (elem === 'bolt') A(`ударить молнией по ${it.name}`, 1800 * M.pow, () => { perform({ fx: ['bolt'], size: 0.5, count: 1, bright: 0, pow: M.pow }, new V(it.p.x, it.p.y + 3, it.p.z), new V(0, -1, 0), true, null); if (MAT[it.mat].cond) { it.T += 600; arc(it.p); } else if (MAT[it.mat].flam) it.T += 400; }, 'bolt');
      else A(`воздействовать на ${it.name}`, 30, () => puff(it.p, COL[elem] || COL.mind, 8, { spd: 3, s0: 1, s1: 2, life: 0.6 }), 'mind');
    }
    if (!its.length) {
      if (elem === 'fire') {
        const fl = pickFlora(aim, 9, info.structs.length ? ['house', 'structs'] : info.flora.length ? ['tree', 'plant'] : null);
        if (fl.length) { const o = fl[0], J = (o.k === 'house' ? 900 : o.k === 'tree' ? 800 : 120) * M.heat; A(`поджечь ${o.k === 'house' ? 'постройку' : o.k === 'tree' ? 'дерево' : 'растение'} (${fmtJ(J)} на розжиг; дальше огонь пойдёт сам)`, J, () => { dragons && dragons.ignite(o.x, o.y + o.h * 0.4, o.z, 3 + o.r); flash(COL.fire, 8); puff(new V(o.x, o.y + 2, o.z), COL.fire, 18, { spd: 5, s0: 1.4, s1: 3.5, life: 0.7, up: 6, grav: -3 }); }, 'fire'); return L; }
        const bs = info.creatures.length ? pickBodies(aim, 10) : []; if (bs.length) { A('обжечь существо', 500, () => { for (const b of bs.slice(0, 2)) hurtBody(b, 14 * M.pow, 120, 'spell'); puff(new V(bs[0].x, bs[0].y + 4, bs[0].z), COL.fire, 20, { spd: 6, s0: 1.5, s1: 3, life: 0.6, up: 5 }); }, 'fire'); return L; }
      }
      return manifest(elem, p, aim, sizeM(p), n);
    }
    return L;
  }
  function inspect(aim, info) {
    const its = pickItems(info, aim, 1, true), bs = pickBodies(aim, 8), fl = pickFlora(aim, 8);
    if (its.length) { const it = its[0], m = MAT[it.mat]; show(`${it.name}`, `${m.n} · ${it.m.toFixed(2)} кг · ${Math.round(it.T)}°C${it.burn ? ' · ГОРИТ' : ''}${it.wet > 0.3 ? ' · мокрый' : ''} · ${items.speedMS(it).toFixed(1)} м/с · запас прочности ${m.tough}`); }
    else if (bs.length) show(bs[0].kind === 'player' ? 'Игрок' : bs[0].kind === 'npc' ? 'Житель' : 'Враг', 'живое существо · ' + (Math.hypot(bs[0].x - P.pos.x, bs[0].z - P.pos.z) * U).toFixed(0) + ' м');
    else if (fl.length) show(fl[0].k === 'house' ? 'Постройка' : fl[0].k === 'tree' ? 'Дерево' : 'Растение', `${fl[0].burn > 0 ? 'ГОРИТ' : fl[0].ash > performance.now() / 1000 ? 'выгорело' : 'горючее'} · высота ${(fl[0].h * U).toFixed(1)} м`);
    else show('…', 'Здесь ничего, на что можно посмотреть');
  }
  function planSpell(p, aim) {
    if (p.tense === 'past') return { err: 'Прошедшее время: событие уже случилось — ничего не произойдёт' };
    if (p.unknown.length) return { err: 'Нет слова: ' + p.unknown.join(', ') + ' (мир не поймёт слово, которого нет в языке)' };
    if (!p.clauses.length) return { err: 'В фразе нет ни действия, ни вещи' };
    const acts = [], notes = []; for (const cl of p.clauses) { const r = planClause(cl, p, aim); if (r.err) notes.push(r.err); else acts.push(...r.acts); }
    if (!acts.length) return { err: notes[0] || 'Ничего не произойдёт' };
    let raw = acts.reduce((s, a) => s + a.J, 0); const noncanon = p.marks.some(m => m === 3); if (noncanon) { raw *= 1.3; notes.push('есть слова не из канона (○): магия идёт с трудом, цена ×1.3'); }
    const e = eta(); return { acts, notes, raw, total: raw / e, eta: e };
  }

  /* ───── применение ───── */
  const hist = []; let hi = 0, lethalAsk = null, keep = false;
  function cast(text) {
    keep = false; const t = (text || '').trim() || hist[hist.length - 1]; if (!t) return false; if (cd > 0) { show('…', 'Дух ещё не отдышался'); return false; }
    const p = parse(t), r = render(p), aim = aimRay(), pl = planSpell(p, aim);
    if (pl.err) { show(r.ancient, pl.err); keep = true; return false; }
    const total = Math.round(pl.total), deficit = Math.max(0, total - E), hpLoss = deficit / 40, lethal = hpLoss >= (P.hp || 0);
    if (lethal && lethalAsk !== t) { lethalAsk = t; show('⚠ ' + r.ancient, `Не хватает ${fmtJ(deficit)} — магия возьмёт жизнь (−${Math.round(hpLoss)} здоровья). Ты умрёшь. Ещё раз Enter — если уверен`); return false; } lethalAsk = null;
    E = Math.max(0, E - total); cd = 0.5; if (hist[hist.length - 1] !== t) hist.push(t); hi = hist.length;
    if (deficit > 0) { P.hp -= hpLoss; flash([1, .2, .2], 6); if (P.hp <= 0) { P.hp = 0; richard.hurt(9999, P.pos.x, P.pos.y, P.pos.z); } else show(r.ancient, `Сил не хватило: −${Math.round(hpLoss)} здоровья`); }
    xp += total / 300; try { localStorage.setItem('ninja.magic.xp', String(xp)); } catch (e) {}
    if (p.trap) { traps.push({ x: aim.tgt.x, y: aim.tgt.y, z: aim.tgt.z, p, t: 90 }); puff(aim.tgt, COL.mind, 20, { spd: 4, s0: 1.4, s1: 2.5, life: 1.2, a: 0.6 }); show(r.ancient, 'Ловушка поставлена (' + fmtJ(total) + ' вложено): сработает, когда рядом окажется кто-то'); return true; }
    runActs(pl.acts); sendVis(pl.acts, aim); if (total > 500) npcs && npcs.shout && npcs.shout(P.pos.x, P.pos.z, 45, ['Колдун!', 'Магия!', 'Ой, что это?!', 'Берегись!'][Math.floor(Math.random() * 4)]);
    if (!(deficit > 0)) show(r.ancient, r.gloss + ' · ' + fmtJ(total));
    return true;
  }
  function runActs(acts) { for (const a of acts) { try { a.run(); } catch (e) { console.error('магия:', e); } } }
  function sendVis(acts, aim) { const a0 = acts.find(a => a.man || ['heal', 'shield', 'lev', 'light'].includes(a.vis)), v = a0 ? a0.vis : 'mind'; net.send({ t: 'spell', fx: [v], x: +aim.o.x.toFixed(1), y: +aim.o.y.toFixed(1), z: +aim.o.z.toFixed(1), vx: +aim.d.x.toFixed(3), vy: +aim.d.y.toFixed(3), vz: +aim.d.z.toFixed(3), size: 1, count: 1, bright: 0 }); }

  /* ───── окно заклинаний: переводчик + книга слов ───── */
  const css = document.createElement('style');
  css.textContent = `#spell{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);width:min(640px,94vw);z-index:40;font:13px/1.35 -apple-system,"Segoe UI",Roboto,sans-serif;display:none;background:rgba(18,12,34,.93);color:#efe9ff;border:2px solid #8a6cff;border-radius:14px;padding:11px 13px;box-shadow:0 8px 34px #000a}
  #spell.on{display:block} #spell h3{margin:0 0 6px;font-size:14px;color:#d6c7ff;display:flex;justify-content:space-between} #spell h3 i{font:11px ui-monospace,Menlo,monospace;opacity:.75;font-style:normal}
  #spell input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:8px 10px;border:2px solid #8a6cff;border-radius:9px;background:#fff;color:#222} #spell input.f{font-size:13px;margin-top:6px;border-color:#5a4aa8}
  #spell .pv{min-height:3.4em;max-height:30vh;overflow:auto;margin:7px 0 5px;font-size:12.5px} #spell .pv b{color:#ffd36b} #spell .pv .bad{color:#ff9a8a} #spell .pv .ok{color:#9fe3a8} #spell .pv .li{padding-left:8px;border-left:2px solid #6b55c4;margin:2px 0}
  #spell .ch{display:flex;flex-wrap:wrap;gap:4px;max-height:110px;overflow:auto;margin-top:5px}
  #spell .ch button{border:1px solid #6b55c4;background:#2a1f55;color:#efe9ff;border-radius:7px;padding:2px 7px;cursor:pointer;font:11.5px ui-monospace,Menlo,monospace} #spell .ch button:hover{background:#44339b}
  #spell small{opacity:.65;display:block;margin-top:5px}
  #manaB{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:260px;z-index:30;pointer-events:none;display:none;text-align:center;font:11px -apple-system,Segoe UI,sans-serif;color:#d6c7ff;text-shadow:0 1px 3px #000}
  #manaB i{display:block;height:8px;margin-top:3px;border-radius:5px;background:rgba(10,6,30,.65);overflow:hidden;box-shadow:0 0 0 1px #8a6cff88} #manaB i u{display:block;height:100%;width:100%;background:linear-gradient(90deg,#6a4cff,#b69cff);text-decoration:none}
  #spellToast{position:fixed;left:50%;top:20%;transform:translateX(-50%);width:min(560px,90vw);z-index:41;pointer-events:none;text-align:center;font:600 26px Georgia,serif;color:#e8dcff;text-shadow:0 0 14px #8a6cff,0 2px 4px #000;opacity:0;transition:opacity .5s} #spellToast small{display:block;font:13px -apple-system,sans-serif;color:#ffd36b;margin-top:3px;text-shadow:0 1px 3px #000}`;
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'spell';
  box.innerHTML = '<h3><span>✦ Древний язык — говори, и мир послушает</span><i></i></h3><input class="m" maxlength="120" placeholder="Stenr reisa · Brisingr · Thrautha sverd · Jierda · Letta · Waíse heill · или по-русски: «подними камень»" autocomplete="off"><div class="pv"></div><input class="f" placeholder="🔎 Поиск по словарю (796 слов): по-русски или по-древнему" autocomplete="off"><div class="ch"></div><small>Enter — произнести (пустое — повторить) · Esc — закрыть · порядок слов свободный, определение после существительного: stenr galba · néiat — запрет · weohnata — ловушка · eldrvaro (прошедшее) — ничего</small>';
  document.body.appendChild(box);
  const inp = box.querySelector('input.m'), flt = box.querySelector('input.f'), pv = box.querySelector('.pv'), chips = box.querySelector('.ch'), hdr = box.querySelector('h3 i');
  const manaB = document.createElement('div'); manaB.id = 'manaB'; manaB.innerHTML = '<span>✦ Y — заклинание</span><i><u></u></i>'; document.body.appendChild(manaB); const manaU = manaB.querySelector('u'), manaT = manaB.querySelector('span');
  const procB = document.createElement('div'); procB.style.cssText = 'position:fixed;left:50%;bottom:46px;transform:translateX(-50%);z-index:30;pointer-events:none;display:none;text-align:center;font:11.5px -apple-system,Segoe UI,sans-serif;color:#ffe9a8;text-shadow:0 1px 3px #000;max-width:90vw'; document.body.appendChild(procB);
  const toast = document.createElement('div'); toast.id = 'spellToast'; document.body.appendChild(toast); let toastT = 0;
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function showWords() {
    const f = flt.value.trim().toLowerCase().replace(/ё/g, 'е'); chips.innerHTML = '';
    const l = WORDBOOK.filter(e => !f || e.a.toLowerCase().includes(f) || e.ru.toLowerCase().replace(/ё/g, 'е').includes(f)).slice(0, f ? 90 : 70);
    for (const e of l) { const b = document.createElement('button'); b.textContent = e.a; b.style.borderColor = MKCOL[e.mark]; b.title = e.ru + ' — ' + MARK[e.mark]; b.onclick = () => { inp.value = (inp.value.trim() + ' ' + e.a).trim(); inp.focus(); refresh(); }; chips.appendChild(b); }
  }
  function refresh() {
    hdr.textContent = `сил ${Math.floor(E)}/${EMAX} Дж · КПД ${Math.round(eta() * 100)}%`;
    const t = inp.value.trim();
    if (!t) { pv.innerHTML = 'Говори <b>действие</b> и <b>вещь</b>: <b>reisa stenr</b> — поднять камень, <b>thrautha sverd</b> — бросить меч, <b>brisingr</b> — огонь, <b>jierda</b> — сломать то, на что смотришь. Цена — настоящая работа в джоулях: чем тяжелее и дальше, тем дороже. Нажми на слово ниже или найди его поиском.'; return; }
    const p = parse(t), r = render(p), aim = aimRay(), pl = planSpell(p, aim); let h = `<b>Древний:</b> ${esc(r.ancient)}<br><b>Слово в слово:</b> ${esc(r.gloss)}<br>`;
    if (pl.err) h += `<span class="bad">${esc(pl.err)}</span>`;
    else {
      for (const a of pl.acts) h += `<div class="li">${esc(a.label)} — <b>${fmtJ(a.J)}</b></div>`;
      const total = Math.round(pl.total), deficit = Math.max(0, total - E); h += `Работа ${fmtJ(pl.raw)} ÷ КПД ${Math.round(pl.eta * 100)}% = <b>${fmtJ(total)}</b> из ${Math.floor(E)} Дж`;
      if (deficit > 0) h += `<br><span class="bad">⚠ Не хватает ${fmtJ(deficit)} — заберёт здоровьем (−${Math.round(deficit / 40)})${deficit / 40 >= (P.hp || 0) ? ' — ТЫ УМРЁШЬ' : ''}</span>`; else h += ' <span class="ok">✓ сил хватает</span>';
      if (p.trap) h += '<br>⏳ Будущее время: заклинание станет ловушкой.';
      for (const n of pl.notes || []) h += `<br><span class="bad">${esc(n)}</span>`;
    }
    pv.innerHTML = h;
  }
  flt.addEventListener('input', showWords); showWords();
  function show(a, b) { toast.innerHTML = esc(a) + (b ? '<small>' + esc(b) + '</small>' : ''); toast.style.opacity = 1; toastT = 3.2; }
  const canCast = () => richard.active && !window.__dragonOn && !P.dead;
  function open() { if (!canCast()) return; if (document.pointerLockElement) document.exitPointerLock(); box.classList.add('on'); inp.value = ''; refresh(); inp.focus(); }
  function close(relock) { box.classList.remove('on'); inp.blur(); flt.blur(); if (relock && richard.active) try { renderer.domElement.requestPointerLock(); } catch (e) {} }
  inp.addEventListener('input', refresh);
  const stop = e => e.stopPropagation(); flt.addEventListener('keydown', e => { stop(e); if (e.key === 'Escape') close(true); if (e.key === 'Enter') inp.focus(); }); flt.addEventListener('keyup', stop);
  inp.addEventListener('keydown', e => {
    stop(e);
    if (e.key === 'Enter') { const ok = cast(inp.value); if (ok || (lethalAsk === null && !keep)) close(true); else refresh(); }
    else if (e.key === 'Escape') { lethalAsk = null; close(true); }
    else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; inp.value = hist[hi] || ''; refresh(); } e.preventDefault(); } else if (e.key === 'ArrowDown') { if (hi < hist.length) { hi++; inp.value = hist[hi] || ''; refresh(); } e.preventDefault(); }
  });
  inp.addEventListener('keyup', stop);
  addEventListener('keydown', e => { if (e.code === 'KeyY' && !e.repeat && !box.classList.contains('on') && !/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) { e.preventDefault(); open(); } });
  addEventListener('keydown', e => { if (e.code === 'KeyU' && !e.repeat && !/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName) && richard.active) { const n = stopProcs('all'); if (n) show('✦', 'Заклинания-процессы прекращены (' + n + ')'); } });
  net.on('spell', m => {
    if (!Array.isArray(m.fx) || ![m.x, m.y, m.z, m.vx, m.vy, m.vz].every(Number.isFinite)) return; if (Math.hypot(m.x - camera.position.x, m.z - camera.position.z) > 500) return;
    perform({ fx: m.fx, size: m.size || 1, count: m.count || 1, bright: m.bright || 0, pow: 1 }, new V(m.x, m.y, m.z), new V(m.vx, m.vy, m.vz).normalize(), false, m.id);
  });

  /* ───── кадр ───── */
  function update(dt) {
    dt = Math.min(dt, 0.1); cd = Math.max(0, cd - dt);
    const active = richard.active && !window.__dragonOn; manaB.style.display = active ? 'block' : 'none';
    if (active) {
      E = Math.min(EMAX, E + REGEN * dt * (cd > 0 ? 0.3 : 1)); manaU.style.width = (E / EMAX * 100) + '%';
      const held = items.items.filter(i => i.held); manaT.textContent = `✦ ${Math.floor(E)}/${EMAX} Дж · Y — заклинание`;
      if (box.classList.contains('on') && Math.random() < 0.04) refresh();
      { const L = [], e = eta(); let drain = 0;
        for (const it of items.items) { if (it.held) { const d = itemUp(it) / e; drain += d; L.push(`🤲 ${it.name} −${Math.round(d)}`); } else if (it.hover) { const d = itemUp(it) / e; drain += d; L.push(`⇧ ${it.name} парит −${Math.round(d)}`); } }
        if (flyOn) { const d = selfUp() / e; drain += d; L.push(`🕊 полёт −${Math.round(d)}`); } if (rooted) { const d = (P.state === 'ground' ? 25 : selfUp()) / e; drain += d; L.push(`✋ остановлен −${Math.round(d)}`); }
        if (wardJ > 0) L.push(`🛡 оберег ${Math.floor(wardJ)} Дж`); if (orbT > 0) { drain += 6 / e; L.push('✨ светлячок −' + Math.round(6 / e)); } if (rainT > 0) L.push('🌧 ливень');
        procB.style.display = L.length ? 'block' : 'none'; if (L.length) procB.textContent = 'Процессы (Дж/с): ' + L.join(' · ') + (drain ? ` · всего −${Math.round(drain)}/с` : '') + ' · U — прервать всё'; }
      if (!scatterDone) { scatter(P.pos.x, P.pos.z, 14, 20, 90); scatter(P.pos.x, P.pos.z, 10, 90, 220); scatterDone = true; }
      scT += dt; if (scT > 8) { scT = 0; let near = 0; for (const it of items.items) if (it.p.distanceTo(P.pos) < 180) near++; if (near < 12) scatter(P.pos.x, P.pos.z, 5, 40, 130); }
    }
    if (window.__dragonOn && box.classList.contains('on')) close(false);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast.style.opacity = 0; }
    partTick(dt); if (flashT > 0) { flashT = Math.max(0, flashT - dt * 4); flashL.intensity = flashI * flashT; if (flashT <= 0) flashL.intensity = 0; }
    for (let i = things.length - 1; i >= 0; i--) { const t = things[i]; t.t += dt; const k = t.t / t.life; if (k >= 1) { scene.remove(t.obj); t.obj.traverse(o => { if (o.isMesh && o.material) o.material.dispose(); }); t.end && t.end(); things.splice(i, 1); continue; } t.upd && t.upd(t, k); }
    // хватка: предмет следует за прицелом, удержание стоит энергии каждую секунду; повисшие предметы парят
    camera.getWorldDirection(_a);
    for (const it of items.items) {
      if (it.held) { const hd = it.hd || 14; _b.set(P.pos.x + _a.x * hd, P.pos.y + 6.5 + _a.y * hd, P.pos.z + _a.z * hd); it.v.set((_b.x - it.p.x) * 10, (_b.y - it.p.y) * 10, (_b.z - it.p.z) * 10); E -= itemUp(it) / eta() * dt; if (E <= 0 || P.dead || window.__dragonOn) { E = Math.max(0, E); it.held = 0; show('…', 'Сил не хватило держать ' + it.name); } }
      else if (it.hover && it.hover.t > 0) { E -= itemUp(it) / eta() * dt; if (E <= 0) { E = 0; it.hover = null; show('…', 'Сил не хватило держать ' + it.name); continue; } it.v.y = (it.hover.y - it.p.y) * 4; it.v.x *= 1 - Math.min(1, dt * 1.5); it.v.z *= 1 - Math.min(1, dt * 1.5); }
      else if (it.hover) it.hover = null;
      if (it.pin > 0) { it.pin -= dt; it.v.set(0, 0, 0); }
    }
    items.step(dt, env);
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.t += dt; let dead = b.t > 3.2; const steps = Math.max(1, Math.ceil(b.v.length() * dt / 1.6)), sdt = dt / steps;
      for (let s = 0; s < steps && !dead; s++) {
        b.v.y -= b.g * sdt; b.p.addScaledVector(b.v, sdt);
        const h = hAt(b.p.x, b.p.z);
        if (b.p.y < Math.max(h, 0.2) || (world.treeTopAt && world.treeTopAt(b.p.x, b.p.z, 1) > b.p.y) || solidAt(b.p.x, b.p.y, b.p.z) || (b.t > 0.12 && bodies().some(x => Math.hypot(x.x - b.p.x, x.z - b.p.z) < 2.6 && b.p.y > x.y - 1 && b.p.y < x.y + 10))) { impact(b); dead = true; }
      }
      const m = b.spec.main, big = b.spec.size;
      spawn(b.p.x + rnd(-.4, .4), b.p.y + rnd(-.4, .4), b.p.z + rnd(-.4, .4), -b.v.x * 0.08, -b.v.y * 0.08 + (m === 'fire' ? 2 : 0), -b.v.z * 0.08, b.c, 2.2 * big, 0.5, rnd(0.25, 0.5), 0.9, m === 'fire' ? -3 : 6, 1.5);
      if (dead) bolts.splice(i, 1);
    }
    if (boostW > 0) { boostW -= dt; if (boostW <= 0 || P.state !== 'ground') { window.__g && window.__g.release('Space'); if (boostV) { P.vel.y = boostV; boostV = 0; } boostW = 0; } }
    if (flyOn && !P.dead) {      // процесс: полёт держится, пока хватает сил
      flyT += dt; E -= selfUp() / eta() * dt; if (E <= 0) { E = 0; flyOn = false; show('…', 'Сил не хватило держаться в воздухе'); }
      else if (P.state !== 'ground' && P.state !== 'dead') { if (flyT > 0.9) P.vel.y += (Math.sin(performance.now() / 350) * 1.5 - P.vel.y) * Math.min(1, dt * 5); if (Math.random() < 0.5) spawn(P.pos.x + rnd(-1.5, 1.5), P.pos.y + 0.3, P.pos.z + rnd(-1.5, 1.5), 0, -6, 0, COL.lev, 1.2, 0.3, 0.6, 0.6, 0, 0.5); }
    }
    if (rooted && !P.dead) {      // процесс: «остановлен» — ни шагу, ни падения, пока держится заклинание
      const air = P.state !== 'ground'; E -= (air ? selfUp() : 25) / eta() * dt; if (E <= 0) { E = 0; rooted = null; show('…', 'Сил не хватило удерживать себя'); }
      else { P.pos.x = rooted.x; P.pos.z = rooted.z; if (air) P.pos.y = rooted.y; P.vel.set(0, 0, 0); if (Math.random() < 0.3) spawn(P.pos.x + rnd(-2, 2), P.pos.y + rnd(1, 8), P.pos.z + rnd(-2, 2), 0, 1, 0, COL.mind, 1, 0.2, 0.6, 0.4, 0, 0.5); }
    }
    // оберег: удары по магу съедают его энергию (1 здоровья = 40 Дж), пока она не кончится
    if (P.hp < lastHp - 0.01 && wardJ > 0 && !P.dead) { const dmg = lastHp - P.hp, ab = Math.min(dmg, wardJ / 40); P.hp += ab; wardJ -= ab * 40; puff(new V(P.pos.x, P.pos.y + 5, P.pos.z), COL.shield, 12, { spd: 8, s0: 1.2, s1: 2.5, life: 0.4 }); flash(COL.shield, 6); }
    lastHp = P.hp;
    if (wardJ > 0) { if (bubble) { bubble.position.set(P.pos.x, P.pos.y + 5, P.pos.z); bubble.material.opacity = Math.min(0.3, 0.1 + wardJ / 4000) + 0.05 * Math.sin(performance.now() / 120); } } else if (bubble) { scene.remove(bubble); bubble.material.dispose(); bubble = null; }
    if (orbT > 0) { orbT -= dt; E -= 6 / eta() * dt; if (E <= 0) { E = 0; orbT = 0; } const tm = performance.now() / 1000; if (!orb) { orb = new THREE.Mesh(gSph, mkMat([1, .95, .7], 0.95)); orb.scale.setScalar(0.8); orb.renderOrder = 32; scene.add(orb); } if (orbBind && items.items.includes(orbBind)) orb.position.set(orbBind.p.x, orbBind.p.y + 2, orbBind.p.z); else orb.position.set(P.pos.x + Math.cos(tm * 1.3) * 4, P.pos.y + 11 + Math.sin(tm * 2) * 0.8, P.pos.z + Math.sin(tm * 1.3) * 4); orbL.position.copy(orb.position); orbL.intensity = 3.4; if (Math.random() < 0.4) spawn(orb.position.x, orb.position.y, orb.position.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), COL.light, 1.6, 0.2, 0.7, 0.5, 0, 0.5); if (orbT <= 0) { orbL.intensity = 0; scene.remove(orb); orb.material.dispose(); orb = null; } }
    else if (orb) { orbL.intensity = 0; scene.remove(orb); orb.material.dispose(); orb = null; }
    // ливень
    if (rainT > 0) { rainT -= dt; const cx = camera.position.x, cz = camera.position.z; for (let k = 0; k < 16; k++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * 55; spawn(cx + Math.cos(a) * d, camera.position.y + 40, cz + Math.sin(a) * d, 0, -70, 0, [.55, .72, 1], 0.5, 0.3, 0.75, 0.45, 0, 0); } if (dragons && Math.random() < dt * 0.6) dragons.wet(P.pos.x, P.pos.z, 80, 10); for (const it of items.items) if (it.p.distanceTo(P.pos) < 90) it.wet = 1; }
    // ловушки
    for (let i = traps.length - 1; i >= 0; i--) { const tr = traps[i]; tr.t -= dt; if (tr.t <= 0) { traps.splice(i, 1); continue; } if (Math.random() < 0.3) spawn(tr.x + rnd(-2, 2), tr.y + 0.5, tr.z + rnd(-2, 2), 0, rnd(2, 5), 0, COL.mind, 1.2, 0.2, 0.8, 0.5, 0, 0.5);
      const hit = bodies().find(b => Math.hypot(b.x - tr.x, b.z - tr.z) < 7 && Math.abs(b.y - tr.y) < 12); if (hit) { traps.splice(i, 1); const pt = new V(tr.x, tr.y, tr.z), aimT = { o: new V(tr.x, tr.y + 7, tr.z), d: new V(0, -1, 0), tgt: pt, hit: true }, pl = planSpell(tr.p, aimT); flash(COL.mind, 10); ring(pt, COL.mind, 8, 0.4); if (!pl.err) runActs(pl.acts); } }
  }
  return { update, cast, open, get energy() { return E; }, set energy(v) { E = v; }, items };
}
