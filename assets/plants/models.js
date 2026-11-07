// Библиотека растений для фильма «Ниндзи». 1 единица = 1 условный метр, персонаж ≈ 6.5.
// Низ модели на y=0, центр основания в (0,0), «лицо» смотрит в +z.
const TAU = Math.PI * 2;

function rng(seed) {
  let s = ((seed | 0) * 2654435761 + 1013904223) >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const caches = new WeakMap();
function mat(T, color, o = {}) {
  let c = caches.get(T); if (!c) { c = new Map(); caches.set(T, c); }
  const key = color + JSON.stringify(o);
  if (!c.has(key)) c.set(key, new T.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...o }));
  return c.get(key);
}
const vcMat = (T) => mat(T, 0xffffff, { vertexColors: true, side: T.DoubleSide });
const dbl = (T, color) => mat(T, color, { side: T.DoubleSide });
function tint(T, hex, rnd, amt = 0.015) {
  const c = new T.Color(hex); c.offsetHSL(0, 0, (Math.floor(rnd() * 5) - 2) * amt); return c.getHex();
}
function grp(T, name, parent) { const g = new T.Group(); g.name = name; if (parent) parent.add(g); return g; }
function mesh(T, geo, m, x = 0, y = 0, z = 0, parent, cast = true) {
  const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true;
  if (parent) parent.add(o); return o;
}
function jit(geo, amt, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = (a) => { const s = Math.sin((x * 12.9898 + y * 78.233 + z * 37.719 + a * 5.17 + seed * 3.1) * 43758.5453); return s - Math.floor(s) - 0.5; };
    p.setXYZ(i, x + h(1) * amt, y + h(2) * amt, z + h(3) * amt);
  }
  geo.computeVertexNormals(); return geo;
}
function blob(T, r, sc, detail, amt, seed) {
  const g = new T.IcosahedronGeometry(r, detail); g.scale(sc[0], sc[1], sc[2]); return jit(g, amt, seed);
}
// конус/цилиндр с наклоном в точку
function rod(T, r0, r1, len, seg, m, from, to, parent) {
  const a = new T.Vector3(...from), b = new T.Vector3(...to);
  const d = b.clone().sub(a); const L = d.length();
  const geo = new T.CylinderGeometry(r1, r0, L, seg);
  const o = new T.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true;
  o.position.copy(a.clone().add(b).multiplyScalar(0.5));
  o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  if (parent) parent.add(o); return o;
}
// качание
function swayer() {
  const list = [];
  return {
    add(obj, ax, az, f, ph) { list.push({ obj, bx: obj.rotation.x, bz: obj.rotation.z, ax, az, f, ph }); },
    update(t) {
      for (const s of list) {
        s.obj.rotation.x = s.bx + s.ax * Math.sin(t * s.f + s.ph);
        s.obj.rotation.z = s.bz + s.az * Math.sin(t * s.f * 0.83 + s.ph * 1.7);
      }
    }
  };
}
// конический ствол по кривой
function taperTube(T, fn, r0, r1, segs, radial, bump = 0) {
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = fn(t);
    const tan = fn(Math.min(1, t + 0.01)).sub(fn(Math.max(0, t - 0.01))).normalize();
    const ref = Math.abs(tan.z) > 0.9 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 0, 1);
    const n1 = ref.clone().cross(tan).normalize(), n2 = tan.clone().cross(n1);
    const r = (r0 + (r1 - r0) * t) * (1 + (i % 2 ? bump : -bump));
    for (let j = 0; j < radial; j++) {
      const a = j / radial * TAU;
      pos.push(c.x + (n1.x * Math.cos(a) + n2.x * Math.sin(a)) * r, c.y + (n1.y * Math.cos(a) + n2.y * Math.sin(a)) * r, c.z + (n1.z * Math.cos(a) + n2.z * Math.sin(a)) * r);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
    idx.push(a, b, c, b, d, c);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// перистый лист (пальма / папоротник): основание в 0, растёт вдоль +x
function frondGeo(T, o) {
  const { len = 8, width = 2.5, up = 1, droop = 1.2, segs = 10, drop = 0.6, fwd = 0.35, c1 = 0x2f7a3a, c2 = 0x6cb04a, rnd } = o;
  const pts = []; for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push(new T.Vector3(len * t, len * (up * t - droop * t * t), 0)); }
  const pos = [], col = [], ca = new T.Color(c1), cb = new T.Color(c2);
  const push = (v, c) => { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); };
  for (let i = 0; i < segs; i++) {
    const t = (i + 0.5) / segs, w = width * Math.sin(Math.PI * Math.pow(t, 0.75)) * (0.85 + rnd() * 0.3);
    const a = pts[i], b = pts[i + 1], m = a.clone().add(b).multiplyScalar(0.5), d = b.clone().sub(a).normalize();
    for (const s of [1, -1]) {
      const tip = m.clone().add(new T.Vector3(0, -drop * w, s * w)).add(d.clone().multiplyScalar(fwd * w));
      const cc = ca.clone().lerp(cb, 0.55 + rnd() * 0.45), mid = ca.clone().lerp(cb, 0.25);
      if (s > 0) { push(a, mid); push(b, mid); push(tip, cc); } else { push(a, mid); push(tip, cc); push(b, mid); }
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
// пучок травинок (одна геометрия, вертексные цвета)
function bladesGeo(T, rnd, n, o) {
  const { hmin = 1, hmax = 2, spread = 1.5, w = 0.25, bend = 0.3, c1 = 0x3f7f35, c2 = 0x8cc24e, tips } = o;
  const pos = [], col = [], ca = new T.Color(c1), cb = new T.Color(c2);
  const V = (x, y, z, c) => { pos.push(x, y, z); col.push(c.r, c.g, c.b); };
  for (let k = 0; k < n; k++) {
    const ang = rnd() * TAU, rad = spread * Math.sqrt(rnd()), bx = Math.cos(ang) * rad, bz = Math.sin(ang) * rad;
    const h = hmin + rnd() * (hmax - hmin), la = ang + (rnd() - 0.5) * 1.2, lean = bend * (0.3 + rnd() * 0.7) * h;
    const f = rnd() * Math.PI, sx = Math.cos(f), sz = Math.sin(f), ww = w * (0.7 + rnd() * 0.6);
    const tc = ca.clone().lerp(cb, 0.1 + rnd() * 0.2), tt = cb.clone().lerp(ca, rnd() * 0.3);
    const lv = [0, 0.5, 1].map((t) => ({ t, x: bx + Math.cos(la) * lean * t * t, y: h * t * (1 - 0.1 * t), z: bz + Math.sin(la) * lean * t * t, w: ww * (1 - t * 0.9) }));
    const [l0, l1, l2] = lv, mc = ca.clone().lerp(cb, 0.5);
    const L = (l, s) => [l.x + sx * l.w * s, l.y, l.z + sz * l.w * s];
    const a = L(l0, -1), b = L(l0, 1), c = L(l1, -1), d = L(l1, 1);
    V(...a, tc); V(...b, tc); V(...c, mc); V(...b, tc); V(...d, mc); V(...c, mc);
    V(...c, mc); V(...d, mc); V(l2.x, l2.y, l2.z, tt);
    if (tips) tips.push([l2.x, l2.y, l2.z]);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}

export const MODELS = [];
const def = (id, name, make) => MODELS.push({ id, name, group: 'plants', make });

/* ============================= ЁЛКИ ============================= */
function conifer(T, seed, k, o) {
  const rnd = rng(seed * 7 + k), g = new T.Group(); g.name = 'Conifer';
  const body = grp(T, 'Body', g), H = o.h * (0.93 + rnd() * 0.14), R = o.R * (0.93 + rnd() * 0.14);
  mesh(T, new T.CylinderGeometry(o.trunkR * 0.7, o.trunkR, o.trunkH + H * 0.3, 6), mat(T, 0x6b4527), 0, (o.trunkH + H * 0.3) / 2, 0, body);
  const fh = H - o.trunkH, n = o.tiers, th = fh / n * o.over;
  const snowM = mat(T, 0xf4f8fb, { roughness: 0.7 });
  for (let i = 0; i < n; i++) {
    const yb = o.trunkH + (fh - th) * (i / (n - 1)), r = R * (1 - 0.8 * i / (n - 1));
    const cone = jit(new T.ConeGeometry(r, th, o.seg), r * 0.07, seed + i);
    cone.rotateY(rnd() * TAU);
    mesh(T, cone, mat(T, tint(T, o.col, rnd)), 0, yb + th / 2, 0, body);
    if (o.snow) {
      const cap = jit(new T.ConeGeometry(r * 0.66 * 1.1, th * 0.66, o.seg), r * 0.05, seed + 40 + i);
      mesh(T, cap, snowM, 0, yb + th - th * 0.33 + 0.1, 0, body);
    }
  }
  if (o.snow) mesh(T, new T.CylinderGeometry(R * 0.35, R * 0.5, 0.25, 8), snowM, 0, 0.1, 0, body, false);
  return g;
}
def('fir_tall', 'Ель высокая', (T, s = 0) => conifer(T, s, 1, { h: 26, R: 6.2, tiers: 6, trunkH: 2.5, trunkR: 0.9, seg: 9, over: 1.9, col: 0x2f6b3a }));
def('fir_wide', 'Ель широкая', (T, s = 0) => conifer(T, s, 2, { h: 17, R: 8.4, tiers: 4, trunkH: 2.2, trunkR: 1.1, seg: 10, over: 1.7, col: 0x3a7a3e }));
def('fir_young', 'Ёлочка молодая', (T, s = 0) => conifer(T, s, 3, { h: 14, R: 3.8, tiers: 4, trunkH: 2.5, trunkR: 0.5, seg: 8, over: 1.8, col: 0x5fa04a }));
def('fir_snow', 'Ель заснеженная', (T, s = 0) => conifer(T, s, 4, { h: 21, R: 6, tiers: 5, trunkH: 2.2, trunkR: 0.9, seg: 9, over: 1.8, col: 0x2d6a46, snow: true }));

/* ============================= ПАЛЬМЫ ============================= */
function palm(T, seed, k, o) {
  const rnd = rng(seed * 11 + k), g = new T.Group(); g.name = 'Palm';
  const P0 = new T.Vector3(0, 0, 0), P1 = new T.Vector3(...o.mid), P2 = new T.Vector3(...o.top);
  const curve = (t) => P0.clone().multiplyScalar((1 - t) * (1 - t)).add(P1.clone().multiplyScalar(2 * (1 - t) * t)).add(P2.clone().multiplyScalar(t * t));
  const trunk = grp(T, 'Trunk', g);
  mesh(T, taperTube(T, curve, o.r0, o.r1, 14, 7, 0.07), dbl(T, 0xa8794a), 0, 0, 0, trunk);
  const crown = grp(T, 'Crown', g); crown.position.copy(P2);
  mesh(T, jit(new T.IcosahedronGeometry(o.r1 * 1.3, 0), 0.1, seed), mat(T, 0x6b5a2e), 0, 0.2, 0, crown);
  const sw = swayer(), fm = vcMat(T);
  for (let i = 0; i < o.fronds; i++) {
    const pivot = grp(T, 'Frond', crown); pivot.rotation.y = i / o.fronds * TAU + rnd() * 0.4;
    pivot.position.y = 0.3;
    const tilt = grp(T, 'FrondTilt', pivot); tilt.rotation.z = o.tilt + (rnd() - 0.5) * 0.4;
    const fg = frondGeo(T, { len: o.fl * (0.9 + rnd() * 0.2), width: o.fw, up: 1.0, droop: 1.25, segs: 12, drop: 0.9, c1: 0x2f7a35, c2: 0x7cbd48, rnd });
    mesh(T, fg, fm, 0, 0, 0, tilt);
    sw.add(tilt, 0, 0.07, 1.3 + rnd() * 0.5, rnd() * TAU);
  }
  if (o.coco) {
    const cm = mat(T, 0x7b5a2e);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU;
      mesh(T, jit(new T.IcosahedronGeometry(0.75, 1), 0.08, seed + i), cm, Math.cos(a) * 1.1, -1.0 - rnd() * 0.5, Math.sin(a) * 1.1, crown);
    }
  }
  sw.add(crown, 0.025, 0.035, 0.9, rnd() * TAU);
  g.userData.animate = sw.update;
  return g;
}
def('palm_straight', 'Пальма прямая', (T, s = 0) => palm(T, s, 1, { mid: [0.5, 12, 0.3], top: [1.2, 24, 0], r0: 1.4, r1: 0.8, fronds: 10, fl: 10, fw: 2.6, tilt: 0.25 }));
def('palm_lean', 'Пальма наклонная', (T, s = 0) => palm(T, s, 2, { mid: [1, 14, 0], top: [9, 20, 2], r0: 1.4, r1: 0.8, fronds: 9, fl: 9.5, fw: 2.6, tilt: 0.3 }));
def('palm_coco', 'Пальма с кокосами', (T, s = 0) => palm(T, s, 3, { mid: [-0.6, 12, 0.5], top: [-1.5, 25, 0], r0: 1.5, r1: 0.85, fronds: 11, fl: 10.5, fw: 2.8, tilt: 0.2, coco: true }));
def('palm_short', 'Пальма низкая', (T, s = 0) => palm(T, s, 4, { mid: [0, 9, 0.5], top: [1, 18, 0], r0: 1.9, r1: 1.2, fronds: 9, fl: 9, fw: 3.2, tilt: 0.45 }));

/* ============================= ЛИСТВЕННЫЕ ============================= */
def('oak', 'Дуб', (T, s = 0) => {
  const rnd = rng(s * 5 + 21), g = new T.Group(); g.name = 'Oak'; const body = grp(T, 'Body', g);
  const tm = mat(T, 0x6b4527);
  mesh(T, taperTube(T, (t) => new T.Vector3(0.4 * Math.sin(t * 3), t * 11, 0), 2.1, 1.3, 5, 8), dbl(T, 0x6b4527), 0, 0, 0, body);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + rnd(); mesh(T, new T.ConeGeometry(0.8, 3, 5), tm, Math.cos(a) * 1.6, 0.7, Math.sin(a) * 1.6, body).rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); }
  rod(T, 0.6, 0.4, 0, 5, tm, [0, 8, 0], [-4, 11.5, 0], body); rod(T, 0.6, 0.4, 0, 5, tm, [0, 8.5, 0], [4, 11.5, -0.5], body);
  const B = [[0, 12.5, 0, 5.2], [-4.2, 11, 1.2, 3.9], [4.1, 11.3, -1, 4.1], [0.8, 16, 0.5, 3.8], [-1.5, 11.2, -4, 3.6], [2, 11.2, 4, 3.7]];
  B.forEach(([x, y, z, r], i) => mesh(T, blob(T, r * (0.9 + rnd() * 0.2), [1, 0.85, 1], 1, 0.7, s + i), mat(T, tint(T, i % 2 ? 0x4f8f3a : 0x5c9c40, rnd)), x + rnd() - 0.5, y, z + rnd() - 0.5, body));
  return g;
});
def('birch', 'Берёза светлая', (T, s = 0) => {
  const rnd = rng(s * 5 + 22), g = new T.Group(); g.name = 'Birch'; const body = grp(T, 'Body', g);
  const curve = (t) => new T.Vector3(1.0 * t * t, t * 15, 0.3 * Math.sin(t * 3));
  mesh(T, taperTube(T, curve, 0.95, 0.5, 8, 6), dbl(T, 0xece6d8), 0, 0, 0, body);
  const dark = mat(T, 0x2a2622);
  for (let i = 0; i < 9; i++) { const t = 0.08 + rnd() * 0.8, c = curve(t), a = rnd() * TAU, r = 0.95 - t * 0.45; const m = mesh(T, new T.BoxGeometry(0.5, 0.18, 0.12), dark, c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r, body, false); m.rotation.y = -a + Math.PI / 2; }
  rod(T, 0.3, 0.2, 0, 4, mat(T, 0xece6d8), [0.3, 9, 0], [-2.5, 13, 0.8], body); rod(T, 0.3, 0.2, 0, 4, mat(T, 0xece6d8), [0.5, 11, 0], [3, 14, -0.6], body);
  const B = [[1.2, 16, 0, 3, 1.35], [3.3, 13.5, -0.6, 2.3, 1.2], [-2.5, 13.7, 0.9, 2.5, 1.2], [1.4, 19, 0, 2.2, 1.3], [0, 11, 1, 2, 1.1]];
  B.forEach(([x, y, z, r, sy], i) => mesh(T, blob(T, r, [0.85, sy, 0.85], 1, 0.5, s + i), mat(T, tint(T, i % 2 ? 0x9fcf5a : 0xb2d868, rnd)), x, y, z, body));
  return g;
});
def('willow', 'Ива тёмная', (T, s = 0) => {
  const rnd = rng(s * 5 + 23), g = new T.Group(); g.name = 'Willow'; const body = grp(T, 'Body', g);
  mesh(T, taperTube(T, (t) => new T.Vector3(1.5 * t * t - 0.3, t * 8, 0), 1.9, 1.2, 6, 7), dbl(T, 0x4a3322), 0, 0, 0, body);
  const gm = 0x2f5e37;
  [[0.8, 9.5, 0, 4.6], [-2.4, 8.8, 1, 3.2], [3, 8.9, -1, 3.4]].forEach(([x, y, z, r], i) => mesh(T, blob(T, r, [1, 0.6, 1], 1, 0.6, s + i), mat(T, tint(T, gm, rnd)), x, y, z, body));
  const sw = swayer(), n = 28, sm = mat(T, 0x46793f);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + rnd() * 0.3, r = 3.2 + rnd() * 2.6;
    const p = grp(T, 'Strand', body); p.position.set(0.8 + Math.cos(a) * r, 9.2 - r * 0.15, Math.sin(a) * r);
    const len = 5.5 + rnd() * 3.5;
    mesh(T, new T.ConeGeometry(0.55, len, 4).rotateX(Math.PI).translate(0, -len / 2, 0), sm, 0, 0, 0, p, false);
    sw.add(p, 0.05, 0.05, 1.1 + rnd() * 0.5, rnd() * TAU);
  }
  g.userData.animate = sw.update; return g;
});

