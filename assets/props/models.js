// Процедурные модели реквизита «props» — Three.js r160, без внешних файлов.
// Единицы: персонаж ≈ 6.5. Низ на y=0, центр по x/z в (0,0), «лицо» в +z.
let T = null;
let cache = new Map();
const PI = Math.PI;

function M(c, o = {}) {
  const k = c + JSON.stringify(o);
  let m = cache.get(k);
  if (!m) { m = new T.MeshStandardMaterial({ color: c, roughness: .88, metalness: 0, flatShading: true, ...o }); cache.set(k, m); }
  return m;
}
const GLOW = (c, i = 1) => M(c, { emissive: c, emissiveIntensity: i });
function rng(seed) {
  let a = (seed * 2654435761 + 1013904223) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function G(name, parent) { const g = new T.Group(); g.name = name; if (parent) parent.add(g); return g; }
function put(p, m, x = 0, y = 0, z = 0, shadow = true) { m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; p.add(m); return m; }
function mat(c) { return typeof c === 'string' ? M(c) : c; }
// box: низ на y
function box(p, s, c, x = 0, y = 0, z = 0) {
  const g = new T.BoxGeometry(s[0], s[1], s[2]); g.translate(0, s[1] / 2, 0);
  return put(p, new T.Mesh(g, mat(c)), x, y, z);
}
// cyl: низ на y
function cyl(p, r, h, c, x = 0, y = 0, z = 0, seg = 8, rt = r) {
  const g = new T.CylinderGeometry(rt, r, h, seg); g.translate(0, h / 2, 0);
  return put(p, new T.Mesh(g, mat(c)), x, y, z);
}
function cone(p, r, h, c, x = 0, y = 0, z = 0, seg = 8) { return cyl(p, r, h, c, x, y, z, seg, 0.001); }
// sph: центр на y
function sph(p, r, c, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 10) {
  const m = put(p, new T.Mesh(new T.SphereGeometry(r, seg, Math.max(5, seg - 3)), mat(c)), x, y, z);
  m.scale.set(sx, sy, sz); return m;
}
function tor(p, R, r, c, x, y, z, arc = PI * 2, rs = 5, ts = 14) {
  return put(p, new T.Mesh(new T.TorusGeometry(R, r, rs, ts, arc), mat(c)), x, y, z);
}
const V = (x, y, z) => new T.Vector3(x, y, z);
function beam(p, a, b, r, c, seg = 6) {
  const A = V(...a), B = V(...b), d = B.clone().sub(A), L = d.length();
  const m = new T.Mesh(new T.CylinderGeometry(r, r, L, seg), mat(c));
  m.position.copy(A).add(B).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  m.castShadow = true; p.add(m); return m;
}
function addAnim(g, f) { const o = g.userData.animate; g.userData.animate = t => { if (o) o(t); f(t); }; }

// пламя (анимированное)
function fire(p, x, y, z, s = 1, ph = 0) {
  const g = G('Fire', p); g.position.set(x, y, z);
  const spec = [['#d8461c', 1, 1, 0, 0], ['#f58a1f', .78, .8, .35, .2], ['#ffcf4a', .5, .55, 0, 0], ['#e65a1e', .45, .6, -.4, -.15], ['#ff9a2a', .4, .5, .1, -.4]];
  const fl = spec.map(([c, r, h, ox, oz], i) => {
    const hh = h * 2.6 * s, m = new T.Mesh(new T.ConeGeometry(r * s, hh, 6), GLOW(c, .9));
    m.position.set(ox * s, hh / 2, oz * s); m.userData.h = hh; m.userData.o = [ox * s, oz * s]; g.add(m); return m;
  });
  addAnim(p, t => fl.forEach((m, i) => {
    const k = 1 + .2 * Math.sin(t * 9 + i * 2.1 + ph) + .1 * Math.sin(t * 17 + i * 1.3);
    m.scale.set(1.1 - .1 * k, k, 1.1 - .1 * k); m.position.y = m.userData.h * k / 2;
    m.position.x = m.userData.o[0] + .08 * s * Math.sin(t * 7 + i); m.rotation.z = .08 * Math.sin(t * 5 + i + ph);
  }));
  return g;
}
// canvas-текстура (кэш)
const texCache = new Map();
function tex(key, w, h, draw) {
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; texCache.set(key, t);
  }
  return t;
}
// колышущееся полотнище; левый край x=0 закреплён
function cloth(p, w, h, map, x, y, z, o = {}) {
  const sx = o.sx || 10, sy = o.sy || 4, taper = o.taper || 0, amp = o.amp || w * .12, sp = o.sp || 4.5, ph = o.ph || 0;
  const g = new T.PlaneGeometry(w, h, sx, sy); g.translate(w / 2, 0, 0);
  const pos = g.attributes.position, base = Float32Array.from(pos.array);
  if (taper) for (let i = 0; i < pos.count; i++) { const u = base[i * 3] / w; base[i * 3 + 1] *= (1 - taper * u); pos.setY(i, base[i * 3 + 1]); }
  const m = new T.Mesh(g, new T.MeshStandardMaterial({ map, color: map ? 0xffffff : (o.color || '#cc3333'), side: T.DoubleSide, roughness: .9, flatShading: false }));
  m.name = 'Cloth'; put(p, m, x, y, z);
  const upd = t => {
    for (let i = 0; i < pos.count; i++) {
      const u = base[i * 3] / w;
      pos.setZ(i, amp * u * Math.sin(base[i * 3] * (1.3 / (w / 8)) - t * sp + ph) + .15 * amp * u * Math.sin(base[i * 3 + 1] * 1.5 - t * sp * .7));
      pos.setY(i, base[i * 3 + 1] - u * u * (o.droop || 0) + .05 * amp * u * Math.sin(t * sp * 1.3 + base[i * 3] + ph));
    }
    pos.needsUpdate = true; g.computeVertexNormals();
  };
  upd(0); return { mesh: m, upd };
}
function flagAnim(root, c) { addAnim(root, t => c.upd(t)); }

export const MODELS = [];
function def(id, name, group, fn) {
  MODELS.push({ id, name, group: 'props', cat: group, make(THREE, seed = 0) {
    if (T !== THREE) { T = THREE; cache = new Map(); texCache.clear(); }
    const r = rng(seed + id.length * 131 + id.charCodeAt(id.length - 1));
    const g = fn(r, seed); g.name = id; g.userData.id = id;
    const dead = []; g.traverse(o => { if (o.isMesh && !o.visible) dead.push(o); }); dead.forEach(o => o.parent.remove(o));
    const mn = new T.Box3().setFromObject(g).min.y;
    if (Math.abs(mn) > .05) g.children.forEach(c => { c.position.y -= mn; });
    return g;
  } });
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const WOOD = ['#9a6a3e', '#b98550', '#6b4527'], STONE = '#9b958c', RED = '#a8412e', IRON = '#3b3f44';
function cylX(p, r, len, c, x, y, z, seg = 6) { const m = put(p, new T.Mesh(new T.CylinderGeometry(r, r, len, seg), mat(c)), x, y, z); m.rotation.z = PI / 2; return m; }
function cylZ(p, r, len, c, x, y, z, seg = 6) { const m = put(p, new T.Mesh(new T.CylinderGeometry(r, r, len, seg), mat(c)), x, y, z); m.rotation.x = PI / 2; return m; }
function wheel(p, R, w, x, y, z, c = '#6b4527') {
  const wh = G('Wheel', p); wh.position.set(x, y, z);
  const t = tor(wh, R, w * .6, c, 0, 0, 0, PI * 2, 5, 14); t.rotation.y = PI / 2;
  cylX(wh, R * .18, w * 1.4, '#4a3320', 0, 0, 0, 6);
  for (let i = 0; i < 4; i++) { const b = put(wh, new T.Mesh(new T.BoxGeometry(w * .6, R * 2 - .2, w * .6), mat(c)), 0, 0, 0); b.rotation.x = i * PI / 4; }
  return wh;
}
function katana(p, x, y, z, rz = 0) {
  const k = G('Katana', p); k.position.set(x, y, z); k.rotation.z = rz;
  cyl(k, .08, 3.2, '#d8dde2', 0, 0.9, 0, 4); cyl(k, .26, .12, '#e8b923', 0, .88, 0, 8); cyl(k, .1, 1, '#1e1b2e', 0, 0, 0, 5); cyl(k, .1, 3.5, '#241a1a', 0, -3.5, 0, 5).visible = false; return k;
}

/* ───────── ЗАБОРЫ (секция длиной 8, концы x=±4) ───────── */
def('fence_picket', 'Забор штакетник', 'fence', r => {
  const g = G('Fence'), col = pick(r, ['#b98550', '#c89a62', '#d8c8a0']);
  for (const x of [-3.8, 3.8]) box(g, [.6, 4.8, .6], '#6b4527', x, 0, 0);
  box(g, [8, .4, .3], '#9a6a3e', 0, .9, -.25); box(g, [8, .4, .3], '#9a6a3e', 0, 2.9, -.25);
  for (let i = 0; i < 10; i++) {
    const x = -3.6 + i * .8, h = 3.4 + (r() - .5) * .4;
    box(g, [.5, h, .2], col, x, .2, .05); cone(g, .36, .6, col, x, .2 + h, .05, 4).rotation.y = PI / 4;
  }
  return g;
});
def('fence_wattle', 'Плетень', 'fence', r => {
  const g = G('Fence'), c = pick(r, ['#8a6a3a', '#9a7a48']);
  for (let i = 0; i <= 8; i++) cyl(g, .16, 4 + r() * .6, '#5e3f22', -4 + i, 0, 0, 5);
  for (let row = 0; row < 6; row++) for (let i = 0; i < 8; i++) {
    const m = box(g, [1.05, .38, .3], c, -3.5 + i, .4 + row * .6, ((i + row) % 2 ? .2 : -.2));
    m.rotation.z = (r() - .5) * .08;
  }
  return g;
});
def('fence_stone', 'Каменная ограда', 'fence', r => {
  const g = G('Fence'), grey = [STONE, '#8a847b', '#a9a39a'];
  [[0, 1.3], [1.3, 1.2]].forEach(([y, h], row) => {
    let x = -4; while (x < 4 - .05) {
      let w = 1.3 + r() * .8; if (x + w > 4 || 4 - (x + w) < .9) w = 4 - x;
      const m = box(g, [w - .06, h - .05 + r() * .1, 1.5 + r() * .2], pick(r, grey), x + w / 2, y, 0); m.rotation.y = (r() - .5) * .08; x += w;
    }
  });
  for (let i = 0; i < 4; i++) box(g, [2.02, .5, 1.9], '#b0aa9f', -3 + i * 2, 2.5, 0);
  for (let i = 0; i < 6; i++) sph(g, .35 + r() * .2, '#6ea848', -3.5 + r() * 7, 3, .5, 1, .5, 1, 6);
  return g;
});
def('fence_bamboo', 'Бамбуковый забор', 'fence', r => {
  const g = G('Fence'), bam = ['#a9b45a', '#98a64c', '#b9c26a'];
  for (let i = 0; i < 15; i++) {
    const x = -3.8 + i * .543, h = 4.4 + (r() - .5) * .8, c = pick(r, bam);
    cyl(g, .22, h, c, x, 0, 0, 6); for (const y of [1.2, 2.4, 3.6]) if (y < h) cyl(g, .27, .12, '#7d8a38', x, y, 0, 6);
  }
  for (const x of [-4, 4]) cyl(g, .32, 5.4, '#8c9840', x, 0, 0, 6);
  for (const y of [1.0, 3.2]) { beam(g, [-4, y, .35], [4, y, .35], .2, '#8c9840'); for (let i = 0; i < 9; i++) cyl(g, .27, .22, '#4a3520', -4 + i, y - .11 + .1, .35, 6).rotation.x = 0; }
  return g;
});
def('fence_gate', 'Забор с воротами', 'fence', (r, seed) => {
  const g = G('Fence'), w = '#b98550';
  for (const x of [-4, 4, -2.3, 2.3]) { box(g, [.7, 6, .7], '#6b4527', x, 0, 0); cone(g, .55, .5, '#6b4527', x, 6, 0, 4).rotation.y = PI / 4; }
  for (const s of [-1, 1]) {
    box(g, [1.7, .35, .25], '#9a6a3e', s * 3.15, 1, -.25); box(g, [1.7, .35, .25], '#9a6a3e', s * 3.15, 2.9, -.25);
    for (let i = 0; i < 2; i++) { const x = s * (2.85 + i * .85); box(g, [.5, 3.6, .2], w, x, .2, .05); cone(g, .36, .6, w, x, 3.8, .05, 4).rotation.y = PI / 4; }
  }
  const open = (seed % 2) * .9;
  for (const s of [-1, 1]) {
    const leaf = G(s < 0 ? 'GateL' : 'GateR', g); leaf.position.set(s * 2.3, 0, 0); leaf.rotation.y = s * open;
    box(leaf, [2.1, .35, .25], '#9a6a3e', -s * 1.1, 1, -.1); box(leaf, [2.1, .35, .25], '#9a6a3e', -s * 1.1, 3.2, -.1);
    beam(leaf, [-s * .2, .9, .05], [-s * 2, 3.5, .05], .13, '#6b4527');
    for (let i = 0; i < 3; i++) { box(leaf, [.55, 3.8, .2], w, -s * (.35 + i * .7), .2, .08); }
  }
  return g;
});

/* ───────── ФОНАРИ ───────── */
def('lamp_post', 'Фонарь-столб', 'lamp', r => {
  const g = G('Lamp');
  cyl(g, 1, .8, IRON, 0, 0, 0, 8, .7); cyl(g, .3, 11, IRON, 0, .8, 0, 6, .22); cyl(g, .5, .5, IRON, 0, 11.6, 0, 6);
  const L = G('Lantern', g); L.position.y = 12;
  cyl(L, .9, .4, IRON, 0, 0, 0, 4, 1.1).rotation.y = PI / 4;
  const gl = cyl(L, 1.1, 2.2, GLOW('#ffd36a', .8), 0, .4, 0, 4, .85); gl.rotation.y = PI / 4; gl.castShadow = false;
  cone(L, 1.5, 1.2, IRON, 0, 2.6, 0, 4).rotation.y = PI / 4; sph(L, .3, IRON, 0, 4);
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) cyl(L, .08, 2.2, IRON, x * .72, .4, z * .72, 4);
  return g;
});
def('lamp_hanging', 'Подвесной фонарь', 'lamp', r => {
  const g = G('Lamp');
  cyl(g, .5, 12, '#6b4527', 0, 0, 0, 6, .38); box(g, [4, .5, .5], '#6b4527', 1.8, 11.6, 0); beam(g, [0, 9, 0], [2.2, 11.6, 0], .2, '#6b4527');
  const sw = G('Lantern', g); sw.position.set(3.4, 11.6, 0);
  cyl(sw, .06, 1.2, IRON, 0, -1.2, 0, 4);
  cyl(sw, .5, .3, '#3a2a20', 0, -1.45, 0, 8, .5);
  const b = sph(sw, 1.35, GLOW('#e0482c', .65), 0, -2.7, 0, 1, 1.15, 1); b.castShadow = false;
  cyl(sw, .7, .3, '#3a2a20', 0, -4, 0, 8, .6);
  for (const y of [-3.4, -2.7, -2]) tor(sw, 1.2, .05, '#3a2a20', 0, y, 0, PI * 2, 4, 12).rotation.x = PI / 2;
  addAnim(g, t => { sw.rotation.z = .08 * Math.sin(t * 1.6); sw.rotation.x = .04 * Math.sin(t * 1.1); });
  return g;
});
def('lantern_stone', 'Японский каменный фонарь', 'lamp', r => {
  const g = G('Lamp'), s = '#a39d93', d = '#8a847b';
  cyl(g, 2, .8, d, 0, 0, 0, 6); cyl(g, .6, 3.2, s, 0, .8, 0, 6, .6); cyl(g, 1.6, .5, d, 0, 4, 0, 6, 1.2);
  cyl(g, 1.3, 2.2, s, 0, 4.5, 0, 6, 1.3);
  for (let i = 0; i < 3; i++) { const a = i * PI / 3 * 2; box(g, [.9, 1.2, 1.2], GLOW('#ffd36a', .9), Math.sin(a) * 1.28, 5, Math.cos(a) * 1.28).rotation.y = a; }
  cyl(g, 3, .5, s, 0, 6.7, 0, 6, 1.6); cyl(g, 1.6, 1.1, d, 0, 7.2, 0, 6, .5); sph(g, .5, s, 0, 8.6, 0, 1, 1.2, 1);
  cone(g, 1.5, 1.3, d, 0, 7.2, 0, 6).scale.y = 0.01; return g;
});
def('torch', 'Факел (анимированный)', 'lamp', r => {
  const g = G('Torch');
  cyl(g, .5, 8.5, '#6b4527', 0, 0, 0, 6, .38); cyl(g, .75, 1.4, '#3a2a20', 0, 7.6, 0, 7, .9);
  for (const y of [7.8, 8.4]) tor(g, .78, .07, '#2a2018', 0, y, 0, PI * 2, 4, 10).rotation.x = PI / 2;
  fire(g, 0, 9, 0, 1.0); return g;
});

