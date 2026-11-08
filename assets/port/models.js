// Порт, лодки и корабли — процедурные модели (Three.js r160). 1 ед = 1 м, персонаж ≈ 6.5.
// Вода: y=0 (ватерлиния). Лодки/корабли: низ корпуса ниже 0. Носы смотрят в +z.
// Пирсы/причалы: верх настила y=2.4, столбы уходят в воду до y=-4.5.
let T = null, K = null;
const P = { w1: '#9a6a3e', w2: '#b98550', w3: '#6b4527', wd: '#4a2f19', stone: '#9b958c', blue: '#2f9ec4', iron: '#3a3d44',
  rope: '#c9b27a', cream: '#efe6cc', red: '#b8402e', white: '#f1ece0', black: '#1d1d22', gold: '#d9a92b', moss: '#5d7d49', roof: '#a8412e' };
const DT = 2.4; // верх настила пирса

function mkR(seed) {
  let s = (Math.imul((seed | 0) + 1, 2654435761) ^ 0x9e3779b9) >>> 0;
  const f = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.pick = a => a[Math.floor(f() * a.length) % a.length];
  f.pm = a => (f() * 2 - 1) * a;
  return f;
}
function mat(c, o = {}) {
  const k = [c, o.side ? 1 : 0, o.flat === false ? 1 : 0, o.vc ? 1 : 0, o.mk || '', o.metal || ''].join('|');
  let m = K.m.get(k); if (m) return m;
  const p = { color: new T.Color(c), flatShading: o.flat !== false, roughness: .9, metalness: o.metal ?? 0 };
  if (o.side) p.side = T.DoubleSide;
  if (o.vc) p.vertexColors = true;
  if (o.map) { p.map = o.map; p.alphaTest = o.alpha || 0; }
  m = new T.MeshStandardMaterial(p); K.m.set(k, m); return m;
}
function tex(key, w, h, draw) {
  if (!K.t.has(key)) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; K.t.set(key, t);
  }
  return K.t.get(key);
}
function mesh(g, c, x = 0, y = 0, z = 0, o = {}) {
  const m = new T.Mesh(g, typeof c === 'string' ? mat(c, o) : c);
  m.position.set(x, y, z); m.castShadow = o.cs !== false; m.receiveShadow = true; return m;
}
const box = (w, h, d, c, x, y, z, o) => mesh(new T.BoxGeometry(w, h, d), c, x, y, z, o);
const cyl = (rt, rb, h, c, x, y, z, seg = 8, o) => mesh(new T.CylinderGeometry(rt, rb, h, seg), c, x, y, z, o);
const sph = (r, c, x, y, z, sx = 1, sy = 1, sz = 1, seg = 8) => { const m = mesh(new T.SphereGeometry(r, seg, Math.max(4, seg >> 1)), c, x, y, z); m.scale.set(sx, sy, sz); return m; };
const tor = (R, t, c, x, y, z, rx = 0, ry = 0, rz = 0, rs = 4, ts = 10) => { const m = mesh(new T.TorusGeometry(R, t, rs, ts), c, x, y, z); m.rotation.set(rx, ry, rz); return m; };
const rot = (m, x = 0, y = 0, z = 0) => { m.rotation.set(x, y, z); return m; };
const grp = (name, ...ms) => { const g = new T.Group(); g.name = name; ms.forEach(m => g.add(m)); return g; };
function bar(a, b, r, c, seg = 5) {
  const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const m = cyl(r, r, len, c, 0, 0, 0, seg, { cs: false });
  m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return m;
}
function sagPts(a, b, n, s) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - s * Math.sin(Math.PI * t), a[2] + (b[2] - a[2]) * t]); } return o; }
function rope(F, pts, r = .13, c = P.rope) { for (let i = 0; i < pts.length - 1; i++) F.add(bar(pts[i], pts[i + 1], r, c, 4)); }

function base() { const g = new T.Group(), f = new T.Group(); f.name = 'Float'; g.add(f); const fns = []; g.userData.animate = t => { for (const fn of fns) fn(t); }; return { g, f, fns }; }
function rock(B, amp, ph = 0) {
  const f = B.f; B.fns.push(t => { f.rotation.z = Math.sin(t * 1.1 + ph) * amp; f.rotation.x = Math.sin(t * .8 + ph * 2) * amp * .6; f.position.y = Math.sin(t * 1.3 + ph) * amp * 3; });
}

/* ---------- ткань ---------- */
function gridCloth(Pq, nx, ny, material, uvs = [1, 1]) {
  const pos = [], uv = [], U = [], V = [], idx = [];
  const L = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny; pos.push(...L(L(Pq[0], Pq[1], u), L(Pq[3], Pq[2], u), v)); uv.push(u * uvs[0], (1 - v) * uvs[1]); U.push(u); V.push(v);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  return mkCloth(pos, uv, idx, U, V, material, U.map((u, k) => Math.pow(Math.sin(Math.PI * u), .8) * Math.pow(Math.sin(Math.PI * V[k]), .8)));
}
function triCloth(A, Bp, C, n, material) {
  const pos = [], uv = [], idx = [], W = [], V = [], id = {};
  for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) {
    const a = i / n, b = j / n, c = 1 - a - b; id[i + ',' + j] = pos.length / 3;
    pos.push(A[0] * c + Bp[0] * a + C[0] * b, A[1] * c + Bp[1] * a + C[1] * b, A[2] * c + Bp[2] * a + C[2] * b);
    uv.push(a * .9 + .05, b * .9 + .05); W.push(27 * a * b * c); V.push(b);
  }
  for (let i = 0; i < n; i++) for (let j = 0; i + j < n; j++) {
    idx.push(id[i + ',' + j], id[(i + 1) + ',' + j], id[i + ',' + (j + 1)]);
    if (i + j < n - 1) idx.push(id[(i + 1) + ',' + j], id[(i + 1) + ',' + (j + 1)], id[i + ',' + (j + 1)]);
  }
  return mkCloth(pos, uv, idx, V, V, material, W);
}
function mkCloth(pos, uv, idx, U, V, material, W) {
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, material); mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, geo, base: Float32Array.from(pos), U, V, W, n: U.length };
}
function billow(B, rec, bulge, axis = 2, sign = 1, ph = 0) {
  const a = rec.geo.attributes.position.array;
  const fn = t => {
    const k0 = bulge * (1 + .12 * Math.sin(t * 1.4 + ph));
    for (let k = 0; k < rec.n; k++) a[k * 3 + axis] = rec.base[k * 3 + axis] + sign * rec.W[k] * k0 * (1 + .12 * Math.sin(t * 2.2 + ph + rec.V[k] * 6));
    rec.geo.attributes.position.needsUpdate = true; rec.geo.computeVertexNormals();
  };
  fn(0); B.fns.push(fn);
}
function sailMat(tk) { return tk ? mat('#ffffff', { map: sailTex(tk), side: true, flat: false, mk: tk }) : mat(P.cream, { side: true, flat: false }); }
function sailTex(k) {
  return tex('s_' + k, 128, 128, (c, w, h) => {
    const bg = { pirate: '#1a1a20', royal: '#f4efe0', merchant: '#e8dcb8', merchant2: '#eadfc0', fish: '#d98a4a', fish2: '#c8553a', rag: '#cdbf94', richard: '#f7f3e8', plain: '#efe6cc' }[k] || '#efe6cc';
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    if (k === 'pirate') { c.fillStyle = '#2b2b34'; c.fillRect(10, 20, 36, 28); c.fillRect(70, 70, 40, 30); c.fillRect(30, 96, 30, 20); }
    if (k === 'royal') { c.fillStyle = '#2a58a8'; c.fillRect(0, 0, 14, h); c.fillRect(w - 14, 0, 14, h); c.fillStyle = '#d9a92b'; c.beginPath(); c.arc(64, 64, 24, 0, 7); c.fill(); c.fillStyle = '#2a58a8'; c.fillRect(60, 40, 8, 48); c.fillRect(40, 60, 48, 8); }
    if (k === 'merchant') { c.fillStyle = '#b8402e'; c.fillRect(54, 0, 20, h); c.fillRect(0, 54, w, 20); }
    if (k === 'merchant2') { c.fillStyle = '#2f6aa8'; for (let i = 0; i < 4; i++) c.fillRect(8 + i * 32, 0, 12, h); }
    if (k === 'fish') { c.fillStyle = '#e8c07a'; c.fillRect(20, 30, 40, 40); c.fillStyle = '#b8683a'; c.fillRect(70, 80, 40, 30); }
    if (k === 'fish2') { c.fillStyle = '#f0dcb0'; c.fillRect(0, 100, w, 14); c.fillRect(50, 20, 30, 30); }
    if (k === 'rag') { c.fillStyle = '#a89a6c'; c.fillRect(10, 10, 40, 40); c.fillStyle = '#d8ccA0'; c.fillRect(70, 60, 44, 44); }
    if (k === 'richard') { c.fillStyle = '#2f9ec4'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8); c.fillRect(0, 0, 8, h); c.fillRect(w - 8, 0, 8, h); c.fillStyle = '#b8402e'; c.font = 'bold 96px sans-serif'; c.textAlign = 'center'; c.fillText('Р', 64, 98); }
    c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 2; for (let y = 21; y < h; y += 21) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  });
}
function flagTex(k) {
  return tex('f_' + k, 128, 80, (c, w, h) => {
    if (k === 'jolly') {
      c.fillStyle = '#121216'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f1ece0'; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(26, 12); c.lineTo(102, 68); c.moveTo(102, 12); c.lineTo(26, 68); c.stroke();
      c.fillStyle = '#f1ece0'; c.beginPath(); c.arc(64, 34, 17, 0, 7); c.fill(); c.fillRect(54, 44, 20, 14);
      c.fillStyle = '#121216'; c.beginPath(); c.arc(58, 33, 4.5, 0, 7); c.fill(); c.beginPath(); c.arc(70, 33, 4.5, 0, 7); c.fill(); c.fillRect(63, 42, 3, 5);
    } else if (k === 'royal') {
      c.fillStyle = '#2a58a8'; c.fillRect(0, 0, w, h); c.fillStyle = '#d9a92b'; c.fillRect(0, 34, w, 12); c.fillRect(58, 0, 12, h);
      c.beginPath(); c.arc(64, 40, 14, 0, 7); c.fill(); c.fillStyle = '#b8402e'; c.beginPath(); c.arc(64, 40, 7, 0, 7); c.fill();
    } else { c.fillStyle = '#b8402e'; c.fillRect(0, 0, w, h); c.fillStyle = '#f1ece0'; c.fillRect(0, 28, w, 24); }
  });
}
function deckTex() {
  return tex('deck', 64, 64, (c, w, h) => {
    const cs = ['#b98550', '#a8763f', '#c08e58', '#b07c48'];
    for (let i = 0; i < 4; i++) { c.fillStyle = cs[i]; c.fillRect(i * 16, 0, 16, h); c.fillStyle = 'rgba(60,30,10,.45)'; c.fillRect(i * 16, 0, 2, h); }
  });
}
function netTex() {
  return tex('net', 128, 128, (c) => {
    c.clearRect(0, 0, 128, 128); c.strokeStyle = '#e0d3a8'; c.lineWidth = 6;
    for (let i = -8; i <= 16; i++) { c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16 + 128, 128); c.stroke(); c.beginPath(); c.moveTo(i * 16 + 128, 0); c.lineTo(i * 16, 128); c.stroke(); }
  });
}
function netMat() { return mat('#ffffff', { map: netTex(), side: true, flat: false, alpha: .4, mk: 'net' }); }