/* ============================= КУСТЫ ============================= */
function bushBase(T, s, k, col, spec) {
  const rnd = rng(s * 3 + k), g = new T.Group(); g.name = 'Bush'; const body = grp(T, 'Body', g); const cs = [];
  spec.forEach(([x, y, z, r, sy], i) => { const bx = x + (rnd() - 0.5) * 0.4, bz = z + (rnd() - 0.5) * 0.4; mesh(T, blob(T, r, [1, sy || 0.85, 1], 1, 0.35, s + i), mat(T, tint(T, col, rnd)), bx, y, bz, body); cs.push([bx, y, bz, r, sy || 0.85]); });
  return { g, body, cs, rnd };
}
function dots(T, b, n, r, colors, hasDisc) {
  for (let i = 0; i < n; i++) {
    const c = b.cs[Math.floor(b.rnd() * b.cs.length)], a = b.rnd() * TAU, e = 0.15 + b.rnd() * 1.1;
    const dx = Math.cos(a) * Math.cos(e), dy = Math.sin(e), dz = Math.sin(a) * Math.cos(e);
    const col = colors[Math.floor(b.rnd() * colors.length)];
    mesh(T, new T.IcosahedronGeometry(r, 0), mat(T, col), c[0] + dx * c[3] * 0.97, c[1] + dy * c[3] * c[4] * 0.97, c[2] + dz * c[3] * 0.97, b.body, false);
  }
}
def('bush_green', 'Куст зелёный', (T, s = 0) => bushBase(T, s, 1, 0x4f9440, [[0, 1.6, 0, 2.4], [-2, 1.3, 0.6, 1.9], [2, 1.4, -0.4, 2], [0.2, 2.5, -0.5, 1.7], [-0.5, 1.2, 2, 1.6]]).g);
def('bush_berry', 'Куст с ягодами', (T, s = 0) => { const b = bushBase(T, s, 2, 0x3f8a3c, [[0, 1.5, 0, 2.1], [-1.9, 1.2, 0.5, 1.6], [1.8, 1.3, 0.3, 1.7], [0, 1.2, 1.9, 1.5], [0.2, 2.4, -0.4, 1.4]]); dots(T, b, 18, 0.28, [0xc62b3a, 0xd8343f, 0x8a1d3a]); return b.g; });
def('bush_thorn', 'Куст колючий сухой', (T, s = 0) => {
  const rnd = rng(s * 3 + 3), g = new T.Group(); g.name = 'Bush'; const body = grp(T, 'Body', g);
  const mats = [mat(T, 0x7a6648), mat(T, 0x5c4a33)], thorn = mat(T, 0x3b2f20), leaf = mat(T, 0xb89a55);
  mesh(T, new T.CylinderGeometry(0.5, 0.8, 0.8, 6), mats[1], 0, 0.3, 0, body);
  for (let i = 0; i < 20; i++) {
    const a = rnd() * TAU, h = 2.6 + rnd() * 2, sp = 1.3 + rnd() * 2.2, m = mats[i % 2];
    const p1 = [Math.cos(a) * sp * 0.5, h * 0.55, Math.sin(a) * sp * 0.5], p2 = [Math.cos(a + 0.3) * sp, h, Math.sin(a + 0.3) * sp];
    rod(T, 0.2, 0.12, 0, 4, m, [0, 0.4, 0], p1, body); rod(T, 0.12, 0.05, 0, 4, m, p1, p2, body);
    const th = mesh(T, new T.ConeGeometry(0.1, 0.5, 3), thorn, p1[0], p1[1], p1[2], body, false); th.rotation.set(rnd() * 3, 0, rnd() * 3);
    if (i % 3 == 0) mesh(T, new T.IcosahedronGeometry(0.3, 0), leaf, p2[0], p2[1], p2[2], body, false);
  }
  return g;
});
def('bush_flower', 'Куст цветущий', (T, s = 0) => { const b = bushBase(T, s, 4, 0x4a8f45, [[0, 1.4, 0, 1.9], [-1.7, 1.1, 0.4, 1.5], [1.6, 1.2, -0.2, 1.6], [0, 2.1, -0.3, 1.3], [0.3, 1.1, 1.6, 1.3]]); dots(T, b, 22, 0.38, [0xf08ab0, 0xf4a6c4, 0xffffff, 0xe86a8f]); return b.g; });