/* ───────── УКАЗАТЕЛИ ───────── */
function plank(p, w, h, c, x, y, z, tip = 0, text = 3) {
  const b = box(p, [w, h, .3], c, x, y, z);
  if (tip) { const t = put(p, new T.Mesh(new T.BoxGeometry(h * .71, h * .71, .3), mat(c)), x + w / 2 * tip, y + h / 2, z); t.rotation.z = PI / 4; }
  for (let i = 0; i < text; i++) box(p, [w * (.5 - i * .1), h * .12, .1], '#3a2a20', x - tip * h * .15 * 0, y + h * .75 - i * h * .22, z + .2);
  return b;
}
def('sign_post', 'Указатель-стрелка', 'sign', r => {
  const g = G('Sign'); cyl(g, .4, 8, '#6b4527', 0, 0, 0, 6, .35);
  const a = G('Arrow', g); a.position.y = 5.2; a.rotation.y = (r() - .5) * .5; plank(a, 4.4, 1.7, '#b98550', .4, 0, .45, 1, 3);
  cone(g, .6, .5, '#6b4527', 0, 8, 0, 6); return g;
});
def('sign_arrows', 'Перекрёсток (3 стрелки)', 'sign', r => {
  const g = G('Sign'); cyl(g, .5, 12, '#6b4527', 0, 0, 0, 6, .4); sph(g, .6, '#6b4527', 0, 12.2);
  [[8.4, .5, 1, '#b98550'], [6.2, -.7, -1, '#c89a62'], [4, .15, 1, '#9a6a3e']].forEach(([y, rot, d, c], i) => {
    const a = G('Arrow' + i, g); a.position.y = y; a.rotation.y = rot + (d < 0 ? PI : 0);
    plank(a, 4.8, 1.6, c, d < 0 ? 0 : 0, 0, .55, 1, 2);
  });
  return g;
});
def('sign_board_hang', 'Вывеска на цепях', 'sign', r => {
  const g = G('Sign');
  for (const x of [-3.8, 3.8]) cyl(g, .4, 10, '#6b4527', x, 0, 0, 6, .35);
  box(g, [8.6, .6, .6], '#6b4527', 0, 9.6, 0);
  const sw = G('Board', g); sw.position.y = 9.6;
  for (const x of [-2.6, 2.6]) cyl(sw, .06, 2, IRON, x, -2, 0, 4);
  box(sw, [6.4, 3, .4], '#b98550', 0, -5, 0); box(sw, [6.4, .35, .5], '#6b4527', 0, -2.35, 0); box(sw, [6.4, .35, .5], '#6b4527', 0, -5, 0);
  box(sw, [4.2, .6, .1], '#a8412e', 0, -3.5, .26); sph(sw, .8, '#e6d29a', 0, -4.4, .26, 1, 1, .15);
  addAnim(g, t => { sw.rotation.x = .06 * Math.sin(t * 1.4); });
  return g;
});
def('sign_notice', 'Доска объявлений', 'sign', r => {
  const g = G('Sign');
  for (const x of [-3.2, 3.2]) cyl(g, .4, 8.5, '#6b4527', x, 0, 0, 6, .35);
  box(g, [6.8, 4.2, .4], '#9a6a3e', 0, 3, 0);
  const rf = box(g, [8, .5, 2], '#a8412e', 0, 8, .2); rf.rotation.x = .35; box(g, [7.4, .4, .5], '#6b4527', 0, 7.2, .2);
  for (let i = 0; i < 4; i++) { const p = box(g, [1.4, 1.8 + r() * .6, .08], pick(r, ['#efe6c8', '#e6dbb0', '#f4efdc']), -2.4 + i * 1.6, 3.8 + r() * .5, .25); p.rotation.z = (r() - .5) * .2; sph(g, .12, '#a8412e', -2.4 + i * 1.6, 5.3, .32, 1, 1, .5, 5); }
  return g;
});

/* ───────── ЧЕРЕПА ───────── */
function skull(p, s, x, y, z, rot = 0) {
  const k = G('Skull', p); k.position.set(x, y, z); k.rotation.y = rot; const bone = '#ece4cc', dark = '#1a1614';
  sph(k, .75 * s, bone, 0, .95 * s, 0, 1, .95, 1.05, 12);
  box(k, [.8 * s, .4 * s, .8 * s], bone, 0, .3 * s, .1 * s);
  for (const e of [-1, 1]) { sph(k, .2 * s, dark, e * .3 * s, .95 * s, .62 * s, 1, 1.2, .5, 8); }
  const n = cone(k, .1 * s, .22 * s, dark, 0, .62 * s, .72 * s, 3); n.rotation.x = PI;
  for (let i = -2; i <= 2; i++) box(k, [.12 * s, .2 * s, .1 * s], '#fff8e4', i * .15 * s, .3 * s, .52 * s);
  return k;
}
def('skull_human', 'Череп человеческий', 'skull', r => {
  const g = G('Skull'); skull(g, 1.2, 0, 0, 0, (r() - .5) * .6); box(g, [2.2, .3, .35], '#e0d8be', 0, 0, -.1).rotation.y = .6; box(g, [2.2, .3, .35], '#e0d8be', 0, .01, -.1).rotation.y = -.6; return g;
});
def('skull_big', 'Череп большой', 'skull', r => {
  const g = G('Skull'); box(g, [7, 1.2, 6], '#8a847b', 0, 0, 0); skull(g, 4.5, 0, 1.2, 0);
  for (const [x, z, a] of [[-3.4, 2.4, .3], [3.2, 2.6, -.4]]) { const b = cyl(g, .3, 3.2, '#e0d8be', x, 1.2, z, 6); b.rotation.set(1.3, a, 0); sph(g, .5, '#e0d8be', x, 1.4, z); }
  return g;
});
def('skull_pole', 'Череп на колу (пиратская метка)', 'skull', r => {
  const g = G('Skull'); cyl(g, .35, 10, '#4a3320', 0, 0, 0, 6, .28); for (let i = 0; i < 5; i++) sph(g, .55, '#8a847b', Math.cos(i) * 1.5, .4, Math.sin(i) * 1.5, 1, .7, 1, 6);
  beam(g, [-1.6, 6.1, 0], [1.6, 7.4, 0], .22, '#4a3320'); skull(g, 1.5, 0, 8.7, 0.1);
  const rag = cloth(g, 1.6, 1.2, null, .3, 6.4, .05, { color: '#222', amp: .3, sx: 4, sy: 2 }); flagAnim(g, rag); return g;
});