/* флаг: крепится слева, развевается в -z */
function flag(B, parent, x, y, z, w, h, tk, color, ph = 0) {
  const m = tk ? mat('#ffffff', { map: flagTex(tk), side: true, flat: false, mk: 'f' + tk }) : mat(color || P.red, { side: true, flat: false });
  const g = gridCloth([[0, h / 2, 0], [w, h / 2, 0], [w, -h / 2, 0], [0, -h / 2, 0]], 8, 3, m);
  g.mesh.position.set(x, y, z); g.mesh.rotation.y = Math.PI / 2; g.mesh.name = 'Flag'; parent.add(g.mesh);
  const a = g.geo.attributes.position.array;
  const fn = t => {
    for (let k = 0; k < g.n; k++) { const u = g.base[k * 3] / w; a[k * 3 + 2] = Math.sin(u * 6 - t * 5 + ph + g.base[k * 3 + 1] * .4) * u * h * .3; }
    g.geo.attributes.position.needsUpdate = true; g.geo.computeVertexNormals();
  };
  fn(0); B.fns.push(fn); return g.mesh;
}

/* ---------- корпус ---------- */
function hullFn(o) {
  const L = o.L, W = o.W, fb = o.fb, dr = o.draft, sh = o.sheer || 0, S = o.stations || 18, ps = !!o.pointStern;
  const cl = o.cols || {}, cH = new T.Color(cl.hull || P.w2), cS = new T.Color(cl.stripe || P.blue), cB = new T.Color(cl.bottom || P.w3);
  const ang = [-90, -80, -65, -45, -22, 0, 22, 45, 65, 80, 90].map(a => a * Math.PI / 180);
  const wf = t => { let v; if (t >= 0) v = Math.pow(Math.max(1 - Math.pow(t, 2.3), 0), .7); else if (ps) v = Math.pow(Math.max(1 - Math.pow(-t, 2), 0), .7); else v = 1 - (o.taper ?? .4) * Math.pow(-t, 2.5); return Math.max(v, .03) * W / 2; };
  const top = t => fb + sh * (t > 0 ? Math.pow(t, 2.2) : (o.sternSheer ?? .5) * Math.pow(-t, 2.2));
  const bot = t => -dr * (t > 0 ? 1 - .65 * t * t : 1 - (ps ? .65 : .25) * t * t);
  const pt = (t, a) => { const w = wf(t), tp = top(t), bt = bot(t); return [w * Math.sin(a), tp - (tp - bt) * Math.cos(a), t * L / 2]; };
  const pos = [], col = [];
  const tri = (a, b, c, k) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(k.r, k.g, k.b); };
  for (let i = 0; i < S; i++) {
    const t0 = -1 + 2 * i / S, t1 = -1 + 2 * (i + 1) / S;
    for (let j = 0; j < ang.length - 1; j++) {
      const a = pt(t0, ang[j]), b = pt(t0, ang[j + 1]), c = pt(t1, ang[j + 1]), d = pt(t1, ang[j]);
      const cy = (a[1] + b[1] + c[1] + d[1]) / 4, k = (j === 0 || j === ang.length - 2) ? cS : cy < 0 ? cB : cH;
      tri(a, b, c, k); tri(a, c, d, k);
    }
  }
  if (!ps) { const r = ang.map(a => pt(-1, a)), c = [0, (top(-1) + bot(-1)) / 2, -L / 2]; for (let j = 0; j < r.length - 1; j++) tri(c, r[j], r[j + 1], cH); tri(c, r[r.length - 1], r[0], cH); }      // + верхний треугольник транца (раньше между центром и бортами сверху оставался треугольный вырез)
  { const cap = t => { const r = ang.map(a => pt(t, a)), c = [0, (top(t) + bot(t)) / 2, t * L / 2]; for (let j = 0; j < r.length - 1; j++) tri(c, r[j], r[j + 1], cH); tri(c, r[r.length - 1], r[0], cH); }; cap(1); if (ps) cap(-1); }      // заглушка форштевня (и острой кормы): на острие оставалась узкая щель
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const half = (z, y) => { const t = clamp(z / (L / 2), -1, 1), tp = top(t), bt = bot(t), c = clamp((tp - y) / (tp - bt), 0, 1); return wf(t) * Math.sqrt(1 - c * c); };
  const deck = y => {
    const p = [], uv = [], idx = [];
    for (let i = 0; i <= S; i++) { const t = -1 + 2 * i / S, z = t * L / 2, h = half(z, y); p.push(-h, y, z, h, y, z); uv.push(-h / 4, z / 4, h / 4, z / 4); if (i < S) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  return { geo, half, deck, topZ: z => top(clamp(z / (L / 2), -1, 1)), rail: z => half(z, 99) };
}
function hullMeshes(B, o, floorY, floorCol) {
  floorY = Math.max(floorY, 0.45);      // настил не ниже ватерлинии: раньше у малых лодок он был под водой, и внутри лодки просвечивало море
  const h = hullFn(o);
  const hm = new T.Mesh(h.geo, mat('#ffffff', { vc: true, side: true })); hm.castShadow = hm.receiveShadow = true; hm.name = 'Hull'; B.f.add(hm);
  const dm = new T.Mesh(h.deck(floorY), floorCol ? mat(floorCol, { side: true }) : mat('#ffffff', { map: deckTex(), side: true, flat: false, mk: 'deck' })); dm.receiveShadow = true; dm.name = 'Deck'; B.f.add(dm);
  return h;
}

/* ---------- мелкие предметы ---------- */
function barrelMesh(R, H, col = P.w2, seg = 10) {
  const g = new T.Group(), rr = y => R * (.82 + .18 * Math.sin(Math.PI * y / H)), pts = [];
  for (let i = 0; i <= 6; i++) pts.push(new T.Vector2(rr(H * i / 6), H * i / 6));
  g.add(mesh(new T.LatheGeometry(pts, seg), col, 0, 0, 0, { side: true }));
  g.add(cyl(R * .8, R * .8, .12, P.w1, 0, H - .06, 0, seg));
  for (const f of [.1, .3, .7, .9]) g.add(cyl(rr(f * H) + .06, rr(f * H) + .06, .2, P.iron, 0, f * H, 0, seg, { cs: false }));
  return g;
}
function crateBox(w, h, d, c1, c2) {
  const g = new T.Group(), t = .38;
  g.add(box(w - .1, h - .1, d - .1, c2, 0, h / 2, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(t, h, t, c1, sx * (w / 2 - t / 2), h / 2, sz * (d / 2 - t / 2)));
  for (const y of [t / 2, h - t / 2]) {
    for (const sz of [-1, 1]) g.add(box(w, t, t, c1, 0, y, sz * (d / 2 - t / 2)));
    for (const sx of [-1, 1]) g.add(box(t, t, d - 2 * t, c1, sx * (w / 2 - t / 2), y, 0));
  }
  return g;
}
function cannon(s = 1, lite = false) {
  const g = new T.Group(); g.name = 'Cannon';
  const br = cyl(.34 * s, .5 * s, 3.4 * s, P.iron, 0, 0, 0, lite ? 7 : 10); br.rotation.x = Math.PI / 2; br.position.set(0, 1.15 * s, .2 * s); br.name = 'Barrel';
  g.add(br, sph(.55 * s, P.iron, 0, 1.15 * s, -1.5 * s, 1, 1, .7, 6));
  g.add(box(1.5 * s, .5 * s, 2.6 * s, P.w3, 0, .62 * s, 0), box(1.9 * s, .3 * s, .3 * s, P.iron, 0, .35 * s, .8 * s), box(1.9 * s, .3 * s, .3 * s, P.iron, 0, .35 * s, -.8 * s));
  if (!lite) for (const sx of [-1, 1]) for (const sz of [-.8, .8]) g.add(rot(cyl(.42 * s, .42 * s, .25 * s, P.wd, sx * .95 * s, .42 * s, sz * s, 8), 0, 0, Math.PI / 2));
  return g;
}
function coilMesh(R, layers, col = P.rope) {
  const g = new T.Group();
  for (let l = 0; l < layers; l++) for (const rr of [R, R * .62]) g.add(tor(rr, .36, col, 0, .36 + l * .62, 0, Math.PI / 2, 0, 0, 4, 12));
  return g;
}
function bollard(F, x, y, z) { F.add(cyl(.5, .62, 1.3, P.iron, x, y + .65, z, 8), cyl(.85, .5, .55, P.iron, x, y + 1.55, z, 8)); }

/* ---------- детали бортов и палубы (лодки и корабли) ---------- */
// полосы z по борту s (±1), где есть планширь: на правом борту (s>0) пропуск gap=[z0,z1] — лестница корабля
function sideZs(L, s, gap, N, keep) {
  const runs = []; let cur = [];
  for (let i = 0; i <= N; i++) {
    const z = -L / 2 + L * i / N;
    if ((gap && s > 0 && z > gap[0] && z < gap[1]) || (keep && !keep(z))) { if (cur.length > 1) runs.push(cur); cur = []; } else cur.push(z);
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}
// планширь: брус по верхней кромке борта снаружи и стойки фальшборта изнутри, от настила до кромки.
// h — из hullFn: rail(z) — полуширина на кромке, topZ(z) — высота кромки, half(z,y) — полуширина на высоте y.
// o: color, r (толщина бруса), posts (стойки, по умолчанию есть), gap (пропуск на правом борту),
// minX (на корме брус и стойки не подходят к оси ближе minX — там проход и штурвал; по умолчанию 1.5)
function sheerRail(F, h, L, floorY, o = {}) {
  const c = o.color || P.wd, r = o.r || .13, fl = Math.max(floorY, .45), N = Math.max(12, Math.round(L / 1.2)), mx = o.minX ?? 1.5;
  const keep = z => !(z < 0 && h.rail(z) < mx + .25);      // запас на толщину бруса
  for (const s of [-1, 1]) for (const zs of sideZs(L, s, o.gap, N, keep)) {
    const pts = zs.map(z => new T.Vector3(s * (h.rail(z) + .04), h.topZ(z) + .12, z));
    F.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), zs.length * 2, r, 4, false), c, 0, 0, 0, { cs: false }));
    if (o.posts === false) continue;
    for (let z = zs[0] + 1.2; z < zs[zs.length - 1] - .8; z += 2.4) {
      const x = s * h.half(z, fl) * .96, y1 = h.topZ(z) + .12;
      if (z < 0 && Math.abs(x) < mx) continue;
      F.add(cyl(.05, .06, y1 - fl, c, x, (fl + y1) / 2, z, 4, { cs: false }));
    }
  }
}
// пушечные порты: тёмные проёмы на борту на высоте ствола пушки (напротив пушек); на правом борту у лестницы не ставятся (с запасом 1 м)
function gunPorts(F, h, dy, zs, gap) {
  for (const z of zs) for (const s of [-1, 1]) {
    if (gap && s > 0 && z > gap[0] - 1 && z < gap[1] + 1) continue;
    const y = dy + 1.15; F.add(box(.14, .8, 1.05, '#1d1d22', s * (h.half(z, y) + .02), y, z, { cs: false }));
  }
}
// щиты на кромке борта: цветной диск с кантом
function shields(F, h, zs, colA, colB, gap) {
  for (const z of zs) for (const s of [-1, 1]) {
    if (gap && s > 0 && z > gap[0] && z < gap[1]) continue;
    const g = new T.Group(); g.position.set(s * (h.rail(z) + .05), h.topZ(z) - .75, z);
    const rim = cyl(.5, .5, .08, colB, 0, 0, 0, 10, { cs: false }), disk = cyl(.4, .4, .1, colA, s * .03, 0, 0, 10, { cs: false });
    rim.rotation.z = disk.rotation.z = Math.PI / 2; g.add(rim, disk); F.add(g);
  }
}
// окна кормовой каюты на транце: рамы вровень с кормой, верх окон ниже 1.4 м над палубой (не на уровне головы)
function transomWindows(F, h, L, dy, n, col) {
  const zT = -L / 2, y = dy + .85;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 1.5;
    if (Math.abs(x) + .6 > h.half(zT + .05, y) - .3) continue;      // окно не шире транца
    F.add(box(1.1, 1, .08, P.w3, x, y, zT - .02, { cs: false }), box(.85, .7, .1, col, x, y, zT - .04, { cs: false }));
  }
}
// носовые завитки (волюты) по бортам у форштевня
function bowScrolls(F, h, L, col) {
  const z = L / 2 - 1.6, y = h.topZ(z) - .9;
  for (const s of [-1, 1]) F.add(tor(.4, .1, col, s * (h.half(z, y) + .08), y, z, 0, Math.PI / 2, 0, 4, 10));
}
// фальреп у основания мачты: низкая поперечная планка на стойках
function fifeRail(F, z, dy) {
  F.add(bar([-1.2, dy + .85, z], [1.2, dy + .85, z], .1, P.w3, 5));
  for (const s of [-1, 1]) F.add(cyl(.08, .08, .85, P.w3, s * 1.2, dy + .42, z, 5, { cs: false }));
}
// кнехт (чугунная колодка) на планшире
function cleat(F, x, y, z) { F.add(box(.26, .2, .9, P.iron, x, y, z, { cs: false })); }
// куча мешков с зерном (низкая)
function sackPile(F, x, y, z, r) {
  [[0, 0, 0, 1], [1.5, .1, .3, 1.05], [.7, .6, -.4, .95]].forEach(([dx, dy2, dz, sc]) => F.add(sph(.85 * sc, r.pick(['#d9c79a', '#c9b48a', '#bfae86']), x + dx, y + .7 + dy2, z + dz, 1, .85, .9, 7)));
}

