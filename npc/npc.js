// Параметрический конструктор NPC: 15 видов, общий скелет, 4 клипа (idle / walk / talk / work).
// Использование: import {NPC_LIST, makeNPC} from './npc.js';  const n = makeNPC(NPC_LIST[0]); scene.add(n.root); n.update(dt);
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const HIPS_Y = 0.93;
const PI = Math.PI;

/* ───────────── материалы и примитивы ───────────── */
const _mc = new Map();
function mat(c, r = 0.82, m = 0, ds = false) {
  const k = c + '|' + r + '|' + m + '|' + ds;
  if (!_mc.has(k)) _mc.set(k, new THREE.MeshStandardMaterial({color: c, roughness: r, metalness: m, side: ds ? THREE.DoubleSide : THREE.FrontSide}));
  return _mc.get(k);
}
const G = {
  sph: (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h),
  cap: (r, l) => new THREE.CapsuleGeometry(r, l, 6, 16),
  cyl: (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s),
  box: (x, y, z, r = 0.01) => new RoundedBoxGeometry(x, y, z, 3, Math.min(r, x / 2.1, y / 2.1, z / 2.1)),
  cone: (r, h, s = 16) => new THREE.ConeGeometry(r, h, s),
  tor: (R, r, arc = PI * 2) => new THREE.TorusGeometry(R, r, 8, 28, arc),
  dome: (r, th = PI * 0.5) => new THREE.SphereGeometry(r, 24, 14, 0, PI * 2, 0, th),
};
function mk(parent, geo, material, pos, scale, rot) {
  const o = new THREE.Mesh(geo, material);
  o.castShadow = o.receiveShadow = true;
  if (pos) o.position.set(...pos);
  if (scale) o.scale.set(...scale);
  if (rot) o.rotation.set(...rot);
  parent.add(o);
  return o;
}
function grp(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent && parent.add(g);
  return g;
}
function stripeTex(a, b, n = 6) {
  const c = document.createElement('canvas'); c.width = 8; c.height = 64;
  const x = c.getContext('2d');
  const css = v => '#' + v.toString(16).padStart(6, '0');
  for (let i = 0; i < 8; i++) { x.fillStyle = css(i % 2 ? b : a); x.fillRect(0, i * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, n / 2); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ───────────── предметы в руках ─────────────
   Ось предмета — +y, хват в начале координат.
   follow  — предмет продолжает предплечье (остриё вперёд), upright — всегда висит/стоит вертикально. */
const WOOD = 0x7a5530, STEEL = 0xaab2bb, DARK = 0x3a3a42;
function stick(g, y0, y1, r = 0.018, c = WOOD) {
  return mk(g, G.cyl(r, r, y1 - y0, 10), mat(c, 0.9), [0, (y0 + y1) / 2, 0]);
}
const ITEMS = {
  rod() {
    const g = new THREE.Group(); g.userData.mode = 'follow';
    stick(g, -0.25, 1.45, 0.013, 0x8a6a3a);
    mk(g, G.cyl(0.02, 0.02, 0.12, 10), mat(0x2e2a26), [0, 0.0, 0]);
    const line = grp(g, 0, 1.45, 0); g.userData.hang = [line];
    mk(line, G.cyl(0.003, 0.003, 1.3, 4), mat(0xeeeeee), [0, -0.65, 0]);
    mk(line, G.sph(0.035), mat(0xd23a2a), [0, -1.3, 0]);
    return g;
  },
  hammer() {
    const g = new THREE.Group(); g.userData.mode = 'follow';
    stick(g, -0.1, 0.46, 0.022, 0x6a4a2a);
    mk(g, G.box(0.13, 0.12, 0.28, 0.02), mat(0x55585e, 0.4, 0.7), [0, 0.46, 0]);
    return g;
  },
  basket() {
    const g = new THREE.Group(); g.userData.mode = 'upright';
    mk(g, G.tor(0.12, 0.013, PI), mat(0xb08a4a), [0, -0.15, 0]);
    mk(g, G.cyl(0.17, 0.12, 0.2), mat(0xc29a55, 0.95), [0, -0.25, 0]);
    mk(g, G.tor(0.17, 0.01), mat(0x9a7436), [0, -0.15, 0], null, [PI / 2, 0, 0]);
    [[0, 0xd2402e], [1.7, 0xe0a030], [3.4, 0x6aa84a], [5, 0xd2402e]].forEach(([a, c], i) =>
      mk(g, G.sph(0.055), mat(c, 0.5), [Math.cos(a) * 0.07, -0.14 + (i % 2) * 0.02, Math.sin(a) * 0.07]));
    return g;
  },
  spear() {
    const g = new THREE.Group(); g.userData.mode = 'upright'; g.userData.tilt = 0.05;
    stick(g, -0.85, 1.5, 0.018);
    mk(g, G.cone(0.04, 0.22, 4), mat(STEEL, 0.35, 0.8), [0, 1.61, 0]);
    mk(g, G.box(0.12, 0.09, 0.01, 0.003), mat(0xb2302c), [0.07, 1.38, 0]);
    return g;
  },
  halberd() {
    const g = new THREE.Group(); g.userData.mode = 'upright'; g.userData.tilt = 0.04;
    stick(g, -0.85, 1.55, 0.02, 0x5e4126);
    mk(g, G.cone(0.025, 0.2, 4), mat(STEEL, 0.35, 0.8), [0, 1.65, 0]);
    mk(g, G.box(0.03, 0.2, 0.17, 0.008), mat(STEEL, 0.35, 0.8), [0, 1.48, 0.1]);
    mk(g, G.box(0.02, 0.1, 0.1, 0.005), mat(STEEL, 0.35, 0.8), [0, 1.5, -0.08]);
    return g;
  },
  naginata() {
    const g = new THREE.Group(); g.userData.mode = 'upright'; g.userData.tilt = 0.03;
    stick(g, -0.85, 1.35, 0.017, 0x2b2420);
    const bl = mk(g, G.box(0.016, 0.5, 0.06, 0.004), mat(0xcfd6dd, 0.2, 0.9), [0, 1.62, 0.01]); bl.rotation.x = -0.05;
    mk(g, G.cyl(0.026, 0.026, 0.05, 10), mat(0xc9a13a, 0.4, 0.6), [0, 1.37, 0]);
    mk(g, G.cyl(0.02, 0.02, 0.04, 10), mat(0xb2302c), [0, 1.2, 0]);
    return g;
  },
  cutlass() {
    const g = new THREE.Group(); g.userData.mode = 'follow';
    mk(g, G.cyl(0.018, 0.018, 0.12, 8), mat(0x2a2220), [0, 0, 0]);
    mk(g, G.sph(0.028), mat(0xc9a13a, 0.4, 0.6), [0, -0.07, 0]);
    mk(g, G.box(0.03, 0.02, 0.14, 0.006), mat(0xc9a13a, 0.4, 0.6), [0, 0.07, 0]);
    let y = 0.08, z = 0, a = 0;
    for (let i = 0; i < 7; i++) {
      a += 0.05; const l = 0.1;
      y += Math.cos(a) * l / 2; z += Math.sin(a) * l / 2;
      mk(g, G.box(0.012, l * 1.05, 0.045 - i * 0.003, 0.003), mat(0xd6dce2, 0.2, 0.9), [0, y, z], null, [a, 0, 0]);
      y += Math.cos(a) * l / 2; z += Math.sin(a) * l / 2;
    }
    return g;
  },
  katana() {
    const g = new THREE.Group(); g.userData.mode = 'follow';
    mk(g, G.cyl(0.017, 0.017, 0.24, 8), mat(0x1c1c22), [0, 0.0, 0]);
    mk(g, G.cyl(0.04, 0.04, 0.012, 14), mat(0xc9a13a, 0.4, 0.6), [0, 0.14, 0]);
    mk(g, G.box(0.01, 0.78, 0.034, 0.003), mat(0xdfe5ea, 0.2, 0.9), [0, 0.53, 0]);
    return g;
  },
  pitchfork() { // хват нижней рукой; верх рукояти сзади, зубья впереди
    const g = new THREE.Group(); g.userData.mode = 'follow';
    stick(g, -0.55, 0.8, 0.02, 0x8a6a3a);
    mk(g, G.box(0.26, 0.03, 0.03, 0.006), mat(0x555a60, 0.5, 0.6), [0, 0.82, 0]);
    [-0.1, 0, 0.1].forEach(x => mk(g, G.cyl(0.008, 0.012, 0.26, 6), mat(0x555a60, 0.5, 0.6), [x, 0.96, 0]));
    return g;
  },
  mug() {
    const g = new THREE.Group(); g.userData.mode = 'upright';
    mk(g, G.cyl(0.05, 0.045, 0.12), mat(0x8a6a3a, 0.7), [0, 0.05, 0]);
    mk(g, G.tor(0.035, 0.009, PI * 1.6), mat(0x8a6a3a), [0.07, 0.05, 0], null, [0, 0, -PI * 0.8]);
    mk(g, G.sph(0.05), mat(0xf6f1e4, 0.5), [0, 0.11, 0], [1, 0.55, 1]);
    return g;
  },
  rag() {
    const g = new THREE.Group(); g.userData.mode = 'upright';
    mk(g, G.box(0.12, 0.2, 0.02, 0.008), mat(0xe9e2cf, 0.95), [0, -0.08, 0]);
    return g;
  },
  staff() {
    const g = new THREE.Group(); g.userData.mode = 'upright';
    stick(g, -0.85, 0.95, 0.02, 0x6a4a2a);
    mk(g, G.tor(0.07, 0.012), mat(0xc9a13a, 0.35, 0.7), [0, 1.0, 0]);
    [0.5, 1.5, 2.5].forEach(a => mk(g, G.tor(0.025, 0.006), mat(0xc9a13a, 0.35, 0.7), [Math.cos(a) * 0.05, 1.0 + Math.sin(a) * 0.05 * 0, 0], null, [0, a, 0]));
    mk(g, G.sph(0.03), mat(0xc9a13a, 0.35, 0.7), [0, 1.08, 0]);
    return g;
  },
  ladle() {
    const g = new THREE.Group(); g.userData.mode = 'follow';
    stick(g, -0.12, 0.58, 0.017, 0x8a6a3a);
    mk(g, G.dome(0.07, PI * 0.5), mat(0x5a3e22, 0.9, 0, true), [0, 0.62, 0], null, [PI, 0, 0]);
    return g;
  },
  parasol() {
    const g = new THREE.Group(); g.userData.mode = 'upright'; g.userData.tilt = 0;
    stick(g, -0.3, 0.42, 0.012, 0xe9dcc0);
    mk(g, G.cone(0.4, 0.2, 24), mat(0xd8506a, 0.7, 0, true), [0, 0.5, 0]);
    mk(g, G.tor(0.39, 0.01), mat(0xf2e6c8), [0, 0.4, 0], null, [PI / 2, 0, 0]);
    mk(g, G.sph(0.022), mat(0xc9a13a, 0.4, 0.6), [0, 0.61, 0]);
    return g;
  },
  saw() {
    const g = new THREE.Group(); g.userData.mode = 'follow';
    mk(g, G.box(0.04, 0.1, 0.06, 0.012), mat(0x6a4a2a), [0, -0.02, 0]);
    mk(g, G.box(0.008, 0.6, 0.12, 0.002), mat(0xb9c0c7, 0.3, 0.8), [0, 0.35, 0.05]);
    for (let i = 0; i < 14; i++) mk(g, G.cone(0.012, 0.03, 3), mat(0xb9c0c7, 0.3, 0.8), [0, 0.1 + i * 0.037, 0.125]);
    return g;
  },
  mop() {
    const g = new THREE.Group(); g.userData.mode = 'follow';
    stick(g, -0.2, 1.15, 0.018, 0x8a6a3a);
    mk(g, G.cyl(0.04, 0.16, 0.26, 12), mat(0xcfc19a, 1), [0, 1.27, 0]);
    mk(g, G.cyl(0.045, 0.045, 0.03, 10), mat(0x555a60, 0.5, 0.6), [0, 1.15, 0]);
    return g;
  },
  ball() {
    const g = new THREE.Group(); g.userData.mode = 'follow';
    mk(g, G.sph(0.09), mat(0xd23a2a, 0.5), [0, -0.06, 0]);
    mk(g, G.tor(0.09, 0.008), mat(0xf4f0e0), [0, -0.06, 0]);
    return g;
  },
  bucket() {
    const g = new THREE.Group(); g.userData.mode = 'upright';
    mk(g, G.tor(0.11, 0.009, PI), mat(0x555a60, 0.5, 0.6), [0, -0.1, 0]);
    mk(g, G.cyl(0.13, 0.1, 0.22), mat(0x8a6a3a, 0.9), [0, -0.21, 0]);
    mk(g, G.tor(0.13, 0.008), mat(0x555a60, 0.5, 0.6), [0, -0.12, 0], null, [PI / 2, 0, 0]);
    [[-0.04, 0x6f9bb5], [0.05, 0xc9855a]].forEach(([x, c]) => {
      mk(g, G.cone(0.04, 0.1, 8), mat(c, 0.5), [x, -0.09, 0.02], null, [0.2, 0, x * 5]);
    });
    return g;
  },
  lantern() {
    const g = new THREE.Group(); g.userData.mode = 'upright';
    mk(g, G.tor(0.05, 0.006, PI), mat(DARK, 0.5, 0.6), [0, -0.04, 0]);
    mk(g, G.cyl(0.06, 0.06, 0.02), mat(DARK, 0.5, 0.6), [0, -0.07, 0]);
    const m = new THREE.MeshStandardMaterial({color: 0xffd36a, emissive: 0xffa630, emissiveIntensity: 1.2, roughness: 0.3});
    mk(g, G.cyl(0.05, 0.05, 0.13), m, [0, -0.15, 0]);
    mk(g, G.cyl(0.06, 0.06, 0.02), mat(DARK, 0.5, 0.6), [0, -0.23, 0]);
    return g;
  },
  book() { // книга в переплёте с белыми страницами (монах, знахарь): держат перед грудью
    const g = new THREE.Group(); g.userData.mode = 'upright';
    mk(g, G.box(0.16, 0.22, 0.03, 0.01), mat(0x6a3e1e, 0.9), [0, 0, 0]);
    mk(g, G.box(0.14, 0.2, 0.034, 0.004), mat(0xf4efe4, 0.95), [0, 0, 0.002]);
    return g;
  },
};

/* Как предмет несут в правой руке (тело: z вперёд, x влево; для левой руки x зеркалится) */
const CARRY = {
  rod: {g: [-0.3, 1.28, 0.05], d: [0.1, 0.55, -0.83]},       // на плече, удилище назад-вверх
  hammer: {g: [-0.28, 1.2, 0.1], d: [0, 0.95, -0.3]},        // на плече
  spear: {g: [-0.33, 0.9, 0.2], d: [0, 1, 0.1]},             // вертикально, у ноги
  halberd: {g: [-0.33, 0.9, 0.2], d: [0, 1, 0.1]},
  naginata: {g: [-0.33, 0.9, 0.2], d: [0, 1, 0.1]},
  staff: {g: [-0.33, 0.9, 0.2], d: [0, 1, 0.1]},
  pitchfork: {g: [-0.28, 1.15, 0.1], d: [0, 0.8, -0.6]},     // на плече зубьями вверх-назад
  saw: {g: [-0.3, 0.85, 0.12], d: [0, -1, 0.08]},            // висит вдоль ноги
  mop: {g: [-0.28, 1.2, 0.05], d: [0.05, 0.7, -0.7]},        // на плече
  cutlass: {g: [-0.32, 0.95, 0.15], d: [0, -0.8, 0.6]},      // остриём вниз-вперёд
  ladle: {g: [-0.3, 1.0, 0.3], d: [0, 0.9, 0.4]},
  ball: {g: [-0.3, 0.85, 0.2], d: [0, -1, 0]},
  katana: {g: [-0.32, 0.95, 0.15], d: [0, -0.8, 0.6]},
  basket: {g: [-0.32, 0.9, 0.25]}, bucket: {g: [-0.3, 0.85, 0.15]}, mug: {g: [-0.15, 1.1, 0.42]},
  rag: {g: [-0.3, 0.9, 0.2]}, lantern: {g: [-0.32, 0.9, 0.25]}, parasol: {g: [-0.34, 0.88, 0.18]},
  book: {g: [-0.12, 1.0, 0.38]},
};

/* ───────────── декорации-«станции» для рабочего клипа ───────────── */
const STATIONS = {
  anvil() {
    const g = new THREE.Group();
    mk(g, G.cyl(0.2, 0.23, 0.36, 14), mat(0x6b4a2b, 0.95), [0, 0.18, 0]);
    mk(g, G.box(0.46, 0.12, 0.2, 0.02), mat(0x4a4d55, 0.4, 0.8), [0, 0.42, 0]);
    mk(g, G.box(0.2, 0.08, 0.15, 0.02), mat(0x4a4d55, 0.4, 0.8), [0, 0.35, 0]);
    mk(g, G.cone(0.08, 0.26, 10), mat(0x4a4d55, 0.4, 0.8), [0.33, 0.42, 0], null, [0, 0, -PI / 2]);
    mk(g, G.sph(0.05), new THREE.MeshStandardMaterial({color: 0xff6a1a, emissive: 0xff4a10, emissiveIntensity: 1.4}), [-0.05, 0.5, 0], [1.4, 0.35, 1]);
    return g;
  },
  sawhorse() {
    const g = new THREE.Group();
    [-0.4, 0.4].forEach(x => [-1, 1].forEach(s => mk(g, G.box(0.06, 0.62, 0.06, 0.01), mat(0x8a6a3a), [x, 0.29, s * 0.1], null, [s * 0.3, 0, 0])));
    mk(g, G.box(1.1, 0.07, 0.07, 0.01), mat(0x8a6a3a), [0, 0.57, 0]);
    mk(g, G.box(1.2, 0.05, 0.26, 0.008), mat(0xd7b97e, 0.9), [0, 0.63, 0]);
    return g;
  },
  crate() {
    const g = new THREE.Group();
    mk(g, G.box(0.95, 0.5, 0.55, 0.02), mat(0x9a7440, 0.95), [0, 0.25, 0]);
    mk(g, G.box(0.99, 0.05, 0.59, 0.015), mat(0x7a5530, 0.95), [0, 0.5, 0]);
    [[-0.3, 0xd2402e], [-0.1, 0xe0a030], [0.1, 0x6aa84a], [0.3, 0xd2402e], [-0.2, 0xd2402e], [0.2, 0xe0a030]].forEach(([x, c], i) =>
      mk(g, G.sph(0.065), mat(c, 0.5), [x, 0.6, (i % 2 ? 0.08 : -0.08)]));
    return g;
  },
  barrel() {
    const g = new THREE.Group();
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.26 + Math.sin(t * PI) * 0.06, t * 0.8)); }
    mk(g, new THREE.LatheGeometry(pts, 20), mat(0x8a5a30, 0.9, 0, true));
    [0.12, 0.65].forEach(y => mk(g, G.tor(0.3, 0.012), mat(0x3a3a42, 0.5, 0.6), [0, y, 0], null, [PI / 2, 0, 0]));
    mk(g, G.cyl(0.26, 0.26, 0.02), mat(0xb5894f), [0, 0.8, 0]);
    mk(g, G.cyl(0.04, 0.04, 0.09), mat(0x8a6a3a), [0.12, 0.86, 0.05]);
    return g;
  },
  mound() {
    const g = new THREE.Group();
    mk(g, G.dome(0.6), mat(0x6b4a2e, 1), [0, 0, 0], [1, 0.28, 1]);
    for (let i = 0; i < 7; i++) { const a = i * 0.9; mk(g, G.cone(0.03, 0.14, 5), mat(0x5aa04a), [Math.cos(a) * 0.5, 0.05, Math.sin(a) * 0.5]); }
    return g;
  },
  chest() {
    const g = new THREE.Group();
    mk(g, G.box(0.8, 0.36, 0.46, 0.03), mat(0x7a4a24, 0.9), [0, 0.18, 0]);
    mk(g, G.box(0.8, 0.07, 0.46, 0.03), mat(0x6a3e1e, 0.9), [0, 0.4, 0]);
    [-0.25, 0.25].forEach(x => mk(g, G.box(0.05, 0.4, 0.49, 0.01), mat(0xc9a13a, 0.4, 0.6), [x, 0.2, 0]));
    for (let i = 0; i < 10; i++) mk(g, G.cyl(0.035, 0.035, 0.012, 10), mat(0xf2c240, 0.3, 0.8), [(Math.random() - 0.5) * 0.5, 0.42 + Math.random() * 0.04, (Math.random() - 0.5) * 0.28], null, [Math.random(), 0, Math.random()]);
    return g;
  },
  cauldron() {
    const g = new THREE.Group();
    mk(g, G.sph(0.4), mat(0x24262b, 0.5, 0.6), [0, 0.42, 0], [1, 0.85, 1]);
    mk(g, G.tor(0.34, 0.03), mat(0x24262b, 0.5, 0.6), [0, 0.67, 0], null, [PI / 2, 0, 0]);
    mk(g, G.cyl(0.33, 0.33, 0.01, 24), new THREE.MeshStandardMaterial({color: 0x6bd36a, emissive: 0x2ea04a, emissiveIntensity: 0.7, roughness: 0.3}), [0, 0.64, 0]);
    [0, 2.1, 4.2].forEach(a => mk(g, G.cyl(0.03, 0.035, 0.45), mat(0x5a3e22), [Math.cos(a) * 0.16, 0.08, Math.sin(a) * 0.16], null, [0, 0, PI / 2]).rotation.y = a);
    mk(g, G.cone(0.1, 0.25, 8), new THREE.MeshStandardMaterial({color: 0xff9a2a, emissive: 0xff6a10, emissiveIntensity: 1.3}), [0, 0.12, 0]);
    return g;
  },
  bucket() {
    const g = new THREE.Group();
    const b = grp(g, 0.7, 0, 0.2);
    mk(b, G.cyl(0.2, 0.15, 0.32), mat(0x8a6a3a, 0.9), [0, 0.16, 0]);
    mk(b, G.tor(0.2, 0.01), mat(0x555a60, 0.5, 0.6), [0, 0.24, 0], null, [PI / 2, 0, 0]);
    mk(b, G.cyl(0.19, 0.19, 0.01), mat(0x6fb3d6, 0.2), [0, 0.3, 0]);
    mk(g, G.box(1.5, 0.02, 1.0, 0.005), mat(0xc0a070, 1), [0, 0.012, 0.0]);
    return g;
  },
  water() {
    const g = new THREE.Group();
    mk(g, G.cyl(0.75, 0.75, 0.012, 32), new THREE.MeshStandardMaterial({color: 0x4f9cc8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85}), [0, 0.008, 0]);
    g.userData.ring = mk(g, G.tor(0.12, 0.008), mat(0xdff4ff, 0.2), [0, 0.02, 0], null, [PI / 2, 0, 0]);
    const bk = grp(g, 0.55, 0, -1.45);
    mk(bk, G.cyl(0.14, 0.11, 0.22), mat(0x8a6a3a, 0.9), [0, 0.11, 0]);
    mk(bk, G.cone(0.04, 0.1, 8), mat(0x6f9bb5, 0.5), [-0.03, 0.26, 0.02], null, [0.2, 0, 0.2]);
    return g;
  },
};