/* ───────── СУНДУКИ ───────── */
function chest(p, w, h, d, o) {
  const g = G('Chest', p), b = G('Body', g), lh = d * .5;
  box(b, [w, h, d], o.wood, 0, 0, 0);
  for (const x of [-w * .38, w * .38]) box(b, [.35, h + .05, d + .1], o.band, x, 0, 0);
  box(b, [w + .1, .3, d + .1], o.band, 0, 0, 0);
  const L = G('Lid', g); L.position.set(0, h, -lh);
  const lid = new T.Mesh(new T.CylinderGeometry(lh, lh, w, 10, 1, false, 0, PI), mat(o.wood)); lid.rotation.z = PI / 2; lid.rotation.y = 0; lid.position.set(0, 0, lh); lid.castShadow = true; L.add(lid);
  lid.geometry.rotateY(0); lid.scale.set(o.flat || .75, 1, 1);
  for (const x of [-w * .38, w * .38]) { const bd = new T.Mesh(new T.CylinderGeometry(lh + .08, lh + .08, .35, 10, 1, false, 0, PI), mat(o.band)); bd.rotation.z = PI / 2; bd.position.set(x, 0, lh); bd.scale.set(o.flat || .75, 1, 1); L.add(bd); }
  const lk = box(L, [.7, .8, .3], o.lock || '#e8b923', 0, -.5, d + .02 - .0);
  L.userData.lockZ = d;
  L.rotation.x = -(o.open || 0);
  return { g, L, b };
}
function coins(p, n, r, x, y, z, rad, h = 1) {
  const gold = GLOW('#e8b923', .25), gold2 = M('#f2cf55', { emissive: '#8a6a10', emissiveIntensity: .3 });
  for (let i = 0; i < n; i++) {
    const a = r() * PI * 2, d = Math.sqrt(r()) * rad, yy = y + h * (1 - d / rad) * (.6 + r() * .4);
    const c = cyl(p, .38, .12, r() < .5 ? gold : gold2, x + Math.cos(a) * d, yy, z + Math.sin(a) * d, 5); c.rotation.set((r() - .5) * 1, r() * 3, (r() - .5) * 1);
  }
}
def('chest_closed', 'Сундук закрытый', 'chest', r => {
  const c = chest(null || new T.Group(), 3.6, 1.9, 2.4, { wood: '#9a6a3e', band: '#3b3f44' }); return c.g;
});
def('chest_open_gold', 'Сундук открытый с золотом', 'chest', r => {
  const c = chest(new T.Group(), 3.6, 1.9, 2.4, { wood: '#b98550', band: '#6b4527', open: 1.9 });
  box(c.b, [3.2, .3, 2], '#4a3320', 0, 1.5, 0); coins(c.b, 45, r, 0, 1.7, 0, 1.45, 1.1);
  for (let i = 0; i < 6; i++) coins(c.g, 1, r, 2.3 + r() * 1.6, 0, r() * 2 - .5, .5, 0);
  return c.g;
});
def('chest_iron', 'Сундук окованный', 'chest', r => {
  const c = chest(new T.Group(), 4.2, 2.3, 2.6, { wood: '#6b4527', band: '#4c5258', lock: '#8a9096', flat: .6 });
  for (const x of [-1.6, 0, 1.6]) for (const y of [.5, 1.6]) sph(c.b, .13, '#8a9096', x, y, 1.33, 1, 1, .6, 5);
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) box(c.b, [.6, .6, .6], '#4c5258', x * 2.0, 0, z * 1.1);
  for (const x of [-1, 1]) { tor(c.g, .5, .08, '#4c5258', x * 2.15, 1.2, 0, PI * 2, 4, 8).rotation.y = PI / 2; }
  return c.g;
});
def('chest_pirate', 'Пиратский клад', 'chest', r => {
  const c = chest(new T.Group(), 4.4, 2.2, 2.8, { wood: '#4a3320', band: '#c99a22', open: 1.7, flat: .9 });
  box(c.b, [4, .3, 2.4], '#2a1c10', 0, 1.8, 0); coins(c.b, 70, r, 0, 2, 0, 1.9, 1.7);
  coins(c.g, 18, r, 0, 0, 3.2, 2.6, .5);
  [['#d12a3a', -.8, 3.6], ['#2fae6a', .9, 3.4], ['#3b6fd8', .2, 4.2]].forEach(([c0, x, z]) => { const j = new T.Mesh(new T.OctahedronGeometry(.4), GLOW(c0, .5)); put(c.g, j, x, .5, z); });
  for (let i = 0; i < 14; i++) sph(c.g, .17, '#f6f2e8', -1.8 + i * .26, 2.4 + Math.sin(i / 13 * PI) * .35, 1.2, 1, 1, 1, 6);
  const gob = G('Goblet', c.g); gob.position.set(-3.4, 0, 2.2); cyl(gob, .25, .9, '#e8b923', 0, 0, 0, 7); cyl(gob, .6, .9, '#e8b923', 0, .9, 0, 8, .8);
  const sk = skull(c.g, .5, 0, 0, 0); sk.position.set(2.2, 0, 0.1 + 0); sk.position.set(0, .8, 1.5 + 0); sk.visible = false;
  return c.g;
});
def('x_mark', 'X-метка клада', 'chest', r => {
  const g = G('XMark');
  const p1 = box(g, [8.5, .18, 1.1], '#b3261e', 0, 0, 0); p1.rotation.y = PI / 4; const p2 = box(g, [8.5, .18, 1.1], '#b3261e', 0, .01, 0); p2.rotation.y = -PI / 4;
  for (const s of [p1, p2]) s.receiveShadow = true;
  for (let i = 0; i < 6; i++) sph(g, .35 + r() * .2, '#c9b377', (r() - .5) * 8, .0, (r() - .5) * 8, 1, .3, 1, 6);
  cyl(g, .15, 3.5, '#6b4527', 3.4, 0, 3.2, 5, .12).rotation.x = .2;
  box(g, [.8, .12, .8], '#9a6a3e', 3.4, 3.2, 3.2);
  return g;
});

/* ───────── ФЛАГИ ───────── */
const TX = {
  royal: () => tex('royal', 256, 160, (c, w, h) => { c.fillStyle = '#b8262e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e8b923'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10); c.fillStyle = '#f2cf55'; c.beginPath(); c.moveTo(80, 110); c.lineTo(70, 55); c.lineTo(105, 80); c.lineTo(128, 42); c.lineTo(151, 80); c.lineTo(186, 55); c.lineTo(176, 110); c.closePath(); c.fill(); c.fillRect(80, 112, 96, 14); }),
  pirate: () => tex('pirate', 256, 170, (c, w, h) => { c.fillStyle = '#17171a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f2ecd8'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(70, 120); c.lineTo(186, 150); c.moveTo(186, 120); c.lineTo(70, 150); c.stroke(); c.fillStyle = '#f2ecd8'; c.beginPath(); c.arc(128, 70, 42, 0, 7); c.fill(); c.fillRect(106, 100, 44, 22); c.fillStyle = '#17171a'; c.beginPath(); c.arc(112, 68, 11, 0, 7); c.arc(144, 68, 11, 0, 7); c.fill(); c.fillRect(124, 84, 8, 10); }),
  ninja: () => tex('ninja', 256, 160, (c, w, h) => { c.fillStyle = '#1e1b2e'; c.fillRect(0, 0, w, h); c.fillStyle = '#b8262e'; c.beginPath(); c.arc(128, 80, 50, 0, 7); c.fill(); c.fillStyle = '#e8e4dc'; c.translate(128, 80); for (let i = 0; i < 4; i++) { c.rotate(PI / 2); c.beginPath(); c.moveTo(0, 0); c.lineTo(12, -10); c.lineTo(40, -2); c.lineTo(10, 8); c.closePath(); c.fill(); } }),
  sashi: () => tex('sashi', 128, 512, (c, w, h) => { c.fillStyle = '#f2ead2'; c.fillRect(0, 0, w, h); c.fillStyle = '#b8262e'; c.beginPath(); c.arc(64, 150, 44, 0, 7); c.fill(); c.fillStyle = '#1e1b2e'; c.fillRect(0, 0, 12, h); c.fillRect(w - 12, 0, 12, h); for (let i = 0; i < 4; i++) c.fillRect(34, 250 + i * 60, 60, 14); c.fillRect(60, 240, 8, 240); }),
  spear: () => tex('spear', 128, 80, (c, w, h) => { c.fillStyle = '#b8262e'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8b923'; c.fillRect(0, 30, w, 20); }),
  pennant: () => tex('pennant', 256, 64, (c, w, h) => { const cs = ['#2f9ec4', '#f2ead2', '#b8262e', '#f2ead2', '#2f9ec4']; cs.forEach((k, i) => { c.fillStyle = k; c.fillRect(i * w / 5, 0, w / 5 + 1, h); }); }),
};
def('flag_royal', 'Флаг королевский', 'flag', r => {
  const g = G('Flag'); box(g, [4, 1.2, 4], '#9b958c', 0, 0, 0); cyl(g, .3, 21, '#6b4527', 0, 1.2, 0, 6, .22); sph(g, .6, '#e8b923', 0, 22.6);
  box(g, [1.2, .3, .3], '#e8b923', 0, 21.2, 0);
  const c = cloth(g, 10, 6.2, TX.royal(), .25, 18.4, 0, { ph: r() * 6 }); flagAnim(g, c); return g;
});
def('flag_pirate', 'Флаг пиратский Весёлый Роджер', 'flag', r => {
  const g = G('Flag'); for (const a of [0, 1.57, 3.14, 4.7]) box(g, [3.5, .5, .6], '#4a3320', Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2).rotation.y = -a;
  cyl(g, .35, 20, '#4a3320', 0, .3, 0, 6, .25); box(g, [.8, .6, .8], '#4a3320', 0, 20.3, 0);
  const c = cloth(g, 9, 6, TX.pirate(), .25, 16.5, 0, { amp: 1.4, sp: 5.5, ph: r() * 6, sx: 12 }); flagAnim(g, c); return g;
});
def('flag_ninja', 'Флаг ниндзя', 'flag', r => {
  const g = G('Flag'); cyl(g, .9, .8, '#2a2a30', 0, 0, 0, 6); cyl(g, .22, 15, '#1e1b2e', 0, .8, 0, 6, .18); cone(g, .3, .9, '#8a9096', 0, 15.8, 0, 6);
  beam(g, [0, 15.4, 0], [0, 15.4, 0.01], .25, '#8a9096');
  const c = cloth(g, 8, 4.6, TX.ninja(), .2, 13, 0, { amp: 1.1, sp: 6.5, sx: 12, ph: r() * 6 }); flagAnim(g, c); return g;
});
def('flag_sashimono', 'Самурайский сашимоно', 'flag', r => {
  const g = G('Flag'); cyl(g, .8, .6, '#4a3320', 0, 0, 0, 6); cyl(g, .22, 16, '#4a3320', 0, .6, 0, 6, .18); sph(g, .35, '#e8b923', 0, 16.8);
  beam(g, [0, 15.3, 0], [3, 15.3, 0], .13, '#4a3320');
  const c = cloth(g, 2.8, 11, TX.sashi(), .25, 9.6, 0, { amp: .8, sx: 4, sy: 10, sp: 3.5, ph: r() * 6 }); flagAnim(g, c);
  return g;
});
def('flag_spear', 'Флаг на копье', 'flag', r => {
  const g = G('Flag'), s = G('Spear', g); s.rotation.z = -.12; s.rotation.x = .08;
  cyl(s, .25, 13, '#6b4527', 0, 0, 0, 6, .22); cone(s, .4, 2.2, '#c8ccd2', 0, 13, 0, 4); cyl(s, .4, .3, '#a8412e', 0, 12.8, 0, 6);
  const c = cloth(s, 4.6, 2.8, TX.spear(), .22, 11.2, 0, { amp: .8, sx: 8, ph: r() * 6, sp: 6 }); flagAnim(g, c);
  for (let i = 0; i < 4; i++) sph(g, .5 + r() * .3, '#9b958c', Math.cos(i * 1.6) * 1.1, .1, Math.sin(i * 1.6) * 1.1, 1, .6, 1, 6);
  return g;
});
def('flag_pennant', 'Вымпел', 'flag', r => {
  const g = G('Flag'); cyl(g, .35, .6, '#6b4527', 0, 0, 0, 6, .5); cyl(g, .18, 12, '#e6d29a', 0, .6, 0, 6, .14); sph(g, .3, '#e8b923', 0, 12.8);
  const c = cloth(g, 11, 2.2, TX.pennant(), .2, 11.2, 0, { taper: .9, amp: 1.6, sx: 14, sp: 7, ph: r() * 6 }); flagAnim(g, c); return g;
});

/* ───────── КОСТРЫ ───────── */
def('campfire_logs', 'Костёр с камнями', 'campfire', r => {
  const g = G('Campfire'); for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; sph(g, .8 + r() * .3, pick(r, [STONE, '#8a847b', '#aaa49a']), Math.cos(a) * 3, .45, Math.sin(a) * 3, 1, .7, 1, 6); }
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + .4; beam(g, [Math.cos(a) * 2, .3, Math.sin(a) * 2], [Math.cos(a) * .3, 1.6, Math.sin(a) * .3], .38, '#5e3f22', 6); }
  cyl(g, 1.8, .15, '#2a2420', 0, 0, 0, 10); fire(g, 0, .9, 0, 1.4); return g;
});
def('campfire_tripod', 'Костёр с котлом', 'campfire', r => {
  const g = G('Campfire'); for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3; beam(g, [Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2], [Math.cos(a) * .2, 9, Math.sin(a) * .2], .22, '#4a3320'); }
  for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; sph(g, .7, STONE, Math.cos(a) * 2.2, .4, Math.sin(a) * 2.2, 1, .7, 1, 6); }
  beam(g, [-.5, 3.6, 0], [.5, 3.6, 0], .06, IRON); cyl(g, .07, 3, IRON, 0, 5.4, 0, 4);
  const pot = sph(g, 1.7, '#2c2e33', 0, 3.8, 0, 1, .85, 1, 12); pot.position.y = 4;
  cyl(g, 1.5, .1, '#4a7a4a', 0, 4.9, 0, 10, 1.5);
  fire(g, 0, .4, 0, 1.15); for (let i = 0; i < 3; i++) beam(g, [Math.cos(i * 2) * 1.5, .3, Math.sin(i * 2) * 1.5], [-Math.cos(i * 2) * 1.5, .5, -Math.sin(i * 2) * 1.5], .3, '#5e3f22');
  return g;
});
def('campfire_big', 'Большой костёр-вигвам', 'campfire', r => {
  const g = G('Campfire'); for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, rad = 4.8; box(g, [1.6 + r(), 1, 1.4], pick(r, [STONE, '#8a847b']), Math.cos(a) * rad, 0, Math.sin(a) * rad).rotation.y = -a; }
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2 + r() * .3; beam(g, [Math.cos(a) * 2.8, .4, Math.sin(a) * 2.8], [Math.cos(a) * .3, 7, Math.sin(a) * .3], .42, i % 2 ? '#5e3f22' : '#6b4527'); }
  fire(g, 0, .5, 0, 2.1);
  const sparks = []; for (let i = 0; i < 8; i++) { const s = sph(g, .12, GLOW('#ffcf4a', 1), 0, 4, 0, 1, 1, 1, 4); s.castShadow = false; sparks.push(s); }
  addAnim(g, t => sparks.forEach((s, i) => { const u = ((t * .4 + i / 8) % 1); s.position.set(Math.sin(i * 3 + t * 2) * (1 + u * 2), 3 + u * 9, Math.cos(i * 5 + t) * (1 + u * 2)); s.scale.setScalar(1 - u); }));
  return g;
});