/* ---------- каркас определения ---------- */
export const MODELS = [];
function def(id, name, fn) {
  MODELS.push({ id, name, group: 'port', make(THREE, seed = 0) {
    T = THREE; if (!K || K.T !== THREE) K = { T: THREE, m: new Map(), t: new Map() };
    const B = base(); fn(B, mkR(seed + id.length * 7919 + id.charCodeAt(0) * 31), seed); B.g.name = id; B.g.userData.id = id; return B.g;
  } });
}

/* ================= ПИРСЫ ================= */
function deckPlanks(F, x0, x1, z0, z1, dir, r) {
  const len = dir === 'z' ? z1 - z0 : x1 - x0, wid = dir === 'z' ? x1 - x0 : z1 - z0, n = Math.round(len), pl = len / n, g = new T.Group(); g.name = 'Deck';
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let i = 0; i < n; i++) {
    const c = r.pick([P.w2, '#a8763f', P.w1, '#c08e58']);
    if (dir === 'z') g.add(box(wid - .1, .4, pl - .08, c, cx, DT - .2, z0 + pl * (i + .5)));
    else g.add(box(pl - .08, .4, wid - .1, c, x0 + pl * (i + .5), DT - .2, cz));
  }
  for (const s of [-1, 1]) {
    if (dir === 'z') g.add(box(.5, .6, len, P.w3, cx + s * (wid / 2 - .6), DT - .7, cz));
    else g.add(box(len, .6, .5, P.w3, cx, DT - .7, cz + s * (wid / 2 - .6)));
  }
  F.add(g);
}
function post(F, x, z, top = 3.4) {
  F.add(cyl(.42, .5, top + 4.5, P.w3, x, (top - 4.5) / 2, z, 7), cyl(.52, .52, .18, P.wd, x, top, z, 7), cyl(.55, .55, 1.2, P.moss, x, -.2, z, 7, { cs: false }));
}
def('pier_straight', 'Пирс прямой (12)', (B, r) => {
  deckPlanks(B.f, -3, 3, -6, 6, 'z', r);
  for (const x of [-2.8, 2.8]) for (const z of [-5.5, 0, 5.5]) post(B.f, x, z);
  B.f.add(box(6, .5, .5, P.w3, 0, 1.4, -5.5), box(6, .5, .5, P.w3, 0, 1.4, 5.5));
});
def('pier_corner', 'Пирс угловой', (B, r) => {
  deckPlanks(B.f, -3, 3, -3, 3, 'z', r); deckPlanks(B.f, -3, 3, -9, -3, 'z', r); deckPlanks(B.f, 3, 9, -3, 3, 'x', r);
  for (const [x, z] of [[-2.8, 2.8], [2.8, 2.8], [-2.8, -2.8], [-2.8, -5.5], [2.8, -5.5], [-2.8, -8.5], [2.8, -8.5], [5.5, 2.8], [5.5, -2.8], [8.5, 2.8], [8.5, -2.8], [2.8, -2.8]]) post(B.f, x, z);
});
def('pier_t', 'Пирс Т-образный', (B, r) => {
  deckPlanks(B.f, -3, 3, -6, 0, 'z', r); deckPlanks(B.f, -9, 9, 0, 6, 'x', r);
  for (const x of [-8.5, -4.3, 0, 4.3, 8.5]) post(B.f, x, 5.5);
  for (const x of [-8.5, -5.5, 5.5, 8.5]) post(B.f, x, .5);
  for (const z of [-5.5, -2.8]) for (const x of [-2.8, 2.8]) post(B.f, x, z);
  B.f.add(rot(cyl(.2, .2, 4, P.rope, 0, 3.6, 5.5, 5), 0, 0, Math.PI / 2));
});
def('pier_end_stairs', 'Пирс с лестницей в воду', (B, r) => {
  deckPlanks(B.f, -3, 3, -6, 6, 'z', r);
  for (const x of [-2.8, 2.8]) for (const z of [-5.5, 0, 5.5]) post(B.f, x, z);
  for (let i = 0; i < 5; i++) B.f.add(box(3.6, .4, 1.3, r.pick([P.w2, P.w1]), 0, DT - .7 * (i + 1) - .2, 6 + 1.2 * i + .6));
  for (const s of [-1, 1]) { B.f.add(bar([s * 1.9, DT - .55, 6], [s * 1.9, DT - 4.05, 12], .22, P.w3, 5)); post(B.f, s * 2.0, 11.6, 1.6); post(B.f, s * 2.9, 6.3, 3.4); }
  B.f.add(bar([-1.9, DT + 1, 6.3], [-1.9, 0, 12], .1, P.rope, 4), bar([1.9, DT + 1, 6.3], [1.9, 0, 12], .1, P.rope, 4));
});

/* ================= ПРИЧАЛЫ ================= */
def('dock_wood', 'Причал деревянный с кнехтами', (B, r) => {
  const F = B.f; deckPlanks(F, -12, 12, -4, 4, 'x', r);
  for (let i = 0; i < 5; i++) { post(F, -11 + i * 5.5, 3.6); post(F, -11 + i * 5.5, -3.6); }
  const xs = [-9, -3, 3, 9]; xs.forEach(x => bollard(F, x, DT, 3));
  const rp = new T.Group(); rp.name = 'Ropes';
  rope(rp, sagPts([-9, DT + 1.4, 3], [-9, .2, 9.5], 8, 1.6)); rope(rp, sagPts([3, DT + 1.4, 3], [15, 5, 15], 8, .5), .15);
  rp.add(tor(.55, .14, P.rope, -9, .25, 9.5, Math.PI / 2, 0, 0, 4, 8), tor(.55, .14, P.rope, 15, 5, 15, 0, 0, 0, 4, 8)); F.add(rp);
  for (const x of [-6, 0, 7]) F.add(cyl(.45, .45, 1.8, P.black, x, .9, 4.4, 8), bar([x, DT, 4], [x, 1.7, 4.4], .08, P.rope, 4));
  for (const s of [-.5, .5]) F.add(bar([6 + s, DT + .4, 4.3], [6 + s, -2.5, 4.3], .12, P.w3, 5));
  for (let i = 0; i < 6; i++) F.add(box(1, .12, .12, P.w3, 6, 2 - i * .9, 4.3));
  F.add(coilMesh(1.1, 2).translateX(-6).translateY(DT).translateZ(-1.5));
});
def('dock_stone', 'Причал каменный с кнехтами', (B, r) => {
  const F = B.f;
  F.add(box(20, 5.4, 6, P.stone, 0, -.3, 0), box(20.6, .5, 6.6, '#aaa49a', 0, DT - .25, 0), box(20.2, 1.1, 6.2, P.moss, 0, -.2, .05, { cs: false }));
  for (let i = 0; i < 6; i++) F.add(box(2.6, 1.4, .3, r.pick(['#8a857d', '#a39d94', P.stone]), -8.5 + i * 3.4, r.pick([.8, 1.4]), 3.1));
  [-7, 0, 7].forEach(x => bollard(F, x, DT, 2.2));
  F.add(tor(.6, .15, P.iron, 5, 1.0, 3.15, 0, 0, 0, 4, 10));
  rope(F, sagPts([-7, DT + 1.4, 2.2], [-9, 4.5, 16], 9, .5), .16); rope(F, sagPts([0, DT + 1.4, 2.2], [3, 3.5, 17], 9, .5), .16);
  rope(F, sagPts([7, DT + 1.4, 2.2], [10, .1, 8], 7, 1.8), .16);
  for (let i = 0; i < 3; i++) F.add(box(3.4, .6, 1, P.stone, -8.5, DT - 2.2 - i * .8 + 1.6, 4.0 + i * .9 - 1.4 + .3 * 0));
});