/* ============================= ТРАВА ============================= */
function stalk(T, parent, sw, rnd, x, z, h, lean, col, head) {
  const p = grp(T, 'Stalk', parent); p.position.set(x, 0, z); p.rotation.set((rnd() - 0.5) * lean, 0, (rnd() - 0.5) * lean);
  mesh(T, new T.CylinderGeometry(0.05, 0.09, h, 4).translate(0, h / 2, 0), mat(T, col), 0, 0, 0, p, false);
  head(p, h); sw.add(p, 0.08, 0.08, 1.4 + rnd() * 0.6, rnd() * TAU); return p;
}
function tuft(T, s, k, name, bo, extra) {
  const rnd = rng(s * 13 + k), g = new T.Group(); g.name = name; const sw = swayer();
  const blades = grp(T, 'Blades', g);
  mesh(T, bladesGeo(T, rnd, bo.n, bo), vcMat(T), 0, 0, 0, blades, false);
  sw.add(blades, 0.04, 0.05, 1.3, rnd() * TAU);
  if (extra) extra(g, sw, rnd);
  g.userData.animate = sw.update; return g;
}
def('grass_low', 'Трава низкая', (T, s = 0) => tuft(T, s, 1, 'Grass', { n: 28, hmin: 1.3, hmax: 2.6, spread: 1.7, w: 0.22, bend: 0.3 }));
def('grass_tall', 'Трава высокая', (T, s = 0) => tuft(T, s, 2, 'Grass', { n: 24, hmin: 4, hmax: 6.5, spread: 1.4, w: 0.3, bend: 0.5, c1: 0x3a7a33, c2: 0xa0cc58 }));
def('grass_wheat', 'Трава с колосьями', (T, s = 0) => tuft(T, s, 3, 'Grass', { n: 14, hmin: 2, hmax: 3.5, spread: 1.4, w: 0.2, bend: 0.3, c1: 0x6b8a38, c2: 0xb8c05a }, (g, sw, rnd) => {
  for (let i = 0; i < 9; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * 1.3, h = 4.2 + rnd() * 1.8;
    stalk(T, g, sw, rnd, Math.cos(a) * r, Math.sin(a) * r, h, 0.3, 0xc8b55a, (p, hh) => { const e = mesh(T, blob(T, 0.3, [1, 2.8, 1], 0, 0.05, i), mat(T, 0xdcb54c), 0, hh + 0.35, 0, p, false); }); }
}));
def('grass_flowers', 'Трава с цветами', (T, s = 0) => tuft(T, s, 4, 'Grass', { n: 24, hmin: 1.6, hmax: 3, spread: 1.6, w: 0.22, bend: 0.3 }, (g, sw, rnd) => {
  const cols = [0xe8453a, 0xf5d440, 0xffffff, 0x9a6ad8, 0xf08ab0];
  for (let i = 0; i < 7; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * 1.4, h = 3 + rnd() * 1.8, c = cols[i % cols.length];
    stalk(T, g, sw, rnd, Math.cos(a) * r, Math.sin(a) * r, h, 0.25, 0x4f8f3f, (p, hh) => {
      mesh(T, new T.CircleGeometry(0.6, 7).rotateX(-Math.PI / 2 + 0.3), dbl(T, c), 0, hh + 0.05, 0, p, false);
      mesh(T, new T.IcosahedronGeometry(0.28, 0), mat(T, 0xf0a020), 0, hh + 0.2, 0, p, false); }); }
}));

