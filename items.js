// items.js — предметы мира: камни, брёвна, мечи, яблоки… Настоящие тела: масса в кг, материал, температура, гравитация, отскок, трение, плавучесть,
// столкновения со зданиями и существами. Магия (magic.js) не «рисует эффекты», а двигает, греет, ломает и жжёт именно эти тела — и платит энергией по физике.
// Единицы: 1 игровая единица ≈ 0.19 м (рост героя 9.5 ед. ≈ 1.8 м); энергия — в джоулях.
export const U = 0.19;                 // метров в игровой единице
export const GRAV = 46;                // ускорение свободного падения, ед/с² (9.8 м/с² ÷ 0.19 = 51, чуть мягче ради игры)

export const MAT = {
  stone: { n: 'камень', rho: 2600, col: 0x8a8a86, bounce: 0.3, fric: 0.75, tough: 900 },
  wood: { n: 'дерево', rho: 600, col: 0x8a5a2b, bounce: 0.3, fric: 0.65, flam: 300, burnT: 12, tough: 200 },
  metal: { n: 'железо', rho: 7800, col: 0xa4acb4, bounce: 0.35, fric: 0.45, tough: 2500, cond: 1 },
  silver: { n: 'серебро', rho: 10500, col: 0xdfe3ea, bounce: 0.3, fric: 0.45, tough: 800, cond: 1 },
  gold: { n: 'золото', rho: 19300, col: 0xe6b422, bounce: 0.2, fric: 0.5, tough: 300, cond: 1 },
  organic: { n: 'плод', rho: 850, col: 0xc0301c, bounce: 0.45, fric: 0.6, flam: 360, burnT: 5, tough: 15 },
  leaf: { n: 'лист', rho: 400, col: 0x5aa23a, bounce: 0.1, fric: 0.9, flam: 200, burnT: 3, tough: 3 },
  feather: { n: 'перо', rho: 300, col: 0xf1ece0, bounce: 0.1, fric: 0.9, flam: 220, burnT: 2, tough: 2 },
  cloth: { n: 'ткань', rho: 400, col: 0x7a4a3a, bounce: 0.1, fric: 0.9, flam: 230, burnT: 7, tough: 20 },
  ice: { n: 'лёд', rho: 917, col: 0xbfeaff, bounce: 0.2, fric: 0.1, tough: 60 },
};
// kind → материал, масса (кг), радиус (ед), название, long — вытянутая (лежит боком, в полёте летит остриём)
export const KIND = {
  stone: { mat: 'stone', m: 4, r: 0.8, name: 'камень' }, boulder: { mat: 'stone', m: 60, r: 2.0, name: 'валун' },
  stick: { mat: 'wood', m: 0.6, r: 1.0, name: 'палка', long: 1 }, log: { mat: 'wood', m: 25, r: 1.6, name: 'бревно', long: 1 },
  apple: { mat: 'organic', m: 0.2, r: 0.4, name: 'яблоко' }, sword: { mat: 'metal', m: 1.4, r: 1.5, name: 'меч', long: 1 }, knife: { mat: 'metal', m: 0.3, r: 0.7, name: 'нож', long: 1 },
  arrow: { mat: 'wood', m: 0.05, r: 1.0, name: 'стрела', long: 1 }, spear: { mat: 'wood', m: 2, r: 2.0, name: 'копьё', long: 1 }, shield: { mat: 'metal', m: 4, r: 1.2, name: 'щит' },
  bowl: { mat: 'wood', m: 0.5, r: 0.6, name: 'чаша' }, chest: { mat: 'wood', m: 30, r: 1.5, name: 'ларец' }, armor: { mat: 'metal', m: 12, r: 1.4, name: 'доспех' },
  goldbar: { mat: 'gold', m: 12, r: 0.8, name: 'слиток золота' }, silverbar: { mat: 'silver', m: 8, r: 0.8, name: 'слиток серебра' },
  feather: { mat: 'feather', m: 0.005, r: 0.5, name: 'перо' }, leaf: { mat: 'leaf', m: 0.002, r: 0.4, name: 'лист' }, cloth: { mat: 'cloth', m: 0.8, r: 1.0, name: 'ткань' },
  icechunk: { mat: 'ice', m: 6, r: 1.0, name: 'льдина' },
};
export const matOf = it => MAT[it.mat];
export const matchesMat = (it, m) => it.mat === m || (m === 'metal' && (it.mat === 'silver' || it.mat === 'gold')) || (m === 'wood' && it.mat === 'wood') || (m === 'cloth' && it.mat === 'cloth');