/* ================= КРАНЫ ================= */
def('crane_wood', 'Портовый кран деревянный', (B, r) => {
  const F = B.f; F.add(box(7, .8, 7, P.w1, 0, .4, 0), box(1.1, 16, 1.1, P.w3, 0, 8.8, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.add(bar([sx * 3, .8, sz * 3], [sx * .5, 6, sz * .5], .3, P.w2, 5));
  const arm = new T.Group(); arm.name = 'Arm'; arm.position.set(0, 16.8, 0);
  arm.add(cyl(1, 1, .4, P.iron, 0, 0, 0, 8), box(.9, .9, 14, P.w2, 0, .8, 5), box(.6, 4.5, .6, P.w1, 0, 2.5, 0),
    bar([0, 4.7, 0], [0, 1, 12], .13, P.rope, 4), bar([0, 4.7, 0], [0, 1, -4.3], .13, P.rope, 4),
    box(2.6, 2.6, 2.6, P.stone, 0, -.3, -4.2), rot(cyl(.5, .5, .4, P.iron, 0, .2, 12.3, 8), 0, 0, Math.PI / 2));
  const hook = new T.Group(); hook.name = 'Hook'; hook.position.set(0, .2, 12.3);
  hook.add(bar([0, 0, 0], [0, -6.5, 0], .1, P.rope, 4), tor(.5, .13, P.iron, 0, -7, 0, 0, 0, 0, 4, 8), crateBox(2.4, 2.2, 2.4, P.w2, P.w1).translateY(-9.6));
  arm.add(hook); F.add(arm);
  B.fns.push(t => { arm.rotation.y = Math.sin(t * .5) * .9; hook.rotation.z = Math.sin(t * 1.3) * .08; hook.rotation.x = Math.sin(t * 1.1) * .08; });
});
def('winch', 'Лебёдка портовая', (B, r) => {
  const F = B.f;
  for (const s of [-1, 1]) {
    F.add(box(.8, .8, 9, P.w3, s * 3.2, .4, 0), bar([s * 3.2, .8, -3], [s * 3.2, 6.5, 0], .3, P.w2, 5), bar([s * 3.2, .8, 3], [s * 3.2, 6.5, 0], .3, P.w2, 5), bar([s * 3.2, .8, 0], [s * 3.2, 6.5, 0], .3, P.w1, 5));
  }
  F.add(box(7.4, .7, .7, P.w3, 0, 6.5, 0), box(.4, .4, 2.6, P.w3, 0, 6.3, 1.3), box(6.4, .5, .5, P.w3, 0, .8, -3), box(6.4, .5, .5, P.w3, 0, .8, 3));
  const drum = new T.Group(); drum.name = 'Drum'; drum.position.set(0, 2.5, 0);
  drum.add(rot(cyl(1, 1, 5.6, P.w2, 0, 0, 0, 9), 0, 0, Math.PI / 2), rot(cyl(1.2, 1.2, 3.4, P.rope, 0, 0, 0, 9), 0, 0, Math.PI / 2),
    bar([3.6, 0, 0], [4.1, 1.7, 0], .14, P.iron, 5), rot(cyl(.18, .18, 1.2, P.w3, 4.1, 1.7, 0, 5), 0, 0, Math.PI / 2));
  F.add(drum);
  F.add(bar([0, 3.7, 0], [0, 6.3, 2.5], .1, P.rope, 4), bar([0, 6.3, 2.5], [0, 4.2, 2.5], .1, P.rope, 4), tor(.35, .1, P.iron, 0, 3.9, 2.5, 0, 0, 0, 4, 8), barrelMesh(1.2, 2.6, P.w1, 8).translateY(.6).translateZ(2.5));
  F.add(rot(cyl(.4, .4, .5, P.iron, 0, 6.3, 2.5, 8), 0, 0, Math.PI / 2));
  B.fns.push(t => { drum.rotation.x = t * .8; });
});

/* ================= ЯЩИКИ / БОЧКИ / МЕШКИ / ДОСКИ / БУХТЫ ================= */
def('crate_a', 'Ящик решётчатый', (B, r) => {
  const s = 3.6 + r.pm(.4), g = crateBox(s, s, s, r.pick([P.w2, P.w1]), P.w3); B.f.add(g);
  for (const sz of [-1, 1]) g.add(rot(box(.3, s * 1.35, .2, P.w2, 0, s / 2, sz * (s / 2 + .02)), 0, 0, Math.PI / 4));
});
def('crate_b', 'Ящик длинный (с лентами)', (B, r) => {
  const g = new T.Group(); g.add(box(6.4, 2.8, 3.2, r.pick([P.w1, '#8a6a42']), 0, 1.4, 0));
  for (const x of [-2.4, 0, 2.4]) g.add(box(.45, 3, 3.4, P.iron, x, 1.4, 0));
  g.add(rot(box(.3, .15, 4.2, P.w3, 0, 2.85, 0), 0, 1.2, 0), rot(box(.3, .15, 4.2, P.w3, 0, 2.85, 0), 0, -1.2, 0), tor(.3, .08, P.rope, 3.4, 2.4, 0, 0, Math.PI / 2, 0, 4, 8)); B.f.add(g);
});
def('crate_c', 'Ящик открытый с товаром', (B, r) => {
  const F = B.f; F.add(box(4.6, .3, 3.4, P.w3, 0, .15, 0));
  for (const s of [-1, 1]) F.add(box(4.6, 1.7, .3, P.w2, 0, 1.1, s * 1.55), box(.3, 1.7, 3.4, P.w1, s * 2.15, 1.1, 0));
  const c = r.pick(['#c0392b', '#e08a2e', '#8fa7b0']), fish = c === '#8fa7b0';
  for (let i = 0; i < 12; i++) { const x = -1.6 + (i % 4) * 1.05, z = -.9 + Math.floor(i / 4) * .9; F.add(fish ? sph(.5, c, x, 1.95, z, 1.6, .5, .6, 6) : sph(.5, c, x, 1.9 + r() * .1, z, 1, 1, 1, 6)); }
});
def('chest', 'Сундук окованный', (B, r) => {
  const F = B.f; F.add(box(4.2, 1.8, 2.6, P.w1, 0, .9, 0));
  const lid = mesh(new T.CylinderGeometry(1.3, 1.3, 4.2, 8, 1, false, 0, Math.PI), P.w2, 0, 1.8, 0, { side: true }); lid.rotation.z = Math.PI / 2; F.add(lid);
  for (const x of [-1.5, 1.5]) F.add(box(.4, 1.9, 2.8, P.iron, x, .9, 0), rot(cyl(1.4, 1.4, .4, P.iron, x, 1.8, 0, 8, { side: true }), 0, 0, Math.PI / 2));
  F.add(box(.6, .8, .3, P.gold, 0, 1.7, 1.45));
});
def('barrel_a', 'Бочка стоячая', (B, r) => B.f.add(barrelMesh(1.7 + r.pm(.15), 4.2 + r.pm(.3), r.pick([P.w2, P.w1]))));
def('barrel_b', 'Бочка лежащая на подставке', (B, r) => {
  const R = 1.6, g = barrelMesh(R, 4.8, P.w1); g.rotation.z = Math.PI / 2; g.position.set(-2.4, R + .5, 0); B.f.add(g);
  for (const x of [-1.5, 1.5]) B.f.add(box(.7, .5, 3.4, P.w3, x, .25, 0)); B.f.add(cyl(.2, .2, .2, P.wd, 0, R * 2 + .5 - .1, 0, 6));
});
def('barrel_c', 'Бочка с водой открытая', (B, r) => {
  const R = 1.5, H = 3.8, g = barrelMesh(R, H, P.w2, 10); g.children[1].visible = false; B.f.add(g);
  B.f.add(rot(cyl(R * .8, R * .8, .05, P.blue, 0, H - .5, 0, 10), 0, 0, 0), bar([.4, H + .6, 0], [1.6, H - .3, .2], .1, P.w3, 4), sph(.35, P.w3, 1.7, H - .4, .2, 1, .6, 1, 6));
});
def('sack_a', 'Мешок с зерном', (B, r) => {
  B.f.add(sph(1.4, r.pick(['#d9c79a', '#c9b48a']), 0, 1.2, 0, 1, 1.05, .85, 10), rot(cyl(.12, .55, .8, P.rope, 0, 2.7, 0, 7), .15, 0, 0), cyl(.5, .5, .1, '#8a7240', 0, 2.2, 0, 7), cyl(0, .9, .6, '#e0b84a', 1.6, .3, 1.0, 8));
});
def('sack_b', 'Куча мешков', (B, r) => {
  const cs = ['#d9c79a', '#c9b48a', '#bfae86'];
  [[-1.3, 0, 0], [1.3, 0, .2], [0, 0, 1.6]].forEach((p, i) => B.f.add(sph(1.15, cs[i], p[0], .9, p[2], 1.1, .8, .8, 8)));
  B.f.add(sph(1.1, cs[2], 0, 2.2, .5, 1.1, .8, .8, 8), cyl(.1, .4, .6, P.rope, 0, 3.0, .5, 6));
});
def('planks_a', 'Стопка досок', (B, r) => {
  for (const z of [-2.6, 2.6]) B.f.add(box(5.6, .5, .6, P.w3, 0, .25, z));
  for (let l = 0; l < 7; l++) for (let k = 0; k < 4; k++) B.f.add(box(1.3, .36, 8.2 + r.pm(.3), r.pick([P.w2, '#c08e58', '#a8763f']), -2.0 + k * 1.35 + r.pm(.05), .8 + l * .38, r.pm(.12)));
});
def('planks_b', 'Доски, прислонённые к раме', (B, r) => {
  for (const x of [-4, 4]) B.f.add(box(.5, 4, .5, P.w3, x, 2, -1));
  B.f.add(box(8.8, .5, .5, P.w3, 0, 3.8, -1));
  for (let i = 0; i < 6; i++) B.f.add(rot(box(1.2, .35, 9.4, r.pick([P.w2, '#c08e58', P.w1]), -3.4 + i * 1.35, 2.1, 1.7), -.4 + r.pm(.02), 0, 0));
  for (let i = 0; i < 3; i++) B.f.add(box(1.4, .3, 7, P.w1, -1.5 + i * 1.5, .15, 4.5));
});
def('rope_coil_a', 'Бухта каната плоская', (B, r) => {
  B.f.add(coilMesh(1.9, 3), ...[[1.9, .36, 0], [3.3, .3, 1.8], [4.4, .3, 2.6]].map(p => bar([p[0] * .5 + 1.2, .4, 1.2], [p[0] + 1.4, .3, p[2]], .3, P.rope, 4)));
});
def('rope_coil_b', 'Бухта каната на ребре', (B, r) => {
  for (let i = 0; i < 5; i++) B.f.add(tor(2.0, .32, P.rope, 0, 2.4, -.8 + i * .4, 0, 0, 0, 4, 14));
  B.f.add(box(.5, 1.0, 2.2, P.w3, 0, 4.4, 0), bar([0, 4.3, 1.1], [.5, .2, 3.5], .26, P.rope, 4));
});

/* ================= ЯКОРЯ ================= */
function anchorBody(F, s) {
  const H = 12 * s, R = 3.4 * s, tb = .42 * s;
  F.add(cyl(.38 * s, .5 * s, H, P.iron, 0, H / 2 + .3 * s, 0, 7));
  const arc = mesh(new T.TorusGeometry(R, tb, 5, 14, Math.PI), P.iron, 0, R + tb, 0); arc.rotation.z = Math.PI; F.add(arc);
  for (const sx of [-1, 1]) { const f = mesh(new T.ConeGeometry(.95 * s, 2 * s, 4), P.iron, sx * R, R + tb + .8 * s, 0); f.scale.z = .35; f.rotation.z = -sx * .35; F.add(f); }
  F.add(rot(cyl(.3 * s, .3 * s, 6.4 * s, P.w3, 0, H - 1.6 * s, 0, 6), Math.PI / 2, 0, 0), sph(.5 * s, P.iron, 0, H - 1.6 * s, 3.2 * s, 1, 1, 1, 6), sph(.5 * s, P.iron, 0, H - 1.6 * s, -3.2 * s, 1, 1, 1, 6));
  F.add(tor(.9 * s, .22 * s, P.iron, 0, H + .7 * s, 0, 0, 0, 0, 5, 12));
  return H + 1.6 * s;
}
def('anchor_small', 'Якорь малый (кошка)', (B, r) => {
  const F = B.f; F.add(cyl(.25, .3, 5.4, P.iron, 0, 3.0, 0, 6), tor(.7, .18, P.iron, 0, 5.9, 0, 0, 0, 0, 5, 10), cyl(.5, .3, .6, P.iron, 0, .5, 0, 6));
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); F.add(bar([0, 1.6, 0], [1.5 * c, 1.2, 1.5 * s], .2, P.iron, 5), bar([1.5 * c, 1.2, 1.5 * s], [2.5 * c, .35, 2.5 * s], .2, P.iron, 5), rot(mesh(new T.ConeGeometry(.35, 1.1, 5), P.iron, 2.65 * c, .8, 2.65 * s), 0, 0, 0)); }
  rope(F, sagPts([0, 6.4, 0], [4, .4, 3], 6, 1), .16); F.add(coilMesh(1.1, 1).translateX(4).translateZ(3.2));
});
def('anchor_big', 'Якорь корабельный большой', (B) => { anchorBody(B.f, 1); });
function chainAnchor(B, links, s, name) {
  const F = B.f, top = anchorBody(F, s) - .9 * s, pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([5.5 * t, .5 + (top - .5) * Math.pow(1 - t, 2.2), 0]); }
  const pitch = 1.1 * s, total = links * pitch; let acc = 0, u = 0; const full = pts.slice();
  for (let q = 1; q <= 80; q++) { u = q * .8; full.push([5.5 + u, .5, 3 * Math.sin(u * .3) * Math.min(1, u / 4)]); }
  const out = []; let need = 0, last = full[0]; out.push(last);
  for (let i = 1; i < full.length && out.length < links; i++) { const d = Math.hypot(full[i][0] - last[0], full[i][1] - last[1], full[i][2] - last[2]); acc += d; if (acc >= pitch) { out.push(full[i]); acc = 0; } last = full[i]; }
  const g = new T.Group(); g.name = 'Chain'; F.add(g);
  out.forEach((p, i) => {
    const nx = out[i + 1] || [p[0] + 1, p[1], p[2]], d = new T.Vector3(nx[0] - p[0], nx[1] - p[1], nx[2] - p[2]).normalize();
    const m = mesh(new T.TorusGeometry(.5 * s, .14 * s, 4, 8), P.iron, p[0], p[1], p[2]); m.scale.y = 1.35;
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d), roll = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), (i % 2) * Math.PI / 2);
    m.quaternion.copy(q).multiply(roll); g.add(m);
  });
}
def('anchor_chain_long', 'Якорь на длинной цепи', (B) => chainAnchor(B, 30, .8));
def('anchor_chain_short', 'Якорь на короткой цепи', (B) => chainAnchor(B, 8, .8));