/* ───────── МЕБЕЛЬ ───────── */
const legs = (g, w, d, h, t, c, y = 0) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [t, h, t], c, sx * (w / 2 - t / 2), y, sz * (d / 2 - t / 2)); };
def('table_round', 'Стол круглый', 'table', r => {
  const g = G('Table'), w = pick(r, WOOD); cyl(g, 3.2, .4, w, 0, 3, 0, 14); cyl(g, .6, 3, '#6b4527', 0, 0, 0, 8, .5);
  for (let i = 0; i < 3; i++) beam(g, [Math.cos(i * 2.09) * 1.8, .15, Math.sin(i * 2.09) * 1.8], [0, 1, 0], .22, '#6b4527');
  cyl(g, .8, .12, '#efe6c8', 1, 3.4, .8, 10); cyl(g, .3, .6, '#c8ccd2', -1.2, 3.4, -.5, 8); sph(g, .5, '#d9a65a', -.2, 3.7, 1.4, 1, .7, 1, 8); return g;
});
def('table_long', 'Стол длинный', 'table', r => {
  const g = G('Table'); box(g, [11, .45, 4], '#b98550', 0, 3.1, 0); for (let i = 0; i < 4; i++) box(g, [.05, .46, 4.02], '#8a5f33', -4.1 + i * 2.7, 3.1, 0);
  for (const x of [-4.3, 4.3]) { box(g, [.6, 3.1, 3.2], '#6b4527', x, 0, 0); } box(g, [8.8, .4, .4], '#6b4527', 0, 1, 0);
  cyl(g, .9, .15, '#efe6c8', -2, 3.55, 0.6, 10); cyl(g, .9, .15, '#efe6c8', 2.5, 3.55, -.6, 10); cyl(g, .4, 1, '#8a9096', 0, 3.55, 0, 8); cone(g, .09, .5, '#ffcf4a', 0, 4.6, 0, 5).material = GLOW('#ffcf4a');
  box(g, [1.8, .6, 1.2], '#d9b27a', -3.7, 3.55, -.8); return g;
});
def('table_low', 'Стол низкий японский', 'table', r => {
  const g = G('Table'); box(g, [5, .4, 5], '#6b4527', 0, 1.6, 0); legs(g, 4.2, 4.2, 1.6, .5, '#4a3320');
  cyl(g, .8, .6, '#efe6c8', 0, 2, 0, 8, .6); sph(g, .8, '#efe6c8', 0, 2.6, 0, 1, .7, 1, 8); cone(g, .15, .3, '#4a7a4a', 0, 3.1, 0, 6);
  for (const [x, z] of [[1.6, 1], [1.2, -.6], [-1.6, .2]]) cyl(g, .38, .5, '#2f9ec4', x, 2, z, 7, .3);
  return g;
});
def('bench_plank', 'Скамья простая', 'bench', r => {
  const g = G('Bench'); box(g, [8, .4, 1.9], pick(r, WOOD), 0, 2, 0); for (const x of [-3.3, 3.3]) box(g, [.5, 2, 1.6], '#6b4527', x, 0, 0); box(g, [6.4, .3, .3], '#6b4527', 0, 1, 0); return g;
});
def('bench_back', 'Скамья со спинкой', 'bench', r => {
  const g = G('Bench'); box(g, [8, .4, 2], '#b98550', 0, 2.2, 0); legs(g, 7.8, 1.8, 2.2, .5, '#6b4527');
  for (const x of [-3.7, 3.7]) box(g, [.5, 3.2, .5], '#6b4527', x, 2.2, -.8); for (let i = 0; i < 3; i++) box(g, [8, .55, .22], '#9a6a3e', 0, 3 + i * .75, -.9).rotation.x = -.1;
  for (const x of [-3.9, 3.9]) { box(g, [.3, .3, 1.7], '#6b4527', x, 3.4, .05); } return g;
});
def('bench_log', 'Скамья-бревно', 'bench', r => {
  const g = G('Bench'); const l = cyl(g, 1, 8, '#9a6a3e', 0, 1, 0, 8); l.rotation.z = PI / 2; l.position.set(-4 + 0, 1, 0); l.position.x = 0; l.geometry.translate(0, 0, 0);
  l.position.y = 1; l.rotation.z = PI / 2; l.geometry = new T.CylinderGeometry(1, 1, 8, 8); l.position.y = 1.7;
  for (const x of [-3, 3]) for (const s of [-1, 1]) beam(g, [x, 0, s * 1.4], [x, 1.5, s * .5], .22, '#6b4527');
  for (const x of [-4.02, 4.02]) { const e = cyl(g, .85, .05, '#d9b27a', x, 1.7 - .0, 0, 8); e.rotation.z = PI / 2; e.position.y = 1.7; e.geometry.translate(0, 0, 0); } return g;
});
def('bed_wood', 'Кровать деревянная', 'bed', r => {
  const g = G('Bed'); const blank = pick(r, ['#a8412e', '#2f7a9c', '#5e8a3e']);
  box(g, [4.4, .5, 8], '#9a6a3e', 0, 1.2, 0); legs(g, 4.4, 8, 1.2, .5, '#6b4527'); for (const x of [-1, 1]) box(g, [.5, 4.5, .5], '#6b4527', x * 1.95, 0, -3.8); box(g, [4.4, 2, .4], '#6b4527', 0, 2, -3.8);
  box(g, [4.4, 1, .4], '#6b4527', 0, 1.2, 3.8); for (const x of [-1, 1]) box(g, [.5, 2.4, .5], '#6b4527', x * 1.95, 0, 3.8);
  box(g, [3.9, .9, 7], '#e6d29a', 0, 1.7, 0); box(g, [4.1, .7, 4.6], blank, 0, 2.2, 1.2); sph(g, 1.05, '#f4efdc', 0, 2.9, -2.6, 1.3, .5, .7, 8); return g;
});
def('bed_bunk', 'Кровать двухъярусная', 'bed', r => {
  const g = G('Bed'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, [.5, 9, .5], '#6b4527', sx * 2.1, 0, sz * 3.9);
  for (const y of [1.2, 5.2]) { box(g, [4.7, .4, 8.3], '#9a6a3e', 0, y, 0); box(g, [4, .8, 7.6], '#e6d29a', 0, y + .4, 0); box(g, [4.1, .6, 4.5], y < 3 ? '#a8412e' : '#2f7a9c', 0, y + .9, 1.4); sph(g, .95, '#f4efdc', 0, y + 1.5, -3, 1.3, .5, .7, 8); box(g, [.2, 1, 8.3], '#6b4527', -2.35, y + .4, 0); }
  box(g, [4.7, .3, .3], '#6b4527', 0, 8, -3.9); box(g, [4.7, .3, .3], '#6b4527', 0, 8, 3.9);
  for (let i = 0; i < 5; i++) box(g, [.3, .3, 1.2], '#9a6a3e', 2.4 + .0, 1.3 + i * 1.1, 4.4).rotation.x = 0; for (const z of [3.9, 4.9]) box(g, [.3, 6.5, .3], '#6b4527', 2.45, 0, z); return g;
});
def('bed_futon', 'Футон на татами', 'bed', r => {
  const g = G('Bed'); box(g, [5, .3, 8.6], '#c9b377', 0, 0, 0); for (let i = 0; i < 2; i++) box(g, [5, .32, .15], '#4a6a3a', 0, 0, -2.2 + i * 4.4);
  box(g, [3.8, .9, 7.4], '#efe6c8', 0, .3, .3); box(g, [3.9, .7, 4.2], '#2f4a7c', 0, .8, 1.6); const m = cyl(g, .6, 2.6, '#c9a35a', 0, 1.7, -2.8, 8); m.rotation.z = PI / 2; m.position.set(-1.3, 1.5, -2.8); return g;
});
def('chair_wood', 'Стул деревянный', 'chair', r => {
  const g = G('Chair'); box(g, [2.4, .35, 2.4], '#b98550', 0, 2, 0); legs(g, 2.4, 2.4, 2, .35, '#6b4527'); for (const x of [-1, 1]) box(g, [.35, 2.9, .35], '#6b4527', x * 1.02, 2, -1.02);
  box(g, [2.4, .35, .25], '#9a6a3e', 0, 4.5, -1.02); box(g, [2.4, .3, .25], '#9a6a3e', 0, 3.7, -1.02); box(g, [2.4, .3, .25], '#9a6a3e', 0, 2.9, -1.02); return g;
});
def('chair_arm', 'Кресло с подлокотниками', 'chair', r => {
  const g = G('Chair'); box(g, [3.2, .6, 3], '#6b4527', 0, 1.8, 0); legs(g, 3.2, 3, 1.8, .45, '#4a3320'); box(g, [2.7, .7, 2.6], '#a8412e', 0, 2.4, .1);
  box(g, [3.2, 4, .5], '#6b4527', 0, 2.4, -1.35); box(g, [2.6, 3, .4], '#a8412e', 0, 2.8, -1.0);
  for (const s of [-1, 1]) { box(g, [.45, 1.4, 2.6], '#6b4527', s * 1.5, 2.4, 0); sph(g, .38, '#e8b923', s * 1.5, 4.0, 1.2, 1, 1, 1, 6); sph(g, .3, '#e8b923', s * 1.5, 6.6, -1.35, 1, 1, 1, 6); box(g, [.4, .4, .4], '#6b4527', s * 1.5, 6.2, -1.35); } return g;
});
def('wardrobe_a', 'Шкаф двустворчатый', 'wardrobe', (r, seed) => {
  const g = G('Wardrobe'); box(g, [4.6, 8, 2.4], '#9a6a3e', 0, .5, 0); box(g, [5, .5, 2.8], '#6b4527', 0, 8.5, 0); box(g, [5, .5, 2.8], '#6b4527', 0, 0, 0);
  for (const s of [-1, 1]) { const d = G(s < 0 ? 'DoorL' : 'DoorR', g); d.position.set(s * 2.2, 0, 1.25); d.rotation.y = s * (seed % 2 ? .0 : -0.0) * 0; box(d, [2.1, 7, .2], '#b98550', -s * 1.05, 1, 0); box(d, [1.5, 5, .1], '#9a6a3e', -s * 1.05, 2, .15); sph(d, .2, '#e8b923', -s * .3, 4.5, .25, 1, 1, 1, 6); }
  return g;
});
def('wardrobe_b', 'Буфет с полками', 'wardrobe', r => {
  const g = G('Wardrobe'); box(g, [6, 3.4, 2.2], '#6b4527', 0, .4, 0); for (const s of [-1, 1]) { box(g, [2.8, 2.8, .15], '#9a6a3e', s * 1.5, .7, 1.12); sph(g, .17, '#e8b923', s * .4, 2.1, 1.25, 1, 1, 1, 6); }
  box(g, [6.4, .4, 2.5], '#4a3320', 0, 3.8, 0); box(g, [.4, 4.4, 1.8], '#6b4527', -2.8, 4.2, -.1); box(g, [.4, 4.4, 1.8], '#6b4527', 2.8, 4.2, -.1); box(g, [6, 4.4, .2], '#4a3320', 0, 4.2, -.9);
  box(g, [6, .3, 1.8], '#6b4527', 0, 6, 0); box(g, [6.4, .4, 2], '#4a3320', 0, 8.6, 0);
  for (let i = 0; i < 4; i++) cyl(g, .35, .8 + r() * .4, pick(r, ['#c8ccd2', '#d9a65a', '#2f9ec4']), -2.1 + i * 1.4, 4.2, 0, 8); for (let i = 0; i < 4; i++) box(g, [.4, 1.1, .8], pick(r, ['#a8412e', '#2f7a9c', '#5e8a3e']), -2.2 + i * .45, 6.3, 0); cyl(g, .9, .15, '#efe6c8', 1.6, 6.3, .2, 10).rotation.x = 0;
  return g;
});
def('chest_wall', 'Сундук у стены', 'chest', r => {
  const g = G('Chest'); box(g, [5.4, 2.2, 2.2], '#8a5f33', 0, 0, 0); const L = G('Lid', g); L.position.set(0, 2.2, -1.1); box(L, [5.6, .5, 2.4], '#6b4527', 0, 0, 1.1);
  for (const x of [-2, 2]) box(g, [.35, 2.7, 2.3], IRON, x, 0, 0); box(g, [.8, .8, .2], '#e8b923', 0, 1.1, 1.15); for (const x of [-2, 2]) box(g, [.6, .6, .6], '#6b4527', x, 0, 0); return g;
});
def('hearth_stone', 'Очаг каменный', 'hearth', r => {
  const g = G('Hearth'); const s = () => pick(r, [STONE, '#8a847b', '#a9a39a']);
  for (let i = 0; i < 6; i++) for (const x of [-3.2, 3.2]) box(g, [1.7, 1.35, 2.4], s(), x + (r() - .5) * .2, i * 1.35, -.1);
  for (let i = 0; i < 4; i++) box(g, [2.3, 1.35, 2.4], s(), -2.3 + i * 1.55, 8.1 + 0, -.1).visible = false;
  box(g, [8.4, 1.2, 2.8], '#6b4527', 0, 8.1, .1); box(g, [8, 3, 1.6], '#8a847b', 0, 9.3, -.4); cyl(g, 1.4, 4, '#8a847b', 0, 12.3, -.5, 4, 1.1).rotation.y = PI / 4;
  box(g, [4.6, 8, .5], '#2a2420', 0, 0, -1.1); box(g, [5, .5, 3], '#8a847b', 0, 0, .5); box(g, [4.6, .25, 1.6], '#4a3320', 0, .5, 0);
  for (let i = 0; i < 3; i++) beam(g, [-1.6 + i * 1.6, .55, .4], [-1.2 + i * 1.2, 1.1, -.6], .32, '#5e3f22');
  fire(g, 0, .9, -.2, 1.15);
  beam(g, [-2.2, 6.6, 0], [2.2, 6.6, 0], .1, IRON); cyl(g, .05, 2, IRON, 0, 4.6, 0, 4); const p = sph(g, .9, '#2c2e33', 0, 4.4, 0, 1, .8, 1, 10); return g;
});
def('hearth_irori', 'Очаг ирori (японский)', 'hearth', r => {
  const g = G('Hearth'); for (const [x, z, w, d] of [[0, 3, 7, 1], [0, -3, 7, 1], [3, 0, 1, 5], [-3, 0, 1, 5]]) box(g, [w, 1, d], '#6b4527', x, 0, z);
  box(g, [5, .6, 5], '#8a8680', 0, 0, 0); for (let i = 0; i < 5; i++) sph(g, .5, '#e0482c', (r() - .5) * 3, .65, (r() - .5) * 3, 1, .5, 1, 5).material = GLOW('#e0482c', .8);
  for (let i = 0; i < 3; i++) beam(g, [-1 + i, .8, i % 2 - .5], [1 - i * .7, .9, .5 - i * .7], .24, '#2a2018');
  fire(g, 0, .9, 0, .7); cyl(g, .18, 7, '#4a3320', -3.4, 0, -3.4, 6); beam(g, [-3.4, 7, -3.4], [0, 7, 0], .2, '#4a3320'); cyl(g, .05, 3.2, IRON, 0, 3.8, 0, 4);
  const k = sph(g, 1.1, '#2c2e33', 0, 3.2, 0, 1, .85, 1, 10); cone(g, .35, 1, '#2c2e33', 1, 3, 0, 6).rotation.z = -1.1; return g;
});
def('ladder_wood', 'Лестница деревянная', 'ladder', r => {
  const g = G('Ladder'), lean = G('Lean', g); lean.rotation.x = -.14;
  for (const x of [-1.1, 1.1]) box(lean, [.4, 11, .45], '#9a6a3e', x, 0, 0); for (let i = 0; i < 10; i++) cyl(lean, .16, 2.2, '#b98550', 0, .8 + i * 1.02, 0, 6).rotation.z = PI / 2; 
  lean.children.filter(c => c.geometry && c.geometry.type === 'CylinderGeometry').forEach(c => { c.geometry = new T.CylinderGeometry(.16, .16, 2.2, 6); }); return g;
});
def('ladder_rope', 'Верёвочная лестница', 'ladder', r => {
  const g = G('Ladder'); box(g, [3, .5, .5], '#6b4527', 0, 10.9, -.2);
  const sw = G('Hang', g); sw.position.set(0, 11, 0);
  for (const x of [-1, 1]) cyl(sw, .09, 10.6, '#c9a35a', x, -10.6, 0, 5);
  for (let i = 0; i < 9; i++) cyl(sw, .17, 2.4, '#9a6a3e', 0, -10.3 + i * 1.13, 0, 6).rotation.z = PI / 2;
  sw.children.filter(c => c.geometry && c.geometry.parameters && c.geometry.parameters.height === 2.4).forEach(c => { c.geometry = new T.CylinderGeometry(.17, .17, 2.4, 6); c.geometry.rotateZ(PI / 2); c.rotation.z = 0; });
  addAnim(g, t => { sw.rotation.x = .05 * Math.sin(t * 1.3); }); return g;
});
def('shelf_utensils', 'Полка с утварью', 'shelf', r => {
  const g = G('Shelf'); for (const x of [-3, 3]) box(g, [.4, 8, 1.6], '#6b4527', x, 0, 0); for (const y of [0.3, 2.9, 5.5, 8]) box(g, [6.4, .35, 1.8], '#9a6a3e', 0, y, 0);
  box(g, [6, 8, .2], '#4a3320', 0, 0, -.8);
  for (let i = 0; i < 3; i++) { const x = -2.2 + i * 1.2; cyl(g, .45, .9, pick(r, ['#b9663a', '#c8ccd2']), x, .65, .1, 8, .35); sph(g, .5, '#b9663a', x + .0, 1.8, .1, 1, 1.1, 1, 8).visible = false; }
  for (let i = 0; i < 3; i++) { cyl(g, .6, .8, '#6b6f75', -2 + i * 1.8, 3.25, 0, 8, .7); cyl(g, .55, .08, '#3a3a3c', -2 + i * 1.8, 4.05, 0, 8); }
  for (let i = 0; i < 4; i++) { cyl(g, .4, .35, pick(r, ['#efe6c8', '#2f9ec4', '#a8412e']), -2.2 + i * 1.3, 5.85, .1, 8, .5); }
  cyl(g, .5, .9, '#9a6a3e', 2.5, 5.85, 0, 8); for (let i = 0; i < 3; i++) { cyl(g, .45, 1.1, '#4a7a4a', -2 + i * 1.3, 8.35, .1, 7, .2); } 
  for (let i = 0; i < 2; i++) { cyl(g, .8, .12, '#2c2e33', 1.5 + i * 1.5, 6.5, -.6, 9).rotation.x = PI / 2; cyl(g, .12, 1.4, '#2c2e33', 1.5 + i * 1.5, 5.6, -.55, 4); } return g;
});

