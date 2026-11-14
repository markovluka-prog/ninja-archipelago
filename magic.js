// magic.js — магия Древнего языка по законам «Эрагона». Здесь НЕТ списка заклинаний. Фраза разбирается как предложение (ancient.js): глагол — что сделать, существительное — над чем.
//   • Мир подчиняется смыслу слова: reisa stenr — поднять камень; thrautha sverd — бросить меч; jierda — сломать то, на что смотришь; letta — остановить; brisingr traevam — поджечь дерево.
//   • Энергия берётся у мага и равна работе, которую пришлось бы совершить руками: поднять 60 кг на метр — 590 Дж, разогнать камень — ½mv². Всё делится на КПД (растёт с опытом).
//   • Не хватает сил — заклинание всё равно сбывается, но недостающее забирается у тебя самого: здоровьем. Можно умереть.
//   • Материя не берётся из ничего (aldanarí — «творить» — стоит ~250 Дж на килограмм); магия двигает, греет, ломает и меняет то, что уже есть. Предметы (items.js) — настоящие тела.
//   • Щит (vardi) копит энергию и гасит удары, пока она не кончится. Будущее время (weohnata) — ловушка: срабатывает, когда рядом кто-то окажется. Néiat — запрет.
//   • Мир живёт сам: огонь ползёт по ветру, вода тушит и мочит землю, дерево горит, металл раскаляется, лёд тает, дождь гасит пожары.
import { parse, render, WORDBOOK, MARK, VERB, NOUN, PRON } from './ancient.js';
// виды животных по слову (чтобы «hestr» — только лошадь)
const SPECIES = { hestr: ['horse'], kattr: ['cat'], hrafn: ['raven'], fugl: ['raven'], 'örn': ['raven'], fiskr: ['fish'], naut: ['cow'], sauhdr: ['sheep'], geit: ['goat'], 'hjörtr': ['deer'], garm: ['dog'], nattgarm: ['dog'], blodhgarm: ['dog'] };
import { createItems, KIND, MAT, U, matchesMat } from './items.js';
import { createBodies } from './bodies.js';

const COL = { fire: [1, .5, .15], water: [.3, .65, 1], wind: [.85, 1, .95], ice: [.7, .92, 1], bolt: [.82, .86, 1], light: [1, .93, .6], stone: [.72, .64, .5], heal: [.5, 1, .6], shield: [.4, .8, 1], lev: [.8, .7, 1], steam: [.9, .92, .95], mind: [.75, .55, 1], ash: [.35, .33, .32], shadow: [.45, .3, .65], mist: [.8, .85, .9] };
const EMAX = 3000, REGEN = 28, PMASS = 75, G0 = 9.8;
const MKCOL = ['#b9f0c0', '#ffe08a', '#9fd4ff', '#ff9a8a'];