export function createItems({ THREE, scene, world }) {
  const V = THREE.Vector3, hAt = (x, z) => world.heightAt(x, z), items = [], rnd = (a, b) => a + Math.random() * (b - a);
  const gSph = new THREE.IcosahedronGeometry(1, 1), gSphLow = new THREE.IcosahedronGeometry(1, 0), gBox = new THREE.BoxGeometry(1, 1, 1), gCyl = new THREE.CylinderGeometry(1, 1, 1, 8), gCone = new THREE.ConeGeometry(1, 1, 6);
  const mk = (g, mat) => new THREE.Mesh(g, mat);
  function build(kind, mat) {      // модель вещи; вытянутые лежат вдоль оси X
    const K = KIND[kind], r = K.r, g = new THREE.Group(), M = new THREE.MeshStandardMaterial({ color: MAT[K.mat].col, roughness: K.mat === 'metal' || K.mat === 'silver' || K.mat === 'gold' ? 0.35 : 0.85, metalness: K.mat === 'metal' || K.mat === 'silver' || K.mat === 'gold' ? 0.7 : 0.05, flatShading: true, emissive: 0x000000 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.8 }), add = (m, sx, sy, sz, x = 0, y = 0, z = 0, rz = 0) => { m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.z = rz; g.add(m); return m; };
    if (kind === 'stone') add(mk(gSphLow, M), r, r * 0.75, r * 0.9);
    else if (kind === 'boulder') add(mk(gSph, M), r, r * 0.8, r * 0.95);
    else if (kind === 'stick') add(mk(gCyl, M), 0.1, r * 2, 0.1, 0, 0, 0, Math.PI / 2);
    else if (kind === 'log') add(mk(gCyl, M), r * 0.45, r * 2, r * 0.45, 0, 0, 0, Math.PI / 2);
    else if (kind === 'apple') { add(mk(gSph, M), r, r * 0.9, r); add(mk(gCyl, dark), 0.03, 0.25, 0.03, 0, r * 0.9, 0); }
    else if (kind === 'sword' || kind === 'knife') { const L = r * 2; add(mk(gBox, M), L * 0.75, 0.07, 0.3 * (kind === 'knife' ? 0.6 : 1), L * 0.12, 0, 0); add(mk(gBox, dark), 0.12, 0.12, 0.9 * (kind === 'knife' ? 0.5 : 1), -L * 0.28, 0, 0); add(mk(gCyl, dark), 0.08, L * 0.25, 0.08, -L * 0.42, 0, 0, Math.PI / 2); }
    else if (kind === 'arrow') { add(mk(gCyl, dark), 0.03, r * 2, 0.03, 0, 0, 0, Math.PI / 2); add(mk(gCone, M), 0.08, 0.3, 0.08, r, 0, 0, -Math.PI / 2); }
    else if (kind === 'spear') { add(mk(gCyl, dark), 0.06, r * 2, 0.06, 0, 0, 0, Math.PI / 2); add(mk(gCone, M), 0.16, 0.7, 0.16, r, 0, 0, -Math.PI / 2); }
    else if (kind === 'shield') { add(mk(gCyl, M), r, 0.12, r, 0, 0, 0, 0); }
    else if (kind === 'bowl') { add(mk(gSph, M), r, r * 0.5, r); }
    else if (kind === 'chest') { add(mk(gBox, M), r * 1.6, r, r); add(mk(gBox, dark), r * 1.65, 0.12, r * 1.05, 0, r * 0.3, 0); }
    else if (kind === 'armor') { add(mk(gBox, M), r * 0.9, r * 1.2, r * 0.5); }
    else if (kind === 'goldbar' || kind === 'silverbar') add(mk(gBox, M), r * 1.4, r * 0.5, r * 0.6);
    else if (kind === 'feather') add(mk(gBox, M), r * 1.6, 0.03, 0.18);
    else if (kind === 'leaf') add(mk(gBox, M), r, 0.02, r * 0.7);
    else if (kind === 'cloth') add(mk(gBox, M), r * 1.4, 0.06, r * 1.1);
    else if (kind === 'icechunk') { M.transparent = true; M.opacity = 0.8; add(mk(gSphLow, M), r, r * 0.8, r * 0.9); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    return { g, M };
  }
  function spawn(kind, x, y, z, opts = {}) {
    const K = KIND[kind]; if (!K) return null;
    const { g, M } = build(kind), it = { kind, mat: K.mat, m: K.m * (opts.mscale || 1), r: K.r, name: K.name, p: new V(x, y, z), v: new V(), T: 15, burn: 0, burnT: 0, wet: 0, held: 0, g, M, yaw: Math.random() * 6.283, spin: 0, tumble: new V(), hitCd: 0, rest: 0, scale: 1, age: 0, long: !!K.long, ice: K.mat === 'ice', owner: opts.owner || null };
    g.position.set(x, y, z); scene.add(g); items.push(it); return it;
  }
  function remove(it) { const i = items.indexOf(it); if (i < 0) return; items.splice(i, 1); scene.remove(it.g); if (!it.shared) it.g.traverse(o => { if (o.isMesh && o.material) o.material.dispose(); }); }
  // предмет из объекта, уже стоящего в мире (камень, бочка, бревно, дерево…): модель — те же геометрия и материалы, что у экземпляра; пока «спит», в мире и сцене его нет
  const stubM = () => ({ color: { setHex() {}, lerp() {} }, emissive: { setRGB() {} }, metalness: 0, roughness: 1 });
  function makeWorld(rec, parts, o) {
    const g = new THREE.Group(), inner = new THREE.Group(), s = rec.s, bb = rec.v.bb;
    for (const part of parts) { const m = new THREE.Mesh(part.g, part.m); m.matrixAutoUpdate = false; m.matrix.copy(part.mat); m.castShadow = true; m.receiveShadow = true; inner.add(m); }
    inner.scale.setScalar(s); inner.rotation.y = rec.rot; inner.position.y = -((bb.min.y + bb.max.y) / 2) * s; g.add(inner);
    const hh = o.size.y / 2, it = { kind: 'obj:' + rec.id, mat: o.mat, m: o.m, r: Math.max(0.5, Math.min(Math.max(o.size.x, o.size.z) / 2, 6)), hh, name: o.name, p: new V(rec.x, rec.y + ((bb.min.y + bb.max.y) / 2) * s, rec.z), v: new V(), T: 15, burn: 0, burnT: 0, wet: 0, held: 0, g, M: stubM(), yaw: 0, spin: 0, tumble: new V(), hitCd: 0, rest: 0, scale: 1, age: 0, long: false, ice: false, owner: null, shared: true, dormant: true, rec };
    g.position.copy(it.p); return it;
  }
  function activate(it) { if (!it.dormant) return; it.dormant = false; scene.add(it.g); items.push(it); }
  function setMat(it, matId) { it.mat = matId; const m = MAT[matId]; it.M.color.setHex(m.col); it.M.metalness = ['metal', 'silver', 'gold'].includes(matId) ? 0.7 : 0.05; it.M.roughness = it.M.metalness > 0.5 ? 0.35 : 0.85; it.ice = matId === 'ice'; }
  const speedMS = it => it.v.length() * U;
  const energyJ = it => 0.5 * it.m * speedMS(it) ** 2;

  // один шаг физики. env: { wind:{x,z}, boxes:[], fireNear(x,z,r), wetAt(x,z), ignite(x,y,z,r), puff(p,kind,n), bodies(), onHit(it, body, joules), splash(p) }
  function step(dt, env) {
    dt = Math.min(dt, 0.05); const boxes = env.boxes();
    for (let n = items.length - 1; n >= 0; n--) {
      const it = items[n]; it.age += dt; it.hitCd = Math.max(0, it.hitCd - dt); const p = it.p, v = it.v, mat = MAT[it.mat], r = it.r * it.scale;
      if (!it.held) {
        v.y -= GRAV * dt;
        const inWater = p.y - r * 0.5 < 0 && hAt(p.x, p.z) < 0.3;      // море: плавучесть и вязкое сопротивление
        if (inWater) { const rho = mat.rho, k = Math.min(1, (0 - (p.y - r)) / (2 * r)); v.y += GRAV * (1000 / rho) * k * dt; const dr = Math.max(0, 1 - 2.6 * dt); v.x *= dr; v.z *= dr; v.y *= Math.max(0, 1 - 3.5 * dt); if (!it.wasWater && Math.abs(v.y) > 6) env.splash(p); it.wasWater = true; it.wet = 1; } else it.wasWater = false;
        const w = env.wind; if (w && (w.x || w.z)) { const area = r * r, k = Math.min(30, 55 * area / Math.max(0.01, it.m)); v.x += (w.x - v.x) * Math.min(0.9, k * dt * 0.02); v.z += (w.z - v.z) * Math.min(0.9, k * dt * 0.02); }
        if (v.lengthSq() > 4) { const dr = Math.max(0, 1 - 0.12 * dt * (r * r) / Math.max(0.05, it.m) * 6); v.multiplyScalar(Math.min(1, dr)); }
        p.addScaledVector(v, dt);
      } else p.addScaledVector(v, dt);      // удерживаемый магией предмет: скорость задаёт хватка (magic.js), физика ног не касается
      // земля (холм/дно)
      const gy = hAt(p.x, p.z), floor = gy + (it.hh !== undefined ? it.hh * it.scale : r * 0.55);
      if (p.y < floor) {
        p.y = floor; const hx = hAt(p.x + 1, p.z) - hAt(p.x - 1, p.z), hz = hAt(p.x, p.z + 1) - hAt(p.x, p.z - 1), nrm = new V(-hx * 0.5, 1, -hz * 0.5).normalize(), vn = v.dot(nrm);
        if (vn < 0) { v.addScaledVector(nrm, -(1 + mat.bounce) * vn); if (-vn > 4) it.tumble.set(rnd(-3, 3), 0, rnd(-3, 3)); if (-vn > 9 && env.thud) env.thud(p, it, -vn); const f = Math.max(0, 1 - mat.fric * 2.2 * dt * (inWaterGround(p) ? 0.3 : 1)); v.x *= f; v.z *= f; if (-vn * (1 + mat.bounce) < 3) { v.y = Math.max(v.y, 0); } }
        if (hx * hx + hz * hz > 0.5) { v.x -= hx * 14 * dt; v.z -= hz * 14 * dt; }      // скатывается со склона
        if (v.lengthSq() < 0.6) { v.set(0, 0, 0); it.rest += dt; } else it.rest = 0;
      }
      // здания и стены
      for (const b of boxes) {
        const x0 = b.x0 ?? b.min.x, x1 = b.x1 ?? b.max.x, y0 = b.y0 ?? b.min.y, y1 = b.y1 ?? b.max.y, z0 = b.z0 ?? b.min.z, z1 = b.z1 ?? b.max.z;
        if (p.x < x0 - r || p.x > x1 + r || p.z < z0 - r || p.z > z1 + r || p.y < y0 - r || p.y > y1 + r) continue;
        const dx0 = p.x - (x0 - r), dx1 = (x1 + r) - p.x, dz0 = p.z - (z0 - r), dz1 = (z1 + r) - p.z, dy1 = (y1 + r) - p.y, m = Math.min(dx0, dx1, dz0, dz1, dy1);
        if (m === dy1) { p.y = y1 + r; if (v.y < 0) v.y *= -mat.bounce; } else if (m === dx0) { p.x = x0 - r; v.x = -Math.abs(v.x) * mat.bounce; } else if (m === dx1) { p.x = x1 + r; v.x = Math.abs(v.x) * mat.bounce; } else if (m === dz0) { p.z = z0 - r; v.z = -Math.abs(v.z) * mat.bounce; } else { p.z = z1 + r; v.z = Math.abs(v.z) * mat.bounce; }
        if (it.hitCd <= 0 && v.length() > 10 && env.thud) { env.thud(p, it, v.length()); it.hitCd = 0.3; }
      }
      // существа: быстрый предмет бьёт
      if (it.hitCd <= 0 && v.length() > 7) {
        const J = energyJ(it);
        for (const b of env.bodies()) if (Math.hypot(b.x - p.x, b.z - p.z) < b.r + r + 0.9 && p.y > b.y - 1 && p.y < b.y + 10.5) { env.onHit(it, b, J); v.multiplyScalar(-0.25); v.y = Math.abs(v.y) * 0.3 + 3; it.hitCd = 0.5; break; }
      }
      // тепло: огонь рядом греет, вода и дождь остужают; дерево и ткань загораются, металл раскаляется, лёд тает
      const nearFire = env.fireNear(p.x, p.z, 4 + r), wet = env.wetAt(p.x, p.z) || it.wet > 0.3;
      if (nearFire && !wet) it.T += 190 * dt; if (it.burn) it.T = Math.max(it.T, 420);
      it.T += (15 - it.T) * Math.min(1, dt * (mat.cond ? 0.22 : 0.4) * (wet ? 4 : 1)); it.wet = Math.max(0, it.wet - dt * 0.05);
      if (wet && it.burn) { it.burn = 0; env.puff(p, 'steam', 10); it.T = Math.min(it.T, 120); }
      if (mat.flam && !it.burn && it.T > mat.flam && !wet) { it.burn = 1; it.burnT = mat.burnT * Math.sqrt(Math.max(0.05, it.m) / 2 + 0.5); it.burnMax = it.burnT; }
      if (it.burn) {
        it.burnT -= dt; if (Math.random() < dt * 24) env.puff(p, 'fire', 1); if (Math.random() < dt * 2) env.ignite(p.x, p.y, p.z, 2.2);
        it.scale = Math.max(0.25, Math.sqrt(Math.max(0, it.burnT) / it.burnMax)); if (it.burnT <= 0) { env.puff(p, 'ash', 14); remove(it); continue; }
      }
      if (it.ice && it.T > 1) { it.scale -= dt * 0.04 * (it.T / 30 + 0.3); if (Math.random() < dt * 4) env.puff(p, 'steam', 1); if (it.scale < 0.25) { env.melt(p); remove(it); continue; } }
      const glow = Math.max(0, Math.min(1, (it.T - 350) / 500)); if (mat.cond || it.burn) { const b = it.burn ? 0.7 + 0.3 * Math.random() : glow; it.M.emissive.setRGB(b, b * 0.35, b * 0.05); } else it.M.emissive.setRGB(0, 0, 0);
      // положение и поворот
      it.g.position.copy(p); it.g.scale.setScalar(it.scale);
      const sp = v.length();
      if (it.long && sp > 8) { _q.setFromUnitVectors(_x, _t.copy(v).normalize()); it.g.quaternion.copy(_q); }
      else if (sp > 3 && !it.held) { it.g.rotation.x += it.tumble.x * dt * 2; it.g.rotation.z += it.tumble.z * dt * 2; it.g.rotation.y += dt * (it.spin || 1.4); }
      else { it.g.rotation.x *= 1 - Math.min(1, dt * 6); it.g.rotation.z *= 1 - Math.min(1, dt * 6); it.g.rotation.y = it.yaw; }
    }
  }
  const _q = new THREE.Quaternion(), _x = new V(1, 0, 0), _t = new V();
  const inWaterGround = p => hAt(p.x, p.z) < 0.3;
  return { items, spawn, remove, setMat, step, energyJ, speedMS, makeWorld, activate };
}