/* ───────── ДОДЗЁ ───────── */
def('rack_swords', 'Стойка для мечей', 'dojo', r => {
  const g = G('Rack'); for (const x of [-3, 3]) box(g, [.6, 5, 2], '#4a3320', x, 0, 0); for (const x of [-3, 3]) box(g, [1.2, .4, 3], '#4a3320', x, 0, 0);
  for (const y of [1.6, 3, 4.4]) { box(g, [6.6, .35, .5], '#6b4527', 0, y, 0); const k = G('Sword', g); k.position.set(0, y + .35, .1);
    cylX(k, .09, 5.4, '#d8dde2', .3, 0.12, 0, 4); cylX(k, .25, .18, '#e8b923', -2.6, .12, 0, 8); cylX(k, .13, 1.6, '#1e1b2e', -3.5, .12, 0, 5); }
  box(g, [7, .4, 2.5], '#6b4527', 0, 0, 0).visible = false; sph(g, .3, '#a8412e', -3, 5.3, 0, 1, 1, 1, 6); sph(g, .3, '#a8412e', 3, 5.3, 0, 1, 1, 1, 6); return g;
});
def('rack_weapons', 'Стойка с шестами и копьями', 'dojo', r => {
  const g = G('Rack'); box(g, [8, .5, 2.4], '#4a3320', 0, 0, 0); for (const x of [-3.6, 3.6]) box(g, [.5, 5, .5], '#4a3320', x, 0, -.8); box(g, [8, .4, .4], '#4a3320', 0, 4.2, -.8); box(g, [8, .4, .4], '#4a3320', 0, 2, -.8);
  for (let i = 0; i < 6; i++) { const x = -3 + i * 1.2, h = 9 + (i % 3) * 1.4; const p = cyl(g, .2, h, '#9a6a3e', x, .5, .3 + (i % 2) * .5, 6, .18); p.rotation.z = (i - 2.5) * .01; if (i % 2 === 0) cone(g, .3, 1.6, '#c8ccd2', x, .5 + h, .3, 4); else if (i === 3) box(g, [.15, 1.8, .5], '#c8ccd2', x, .5 + h, .3); }
  for (const x of [-3.2, 3.2]) { const bw = cyl(g, .12, 3, '#6b4527', x, 1, 1.2, 5); bw.rotation.x = .3; } return g;
});
def('mannequin_armor', 'Манекен с самурайской бронёй', 'dojo', r => {
  const g = G('Armor'); box(g, [3.5, .35, 3.5], '#4a3320', 0, 0, 0); cyl(g, .3, 3, '#4a3320', 0, .35, 0, 6);
  const A = '#a8412e', D = '#2a2a30';
  cyl(g, 1.7, 2.2, A, 0, 2.6, 0, 8, 1.2); cyl(g, 1.2, 2.2, D, 0, 4.2, 0, 8, 1.7);
  for (const s of [-1, 1]) { box(g, [.8, .2, 1.4], D, s * 2.1, 5.6, 0).rotation.z = s * -.4; box(g, [.5, 2.6, .8], A, s * 2.4, 3.2, 0).rotation.z = s * .1; }
  cyl(g, .5, .5, D, 0, 6.2, 0, 8); sph(g, .95, '#e8c9a0', 0, 7.2, 0, 1, 1, 1, 8); sph(g, 1.25, D, 0, 7.7, 0, 1, .7, 1, 8).scale.y = .8;
  cone(g, 1.8, .6, A, 0, 7, 0, 8).scale.y = .5; for (const s of [-1, 1]) beam(g, [s * .6, 8.4, 0], [s * 1.6, 10, 0], .12, '#e8b923');
  box(g, [.2, 1.2, .2], '#e8b923', 0, 8.2, 1.2).visible = false; return g;
});
def('mannequin_training', 'Деревянный манекен (мокуджин)', 'dojo', r => {
  const g = G('Dummy'); cyl(g, 1.6, 1, '#6b4527', 0, 0, 0, 8, 1.2); const t = cyl(g, 1, 9, '#9a6a3e', 0, 1, 0, 8, .9);
  for (const [y, s, ln] of [[6.2, 1, 3.2], [4.4, -1, 3.2]]) { cylX(g, .3, ln, '#6b4527', 0, y, .9, 6); }
  cylZ(g, .3, 2, '#6b4527', .0, 6.2 - 2.2 + 1.4, 1.2, 6).visible = false; cylX(g, .3, 2.8, '#6b4527', 0, 3, 1.2, 6).rotation.z = PI / 2 + .0;
  box(g, [.5, 2.4, .5], '#6b4527', 0, 1, 1.1); sph(g, 1, '#b98550', 0, 10.8, 0, 1, 1, 1, 8); for (const y of [3, 5.5, 8]) tor(g, 1, .12, '#4a3320', 0, y, 0, PI * 2, 4, 10).rotation.x = PI / 2; return g;
});
def('target_archery', 'Мишень для стрельбы', 'dojo', r => {
  const g = G('Target'); for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3; beam(g, [Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2 - 1], [0, 8, -.8], .22, '#6b4527'); }
  const f = G('Face', g); f.position.set(0, 7, .2); f.rotation.x = -.15;
  [[3.6, '#e6d29a'], [3, '#1e1b2e'], [2.3, '#2f9ec4'], [1.6, '#b8262e'], [.9, '#e8b923']].forEach(([rd, c], i) => cylZ(f, rd, .6 + i * .09, c, 0, 0, 0, 16));
  for (const [x, y] of [[.3, .2], [-1, .8], [1.1, -.6]]) { const ar = cylZ(f, .06, 3, '#8a5f33', x, y, 1.9, 4); box(f, [.04, .5, .5], '#c33', x, y, 3.4); } return g;
});
def('target_throw', 'Мишень для сюрикэнов', 'dojo', r => {
  const g = G('Target'); box(g, [1.6, 1, 1.6], '#6b4527', 0, 0, 0); cyl(g, .55, 6, '#6b4527', 0, 1, 0, 6, .6);
  const f = G('Face', g); f.position.set(0, 7.5, .5); for (let i = 0; i < 3; i++) cylZ(f, 3 - i * .9, .5 + i * .05, ['#b98550', '#a8412e', '#efe6c8'][i], 0, 0, 0, 14);
  for (let i = 0; i < 5; i++) { const s = new T.Mesh(new T.OctahedronGeometry(.4), M('#8a9096', { metalness: .4 })); s.scale.z = .2; put(f, s, (r() - .5) * 3.5, (r() - .5) * 3.5, .8); }
  const f2 = G('Kunai', f); for (let i = 0; i < 2; i++) cone(f2, .1, 1.3, '#c8ccd2', i * 1.1 - 1.1, -.3 + i * .8, .4, 4).rotation.x = PI / 2 + 0; return g;
});
function ninjaDummy(p, ph) {
  const g = G('Ninja', p), K = '#1e1b2e';
  cyl(g, 1.3, 3.6, K, 0, 0, 0, 8, 1.1); cyl(g, 1.7, 2.4, K, 0, 3.4, 0, 8, 1.3); sph(g, 1.1, K, 0, 6.7, 0, 1, 1.1, 1, 8); box(g, [2, .45, .2], '#b8262e', 0, 6.8, .96);
  box(g, [1.4, .3, .2], '#e6c9a0', 0, 7, .98); tor(g, 1.35, .22, '#b8262e', 0, 4.1, 0, PI * 2, 4, 10).rotation.x = PI / 2;
  for (const s of [-1, 1]) { cyl(g, .55, 3.4, K, s * 1.9, 2.3, 0, 7, .5).rotation.z = s * -.55; } return g;
}
def('dummy_ninja_stand', 'Фигурка ниндзя на стойке', 'dojo', r => {
  const g = G('Dummy'); box(g, [3, .4, 3], '#4a3320', 0, 0, 0); cyl(g, .3, 3, '#6b4527', 0, .4, 0, 6); const n = ninjaDummy(g); n.position.y = 3; return g;
});
def('dummy_ninja_hang', 'Подвесной мешок-ниндзя', 'dojo', r => {
  const g = G('Dummy'); for (const x of [-3, 3]) cyl(g, .4, 12, '#6b4527', x, 0, 0, 6, .35); box(g, [7.2, .6, .6], '#6b4527', 0, 12, 0);
  const sw = G('Swing', g); sw.position.y = 12; cyl(sw, .08, 3, '#c9a35a', 0, -3, 0, 4);
  const n = ninjaDummy(sw); n.scale.setScalar(.95); n.position.y = -10.6 + 0; addAnim(g, t => { sw.rotation.z = .12 * Math.sin(t * 1.6); sw.rotation.x = .05 * Math.sin(t * 1.1); }); return g;
});