/* ================= ЛОДКИ ================= */
function oar(B, F, x, y, z, side, ph) {
  const g = new T.Group(); g.name = 'Oar'; g.position.set(x, y, z);
  g.add(bar([-side * 1.8, .3, 0], [side * 5.2, -.4, 0], .13, P.w3, 5), box(1.5, .06, .9, P.w2, side * 5.6, -.4, 0), box(.35, .35, .35, P.iron, 0, -.2, 0)); F.add(g);
  B.fns.push(t => { g.rotation.y = Math.sin(t * 1.5 + ph) * .3; g.rotation.z = side * Math.cos(t * 1.5 + ph) * .08; });
}
def('boat_row', 'Лодка вёсельная', (B, r) => {
  const c = r.pick([P.blue, P.red, '#4aa36a']);
  const h = hullMeshes(B, { L: 16, W: 5.2, fb: 1.9, draft: .7, sheer: .9, cols: { hull: P.w2, stripe: c, bottom: P.w3 } }, -.35, P.wd);
  for (const z of [-3, .6, 4]) B.f.add(box(2 * h.half(z, .8) - .1, .3, 1, P.w1, 0, .8, z));
  B.f.add(box(2.4, 1.2, .3, P.w1, 0, 1.2, -7.2)); const y = h.topZ(.5);
  oar(B, B.f, 2.5, y, .6, 1, 0); oar(B, B.f, -2.5, y, .6, -1, 1.2); rock(B, .03, r() * 6);
  // детали: планширь, железные уключины под вёслами, кольцо и флажок на носу, ведро и бухта каната на палубе
  sheerRail(B.f, h, 16, -.35, { color: P.w3 });
  for (const s of [-1, 1]) B.f.add(box(.3, .5, .3, P.iron, s * 2.5, y + .12, .6));
  B.f.add(tor(.22, .05, P.iron, 0, h.topZ(7.9) - .2, 7.9));
  B.f.add(cyl(.04, .05, 2.4, P.w3, 0, h.topZ(7.2) + 1.2, 7.2, 5), flag(B, B.f, 0, h.topZ(7.2) + 2.2, 7.2, 1.3, .7, 0, c));
  B.f.add(cyl(.3, .24, .5, P.w1, -1.2, .7, -5.2, 8, { cs: false }), coilMesh(.6, 1).translateX(1.4).translateY(.45).translateZ(5.6));
});
def('boat_fishing', 'Лодка рыбацкая с сетью', (B, r) => {
  const F = B.f, h = hullMeshes(B, { L: 18, W: 6.8, fb: 2.4, draft: 1.2, sheer: 1.4, cols: { hull: '#8a6a42', stripe: P.red, bottom: P.wd } }, .6);
  F.add(box(3.4, 2.6, 3.6, P.w2, 0, 1.9, -4.5), box(4, .3, 4.2, P.roof, 0, 3.3, -4.5), box(.9, .9, .1, '#1d2a30', 0, 2.3, -2.7));
  F.add(cyl(.2, .25, 8, P.w3, 0, 4.6, 3, 6), flag(B, F, 0, 8.4, 3, 2, 1.1, 0, P.red));
  [[-1.3, 5.3], [.8, 6.3], [1.3, 4.7], [-1, 4.2]].forEach(p => F.add(sph(1.1, '#9aa987', p[0], 1.5, p[1], 1.3, .6, 1, 7)));
  for (let i = 0; i < 6; i++) F.add(sph(.28, '#e8742c', -2.2 + i * .9, 2.1, 2.9 + r.pm(.2), 1, 1, 1, 5));
  F.add(crateBox(1.6, 1.2, 1.6, P.w2, P.w3).translateX(-2).translateY(.6).translateZ(.5)); rock(B, .035, r() * 6);
  // детали: планширь, синий ящик с уловом у борта, кранцы (мягкие отбойники) на борту, фонари на стенах каюты, бухта у носа, глаза на носу
  sheerRail(F, h, 18, .6, { color: P.wd });
  for (const z of [-3, 1, 5]) for (const s of [-1, 1]) F.add(sph(.36, '#e8742c', s * (h.rail(z) + .12), h.topZ(z) - .9, z, .55, 1.15, .55, 7));
  F.add(crateBox(1.4, 1, 1.4, '#2f6a8a', P.w3).translateX(2.2).translateY(.6).translateZ(-.8));
  for (const s of [-1, 1]) F.add(rot(cyl(.18, .18, .4, '#f0c040', s * 1.95, 2.3, -4.5, 6), 0, 0, Math.PI / 2));
  F.add(coilMesh(.8, 1).translateX(-2.6).translateY(.6).translateZ(6));
  const zb = 7.7, yb = h.topZ(zb) - .9;
  for (const s of [-1, 1]) F.add(sph(.34, '#f4f1e8', s * .7, yb, zb + .3, 1, 1, .5, 7), sph(.16, P.black, s * .7, yb, zb + .5, 1, 1, .4, 6));
});
def('canoe_dugout', 'Долблёнка-каноэ с аутригером', (B, r) => {
  const F = B.f, h = hullMeshes(B, { L: 15, W: 3.2, fb: .9, draft: .9, sheer: .7, pointStern: true, stations: 14, cols: { hull: '#8a5a33', stripe: P.wd, bottom: '#6b4527' } }, -.15, P.wd);
  for (const z of [-2.4, 2.4]) F.add(bar([0, 1.0, z], [5.2, .6, z], .16, P.w3, 5));
  F.add(sph(.6, P.w1, 5.2, .2, 0, 1, 1, 6.5, 7));
  F.add(bar([-.6, 1.2, 1.2], [1.8, .4, -1.6], .12, P.w3, 5), box(.9, .06, 1.4, P.w2, 1.9, .35, -1.9), sph(.3, P.cream, 0, .3, 5, 1, .5, 1, 5));
  // детали: тонкий планширь без стоек, сиденья-банки, весло и острога вдоль настила, резная голова на носу
  sheerRail(F, h, 15, -.15, { color: P.wd, r: .09, posts: false, minX: 0 });      // у долблёнки корма заострённая и низкая — брус идёт до конца
  for (const z of [-3.6, 1.6]) F.add(box(2 * h.half(z, .8) - .3, .2, .7, P.w1, 0, 1, z));
  F.add(bar([-.9, .62, -3.6], [-.9, .62, 4.6], .07, P.w1, 4), bar([.9, .7, -6], [.9, .7, 6.4], .05, P.w3, 4));
  F.add(sph(.42, P.w1, 0, 1.45, 6.4, 1, 1.1, 1.2, 7), sph(.1, P.gold, -.16, 1.6, 6.85, 1, 1, 1, 5), sph(.1, P.gold, .16, 1.6, 6.85, 1, 1, 1, 5));
  rock(B, .05, r() * 6);
});
def('boat_sail_small', 'Шлюпка с парусом', (B, r) => {
  const F = B.f, h = hullMeshes(B, { L: 17, W: 6.2, fb: 2.1, draft: .8, sheer: 1, cols: { hull: P.cream, stripe: P.red, bottom: P.wd } }, -.2);
  for (const z of [-4, 0, 4.5]) F.add(box(2 * h.half(z, 1) - .1, .3, 1, P.w1, 0, 1, z));
  F.add(cyl(.18, .24, 14.5, P.w3, 0, 7.3, 2.8, 7), box(.25, 2.4, .9, P.w3, 0, 1.6, -7.8));      // косой румпель (от кормовой стойки вверх к мачте) шёл прямо сквозь голову рулевого — убран; штурвал и так есть
  const pv = new T.Group(); pv.name = 'SailPivot'; pv.position.set(0, 0, 2.8); F.add(pv);
  pv.add(bar([0, 2.2, 0], [0, 2.4, -7.8], .12, P.w3, 5));
  const s = triCloth([0, 13.8, 0.1], [0, 2.5, 0.1], [0, 2.5, -7.6], 6, sailMat('plain')); pv.add(s.mesh); billow(B, s, 1.1, 0, 1, 0);
  const j = triCloth([0, 13, 2.95], [0, 2.4, 8.2], [0, 2.4, 3.0], 5, sailMat('merchant')); F.add(j.mesh); j.mesh.position.z = 0; billow(B, j, .8, 0, -1, 1);
  F.add(bar([0, 13.8, 2.8], [0, 2.3, 8.3], .07, P.rope, 4), flag(B, F, 0, 14.6, 2.8, 2, 1, 0, P.red));
  // детали: планширь с мелкими стойками, кнехты на кромке у носа и у кормы, ведро, бухта каната, кольцо на форштевне
  sheerRail(F, h, 17, -.2, { color: P.wd });
  for (const z of [-6.2, 5.8]) for (const s of [-1, 1]) cleat(F, s * (h.rail(z) - .1), h.topZ(z) + .3, z);
  F.add(tor(.22, .05, P.iron, 0, h.topZ(8) - .2, 8.3), cyl(.3, .24, .5, P.w1, 1.8, .7, -5.5, 8, { cs: false }), coilMesh(.7, 1).translateX(-1.6).translateY(.45).translateZ(6.6));
  B.fns.push(t => { pv.rotation.y = Math.sin(t * .6) * .15; }); rock(B, .035, r() * 6);
});
def('raft', 'Плот из брёвен', (B, r) => {
  const F = B.f; for (let i = 0; i < 7; i++) { const L = 13 + r.pm(.8); F.add(rot(cyl(.75, .75, L, r.pick([P.w1, P.w2, '#8a5a33']), (i - 3) * 1.5, 0, r.pm(.3), 7), Math.PI / 2, 0, 0)); }
  for (const z of [-3.5, 3.5]) F.add(rot(cyl(.4, .4, 11, P.w3, 0, .95, z, 6), 0, 0, Math.PI / 2));
  for (const z of [-3.5, 3.5]) for (const x of [-4.5, -1.5, 1.5, 4.5]) F.add(cyl(.55, .55, .3, P.rope, x, .5, z, 7));
  F.add(cyl(.2, .26, 9, P.w3, 0, 5.4, 3, 6), crateBox(2, 1.6, 2, P.w2, P.w3).translateX(-3).translateY(1.1).translateZ(-3), coilMesh(1, 1).translateX(3).translateY(1.1).translateZ(-4));
  const s = gridCloth([[-2.3, 9, 3.3], [2.3, 9, 3.3], [2.3, 4.6, 3.3], [-2.3, 4.6, 3.3]], 4, 4, sailMat('rag')); F.add(s.mesh); billow(B, s, .6, 2, 1, 0);
  F.add(bar([-2.4, 9, 3.3], [2.4, 9, 3.3], .12, P.w3, 5)); rock(B, .03, r() * 6);
});