/* ============================= КЛУМБЫ ============================= */
function bed(T, s, k, name, fl) {
  const rnd = rng(s * 17 + k), g = new T.Group(); g.name = name; const base = grp(T, 'Base', g), fs = grp(T, 'Flowers', g);
  mesh(T, new T.CylinderGeometry(4, 4.3, 0.9, 12), mat(T, 0x5a3b25), 0, 0.45, 0, base);
  mesh(T, new T.CylinderGeometry(3.7, 3.9, 0.12, 12), mat(T, 0x4a3020), 0, 0.92, 0, base, false);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; const st = mesh(T, new T.DodecahedronGeometry(0.75, 0), mat(T, tint(T, 0x9b958c, rnd)), Math.cos(a) * 4.3, 0.5, Math.sin(a) * 4.3, base); st.scale.set(1, 0.7, 1.3); st.rotation.y = -a; }
  mesh(T, bladesGeo(T, rnd, 36, { hmin: 1, hmax: 1.9, spread: 3.4, w: 0.25, bend: 0.4, c1: 0x3b7a33, c2: 0x6fae48 }), vcMat(T), 0, 0.9, 0, fs, false);
  const sw = swayer(); const sm = mat(T, 0x4f8f3f);
  for (let i = 0; i < 20; i++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * 3.4, h = 1.4 + rnd() * 1.6 + (1 - r / 3.4) * 0.6;
    const p = grp(T, 'Flower', fs); p.position.set(Math.cos(a) * r, 0.9, Math.sin(a) * r); p.rotation.set((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25);
    mesh(T, new T.CylinderGeometry(0.05, 0.07, h, 4).translate(0, h / 2, 0), sm, 0, 0, 0, p, false);
    fl(p, h, i, rnd); sw.add(p, 0.05, 0.05, 1.2 + rnd() * 0.5, rnd() * TAU);
  }
  g.userData.animate = sw.update; return g;
}
def('flowerbed_daisy', 'Клумба ромашки', (T, s = 0) => bed(T, s, 1, 'Flowerbed', (p, h, i) => {
  mesh(T, new T.CircleGeometry(0.62, 8).rotateX(-Math.PI / 2 + 0.25), dbl(T, i % 4 ? 0xffffff : 0xfff0a0), 0, h, 0, p, false);
  mesh(T, new T.IcosahedronGeometry(0.25, 0), mat(T, 0xf0b020), 0, h + 0.1, 0, p, false);
}));
def('flowerbed_tulip', 'Клумба тюльпаны', (T, s = 0) => bed(T, s, 2, 'Flowerbed', (p, h, i) => {
  const c = [0xd8343f, 0xf08a2a, 0xf5d440, 0xe86a8f][i % 4];
  mesh(T, blob(T, 0.42, [1, 1.5, 1], 0, 0.04, i), mat(T, c), 0, h + 0.2, 0, p, false);
  mesh(T, new T.ConeGeometry(0.4, 0.4, 5), mat(T, c), 0, h + 0.75, 0, p, false);
}));
def('flowerbed_mixed', 'Клумба колокольчики', (T, s = 0) => bed(T, s, 3, 'Flowerbed', (p, h, i) => {
  if (i % 2) { mesh(T, new T.ConeGeometry(0.45, 0.8, 6).rotateX(Math.PI), mat(T, i % 4 == 1 ? 0x8a6ad8 : 0x5a8ae0), 0, h, 0, p, false); }
  else { mesh(T, new T.IcosahedronGeometry(0.45, 0), mat(T, 0xf08ab0), 0, h, 0, p, false); mesh(T, new T.IcosahedronGeometry(0.2, 0), mat(T, 0xfff0a0), 0, h + 0.3, 0, p, false); }
}));