/* ───────── УТВАРЬ ───────── */
def('bucket_wood', 'Деревянное ведро', 'tool', r => {
  const g = G('Bucket'); cyl(g, 1.1, 2.4, '#9a6a3e', 0, 0, 0, 10, 1.4); cyl(g, 1.25, .12, '#2f6a8c', 0, 2.1, 0, 10).visible = true;
  for (const y of [.5, 1.7]) tor(g, 1.2 + y * .08, .1, '#3b3f44', 0, y, 0, PI * 2, 4, 12).rotation.x = PI / 2;
  const h = tor(g, 1.4, .08, IRON, 0, 2.4, 0, PI, 4, 12); h.rotation.set(0, 0, 0); cylZ(g, .4, .15, '#c9a35a', 0, 0, 0).visible = false;
  for (let i = 0; i < 6; i++) cyl(g, .12, 1.4, '#c9a35a', 0, 3.8 + i * .5, 0, 5).rotation.z = (i % 2 - .5) * .3;
  const rope = tor(g, 1, .15, '#c9a35a', 3, .15, .8, PI * 2, 4, 10); rope.rotation.x = PI / 2; tor(g, .7, .15, '#c9a35a', 3, .4, .8, PI * 2, 4, 10).rotation.x = PI / 2; return g;
});
def('watering_can', 'Лейка', 'tool', r => {
  const g = G('Can'), C = '#4d8fae'; cyl(g, 1.2, 2.4, C, 0, 0, 0, 10, 1.05); cyl(g, 1.05, .1, '#2a5f7a', 0, 2.4, 0, 10);
  const sp = cyl(g, .3, 3, C, 0, 0, 0, 6, .22); sp.position.set(0, .6, 1.2); sp.rotation.x = .85; sp.geometry.translate(0, 0, 0); sp.position.set(0, 1.5 + .4, 2.1);
  const rose = cyl(g, .55, .5, C, 0, 0, 0, 8, .2); rose.rotation.x = .85; rose.position.set(0, 3.1, 3.2);
  const h = tor(g, 1.2, .14, C, 0, 1.4, -1.2, PI * 2, 4, 12); h.rotation.y = PI / 2; h.scale.set(1, 1, .8);
  const t = tor(g, 1, .12, C, 0, 2.4, 0, PI, 4, 12); t.rotation.y = PI / 2; return g;
});
def('cart_hand', 'Ручная тележка', 'tool', r => {
  const g = G('Cart'); box(g, [5.4, .4, 7], '#9a6a3e', 0, 2.2, -.5); for (const s of [-1, 1]) { box(g, [.3, 1.6, 7], '#b98550', s * 2.55, 2.6, -.5); }
  box(g, [5.4, 1.6, .3], '#b98550', 0, 2.6, -4); box(g, [5.4, 1.6, .3], '#b98550', 0, 2.6, 3);
  wheel(g, 2.2, .4, -3.1, 2.2, -.5, '#6b4527'); wheel(g, 2.2, .4, 3.1, 2.2, -.5, '#6b4527');
  for (const s of [-1, 1]) { box(g, [.35, .35, 5], '#6b4527', s * 1.2, 2.2, 3.5 + 1.5 - 1.2); } box(g, [3, .3, .3], '#6b4527', 0, 2.2, 8);
  for (let i = 0; i < 3; i++) box(g, [1.4, 1.4, 1.4], pick(r, ['#c9a35a', '#a8412e']), -1.4 + i * 1.4, 2.6, -2).rotation.y = r(); return g;
});
def('wheelbarrow', 'Тачка', 'tool', r => {
  const g = G('Barrow'); const tray = cyl(g, 1.6, 2.2, '#9a6a3e', 0, 1.9, .6, 4, 2.4); tray.rotation.y = PI / 4; tray.scale.set(1, 1, 1.3);
  const soil = cyl(g, 2.4, .1, '#5a4228', 0, 4.0, .6, 4); soil.rotation.y = PI / 4; soil.scale.set(.95, 1, 1.2);
  wheel(g, 1.5, .4, 0, 1.5, 3.9, '#3b3f44'); for (const s of [-1, 1]) { beam(g, [s * .8, 2.6, 3.4], [s * 1, 1.5, 4], .1, IRON); box(g, [.3, .3, 6], '#6b4527', s * 1.5, 2.6, -4.5).rotation.x = .0; beam(g, [s * 1.4, 2.5, -1], [s * 1.5, 0, -1.8], .25, '#6b4527'); }
  box(g, [3.4, .3, .3], '#6b4527', 0, 2.4, -4.6); return g;
});