/* ================= КОРАБЛИ (общий строитель) ================= */
function ship(B, r, S) {
  const F = B.f, h = hullMeshes(B, S.hull, S.deckY), dy = S.deckY, L = S.hull.L;
  for (const c of []) {      // надстройки (кормовая/носовая) были сплошными блоками и мешали ходить по палубе, а штурвал оказывался внутри них — убраны; палуба ровная
    const w = 2 * Math.min(h.rail(c.z0), h.rail(c.z1)) - .1, len = c.z1 - c.z0, zc = (c.z0 + c.z1) / 2, g = new T.Group(); g.name = c.name || 'Castle';
    g.add(box(w, c.h, len, c.color, 0, dy + c.h / 2, zc), box(w + .1, .15, len + .1, '#b98550', 0, dy + c.h + .07, zc));
    for (const s of [-1, 1]) g.add(box(.25, .9, len, c.color, s * (w / 2 - .12), dy + c.h + .6, zc));
    g.add(box(w, .9, .25, c.color, 0, dy + c.h + .6, c.rearWall ? c.z0 + .12 : c.z1 - .12));
    if (c.windows) for (let i = 0; i < c.windows; i++) g.add(box(1.1, 1.1, .15, c.windowCol || P.gold, (i - (c.windows - 1) / 2) * 2.3, dy + c.h * .55, c.z0 - .02));
    F.add(g);
  }
  const gunY = dy + .1;
  for (const z of S.guns || []) for (const s of [-1, 1]) {
    const c = cannon(1, true); c.rotation.y = s * Math.PI / 2; c.position.set(s * (h.half(z, dy + 1.2) - 1.6 + .4), gunY, z); F.add(c);
  }
  S.masts.forEach((m, mi) => {
    const mg = new T.Group(); mg.name = 'Mast'; mg.add(cyl(m.r * .7, m.r, m.h - dy, P.w3, 0, (m.h + dy) / 2, m.z, 7)); F.add(mg);
    if (m.nest) mg.add(cyl(1.5, 1.2, .7, P.w1, 0, m.nest, m.z, 8), cyl(1.6, 1.6, .3, P.wd, 0, m.nest + .5, m.z, 8));
    (m.sails || []).forEach((sl, si) => {
      const zs = m.z + .6, wb = sl.wb || sl.w;
      mg.add(rot(cyl(.2, .2, sl.w + 1.6, P.w3, 0, sl.top, m.z + .3, 5), 0, 0, Math.PI / 2));
      const c = gridCloth([[-sl.w / 2, sl.top, zs], [sl.w / 2, sl.top, zs], [wb / 2, sl.top - sl.h, zs], [-wb / 2, sl.top - sl.h, zs]], 5, 5, sailMat(S.sailTex), [1, 1]);
      c.mesh.name = 'Sail'; F.add(c.mesh); billow(B, c, sl.w * .13, 2, 1, mi * 1.3 + si * .7);
    });
    if (m.lateen) {
      const z = m.z, H = m.h;
      F.add(bar([0, H * .98, z + 5], [0, H * .66, z - 8.5], .22, P.w3, 5));
      const c = triCloth([0, H * .98, z + 5], [0, H * .66, z - 8.5], [0, dy + 3.6, z - 6], 6, sailMat(S.sailTex)); c.mesh.name = 'Sail'; F.add(c.mesh); billow(B, c, 2.0, 0, 1, 2 + mi);
    }
    if (m.shrouds) for (const s of [-1, 1]) for (const k of [-1.5, 0, 1.5]) F.add(bar([0, m.h * .72, m.z], [s * (h.rail(m.z + k) - .3), h.topZ(m.z + k), m.z + k], .09, P.rope, 4));
    if (m.flag) {
      F.add(cyl(.08, .08, 2.2, P.w3, 0, m.h + 1.1, m.z, 4)); const f = m.flag;
      flag(B, F, 0, m.h + 1.4, m.z, f.w || 3, f.h || 1.5, f.tex || 0, f.color || P.red, mi);
    }
  });
  // общие детали: планширь (пропуск у лестницы на правом борту), пушечные порты, щиты, окна кормовой каюты, фальреп у мачт, кнехты
  const gap = [-.08 * L - 3.5, -.08 * L + 3.5];      // лестница: правый борт (+x), посередине; центр = −8% длины (см. build-map.js, V_.ladder)
  sheerRail(F, h, L, dy, { gap, color: S.railCol || P.wd });
  if (S.guns && S.guns.length) gunPorts(F, h, dy, S.guns, gap);
  if (S.shields) shields(F, h, S.shields.zs, S.shields.a, S.shields.b, gap);
  const cab = (S.castles || []).find(c => c.rearWall && c.windows);
  if (cab) transomWindows(F, h, L, dy, cab.windows, cab.windowCol || P.gold);
  for (const m of S.masts) fifeRail(F, m.z, dy);
  for (const z of [-.3 * L, .3 * L]) for (const s of [-1, 1]) {      // кнехты у бортов — между пушками, чтобы не перекрывать их
    if (s > 0 && z > gap[0] - 2 && z < gap[1] + 2) continue;      // у лестницы проход свободен
    bollard(F, s * (h.half(z, dy) - 1.2), dy, z);
  }
  if (S.bow) {
    const b = S.bow, bz = L / 2, t0 = h.topZ(bz - 5);
    F.add(bar([0, t0, bz - 6], [0, t0 + b.rise, bz + b.len], .28, P.w3, 6));
    const fm = S.masts[0];
    const j = triCloth([0, fm.h * .85, fm.z + .5], [0, t0 + b.rise + .3, bz + b.len - .5], [0, dy + 4.5, fm.z + 3], 6, sailMat(S.sailTex)); j.mesh.name = 'Jib'; F.add(j.mesh); billow(B, j, 1.4, 0, -1, 3);
    F.add(bar([0, fm.h, fm.z], [0, t0 + b.rise, bz + b.len], .08, P.rope, 4));
    if (b.figure) F.add(sph(.9, b.figure, 0, t0 + .8, bz + .2, 1, 1, 1.3, 6));
    bowScrolls(F, h, L, b.scroll || P.gold);
    flag(B, F, 0, t0 + b.rise + .3, bz + b.len, 2.2, 1.1, 0, P.red);      // джек на конце бушприта
  }
  F.add(box(.4, 3.8, 2.4, P.wd, 0, -.6, -L / 2 - 1.4));
  if (S.extra) S.extra(F, h, r, B);
  rock(B, S.rock || .018, r() * 6);
}
const lantern = (F, x, y, z) => F.add(cyl(.35, .35, .8, '#f0c040', x, y, z, 6), cyl(.1, .5, .3, P.iron, x, y + .55, z, 6));

def('fishing_sail_a', 'Рыбацкий парусник «шлюп»', (B, r) => {
  const F = B.f, h = hullMeshes(B, { L: 24, W: 8, fb: 2.8, draft: 1.6, sheer: 1.6, cols: { hull: '#35607a', stripe: P.white, bottom: '#222' } }, .9);
  // будка на корме (каюта с крышей и дверью) убрана — палуба ровная, как у остальных кораблей
  F.add(cyl(.2, .3, 17.5, P.w3, 0, 9.6, 3, 7));
  F.add(bar([0, 3.6, 3], [0, 3.6, -9.5], .17, P.w3, 5), bar([0, 15.2, 3], [0, 13.2, -5.2], .12, P.w3, 5));
  const pv = new T.Group(); pv.position.set(0, 0, 3); pv.name = 'SailPivot'; F.add(pv);
  const m = gridCloth([[0, 15.2, 0], [0, 13.2, -8.2], [0, 3.8, -12.5], [0, 3.8, 0]], 5, 5, sailMat('fish')); m.mesh.name = 'Sail'; pv.add(m.mesh); billow(B, m, 1.6, 0, 1, 0);
  const j = triCloth([0, 16.8, 3.1], [0, 4, 13.5], [0, 4, 3.6], 6, sailMat('fish2')); j.mesh.name = 'Jib'; F.add(j.mesh); billow(B, j, 1.1, 0, -1, 1);
  F.add(bar([0, 3.2, 8], [0, 4, 13.8], .22, P.w3, 5), bar([0, 18, 3], [0, 4, 13.8], .07, P.rope, 4), flag(B, F, 0, 18.6, 3, 2.4, 1.2, 0, P.red));
  const n = gridCloth([[0, 0, 0], [6, 0, 0], [6, -3.4, 0], [0, -3.4, 0]], 6, 5, netMat(), [3, 2]); n.mesh.rotation.y = Math.PI / 2; n.mesh.position.set(h.rail(0) + .15, 4.2, -2); F.add(n.mesh);
  F.add(barrelMesh(.9, 2, P.w1, 8).translateX(2.2).translateY(.9).translateZ(7), barrelMesh(.9, 2, P.w2, 8).translateX(-2.2).translateY(.9).translateZ(6.5), crateBox(1.8, 1.4, 1.8, P.w2, P.w3).translateX(-2).translateY(.9).translateZ(-1));
  // детали: белый планширь, кнехты на кромке у носа
  sheerRail(F, h, 24, .9, { color: P.white });
  for (const s of [-1, 1]) cleat(F, s * (h.rail(8) - .1), h.topZ(8) + .3, 8);
  B.fns.push(t => { pv.rotation.y = Math.sin(t * .5) * .1; }); rock(B, .03, r() * 6);
});
def('fishing_sail_b', 'Рыбацкий люггер (два паруса)', (B, r) => {
  const F = B.f, h = hullMeshes(B, { L: 22, W: 7.4, fb: 2.5, draft: 1.4, sheer: 1.2, cols: { hull: '#9a4a2a', stripe: P.cream, bottom: '#2a1a12' } }, .8);
  [[5, 15, 'fish', 0], [-4.5, 17, 'fish2', 1]].forEach(([z, H, tk, i]) => {
    F.add(cyl(.17, .24, H - .8, P.w3, 0, (H + .8) / 2, z, 7));
    F.add(bar([0, H - 1.2, z + 2.6], [0, H + .2, z - 4], .13, P.w3, 5));
    const s = gridCloth([[0, H - 1.2, z + 2.6], [0, H + .2, z - 4], [0, 4.6, z - 4.4], [0, 4.4, z + 2.4]], 5, 5, sailMat(tk)); s.mesh.name = 'Sail'; F.add(s.mesh); billow(B, s, 1.5, 0, 1, i);
    F.add(bar([0, 4.4, z + 2.4], [0, 4.6, z - 4.4], .1, P.w3, 5));
  });
  F.add(flag(B, F, 0, 17.8, -4.5, 2.2, 1.1, 0, P.red) && cyl(.07, .07, 1, P.w3, 0, 17.4, -4.5, 4));
  for (let i = 0; i < 4; i++) F.add(barrelMesh(.85, 1.9, r.pick([P.w1, P.w2]), 8).translateX(-2 + (i % 2) * 2.2).translateY(.8).translateZ(-8 + Math.floor(i / 2) * 2));
  F.add(box(3, 1.2, 2.4, P.w3, 0, 1.4, 9), sph(.9, '#8fa7b0', 1, 1.4, 1.5, 1.5, .5, .6, 6), coilMesh(1.1, 1).translateX(-2).translateY(.8).translateZ(2));
  F.add(bar([0, 3, 9.5], [0, 4.4, 15], .2, P.w3, 5)); rock(B, .03, r() * 6);
  // детали: кремовый планширь с мелкими стойками, кнехт у носа у борта
  sheerRail(F, h, 22, .8, { color: P.cream });
  for (const s of [-1, 1]) cleat(F, s * (h.rail(7) - .1), h.topZ(7) + .3, 7);
});
def('merchant_cog', 'Торговая когга', (B, r) => ship(B, r, {
  hull: { L: 36, W: 11, fb: 4, draft: 2.4, sheer: 2.2, cols: { hull: '#7a5a3a', stripe: '#c9a227', bottom: '#2a1a12' } }, deckY: 2.2, sailTex: 'merchant', rock: .014,
  castles: [{ z0: -17, z1: -9, h: 3.2, color: '#7a5a3a', windows: 3, windowCol: '#1d2a30', rearWall: 1 }, { z0: 11, z1: 16, h: 2.2, color: '#7a5a3a' }],
  masts: [{ z: 2, h: 29, r: .7, sails: [{ top: 25, h: 15, w: 18, wb: 20 }], shrouds: true, nest: 25.5, flag: { w: 4, h: 2, tex: 0, color: P.red } }],
  guns: [], bow: { len: 4, rise: 2.5 },
  extra(F, h, r) {
    for (let i = 0; i < 5; i++) F.add(barrelMesh(1, 2.2, r.pick([P.w1, P.w2]), 8).translateX(-2.5 + (i % 3) * 2.5).translateY(2.2).translateZ(-5 - Math.floor(i / 3) * 2.4 + 8));
    F.add(crateBox(2.4, 2, 2.4, P.w2, P.w3).translateY(2.2).translateX(2.8).translateZ(7), crateBox(2, 1.8, 2, P.w1, P.w3).translateY(2.2).translateX(-2.8).translateZ(-2), box(3, .4, 3, '#3a5a8a', 0, 2.4, -5));
    lantern(F, 3.5, 7.2, -16.5); lantern(F, -3.5, 7.2, -16.5);
    sackPile(F, -2.2, 2.2, 12.5, r);      // мешки с зерном в носовой части (левый борт)
  } }));