/* ============================= КАМЫШ / ЛИЛИИ ============================= */
def('reed_cattail', 'Рогоз (камыш с початками)', (T, s = 0) => {
  const rnd = rng(s * 19 + 1), g = new T.Group(); g.name = 'Reed'; const sw = swayer();
  const leaves = grp(T, 'Leaves', g);
  mesh(T, bladesGeo(T, rnd, 16, { hmin: 6, hmax: 10, spread: 1.6, w: 0.35, bend: 0.25, c1: 0x3b7a3a, c2: 0x7ab04e }), vcMat(T), 0, 0, 0, leaves, false);
  sw.add(leaves, 0.04, 0.05, 1.1, rnd() * TAU);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * 1.4, h = 8.5 + rnd() * 3;
    const p = grp(T, 'Stalk', g); p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); p.rotation.set((rnd() - 0.5) * 0.15, 0, (rnd() - 0.5) * 0.15);
    mesh(T, new T.CylinderGeometry(0.07, 0.12, h, 5).translate(0, h / 2, 0), mat(T, 0x6a9a44), 0, 0, 0, p, false);
    mesh(T, new T.CylinderGeometry(0.33, 0.33, 1.7, 6).translate(0, h - 1.6, 0), mat(T, 0x6b4527), 0, 0, 0, p, false);
    mesh(T, new T.ConeGeometry(0.33, 0.5, 6).translate(0, h - 0.5, 0), mat(T, 0x6b4527), 0, 0, 0, p, false);
    mesh(T, new T.CylinderGeometry(0.06, 0.06, 0.8, 4).translate(0, h + 0.2, 0), mat(T, 0xb89a55), 0, 0, 0, p, false);
    sw.add(p, 0.06, 0.07, 1.2 + rnd() * 0.5, rnd() * TAU);
  }
  g.userData.animate = sw.update; return g;
});
def('reed_plain', 'Тростник с метёлками', (T, s = 0) => {
  const rnd = rng(s * 19 + 2), g = new T.Group(); g.name = 'Reed'; const sw = swayer();
  const leaves = grp(T, 'Leaves', g);
  mesh(T, bladesGeo(T, rnd, 14, { hmin: 3, hmax: 6, spread: 1.8, w: 0.3, bend: 0.5, c1: 0x5a8a3a, c2: 0xa6c45a }), vcMat(T), 0, 0, 0, leaves, false);
  sw.add(leaves, 0.04, 0.05, 1.0, rnd() * TAU);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * 1.7, h = 9 + rnd() * 4;
    const p = grp(T, 'Stalk', g); p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); p.rotation.set((rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2);
    mesh(T, new T.CylinderGeometry(0.06, 0.12, h, 5).translate(0, h / 2, 0), mat(T, 0xb2a560), 0, 0, 0, p, false);
    const pl = mesh(T, blob(T, 0.4, [1, 3.2, 1], 0, 0.08, i), mat(T, tint(T, 0xb59a7a, rnd)), 0.35, h + 0.2, 0, p, false); pl.rotation.z = -0.35;
    sw.add(p, 0.06, 0.08, 1.0 + rnd() * 0.5, rnd() * TAU);
  }
  g.userData.animate = sw.update; return g;
});
def('waterlily', 'Водяные лилии', (T, s = 0) => {
  const rnd = rng(s * 23 + 1), g = new T.Group(); g.name = 'Waterlily'; const f = grp(T, 'Float', g); f.position.y = 0.05;
  const pads = [[0, 0, 2.4], [3.6, 1.2, 1.7], [-3, 1.8, 1.9], [0.8, -3.3, 1.6], [-2.4, -2.2, 1.3]];
  pads.forEach(([x, z, r], i) => { const geo = new T.CircleGeometry(r, 14, 0.3, TAU - 0.5).rotateX(-Math.PI / 2); const m = mesh(T, geo, dbl(T, i % 2 ? 0x3f8f4a : 0x4fa053), x, 0, z, f, false); m.receiveShadow = true; m.rotation.y = rnd() * TAU; });
  [[0.4, 0.2, 1], [-2.8, 1.8, 0.75]].forEach(([x, z, sc]) => {
    const fl = grp(T, 'Blossom', f); fl.position.set(x, 0.1, z); fl.scale.setScalar(sc);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const pet = mesh(T, new T.ConeGeometry(0.4, 1.5, 4).translate(0, 0.75, 0), mat(T, i % 2 ? 0xf8f1f0 : 0xf6c6d8, { side: T.DoubleSide }), Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, fl, false); pet.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); }
    mesh(T, new T.IcosahedronGeometry(0.3, 0), mat(T, 0xf5d440), 0, 0.5, 0, fl, false);
  });
  g.userData.animate = (t) => { f.position.y = 0.05 + Math.sin(t * 1.2) * 0.04; f.rotation.y = Math.sin(t * 0.4) * 0.05; f.rotation.z = Math.sin(t * 0.9) * 0.01; };
  return g;
});