/* ───────── ПОВОЗКА ───────── */
def('wagon_horse', 'Повозка с лошадью', 'wagon', r => {
  const g = G('Wagon'), W = G('Cart', g), H = G('Horse', g); W.position.z = -5;
  box(W, [5.6, .5, 9], '#9a6a3e', 0, 2.6, 0); for (const s of [-1, 1]) box(W, [.35, 1.7, 9], '#b98550', s * 2.6, 3.1, 0); box(W, [5.6, 1.7, .35], '#b98550', 0, 3.1, -4.4);
  for (const z of [-2.8, 2.8]) for (const s of [-1, 1]) wheel(W, 2.6, .5, s * 3.1, 2.6, z, '#6b4527');
  for (const z of [-2.8, 2.8]) cylX(W, .25, 6.4, '#4a3320', 0, 2.6, z, 6);
  for (let i = 0; i < 4; i++) { const a = tor(W, 2.9, .15, '#6b4527', 0, 3.4, -3.6 + i * 2.4, PI, 4, 12); a.scale.set(1, .85, 1); }
  const cv = new T.Mesh(new T.CylinderGeometry(2.95, 2.95, 9, 12, 1, true, -PI / 2, PI), new T.MeshStandardMaterial({ color: '#efe6c8', side: T.DoubleSide, roughness: 1, flatShading: true })); cv.rotation.x = PI / 2; cv.rotation.z = 0; cv.scale.set(1, 1, .85);
  const cvg = new T.Group(); cvg.position.set(0, 3.4, 0); cv.rotation.set(PI / 2, 0, PI / 2); cv.rotation.set(0, 0, 0); cvg.add(cv); W.add(cvg); cv.geometry.rotateX(PI / 2); cv.geometry.rotateY(0); cv.geometry.rotateZ(0); cvg.visible = false;
  const roof = new T.Mesh(new T.CylinderGeometry(2.95, 2.95, 7.4, 12, 1, true, 0, PI), new T.MeshStandardMaterial({ color: '#efe6c8', side: T.DoubleSide, roughness: 1, flatShading: true }));
  roof.rotation.x = PI / 2; roof.rotation.z = -PI / 2; roof.rotation.set(PI / 2, 0, 0); roof.rotation.order = 'YXZ'; roof.position.set(0, 3.4, -.8); roof.rotation.set(0, 0, PI / 2); roof.geometry.rotateZ(0); roof.scale.set(.85, 1, 1); roof.castShadow = true;
  // цилиндр лежит вдоль x после rotation.z=90°; нужен вдоль z:
  roof.rotation.set(PI / 2, 0, 0); roof.geometry.rotateY(-PI / 2); W.add(roof);
  for (let i = 0; i < 2; i++) cyl(W, .9, 1.6, '#9a6a3e', -1.2 + i * 2.4, 3.1, 1.8, 8, .8);
  box(W, [3, .5, 1.2], '#6b4527', 0, 4.2, 4.1).visible = false;
  for (const s of [-1, 1]) beam(W, [s * 1.5, 2.9, 4.5], [s * 1.5, 3.0, 9], .2, '#6b4527');
  // лошадь (смотрит в +z)
  H.position.z = 6.2; const hide = pick(r, ['#8a5a30', '#5a3d22', '#b88a54', '#3b2a1c']), dk = '#2a1c10';
  sph(H, 2, hide, 0, 5.6, 0, .85, .85, 1.55, 12); sph(H, 1.6, hide, 0, 5.8, 2.3, .85, .95, 1, 10); sph(H, 1.5, hide, 0, 5.6, -2.3, .9, .9, 1, 10);
  const neck = beam(H, [0, 6.2, 2.9], [0, 8.9, 4.3], .85, hide, 7);
  const hd = G('Head', H); hd.position.set(0, 9.3, 4.6); hd.rotation.x = .6; box(hd, [1.1, 2.5, 1.3], hide, 0, -2, 0).position.set(0, -.9, .3); hd.children[0].rotation.x = .0; hd.children[0].position.set(0, -1.1, .4); hd.children[0].scale.set(1, .65, .9);
  sph(hd, .75, hide, 0, .2, 0, 1, 1, 1, 8); box(hd, [.85, .8, 1.1], dk, 0, -2, .9).visible = false; sph(hd, .4, dk, 0, -1.7, 1.15, 1, 1, 1, 6);
  for (const s of [-1, 1]) { cone(hd, .25, .8, hide, s * .4, .6, -.2, 4); sph(hd, .12, '#111', s * .6, .35, .5, 1, 1, 1, 5); }
  box(H, [.4, 2.6, 1.4], dk, 0, 7, 3.3).rotation.x = -.7;
  const legs4 = [[-1, 1.5], [1, 1.5], [-1, -2.5], [1, -2.5]];
  legs4.forEach(([s, z]) => { cyl(H, .5, 3.6, hide, s * 1.1, 1.3, z, 6, .6); cyl(H, .4, 1.3, dk, s * 1.1, 0, z, 6, .4); });
  const tail = G('Tail', H); tail.position.set(0, 6.4, -3.6); cone(tail, .5, 3.4, dk, 0, -3.3, 0, 6).rotation.x = 0; tail.children[0].position.y = -3.4; tail.children[0].rotation.x = PI;
  addAnim(g, t => { tail.rotation.x = .25 * Math.sin(t * 2.2); hd.rotation.x = .6 + .06 * Math.sin(t * 1.3); });
  for (const s of [-1, 1]) beam(H, [s * 1.7, 5.6, 0], [s * 1.7, 5.4, -3], .12, '#6b4527');
  tor(H, 1.2, .18, '#6b4527', 0, 8.2, 3.5, PI * 2, 4, 10).rotation.x = .9;
  return g;
});

/* ───────── ВОРОТА ───────── */
def('gate_torii', 'Ворота тории', 'gate', r => {
  const g = G('Gate'), R = '#c0321e', K = '#2a2420';
  for (const s of [-1, 1]) { cyl(g, .75, 1, K, s * 5, 0, 0, 8, .75); cyl(g, .62, 13, R, s * 5, 1, 0, 8, .55); }
  box(g, [12.4, .9, 1.1], R, 0, 9.3, 0); const kasa = box(g, [15, .9, 1.4], K, 0, 12.4, 0);
  for (const s of [-1, 1]) { const e = box(g, [3, .9, 1.4], K, s * 7, 12.6, 0); e.rotation.z = s * -.28; e.position.x = s * 7.2; }
  box(g, [13, .8, 1.6], R, 0, 13.3, 0).position.y = 13.1; box(g, [1.1, 3.2, .6], '#e8b923', 0, 9.5, 0).visible = false; box(g, [1.2, 2.6, .8], K, 0, 10.2, 0); return g;
});
def('gate_wood', 'Деревенские ворота', 'gate', (r, seed) => {
  const g = G('Gate'); for (const s of [-1, 1]) { box(g, [1.4, 12, 1.4], '#6b4527', s * 5.5, 0, 0); box(g, [2, .6, 2], '#4a3320', s * 5.5, 0, 0); }
  box(g, [12.4, 1.2, 1.4], '#6b4527', 0, 10, 0); box(g, [12.4, .5, 1], '#9a6a3e', 0, 8.8, 0);
  for (const s of [-1, 1]) { const rf = box(g, [8, .4, 4.6], '#a8412e', s * 2.6, 11.2, 0); rf.rotation.z = s * -.0; }
  const ra = G('Roof', g); for (const s of [-1, 1]) { const p = box(ra, [7.4, .5, 3.6], RED, s * 3.2, 0, 0); p.rotation.z = s * -.4; p.position.y = 11.3 + (s === 1 ? 0 : 0); } sph(ra, .4, '#e8b923', 0, 13.2).visible = false;
  box(ra, [.8, .8, 3.8], '#6b4527', 0, 13.0, 0);
  const op = [.9, .5][seed % 2];
  for (const s of [-1, 1]) { const l = G(s < 0 ? 'GateL' : 'GateR', g); l.position.set(s * 4.8, 0, 0); l.rotation.y = s * op * 1.2; box(l, [4.8, 8.6, .5], '#9a6a3e', -s * 2.5, .3, 0); for (const y of [1.5, 6.2]) box(l, [4.8, .6, .7], '#4a3320', -s * 2.5, y, 0); beam(l, [-s * .2, 1.6, .4], [-s * 4.8, 7, .4], .22, '#6b4527'); }
  return g;
});
def('gate_wicket', 'Калитка с аркой', 'gate', (r, seed) => {
  const g = G('Gate'); for (const s of [-1, 1]) { cyl(g, .35, 7.5, '#a9b45a', s * 3.2, 0, 0, 6); box(g, [.5, 3.6, .5], '#8c9840', s * 3.2, 0, 0).visible = false; }
  const ra = G('Roof', g); for (const s of [-1, 1]) { const p = box(ra, [4.2, .3, 2.2], '#8a6a3a', s * 1.55, 7.4, 0); p.rotation.z = s * -.35; } box(ra, [7, .3, .3], '#6b4527', 0, 7.2, 0);
  const l = G('Gate', g); l.position.set(-2.8, 0, 0); l.rotation.y = (seed % 2) * -1.0; box(l, [5.2, .3, .3], '#8c9840', 2.7, .8, 0); box(l, [5.2, .3, .3], '#8c9840', 2.7, 4.5, 0); for (let i = 0; i < 6; i++) cyl(l, .22, 4.4 + (i % 2) * .4, '#a9b45a', .6 + i * .9, .3, 0, 6);
  for (const s of [-1, 1]) { for (let i = 0; i < 2; i++) { cyl(g, .22, 3.6, '#a9b45a', s * (4.2 + i * .9), 0, 0, 6); } beam(g, [s * 3.6, 1.2, 0], [s * 5.4, 1.2, 0], .15, '#8c9840'); beam(g, [s * 3.6, 3, 0], [s * 5.4, 3, 0], .15, '#8c9840'); }
  return g;
});

/* ───────── МОСТЫ (вдоль оси x) ───────── */
def('bridge_wood', 'Мост деревянный', 'bridge', r => {
  const g = G('Bridge'), L = 20, Wd = 6;
  for (let i = 0; i < 20; i++) box(g, [.95, .35, Wd], i % 2 ? '#b98550' : '#9a6a3e', -L / 2 + .5 + i, 1.9, 0);
  for (const z of [-2, 0, 2]) box(g, [L, .5, .5], '#6b4527', 0, 1.4, z);
  for (const x of [-9, -3, 3, 9]) for (const z of [-2.6, 2.6]) cyl(g, .45, 1.8, '#4a3320', x, 0, z, 6);
  for (const s of [-1, 1]) { for (let i = 0; i <= 5; i++) box(g, [.5, 3.4, .5], '#6b4527', -L / 2 + .4 + i * 3.84, 2.2, s * 2.8); box(g, [L, .4, .4], '#6b4527', 0, 5.0, s * 2.8); box(g, [L, .3, .3], '#6b4527', 0, 3.4, s * 2.8); }
  return g;
});
def('bridge_arched', 'Мост-арка красный', 'bridge', r => {
  const g = G('Bridge'), L = 18, Wd = 5.5, H = 4.2, N = 18;
  const hy = x => H * (1 - (x / (L / 2)) ** 2) + .6;
  for (let i = 0; i < N; i++) {
    const x = -L / 2 + .5 + i, y = hy(x), sl = Math.atan2(hy(x + .5) - hy(x - .5), 1);
    const p = box(g, [1.05, .4, Wd], '#9a6a3e', x, y, 0); p.rotation.z = sl;
    if (i % 2 === 0) { const st = box(g, [1.05, .3, Wd - .6], '#6b4527', x, y + .1, 0); st.rotation.z = sl; st.visible = false; }
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 6; i++) { const x = -L / 2 + .4 + i * (L - .8) / 6, y = hy(x); box(g, [.5, 3, .5], '#b8301e', x, y, s * 2.5); sph(g, .42, '#e8b923', x, y + 3.1, s * 2.5, 1, 1.2, 1, 6); }
    for (let i = 0; i < N; i++) { const a = [-L / 2 + .5 + i, hy(-L / 2 + .5 + i) + 2.6, s * 2.5], b = [a[0] + 1, hy(a[0] + 1) + 2.6, s * 2.5]; beam(g, a, b, .2, '#b8301e'); }
    for (let i = 0; i < 12; i++) { const x = -L / 2 + 1 + i * 1.5; const y = hy(x); if (y > 1.4) box(g, [.3, y - .5, .3], '#6b4527', x, .0, s * 2.1); }
  }
  for (const s of [-1, 1]) for (const x of [-8.2, 8.2]) box(g, [1.6, 1.4, Wd + .6], '#9b958c', x, 0, 0);
  for (const x of [-7.8, 7.8]) cyl(g, .6, 1, '#6b4527', x, 0, 0, 6).visible = false; return g;
});
def('bridge_rope', 'Верёвочный мост', 'bridge', r => {
  const g = G('Bridge'), L = 24, Sg = 2.2, y0 = 5, Wd = 3.2;
  const dy = x => -Sg * (1 - (x / (L / 2)) ** 2) * -1; // провисание
  const yy = x => y0 - Sg * (1 - (x / (L / 2)) ** 2);
  for (const s of [-1, 1]) { for (const z of [-1.7, 1.7]) { beam(g, [s * 12.6, 0, z], [s * 12.2, 9, z * .9], .4, '#4a3320'); } box(g, [.6, .6, 4.6], '#4a3320', s * 12.2, 8.6, 0); box(g, [3, 1, 4.6], '#9b958c', s * 12.8, 0, 0); }
  const span = G('Span', g);
  for (let i = 0; i < 24; i++) { const x = -L / 2 + .5 + i, sl = Math.atan2(yy(x + .5) - yy(x - .5), 1); const p = box(span, [.8, .28, Wd], i % 3 ? '#9a6a3e' : '#b98550', x, yy(x), 0); p.rotation.z = sl; }
  for (const z of [-1.7, 1.7]) {
    for (let i = 0; i < 24; i++) { const x0 = -L / 2 + i, x1 = x0 + 1; beam(span, [x0, yy(x0) + 3.2, z], [x1, yy(x1) + 3.2, z], .1, '#c9a35a', 4); beam(span, [x0, yy(x0) - .1, z], [x1, yy(x1) - .1, z], .12, '#c9a35a', 4); }
    for (let i = 0; i <= 12; i++) { const x = -L / 2 + i * 2; cyl(span, .07, 3.2, '#c9a35a', x, yy(x), z, 4); }
  }
  beam(g, [-12.2, 8.8, -1.7], [-12, 8.2, -1.7], .1, '#c9a35a'); 
  addAnim(g, t => { span.rotation.x = .015 * Math.sin(t * 1.4); span.position.y = .1 * Math.sin(t * 1.8); });
  return g;
});