/* ───────────── головные уборы / причёски / бороды ───────────── */
function addHat(hc, type, c) {
  const m = x => mat(x, 0.85);
  switch (type) {
    case 'straw':
      mk(hc, G.cyl(0.34, 0.34, 0.02, 30), m(c), [0, 0.115, 0]);
      mk(hc, G.dome(0.19), m(c), [0, 0.105, 0], [1, 0.75, 1]);
      mk(hc, G.cyl(0.192, 0.192, 0.03, 24), mat(0x7a4a2a), [0, 0.13, 0]);
      break;
    case 'helmet': // портовый "котелок" с полями
      mk(hc, G.dome(0.19, PI * 0.42), mat(c, 0.4, 0.7), [0, 0.02, 0], null, [-0.12, 0, 0]);
      mk(hc, G.cyl(0.25, 0.25, 0.015, 30), mat(c, 0.4, 0.7), [0, 0.105, 0]);
      mk(hc, G.box(0.02, 0.09, 0.015), mat(c, 0.4, 0.7), [0, 0.04, 0.178]);
      break;
    case 'tricorn':
      mk(hc, G.cyl(0.15, 0.16, 0.1, 22), m(c), [0, 0.18, 0]);
      mk(hc, G.cyl(0.36, 0.36, 0.03, 3), m(c), [0, 0.125, 0], null, [-0.08, 0, 0]);
      mk(hc, G.cyl(0.365, 0.365, 0.012, 3), mat(0xc9a13a, 0.4, 0.6), [0, 0.108, 0], null, [-0.08, 0, 0]);
      mk(hc, G.sph(0.03), mat(0xd23a2a), [0.12, 0.15, 0.13]);
      break;
    case 'cap':
      mk(hc, G.dome(0.182, PI * 0.36), m(c), [0, 0.035, 0], [1, 0.85, 1], [-0.15, 0, 0]);
      mk(hc, G.box(0.18, 0.012, 0.07, 0.004), m(c), [0, 0.125, 0.15], null, [0.25, 0, 0]);
      break;
    case 'scarf': {
      const d = mk(hc, G.dome(0.188, PI * 0.42), m(c), [0, 0.0, -0.005], null, [-0.2, 0, 0]);
      mk(hc, G.cone(0.04, 0.12, 8), m(c), [0.06, -0.02, -0.2], null, [-1.9, 0, 0.6]);
      mk(hc, G.cone(0.04, 0.12, 8), m(c), [-0.04, -0.04, -0.2], null, [-2.1, 0, -0.5]);
      break;
    }
    case 'feather': {
      mk(hc, G.cyl(0.3, 0.3, 0.015, 30), m(c), [0, 0.095, 0], null, [0.05, 0, 0.1]);
      mk(hc, G.cyl(0.14, 0.16, 0.1, 22), m(c), [0, 0.15, 0]);
      mk(hc, G.cyl(0.162, 0.162, 0.02, 22), mat(0xc9a13a, 0.4, 0.6), [0, 0.125, 0]);
      for (let i = 0; i < 7; i++) {
        const t = i / 6; mk(hc, G.sph(0.045 - t * 0.012), m(0xf4efe4), [-0.15 - t * 0.12, 0.2 + Math.sin(t * 2.2) * 0.13, -0.02 - t * 0.12], [1.5, 0.7, 0.8]);
      }
      break;
    }
    case 'kabuto': { // самурайский шлем
      mk(hc, G.dome(0.195, PI * 0.43), mat(c, 0.35, 0.7), [0, 0.03, 0], null, [-0.1, 0, 0]);
      mk(hc, G.cyl(0.2, 0.3, 0.14, 24, 1), mat(c, 0.4, 0.6, true), [0, -0.0, -0.06], [1, 1, 0.9]);
      mk(hc, G.tor(0.2, 0.012, PI * 0.9), mat(0xc9a13a, 0.35, 0.7), [0, 0.17, 0.0], null, [0, 0, PI * 0.05]);
      mk(hc, G.box(0.02, 0.2, 0.012), mat(0xc9a13a, 0.35, 0.7), [0.07, 0.3, 0.1], null, [0, 0, -0.45]);
      mk(hc, G.box(0.02, 0.2, 0.012), mat(0xc9a13a, 0.35, 0.7), [-0.07, 0.3, 0.1], null, [0, 0, 0.45]);
      break;
    }
    case 'bandana': { // косынка: повязка на лбу и узел с концами сзади
      mk(hc, G.tor(0.15, 0.022), mat(c, 0.9), [0, 0.085, 0], null, [PI / 2, 0, 0]);
      mk(hc, G.sph(0.035), mat(c, 0.9), [0, 0.085, -0.16]);
      mk(hc, G.cone(0.03, 0.1, 6), mat(c, 0.9), [0.04, 0.05, -0.2], null, [0.3, 0.4, -0.9]);
      mk(hc, G.cone(0.03, 0.1, 6), mat(c, 0.9), [-0.02, 0.04, -0.21], null, [0.5, -0.3, 0.8]);
      break;
    }
    case 'beanie': // шапка-бини: облегающий купол, отворот и помпон
      mk(hc, G.dome(0.18, PI * 0.42), mat(c, 0.95), [0, 0.03, -0.005]);
      mk(hc, G.tor(0.172, 0.022), mat(c, 0.95), [0, 0.07, 0], null, [PI / 2, 0, 0]);
      mk(hc, G.sph(0.03), mat(0xf4efe4, 0.95), [0, 0.2, 0]);
      break;
    case 'hood': { // капюшон монаха: купол сверху и складки сзади, лицо открыто
      mk(hc, G.dome(0.19, PI * 0.36), mat(c, 0.9), [0, 0.03, -0.01], [1, 1, 1.05], [-0.25, 0, 0]);
      mk(hc, new THREE.CylinderGeometry(0.19, 0.2, 0.16, 24, 1, true, PI - 0.95, 1.9), mat(c, 0.9, 0, true), [0, -0.04, -0.02]);
      break;
    }
    case 'ninjahood': { // чёрный капюшон с прорезью для глаз
      mk(hc, G.sph(0.178, 24, 16), m(c), [0, 0.0, 0], [1.0, 1.1, 1.02]);
      mk(hc, G.cone(0.05, 0.22, 8), m(c), [0, -0.05, -0.2], null, [-2.0, 0, 0]);
      mk(hc, G.box(0.2, 0.045, 0.02, 0.01), mat(0xd9a67a, 0.7), [0, 0.03, 0.15]);
      break;
    }
  }
}
function addHair(hc, type, c) {
  const m = mat(c, 0.9);
  if (type === 'bald') return;
  const cap = (th = PI * 0.5) => mk(hc, G.dome(0.18, th), m, [0, 0.01, -0.01], [1.0, 1.0, 1.0], [-0.3, 0, 0]);
  switch (type) {
    case 'short': cap(PI * 0.47); break;
    case 'long': cap(PI * 0.5); mk(hc, G.cap(0.1, 0.25), m, [0, -0.12, -0.1], [1.15, 1, 0.75]); break;
    case 'bun': cap(); mk(hc, G.sph(0.075), m, [0, 0.19, -0.1]); break;
    case 'ponytail': cap(); mk(hc, G.cap(0.05, 0.18), m, [0, 0.0, -0.21], null, [0.6, 0, 0]); break;
    case 'topknot': cap(PI * 0.46); mk(hc, G.cap(0.04, 0.08), m, [0, 0.2, -0.04], null, [-0.2, 0, 0]); break;
    case 'curly': // кудри: купол из мелких шаров по черепу
      cap(PI * 0.5);
      [[0, 0.17, 0], [0.09, 0.15, 0.06], [-0.09, 0.15, 0.06], [0.12, 0.12, -0.07], [-0.12, 0.12, -0.07], [0, 0.13, -0.14],
        [0.16, 0.06, -0.02], [-0.16, 0.06, -0.02], [0.07, 0.1, 0.13], [-0.07, 0.1, 0.13]].forEach(p => mk(hc, G.sph(0.06, 12, 8), m, p));
      break;
    case 'wild': // растрёпанные вихры: короткие конусы, торчащие наружу
      cap(PI * 0.5);
      for (let i = 0; i < 7; i++) { const a = i / 7 * 2 * PI; mk(hc, G.cone(0.03, 0.13, 6), m, [Math.cos(a) * 0.1, 0.19, Math.sin(a) * 0.1], null, [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]); }
      break;
    case 'buzz': // короткая стрижка «ёжик»: тонкий купол
      mk(hc, G.dome(0.172, PI * 0.42), m, [0, 0.02, -0.005], null, [-0.3, 0, 0]);
      break;
    case 'braid': // одна коса за спиной, перетянутая лентой
      cap(PI * 0.47);
      mk(hc, G.cap(0.034, 0.3), m, [0, -0.13, -0.19], null, [0.12, 0, 0]);
      mk(hc, G.sph(0.03), mat(0xc9a13a, 0.4, 0.6), [0, 0, -0.2]);
      break;
  }
}
function addBeard(hc, type, c) {
  if (!type) return;
  const m = mat(c, 0.95);
  if (type === 'full' || type === 'braided' || type === 'white') {
    mk(hc, G.sph(0.11), m, [0, -0.1, 0.04], [1.05, 1.0, 0.92]);
    [-1, 1].forEach(s => mk(hc, G.sph(0.06), m, [s * 0.085, -0.05, 0.05], [0.9, 1, 0.9]));
  }
  if (type === 'braided') {
    mk(hc, G.cap(0.026, 0.12), m, [0, -0.25, 0.1], null, [0.12, 0, 0]);
    mk(hc, G.tor(0.03, 0.007), mat(0xc9a13a, 0.4, 0.6), [0, -0.2, 0.1], null, [PI / 2, 0, 0]);
  }
  if (type === 'mustache' || type === 'full' || type === 'braided' || type === 'white' || type === 'big')
    [-1, 1].forEach(s => mk(hc, G.cap(type === 'big' ? 0.026 : 0.018, type === 'big' ? 0.1 : 0.06), m, [s * (type === 'big' ? 0.055 : 0.04), -0.052, 0.152], null, [0, 0, s * (type === 'big' ? 1.2 : 1.35)]));
  if (type === 'goatee') mk(hc, G.sph(0.045), m, [0, -0.125, 0.125], [1, 1.4, 0.8]);
  if (type === 'stubble') mk(hc, G.sph(0.105, 16, 10), m, [0, -0.085, 0.05], [0.95, 0.5, 0.8]); // щетина: тень на челюсти
}