export function createMagic({ THREE, scene, world, richard, net, camera, renderer, npcs, animals, dragons }) {
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
  let cloakOn = false, wardJ = 0, flyOn = false, flyT = 0, flyY = 0, rooted = null, orbT = 0, boostV = 0, boostW = 0, bubble = null, orb = null, lastHp = P.hp, sprintT = 0; const traps = [];
  let cloakShade = 1; const cloakUp = () => 40;      // Дж/с на поддержание невидимости (без КПД)
  const cloakOrig = new Map();
  function setCloak(on, shade) {      // невидимость: у других игроков фигура скрыта (сообщение 'spell'), у себя — полупрозрачная
    if (on === cloakOn) return; cloakOn = on; if (shade) cloakShade = shade;
    if (richard.setVisible) richard.setVisible(!on);      // штатное скрытие героя (работает для Ричарда и клонов Соколина, Бэна…): своей фигуры не видно, другим — тоже (сообщение cloak)
    else { const fig = richard.visibleFigure || richard.figure; if (fig) fig.traverse(o => { if (!o.isMesh || !o.material) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (on) { if (!cloakOrig.has(m)) cloakOrig.set(m, { t: m.transparent, o: m.opacity, d: m.depthWrite }); m.transparent = true; m.opacity = 0.22; m.depthWrite = false; } else { const q0 = cloakOrig.get(m); if (q0) { m.transparent = q0.t; m.opacity = q0.o; m.depthWrite = q0.d; cloakOrig.delete(m); } } m.needsUpdate = true; } }); }
    net.send({ t: 'spell', fx: [on ? 'cloak' : 'uncloak'], x: 0, y: 0, z: 0, vx: 0, vy: 1, vz: 0, size: 1, count: 1, bright: 0 });
    if (on) puff(new V(P.pos.x, P.pos.y + 5, P.pos.z), COL.shadow, 30, { spd: 6, s0: 2, s1: 5, life: 1, a: 0.5 });
  }
  const selfUp = () => PMASS * G0 * 0.05 * U * 6;      // Дж/с, чтобы держать себя в воздухе
  const itemUp = it => it.m * G0 * 0.35 * U * 6;      // Дж/с, чтобы держать предмет против тяжести
  function procCount(scope) { let n = 0; if (scope === 'all') n += hidden.size; if (scope !== 'items') { if (rooted) n++; if (flyOn) n++; if (cloakOn) n++; } if (scope === 'all') { if (wardJ > 0) n++; if (orbT > 0) n++; if (rainT > 0) n++; } if (scope !== 'self') for (const it of items.items) if (it.held || it.hover || it.pin > 0) n++; for (const d of procs) if (scope === 'all' || d.tag === scope) n++; return n; }
  function stopProcs(scope) { const n = procCount(scope); if (scope !== 'self') B.releaseAll(); if (scope === 'all') { for (const b of [...hidden]) b.hide(false); hidden.clear(); } if (scope !== 'items') { rooted = null; flyOn = false; setCloak(false); } if (scope === 'all') { wardJ = 0; orbT = 0; rainT = 0; } if (scope !== 'self') for (const it of items.items) { it.held = 0; it.hover = null; it.pin = 0; } for (const d of procs.slice()) if (scope === 'all' || d.tag === scope) endProc(d, 'stopped'); return n; }
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
    const r = { elems: [], mats: [], kinds: [], flora: [], structs: [], parts: [], creatures: [], cre: [], pron: [], num: 0, abs: [] };
    for (const t of np) {
      if (t.role === 'Q') { r.num = Math.max(r.num, t.num); continue; }
      if (t.role === 'R') { r.pron.push(PRON[t.a] || t.a); continue; }
      if (t.role !== 'N' && t.role !== 'A') continue;
      const s = NOUN[t.a]; if (!s) { if (t.e.theme === 'ppl') { r.creatures.push(t.a); r.cre.push({ a: t.a, th: 'ppl' }); } else if (t.e.theme === 'ani') { r.creatures.push(t.a); r.cre.push({ a: t.a, th: 'ani' }); } else if (t.e.theme === 'bod') r.parts.push(t.a); else r.abs.push(t.a); continue; }
      const [k, id] = s; if (k === 'elem' || k === 'wea') r.elems.push(id); else if (k === 'mat') r.mats.push(id); else if (k === 'item') r.kinds.push(id); else if (k === 'flora') r.flora.push(id); else if (k === 'struct') r.structs.push(id); else if (k === 'part') r.parts.push(id);
    }
    return r;
  }
  /* ───── объекты, которые уже стоят в мире (камни, бочки, брёвна, деревья…): магия берёт их, как свои предметы ───── */
  const WCLS = [      // [id объекта, название, материал, виды (что в заклинании их называет), доля заполнения объёма]
    [/^(rock_small|rock_flat|rock_sharp|pebbles_pile|stone_cairn)/, 'камень', 'stone', ['stone'], 0.5], [/^(rock_medium|rock_mossy)/, 'валун', 'stone', ['stone', 'boulder'], 0.5], [/^rock_large/, 'огромный валун', 'stone', ['boulder', 'stone'], 0.5],
    [/^statue/, 'статуя', 'stone', [], 0.45], [/^grave/, 'надгробие', 'stone', [], 0.5], [/^(lantern_stone|fence_stone|hearth)/, 'каменная вещь', 'stone', [], 0.4],
    [/^(stump|log_fallen)/, 'бревно', 'wood', ['stick'], 0.5], [/^chest/, 'сундук', 'wood', ['chest'], 0.35], [/^crate/, 'ящик', 'wood', [], 0.25], [/^barrel/, 'бочка', 'wood', [], 0.3], [/^planks/, 'доски', 'wood', ['stick'], 0.5],
    [/^sack/, 'мешок', 'cloth', [], 0.6], [/^rope_coil/, 'бухта каната', 'cloth', [], 0.4], [/^(bucket|watering)/, 'ведро', 'wood', [], 0.1],
    [/^(table|bench|chair|bed|wardrobe|shelf|ladder_wood|cart|wheelbarrow|fence_(picket|wattle|bamboo)|sign_|lamp_post|campfire_logs)/, '', 'wood', [], 0.25],
    [/^(anchor|cannon_ship|harpoon)/, '', 'metal', [], 0.2], [/^(fir|palm|oak|birch|willow)/, 'дерево', 'wood', ['tree'], 0.04], [/^(bush|fern)/, 'куст', 'leaf', [], 0.06],
  ];
  const RUID = { table: 'стол', bench: 'скамья', chair: 'стул', bed: 'кровать', wardrobe: 'шкаф', shelf: 'полка', ladder: 'лестница', cart: 'тележка', wheelbarrow: 'тачка', fence: 'забор', sign: 'указатель', lamp: 'фонарь', campfire: 'костёр', anchor: 'якорь', cannon: 'пушка', harpoon: 'гарпунная пушка' };
  const clsCache = new Map();
  function classifyWorld(id) { if (clsCache.has(id)) return clsCache.get(id); let r = null; for (const [re, name, mat, kinds, fill] of WCLS) if (re.test(id)) { r = { name: name || RUID[id.split('_')[0]] || 'вещь', mat, kinds, fill }; break; } clsCache.set(id, r); return r; }
  function matchWorld(cls, info) {
    if (!info.kinds.length && !info.mats.length && !info.flora.length) return true;
    return info.kinds.some(k => cls.kinds.includes(k)) || info.mats.some(m => m === cls.mat || (m === 'metal' && (cls.mat === 'silver' || cls.mat === 'gold'))) || (info.flora.includes('tree') && cls.kinds.includes('tree')) || (info.flora.includes('plant') && cls.mat === 'leaf');
  }
  function proxyFor(rec, cls) {      // «спящий» предмет по объекту мира: масса — объём × доля заполнения × плотность материала
    if (rec.proxy) return rec.proxy; const v = rec.v, s2 = rec.s, sz = { x: v.size.x * s2, y: (v.bb.max.y - v.bb.min.y) * s2, z: v.size.z * s2 };
    const m = Math.max(0.3, Math.min(20000, sz.x * sz.y * sz.z * U * U * U * cls.fill * MAT[cls.mat].rho));
    rec.proxy = items.makeWorld(rec, world.partsOf(rec), { name: cls.name, mat: cls.mat, m, size: sz }); rec.proxy.tags = cls.kinds; return rec.proxy;
  }
  function wake(it) {      // заклинание коснулось объекта мира: он отрывается от мира и становится телом
    if (!it.dormant) return; const rec = it.rec; world.detachPlaced(rec);
    if (rec.box) { const i = richard.solids.indexOf(rec.box.solidRef); if (i >= 0) richard.solids.splice(i, 1); const j = world.solidBoxes.indexOf(rec.box); if (j >= 0) world.solidBoxes.splice(j, 1); }
    items.activate(it); puff(it.p, [.6, .55, .45], 8, { spd: 4, s0: 1.5, s1: 4, life: 0.7, a: 0.4 });
  }
  const wakeAll = set => { if (set) for (const it of set) if (it.dormant) wake(it); };
  let curPicks = null;
  function pickItems(info, aim, n, preferHeld) {
    const named = info.kinds.length || info.mats.length || info.flora.length, filt = it => !named || info.kinds.includes(it.kind) || info.mats.some(m => matchesMat(it, m)) || (info.flora.includes('plant') && (it.kind === 'leaf' || it.kind === 'feather')) || (it.tags && it.tags.length && matchWorld({ kinds: it.tags, mat: it.mat }, info));
    const c = items.items.filter(it => filt(it) && it.p.distanceTo(P.pos) < 140);
    if (world.placedNear) world.placedNear(aim.tgt.x, aim.tgt.z, 30, rec => { if (Math.hypot(rec.x - P.pos.x, rec.z - P.pos.z) > 140) return; const cls = classifyWorld(rec.id); if (!cls || !matchWorld(cls, info)) return; const pr = proxyFor(rec, cls); if (pr) c.push(pr); });
    const scored = c.map(it => { const dd = distRay(it.p, aim.o, aim.d), dp = it.p.distanceTo(aim.tgt); return { it, s: Math.min(dd.perp + dd.along * 0.02, dp * 0.6 + 8), ok: (dd.along > 0 && dd.perp < 10 + dd.along * 0.3) || dp < 22, held: it.held }; }).filter(x => x.ok);
    scored.sort((a, b) => (preferHeld ? (b.held - a.held) : 0) || a.s - b.s);
    const out = scored.slice(0, n).map(x => x.it); if (curPicks) for (const it of out) if (it.dormant) curPicks.add(it);
    return out;
  }
  function pickBodies(aim, R) { const near = bodies().filter(b => Math.hypot(b.x - aim.tgt.x, b.z - aim.tgt.z) < R || (() => { const dd = distRay(_b.set(b.x, b.y + 4, b.z), aim.o, aim.d); return dd.along < 90 && dd.perp < 6; })()); near.sort((a, b) => Math.hypot(a.x - aim.tgt.x, a.z - aim.tgt.z) - Math.hypot(b.x - aim.tgt.x, b.z - aim.tgt.z)); return near; }
  function pickFlora(aim, R, kinds) { const out = []; if (world.flamNear) world.flamNear(aim.tgt.x, aim.tgt.z, R, o => { if (Math.hypot(o.x - aim.tgt.x, o.z - aim.tgt.z) < R + o.r && (!kinds || kinds.includes(o.k) || (kinds.includes('structs') && o.k === 'house'))) out.push(o); }); out.sort((a, b) => Math.hypot(a.x - aim.tgt.x, a.z - aim.tgt.z) - Math.hypot(b.x - aim.tgt.x, b.z - aim.tgt.z)); return out; }
  const sizeM = p => p.mods.size * p.mods.pow;
  const IGN = { wood: 700, organic: 220, leaf: 90, feather: 60, cloth: 320 };

  /* ───── процессы: любое заклинание — поток энергии, а не щелчок ─────
     У мага есть мощность (Дж/с): столько энергии он способен пропустить через заклинание. Процесс берёт её каждый кадр, платит из запаса (с учётом КПД)
     и совершает работу в мире: поднимает, разгоняет, греет, ломает, лечит. Цель достигнута (набралась нужная работа) — процесс кончается; не достигнута —
     идёт, пока хватает сил. Тяжёлое двигается медленно — мощность та же. Прервать: losna / клавиша U. Не хватает энергии — процесс гаснет (если не «вопреки смерти»). */
  const procs = []; let pid = 0, deadlyNext = false;
  const POW = () => 240 + 160 * (1 - Math.exp(-xp / 20));      // мощность мага, Дж/с (растёт с опытом)
  const SPEC_HEAT = { stone: 800, wood: 1700, metal: 450, silver: 235, gold: 129, organic: 3500, leaf: 1500, feather: 1500, cloth: 1400, ice: 2100 };
  function addProc(d) { d.got = 0; d.t = 0; d.id = ++pid; if (d.J === undefined) d.J = Infinity; if (d.P === undefined) d.P = POW(); d.deadly = deadlyNext; procs.push(d); return d; }
  function endProc(d, why) { const i = procs.indexOf(d); if (i < 0) return; procs.splice(i, 1); try { d.end && d.end(why, d); } catch (e) { console.error('магия:', e); } }
  function die() { P.hp = 0; richard.hurt(9999, P.pos.x, P.pos.y, P.pos.z); }
  function procTick(dt) {
    const e = eta();
    for (let i = procs.length - 1; i >= 0; i--) {
      const d = procs[i]; if (!procs.includes(d)) continue; d.t += dt;
      let want = Math.min(d.P * dt, d.J - d.got); if (want <= 1e-6) { endProc(d, 'done'); continue; }
      let pay = want / e;
      if (E < pay) {
        if (d.deadly && P.hp > 0 && P.hp < 15) { E = 0; endProc(d, 'drain'); show('…', 'Инстинкт самосохранения: заклинание прервано, здоровья почти не осталось'); continue; }
        if (d.deadly && P.hp > 0) { const miss = pay - E; P.hp -= miss / 40; E = 0; flash([1, .2, .2], 4); if (P.hp <= 0) { die(); endProc(d, 'dead'); continue; } pay = 0; }
        else { want = Math.max(0, E * e); pay = E; if (want <= 0.01) { E = 0; endProc(d, 'drain'); show('…', 'Сил не хватило: ' + d.name); continue; } }
      }
      E = Math.max(0, E - pay); xp += pay / 300; d.got += want;
      let fin = false; try { fin = d.step ? d.step(want, dt, d) : false; } catch (er) { console.error('магия:', er); fin = true; }
      if (fin || d.got >= d.J - 1e-6) endProc(d, 'done');
    }
  }
  function streamStep(elem, spec, P0) {      // непрерывный поток стихии: огонь, вода, лёд, ветер — по живому прицелу, пока идёт энергия
    return (raw, dt, d) => {
      const a = aimRay(), hit = rayHit(a.o, a.d, 75), pt = hit ? hit.p : a.o.clone().addScaledVector(a.d, 75), sz = spec.size, pw = spec.pow || 1;
      d.k = (d.k || 0) + dt; d.n = (d.n || 0) + dt;
      if (elem === 'fire') for (let k = 0; k < 10; k++) { const s = rnd(2, 9); spawn(a.o.x + a.d.x * s, a.o.y + a.d.y * s, a.o.z + a.d.z * s, a.d.x * rnd(40, 70) + rnd(-5, 5), a.d.y * rnd(40, 70) + rnd(-3, 5), a.d.z * rnd(40, 70) + rnd(-5, 5), k % 3 ? COL.fire : [1, .85, .4], 1.6 * sz, 4 * sz, rnd(0.35, 0.6), 0.75, -2, 1); }
      else if (elem === 'water') for (let k = 0; k < 10; k++) { const s = rnd(2, 6); spawn(a.o.x + a.d.x * s, a.o.y + a.d.y * s, a.o.z + a.d.z * s, a.d.x * rnd(60, 90), a.d.y * rnd(60, 90) + 3, a.d.z * rnd(60, 90), COL.water, 1.3 * sz, 1.8, rnd(0.4, 0.7), 0.7, 14, 0.3); }
      else if (elem === 'ice') for (let k = 0; k < 8; k++) { const s = rnd(2, 8); spawn(a.o.x + a.d.x * s, a.o.y + a.d.y * s, a.o.z + a.d.z * s, a.d.x * rnd(50, 80), a.d.y * rnd(50, 80), a.d.z * rnd(50, 80), COL.ice, 1.3 * sz, 0.6, rnd(0.4, 0.7), 0.75, 4, 0.8); }
      if (d.k > 0.2) {
        d.k = 0; const R = (elem === 'fire' ? 5 : elem === 'water' ? 8 : 5) * sz;
        if (elem === 'fire') { dragons && dragons.ignite(pt.x, pt.y, pt.z, R); puff(pt, COL.fire, 6, { spd: 7, s0: 1.4, s1: 3, life: 0.5, up: 5, grav: -3 }); flash(COL.fire, 5); areaHurt(pt, R, 6 * pw, 'spell'); npcs && npcs.hitAt && npcs.hitAt(pt.x, pt.z, R, false); for (const it of items.items) if (it.p.distanceTo(pt) < R + it.r && !it.wet) it.T += raw * 7 / Math.max(0.05, it.m * (SPEC_HEAT[it.mat] || 1000) * HS); }
        else if (elem === 'water') { const n = dragons ? dragons.wet(pt.x, pt.z, R, 25) : 0; if (n) steam(pt, 6); puff(pt, COL.water, 6, { spd: 8, s0: 1.2, s1: 2.5, life: 0.6, up: 6, grav: 18 }); for (const it of items.items) if (it.p.distanceTo(pt) < R + it.r) { it.wet = 1; it.T = Math.min(it.T, 30); it.v.addScaledVector(a.d, 22 / Math.max(0.5, it.m ** 0.5)); } areaHurt(pt, R, 2 * pw, 'spell'); }
        else if (elem === 'ice') { if (d.n > 0.8) { d.n = 0; frost(pt, 4 * sz, sz); } dragons && dragons.extinguish(pt.x, pt.y, pt.z, R); puff(pt, COL.ice, 5, { spd: 6, s0: 1, s1: 2, life: 0.6 }); for (const it of items.items) if (it.p.distanceTo(pt) < R) it.T = Math.min(it.T, -10); areaHurt(pt, R, 5 * pw, 'spell_ice'); npcs && npcs.hitAt && npcs.hitAt(pt.x, pt.z, R, false); }
        net.send({ t: 'spell', fx: [elem], x: +a.o.x.toFixed(1), y: +a.o.y.toFixed(1), z: +a.o.z.toFixed(1), vx: +a.d.x.toFixed(3), vy: +a.d.y.toFixed(3), vz: +a.d.z.toFixed(3), size: spec.size, count: 1, bright: 0 });
      }
      if (elem === 'wind') { if (d.k > 0.35) { d.k = 0; gust({ ...spec, size: sz * 0.7 }, a.o, a.d, true); } }
      return false;
    };
  }
  const afflictProc = (label, bs, kind, sec, perSec, tag) => { const n = Math.min(3, bs.length); addProc({ name: label, J: perSec * n * sec, P: perSec * n, tag: tag || 'other', step(raw, dt, d) { d.k2 = (d.k2 || 0) + dt; if (d.k2 > 0.5) { d.k2 = 0; for (const b of bs.slice(0, 3)) npcs && npcs.afflict && npcs.afflict(b.x, b.z, 2.5, kind, kind === 'sleep' ? 1.8 : 1.0); puff(new V(bs[0].x, bs[0].y + 5, bs[0].z), COL.mind, 3, { spd: 3, s0: 1, s1: 2, life: 0.7, up: 4, a: 0.5 }); } } }); };

  /* ───── единый слой тел: любая цель — Body (bodies.js); магия не знает, что перед ней ───── */
  const heatDT = (it, raw) => raw / Math.max(0.05, it.m * (SPEC_HEAT[it.mat] || 1000) * HS);
  const B = createBodies({ THREE, world, richard, net, npcs, animals, dragons, items, heatDT });
  const _sp = new V(), hidden = new Set();      // тела, скрытые заклинанием (держатся, пока идёт энергия)
  const selfBody = {
    kind: 'self', raw: P, alive: true, movable: true, name: 'ты', mass: PMASS, r: 1.4, get p() { return _sp.set(P.pos.x, P.pos.y + 4, P.pos.z); }, get vel() { return P.vel; }, speed: () => Math.hypot(P.vel.x, P.vel.y, P.vel.z),
    lift(dy) { if (!flyOn) { flyOn = true; flyT = 0; rooted = null; flyY = P.pos.y + 0.5; if (P.state === 'ground') boost(18); } flyY += dy; return true; },
    setVel(dir, v) { flyOn = false; rooted = null; P.vel.x = dir.x * v; P.vel.z = dir.z * v; if (dir.y > 0.15) { if (P.state === 'ground') boost(dir.y * v); else P.vel.y = dir.y * v; } else if (dir.y < -0.15 && P.state !== 'ground') P.vel.y = dir.y * v; return true; },
    damp(f) { P.vel.multiplyScalar(f); return true; }, hold() { rooted = P.pos.clone(); flyOn = false; return true; }, release() { rooted = null; flyOn = false; return true; },
    hide(on) { setCloak(on); return true; }, isHidden: () => cloakOn,
    hurt(dmg) { P.hp -= dmg; flash([1, .3, .2], 4); if (P.hp <= 0) die(); return true; }, bind() { rooted = P.pos.clone(); flyOn = false; return true; }, sleep() { return false; }, wake() { return true; },
    heal(hp) { P.hp = Math.min(P.hpMax || 100, (P.hp || 0) + hp); return true; }, say: () => false, heat(raw) { if (raw > 0) P.hp -= raw / 400; return true; }, douse() { return true; }, freeze() { rooted = P.pos.clone(); return true; },
  };
  const bodyMassEff = b => b.kind === 'self' ? b.mass * 0.12 : b.mass;      // маг парит «на магической подушке»: расчётная масса в 8 раз меньше
  const NOMOVE = { house: 'постройка вросла в землю', tree: 'дерево нельзя сдвинуть, пока оно растёт в земле (его можно оторвать и поднять как предмет — назови материал: stenr, ekar)', plant: 'растение держится корнями', player: 'чужой разум не поддаётся: сдвинуть игрока магией нельзя', enemy: 'враг арены не двигается магией (его можно ранить и оглушить)' };
  function resolveBodies(info, aim, n, mode) {
    const out = [], selfT = info.pron.includes('self'), anyPron = info.pron.some(x => x !== 'self'), named = info.kinds.length || info.mats.length;
    const bare = !named && !info.flora.length && !info.structs.length && !info.creatures.length && !info.parts.length && !info.pron.length;
    if (selfT) out.push(selfBody);
    if (!selfT || anyPron) {
      const cand = [];
      if (named || anyPron || bare || info.flora.length) for (const it of pickItems(info, aim, 6, true)) cand.push(B.ofItem(it));
      if (info.creatures.length || info.parts.length || anyPron || bare) {
        let cs = B.creaturesNear(aim.tgt.x, aim.tgt.z, 12); const wantAni = info.cre.some(c => c.th === 'ani'), wantPpl = info.cre.some(c => c.th === 'ppl');      // «hestr» — животное, «dvergr» — человек; вид животного по слову
        if (wantAni && !wantPpl) { cs = cs.filter(b => b.kind === 'animal'); const sp = info.cre.filter(c => c.th === 'ani' && SPECIES[c.a]).flatMap(c => SPECIES[c.a]); if (sp.length) cs = cs.filter(b => sp.includes(b.raw.sp)); } else if (wantPpl && !wantAni) cs = cs.filter(b => b.kind !== 'animal');
        for (const b of cs) cand.push(b);
      }
      if (info.flora.length || info.structs.length || anyPron || bare) for (const b of B.floraNear(aim.tgt.x, aim.tgt.z, 10, info.structs.length ? ['house'] : info.flora.length ? ['tree', 'plant'] : null)) cand.push(b);
      const recsF = new Set(cand.filter(b => b.kind !== 'item' && b.raw && b.raw.rec).map(b => b.raw.rec)), recsI = new Set(cand.filter(b => b.kind === 'item' && b.raw.dormant).map(b => b.raw.rec));
      const list = cand.filter(b => mode === 'move' ? !(b.kind !== 'item' && b.raw && b.raw.rec && recsI.has(b.raw.rec)) : !(b.kind === 'item' && b.raw.dormant && recsF.has(b.raw.rec)));      // «двигать/ломать» — через предмет-двойник дерева; «жечь/скрыть» — само дерево на месте
      list.sort((a, b) => ((b.raw && b.raw.held ? 1 : 0) - (a.raw && a.raw.held ? 1 : 0)) || a.p.distanceTo(aim.tgt) - b.p.distanceTo(aim.tgt));
      const seen = new Set(); for (const b of list) { if (seen.has(b)) continue; seen.add(b); out.push(b); if (out.length >= n + (selfT ? 1 : 0)) break; }
    }
    return out;
  }
  const describe = b => b.name + (b.kind === 'item' || b.kind === 'npc' || b.kind === 'animal' || b.kind === 'self' ? ` (${b.mass >= 10 ? Math.round(b.mass) : b.mass.toFixed(1)} кг)` : '');
  const bindProc = (label, bs, kind, sec, perSec, tag) => { const L2 = bs.filter(b => b.bind), n = Math.min(3, L2.length); if (!n) return null; return addProc({ name: label, J: perSec * n * sec, P: perSec * n, tag: tag || 'other', step(raw, dt, d) { d.k2 = (d.k2 || 0) + dt; if (d.k2 > 0.5) { d.k2 = 0; for (const b of L2.slice(0, 3)) { if (kind === 'sleep' && b.sleep) b.sleep(1.8); else b.bind(1.0); } puff(L2[0].p, COL.mind, 3, { spd: 3, s0: 1, s1: 2, life: 0.7, up: 4, a: 0.5 }); } }, end() { } }); };
  const hideBody = (b, on) => { if (!b.hide) return false; b.hide(on); if (on) hidden.add(b); else hidden.delete(b); return true; };
  const refuseFor = (b, act) => NOMOVE[b.kind] || ('«' + b.name + '» так не двигается');

  function planClause(cl, p, aim) {
    const info = npInfo(cl.np), act = cl.verb ? (cl.act || VERB[cl.verb]) : null, M = p.mods, sz = sizeM(p), L = [], n = Math.max(1, info.num || (p.count > 1 && p.count !== info.num ? p.count : 1));
    const picks = curPicks, A = (label, J, run, vis, inst) => L.push({ label, J, run: () => { wakeAll(picks); run(); }, vis, inst });
    const elem = info.elems[0], objectsNamed = info.kinds.length || info.mats.length || info.pron.length || info.flora.length || info.structs.length || info.creatures.length || info.parts.length;
    const selfT = info.pron.includes('self'), heldItems = items.items.filter(i => i.held);
    const bareHeld = !objectsNamed && !elem;
    const T = (J, P_) => `~${Math.max(0.1, J / (P_ || POW())).toFixed(1)} с`;
    const mv = () => { const bs = bareHeld && heldItems.length ? heldItems.slice(0, n).map(B.ofItem) : resolveBodies(info, aim, n, 'move'); return { ok: bs.filter(b => b.movable), no: bs.filter(b => !b.movable) }; };
    const none = (r, what) => r.no.length ? { err: refuseFor(r.no[0]) } : { err: what };
    if (p.neg && cl.verb) { const e = elem; A(`запрет «${cl.verb}»` + (e ? ' — ' + e : ''), 350 * sz, () => { if (e === 'fire' && dragons) { dragons.wet(aim.tgt.x, aim.tgt.z, 22 * sz, 40); puff(aim.tgt, COL.water, 20, { spd: 8, up: 5, grav: 8 }); } else { for (const b of B.creaturesNear(aim.tgt.x, aim.tgt.z, 12)) b.bind && b.bind(3); } }, 'mind', true); return { acts: L }; }
    if (p.neg && elem === 'fire') { A('запрет огня: земля становится сырой', 350 * sz, () => dragons && dragons.wet(aim.tgt.x, aim.tgt.z, 22 * sz, 40), 'mind', true); return { acts: L }; }
    if (!act) {
      if (elem && (objectsNamed || info.flora.length || info.creatures.length || info.structs.length) && !selfT) return { acts: applyElem(elem, info, aim, p, n, sz) };
      if (elem) return { acts: manifest(elem, p, aim, sz, n) };
      A('осмотреть: ' + cl.np.filter(t => t.e).map(t => t.e.ru.split(/[;,(]/)[0]).join(', '), 20, () => inspect(aim, info), 'mind', true); return { acts: L };
    }
    switch (act) {
      case 'manifest': case 'create': {
        if (act === 'create' && !elem) {
          const kind = info.kinds[0] || ({ stone: 'stone', wood: 'stick', metal: 'knife', gold: 'goldbar', silver: 'silverbar', cloth: 'cloth', ice: 'icechunk' })[info.mats[0]]; if (!kind) return { err: 'Творить нечего: назови вещь (stenr, sverd, hald…)' };
          const K = KIND[kind], J = 250 * K.m * sz;
          A(`сотворить ${K.name} (${K.m} кг) из ничего — ПРОЦЕСС: материя нарастает ${T(J)}`, J, () => { const at = new V(aim.o.x + aim.d.x * 6, Math.max(hAt(aim.o.x + aim.d.x * 6, aim.o.z + aim.d.z * 6) + 3, aim.o.y), aim.o.z + aim.d.z * 6); const it = items.spawn(kind, at.x, at.y, at.z, { mscale: sz }); if (!it) return; it.held = 1; it.scale = 0.1; it.v.set(0, 0, 0);
            addProc({ name: 'сотворить ' + K.name, J, tag: 'items', step(raw, dt, d) { it.scale = Math.max(0.1, d.got / d.J); puff(it.p, COL.mind, 2, { spd: 3, s0: 1, s1: 2, life: 0.6, a: 0.6 }); }, end(why) { it.held = 0; if (why !== 'done') { it.scale = Math.max(0.3, it.scale); } else it.scale = 1; } }); }, 'mind'); return { acts: L };
        }
        if (elem) return { acts: manifest(elem, p, aim, sz, n) };
        return { err: 'Что являть? Назови стихию (brisingr, adurna, vindr…)' };
      }
      case 'lift': case 'fly': {
        const bs = (selfT || (!objectsNamed && !heldItems.length && !elem)) ? [selfBody] : null;
        if (bs) { const hu = 6 * sz, J = PMASS * 0.12 * G0 * hu * U;
          A(`оторваться от земли — ПРОЦЕСС: подъём силой на ${(hu * U).toFixed(1)} м (${T(J)}), дальше Space — выше (${fmtJ(PMASS * 0.12 * G0)}/м), Shift — ниже; удержание ${fmtJ(selfUp())}/с. losna eka или U — прекратить`, J, () => { selfVis('lev', { size: 1, bright: 0 }, aim.o, true); addProc({ name: 'подъём', J, tag: 'self', step(raw) { selfBody.lift(raw / (PMASS * 0.12 * G0) / U); } }); }, 'lev'); return { acts: L }; }
        if (elem === 'water') return { acts: manifest('water', p, { ...aim, d: new V(0, 1, 0).add(aim.d).normalize() }, sz, n) };
        const r = mv(); if (!r.ok.length) return none(r, 'Нечего поднимать: ' + (info.kinds[0] ? 'такой вещи рядом нет' : 'ничего рядом нет'));
        for (const b of r.ok) { const hu = (act === 'fly' ? 9 : 7) * sz, J = Jlift(bodyMassEff(b), hu); A(`поднять ${describe(b)} на ${(hu * U).toFixed(1)} м — ПРОЦЕСС ${T(J)} (тяжёлое поднимается медленнее), дальше держать ${fmtJ(bodyMassEff(b) * G0 * 0.35 * U * 6)}/с (losna или U — отпустить)`, J, () => addProc({ name: 'поднять ' + b.name, J, tag: b.kind === 'item' ? 'items' : 'other', step(raw) { b.lift(raw / (bodyMassEff(b) * G0) / U); } }), 'mind'); }
        return { acts: L };
      }
      case 'push': case 'throw': {
        if (elem === 'stone' || info.mats.includes('soil')) { const J = 600 * sz; A(`толкнуть землю: накопить удар — ПРОЦЕСС ${T(J)}`, J, () => { const pt = aim.tgt.clone(); addProc({ name: 'удар по земле', J, step() { puff(pt, COL.stone, 2, { spd: 5, s0: 1.5, s1: 3, life: 0.6, up: 3, a: 0.5 }); }, end(why) { if (why === 'done') shockwave(pt, 18 * sz); } }); }, 'mind'); return { acts: L }; }
        if (elem) return { acts: manifest(elem, p, aim, sz, n) };
        const r = mv();
        for (const b of r.ok) { const v = (act === 'throw' ? 32 : 22) * M.pow * (M.slow ? 0.6 : 1), m = bodyMassEff(b), J = 0.5 * m * (v * U) ** 2; A(`${act === 'throw' ? 'бросить' : 'толкнуть'} ${describe(b)}: разгон до ${(v * U).toFixed(1)} м/с — ПРОЦЕСС ${T(J)}`, J, () => { const dir = aim.d.clone(); if (M.homing) { const t2 = B.creaturesNear(aim.tgt.x, aim.tgt.z, 30).find(x => x !== b); if (t2) dir.copy(t2.p).sub(b.p).normalize(); } let ke = 0; addProc({ name: (act === 'throw' ? 'бросок ' : 'толчок ') + b.name, J, tag: b.kind === 'item' ? 'items' : 'other', step(raw) { ke += raw; b.setVel(dir, Math.sqrt(2 * ke / m) / U); } }); }, 'mind'); }
        if (!r.ok.length) { const hit = r.no.filter(b => b.hurt); if (!hit.length) return none(r, 'Нечего толкать: цели не видно'); A(`толкнуть ${describe(hit[0])} — ударом (двигать нельзя)`, 300 * sz, () => { for (const b of hit.slice(0, 3)) b.hurt(3, 100, 'spell'); }, 'mind', true); }
        return { acts: L };
      }
      case 'hold': {
        const r = mv(); if (!r.ok.length) return none(r, 'Нечего хватать: такой вещи у цели нет');
        for (const b of r.ok) A(`схватить ${describe(b)} — ПРОЦЕСС: держать ${fmtJ(bodyMassEff(b) * G0 * 0.35 * U * 6)}/с (losna или U — отпустить)`, Jlift(bodyMassEff(b), 2), () => b.hold(), 'mind', true);
        return { acts: L };
      }
      case 'release': case 'unbind': { const scope = selfT ? 'self' : (info.kinds.length || info.mats.length) ? 'items' : 'all'; if (!procCount(scope)) return { err: 'Нечего отпускать: ни одно заклинание-процесс не действует' }; A(`отпустить (${scope === 'self' ? 'себя' : scope === 'items' ? 'предметы' : 'всё'})`, 0, () => { stopProcs(scope); }, 'mind', true); return { acts: L }; }
      case 'stop': {
        if (selfT) {
          const vm = Math.hypot(P.vel.x, P.vel.y, P.vel.z) * U, J = 0.5 * PMASS * vm * vm + 30;
          A(`остановить себя: погасить ${vm.toFixed(1)} м/с (${T(J)}), потом удерживать на месте ${fmtJ(P.state === 'ground' ? 25 : selfUp())}/с — ПРОЦЕСС (losna eka или U — отпустить)`, J, () => { addProc({ name: 'остановить себя', J, tag: 'self', step(raw) { const sp = Math.hypot(P.vel.x, P.vel.y, P.vel.z) * U; if (sp > 0.02) { const ke = 0.5 * PMASS * sp * sp, nk = Math.max(0, ke - raw), f = Math.sqrt(nk / ke); P.vel.multiplyScalar(f); } puff(new V(P.pos.x, P.pos.y + 4, P.pos.z), COL.mind, 2, { spd: 4, s0: 1.4, s1: 3, life: 0.6, a: 0.6 }); }, end(why) { if (why === 'done') { P.vel.set(0, 0, 0); rooted = P.pos.clone(); flyOn = false; ring(new V(P.pos.x, P.pos.y + 4, P.pos.z), COL.mind, 7, 0.4); } } }); }, 'mind'); return { acts: L };
        }
        if (elem === 'fire') { A('остановить огонь: потушить', 150 * sz, () => { const n2 = dragons ? dragons.extinguish(aim.tgt.x, aim.tgt.y, aim.tgt.z, 16 * sz) : 0; if (n2) steam(aim.tgt, 8); ring(aim.tgt, COL.steam, 14 * sz, 0.5); }, 'mind', true); return { acts: L }; }
        if (elem === 'water') return { acts: freezeIce(aim, sz) };
        const bs = (objectsNamed || heldItems.length || info.creatures.length || info.flora.length) ? (bareHeld && heldItems.length ? heldItems.slice(0, n).map(B.ofItem) : resolveBodies(info, aim, n, 'move')) : items.items.filter(i => i.v.length() > 3 && i.p.distanceTo(aim.tgt) < 30).map(B.ofItem);
        const mover = bs.filter(b => b.movable && b.speed() > 1.5), calm = bs.filter(b => b.alive && b.bind);
        for (const b of mover) { const m = bodyMassEff(b), J = 0.5 * m * (b.speed() * U) ** 2 + 15; A(`остановить ${describe(b)}: поглотить ${fmtJ(J)} — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: 'остановить ' + b.name, J, tag: b.kind === 'item' ? 'items' : 'other', step(raw) { const sp = b.speed() * U, ke = 0.5 * m * sp * sp; if (ke > 0) b.damp(Math.sqrt(Math.max(0, ke - raw) / ke)); }, end(why) { if (why === 'done') { b.damp(0); b.bind(4 * M.dur); } } }), 'mind'); }
        if (!mover.length && calm.length) { A(`остановить ${describe(calm[0])} — ПРОЦЕСС: держать ${fmtJ(50)}/с`, 150 * M.dur, () => bindProc('остановить существо', calm, 'bind', 3 * M.dur, 50, 'other'), 'mind'); }
        else if (!mover.length && bs.length) A('остановить: уже неподвижно, удержать', 40, () => { for (const b of bs) b.bind && b.bind(4 * M.dur); }, 'mind', true);
        if (!L.length) A('остановить — всё и так неподвижно', 10, () => {}, 'mind', true);
        return { acts: L };
      }
      case 'gather': case 'pull': case 'banish': case 'scatter': {
        const toMe = act === 'pull', out = act === 'banish' || act === 'scatter', ctr = toMe ? P.pos.clone() : aim.tgt.clone();
        let bs;
        if (act === 'pull') { const r = mv(); if (!r.ok.length) return none(r, 'Нечего притягивать'); bs = r.ok; }
        else { bs = items.items.filter(it => it.p.distanceTo(aim.tgt) < 26 * sz && ((!info.kinds.length && !info.mats.length) || info.kinds.includes(it.kind) || info.mats.some(m => matchesMat(it, m)))).slice(0, 12).map(B.ofItem); if (out) for (const b of B.creaturesNear(aim.tgt.x, aim.tgt.z, 14 * sz)) if (b.movable) bs.push(b); }
        if (!bs.length) return { err: 'Нечего ' + (out ? 'отбрасывать' : 'притягивать') };
        let J = 20; const v = 26 * M.pow; for (const b of bs) J += 0.5 * bodyMassEff(b) * (v * U) ** 2;
        A(`${out ? 'отбросить' : toMe ? 'притянуть к себе' : 'стянуть в точку'}: ${bs.length} объектов — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: out ? 'отбросить' : 'притянуть', J, P: J / 1.2, tag: 'items', step(raw, dt) { for (const b of bs) { if (!b.vel) continue; _a.set(b.p.x - ctr.x, b.p.y - ctr.y, b.p.z - ctr.z); _a.normalize(); const s2 = out ? 1 : -1; b.vel.addScaledVector(_a, s2 * v / 1.2 * dt * (toMe ? 1.1 : 1)); if (b.kind === 'item') { b.raw.v.y += 8 * dt; b.raw.held = 0; b.raw.hover = null; } else b.lift && b.lift(0.1); } } }), 'mind'); return { acts: L };
      }
      case 'break': {
        const r = mv(), its = r.ok.filter(b => b.kind === 'item'), liv = resolveBodies(info, aim, n, 'any').filter(b => b.alive && b.hurt && b.kind !== 'self');
        for (const b of its) { const it = b.raw, mat = MAT[it.mat], area = Math.PI * (it.r * U) ** 2, J = mat.tough * area * 2 * (it.hard || 1); A(`разбить ${describe(b)} (${it.mat}): накопить работу разрушения — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: 'разбить ' + it.name, J, tag: 'items', step(raw, dt, d) { it.p.x += rnd(-.12, .12) * (d.got / d.J); it.p.z += rnd(-.12, .12) * (d.got / d.J); if (Math.random() < 0.3) puff(it.p, [.7, .65, .55], 1, { spd: 3, s0: 0.8, s1: 0.2, life: 0.4 }); }, end(why) { if (why === 'done' && items.items.includes(it)) shatter(it); } }), 'mind'); }
        if (!its.length) for (const b of liv.slice(0, 2)) { const J = 400; A(`сломить ${describe(b)}: удар изнутри — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: 'сломить', J, step() { puff(b.p, [.8, .3, .3], 1, { spd: 3, s0: 1, s1: 2, life: 0.5, a: 0.5 }); }, end(why) { if (why === 'done') b.hurt(14, 300, 'spell'); } }), 'mind'); }
        if (!L.length) { const ws = things.filter(t => t.obj.userData && t.obj.userData.dispellable && t.obj.position.distanceTo(aim.tgt) < 20); if (ws.length) { A('разрушить каменную/ледяную постройку мага', 300, () => { for (const t of ws) t.life = Math.min(t.life, t.t + 0.2); puff(aim.tgt, COL.stone, 30, { spd: 12, s0: 2, s1: 5, life: 1, grav: 14 }); }, 'mind', true); return { acts: L }; } return none(r, 'Ломать нечего: смотри на предмет'); }
        return { acts: L };
      }
      case 'cut': {
        const r = mv(), its = r.ok.filter(b => b.kind === 'item'), liv = resolveBodies(info, aim, n, 'any').filter(b => b.alive && b.hurt && b.kind !== 'self');
        if (its.length) { for (const b of its) { const it = b.raw, J = 140 * M.pow; A(`рассечь ${describe(b)} на две части — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: 'рассечь ' + it.name, J, tag: 'items', step() { puff(it.p, [.9, .95, 1], 1, { spd: 4, s0: 1, s1: 0.2, life: 0.3 }); }, end(why) { if (why === 'done' && items.items.includes(it)) splitItem(it); } }), 'mind'); } return { acts: L }; }
        const J = 180 * sz * M.pow, hurtL = liv.length ? liv : B.creaturesNear(aim.o.x + aim.d.x * 14, aim.o.z + aim.d.z * 14, 14).filter(b => b.hurt);
        A(`${liv.length ? 'рассечь ' + describe(liv[0]) : 'рассечь воздух (клинок силы)'} — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: 'клинок силы', J, step() { puff(new V(aim.o.x + aim.d.x * 4, aim.o.y, aim.o.z + aim.d.z * 4), [.9, .95, 1], 2, { spd: 6, s0: 1, s1: 0.3, life: 0.3 }); }, end(why) { if (why !== 'done') return; const a = aimRay(); for (let k = 0; k < 26; k++) { const q2 = rnd(-.7, .7); spawn(a.o.x + a.d.x * 3 + Math.cos(q2) * -a.d.z * 6 * q2, a.o.y + rnd(-1, 1), a.o.z + a.d.z * 3 + q2 * a.d.x * 6, a.d.x * 70, 0, a.d.z * 70, [.9, .95, 1], 1.4, 0.4, 0.3, 0.8, 0, 1); } for (const b of hurtL.slice(0, 3)) b.hurt(12 * M.pow, 150, 'spell'); } }), 'mind'); return { acts: L };
      }
      case 'crush': {
        const r = mv(), its = r.ok.filter(b => b.kind === 'item'), liv = resolveBodies(info, aim, n, 'any').filter(b => b.alive && b.hurt && b.kind !== 'self');
        for (const b of its) { const it = b.raw, J = MAT[it.mat].tough * Math.PI * (it.r * U) ** 2 * 3; A(`раздавить ${describe(b)} — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: 'раздавить ' + it.name, J, tag: 'items', step() { it.scale = Math.max(0.3, it.scale * 0.99); }, end(why) { if (why === 'done') { puff(it.p, [.7, .65, .55], 14, { spd: 6, s0: 1, s1: 3, life: 0.8, grav: 8 }); items.remove(it); } else it.scale = 1; } }), 'mind'); }
        if (!its.length) for (const b of liv.slice(0, 2)) A(`сжать ${describe(b)} — ПРОЦЕСС`, 500, () => addProc({ name: 'сжать', J: 500, step(raw, dt, d) { d.k3 = (d.k3 || 0) + dt; if (d.k3 > 0.5) { d.k3 = 0; b.bind(1); b.hurt(3, 60, 'spell'); } } }), 'mind');
        if (!L.length) return none(r, 'Нечего сжимать');
        return { acts: L };
      }
      case 'ignite': return { acts: applyElem('fire', info, aim, p, n, sz) };
      case 'dry': {
        if (elem === 'water' || (!objectsNamed && !info.creatures.length && !info.flora.length)) { A('высушить: испарить воду вокруг', 400 * sz, () => { steam(aim.tgt, 6 * sz); for (const it of items.items) if (it.p.distanceTo(aim.tgt) < 18 * sz) it.wet = 0; }, 'mind', true); return { acts: L }; }
        const bs = resolveBodies(info, aim, n, 'any'); A('высушить ' + (bs[0] ? describe(bs[0]) : 'вещь'), 60, () => { for (const b of bs) { if (b.kind === 'item') { b.raw.wet = 0; b.raw.T += 30; } puff(b.p, COL.steam, 4, { spd: 3, s0: 1.5, s1: 3, life: 0.8, up: 3, a: 0.3 }); } }, 'mind', true); return { acts: L };
      }
      case 'harden': {
        if (elem === 'water') return { acts: freezeIce(aim, sz) };
        const bs = selfT ? [selfBody] : resolveBodies(info, aim, n, 'move');
        for (const b of bs) {
          if (b.kind === 'item') { const it = b.raw, J = 90 * it.m ** 0.5; A(`закалить ${describe(b)} — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: 'закалить ' + it.name, J, tag: 'items', step() { puff(it.p, [.8, .9, 1], 1, { spd: 3, s0: 1, s1: 2, life: 0.5 }); }, end(why) { if (why === 'done') { it.hard = (it.hard || 1) * 1.5; it.T = 15; } } }), 'mind'); }
          else if (b.kind === 'self') A('закалить кожу: оберег на 400 Дж — ПРОЦЕСС', 400, () => addProc({ name: 'закалить кожу', J: 400, tag: 'self', step(raw) { wardJ += raw; } }), 'shield');
        }
        if (!L.length) return { err: 'Закалять нечего: назови предмет или себя' };
        return { acts: L };
      }
      case 'heal': {
        const bs = (selfT || !objectsNamed) ? [selfBody] : resolveBodies(info, aim, n, 'any').filter(b => b.alive);
        for (const b of bs) {
          if (b.kind === 'self') { const hpMax = P.hpMax || 100, need = Math.max(0, hpMax - (P.hp || 0)), amt = Math.min(need, 32 * M.pow * sz); if (need < 1) { L.length = 0; return { err: 'Ты и так здоров' }; } const J = amt * 40; A(`исцелить раны: +${Math.round(amt)} здоровья — ПРОЦЕСС ${T(J)}, 1 здоровья = 40 Дж`, J, () => { selfVis('heal', { size: 1, bright: 0 }, aim.o, true); addProc({ name: 'исцеление', J, tag: 'self', step(raw) { P.hp = Math.min(hpMax, (P.hp || 0) + raw / 40); if (Math.random() < 0.4) spawn(P.pos.x + rnd(-2, 2), P.pos.y + rnd(0, 3), P.pos.z + rnd(-2, 2), 0, rnd(6, 12), 0, COL.heal, 1.4, 0.3, 0.9, 0.7, -1, 0.5); } }); }, 'heal'); }
          else if (b.heal && b.kind !== 'player' && b.kind !== 'enemy') A(`исцелить ${describe(b)}`, 600, () => { b.heal(20); b.wake(); puff(b.p, COL.heal, 24, { spd: 5, s0: 1.4, s1: 3, life: 1, up: 4 }); }, 'heal', true);
        }
        if (!L.length) return { err: 'Исцелить некого: чужие раны (игрок, враг) магией не залечить' };
        return { acts: L };
      }
      case 'ward': {
        const W = 800 * sz * M.dur; A(`оберег: вложить ${fmtJ(W)} — ПРОЦЕСС ${T(W)}; потом гасит удары по 40 Дж за 1 урона`, W, () => { selfVis('shield', { size: 1, bright: 0 }, aim.o, true); addProc({ name: 'оберег', J: W, tag: 'self', step(raw) { wardJ += raw; } }); }, 'shield'); return { acts: L };
      }
      case 'light': {
        const bs = (info.kinds.length || info.mats.length || info.creatures.length || info.flora.length || info.pron.length) ? resolveBodies(info, aim, 1, 'any') : [];
        if (bs.length) { A(`заставить сиять: ${describe(bs[0])} — ПРОЦЕСС: ~6 Дж/с`, 60, () => { orbBind = bs[0]; orbT = 1e9; selfVis('light', { size: 1, bright: M.bright }, aim.o, true); }, 'light', true); return { acts: L }; }
        A('зажечь светлячок (не пламя — свет) — ПРОЦЕСС: горит, пока хватает сил (~6 Дж/с)', 60 * (1 + M.bright), () => { orbT = 1e9; orbBind = null; selfVis('light', { size: 1, bright: M.bright }, aim.o, true); }, 'light', true); return { acts: L };
      }
      case 'sleep': case 'bind': case 'slow': case 'wake': case 'drown': {
        const bs = (selfT ? [selfBody] : resolveBodies(info, aim, Math.max(3, n), 'any')).filter(b => b.alive || b.kind === 'item');
        if (!bs.length) return { err: act === 'wake' ? 'Некого будить' : 'Нет цели в поле зрения' };
        if (act === 'wake') { A('разбудить', 80, () => { for (const b of bs.slice(0, 3)) b.wake(); }, 'mind', true); return { acts: L }; }
        if (act === 'drown') { A(`окатить водой ${describe(bs[0])}`, 300, () => { puff(bs[0].p, COL.water, 30, { spd: 8, s0: 1.4, s1: 3, life: 0.9, up: 8, grav: 20 }); bs[0].douse(); bs[0].hurt && bs[0].hurt(6, 100, 'spell'); }, 'mind', true); return { acts: L }; }
        const can = bs.filter(b => act === 'sleep' ? (b.kind === 'npc' || b.kind === 'animal') : b.bind);
        if (!can.length) return { err: act === 'sleep' ? 'Усыпить можно жителей и животных — они здесь не найдены' : 'Связать нечего' };
        const sec = act === 'sleep' ? 14 * M.dur : act === 'bind' ? 9 * M.dur : 4 * M.dur, pj = act === 'sleep' ? 32 : act === 'bind' ? 50 : 75, nn = Math.min(3, can.length), nm = ({ sleep: 'усыпить', bind: 'связать', slow: 'замедлить' })[act];
        A(`${nm}: ${can.slice(0, nn).map(describe).join(', ')} — ПРОЦЕСС: держать ${fmtJ(pj * nn)}/с, до ${sec.toFixed(0)} с (losna или U — отпустить)`, pj * nn * sec, () => bindProc(nm, can, act === 'sleep' ? 'sleep' : 'bind', sec, pj), 'mind'); return { acts: L };
      }
      case 'kill': {
        const bs = resolveBodies(info, aim, 1, 'any').filter(b => b.alive && b.kind !== 'self' && b.hurt); if (!bs.length) return { err: 'Некого — цели не видно' }; const b = bs[0], J = 1800 * M.pow;
        A(`остановить жизнь: ${describe(b)} — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: 'остановить жизнь', J, step() { puff(b.p, COL.shadow, 2, { spd: 3, s0: 2, s1: 4, life: 0.8, a: 0.5 }); }, end(why) { if (why !== 'done') return; if (b.kind === 'npc') b.sleep(20); else b.hurt(40, 3000, 'spell'); flash(COL.shadow, 12); puff(b.p, COL.shadow, 30, { spd: 8, s0: 2, s1: 4, life: 1.2, a: 0.6 }); } }), 'mind'); return { acts: L };
      }
      case 'conceal': {
        const bs = (selfT || !objectsNamed) ? [selfBody] : resolveBodies(info, aim, n, 'any');
        const shade = info.elems.includes('shadow') || M.dark ? 0.7 : 1;
        for (const b of bs) { if (!b.hide) continue; const dr = (b.kind === 'self' ? cloakUp() : Math.max(10, 4 * Math.sqrt(b.mass))) * shade; A(`скрыть ${b.kind === 'self' ? 'себя' : describe(b)}: невидимость — ПРОЦЕСС: ${fmtJ(dr)}/с, пока хватает сил${b.kind === 'self' ? '; удар раскроет' : ''}; losna или U — вернуть${shade < 1 ? ' (тень помогает: −30%)' : ''}`, 120 * shade, () => { if (b.kind === 'self') setCloak(true, shade); else hideBody(b, true); puff(b.p, COL.shadow, 20, { spd: 5, s0: 2, s1: 4, life: 0.9, a: 0.5 }); }, 'mind', true); }
        if (!L.length) { A('скрыть: клубы тумана', 150, () => { puff(new V(P.pos.x, P.pos.y + 4, P.pos.z), COL.mist, 40, { spd: 6, s0: 4, s1: 10, life: 3, a: 0.35, drag: 1 }); }, 'mind', true); }
        return { acts: L };
      }
      case 'change': {
        const its = mv().ok.filter(b => b.kind === 'item').map(b => b.raw), nm = info.mats[1] || info.mats.find(m => !its[0] || m !== its[0].mat) || (cl.np.filter(t => NOUN[t.a] && NOUN[t.a][0] === 'mat').map(t => NOUN[t.a][1]).pop());
        if (!its.length || !nm || !MAT[nm]) return { err: 'Превращать нечего: moi <вещь> <материал>, например moi sverd kuldr (живое и постройки не превращаются)' };
        for (const it of its) { const J = 120 * it.m; A(`превратить ${it.name} из ${MAT[it.mat].n} в ${MAT[nm].n} — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: 'превратить ' + it.name, J, tag: 'items', step() { it.M.color.lerp(new THREE.Color(MAT[nm].col), 0.05); if (Math.random() < 0.3) puff(it.p, COL.mind, 1, { spd: 3, s0: 1, s1: 2, life: 0.6 }); }, end(why) { if (why === 'done' && items.items.includes(it)) { it.m *= MAT[nm].rho / MAT[it.mat].rho; items.setMat(it, nm); puff(it.p, COL.mind, 16, { spd: 5, s0: 1.2, s1: 3, life: 0.8 }); } } }), 'mind'); } return { acts: L };
      }
      case 'grow': case 'shrink': {
        const its = mv().ok.filter(b => b.kind === 'item'); if (!its.length) return { err: 'Менять размер можно у предметов' };
        const f = act === 'grow' ? 1.35 : 0.7;
        for (const b of its) { const it = b.raw, J = 100 * it.m ** 0.7; A(`${act === 'grow' ? 'увеличить' : 'уменьшить'} ${describe(b)} — ПРОЦЕСС ${T(J)}`, J, () => addProc({ name: act, J, tag: 'items', step() { puff(it.p, COL.mind, 1, { spd: 3, s0: 1, s1: 2, life: 0.5 }); }, end(why) { if (why === 'done') { it.scale = Math.max(0.2, Math.min(3, it.scale * f)); it.m *= f ** 3; } } }), 'mind'); } return { acts: L };
      }
      case 'warp': {
        const its = mv().ok.filter(b => b.kind === 'item'); if (!its.length) return { err: 'Искривлять можно предметы' };
        for (const b of its) A(`искривить ${describe(b)}`, 60, () => { const g = b.raw.g; g.scale.set(rnd(0.6, 1.5), rnd(0.6, 1.5), rnd(0.6, 1.5)); b.raw.warp = g.scale.clone(); puff(b.raw.p, COL.mind, 12, { spd: 4, s0: 1, s1: 2, life: 0.6 }); }, 'mind', true); return { acts: L };
      }
      case 'greet': {
        const bs = B.creaturesNear(aim.tgt.x, aim.tgt.z, 14).filter(b => b.say); A('обратиться к ближним (они ответят)', 30, () => { for (const b of bs.slice(0, 3)) b.say(['Здравствуй!', 'И тебе мира!', 'Кто ты, чародей?'][Math.floor(Math.random() * 3)]); puff(new V(aim.tgt.x, aim.tgt.y + 4, aim.tgt.z), COL.heal, 8, { spd: 3, s0: 1, s1: 2, life: 0.7, up: 3 }); }, 'mind', true); return { acts: L };
      }
      case 'listen': case 'find': {
        const bs = (act === 'find' && (objectsNamed || info.creatures.length || info.flora.length)) ? resolveBodies(info, { ...aim, tgt: P.pos.clone() }, 6, 'any') : B.creaturesNear(P.pos.x, P.pos.z, 80);
        A(act === 'find' ? 'найти: подсветить' : 'прислушаться: услышать живое вокруг', 40, () => { for (const b of bs.slice(0, 12)) ring(b.p, COL.light, 6, 0.9); show(act === 'find' ? 'Найдено' : 'Слышно', `${bs.length} · ближайшее ${bs[0] ? (bs[0].p.distanceTo(P.pos) * U).toFixed(0) + ' м' : '—'}`); }, 'mind', true); return { acts: L };
      }
      case 'open': case 'lock': {
        const ds = (richard.doors || []).filter(d => d.h && Math.hypot(d.h.dx - aim.tgt.x, d.h.dz - aim.tgt.z) < 16).sort((a, b) => Math.hypot(a.h.dx - aim.tgt.x, a.h.dz - aim.tgt.z) - Math.hypot(b.h.dx - aim.tgt.x, b.h.dz - aim.tgt.z));
        if (!ds.length) return { err: 'Рядом с прицелом нет двери (смотри на дверь)' };
        A(`${act === 'open' ? 'открыть' : 'закрыть'} дверь`, 80, () => { for (const d of ds.slice(0, 2)) d.want = act === 'open' ? 1 : 0; ring(new V(ds[0].h.dx, hAt(ds[0].h.dx, ds[0].h.dz) + 4, ds[0].h.dz), COL.mind, 6, 0.5); }, 'mind', true); return { acts: L };
      }
      case 'bane': {
        const bs = resolveBodies(info, aim, n, 'any').filter(b => b.alive && b.kind !== 'self' && b.hurt); if (!bs.length) return { err: 'Некому причинить боль: цели не видно' };
        A(`причинить боль: ${describe(bs[0])} — ПРОЦЕСС`, 300, () => addProc({ name: 'боль', J: 300, step(raw, dt, d) { d.k4 = (d.k4 || 0) + dt; if (d.k4 > 0.5) { d.k4 = 0; bs[0].hurt(4 * M.pow, 60, 'spell'); puff(bs[0].p, COL.shadow, 4, { spd: 3, s0: 1.4, s1: 2.5, life: 0.6, a: 0.5 }); } } }), 'mind'); return { acts: L };
      }
      case 'build': {
        const J = 2200 * Math.pow(sz, 1.3); A(`воздвигнуть каменную стену — ПРОЦЕСС: поднимается ${T(J)} (камень растёт из земли)`, J, () => { const a = aimRay(); addProc({ name: 'воздвигнуть стену', J, step() { puff(new V(a.tgt.x, a.tgt.y + 1, a.tgt.z), COL.stone, 2, { spd: 5, s0: 2, s1: 5, life: 0.8, up: 3, a: 0.5 }); }, end(why) { if (why === 'done') wall({ fx: ['stone'], size: M.size, count: 1, bright: 0, pow: M.pow }, a.o, a.d, true); } }); }, 'stone'); return { acts: L };
      }
      case 'inspect': A('осмотреть', 20, () => inspect(aim, info), 'mind', true); return { acts: L };
      case 'sprint': { const v = 7 * sz; A(`рывок вперёд (${(v * U * 5).toFixed(1)} м/с, масса мага ${PMASS} кг)`, 0.5 * PMASS * (v * U * 5) ** 2 * 0.2, () => { const yaw = P.yawVis ?? P.yaw; boost(14); P.vel.x += Math.sin(yaw) * v * 5; P.vel.z += Math.cos(yaw) * v * 5; puff(P.pos, COL.wind, 20, { spd: 8, s0: 1.5, s1: 3, life: 0.5, a: 0.5 }); }, 'mind', true); return { acts: L }; }
      default: { A(`«${cl.verb}» — слово есть, но мир не знает, что менять`, 15, () => puff(new V(aim.tgt.x, aim.tgt.y + 2, aim.tgt.z), COL.mind, 8, { spd: 3, s0: 1, s1: 2, life: 0.6, a: 0.5 }), 'mind', true); return { acts: L }; }
    }
  }
    let orbBind = null;
  function shockwave(p, R) { ring(p, COL.stone, R, 0.5); puff(new V(p.x, p.y + 0.5, p.z), COL.stone, 40, { spd: R * 0.9, s0: 2, s1: 6, life: 1.1, up: 2, grav: 6, a: 0.5 }); for (const it of items.items) { const d = it.p.distanceTo(p); if (d < R) { _a.set(it.p.x - p.x, 0.6, it.p.z - p.z).normalize(); it.v.addScaledVector(_a, 30 / Math.max(0.5, it.m ** 0.4)); it.v.y += 12; it.held = 0; } } npcs && npcs.hitAt && npcs.hitAt(p.x, p.z, R, true); areaHurt(p, R * 0.8, 6, 'spell'); }
  function shatter(it) { const frag = it.kind === 'stone' || it.kind === 'boulder' ? 'stone' : it.mat === 'wood' ? 'stick' : null; puff(it.p, [.7, .65, .55], 18, { spd: 9, s0: 1, s1: 3, life: 0.8, grav: 14 }); const n = Math.min(5, Math.max(2, Math.round(it.m ** 0.4 + 1))); if (frag) for (let k = 0; k < n; k++) { const f = items.spawn(frag, it.p.x, it.p.y + 0.5, it.p.z, { mscale: it.m / (KIND[frag].m * n) }); if (f) { f.scale = Math.max(0.4, Math.min(1, (it.m / n / KIND[frag].m) ** 0.33)); f.v.set(rnd(-14, 14), rnd(6, 16), rnd(-14, 14)); } } items.remove(it); }
  function splitItem(it) { puff(it.p, [.9, .92, 1], 8, { spd: 5, s0: 1, s1: 0.3, life: 0.4 }); const h = items.spawn(it.kind, it.p.x, it.p.y + 0.4, it.p.z, { mscale: it.m / KIND[it.kind].m / 2 }); if (h) { h.scale = it.scale * 0.85; h.v.set(rnd(-6, 6), 8, rnd(-6, 6)); items.setMat(h, it.mat); h.T = it.T; } it.m /= 2; it.scale *= 0.85; it.v.set(rnd(-6, 6), 8, rnd(-6, 6)); }
  function freezeIce(aim, sz) { return [{ label: 'заморозить воду: лёд', J: 700 * sz, run: () => { const R = 8 * sz; ring(aim.tgt, COL.ice, R, 0.5); frost(aim.tgt, R, sz); }, vis: 'ice' }]; }
  function manifest(elem, p, aim, sz, n) {      // стихия «из ничего»: поток энергии — огонь, вода, лёд, ветер льются, пока идёт сила; молния копит заряд и бьёт
    const spec = { fx: [elem], size: p.mods.size, count: Math.min(4, n), bright: p.mods.bright, pow: p.mods.pow };
    const names = { fire: 'поток огня', water: 'струя воды', ice: 'ледяной поток', wind: 'ветер', bolt: 'молния', light: 'светлячок', shadow: 'облако тьмы', mist: 'туман', rain: 'ливень' };
    const PW = { fire: 400, water: 250, ice: 300, wind: 150 }[elem];
    if (PW) { const Pw = PW * Math.pow(sz, 1.3) * (elem === 'fire' ? p.mods.heat : 1); return [{ label: `${names[elem]} — ПРОЦЕСС-поток: ${fmtJ(Pw)}/с по живому прицелу, пока хватает сил (до 10 с; losna или U — прекратить)`, J: Pw * 3, man: true, vis: elem, run: () => { addProc({ name: names[elem], J: Pw * 10, P: Pw, tag: 'other', step: streamStep(elem, spec) }); } }]; }
    if (elem === 'bolt') { const J = 1500 * Math.pow(sz, 1.3) * p.mods.pow; return [{ label: `молния — ПРОЦЕСС: заряд ~1.2 с (${fmtJ(J)}), потом разряд туда, куда смотришь`, J, man: true, vis: 'bolt', run: () => { addProc({ name: 'заряд молнии', J, P: J / 1.2, tag: 'other', step() { spawn(P.pos.x + rnd(-3, 3), P.pos.y + rnd(2, 9), P.pos.z + rnd(-3, 3), rnd(-8, 8), rnd(-8, 8), rnd(-8, 8), COL.bolt, 1.2, 0.3, 0.3, 0.9, 0, 2); }, end(why) { if (why !== 'done') return; const a = aimRay(); perform(spec, a.o, a.d, true, null); net.send({ t: 'spell', fx: ['bolt'], x: +a.o.x.toFixed(1), y: +a.o.y.toFixed(1), z: +a.o.z.toFixed(1), vx: +a.d.x.toFixed(3), vy: +a.d.y.toFixed(3), vz: +a.d.z.toFixed(3), size: spec.size, count: 1, bright: 0 }); } }); } }]; }
    const baseJ = { light: 60, shadow: 150, mist: 100, rain: 700 }[elem];
    if (baseJ === undefined) return [{ label: 'стихия «' + elem + '» не проявляется', J: 20, run: () => {}, vis: 'mind', inst: true }];
    return [{ label: `${names[elem]}${elem === 'light' ? ' — ПРОЦЕСС: горит, пока хватает сил (~6 Дж/с)' : elem === 'rain' ? ' — на 45 с' : ''}`, J: baseJ * Math.pow(sz, 1.3), inst: true, vis: elem, man: elem === 'rain', run: () => { if (elem === 'shadow' || elem === 'mist') puff(new V(aim.tgt.x, aim.tgt.y + 3, aim.tgt.z), elem === 'shadow' ? COL.shadow : COL.mist, 50, { spd: 7, s0: 4, s1: 11, life: 3, a: 0.4, drag: 1 }); else if (elem === 'light') { orbT = 1e9; orbBind = null; selfVis('light', spec, aim.o, true); } else if (elem === 'rain') startRain(true); } }];
  }
  const HS = 0.002;      // игровой масштаб теплоёмкости (без него разогреть меч стоило бы сотни кДж)
  function applyElem(elem, info, aim, p, n, sz) {      // стихия действует на любое тело: brisingr traevam, adurna thornessa, svell älfa, kveykva sverd …
    const L = [], M = p.mods, picks = curPicks, A = (label, J, run, vis, inst) => L.push({ label, J, run: () => { wakeAll(picks); run(); }, vis, inst });
    const bs = resolveBodies(info, aim, n, elem === 'fire' ? 'burn' : 'any'), tc = J => (J / POW()).toFixed(1);
    for (const b of bs) {
      const raw = b.raw;
      if (elem === 'fire') {
        const J = b.kind === 'item' ? Math.max(20, raw.m * (SPEC_HEAT[raw.mat] || 1000) * HS * Math.max(0, (MAT[raw.mat].flam ? MAT[raw.mat].flam + 40 : 700 * M.heat) - raw.T) * M.heat) : (b.kind === 'house' ? 900 : b.kind === 'tree' ? 800 : b.kind === 'plant' ? 120 : b.kind === 'self' ? 300 : 500) * M.heat;
        A(`${b.alive ? 'обжечь' : 'нагреть'} ${describe(b)} — ПРОЦЕСС ${tc(J)} с${b.kind === 'tree' || b.kind === 'house' || b.kind === 'plant' ? ': займётся, дальше огонь пойдёт сам' : b.kind === 'item' && MAT[raw.mat].flam ? ': займётся' : ''}`, J, () => addProc({ name: 'нагреть ' + b.name, J, tag: b.kind === 'item' ? 'items' : 'other', step(r2) { b.heat(r2); if (Math.random() < 0.5) puff(b.p, COL.fire, 1, { spd: 3, s0: 1.2, s1: 3, life: 0.5, up: 4 }); } }), 'fire');
      }
      else if (elem === 'water') A(`окатить ${describe(b)}`, 40, () => { b.douse(); puff(b.p, COL.water, 12, { spd: 5, up: 4, grav: 14 }); if (b.kind === 'item' && b.raw.burn) steam(b.p, 4); }, 'water', true);
      else if (elem === 'ice') A(`заморозить ${describe(b)}`, 150, () => { b.freeze(); puff(b.p, COL.ice, 16, { spd: 4, s0: 1, s1: 2, life: 0.8 }); }, 'ice', true);
      else if (elem === 'wind') { if (b.movable && b.vel) A(`обдуть ${describe(b)}`, 60, () => { b.setVel(aim.d, 40 / Math.max(0.5, b.mass ** 0.5)); if (b.kind === 'item') b.raw.v.y += 6; }, 'wind', true); else A(`обдуть ${describe(b)} (шевелит, но не двигает)`, 30, () => puff(b.p, COL.wind, 10, { spd: 6, s0: 1.5, s1: 3, life: 0.6, a: 0.4 }), 'wind', true); }
      else if (elem === 'bolt') { const J = 1800 * M.pow; A(`ударить молнией по ${describe(b)} — ПРОЦЕСС: заряд ${tc(J)} с`, J, () => addProc({ name: 'заряд молнии', J, tag: 'other', step() { spawn(b.p.x + rnd(-2, 2), b.p.y + rnd(0, 4), b.p.z + rnd(-2, 2), 0, rnd(2, 8), 0, COL.bolt, 1, 0.3, 0.3, 0.9, 0, 1); }, end(why) { if (why !== 'done') return; perform({ fx: ['bolt'], size: 0.5, count: 1, bright: 0, pow: M.pow }, new V(b.p.x, b.p.y + 3, b.p.z), new V(0, -1, 0), true, null); if (b.kind === 'item') { if (MAT[raw.mat].cond) { raw.T += 600; arc(raw.p); } else if (MAT[raw.mat].flam) raw.T += 400; } } }), 'bolt'); }
      else if (elem === 'light') A(`заставить сиять: ${describe(b)}`, 60, () => { orbBind = b; orbT = 1e9; selfVis('light', { size: 1, bright: M.bright }, aim.o, true); }, 'light', true);
      else if (elem === 'shadow') A(`окутать тенью (скрыть): ${describe(b)}`, 120, () => { if (b.kind === 'self') setCloak(true, 0.7); else hideBody(b, true); }, 'mind', true);
      else if (elem === 'mist') A(`окутать туманом: ${describe(b)}`, 100, () => puff(b.p, COL.mist, 40, { spd: 6, s0: 4, s1: 10, life: 3, a: 0.35, drag: 1 }), 'mind', true);
      else A(`воздействовать на ${describe(b)}`, 30, () => puff(b.p, COL[elem] || COL.mind, 8, { spd: 3, s0: 1, s1: 2, life: 0.6 }), 'mind', true);
    }
    if (!L.length) return manifest(elem, p, aim, sizeM(p), n);
    return L;
  }
  function inspect(aim, info) {
    const bs = resolveBodies(info, aim, 1, 'any'); if (!bs.length) { show('…', 'Здесь ничего, на что можно посмотреть'); return; } const b = bs[0], r = b.raw;
    if (b.kind === 'item') { const m = MAT[r.mat]; show(b.name, `${m.n} · ${r.m.toFixed(2)} кг · ${Math.round(r.T)}°C${r.burn ? ' · ГОРИТ' : ''}${r.wet > 0.3 ? ' · мокрый' : ''} · ${items.speedMS(r).toFixed(1)} м/с · прочность ${m.tough}`); }
    else if (b.kind === 'self') show('Ты', `здоровье ${Math.round(P.hp)}/${P.hpMax || 100} · сил ${Math.round(E)}/${EMAX} Дж · КПД ${Math.round(eta() * 100)}%`);
    else if (b.alive) show(b.name, `${b.kind === 'player' ? 'игрок' : b.kind === 'npc' ? 'житель' : b.kind === 'enemy' ? 'враг арены' : 'животное'} · ~${Math.round(b.mass)} кг · ${(b.p.distanceTo(P.pos) * U).toFixed(0)} м${b.isHidden && b.isHidden() ? ' · скрыт магией' : ''}`);
    else show(b.name, `${r.burn > 0 ? 'ГОРИТ' : r.ash > performance.now() / 1000 ? 'выгорело' : 'горючее'} · высота ${(r.h * U).toFixed(1)} м · ~${Math.round(b.mass)} кг`);
  }
  function planSpell(p, aim) {
    if (p.tense === 'past') return { err: 'Прошедшее время: событие уже случилось — ничего не произойдёт' };
    if (p.unknown.length) return { err: 'Нет слова: ' + p.unknown.join(', ') + ' (мир не поймёт слово, которого нет в языке)' };
    if (!p.clauses.length) return { err: 'В фразе нет ни действия, ни вещи' };
    const acts = [], notes = []; curPicks = new Set(); for (const cl of p.clauses) { const r = planClause(cl, p, aim); if (r.err) notes.push(r.err); else acts.push(...r.acts); } curPicks = null;
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
    cd = 0.5; if (hist[hist.length - 1] !== t) hist.push(t); hi = hist.length;
    if (p.trap) { E = Math.max(0, E - total); xp += total / 300; traps.push({ x: aim.tgt.x, y: aim.tgt.y, z: aim.tgt.z, p, t: 90 }); puff(aim.tgt, COL.mind, 20, { spd: 4, s0: 1.4, s1: 2.5, life: 1.2, a: 0.6 }); show(r.ancient, 'Ловушка поставлена (' + fmtJ(total) + ' вложено): сработает, когда рядом окажется кто-то'); try { localStorage.setItem('ninja.magic.xp', String(xp)); } catch (e) {} return true; }
    // мгновенные действия платят сразу, процессы — потоком по ходу работы (procTick)
    const inst = pl.acts.filter(a => a.inst).reduce((s, a) => s + a.J, 0) * (p.marks.some(m => m === 3) ? 1.3 : 1) / pl.eta, pay = Math.min(E, inst), miss = inst - pay;
    E -= pay; xp += pay / 300; if (miss > 0) { P.hp -= miss / 40; flash([1, .2, .2], 6); if (P.hp <= 0) { die(); return true; } }
    deadlyNext = lethalAsk === null && deficit > 0 && total > E;      // «вопреки смерти»: процессы продолжают за счёт здоровья
    runActs(pl.acts); deadlyNext = false; sendVis(pl.acts, aim);
    if (total > 500 && !cloakOn) npcs && npcs.shout && npcs.shout(P.pos.x, P.pos.z, 45, ['Колдун!', 'Магия!', 'Ой, что это?!', 'Берегись!'][Math.floor(Math.random() * 4)]);
    show(r.ancient, r.gloss + (procs.length ? ' · процесс идёт' : ' · ' + fmtJ(total)));
    try { localStorage.setItem('ninja.magic.xp', String(xp)); } catch (e) {}
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
    if (Array.isArray(m.fx) && (m.fx[0] === 'cloak' || m.fx[0] === 'uncloak')) { net.cloak && net.cloak(m.id, m.fx[0] === 'cloak'); return; }
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
        for (const b of hidden) { const d = Math.max(10, 4 * Math.sqrt(b.mass)) / e; drain += d; L.push(`🫥 ${b.name} скрыт −${Math.round(d)}`); }
        if (cloakOn) { const d = cloakUp() * cloakShade / e; drain += d; L.push(`🫥 невидим −${Math.round(d)}`); }
        if (flyOn) { const d = selfUp() / e; drain += d; L.push(`🕊 полёт −${Math.round(d)} (Space выше · Shift ниже)`); } if (rooted) { const d = (P.state === 'ground' ? 25 : selfUp()) / e; drain += d; L.push(`✋ остановлен −${Math.round(d)}`); }
        if (wardJ > 0) L.push(`🛡 оберег ${Math.floor(wardJ)} Дж`); if (orbT > 0) { drain += 6 / e; L.push('✨ светлячок −' + Math.round(6 / e)); } if (rainT > 0) L.push('🌧 ливень');
        for (const d of procs) { const pw = d.P / e; drain += d.J === Infinity ? pw : Math.min(pw, (d.J - d.got) / Math.max(dt, 0.016) / e); L.push(`⟳ ${d.name}${d.J !== Infinity && d.J > 0 ? ' ' + Math.round(100 * d.got / d.J) + '%' : ''} −${Math.round(pw)}`); }
        procB.style.display = L.length ? 'block' : 'none'; if (L.length) procB.textContent = 'Процессы (Дж/с): ' + L.join(' · ') + (drain ? ` · всего −${Math.round(drain)}/с` : '') + ' · U — прервать всё'; }
      if (!scatterDone) { scatter(P.pos.x, P.pos.z, 14, 20, 90); scatter(P.pos.x, P.pos.z, 10, 90, 220); scatterDone = true; }
      scT += dt; if (scT > 8) { scT = 0; let near = 0; for (const it of items.items) if (it.p.distanceTo(P.pos) < 180) near++; if (near < 12) scatter(P.pos.x, P.pos.z, 5, 40, 130); }
    }
    if (window.__dragonOn && box.classList.contains('on')) close(false);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast.style.opacity = 0; }
    partTick(dt); if (flashT > 0) { flashT = Math.max(0, flashT - dt * 4); flashL.intensity = flashI * flashT; if (flashT <= 0) flashL.intensity = 0; }
    for (let i = things.length - 1; i >= 0; i--) { const t = things[i]; t.t += dt; const k = t.t / t.life; if (k >= 1) { scene.remove(t.obj); t.obj.traverse(o => { if (o.isMesh && o.material) o.material.dispose(); }); t.end && t.end(); things.splice(i, 1); continue; } t.upd && t.upd(t, k); }
    // хватка: предмет следует за прицелом, удержание стоит энергии каждую секунду; повисшие предметы парят
    procTick(dt); B.tick(dt);
    for (const b of hidden) { E -= Math.max(10, 4 * Math.sqrt(b.mass)) / eta() * dt; if (E <= 0) { E = 0; for (const x of [...hidden]) x.hide(false); hidden.clear(); show('…', 'Сил не хватило держать невидимость'); break; } }
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
      else if (P.state !== 'ground' && P.state !== 'dead') { { const kd = window.__g && window.__g.kd, upK = kd && kd.has('Space'), dnK = kd && kd.has('ShiftLeft'); if (upK) { flyY += 14 * dt; E -= PMASS * G0 * 14 * dt * U * 0.12 / eta(); } else if (dnK) flyY -= 14 * dt; flyY = Math.max(flyY, hAt(P.pos.x, P.pos.z) + 1.5); P.vel.y = 0; const dy = flyY + Math.sin(performance.now() / 400) * 0.5 - P.pos.y, mv = Math.max(-26 * dt, Math.min(26 * dt, dy * 5 * dt)); P.pos.y += mv; } if (Math.random() < 0.5) spawn(P.pos.x + rnd(-1.5, 1.5), P.pos.y + 0.3, P.pos.z + rnd(-1.5, 1.5), 0, -6, 0, COL.lev, 1.2, 0.3, 0.6, 0.6, 0, 0.5); }
    }
    if (rooted && !P.dead) {      // процесс: «остановлен» — ни шагу, ни падения, пока держится заклинание
      const air = P.state !== 'ground'; E -= (air ? selfUp() : 25) / eta() * dt; if (E <= 0) { E = 0; rooted = null; show('…', 'Сил не хватило удерживать себя'); }
      else { P.pos.x = rooted.x; P.pos.z = rooted.z; if (air) P.pos.y = rooted.y; P.vel.set(0, 0, 0); if (Math.random() < 0.3) spawn(P.pos.x + rnd(-2, 2), P.pos.y + rnd(1, 8), P.pos.z + rnd(-2, 2), 0, 1, 0, COL.mind, 1, 0.2, 0.6, 0.4, 0, 0.5); }
    }
    // оберег: удары по магу съедают его энергию (1 здоровья = 40 Дж), пока она не кончится
    if (P.hp < lastHp - 0.01 && wardJ > 0 && !P.dead) { const dmg = lastHp - P.hp, ab = Math.min(dmg, wardJ / 40); P.hp += ab; wardJ -= ab * 40; puff(new V(P.pos.x, P.pos.y + 5, P.pos.z), COL.shield, 12, { spd: 8, s0: 1.2, s1: 2.5, life: 0.4 }); flash(COL.shield, 6); }
    if (cloakOn) { E -= cloakUp() * cloakShade / eta() * dt; if (E <= 0) { E = 0; setCloak(false); show('…', 'Сил не хватило держать невидимость'); } else if (P.hp < lastHp - 0.01) { setCloak(false); show('…', 'Удар раскрыл тебя'); } else if (Math.random() < 0.15) spawn(P.pos.x + rnd(-2, 2), P.pos.y + rnd(1, 9), P.pos.z + rnd(-2, 2), 0, 2, 0, COL.shadow, 1.4, 0.3, 0.8, 0.35, 0, 0.5); }
    lastHp = P.hp;
    if (wardJ > 0) { if (bubble) { bubble.position.set(P.pos.x, P.pos.y + 5, P.pos.z); bubble.material.opacity = Math.min(0.3, 0.1 + wardJ / 4000) + 0.05 * Math.sin(performance.now() / 120); } } else if (bubble) { scene.remove(bubble); bubble.material.dispose(); bubble = null; }
    if (orbT > 0) { orbT -= dt; E -= 6 / eta() * dt; if (E <= 0) { E = 0; orbT = 0; } const tm = performance.now() / 1000; if (!orb) { orb = new THREE.Mesh(gSph, mkMat([1, .95, .7], 0.95)); orb.scale.setScalar(0.8); orb.renderOrder = 32; scene.add(orb); } if (orbBind && orbBind.p) orb.position.set(orbBind.p.x, orbBind.p.y + 2, orbBind.p.z); else orb.position.set(P.pos.x + Math.cos(tm * 1.3) * 4, P.pos.y + 11 + Math.sin(tm * 2) * 0.8, P.pos.z + Math.sin(tm * 1.3) * 4); orbL.position.copy(orb.position); orbL.intensity = 3.4; if (Math.random() < 0.4) spawn(orb.position.x, orb.position.y, orb.position.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), COL.light, 1.6, 0.2, 0.7, 0.5, 0, 0.5); if (orbT <= 0) { orbL.intensity = 0; scene.remove(orb); orb.material.dispose(); orb = null; } }
    else if (orb) { orbL.intensity = 0; scene.remove(orb); orb.material.dispose(); orb = null; }
    // ливень
    if (rainT > 0) { rainT -= dt; const cx = camera.position.x, cz = camera.position.z; for (let k = 0; k < 16; k++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * 55; spawn(cx + Math.cos(a) * d, camera.position.y + 40, cz + Math.sin(a) * d, 0, -70, 0, [.55, .72, 1], 0.5, 0.3, 0.75, 0.45, 0, 0); } if (dragons && Math.random() < dt * 0.6) dragons.wet(P.pos.x, P.pos.z, 80, 10); for (const it of items.items) if (it.p.distanceTo(P.pos) < 90) it.wet = 1; }
    // ловушки
    for (let i = traps.length - 1; i >= 0; i--) { const tr = traps[i]; tr.t -= dt; if (tr.t <= 0) { traps.splice(i, 1); continue; } if (Math.random() < 0.3) spawn(tr.x + rnd(-2, 2), tr.y + 0.5, tr.z + rnd(-2, 2), 0, rnd(2, 5), 0, COL.mind, 1.2, 0.2, 0.8, 0.5, 0, 0.5);
      const hit = bodies().find(b => Math.hypot(b.x - tr.x, b.z - tr.z) < 7 && Math.abs(b.y - tr.y) < 12); if (hit) { traps.splice(i, 1); const pt = new V(tr.x, tr.y, tr.z), aimT = { o: new V(tr.x, tr.y + 7, tr.z), d: new V(0, -1, 0), tgt: pt, hit: true }, pl = planSpell(tr.p, aimT); flash(COL.mind, 10); ring(pt, COL.mind, 8, 0.4); if (!pl.err) runActs(pl.acts); } }
  }
  return { update, cast, open, get energy() { return E; }, set energy(v) { E = v; }, items };
}