/* ============================= ПЕНЬКИ И БРЁВНА ============================= */
def('stump_a', 'Пень с корнями', (T, s = 0) => {
  const rnd = rng(s * 29 + 1), g = new T.Group(); g.name = 'Stump'; const b = grp(T, 'Body', g);
  mesh(T, jit(new T.CylinderGeometry(2.0, 2.5, 2.8, 10), 0.12, s), mat(T, 0x7a5232), 0, 1.4, 0, b);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + rnd(); const c = mesh(T, new T.ConeGeometry(0.8, 3.2, 5), mat(T, 0x6b4527), Math.cos(a) * 2.4, 0.5, Math.sin(a) * 2.4, b); c.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15); }
  mesh(T, new T.CircleGeometry(2.0, 10).rotateX(-Math.PI / 2), mat(T, 0xd9b27c), 0, 2.81, 0, b, false);
  mesh(T, new T.RingGeometry(0.7, 0.8, 10).rotateX(-Math.PI / 2), mat(T, 0xb98550), 0, 2.83, 0, b, false);
  mesh(T, new T.RingGeometry(1.35, 1.45, 10).rotateX(-Math.PI / 2), mat(T, 0xb98550), 0, 2.83, 0, b, false);
  mesh(T, blob(T, 0.8, [1.3, 0.5, 1], 0, 0.1, s), mat(T, 0x5b8f3a), 1.8, 2.5, 0.8, b, false);
  return g;
});
def('stump_b', 'Пень сломанный', (T, s = 0) => {
  const rnd = rng(s * 29 + 2), g = new T.Group(); g.name = 'Stump'; const b = grp(T, 'Body', g);
  mesh(T, jit(new T.CylinderGeometry(1.5, 2.0, 5, 8), 0.1, s), mat(T, 0x8a6a46), 0, 2.5, 0, b);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const h = 1.2 + rnd() * 2.2; const sp = mesh(T, new T.ConeGeometry(0.55, h, 4), mat(T, 0xc9a66c), Math.cos(a) * 0.95, 5 + h / 2 - 0.2, Math.sin(a) * 0.95, b); sp.rotation.set(Math.sin(a) * 0.15, rnd(), -Math.cos(a) * 0.15); }
  mesh(T, new T.CylinderGeometry(1.0, 1.0, 0.4, 7), mat(T, 0xb98550), 0, 5.1, 0, b, false);
  mesh(T, new T.BoxGeometry(0.4, 2.5, 0.3), mat(T, 0x3b2a1a), 0, 2.4, 1.7, b, false);
  mesh(T, blob(T, 1.1, [1.4, 0.6, 1], 0, 0.1, s), mat(T, 0x5b8f3a), -1.2, 1.4, 1.1, b, false);
  for (let i = 0; i < 3; i++) { const a = i * 2.2 + 0.5; mesh(T, new T.ConeGeometry(0.7, 2, 5), mat(T, 0x6b4527), Math.cos(a) * 2.1, 0.4, Math.sin(a) * 2.1, b).rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); }
  return g;
});
def('log_fallen', 'Поваленное бревно', (T, s = 0) => {
  const rnd = rng(s * 29 + 3), g = new T.Group(); g.name = 'Log'; const b = grp(T, 'Body', g);
  const L = 13, R = 1.5;
  const cyl = mesh(T, jit(new T.CylinderGeometry(R, R * 1.12, L, 9), 0.08, s), mat(T, 0x7a5232), 0, R * 0.96, 0, b); cyl.rotation.z = Math.PI / 2;
  const cap = mesh(T, new T.CircleGeometry(R * 1.12, 9), mat(T, 0xd9b27c), L / 2 + 0.02, R * 0.96, 0, b, false); cap.rotation.y = Math.PI / 2;
  const ring = mesh(T, new T.RingGeometry(0.5, 0.6, 9), mat(T, 0xb98550), L / 2 + 0.05, R * 0.96, 0, b, false); ring.rotation.y = Math.PI / 2;
  for (let i = 0; i < 3; i++) { const x = -4 + i * 3.5 + rnd(); const st = mesh(T, new T.ConeGeometry(0.4, 1.8, 5), mat(T, 0x6b4527), x, R * 0.96 + R * 0.9, (rnd() - 0.5) * 0.8, b); st.rotation.x = (rnd() - 0.5) * 0.8; }
  mesh(T, blob(T, 1.3, [2.2, 0.45, 0.9], 0, 0.1, s), mat(T, 0x5b8f3a), -2, R * 1.9, 0.2, b, false);
  mesh(T, blob(T, 0.6, [1.3, 0.5, 1], 0, 0.05, s + 1), mat(T, 0xd0b8a0), 3.6, R * 1.9, 0.3, b, false);
  g.rotation.y = 0; return g;
});