/* ───────────── сборка персонажа ───────────── */
export function makeNPC(def) {
  const s = Object.assign({fat: 1, height: 1, head: 1, skin: 0xd9a67a, hair: 'bald', hairColor: 0x3a2a1e, shirt: 0xcccccc, pants: 0x55493a,
    boots: null, brow: 0, hold: {}, work: 'idle'}, def);
  const root = new THREE.Group(); root.name = s.id;
  const body = grp(root); body.scale.setScalar(s.height);
  const skin = mat(s.skin, 0.7);
  let shirtM = mat(s.shirt, 0.85);
  if (s.stripes) shirtM = new THREE.MeshStandardMaterial({map: stripeTex(s.stripes[0], s.stripes[1]), roughness: 0.85});
  const pantsM = mat(s.pants, 0.9);
  const sleeveM = s.sleeve != null ? mat(s.sleeve, 0.85) : shirtM;
  const foreM = s.shortSleeve ? skin : sleeveM;
  const shinM = s.boots != null ? mat(s.boots, 0.7) : (s.rolled ? skin : pantsM);
  const footM = s.boots != null ? mat(s.boots, 0.7) : skin;
  const fat = s.fat, lf = 1 + (fat - 1) * 0.5, af = 1 + (fat - 1) * 0.6;
  const J = {};

  const hips = grp(body, 0, HIPS_Y, 0); J.hips = hips;
  mk(hips, G.sph(0.17), pantsM, null, [fat * 1.05, 0.8, 0.85]);
  const spine = grp(hips); J.spine = spine;
  mk(spine, G.cap(0.19, 0.2), shirtM, [0, 0.27, 0], [fat, 1, 0.75]);
  if (s.belly) mk(spine, G.sph(0.22), shirtM, [0, 0.14, 0.1], [1.1, 1, 0.85]);

  // ноги
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    const hp = grp(hips, sg * 0.1 * Math.min(fat, 1.25), -0.02, 0); J['hp' + side] = hp;
    mk(hp, G.cap(0.085 * lf, 0.26), pantsM, [0, -0.21, 0]);
    const kn = grp(hp, 0, -0.42, 0); J['kn' + side] = kn;
    mk(kn, G.sph(0.07 * lf), shinM === skin ? pantsM : pantsM);
    mk(kn, G.cap(0.066 * lf, 0.26), shinM, [0, -0.2, 0]);
    const an = grp(kn, 0, -0.41, 0); J['an' + side] = an;
    mk(an, G.box(0.11 * lf, 0.07, 0.24, 0.03), footM, [0, -0.032, 0.05]);
  }
  // руки
  const hands = {};
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    const sh = grp(spine, sg * (0.19 * fat + 0.055), 0.46, 0); J['sh' + side] = sh;
    mk(sh, G.sph(0.075 * af), sleeveM);
    mk(sh, G.cap(0.055 * af, 0.2), sleeveM, [0, -0.15, 0]);
    const el = grp(sh, 0, -0.3, 0); J['el' + side] = el;
    mk(el, G.sph(0.05 * af), foreM);
    mk(el, G.cap(0.048 * af, 0.18), foreM, [0, -0.14, 0]);
    if (s.bracers) mk(el, G.cyl(0.056 * af, 0.052 * af, 0.12, 14), mat(s.bracers, 0.5, 0.5), [0, -0.17, 0]);
    if (s.pauldron) { // самурайские пластины-осодэ
      for (let i = 0; i < 3; i++) mk(sh, G.box((0.2 + i * 0.015) * af, 0.045, 0.19, 0.012), mat(s.pauldron, 0.45, 0.55), [sg * 0.03, 0.04 - i * 0.04, 0], null, [0, 0, sg * (-0.25 + i * 0.05)]);
    }
    const hand = grp(el, 0, -0.29, 0); hands[side] = hand;
    mk(hand, G.sph(0.056), s.gloves ? mat(s.gloves, 0.8) : skin);
  }
  // шея и голова
  const neck = grp(spine, 0, 0.5, 0); J.neck = neck;
  mk(neck, G.cap(0.055, 0.05), skin, [0, 0.04, 0]);
  const head = grp(neck, 0, 0.07, 0); J.head = head; head.scale.setScalar(s.head);
  const hc = grp(head, 0, 0.14, 0);
  mk(hc, G.sph(0.165, 28, 20), skin, null, [1, 1.08, 1]);
  [-1, 1].forEach(sg => {
    mk(hc, G.sph(0.035), skin, [sg * 0.16, 0, 0], [0.6, 1, 1]);
    mk(hc, G.sph(0.03), mat(0xf6f3ec, 0.3), [sg * 0.06, 0.025, 0.132]);
    mk(hc, G.sph(0.017), mat(0x1c1a18, 0.2), [sg * 0.06, 0.025, 0.155]);
    const b = mk(hc, G.box(0.058, 0.014, 0.012, 0.004), mat(s.hairColor === 0 ? 0x222222 : (s.browColor ?? s.hairColor), 0.9), [sg * 0.062, 0.075, 0.148]);
    b.rotation.z = sg * s.brow;
    if (s.blush) mk(hc, G.sph(0.028), mat(0xe8837a, 0.9), [sg * 0.1, -0.04, 0.115], [1, 0.8, 0.5]);
  });
  mk(hc, G.sph(0.03), mat(s.skin, 0.7), [0, -0.02, 0.163], [1, 1, 1.0]);
  const mouth = mk(hc, G.box(0.06, 0.012, 0.01, 0.003), mat(0x6b2a2a, 0.6), [0, -0.075, 0.153]);
  if (s.eyepatch) {
    mk(hc, G.cyl(0.042, 0.042, 0.01, 16), mat(0x14141a), [-0.06, 0.025, 0.152], null, [PI / 2, 0, 0]);
    mk(hc, G.box(0.34, 0.012, 0.012, 0.004), mat(0x14141a), [0, 0.06, 0], null, [0, 0, 0.35]).scale.z = 0.01;
  }
  addHair(hc, s.hair, s.hairColor);
  addBeard(hc, s.beard, s.beardColor ?? s.hairColor);
  if (s.hat) addHat(hc, s.hat, s.hatColor);
  if (s.scar) mk(hc, G.box(0.012, 0.09, 0.008), mat(0xa85a4a), [0.06, 0.02, 0.158], null, [0, 0, 0.5]);
  // мелкие аксессуары головы и шеи
  if (s.glasses) { // круглые очки: два кольца перед глазами и перемычка
    const gm = mat(s.glasses, 0.4, 0.5);
    [-1, 1].forEach(sg => mk(hc, G.tor(0.04, 0.007), gm, [sg * 0.062, 0.025, 0.17]));
    mk(hc, G.box(0.04, 0.008, 0.008, 0.002), gm, [0, 0.03, 0.17]);
  }
  if (s.earring) mk(hc, G.tor(0.018, 0.005), mat(0xc9a13a, 0.35, 0.7), [0.165, -0.06, 0], null, [0, PI / 2, 0]);
  if (s.pencil) mk(hc, G.box(0.012, 0.012, 0.09, 0.003), mat(0xe8b43a, 0.6), [0.19, 0, 0.03]); // карандаш за ухом
  if (s.pipe) { // трубка в углу рта: чубук вперёд и чуть вниз, чашечка на конце
    const dir = PI / 2 + 0.3;
    mk(hc, G.cyl(0.008, 0.008, 0.1, 8), mat(0x7a5530, 0.8), [0, -0.09, 0.2], null, [dir, 0, 0]);
    mk(hc, G.sph(0.022, 12, 8), mat(0x4a2e1b, 0.8), [0, -0.105, 0.25], [1, 1.4, 1]);
  }
  if (s.neckerchief) mk(neck, G.cone(0.075, 0.12, 3), mat(s.neckerchief, 0.9, 0, true), [0, 0.02, 0.035], [1, 1, 0.5], [PI, 0, 0]); // платок на шее

  // одежда сверху
  if (s.dress) {
    const d = s.dress, len = d.len ?? 0.85;
    mk(hips, G.cyl(0.2 * fat, d.flare ?? 0.38, len, 28), mat(d.color, 0.85, 0, true), [0, 0.05 - len / 2, 0], [1, 1, 0.9]);
    if (d.hem) mk(hips, G.tor(d.flare ?? 0.38, 0.015), mat(d.hem, 0.8), [0, 0.05 - len, 0], [1, 0.9, 1], [PI / 2, 0, 0]);
  }
  if (s.vest) { // жилет поверх рубахи: открытый цилиндр спереди, без рукавов (как фартук, но выше)
    const r = 0.2 * fat + 0.012;
    mk(spine, new THREE.CylinderGeometry(r, r * 1.02, 0.4, 26, 1, true, -1.1, 2.2), mat(s.vest, 0.85, 0, true), [0, 0.27, 0], [1, 1, 0.8]);
  }
  if (s.bag) { // сумка-планшетка у правого бедра со стороны спины и ремень через грудь
    mk(spine, G.box(0.13, 0.19, 0.1, 0.02), mat(s.bag, 0.9), [-0.17, -0.04, -0.1], null, [0, 0, 0.1]);
    mk(spine, G.box(0.025, 0.62, 0.02, 0.006), mat(s.bag, 0.9), [0, 0.27, 0.2], null, [0, 0, -0.47]);
  }
  if (s.pouch) mk(spine, G.box(0.1, 0.1, 0.06, 0.015), mat(s.pouch, 0.9), [0.13, -0.03, 0.19]); // поясная сумка с левой стороны
  if (s.apron) {
    const a = s.apron, len = a.len ?? 0.6, r = a.r ?? (0.2 * fat + 0.015), top = a.top ?? 0.5;
    mk(spine, new THREE.CylinderGeometry(r, r * 1.04, len, 28, 1, true, -(a.arc ?? 1.9) / 2, a.arc ?? 1.9), mat(a.color, 0.9, 0, true),
      [0, top - len / 2, a.z ?? 0], [1, 1, a.sz ?? 0.8]);
  }
  if (s.tabard) {
    const t = s.tabard;
    mk(spine, G.box(0.26 * fat, 0.7, 0.025, 0.01), mat(t, 0.9), [0, 0.12, 0.17 * fat * 0.8 + 0.01]);
    mk(spine, G.box(0.26 * fat, 0.7, 0.025, 0.01), mat(t, 0.9), [0, 0.12, -0.15 * fat * 0.8 - 0.01]);
  }
  if (s.cuirass) { // нагрудник
    mk(spine, G.cap(0.2, 0.17), mat(s.cuirass, 0.4, 0.65), [0, 0.3, 0.005], [fat * 1.03, 1, 0.8]);
    if (s.cuirassTrim) mk(spine, G.box(0.04, 0.4, 0.01), mat(s.cuirassTrim, 0.4, 0.6), [0, 0.3, 0.19 * fat * 0.8 + 0.02]);
  }
  if (s.belt) {
    mk(spine, G.cyl(0.2 * fat + 0.005, 0.2 * fat + 0.005, 0.055, 22), mat(s.belt, 0.7), [0, 0.02, 0], [1, 1, 0.8]);
    mk(spine, G.box(0.06, 0.05, 0.02, 0.006), mat(0xc9a13a, 0.35, 0.7), [0, 0.02, 0.2 * fat * 0.8 + 0.01]);
  }
  if (s.sash) {
    mk(spine, G.cyl(0.2 * fat + 0.012, 0.2 * fat + 0.012, 0.1, 22), mat(s.sash, 0.9), [0, 0.04, 0], [1, 1, 0.82]);
  }
  if (s.shawl) {
    mk(spine, G.dome(0.27, PI * 0.5), mat(s.shawl, 0.95, 0, true), [0, 0.46, -0.01], [fat * 1.1, 0.7, 0.9]);
  }
  if (s.cape) mk(spine, G.box(0.42 * fat, 0.62, 0.03, 0.012), mat(s.cape, 0.9, 0, true), [0, 0.24, -0.17 * fat * 0.8], null, [0.12, 0, 0]);
  if (s.beads) {
    mk(spine, G.tor(0.14, 0.014), mat(s.beads, 0.5), [0, 0.5, 0.01], [1, 1, 1.05], [PI / 2 - 0.35, 0, 0]);
    mk(spine, G.sph(0.03), mat(s.beads, 0.5), [0, 0.28, 0.17]);
  }
  if (s.backSword) {
    const bs = grp(spine, 0, 0.3, -0.17 * fat * 0.8 - 0.02); bs.rotation.z = 0.7;
    mk(bs, G.cyl(0.02, 0.02, 0.75, 8), mat(0x15151a), [0, 0.1, 0]);
    mk(bs, G.cyl(0.018, 0.018, 0.22, 8), mat(0x15151a), [0, 0.6, 0]);
    mk(bs, G.cyl(0.04, 0.04, 0.012, 12), mat(0xc9a13a, 0.4, 0.6), [0, 0.5, 0]);
  }
  if (s.mask) { // повязка на нижней части лица для ниндзя без капюшона не используется
  }
  if (s.scabbard) {
    mk(hips, G.cyl(0.015, 0.015, 0.7, 8), mat(0x15151a), [0.2 * fat, -0.02, 0.05], null, [PI / 2 - 0.15, 0, 0]);
  }

  // предметы
  const hangs = [], items = {R: null, L: null};
  const attach = (side, name) => {
    if (!name) return;
    const item = ITEMS[name](); const wrap = grp(hands[side]);
    wrap.add(item);
    items[side] = {wrap, name, mode: item.userData.mode, tilt: item.userData.tilt || 0, dir: [0, 1, 0]};
    (item.userData.hang || []).forEach(h => hangs.push(h));
  };
  attach('R', s.itemR);
  attach('L', s.itemL);
  let extra = null;
  if (s.bounce) { extra = grp(body); mk(extra, G.sph(0.09), mat(0xd23a2a, 0.5)); mk(extra, G.tor(0.09, 0.008), mat(0xf4f0e0)); extra.visible = false; }

  // станция
  let station = null;
  if (s.station) { station = STATIONS[s.station](); station.scale.setScalar(s.height); station.position.set(0, 0, (s.stationZ ?? 0.85) * s.height); root.add(station); station.visible = false; }

  /* ───────────── позы ─────────────
     Руки с предметами и «рабочие» руки решаются 2-костной IK: цель задаётся в системе тела (м, z — вперёд, x — влево). */
  const KEYS = ['hips', 'spine', 'neck', 'head', 'hpL', 'hpR', 'knL', 'knR'];
  const ARMK = ['shL', 'shR', 'elL', 'elR'];
  const newPose = () => { const P = {bob: 0, mouth: 0, ballY: 0, H: {R: null, L: null}}; [...KEYS, ...ARMK].forEach(k => P[k] = [0, 0, 0]); return P; };
  const cur = newPose();
  const dressK = s.dress ? 0.55 : 1;
  const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const lift = ph => ph < 0.7 ? smooth(ph / 0.7) : 1 - Math.pow((ph - 0.7) / 0.3, 2);
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sc: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    nrm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  };
  const mirror = (v, side) => side === 'R' ? v : [-v[0], v[1], v[2]];
  const hand = (P, side, g, d) => { P.H[side] = {g: g.slice(), d: d ? V.nrm(d) : null}; };

  const base = P => {
    P.shR = [-0.05, 0, -0.12]; P.elR = [-0.1, 0, 0]; P.shL = [-0.05, 0, 0.12]; P.elL = [-0.1, 0, 0];
    for (const sd of ['R', 'L']) {
      const it = items[sd]; if (!it) continue;
      const c = CARRY[it.name]; hand(P, sd, mirror(c.g, sd), c.d ? mirror(c.d, sd) : null);
    }
    P.spine[0] = s.hunch || 0; P.neck[0] = -(s.hunch || 0) * 0.5;
    const st = s.stance ?? 0.04; P.hpL[2] = st; P.hpR[2] = -st;
  };

  const CLIPS = {
    idle(t, P) {
      const br = Math.sin(t * 1.8);
      P.spine[0] += 0.015 * br; P.shL[2] += 0.02 * br; P.shR[2] -= 0.02 * br;
      P.head[1] = 0.3 * Math.sin(t * 0.45); P.head[0] = 0.04 * Math.sin(t * 0.7);
      P.bob = 0.004 * br; P.hips[1] = 0.03 * Math.sin(t * 0.6);
      if (s.work === 'sentinel') { P.bob = -0.04; P.spine[0] += 0.1; }
    },
    walk(t, P) {
      const f = 2 * PI * 0.9 / Math.sqrt(s.height), ph = t * f, sn = Math.sin(ph);
      const A = 0.55 * dressK;
      P.hpR[0] = -A * sn; P.hpL[0] = A * sn;
      P.knR[0] = 0.8 * Math.max(0, Math.cos(ph)) * dressK; P.knL[0] = 0.8 * Math.max(0, -Math.cos(ph)) * dressK;
      for (const sd of ['R', 'L']) {
        const H = P.H[sd];
        if (H) H.g[2] += (sd === 'R' ? -1 : 1) * 0.07 * sn;
        else { // свободная рука машет
          const sgn = sd === 'R' ? 1 : -1;
          P['sh' + sd][0] += sgn * 0.45 * sn; P['el' + sd][0] -= 0.15 + 0.15 * Math.max(0, -sgn * sn);
        }
      }
      P.bob = 0.022 * Math.cos(2 * ph) - 0.01; P.spine[1] = 0.1 * sn; P.hips[1] = -0.12 * sn;
      P.spine[0] += 0.05; P.head[1] = -0.1 * sn;
      if (s.work === 'sentinel') { P.bob -= 0.12; P.spine[0] += 0.25; P.hpL[0] -= 0.35; P.hpR[0] -= 0.35; P.knL[0] += 0.7; P.knR[0] += 0.7; }
    },
    talk(t, P) {
      CLIPS.idle(t, P);
      const k = 0.5 + 0.5 * Math.sin(t * 2.3);
      P.mouth = Math.abs(Math.sin(t * 9)) * (0.4 + 0.6 * k);
      P.head[0] += 0.08 * Math.sin(t * 7) * k; P.head[1] = 0.25 * Math.sin(t * 1.1);
      const free = !s.itemR ? 'R' : !s.itemL ? 'L' : null;
      if (free) {
        const sg = free === 'R' ? -1 : 1, e = 0.5 + 0.5 * Math.sin(t * 2.2);
        P['sh' + free] = [-0.8 + 0.25 * Math.sin(t * 2.2), 0, sg * (0.3 + 0.15 * e)];
        P['el' + free] = [-1.0 + 0.35 * Math.sin(t * 3.1), 0, 0];
      }
    },
    work(t, P) { (WORK[s.work] || WORK.idle)(t, P); },
  };

  const WORK = {
    idle: (t, P) => CLIPS.idle(t, P),
    // кузнец: боёк молота опускается ровно на наковальню (0,.5,.55)
    swing(t, P) {
      const l = lift((t % 1.5) / 1.5);
      const Gs = [-0.1, 0.83, 0.09], Ds = [0, -0.45, 0.9], Gr = [-0.2, 1.55, 0.0], Dr = [0, 0.85, -0.5];
      hand(P, 'R', V.lerp(Gs, Gr, l), V.lerp(Ds, Dr, l));
      hand(P, 'L', [0.2, 0.55, 0.45]);
      P.spine[0] = lerp(0.38, 0.05, l); P.head[0] = lerp(0.25, 0.0, l); P.bob = -0.03 * (1 - l);
      P.hpL[2] = 0.14; P.hpR[2] = -0.14;
    },
    // плотник: пила идёт по доске на козлах (верх доски y=.66, z=.65)
    saw(t, P) {
      const o = Math.sin(t * 5), D = V.nrm([0, -0.55, 0.84]);
      const G = V.add(V.add([-0.1, 0.66, 0.65], V.sc(D, -0.35)), V.sc(D, 0.12 * o));
      hand(P, 'R', G, D); hand(P, 'L', [0.22, 0.95, 0.28]);
      P.spine[0] = 0.4; P.head[0] = 0.3; P.spine[1] = 0.05 * o; P.hpL[2] = 0.1; P.hpR[2] = -0.1;
    },
    // рыбак: удочка вперёд-вверх, леска ровно к воде; раз в 7 с подсечка
    fish(t, P) {
      const ph = (t % 7) / 7, fl = ph < 0.12 ? Math.sin(ph / 0.12 * PI) : 0;
      const p = 0.33 + 0.5 * fl + 0.02 * Math.sin(t * 1.3), D = [0, Math.sin(p), Math.cos(p)];
      const G = [-0.25, 1.1 + 0.1 * fl, 0.28];
      hand(P, 'R', G, D); hand(P, 'L', V.add(V.add(G, V.sc(D, -0.2)), [0.12, 0, 0]));
      P.spine[0] = -0.04 + fl * 0.1; P.head[0] = 0.1; P.head[1] = 0.15 * Math.sin(t * 0.4);
      P.hpL[2] = 0.1; P.hpR[2] = -0.1;
    },
    hawk(t, P) {
      const w = Math.sin(t * 6);
      hand(P, 'R', [-0.36 + 0.06 * w, 1.86, 0.06]);
      hand(P, 'L', [0.32, 0.96, 0.3 + 0.02 * w]);
      P.head[0] = -0.1; P.head[1] = 0.4 * Math.sin(t * 0.8); P.mouth = Math.abs(Math.sin(t * 8)) * (0.5 + 0.5 * Math.sin(t * 1.7));
      P.bob = 0.015 * Math.abs(w); P.spine[2] = 0.05 * Math.sin(t * 3);
    },
    stomp(t, P) { // портовый страж: оглядывается, поднимает фонарь
      const u = smooth(0.5 + 0.5 * Math.sin(t * 0.7));
      hand(P, 'L', [0.3 + 0.03 * u, 0.95 + 0.42 * u, 0.3 + 0.2 * u]);
      P.head[1] = 0.7 * Math.sin(t * 0.5); P.head[0] = 0.08; P.spine[0] = -0.03; P.hpL[2] = 0.08; P.hpR[2] = -0.08;
    },
    post(t, P) { // самурай: неподвижен, раз в 5 с бьёт древком оземь
      const ph = (t % 5) / 5, b = ph > 0.86 ? Math.sin((ph - 0.86) / 0.14 * PI) : 0;
      hand(P, 'R', [-0.33, 0.9 + 0.12 * b, 0.25]);
      hand(P, 'L', [0.31, 1.0, 0.04]);
      P.spine[0] = -0.05; P.head[1] = 0.25 * Math.sin(t * 0.3); P.head[0] = -0.03; P.hpL[2] = 0.1; P.hpR[2] = -0.1;
    },
    sentinel(t, P) { // ниндзя: присел, знак пальцами, быстро озирается
      const sc = Math.sin(t * 1.4), jerk = Math.sign(sc) * Math.pow(Math.abs(sc), 0.3);
      P.bob = -0.2; P.hpL = [-0.7, 0, 0.35]; P.hpR = [-0.7, 0, -0.35]; P.knL[0] = 1.4; P.knR[0] = 1.4;
      P.spine[0] = 0.45; P.neck[0] = -0.35; P.head[1] = 0.9 * jerk; P.spine[1] = 0.3 * jerk;
      const k = 0.5 + 0.5 * Math.sin(t * 2.5);
      P.shR = [-1.1, 0.0, -0.3 + 0.08 * k]; P.elR = [-1.9, 0, 0];
      P.shL = [-1.1, 0.0, 0.3 - 0.08 * k]; P.elL = [-1.9 + 0.2 * k, 0, 0];
    },
    // крестьянин: зубья вил входят в землю у кучи (z≈.85)
    dig(t, P) {
      const ph = (t % 2.4) / 2.4, push = ph < 0.35 ? smooth(ph / 0.35) : ph < 0.6 ? 1 : 1 - smooth((ph - 0.6) / 0.4);
      const G = V.lerp([-0.2, 1.1, 0.22], [-0.2, 0.92, 0.3], push), D = V.nrm(V.lerp([0, -0.3, 0.95], [0, -0.85, 0.5], push));
      hand(P, 'R', G, D); hand(P, 'L', V.add(V.add(G, V.sc(D, -0.42)), [0.05, 0, 0]));
      P.spine[0] = lerp(0.15, 0.45, push); P.head[0] = lerp(0.1, 0.3, push); P.bob = -0.03 * push;
      P.hpL[2] = 0.1; P.hpR[2] = -0.1;
    },
    pour(t, P) {
      const c = t * 4;
      hand(P, 'R', [-0.12 + 0.03 * Math.sin(c), 1.15, 0.45]);
      hand(P, 'L', [0.1 + 0.05 * Math.cos(c), 1.12 + 0.02 * Math.sin(c), 0.45]);
      P.spine[0] = 0.08; P.head[0] = 0.2; P.head[1] = 0.5 * Math.sin(t * 0.6); P.mouth = Math.max(0, Math.sin(t * 1.3)) * Math.abs(Math.sin(t * 7)) * 0.8;
    },
    cheer(t, P) {
      hand(P, 'R', [-0.34, 1.88, 0.05], [0.25 * Math.sin(t * 7), 1, 0.1]);
      hand(P, 'L', [0.34, 1.0, -0.02]);
      P.spine[0] = -0.12 + 0.06 * Math.sin(t * 3.5); P.head[0] = -0.2; P.head[1] = 0.3 * Math.sin(t * 1.2);
      P.mouth = 0.6 + 0.4 * Math.sin(t * 9); P.bob = 0.02 * Math.abs(Math.sin(t * 3.5)); P.hpL[2] = 0.15; P.hpR[2] = -0.15;
    },
    pray(t, P) {
      const b = (1 - Math.cos(t * 0.9)) / 2;
      hand(P, 'R', [-0.07, 1.18, 0.33]); hand(P, 'L', [0.07, 1.18, 0.33]);
      P.spine[0] = 0.35 * b; P.head[0] = 0.25 * b + 0.1;
    },
    bow(t, P) {
      const ph = (t % 6) / 6, b = ph < 0.2 ? smooth(ph / 0.2) : ph < 0.5 ? 1 : ph < 0.7 ? 1 - smooth((ph - 0.5) / 0.2) : 0;
      P.spine[0] = 0.45 * b; P.head[0] = 0.15 * b;
      hand(P, 'L', [lerp(0.3, 0.12, b), lerp(0.95, 1.15, b), lerp(0.1, 0.4, b)]);
      P.hpR[0] = 0.25 * b; P.knR[0] = 0.3 * b; P.bob = -0.04 * b;
      P.head[1] = (1 - b) * 0.3 * Math.sin(t * 0.8); P.mouth = (1 - b) * Math.max(0, Math.sin(t * 1.5)) * 0.4;
    },
    // мальчишка: ведёт мяч — рука идёт за мячом, мяч отскакивает от земли
    skip(t, P) {
      const w = t * 5.5, a = Math.abs(Math.sin(w));
      P.ballY = 0.09 + 0.72 * a;                 // мяч подпрыгивает до ладони
      hand(P, 'R', [-0.3, 0.83 + 0.1 * a, 0.3]); // рука (достаёт не ниже ~.8 м) идёт вниз-вверх вместе с мячом
      P.shL = [-0.3 * Math.sin(w), 0, 0.3]; P.elL = [-0.3, 0, 0];
      P.bob = -0.02 * (1 - a); P.head[0] = 0.15; P.head[1] = 0.3 * Math.sin(t * 1.2);
      P.hpL[2] = 0.08; P.hpR[2] = -0.08; P.mouth = 0.5 * a;
    },
    // знахарка: ложка уходит в котёл (z≈.7, поверхность y≈.63) и водит по кругу
    stir(t, P) {
      const c = t * 2.4, G = [-0.15, 1.0, 0.25];
      const tip = [0.12 * Math.cos(c), 0.63, 0.7 + 0.12 * Math.sin(c)];
      hand(P, 'R', G, V.sub(tip, G)); hand(P, 'L', [0.3, 0.95, 0.04]);
      P.spine[0] += 0.12; P.head[0] = 0.25; P.head[1] = 0.3 * Math.sin(t * 0.5);
      P.mouth = Math.max(0, Math.sin(t * 0.8)) * Math.abs(Math.sin(t * 9)) * 0.7;
    },
    // матрос: швабра волочится по палубе перед ним
    sweep(t, P) {
      const c = t * 2.2, sn = Math.sin(c);
      const hd = [0.42 * sn, 0.05, 0.85 + 0.05 * Math.cos(c)], G = [-0.12 + 0.1 * sn, 1.12, 0.25], D = V.nrm(V.sub(hd, G));
      hand(P, 'R', G, D); hand(P, 'L', V.add(G, V.sc(D, 0.32)));
      P.spine[0] = 0.25; P.spine[1] = 0.2 * sn; P.head[0] = 0.15; P.bob = -0.02 + 0.015 * Math.abs(sn);
      P.hpL[2] = 0.12; P.hpR[2] = -0.12;
    },
  };

  /* ───── 2-костная IK ───── */
  const Lu = 0.3, Lf = 0.29, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _d = new THREE.Vector3(), _u = new THREE.Vector3(), _n = new THREE.Vector3(),
    _f = new THREE.Vector3(), _p = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(),
    _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
  function solveArm(side, g, invM) {
    const sg = side === 'L' ? 1 : -1;
    _S.set(sg * (0.19 * fat + 0.055), 0.46, 0);
    _T.set(g[0], g[1], g[2]).applyMatrix4(invM);
    _d.subVectors(_T, _S);
    const D = clamp(_d.length(), 0.1, (Lu + Lf) * 0.998); _d.normalize();
    const bend = PI - Math.acos(clamp((Lu * Lu + Lf * Lf - D * D) / (2 * Lu * Lf), -1, 1));
    const al = Math.acos(clamp((Lu * Lu + D * D - Lf * Lf) / (2 * Lu * D), -1, 1));
    _p.set(sg * 0.6, -1, -0.3); _n.copy(_p).addScaledVector(_d, -_p.dot(_d));
    if (_n.lengthSq() < 1e-6) _n.set(0, 0, 1);
    _n.normalize();
    _u.copy(_d).multiplyScalar(Math.cos(al)).addScaledVector(_n, Math.sin(al));
    _f.copy(_d).multiplyScalar(D).addScaledVector(_u, -Lu).normalize();
    _y.copy(_u).negate();
    const sb = Math.sin(bend), cb = Math.cos(bend);
    if (sb > 1e-3) _z.copy(_f).addScaledVector(_u, -cb).divideScalar(sb);
    else _z.set(0, 0, 1).addScaledVector(_u, -_u.z);
    _z.normalize(); _x.crossVectors(_y, _z);
    _m.makeBasis(_x, _y, _z); _q.setFromRotationMatrix(_m); _e.setFromQuaternion(_q, 'XYZ');
    return {sh: [_e.x, _e.y, _e.z], el: [-bend, 0, 0]};
  }
  function toolQuat(d, out) { // ось +y предмета → d; плоская сторона клинка/бойка смотрит вбок (x)
    _y.set(d[0], d[1], d[2]).normalize();
    _x.set(1, 0, 0).addScaledVector(_y, -_y.x);
    if (_x.lengthSq() < 1e-4) _x.set(0, 0, 1);
    _x.normalize(); _z.crossVectors(_x, _y);
    _m.makeBasis(_x, _y, _z); out.setFromRotationMatrix(_m);
  }
  const upQ = new THREE.Quaternion(), pQ = new THREE.Quaternion(), tQ = new THREE.Quaternion();
  function keepUp(obj) { obj.parent.getWorldQuaternion(pQ); root.getWorldQuaternion(tQ); obj.quaternion.copy(pQ.invert().multiply(tQ)); }

  const npc = {
    def: s, root, station, clip: 'idle', t: Math.random() * 3, home: new THREE.Vector3(), joints: J, mouth,
    setClip(c) { this.clip = c; },
    update(dt) {
      dt = Math.min(dt, 0.05); this.t += dt;
      const P = newPose(); base(P); CLIPS[this.clip](this.t, P);
      const k = 1 - Math.exp(-dt * 14), kA = 1 - Math.exp(-dt * 28);
      for (const key of KEYS) {
        for (let i = 0; i < 3; i++) cur[key][i] += (P[key][i] - cur[key][i]) * k;
        J[key].rotation.set(cur[key][0], cur[key][1], cur[key][2]);
      }
      cur.bob += (P.bob - cur.bob) * k; cur.mouth += (P.mouth - cur.mouth) * Math.min(1, dt * 25);
      hips.position.y = HIPS_Y + cur.bob;
      J.anL.rotation.x = -(cur.hpL[0] + cur.knL[0]); J.anR.rotation.x = -(cur.hpR[0] + cur.knR[0]);
      mouth.scale.y = 1 + cur.mouth * 5; mouth.scale.x = 1 - cur.mouth * 0.25;
      root.updateMatrixWorld(true);
      const invM = new THREE.Matrix4().copy(body.matrixWorld).invert().multiply(spine.matrixWorld).invert();
      for (const sd of ['R', 'L']) {
        const H = P.H[sd];
        if (H) { const r = solveArm(sd, H.g, invM); P['sh' + sd] = r.sh; P['el' + sd] = r.el; }
        const kk = H ? kA : k;
        for (const key of ['sh' + sd, 'el' + sd]) {
          for (let i = 0; i < 3; i++) cur[key][i] += (P[key][i] - cur[key][i]) * kk;
          J[key].rotation.set(cur[key][0], cur[key][1], cur[key][2]);
        }
      }
      root.updateMatrixWorld(true);
      for (const sd of ['R', 'L']) {
        const it = items[sd]; if (!it) continue;
        it.wrap.visible = !(this.clip === 'work' && s.hideInWork && s.hideInWork[sd]);
        let d;
        if (it.mode === 'upright') d = [0, Math.cos(it.tilt), Math.sin(it.tilt)];
        else { const H = P.H[sd]; d = (H && H.d) || mirror(CARRY[it.name].d || [0, -1, 0], sd); }
        for (let i = 0; i < 3; i++) it.dir[i] += (d[i] - it.dir[i]) * kA;
        toolQuat(it.dir, _q2);
        root.getWorldQuaternion(_q3); _q2.premultiply(_q3);
        hands[sd].getWorldQuaternion(_q3);
        it.wrap.quaternion.copy(_q3.invert().multiply(_q2));
      }
      hangs.forEach(keepUp);
      if (extra) { extra.visible = this.clip === 'work'; extra.position.set(-0.3, P.ballY, 0.3); }
    },
  };
  return npc;
}