/* ───────── НАДГРОБИЯ ───────── */
def('grave_stone', 'Могила с плитой', 'grave', r => {
  const g = G('Grave'); sph(g, 3, '#6b5238', 0, .4, 1.8, 1, .35, 1.4, 8); box(g, [3.4, 3.2, .7], '#a9a39a', 0, 0, -1.2); const t = cylZ(g, 1.7, .7, '#a9a39a', 0, 3.2, -1.2, 12); t.scale.set(1, 1, 1);
  box(g, [.3, 1.8, .15], '#6e6a63', 0, 1.6, -.82).visible = true; box(g, [1.2, .3, .15], '#6e6a63', 0, 2.5, -.82);
  for (let i = 0; i < 3; i++) sph(g, .25, pick(r, ['#e8b923', '#d96a8a', '#efe6c8']), -1 + i, .85, 2.8, 1, 1, 1, 5); return g;
});
def('grave_cross', 'Деревянный крест', 'grave', r => {
  const g = G('Grave'); sph(g, 3, '#6b5238', 0, .4, 1.5, 1, .35, 1.5, 8); const c = G('Cross', g); c.rotation.z = (r() - .5) * .3; c.rotation.x = -.08;
  box(c, [.7, 6.5, .6], '#6b4527', 0, 0, -1); box(c, [3.6, .7, .6], '#6b4527', 0, 4, -1);
  const rag = cloth(c, 1.4, 1, null, .3, 5.2, -1, { color: '#a8412e', amp: .3, sx: 4, sy: 2 }); flagAnim(g, rag); return g;
});
def('grave_celtic', 'Каменный крест с кольцом', 'grave', r => {
  const g = G('Grave'); box(g, [4.6, .7, 4.6], '#8a847b', 0, 0, 0); box(g, [3.4, .7, 3.4], '#9b958c', 0, .7, 0); box(g, [1.2, 6.5, 1], '#a9a39a', 0, 1.4, 0); box(g, [4.6, 1.2, 1], '#a9a39a', 0, 4.8, 0);
  const ring = tor(g, 1.9, .3, '#a9a39a', 0, 5.4, 0, PI * 2, 5, 16); ring.scale.z = 1.4; for (let i = 0; i < 4; i++) box(g, [.3, .3, .2], '#6e6a63', 0, 2 + i * 1.2, .55);
  sph(g, 1.1, '#6ea848', 2, .9, 1.8, 1, .6, 1, 6); return g;
});

/* ───────── СТАТУИ ───────── */
function pedestal(p, w, h) { box(p, [w + 1.4, .8, w + 1.4], '#8a847b', 0, 0, 0); box(p, [w, h, w], '#a9a39a', 0, .8, 0); box(p, [w + .8, .6, w + .8], '#8a847b', 0, .8 + h, 0); return .8 + h + .6; }
def('statue_king', 'Статуя короля', 'statue', r => {
  const g = G('Statue'), s = '#b4aea4', y = pedestal(g, 4.4, 4);
  cyl(g, 2.1, 5, s, 0, y, 0, 9, 1.2); cyl(g, 1.3, 2.2, s, 0, y + 5, 0, 8, 1.6); sph(g, 1.1, s, 0, y + 8, 0, 1, 1.1, 1, 8);
  const cr = cyl(g, 1.1, .8, '#e8b923', 0, y + 8.8, 0, 8, 1.2); for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; cone(g, .25, .6, '#e8b923', Math.cos(a) * 1, y + 9.5, Math.sin(a) * 1, 4); }
  box(g, [3.6, 3.6, .5], '#a8412e', 0, y + 3, -1.4); cone(g, .8, 1.5, s, 0, y + 6.5, 1, 6).visible = false; 
  cyl(g, .2, 9, '#e8b923', 2.2, y + .5, .8, 5); sph(g, .55, '#e8b923', 2.2, y + 9.7, .8); beam(g, [1.5, y + 6.2, .6], [2.2, y + 5, .8], .45, s);
  beam(g, [-1.6, y + 6.4, .4], [-.7, y + 5, 1.2], .45, s); return g;
});
def('statue_samurai', 'Статуя самурая', 'statue', r => {
  const g = G('Statue'), s = '#a39d93', y = pedestal(g, 4, 3.2);
  for (const k of [-1, 1]) { cyl(g, .9, 4, s, k * 1.3, y, 0, 7, .7).rotation.z = k * -.12; box(g, [1.2, .4, 2.2], s, k * 1.7, y, .3); }
  cyl(g, 2.4, 2.6, s, 0, y + 3.4, 0, 8, 1.2); cyl(g, 1.4, 3, s, 0, y + 5.2, 0, 8, 1.7); for (const k of [-1, 1]) { box(g, [1.2, .3, 2], s, k * 2.4, y + 7.6, 0).rotation.z = k * -.4; beam(g, [k * 2, y + 7.3, 0], [k * .7, y + 5.2, 1.5], .45, s); }
  sph(g, 1, s, 0, y + 9, 0, 1, 1.05, 1, 8); const kb = cone(g, 1.9, 1.2, s, 0, y + 9.2, 0, 10); kb.scale.y = .6; sph(g, 1.25, s, 0, y + 9.5, 0, 1, .7, 1, 8);
  for (const k of [-1, 1]) beam(g, [k * .5, y + 10.4, 0], [k * 2, y + 12, 0], .14, '#d6b030');
  const sw = G('Sword', g); sw.position.set(0, y + 4.2, 1.8); cyl(sw, .12, 7.5, '#d8dde2', 0, -3, 0, 4); cyl(sw, .45, .2, '#e8b923', 0, 4.4 - 3, 0, 8); cyl(sw, .18, 2, '#4a3320', 0, 4.6 - 3 + 0, 0, 6); return g;
});
def('statue_lion', 'Статуя льва', 'statue', r => {
  const g = G('Statue'), s = '#b4aea4', y = pedestal(g, 5, 3.5);
  sph(g, 2.3, s, 0, y + 2.4, -1.6, 1, 1.05, 1.35, 10); sph(g, 2.1, s, 0, y + 3.6, .6, 1, 1.2, 1, 10);
  for (const k of [-1, 1]) { cyl(g, .65, 3.5, s, k * 1.0, y, 2.4, 7, .55); box(g, [1.1, .5, 1.6], s, k * 1.0, y, 3); sph(g, 1, s, k * 1.5, y + 1, -2.4, .6, 1, 1.4, 7); }
  const hd = G('Head', g); hd.position.set(0, y + 6.6, 1.3); sph(hd, 2.2, '#9d978d', 0, 0, -.2, 1, 1.05, .9, 10); sph(hd, 1.3, s, 0, -.2, .9, 1, .9, 1, 9); box(hd, [.8, .5, .8], s, 0, -1.2, 1.7).visible = false; sph(hd, .35, '#444', 0, .1, 2, 1, 1, 1, 5);
  for (const k of [-1, 1]) { sph(hd, .25, '#222', k * .55, .5, 1.6, 1, 1, 1, 5); sph(hd, .45, s, k * 1.3, 1.7, -.2, 1, 1, .6, 6); }
  tor(g, 2, .3, s, 2.4, y + 1.4, -3.8, PI * 1.2, 5, 10).visible = false; beam(g, [0, y + 1.2, -3.8], [1.4, y + .8, -5.6], .3, s); sph(g, .6, s, 1.4, y + .8, -5.6); return g;
});

/* ───────── ФЛЮГЕРЫ ───────── */
function vaneBase(g) {
  cyl(g, .5, .8, IRON, 0, 0, 0, 6); cyl(g, .22, 11, IRON, 0, .8, 0, 6, .16);
  const cr = G('Compass', g); cr.position.y = 8; for (const [n, a] of [['N', 0], ['E', PI / 2], ['S', PI], ['W', -PI / 2]]) { beam(cr, [0, 0, 0], [Math.sin(a) * 2.6, 0, -Math.cos(a) * 2.6], .1, IRON, 4); sph(cr, .32, n === 'N' ? '#b8262e' : IRON, Math.sin(a) * 2.7, 0, -Math.cos(a) * 2.7, 1, 1, 1, 6); }
  sph(g, .45, '#e8b923', 0, 12, 0);
}
function shapeMesh(pts, depth, c) { const sh = new T.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); const gg = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); gg.translate(0, 0, -depth / 2); return new T.Mesh(gg, mat(c)); }
def('vane_rooster', 'Флюгер-петух', 'vane', r => {
  const g = G('Weathervane'); vaneBase(g); const v = G('Vane', g); v.position.y = 12.4;
  beam(v, [-3, 0, 0], [3, 0, 0], .1, IRON, 4).visible = false; // стрелка-ось
  const rs = shapeMesh([[-1.4, 0], [-3.4, 2.8], [-2.8, 4], [-1.2, 3.4], [-.6, 2.8], [.8, 3.2], [1, 4.4], [1.6, 4.3], [1.4, 5.2], [2.2, 4.7], [2.7, 3.6], [1.6, 2.4], [2, 1.2], [.8, 0]], .35, '#2a2a30'); rs.rotation.y = PI / 2 * 0; rs.castShadow = true; v.add(rs);
  const pt = shapeMesh([[-6, .0], [-6, 1], [-8, .5]], .2, IRON); pt.visible = false; v.add(pt);
  beam(v, [-4, .3, 0], [3.4, .3, 0], .13, IRON, 4); const ar = shapeMesh([[3.4, -.5], [5, .3], [3.4, 1.1]], .25, IRON); v.add(ar); const ta = shapeMesh([[-4, .3], [-5.6, -.6], [-5.4, 1.2]], .25, IRON); v.add(ta);
  v.rotation.y = r() * 6; addAnim(g, t => { v.rotation.y = .9 * Math.sin(t * .8) + .35 * Math.sin(t * 2.3) + 1; }); return g;
});
def('vane_ship', 'Флюгер-кораблик', 'vane', r => {
  const g = G('Weathervane'); vaneBase(g); const v = G('Vane', g); v.position.y = 12.4;
  v.add(shapeMesh([[-2.8, 1.2], [2.8, 1.2], [1.8, -.4], [-1.8, -.4]], .5, '#2a2a30')); v.add(shapeMesh([[-.2, 1.2], [-.2, 5], [2.4, 1.4]], .15, '#b8262e')); v.add(shapeMesh([[-.6, 1.2], [-.6, 4.3], [-2.4, 1.4]], .15, '#e8b923'));
  beam(v, [-.3, 1, 0], [-.3, 5.2, 0], .1, IRON, 4); beam(v, [-5, .3, 0], [4.6, .3, 0], .1, IRON, 4); v.add(shapeMesh([[4.6, -.5], [6.2, .3], [4.6, 1.1]], .25, IRON)); v.add(shapeMesh([[-5, .3], [-6.6, -.7], [-6.6, 1.3]], .25, IRON));
  v.rotation.y = 1; addAnim(g, t => { v.rotation.y = .8 * Math.sin(t * .7 + 1) + .25 * Math.sin(t * 2.1) + .6; }); return g;
});