/* ============================= ПАПОРОТНИКИ ============================= */
function fernFronds(T, parent, rnd, n, o, sw) {
  const fm = vcMat(T);
  for (let i = 0; i < n; i++) {
    const pv = grp(T, 'Frond', parent); pv.rotation.y = i / n * TAU + rnd() * 0.4; pv.position.y = o.y0;
    const tl = grp(T, 'FrondTilt', pv); tl.rotation.z = o.tilt + (rnd() - 0.5) * 0.3;
    mesh(T, frondGeo(T, { len: o.len * (0.85 + rnd() * 0.3), width: o.w, up: 1.1, droop: 1.15, segs: o.segs, drop: 0.25, fwd: 0.5, c1: 0x2a6e36, c2: 0x62b04c, rnd }), fm, 0, 0, 0, tl, false);
    sw.add(tl, 0, 0.05, 1.1 + rnd() * 0.5, rnd() * TAU);
  }
}
def('fern_a', 'Папоротник кустистый', (T, s = 0) => {
  const rnd = rng(s * 31 + 1), g = new T.Group(); g.name = 'Fern'; const sw = swayer();
  mesh(T, new T.IcosahedronGeometry(0.5, 0), mat(T, 0x6b4a2e), 0, 0.3, 0, g);
  fernFronds(T, g, rnd, 12, { y0: 0.5, tilt: 0.25, len: 7, w: 1.1, segs: 12 }, sw);
  g.userData.animate = sw.update; return g;
});
def('fern_tree', 'Папоротник древовидный', (T, s = 0) => {
  const rnd = rng(s * 31 + 2), g = new T.Group(); g.name = 'Fern'; const sw = swayer();
  mesh(T, taperTube(T, (t) => new T.Vector3(0.5 * t * t, t * 5.5, 0), 1.0, 0.75, 8, 7, 0.06), dbl(T, 0x6b4a2e), 0, 0, 0, g);
  const crown = grp(T, 'Crown', g); crown.position.set(0.5, 5.5, 0);
  for (let i = 0; i < 3; i++) mesh(T, new T.IcosahedronGeometry(0.35, 0), mat(T, 0x7ab04e), (i - 1) * 0.3, 0.4, 0.2 * (i % 2), crown, false);
  fernFronds(T, crown, rnd, 10, { y0: 0.2, tilt: 0.4, len: 7.5, w: 1.3, segs: 12 }, sw);
  sw.add(crown, 0.02, 0.03, 0.9, rnd() * TAU);
  g.userData.animate = sw.update; return g;
});