/* ───────────── каталог: 15 видов ───────────── */
export const NPC_LIST = [
  {id: 'fisher', name: 'Рыбак Тома', role: 'Рыбак', icon: '🎣', workLabel: 'Ловит рыбу',
    skin: 0xc99567, hair: 'short', hairColor: 0x4a4a4a, beard: 'mustache', hat: 'straw', hatColor: 0xd8bd6a,
    shirt: 0x4f7f95, pants: 0x8a7a5a, rolled: true, belt: 0x6b4a2b, vest: 0xd9a03a, bag: 0x6b4a2b, pipe: true, itemR: 'rod', itemL: 'bucket', work: 'fish', station: 'water', stationZ: 1.64, hideInWork: {L: true},
    brow: 0.1, hold: {R: [-0.9, -0.15, -1.0], L: [-0.2, 0.15, -0.3]}, height: 1.0},
  {id: 'smith', name: 'Кузнец Горо', role: 'Кузнец', icon: '🔨', workLabel: 'Кует железо',
    fat: 1.35, height: 1.05, skin: 0xb98258, hair: 'wild', beard: 'full', hairColor: 0x1d1a18, hat: 'bandana', hatColor: 0x5a2a20,
    shirt: 0x8a3b2a, shortSleeve: true, pants: 0x3a3028, boots: 0x2a211a, apron: {color: 0x6b4a2b, len: 0.78, top: 0.52}, belt: 0x2a211a,
    bracers: 0x4a3524, itemR: 'hammer', work: 'swing', station: 'anvil', stationZ: 0.55, brow: 0.3, stance: 0.12,
    hold: {R: [-0.4, -0.15, -0.8], L: [-0.1, 0.2, -0.3]}},
  {id: 'merchant', name: 'Торговка Мэй', role: 'Торговка', icon: '🧺', workLabel: 'Зазывает покупателей',
    fat: 0.9, height: 0.95, skin: 0xe0b48a, hair: 'long', hairColor: 0x2b1b14, hat: 'scarf', hatColor: 0xd9a441, blush: true, earring: true,
    shirt: 0xf0e4c8, sleeve: 0xf0e4c8, dress: {color: 0x9b3d5a, len: 0.86, flare: 0.36, hem: 0xd9a441}, apron: {color: 0xf1ead6, len: 0.5, top: 0.3, r: 0.18},
    itemL: 'basket', work: 'hawk', station: 'crate', stationZ: 0.7, brow: -0.1, hold: {L: [-0.3, 0.15, -1.35]}},
  {id: 'harbor_guard', name: 'Портовый страж', role: 'Страж порта', icon: '⚓', workLabel: 'Обходит с фонарём',
    fat: 1.1, skin: 0xd9a67a, hair: 'short', hairColor: 0x5b3b22, beard: 'mustache', hat: 'helmet', hatColor: 0x7d8691,
    shirt: 0x39556e, pants: 0x3b3b44, boots: 0x2a2420, cuirass: 0x6c7480, cape: 0x2d4358, belt: 0x2a2420, gloves: 0x5a4632, pouch: 0x2a2420,
    itemR: 'halberd', itemL: 'lantern', work: 'stomp', brow: 0.2, hold: {R: [-0.45, -0.1, -0.9], L: [-0.4, 0.25, -0.6]}},
  {id: 'samurai_guard', name: 'Самурай-страж', role: 'Охрана знати', icon: '🏯', workLabel: 'Несёт караул',
    fat: 1.15, height: 1.04, skin: 0xd2a07a, hair: 'topknot', hairColor: 0x15151a, hat: 'kabuto', hatColor: 0x7a1e22,
    shirt: 0x24242c, sleeve: 0x24242c, pants: 0x24242c, boots: 0x1c1c22, cuirass: 0x7a1e22, cuirassTrim: 0xc9a13a, pauldron: 0x7a1e22, bracers: 0x4a4d55,
    dress: {color: 0x7a1e22, len: 0.34, flare: 0.3, hem: 0xc9a13a}, sash: 0x2b2b33, itemR: 'naginata', work: 'post', brow: 0.35, stance: 0.1,
    hold: {R: [-0.45, -0.08, -0.85], L: [-0.05, 0.2, -0.15]}},
  {id: 'ninja_sentinel', name: 'Ниндзя-часовой', role: 'Тайный дозорный', icon: '🥷', workLabel: 'Прячется и следит',
    fat: 0.92, skin: 0xd2a07a, hair: 'bald', hat: 'ninjahood', hatColor: 0x17171d, shortSleeve: false,
    shirt: 0x1c1c24, sleeve: 0x1c1c24, pants: 0x1c1c24, boots: 0x111116, bracers: 0x3a3a46, sash: 0x7a1e22, backSword: true, brow: 0.3, hairColor: 0x15151a,
    work: 'sentinel', hold: {R: [-0.1, -0.12, -0.2], L: [-0.1, 0.12, -0.2]}},
  {id: 'farmer', name: 'Крестьянин Эрик', role: 'Фермер', icon: '🌾', workLabel: 'Копает грядку',
    skin: 0xd8a47c, hair: 'short', hairColor: 0xa5742f, hat: 'straw', hatColor: 0xdcc27a, shirt: 0xd8c9a0, pants: 0x4a6a8a, boots: 0x5a3e22,
    apron: {color: 0x4a6a8a, len: 0.34, top: 0.5, r: 0.2, arc: 1.4}, neckerchief: 0xc83a3a, pipe: true, itemR: 'pitchfork', work: 'dig', station: 'mound', stationZ: 0.85, brow: -0.05, blush: true,
    hold: {R: [-0.9, -0.1, -0.7], L: [-0.1, 0.15, -0.3]}},
  {id: 'innkeeper', name: 'Трактирщик Ганс', role: 'Трактирщик', icon: '🍺', workLabel: 'Протирает кружки',
    fat: 1.4, height: 0.95, head: 1.15, belly: true, skin: 0xe3b08a, hair: 'buzz', hairColor: 0xb0501f, beard: 'big', blush: true,
    shirt: 0xe9e2d0, pants: 0x5a4632, boots: 0x3a2a1a, apron: {color: 0xf3efe6, len: 0.9, top: 0.5, r: 0.31, z: 0.07, sz: 0.85, arc: 2.4},
    neckerchief: 0x8a1f1f, itemR: 'mug', itemL: 'rag', work: 'pour', station: 'barrel', stationZ: 0.68, brow: -0.15, hold: {R: [-0.9, -0.2, -1.2], L: [-0.7, 0.2, -1.2]}},
  {id: 'pirate', name: 'Пират Багор', role: 'Пират', icon: '🏴‍☠️', workLabel: 'Хвастается добычей',
    height: 1.03, skin: 0xc08a60, hair: 'long', hairColor: 0xa8431f, beard: 'braided', hat: 'tricorn', hatColor: 0x1f1f26, eyepatch: true, scar: true, earring: true,
    shirt: 0x7b1e1e, sleeve: 0x7b1e1e, pants: 0x2c2c34, boots: 0x15151a, belt: 0x3a2a1a, sash: 0xd8c9a0, vest: 0x2c2c34, itemR: 'cutlass', work: 'cheer',
    station: 'chest', stationZ: 0.95, brow: 0.3, stance: 0.12, hold: {R: [-0.2, -0.3, -0.6], L: [0, 0.4, -1.0]}},
  {id: 'monk', name: 'Монах Рэн', role: 'Монах', icon: '🙏', workLabel: 'Молится',
    skin: 0xd9b08a, hair: 'bald', hairColor: 0x2a2a2a, hat: 'hood', hatColor: 0x8a4e24, shirt: 0xa5622e, sleeve: 0xa5622e, dress: {color: 0xa5622e, len: 0.88, flare: 0.4, hem: 0x7a4620},
    sash: 0xe3d9bd, beads: 0x4a2e1b, itemL: 'book', itemR: 'staff', work: 'pray', hideInWork: {R: true}, brow: -0.1, hold: {R: [-0.35, -0.1, -0.7], L: [-0.1, 0.12, -0.2]}},
  {id: 'noble', name: 'Леди Изабелла', role: 'Знатная дама', icon: '👒', workLabel: 'Приветствует',
    fat: 0.88, height: 0.97, skin: 0xf0d0b0, hair: 'bun', hairColor: 0x8d3b1e, hat: 'feather', hatColor: 0x3b4f9a, blush: true,
    shirt: 0x3b4f9a, sleeve: 0xf4efe4, gloves: 0xf4efe4, dress: {color: 0x3b4f9a, len: 0.88, flare: 0.52, hem: 0xc9a13a}, belt: 0xc9a13a, itemR: 'parasol',
    work: 'bow', brow: -0.12, hold: {R: [-0.3, -0.25, -0.8], L: [-0.05, 0.15, -0.5]}},
  {id: 'carpenter', name: 'Плотник Лука', role: 'Плотник', icon: '🪚', workLabel: 'Пилит доску',
    skin: 0xcf9b6c, hair: 'short', hairColor: 0x5b3b22, beard: 'goatee', hat: 'cap', hatColor: 0x6b7a4f, shirt: 0xa9895a, pants: 0x59503f,
    boots: 0x3a2a1a, apron: {color: 0x7a5a38, len: 0.45, top: 0.5}, shortSleeve: true, glasses: 0x2a2a2a, pencil: true, itemR: 'saw', work: 'saw', station: 'sawhorse', stationZ: 0.65,
    brow: 0.1, hold: {R: [-0.5, -0.12, -0.9], L: [-0.1, 0.15, -0.3]}},
  {id: 'kid', name: 'Мальчишка Пип', role: 'Ребёнок', icon: '⚽', workLabel: 'Играет с мячом',
    height: 0.62, head: 1.35, fat: 0.85, skin: 0xe3b58c, hair: 'curly', hairColor: 0xc47a2c, shirt: 0x3f9e6a, bag: 0xb5593a, pants: 0x6a5a3a, shortSleeve: true,
    blush: true, rolled: true, itemR: 'ball', work: 'skip', hideInWork: {R: true}, bounce: true, brow: -0.05, hold: {R: [-0.5, -0.2, -0.9]}},
  {id: 'healer', name: 'Знахарка Юй', role: 'Знахарка', icon: '🧪', workLabel: 'Варит зелье',
    height: 0.9, hunch: 0.38, fat: 0.95, skin: 0xcaa27c, hair: 'braid', hairColor: 0xd9d9d9, hat: 'scarf', hatColor: 0x5c7a5a, glasses: 0x6b4a2b,
    shirt: 0x4c3b6a, sleeve: 0x4c3b6a, dress: {color: 0x4c3b6a, len: 0.86, flare: 0.4, hem: 0x8a6fb0}, shawl: 0x6c8a5e, itemR: 'ladle',
    work: 'stir', station: 'cauldron', stationZ: 0.7, brow: -0.3, hold: {R: [-0.6, -0.12, -0.8], L: [0, 0.3, -0.7]}},
  {id: 'sailor', name: 'Матрос Бо', role: 'Матрос', icon: '🧹', workLabel: 'Драит палубу',
    height: 1.0, skin: 0xb9764c, hair: 'buzz', hairColor: 0x222222, hat: 'bandana', hatColor: 0xc83a3a, beard: 'stubble', pouch: 0x6b4a2b,
    shirt: 0xe9e4d4, stripes: [0xe9e4d4, 0x2d3f6b], sleeve: 0xe9e4d4, shortSleeve: true, pants: 0xdfd6bf, rolled: true, belt: 0x6b4a2b, itemR: 'mop',
    work: 'sweep', station: 'bucket', stationZ: 0.85, brow: 0.1, hold: {R: [-0.6, -0.1, -0.8], L: [-0.2, 0.15, -0.3]}},
];