def('merchant_carrack', 'Торговая каравелла', (B, r) => ship(B, r, {
  hull: { L: 48, W: 13.5, fb: 4.8, draft: 3, sheer: 2.8, stations: 20, cols: { hull: '#c79a52', stripe: '#2f6a4a', bottom: '#2a1a12' } }, deckY: 2.9, sailTex: 'merchant2', rock: .012,
  castles: [{ z0: -23, z1: -12, h: 3.6, color: '#b98550', windows: 4, windowCol: P.gold, rearWall: 1 }, { z0: 15, z1: 21, h: 2.4, color: '#b98550' }],
  masts: [{ z: 12, h: 32, r: .6, sails: [{ top: 20, h: 12, w: 15, wb: 17 }, { top: 31, h: 9.5, w: 11, wb: 12 }], shrouds: true, flag: { w: 3, h: 1.6 } },
    { z: -2, h: 40, r: .7, sails: [{ top: 24, h: 14, w: 20, wb: 22 }, { top: 38, h: 11, w: 13, wb: 14.5 }], shrouds: true, nest: 32, flag: { w: 4.5, h: 2.2, tex: 'royal' } },
    { z: -17, h: 28, r: .5, lateen: true }],
  bow: { len: 8, rise: 3 }, railCol: '#2f6a4a',      // планширь в цвет зелёной полосы
  extra(F, h, r) {
    F.add(box(5, .5, 6, '#3a5a8a', 0, 3.1, 5)); for (let i = 0; i < 6; i++) F.add(barrelMesh(1, 2.2, r.pick([P.w1, P.w2]), 8).translateX(-3.5 + (i % 3) * 3.5).translateY(2.9).translateZ(-8 + Math.floor(i / 3) * 2.5));
    F.add(crateBox(2.6, 2.2, 2.6, P.w2, P.w3).translateY(2.9).translateX(3.4).translateZ(3), crateBox(2.2, 2, 2.2, P.w1, P.w3).translateY(2.9).translateX(-3.6).translateZ(4));
    lantern(F, 4.5, 7.7, -22.5); lantern(F, -4.5, 7.7, -22.5);
    sackPile(F, 1.0, 2.9, 18.5, r);      // груз у носа, между кнехтами
  } }));
def('pirate_ship', 'Пиратский флагман Джека Воробья', (B, r) => ship(B, r, {
  hull: { L: 58, W: 15.5, fb: 5.2, draft: 3.4, sheer: 2.6, stations: 22, sternSheer: .9, cols: { hull: '#2a1d16', stripe: '#8c1f1f', bottom: '#120d0a' } }, deckY: 3.4, sailTex: 'pirate', rock: .012,
  castles: [{ z0: -29, z1: -19, h: 3.2, color: '#2a1d16', windows: 5, windowCol: P.gold, rearWall: 1 }, { z0: 17, z1: 24, h: 2.2, color: '#2a1d16' }],
  masts: [{ z: 14, h: 32, r: .62, sails: [{ top: 20, h: 11.5, w: 18, wb: 20 }, { top: 31, h: 9.5, w: 12, wb: 13 }], shrouds: true, flag: { w: 4, h: 2, tex: 0, color: '#8c1f1f' } },
    { z: -1, h: 40, r: .72, sails: [{ top: 24, h: 14, w: 24, wb: 26 }, { top: 38, h: 11, w: 15, wb: 16.5 }], shrouds: true, nest: 31, flag: { w: 8, h: 5, tex: 'jolly' } },
    { z: -15, h: 28, r: .5, lateen: true, flag: { w: 3.5, h: 1.8, tex: 0, color: '#8c1f1f' } }],
  guns: [-10, -5.5, -1, 3.5, 8, 12], bow: { len: 9, rise: 3, figure: P.gold },
  railCol: '#120d0a', shields: { zs: [-12, -2, 6, 14], a: '#8c1f1f', b: P.white },      // чёрный планширь, щиты с костяным кантом
  extra(F, h, r) {
    lantern(F, 4.5, 7.4, -28.5); lantern(F, -4.5, 7.4, -28.5);
    // столбик на корме укорочен и поднят: нижняя точка над палубой выше 3.5 м, чтобы не мешать ходить у штурвала
    F.add(tor(1.1, .12, P.w3, 0, 8.4, -24, 0, 0, 0, 4, 10), box(.3, 1.2, .3, P.w3, 0, 8.1, -24), box(2.6, .4, 2.6, P.w1, 0, 3.7, -2));
    F.add(barrelMesh(.9, 2, P.w2, 8).translateX(3).translateY(3.4).translateZ(7), barrelMesh(.9, 2, P.w1, 8).translateX(-3).translateY(3.4).translateZ(8));
    F.add(barrelMesh(.9, 2, P.w1, 8).translateX(-2).translateY(3.4).translateZ(21), crateBox(2.2, 1.8, 2.2, P.w1, P.w3).translateX(2.4).translateY(3.4).translateZ(20.5));
  } }));
def('royal_ship', 'Королевский корабль капитана Зантио', (B, r) => ship(B, r, {
  hull: { L: 52, W: 14.5, fb: 5.6, draft: 3.2, sheer: 3.4, stations: 22, sternSheer: 1, cols: { hull: '#f1ece0', stripe: '#d9a92b', bottom: '#2a4a8a' } }, deckY: 3.5, sailTex: 'royal', rock: .012,
  castles: [{ z0: -26, z1: -15, h: 4.2, color: '#f1ece0', windows: 5, windowCol: '#2a58a8', rearWall: 1 }, { z0: -15, z1: -11, h: 2, color: '#2a58a8' }, { z0: 15, z1: 22, h: 2.6, color: '#f1ece0' }],
  masts: [{ z: 11, h: 30, r: .6, sails: [{ top: 17, h: 9.5, w: 17, wb: 19 }, { top: 26, h: 8, w: 12, wb: 13.5 }, { top: 33.8, h: 5, w: 8, wb: 9 }].slice(0, 2), shrouds: true, flag: { w: 3.5, h: 1.8, tex: 'royal' } },
    { z: -2, h: 38, r: .7, sails: [{ top: 21, h: 12, w: 22, wb: 24 }, { top: 32, h: 9.5, w: 15, wb: 16.5 }, { top: 40, h: 6, w: 9, wb: 10 }].slice(0, 2), shrouds: true, nest: 33, flag: { w: 6, h: 3.6, tex: 'royal' } },
    { z: -13, h: 26, r: .5, lateen: true, flag: { w: 3.5, h: 1.8, tex: 'royal' } }],
  guns: [-8, -4, 0, 4, 8, 12], bow: { len: 8, rise: 3.2, figure: P.gold, scroll: P.gold },
  railCol: P.gold, shields: { zs: [-12, 2, 12], a: '#2a58a8', b: P.gold },      // золотой планширь, синие королевские щиты
  extra(F, h, r, Bx) {
    for (const z of [-9, -4.5, 0, 4.5, 9]) for (const s of [-1, 1]) F.add(box(.2, 1, 1.3, '#1d2a30', s * (h.half(z, 2) + .02), 1, z + 2.1));
    lantern(F, 3.5, 9.3, -25.5); lantern(F, -3.5, 9.3, -25.5); lantern(F, 0, 9.3, -25.5);
    // древко флага на корме поднято (низ выше 5 м над палубой), чтобы не торчало на уровне головы у штурвала
    F.add(cyl(.1, .1, 3, P.gold, 0, 10.1, -25.2, 5), flag(Bx, F, 0, 11, -25.2, 3, 1.6, 'royal'));
    F.add(crateBox(2.2, 1.8, 2.2, P.w2, P.w3).translateX(-2.4).translateY(3.5).translateZ(18));
  } }));

def('richard_boat', 'Кораблик Ричарда («Морской бой»)', (B, r) => {
  const F = B.f, h = hullMeshes(B, { L: 14, W: 5.6, fb: 2, draft: .9, sheer: 1.2, cols: { hull: '#f2c94c', stripe: P.blue, bottom: '#8a5a33' } }, -.1);
  for (const z of [-3.5, 1]) F.add(box(2 * h.half(z, .8) - .1, .3, 1.1, P.w1, 0, .8, z));
  F.add(cyl(.2, .28, 13, P.w3, 0, 6.5, 2.2, 7), flag(B, F, 0, 13.4, 2.2, 2.2, 1.2, 0, P.red), box(.25, 1.8, .9, P.w3, 0, 1.6, -6.8));
  const pv = new T.Group(); pv.name = 'SailPivot'; pv.position.set(0, 0, 2.2); F.add(pv);
  pv.add(rot(cyl(.14, .14, 6, P.w3, 0, 11.5, 0, 5), Math.PI / 2, 0, 0).translateZ(-1.4), rot(cyl(.12, .12, 6, P.w3, 0, 3.4, 0, 5), Math.PI / 2, 0, 0).translateZ(-1.4));
  const s = gridCloth([[0, 11.5, 1.6], [0, 11.5, -4.4], [0, 3.4, -4.4], [0, 3.4, 1.6]], 5, 5, sailMat('richard')); s.mesh.name = 'Sail'; pv.add(s.mesh); billow(B, s, 1.2, 0, 1, 0);
  let ang = 0; B.g.userData.setSailAngle = a => { ang = a; pv.rotation.y = a; }; B.g.userData.sail = pv;
  B.fns.push(t => { if (B.g.userData.autoSail !== false) pv.rotation.y = Math.sin(t * .5) * .5; });
  F.add(sph(.4, P.red, 0, 2.2, 5.5, 1, 1, 1, 6)); rock(B, .04, r() * 6);
});

/* ================= МОРСКОЙ БОЙ ================= */
def('boarding_plank', 'Абордажная доска', (B, r) => {
  const F = B.f; F.add(box(2.4, .4, 15, P.w2, 0, 1.0, 0));
  for (let i = -6; i <= 6; i++) F.add(box(2.4, .12, .22, P.w3, 0, 1.28, i * 1.1));
  for (const s of [-1, 1]) { for (const z of [-6.5, 0, 6.5]) F.add(cyl(.12, .12, 1.8, P.w3, s * 1.1, 2.1, z, 5)); F.add(bar([s * 1.1, 2.9, -6.5], [s * 1.1, 2.9, 6.5], .09, P.rope, 4)); }
  for (const z of [-7, 7]) F.add(box(3, .8, 1, P.w3, 0, .4, z));
  for (const s of [-.8, 0, .8]) F.add(mesh(new T.ConeGeometry(.22, 1.3, 5), P.iron, s, 1.0, 8.1).rotateX(Math.PI / 2), box(.2, .3, .6, P.iron, s, 1.0, 7.5));
  F.add(box(2.6, .15, .6, P.iron, 0, 1.25, 7.55), tor(.5, .1, P.iron, 0, 1.6, -7.6, 0, 0, 0, 4, 8));
});
def('harpoon_gun', 'Гарпунная пушка', (B, r) => {
  const F = B.f; F.add(cyl(2, 2.3, .4, P.w3, 0, .2, 0, 9), cyl(.6, .75, 3.3, P.w1, 0, 2, 0, 8), cyl(.9, .9, .3, P.iron, 0, 3.8, 0, 8));
  const aim = new T.Group(); aim.name = 'Aim'; aim.position.set(0, 4.5, 0); F.add(aim);
  const bz = cyl(.4, .65, 3.4, P.iron, 0, 0, 0, 8); bz.rotation.x = Math.PI / 2; bz.position.z = .6;
  aim.add(bz, box(.3, 1.2, .3, P.iron, .85, -.5, 0), box(.3, 1.2, .3, P.iron, -.85, -.5, 0), rot(cyl(.18, .18, 1.9, P.iron, 0, 0, 0, 6), 0, 0, Math.PI / 2), bar([0, -.2, -1.2], [0, .9, -3.4], .13, P.w3, 5));
  aim.add(bar([0, 0, -.4], [0, 0, 5.6], .13, P.w3, 5), mesh(new T.ConeGeometry(.42, 1.1, 4), P.iron, 0, 0, 6.2).rotateX(Math.PI / 2), box(.7, .1, .35, P.iron, 0, 0, 5.4).rotateY(.0), box(.1, .7, .35, P.iron, 0, 0, 5.4));
  aim.add(...sagPts([0, 0, -.4], [0, -3.3, -2.5], 5, 0).slice(0, 5).map((p, i, a) => i < a.length - 1 ? bar(p, a[i + 1], .08, P.rope, 4) : sph(.01, P.rope, 0, 0, 0)));
  F.add(coilMesh(1.2, 2).translateX(3.2).translateZ(-1));
  B.fns.push(t => { aim.rotation.y = Math.sin(t * .6) * .4; aim.rotation.x = -.1 + Math.sin(t * .9) * .05; });
});
def('cannon_ship', 'Пушка корабельная', (B, r) => {
  const c = cannon(1.6); B.f.add(c);
  const g = new T.Group(); g.name = 'Balls'; [[-.5, 0], [.5, 0], [0, .9]].forEach(p => g.add(sph(.5, P.iron, 3.2 + p[0], .5, -2 + p[1], 1, 1, 1, 7))); g.add(sph(.5, P.iron, 3.2, 1.35, -1.6, 1, 1, 1, 7)); B.f.add(g);
  B.f.add(bar([-1.8, .6, -3.8], [-1.8, .6, 2.2], .1, P.w3, 5));
});

/* ================= СЕТИ / ВЕРШИ ================= */
def('net_drying', 'Сеть на просушке', (B, r) => {
  const F = B.f;
  for (const s of [-1, 1]) F.add(cyl(.3, .38, 9.5, P.w3, s * 6, 4.75, 0, 6), cyl(.9, 1.1, .9, P.stone, s * 6, .45, 0, 6));
  F.add(bar([-6, 8.6, 0], [6, 8.6, 0], .12, P.rope, 4));
  const n = gridCloth([[-5.6, 8.5, 0], [5.6, 8.5, 0], [5.6, 2.6, 0], [-5.6, 2.6, 0]], 10, 7, netMat(), [6, 3]); n.mesh.name = 'Net'; F.add(n.mesh);
  const a = n.geo.attributes.position.array; B.fns.push(t => { for (let k = 0; k < n.n; k++) a[k * 3 + 2] = n.base[k * 3 + 2] + Math.sin(n.U[k] * 5 + t * 1.5) * .25 * n.V[k]; n.geo.attributes.position.needsUpdate = true; });
  for (let i = 0; i < 9; i++) F.add(sph(.28, '#e8742c', -5 + i * 1.25, 8.2, .1, 1, 1, 1, 5));
  for (let i = 0; i < 6; i++) F.add(sph(.25, P.stone, -4.5 + i * 1.8, 2.45, .05, 1, 1, 1, 5));
  F.add(sph(1.6, '#8fa07a', 0, .7, 3.5, 1.8, .45, 1.1, 7), sph(1.1, '#8fa07a', 2.2, .6, 4.3, 1.3, .4, 1, 7));
});
def('fish_traps', 'Верши (плетёные ловушки)', (B, r) => {
  const F = B.f;
  const trap = (R, Lh) => {
    const pts = []; [[.6, 0], [1, .15], [1.15, .5], [1.1, .8], [.9, 1]].forEach(([a, b]) => pts.push(new T.Vector2(R * a, Lh * b)));
    const g = new T.Group(); g.add(mesh(new T.LatheGeometry(pts, 9), '#c9a36a', 0, 0, 0, { side: true }));
    for (const f of [.2, .5, .85]) g.add(tor(R * (f === .2 ? 1 : 1.12), .07 * R, '#7a5530', 0, Lh * f, 0, Math.PI / 2, 0, 0, 4, 9));
    g.add(mesh(new T.ConeGeometry(R * .85, Lh * .45, 9, 1, true), '#a8844a', 0, Lh * .85, 0, { side: true }).translateY(-Lh * .05).rotateX(Math.PI));
    return g;
  };
  const a = trap(1.8, 6); a.rotation.z = Math.PI / 2; a.position.set(-3, 1.7, 0); F.add(a);
  const b = trap(1.3, 4.5); b.rotation.z = Math.PI / 2; b.rotation.y = .6; b.position.set(2.5, 1.3, 3.5); F.add(b);
  const c = trap(1.1, 4); c.position.set(3, 0, -3); F.add(c);
  F.add(sph(.4, '#e8742c', -5.5, 1, 2.2, 1, 1, 1, 5), sph(.35, '#e8742c', -4.5, .9, 2.8, 1, 1, 1, 5), sph(.8, P.stone, 5.4, .5, 0, 1, .7, 1, 5));
  rope(F, sagPts([-5.2, 1.8, 0], [-5.5, 1, 2.2], 4, .2), .1);
});

/* ================= БУИ ================= */
def('buoy_mooring', 'Буй швартовый шаровой', (B, r) => {
  const F = B.f, R = 1.9;
  [[0, 1.1, P.red], [1.1, 2.0, P.white], [2.0, Math.PI, P.red]].forEach(([a, b, c]) => F.add(mesh(new T.SphereGeometry(R, 12, 5, 0, Math.PI * 2, a, b - a), c, 0, .7, 0, { side: true })));
  F.add(tor(.7, .16, P.iron, 0, .7 + R + .5, 0, 0, 0, 0, 5, 10), cyl(.3, .3, .8, P.iron, 0, .7 + R + .1, 0, 6));
  for (let i = 0; i < 6; i++) F.add(mesh(new T.TorusGeometry(.4, .1, 4, 8), P.iron, 0, -1.6 - i * .7, 0).rotateY(i * Math.PI / 2));
  rock(B, .07, r() * 6);
});
def('buoy_beacon', 'Бакен с фонарём', (B, r) => {
  const F = B.f; F.add(cyl(1.6, 1.9, 2.2, P.red, 0, .6, 0, 10), cyl(1.9, 1.9, .3, P.black, 0, .1, 0, 10), cyl(.22, .3, 8, P.black, 0, 5.5, 0, 6), cyl(.9, .9, .3, P.iron, 0, 8.1, 0, 8));
  F.add(mesh(new T.ConeGeometry(.8, 1.4, 6), P.black, 0, 9.3, 0), mesh(new T.ConeGeometry(.8, 1.4, 6), P.black, 0, 10.8, 0));
  const lm = new T.MeshStandardMaterial({ color: '#f4d46a', emissive: new T.Color('#ffcc40'), emissiveIntensity: 1 });
  const lamp = new T.Mesh(new T.SphereGeometry(.55, 8, 6), lm); lamp.position.set(0, 8.7, 0); lamp.name = 'Lamp'; F.add(lamp);
  for (let i = 0; i < 5; i++) F.add(mesh(new T.TorusGeometry(.4, .1, 4, 8), P.iron, 0, -1.2 - i * .7, 0).rotateY(i * Math.PI / 2));
  const ph = r() * 6; B.fns.push(t => { lm.emissiveIntensity = .3 + .7 * (Math.sin(t * 3 + ph) > 0 ? 1 : 0); }); rock(B, .05, ph);
});
def('buoy_lighthouse', 'Буй-маячок полосатый', (B, r) => {
  const F = B.f; F.add(cyl(2.4, 2.6, .9, P.black, 0, .1, 0, 10));
  F.add(cyl(1.8, 2.2, 2.6, P.red, 0, 1.8, 0, 10), cyl(1.4, 1.8, 2.6, P.white, 0, 4.4, 0, 10), cyl(1.0, 1.4, 2.6, P.red, 0, 7, 0, 10), cyl(1.2, 1.0, .3, P.iron, 0, 8.45, 0, 10));
  const lm = new T.MeshStandardMaterial({ color: '#f4d46a', emissive: new T.Color('#ffcc40'), emissiveIntensity: 1 });
  const lamp = new T.Mesh(new T.CylinderGeometry(.7, .7, 1.4, 8), lm); lamp.position.set(0, 9.3, 0); lamp.name = 'Lamp'; F.add(lamp);
  F.add(mesh(new T.ConeGeometry(1, 1, 8), P.iron, 0, 10.5, 0), sph(.2, P.iron, 0, 11.1, 0, 1, 1, 1, 5));
  for (let i = 0; i < 4; i++) F.add(mesh(new T.TorusGeometry(.4, .1, 4, 8), P.iron, 0, -1.2 - i * .7, 0).rotateY(i * Math.PI / 2));
  const ph = r() * 6; B.fns.push(t => { lm.emissiveIntensity = .4 + .6 * (.5 + .5 * Math.sin(t * 2 + ph)); }); rock(B, .04, ph);
});
