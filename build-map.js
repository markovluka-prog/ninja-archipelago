// build-map.js — собирает всю 3D-карту архипелага одним вызовом buildMap().
//  • рельеф берётся из нарисованной карты (karta-data/underlay.js): суша/море/горы/леса/озёра по цветам пикселей;
//  • объекты, дороги, пирсы, стены, подписи — из karta-data/archipelag.js (PRESET_FN) + значки, нарисованные на подложке;
//  • все модели — из assets/{city,houses,plants,port,props,rocks}/models.js;
//  • лес, кусты, камни, ракушки расставляются автоматически по цветам карты.
// Мир: 1 пиксель карты = 1 ед.; карта 1600×1100 → x∈[-800,800], z∈[-550,550]. Персонаж ≈ 6.5 ед.

const W = 1600, H = 1100, CELL = 2, GW = W / CELL, GH = H / CELL;   // сетка высот: 800×550
const GROUPS = ['city', 'houses', 'plants', 'port', 'props', 'rocks'];

/* ───────────── утилиты ───────────── */
const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); }
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;
function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; }

function boxBlur(src, w, h, r, passes = 2) {           // быстрый разделяемый блюр
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {                       // по x
      let s = 0; const row = y * w;
      for (let x = -r; x <= r; x++) s += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { b[row + x] = s / (2 * r + 1); s += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < w; x++) {                       // по y
      let s = 0;
      for (let y = -r; y <= r; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * r + 1); s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]; }
    }
  }
  return a;
}
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('не загрузился ' + src)); document.head.appendChild(s); });
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/* ───────────── двери построек: берём настоящие двери моделей (папка assets) ───────────── */
const BUILD_RE = /^(hut|town|fish|pirate|jp_|farm|tavern|inn|church|fortress|citadel|warehouse|big_hall|manor|barn|pagoda|tower_round|tower_watch|lighthouse_a|windmill|barracks|smithy|townhall)/;
const ROUND = { tower_round: { R0: 12, R1: 11, H: 26, t: 0.8 }, lighthouse_a: { R0: 8.5, R1: 5.2, H: 40, t: 0.9, lantern: { R: 3.2, y0: 40.8, y1: 46.4 }, platform: { rI: 4.7, rO: 7.2, y: 40 } }, windmill: { R0: 9, R1: 7, H: 21, t: 0.6 } };      // круглые башни: стены — кольцо коробок по радиусу (а не квадратный габарит)
function findDoors(g) {                       // верхнеуровневые группы-двери (не меши, не люки/тайные стены)
  const out = [];
  g.traverse(o => { if (!o.isMesh && o.name && /door/i.test(o.name) && !/secret|hatch/i.test(o.name) && !out.some(d => { for (let q = o; q; q = q.parent) if (q === d) return true; return false; })) out.push(o); });
  return out;
}
const inGroups = (o, set) => { for (let q = o; q; q = q.parent) if (set.has(q)) return true; return false; };

/* ───────────── значки, нарисованные на подложке (их заменяем 3D-моделями) ───────────── */
// cl — радиус «затирания» значка на подложке
const ICONS = [
  ...[[802, 150], [720, 181], [955, 323], [1124, 505], [1104, 616], [1003, 708], [1088, 722], [956, 756], [674, 678], [676, 724]].map(([x, y]) => ({ t: 'hut', x, y, s: 0.8, cl: 12 })),
  ...[[741, 606], [852, 558], [990, 525], [990, 586], [925, 654], [828, 665], [962, 682], [770, 774]].map(([x, y]) => ({ t: 'tower', x, y, s: 0.8, cl: 13 })),
  { t: 'citadel', x: 800, y: 278, s: 0.9, cl: 16 },
  { t: 'lighthouse', x: 308, y: 521, s: 0.9, cl: 10 }, { t: 'lighthouse', x: 887, y: 685, s: 0.9, cl: 10 },
  { t: 'hut', x: 1243, y: 152, s: 0.7, cl: 10, region: 'ninja' }, { t: 'hut', x: 1257, y: 158, s: 0.7, cl: 10, region: 'ninja' },
  { t: 'pagoda', x: 1244, y: 178, s: 0.9, cl: 12 }, { t: 'flag_ninja', x: 1272, y: 182, s: 1, cl: 8 },
  { t: 'citadel', x: 368, y: 842, s: 0.7, cl: 14 }, { t: 'skull', x: 347, y: 838, s: 0.8, cl: 8 }, { t: 'x_mark', x: 361, y: 860, s: 1, cl: 10 }, { t: 'flag_pirate', x: 322, y: 797, s: 1, cl: 8 },
  { t: 'anchor_sign', x: 375, y: 432, s: 1, cl: 8 },
  ...[[381, 142], [381, 350], [392, 393], [400, 419], [179, 688], [1332, 423], [1287, 527], [1281, 644], [1226, 749], [1153, 863]].map(([x, y]) => ({ t: 'ship', x, y, s: 0.9, cl: 20, sea: true })),
];

/* ───────────── главная функция ───────────── */
export async function buildMap({ THREE, mergeGeometries, scene, base = './', onProgress = () => {}, seed = 2026, showLabels = false, scale = 2.5 }) {
  const say = (m, p) => onProgress(m, p);
  const R = mulberry(seed);
  const S = scale;            // во сколько раз раздвигаем карту: позиции ×S, размеры объектов прежние

  /* 1. данные карты */
  say('Читаю нарисованную карту…', 0.02);
  await loadScript(base + 'karta-data/underlay.js');
  await loadScript(base + 'karta-data/archipelag.js');
  const img = await loadImg(window.UNDERLAY);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);

  /* 1a. прогоняем пресет, записываем операции */
  const ops = { add: [], line: [], patch: [], lake: [], label: [] };
  const A = {
    rng: mulberry, inPoly,
    add: (t, x, y, s = 1) => ops.add.push({ t, x, y, s }),
    line: (k, pts, w = 1) => ops.line.push({ k, pts, w }),
    patch: pts => ops.patch.push(pts),
    lake: (cx, cy, rx, ry, rot = 0) => ops.lake.push({ cx, cy, rx, ry, rot }),
    label: (text, x, y, size = 12, bold = false, color = '#3b2f1e') => ops.label.push({ text, x, y, size, color }),
  };
  window.PRESET_FN(new Proxy(A, { get: (o, k) => k in o ? o[k] : (() => console.warn('A.' + String(k) + ' не поддержан')) }));

  /* 1b. подчищаем значки подложки */
  const GRASS = '#93b857';
  for (const p of ops.patch) { c.fillStyle = GRASS; c.beginPath(); p.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); c.fill(); }
  for (const ic of ICONS) {
    const sx = Math.min(W - 1, Math.max(0, ic.x + (ic.sea ? ic.cl + 6 : 0))), sy = Math.min(H - 1, ic.y + (ic.sea ? 0 : ic.cl + 8));
    const px = c.getImageData(sx, sy, 1, 1).data, wet = px[2] - px[0] >= 20;
    c.fillStyle = ic.sea || !wet ? `rgb(${px[0]},${px[1]},${px[2]})` : GRASS; c.beginPath(); c.arc(ic.x, ic.y, ic.cl, 0, 7); c.fill();
  }

  /* 1c. классификация пикселей (суша/море/горы/лес) */
  say('Строю рельеф…', 0.1);
  const px = c.getImageData(0, 0, W, H).data;
  const at = (x, y) => (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4;
  const isWater = i => px[i + 2] - px[i] >= 20;
  const water = new Uint8Array(GW * GH), rock = new Float32Array(GW * GH), dark = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = at(x * CELL, y * CELL), r = px[i], g = px[i + 1], b = px[i + 2], k = y * GW + x;
    if (isWater(i)) { water[k] = 1; continue; }
    if (Math.abs(r - g) < 22 && Math.abs(g - b) < 32 && r < 195 && r > 85) rock[k] = 1;
    else if (g < 150 && g > r + 5 && g >= b) dark[k] = 1;
  }
  // убираем с подложки «не-землю»: рамку, заголовок, компас, масштабную линейку, подписи и мелкие значки в море
  const FORCE_SEA = [[0, 0, W, 34], [0, H - 34, W, H], [0, 0, 34, H], [W - 34, 0, W, H], [670, 28, 930, 95], [1420, 895, 1560, 1070], [40, 1005, 330, 1072],
    [432, 474, 636, 516], [170, 718, 452, 762], [1436, 658, 1545, 706], [1325, 126, 1520, 166], [374, 266, 446, 308]];
  for (const [x0, y0, x1, y1] of FORCE_SEA) for (let y = Math.floor(y0 / CELL); y < Math.ceil(y1 / CELL); y++) for (let x = Math.floor(x0 / CELL); x < Math.ceil(x1 / CELL); x++) if (x >= 0 && y >= 0 && x < GW && y < GH) { const k = y * GW + x; water[k] = 1; rock[k] = 0; dark[k] = 0; }
  { // мелкие «острова» (корабли, буквы, волны) — это не земля
    const seen = new Uint8Array(GW * GH), st = [];
    for (let k0 = 0; k0 < GW * GH; k0++) {
      if (water[k0] || seen[k0]) continue;
      const comp = []; st.push(k0); seen[k0] = 1;
      while (st.length) { const k = st.pop(); comp.push(k); const x = k % GW, y = (k / GW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const n = ny * GW + nx; if (!water[n] && !seen[n]) { seen[n] = 1; st.push(n); } } }
      if (comp.length < 1700) for (const k of comp) { water[k] = 1; rock[k] = 0; dark[k] = 0; }
    }
  }
  // море = вода, связанная с краем карты; остальная вода — озёра и реки
  const sea = new Uint8Array(GW * GH), q = [];
  for (let x = 0; x < GW; x++) for (const y of [0, GH - 1]) { const k = y * GW + x; if (water[k] && !sea[k]) { sea[k] = 1; q.push(k); } }
  for (let y = 0; y < GH; y++) for (const x of [0, GW - 1]) { const k = y * GW + x; if (water[k] && !sea[k]) { sea[k] = 1; q.push(k); } }
  while (q.length) { const k = q.pop(), x = k % GW, y = (k / GW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const n = ny * GW + nx; if (water[n] && !sea[n]) { sea[n] = 1; q.push(n); } } }

  // озёра, реки, дороги из пресета → маски + рисуем на подложке
  const lakeM = new Float32Array(GW * GH), pathM = new Float32Array(GW * GH);
  const mk = () => { const m = document.createElement('canvas'); m.width = GW; m.height = GH; return m; };
  const lakeC = mk(), pathC = mk(), lc = lakeC.getContext('2d'), pc = pathC.getContext('2d');
  const stroke = (ctx, pts, w, col, sc) => { ctx.strokeStyle = col; ctx.lineWidth = w * sc; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0] * sc, p[1] * sc) : ctx.moveTo(p[0] * sc, p[1] * sc)); ctx.stroke(); };
  for (const l of ops.line) {
    if (l.k === 'river') { stroke(lc, l.pts, 5 * l.w, '#fff', 1 / CELL); stroke(c, l.pts, 5 * l.w, '#3f95c4', 1); }
    if (l.k === 'road') { stroke(pc, l.pts, 6 * l.w, '#fff', 1 / CELL); stroke(c, l.pts, 3.6 * l.w, '#a98558', 1); }
    if (l.k === 'street') { stroke(pc, l.pts, 6 * l.w, '#fff', 1 / CELL); stroke(c, l.pts, 4 * l.w, '#b9ab8c', 1); }
    if (l.k === 'route') { c.setLineDash([10, 9]); stroke(c, l.pts, 1.6, 'rgba(255,255,255,.55)', 1); c.setLineDash([]); }
  }
  for (const L of ops.lake) {
    for (const [ctx, sc, col] of [[lc, 1 / CELL, '#fff'], [c, 1, '#3f95c4']]) {
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, k = 1 + 0.09 * Math.sin(3 * a) + 0.05 * Math.sin(5 * a), x = Math.cos(a) * L.rx * k, y = Math.sin(a) * L.ry * k, cr = Math.cos(L.rot), sr = Math.sin(L.rot); const X = (L.cx + x * cr - y * sr) * sc, Y = (L.cy + x * sr + y * cr) * sc; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      ctx.fill();
    }
  }
  const lk = lc.getImageData(0, 0, GW, GH).data, pk = pc.getImageData(0, 0, GW, GH).data;
  for (let k = 0; k < GW * GH; k++) { lakeM[k] = lk[k * 4 + 3] > 100 ? 1 : 0; pathM[k] = pk[k * 4 + 3] > 100 ? 1 : 0; if (!sea[k] && water[k]) lakeM[k] = 1; }

  /* 2. поле высот */
  const land = new Float32Array(GW * GH); for (let k = 0; k < GW * GH; k++) land[k] = sea[k] ? 0 : 1;
  const lw = boxBlur(lakeM, GW, GH, 7, 3);
  const b1 = boxBlur(land, GW, GH, 5, 3), rb = boxBlur(rock, GW, GH, 6, 3), lb = boxBlur(lakeM, GW, GH, 1, 2), db = boxBlur(dark, GW, GH, 2, 2);
  const Hf = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const k = y * GW + x, b = b1[k], wx = x * CELL, wy = y * CELL;
    let h = b < 0.5 ? (b - 0.5) * 36 : (b - 0.5) * 9;
    const inl = sstep(0.52, 0.66, b);
    h += inl * (fbm(wx * 0.02, wy * 0.02) - 0.5) * 3.2;
    const m = Math.pow(Math.min(1, rb[k] * 1.25), 1.5) * inl;
    h += m * (26 + (fbm(wx * 0.035 + 7, wy * 0.035) - 0.2) * 22);
    if (lb[k] > 0.2 && h > -2.5) h = lerp(h, -2.6, sstep(0.2, 0.65, lb[k]));              // у берега и в узких реках — мелко
    if (lw[k] > 0.4) h = Math.min(h, lerp(h, -8, sstep(0.4, 0.95, lw[k])));                 // в широких озёрах к центру плавно глубже (без ямы у берега)
    Hf[k] = Math.max(h, -22);
  }

  /* 3. список объектов */
  say('Расставляю объекты…', 0.2);
  const region = (x, y) => (x < 470 && y < 640) ? 'king' : (x < 560 && y > 760) ? 'pirate' : (x > 1150 && y < 320) ? 'ninja' : (x > 1180 && y > 340) ? 'gulf' : (y > 600 && x > 1040 && x < 1140) ? 'fishers' : 'main';
  const objs = [];            // {id,x,y,s,rot?,kind}
  const rnd = R;
  const pick = a => a[Math.floor(rnd() * a.length) % a.length];
  const MAP = (t, x, y) => {
    const rg = region(x, y);
    switch (t) {
      case 'hut': return rg === 'pirate' ? pick(['pirate_a', 'pirate_b', 'pirate_c']) : rg === 'king' ? pick(['town_narrow', 'town_wide', 'town_shop', 'town_balcony', 'town_corner', 'town_mansard', 'hut_two_floor']) : rg === 'ninja' ? pick(['jp_house', 'jp_tea', 'jp_ninja']) : rg === 'fishers' ? pick(['fish_a', 'fish_c', 'hut_log', 'fish_a']) : pick(['hut_log', 'hut_thatch', 'hut_stone', 'hut_chimney']);
      case 'tavern': return rg === 'king' ? 'tavern' : pick(['tavern', 'inn']);
      case 'tower': return rg === 'king' ? 'tower_round' : 'tower_watch';
      case 'temple': return 'church_c';
      case 'church': return rg === 'king' ? 'church_b' : 'church_a';
      case 'fountain': return 'fountain_big';
      case 'market': return pick(['stall_veg', 'stall_fish', 'stall_weapon', 'stall_cloth', 'stall_fruit']);
      case 'castle': return 'fortress_big';
      case 'citadel': return 'citadel';
      case 'well': return pick(['well_a', 'well_b', 'well_c']);
      case 'warehouse': return pick(['warehouse_stone', 'warehouse_barn', 'warehouse_granary']);
      case 'crates': return pick(['crate_a', 'crate_b', 'crate_c', 'barrel_a', 'sack_b']);
      case 'crane': return 'crane_wood';
      case 'boat': return pick(['boat_row', 'boat_fishing', 'boat_sail_small', 'canoe_dugout']);
      case 'ship': return rg === 'pirate' ? 'pirate_ship' : rg === 'king' ? pick(['royal_ship', 'merchant_carrack']) : pick(['merchant_cog', 'merchant_carrack', 'fishing_sail_a', 'fishing_sail_b']);
      case 'windmill': return 'windmill';
      case 'farm': return pick(['farm_a', 'farm_b']);
      case 'pagoda': return pick(['pagoda_5', 'pagoda_3', 'jp_dojo']);
      case 'torii': return 'torii_red';
      case 'skull': return pick(['skull_pole', 'skull_big']);
      case 'cross': return 'grave_cross';
      case 'lighthouse': return pick(['lighthouse_a', 'lighthouse_b']);
      case 'anchor': return 'anchor_big';
      default: return t;      // id модели напрямую (flag_pirate, x_mark …)
    }
  };
  const VESSEL = new Set(['boat', 'ship']);
  for (const o of ops.add) { if (o.t === 'church' && Math.hypot(o.x - 1068, o.y - 425) < 6) continue; objs.push({ t: o.t, x: o.x, y: o.y, s: o.s }); }      // церковь в деревне у озера стояла на проходе — убрана
  for (const ic of ICONS) objs.push({ t: ic.t, x: ic.x, y: ic.y, s: ic.s });
  // корабли — пересчитаем, чтобы в море (подложка могла быть неточной)
  const streetPts = [];
  for (const l of ops.line) if (l.k === 'street' || l.k === 'road') for (let i = 0; i < l.pts.length - 1; i++) { const [a, b] = [l.pts[i], l.pts[i + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6)); for (let k = 0; k < n; k++) streetPts.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]); }
  const faceTarget = (x, y) => { let bd = 60 * 60, bp = null; for (const p of streetPts) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; bp = p; } } return bp; };

  /* 4. модели */
  say('Загружаю модели (assets)…', 0.25);
  const catalog = new Map();
  for (const g of GROUPS) {
    const mod = await import(new URL(`assets/${g}/models.js`, new URL(base, location.href)).href);
    for (const m of mod.MODELS) catalog.set(m.id, m);
  }
  const variantCache = new Map();    // 'id:seed' → {parts|null, bbox, size}
  function variant(id, seedV) {
    const key = id + ':' + seedV;
    if (variantCache.has(key)) return variantCache.get(key);
    let v = null;
    const m = catalog.get(id);
    if (m) {
      try {
        const g = m.make(THREE, seedV, { doorOpen: false });
        g.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(g), size = bb.getSize(new THREE.Vector3());
        let doorInfo = null, doorSet = null;
        if (BUILD_RE.test(id)) {
          const ds = findDoors(g), dset = new Set(ds), bodies = [];
          // «корпуса»: у составных моделей (ферма = дом + сарай) их несколько, у каждого своя дверь и свои стены
          g.traverse(o => { if (!o.isMesh && /^(Body|Walls)$/.test(o.name) && !inGroups(o, dset) && !bodies.some(b => inGroups(o, new Set([b.o])))) bodies.push({ o }); });
          if (!bodies.length) bodies.push({ o: g });
          const infos = [];
          for (const b of bodies) {
            const bbB = new THREE.Box3().setFromObject(b.o), cB = bbB.getCenter(new THREE.Vector3()), hB = bbB.getSize(new THREE.Vector3()).multiplyScalar(0.5);
            if (hB.x < 2 || hB.z < 2) continue;
            let best = null, bd = -1;
            for (const d of ds) {
              const bd_ = new THREE.Box3().setFromObject(d), c_ = bd_.getCenter(new THREE.Vector3());
              if (Math.abs(c_.x - cB.x) > hB.x + 1.5 || Math.abs(c_.z - cB.z) > hB.z + 1.5 || bd_.max.y - bd_.min.y < 4) continue;
              const dist = Math.hypot(c_.x - cB.x, c_.z - cB.z); if (dist > bd) { bd = dist; best = { bb: bd_, c: c_ }; }
            }
            const info = { cx: cB.x, cz: cB.z, hx: hB.x, hz: hB.z, topY: bbB.max.y, hasDoor: false };
            if (best) {
              const dx = best.c.x - cB.x, dz = best.c.z - cB.z, alongZ = Math.abs(dz) / Math.max(hB.z, 1) >= Math.abs(dx) / Math.max(hB.x, 1), sz = best.bb.getSize(new THREE.Vector3());
              Object.assign(info, { hasDoor: true, n: alongZ ? [0, Math.sign(dz) || 1] : [Math.sign(dx) || 1, 0], off: alongZ ? best.c.x : best.c.z, w: alongZ ? sz.x : sz.z, h: sz.y, y0: best.bb.min.y });
            }
            infos.push(info);
          }
          // лестницы (ступени), плита второго этажа (с проёмом под лестницу) и верхний этаж: берём их настоящую геометрию из модели — коллизия строится по ней
          const steps = [], floors = [], tiers = [], ladderBBs = [], windowBBs = [], silos = []; let upper = null;
          const underLadder = m => { for (let q = m; q; q = q.parent) if (q.name === 'Ladder') return true; return false; };
          g.traverse(o => {
            if (o.isMesh || !o.name) return;
            if (/^Tier\d+$/.test(o.name)) { tiers.push(new THREE.Box3().setFromObject(o)); return; }        // верхние ярусы пагоды: полые комнаты
            if (o.name === 'Loft') { o.traverse(m => { if (m.isMesh && !underLadder(m)) floors.push(new THREE.Box3().setFromObject(m)); }); return; }      // антресоль (пол и опоры) — твёрдая
            if (o.name === 'Ladder') { const lb = new THREE.Box3().setFromObject(o); lb.nrm = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld); ladderBBs.push(lb); return; }      // nrm — сторона, с которой лезут (локальный +z лестницы)
            if (o.name === 'Window' || (/door/i.test(o.name) && !/secret|hatch/i.test(o.name))) { windowBBs.push(new THREE.Box3().setFromObject(o)); return; }      // окна и вторые двери (балконные) — проёмы в стенах
            if (o.name === 'Stairs') o.traverse(m => { if (m.isMesh) steps.push(new THREE.Box3().setFromObject(m)); });
            else if (/^(Floor2|TowerFloor2)$/.test(o.name)) o.traverse(m => { if (m.isMesh) floors.push(new THREE.Box3().setFromObject(m)); });
            else if (o.name === 'Upper' && !upper) upper = new THREE.Box3().setFromObject(o);
            else if (/^Silo$/.test(o.name)) silos.push(new THREE.Box3().setFromObject(o));
          });
          if (ROUND[id]) { infos.length = 0; const r_ = ROUND[id]; let best_ = null, bd_ = -1; for (const d of ds) { const bb_ = new THREE.Box3().setFromObject(d), c_ = bb_.getCenter(new THREE.Vector3()), dist = Math.hypot(c_.x, c_.z); if (dist > bd_ && bb_.max.y - bb_.min.y > 4) { bd_ = dist; best_ = bb_; } }
            if (best_) { const c_ = best_.getCenter(new THREE.Vector3()), sz_ = best_.getSize(new THREE.Vector3()), alongZ = Math.abs(c_.z) >= Math.abs(c_.x); infos.push({ cx: 0, cz: 0, hx: r_.R0, hz: r_.R0, topY: r_.H, hasDoor: true, n: alongZ ? [0, Math.sign(c_.z) || 1] : [Math.sign(c_.x) || 1, 0], off: alongZ ? c_.x : c_.z, w: alongZ ? sz_.x : sz_.z, h: sz_.y, y0: Math.max(best_.min.y, 0.4), round: r_ }); } }
          if (ROUND[id] && ROUND[id].platform) floors.length = 0;      // кольцо площадки — повёрнутые плиты: их общие габариты закрывали проём лестницы; площадка строится по радиусам (house-collision)
          const first = infos.find(q => q.hasDoor);
          if (first && (steps.length || floors.length || tiers.length || ladderBBs.length || windowBBs.length || silos.length)) {
            const ladders = ladderBBs.map(bb => {        // настоящая лестница-стремянка модели → лестница шаблона игры (нормаль — в сторону комнаты, верх — по полу этажа/антресоли)
              const cen = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), thinZ = sz.z < sz.x;
              let n = thinZ ? [0, Math.sign(first.cz - cen.z) || 1] : [Math.sign(first.cx - cen.x) || 1, 0];
              if (bb.nrm && Math.hypot(bb.nrm.x, bb.nrm.z) > 0.5) n = Math.abs(bb.nrm.x) > Math.abs(bb.nrm.z) ? [Math.sign(bb.nrm.x), 0] : [0, Math.sign(bb.nrm.z)];      // как стоит сама лестница (раньше — «к центру дома»: в башне особняка выход вёл над проёмом, пола за лестницей не было)
              let top = bb.max.y - 0.6; for (const f of floors) if (f.max.y <= bb.max.y + 0.2 && f.max.y >= bb.max.y - 2.5) top = Math.max(top, f.max.y);
              return { cx: cen.x, cz: cen.z, n, hw: (thinZ ? sz.x : sz.z) / 2, bottom: bb.min.y, top };
            });
            first.extra = { steps, floors, upper, tiers, ladders, windows: windowBBs, silos };
          }
          const outer = [];          // внешняя ограда (группа Outer): звенья стен и столбы/башни — твёрдые боксы (раньше коллизии у ограды не было, сквозь неё проходили)
          g.traverse(o => {
            if (o.isMesh || o.name !== 'Outer') return;
            for (const ch of o.children) {
              if (!ch.isMesh && ch.name === 'W') outer.push(new THREE.Box3().setFromObject(ch));
              else if (ch.isMesh && ch.geometry.type === 'CylinderGeometry') { const bb_ = new THREE.Box3().setFromObject(ch), c_ = bb_.getCenter(new THREE.Vector3()), h_ = bb_.getSize(new THREE.Vector3()).multiplyScalar(0.4); outer.push(new THREE.Box3(new THREE.Vector3(c_.x - h_.x, bb_.min.y, c_.z - h_.z), new THREE.Vector3(c_.x + h_.x, bb_.max.y, c_.z + h_.z))); }
            }
          });
          g.traverse(o => { if (!o.isMesh && o.name === 'Solid') outer.push(new THREE.Box3().setFromObject(o)); });
          g.traverse(o => { if (o.userData && o.userData.solid) { const b_ = new THREE.Box3().setFromObject(o), sz_ = b_.getSize(new THREE.Vector3()); if (sz_.y >= 0.6 && sz_.x < 30 && sz_.z < 30) { b_.min.x += 0.12; b_.min.z += 0.12; b_.max.x -= 0.12; b_.max.z -= 0.12; outer.push(b_); } } });      // мебель (userData.solid): стол, кровать, сундук, бочка, ящик… — твёрдая (чуть уже габарита, чтобы не цепляться)      // мебель и ящики замка: тоже твёрдые
          if (infos.some(q => q.hasDoor)) { doorInfo = { bodies: infos, outer }; doorSet = dset; }
        }
        let deckTop = null; if (/^pier|^dock/.test(id)) g.traverse(o => { if (o.name === 'Deck') { const t = new THREE.Box3().setFromObject(o).max.y; deckTop = Math.max(deckTop ?? 0, t); } });
        if (deckTop === null && /^(pier|dock)/.test(id)) g.traverse(o => {      // у причалов без группы «Deck» (например, каменный) настил — самый высокий плоский широкий бокс
          if (o.isMesh && o.geometry.type === 'BoxGeometry') { const b_ = new THREE.Box3().setFromObject(o), sz = b_.getSize(new THREE.Vector3()); if (sz.x > 3 && sz.z > 3 && sz.y < 1.5) deckTop = Math.max(deckTop ?? 0, b_.max.y); }
        });
        let hull = null, deckY = null; if (/ship|carrack|cog|fishing_sail|boat|galleon/.test(id)) g.traverse(o => { if (!hull && o.isMesh && o.name === 'Hull') hull = new THREE.Box3().setFromObject(o); if (deckY === null && o.isMesh && o.name === 'Deck') deckY = new THREE.Box3().setFromObject(o).max.y; });
        const parts = []; let ok = !(g.userData.animate && /^(windmill|watermill|fountain|flag|torch|campfire|lighthouse|crane|vane|lamp|lantern|waterlily)/.test(id));
        g.traverse(o => {
          let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
          if (!vis) return;
          if (o.isMesh && doorSet && inGroups(o, doorSet)) return;       // дверь — отдельным объектом (открывается по E)
          if (o.isMesh && !o.isSkinnedMesh) parts.push({ g: o.geometry, m: o.material, mat: o.matrixWorld.clone(), cast: o.castShadow, recv: o.receiveShadow });
          else if (o.isLine || o.isPoints || o.isSprite || o.isSkinnedMesh) ok = false;
        });
        if (hull && hull.getSize(new THREE.Vector3()).length() > 14) ok = false;      // большие корабли — отдельные объекты, не инстансы: ими можно управлять
        v = { id, seedV, parts: ok && parts.length ? parts : null, bb, size, proto: g, hull, deckY, deckTop, door: doorInfo };
      } catch (e) { console.warn('модель', id, 'не собралась:', e.message); }
    } else console.warn('нет модели', id);
    variantCache.set(key, v); return v;
  }
  /* 4a. масштаб под человека: целевая высота модели в ед. (Ричард ≈ 9, NPC ≈ 7); коэффициент = target / реальная высота, в пределах 0.3…4.
     Первая подходящая строка побеждает. Лодки/корабли — по длине (SCALE_LEN). Неподходящие id — без изменений. */
  const SCALE_H = [
    [/^(hut_two_floor|town_mansard|town_balcony|manor|big_hall)/, 26],          // двухэтажные
    [/^(hut|town|fish|pirate|jp_|farm|tavern|inn)/, 21],                        // жилые дома (дверь ≥ 11 — выше человека)
    [/^church_b/, 50], [/^church_a/, 44], [/^church_c/, 46],
    [/^tower_round/, 75], [/^tower_watch/, 60], [/^tower/, 65],
    [/^lighthouse/, 80], [/^pagoda/, 50], [/^citadel/, 90], [/^fortress/, 80],
    [/^warehouse/, 18],                                                         // склады 16–20
    [/^windmill/, 30],
    [/^well/, 12],                                                              // колодцы (было 7 — выходили ниже пояса игрока 9)
    [/^(stall_|market)/, 15],                                                   // лавки/прилавки (было 9 — слишком маленькие)
    [/^(crate_|barrel_|sack_)/, 3.5],                                           // ящики/бочки 3–4
    [/^palm/, 35], [/^fir/, 42], [/^(oak|birch|willow)/, 30],                   // пальмы 30–40, ели 35–50, лиственные 25–45
    [/^(bush|fern)/, 6.5],                                                      // кусты 5–8
    [/^grass_low/, 1.5], [/^(grass_tall|grass_wheat)/, 3], [/^(grass_flowers|flowerbed)/, 2.5],
    [/^rock_medium/, 5], [/^rock_large/, 11], [/^(rock_sharp|rock_mossy)/, 6]   // камни: medium 4–6, large 8–14
  ];
  const SCALE_LEN = [                                                           // длина (наибольший горизонтальный размер)
    [/^boat_row/, 46], [/^boat_fishing/, 54], [/^boat_sail/, 62], [/^canoe_/, 40], [/^richard_boat|^raft/, 54],
    [/^royal_ship/, 110], [/^merchant_carrack/, 90], [/^pirate_ship/, 80], [/^merchant_cog/, 70], [/^fishing_sail/, 60]
  ];
  const fitK = (id, v, isV) => {
    const HOUSE_K = !isV && BUILD_RE.test(id) ? 1.5 : 1;            // все дома крупнее в 1.5 раза
    const row = (isV ? SCALE_LEN : SCALE_H).find(([re]) => re.test(id));
    if (!row || !v) return HOUSE_K;
    const real = isV ? Math.max(v.size.x, v.size.z) : v.bb.max.y;
    if (!(real > 0.01)) return HOUSE_K;
    return Math.min(4, Math.max(0.3, row[1] / real)) * HOUSE_K;
  };

  /* 5. размещение: сначала рассчитываем «точки» (с ровными площадками), потом строим */
  const placements = [];   // {id, seedV, x,z, rot, s, y?}
  const colliders = [];
  const flatten = [];
  const hAtRaw = (wx, wz) => hSample(Hf, wx / S + W / 2, wz / S + H / 2);
  function hSample(F, px_, py_) {
    const gx = px_ / CELL, gy = py_ / CELL, x0 = Math.min(GW - 2, Math.max(0, Math.floor(gx))), y0 = Math.min(GH - 2, Math.max(0, Math.floor(gy))), fx = Math.min(1, Math.max(0, gx - x0)), fy = Math.min(1, Math.max(0, gy - y0));
    return lerp(lerp(F[y0 * GW + x0], F[y0 * GW + x0 + 1], fx), lerp(F[(y0 + 1) * GW + x0], F[(y0 + 1) * GW + x0 + 1], fx), fy);
  }
  // суша для постройки: центр и 4 угла footprint выше воды и не в озере (до flatten)
  const lakeAtW = (wx, wz) => lakeM[Math.min(GH - 1, Math.max(0, Math.round((wz / S + H / 2) / CELL))) * GW + Math.min(GW - 1, Math.max(0, Math.round((wx / S + W / 2) / CELL)))] > 0;
  const landOK = (wx, wz, fr) => { for (const [dx, dz] of [[0, 0], [fr, fr], [-fr, fr], [fr, -fr], [-fr, -fr]]) if (hAtRaw(wx + dx, wz + dz) <= 0.7 || lakeAtW(wx + dx, wz + dz)) return false; return true; };
  const findLand = (wx, wz, fr) => {
    if (landOK(wx, wz, fr)) return { x: wx, z: wz };
    for (let r = 4; r <= 60; r += 4) { const n = Math.max(8, Math.round(2 * Math.PI * r / 4)); for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI, x = wx + Math.cos(a) * r, z = wz + Math.sin(a) * r; if (landOK(x, z, fr)) return { x, z }; } }
    return null;
  };
  const doorOut = (px, pz, rot, s, v) => {      // мировая точка перед дверью (5 ед. наружу) и нормаль наружу
    const dI = v.door.bodies.find(b => b.hasDoor), cs = Math.cos(rot), sn = Math.sin(rot), lx = dI.n[0] ? dI.cx + dI.n[0] * dI.hx : dI.off, lz = dI.n[1] ? dI.cz + dI.n[1] * dI.hz : dI.off;
    const nx = Math.round(dI.n[0] * cs + dI.n[1] * sn), nz = Math.round(-dI.n[0] * sn + dI.n[1] * cs), dx = px + (lx * cs + lz * sn) * s, dz = pz + (-lx * sn + lz * cs) * s;
    return { x: dx + nx * 5, z: dz + nz * 5, nx, nz, dx, dz };
  };
  // стены ставятся позже зданий, поэтому заранее отмечаем их кружками: чтобы дверь дома/башни не оказалась обращённой в стену
  for (const l of ops.line) if (l.k === 'wall') for (let i = 0; i < l.pts.length - 1; i++) { const A_ = l.pts[i], B_ = l.pts[i + 1], len_ = Math.hypot(B_[0] - A_[0], B_[1] - A_[1]) * S, n_ = Math.max(1, Math.ceil(len_ / 5)); for (let k = 0; k <= n_; k++) colliders.push({ x: (lerp(A_[0], B_[0], k / n_) - W / 2) * S, z: (lerp(A_[1], B_[1], k / n_) - H / 2) * S, r: 3.5 }); }
  const doorFlatten = [];      // выравнивание перед дверями применяем последним, чтобы соседние платформы его не перебили
  let hseq = 0;
  for (const o of objs) {
    const id = MAP(o.t, o.x, o.y);
    const isV = VESSEL.has(o.t) || /ship|boat|canoe/.test(id) && !/anchor/.test(id);
    const seedV = (hseq++) % 3;
    const v = variant(id, seedV);
    if (!v) continue;
    let s = o.s * fitK(id, v, isV);
    if (!isV && v.door) { const dd = v.door.bodies.find(b => b.hasDoor); if (dd) s = Math.max(s, 10.4 / dd.h, 3.9 / dd.w); }      // дверь должна пропускать Ричарда (рост 9, ширина 2.2): высота ≥ 10.4, ширина ≥ 3.9
    let wx = (o.x - W / 2) * S, wz = (o.y - H / 2) * S;
    if (!isV && !/^(lighthouse|pier)/.test(id)) {     // на суше: центр и 4 угла footprint, иначе сдвиг по спирали до 60 ед.; не нашли — пропускаем
      const at = findLand(wx, wz, Math.max(v.size.x, v.size.z) * 0.5 * s);
      if (!at) continue;
      o.x += (at.x - wx) / S; o.y += (at.z - wz) / S; wx = at.x; wz = at.z;
    }
    let rot = rnd() * Math.PI * 2;
    if (!isV) {
      const tp = faceTarget(o.x, o.y);
      if (tp) rot = Math.atan2(tp[0] - o.x, tp[1] - o.y);
      else if (/^(tower|torii|pagoda)/.test(id)) rot = Math.round(rot / (Math.PI / 2)) * Math.PI / 2;
    }
    if (isV && v.hull && v.hull.getSize(new THREE.Vector3()).length() > 14) rot = Math.round(rot / (Math.PI / 2)) * Math.PI / 2;      // большие корабли — по осям (ровная палуба-коллизия)
    if (!isV && v.door) {            // дома стоят строго по осям (ровные стены); дверью — к свободному месту: не к воде, не в соседний дом
      const base = Math.round(rot / (Math.PI / 2)) * Math.PI / 2; rot = base;
      const hcRot = hAtRaw(wx, wz); let bestScore = 1e9;
      for (const r_ of [base, base + Math.PI / 2, base - Math.PI / 2, base + Math.PI]) {      // из допустимых поворотов берём тот, где перед дверью самый ровный и свободный участок (не вверх по склону, не в соседний дом)
        const q = doorOut(wx, wz, r_, s, v); if (hAtRaw(q.x, q.z) <= 0.7 || lakeAtW(q.x, q.z) || colliders.some(k => (k.x - q.x) ** 2 + (k.z - q.z) ** 2 < (k.r + 3) ** 2)) continue;
        const q2 = doorOut(wx, wz, r_, s, v), far = [q2.x + q2.nx * 6, q2.z + q2.nz * 6], sc = Math.abs(hAtRaw(q.x, q.z) - hcRot) + 0.6 * Math.abs(hAtRaw(far[0], far[1]) - hcRot) + (r_ === base ? 0 : 0.8);
        if (sc < bestScore) { bestScore = sc; rot = r_; } }
    }
    const fr = Math.max(v.size.x, v.size.z) * 0.5 * s;
    if (!isV) {
      const hc = Math.max(0.5, hAtRaw(wx, wz));
      if (!/^(lighthouse|rock|cliff|skull|x_mark|flag|grave|anchor)/.test(id)) flatten.push({ wx, wz, r: fr * 1.05, h: hc });
      if (v.door) { const dd = v.door.bodies.find(b => b.hasDoor), q = doorOut(wx, wz, rot, s, v), fy = hc + dd.y0 * s; flatten.push({ wx: q.x + q.nx * 1, wz: q.z + q.nz * 1, r: 10, h: fy - 0.3 }); flatten.push({ wx: q.x + q.nx * 9, wz: q.z + q.nz * 9, r: 10, h: fy - 0.3 }); doorFlatten.push({ wx: q.x + q.nx * 1, wz: q.z + q.nz * 1, r: 6, h: fy - 0.3 }); }      // перед дверью земля вровень с порогом: не в холме и не ниже порога (раньше дверь могла оказаться «в горе» или на высоком крыльце без подъёма)
      if (/^(hut|town|fish|pirate|jp_|farm|tavern|inn|church|fortress|citadel|tower|pagoda|warehouse|lighthouse|windmill|big_hall|manor|barn)/.test(id)) colliders.push({ x: wx, z: wz, r: fr * 0.8 });
    }
    placements.push({ id, seedV, x: wx, z: wz, rot, s, vessel: isV, anim: !v.parts });
  }
  // стены, пирсы
  const lineModels = [];
  for (const l of ops.line) {
    if (l.k === 'wall') for (let i = 0; i < l.pts.length - 1; i++) lineModels.push({ id: 'wall_straight', a: l.pts[i], b: l.pts[i + 1], fit: true, s: 0.62 });
    if (l.k === 'pier') lineModels.push({ id: 'pier_straight', a: l.pts[0], b: l.pts[1], fit: false, s: 0.9 * l.w });
  }
  for (const lm of lineModels) {
    const v = variant(lm.id, 0); if (!v) continue;
    const along = v.size.x > v.size.z ? 'x' : 'z', L = v.size[along] * lm.s;
    const ax = (lm.a[0] - W / 2) * S, az = (lm.a[1] - H / 2) * S, kS = lm.fit ? S : 1;       // стены растягиваются вместе с картой, пирсы сохраняют длину
    let ax_ = ax, az_ = az, dx = (lm.b[0] - lm.a[0]) * kS, dz = (lm.b[1] - lm.a[1]) * kS, len = Math.hypot(dx, dz);
    if (lm.id.startsWith('pier')) {      // пирс должен начинаться на суше: продлеваем его начало назад, пока под ним не окажется берег
      const ux = dx / len, uz = dz / len; let e = 0;
      while (e < 40 && hAtRaw(ax - ux * e, az - uz * e) < 1.0) e += 2;
      if (e >= 40) continue;          // начало пирса не достаёт до суши (плавающий помост вдалеке от берега) — такой пирс не строим
      if (e > 0) e += 3;
      ax_ = ax - ux * e; az_ = az - uz * e; dx = ux * (len + e); dz = uz * (len + e); len += e;
    }
    if (lm.id === 'wall_straight' && len > 1) {      // концы звеньев доходили до центра угловой башни — стена оказывалась внутри башни: обрезаем ровно по окружности башни (точка выхода линии стены из круга)
      const ux = dx / len, uz = dz / len;
      const trimAt = (ex, ez, sx, sz) => {        // (ex,ez) — конец звена, (sx,sz) — единичное направление внутрь звена
        let best = null, bd = 1e9; for (const q of placements) { if (!/^tower/.test(q.id) || q.dead) continue; const d = Math.hypot(q.x - ex, q.z - ez); if (d < bd) { bd = d; best = q; } }
        if (!best || bd > 16 * S) return 0; const tv = variant(best.id, best.seedV); if (!tv) return 0;
        const r = Math.max(tv.size.x, tv.size.z) * best.s * 0.5 * 0.93, wx = best.x - ex, wz = best.z - ez, proj = wx * sx + wz * sz, perp2 = wx * wx + wz * wz - proj * proj;
        if (perp2 >= r * r) return 0;           // линия стены проходит мимо круга башни
        return Math.min(Math.max(0, proj + Math.sqrt(r * r - perp2)), len * 0.4);
      };
      const t0 = trimAt(ax_, az_, ux, uz), t1 = trimAt(ax_ + dx, az_ + dz, -ux, -uz);
      if (t0 + t1 > 0) { ax_ += ux * t0; az_ += uz * t0; len -= t0 + t1; dx = ux * len; dz = uz * len; }
    }
    const ang = Math.atan2(dx, dz);
    const rot = along === 'z' ? ang : ang - Math.PI / 2;   // модель вдоль z → rot=ang; вдоль x → повернуть на -90°
    const n = Math.max(1, lm.fit ? Math.round(len / L) : Math.ceil(len / L));
    const sc = lm.fit ? len / n / v.size[along] : lm.s;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, f_ = lm.fit ? t : (k * L + L / 2) / len, x = ax_ + dx * f_, z = az_ + dz * f_;
      const isPier = lm.id.startsWith('pier');
      if (!isPier) flatten.push({ wx: x, wz: z, r: v.size[along] * sc * 0.5 + 2, h: Math.max(0.5, hAtRaw(x, z)) });
      else { const dk = (v.deckTop ?? 2.4) * (lm.fit ? sc : lm.s); if (hAtRaw(x, z) > dk - 0.4) flatten.push({ wx: x, wz: z, r: 4.5, h: dk - 0.6, lowerOnly: true }); }      // берег выше настила: прорезаем под пирсом выемку, чтобы настил не оказывался внутри холма
      placements.push({ id: lm.id, seedV: 0, x, z, rot, s: lm.fit ? sc : lm.s, sx: 1, vessel: false, pier: isPier });
    }
  }
  // поля фермеров: рядом с каждой фермой — вспаханное поле (цвет земли + ряды колосьев); ищем ровный свободный прямоугольник у фермы
  const fields = [];
  for (const p of placements) {
    if (!/^farm/.test(p.id) || p.dead) continue; const v = variant(p.id, p.seedV), fr = Math.max(v.size.x, v.size.z) * 0.5 * p.s, FW = 70, FD = 44;
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const hw = dx ? FD / 2 : FW / 2, hd = dx ? FW / 2 : FD / 2, cx = p.x + dx * (fr + 6 + (dx ? hw : 0)), cz = p.z + dz * (fr + 6 + (dz ? hd : 0));
      let ok = true, h0 = hAtRaw(cx, cz);
      for (let i = -3; i <= 3 && ok; i++) for (let j = -2; j <= 2 && ok; j++) { const x = cx + i * hw / 3, z = cz + j * hd / 2, h = hAtRaw(x, z); if (h < 0.9 || Math.abs(h - h0) > 1.6 || lakeAtW(x, z) || colliders.some(k => (k.x - x) ** 2 + (k.z - z) ** 2 < (k.r + 4) ** 2) || fields.some(f => Math.abs(f.cx - x) < f.hw && Math.abs(f.cz - z) < f.hd)) ok = false; }
      if (ok) { fields.push({ cx, cz, hw, hd, h: Math.max(0.8, h0), kind: fields.length % 2 }); flatten.push({ wx: cx, wz: cz, r: Math.hypot(hw, hd) * 0.95, h: Math.max(0.8, h0) }); break; }
    }
  }
  const fieldAt = (x, z) => { for (const f of fields) if (Math.abs(x - f.cx) < f.hw && Math.abs(z - f.cz) < f.hd) return f; return null; };
  for (const f of fields) for (let z = f.cz - f.hd + 3; z < f.cz + f.hd - 2; z += 4.2) for (let x = f.cx - f.hw + 3; x < f.cx + f.hw - 2; x += (f.kind ? 4.4 : 3.2))
    placements.push({ id: f.kind ? 'grass_tall' : 'grass_wheat', seedV: Math.floor(rnd() * 3), x: x + (rnd() - 0.5) * 0.8, z: z + (rnd() - 0.5) * 0.8, rot: rnd() * 6.283, s: 1.0 + rnd() * 0.35, vessel: false });
  flatten.push(...doorFlatten);
  // выравниваем площадки под постройками
  for (const f of flatten) {
    const gx0 = Math.max(0, Math.floor((f.wx / S + W / 2 - f.r * 2 / S) / CELL)), gx1 = Math.min(GW - 1, Math.ceil((f.wx / S + W / 2 + f.r * 2 / S) / CELL));
    const gy0 = Math.max(0, Math.floor((f.wz / S + H / 2 - f.r * 2 / S) / CELL)), gy1 = Math.min(GH - 1, Math.ceil((f.wz / S + H / 2 + f.r * 2 / S) / CELL));
    for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
      const d = Math.hypot((x * CELL - W / 2) * S - f.wx, (y * CELL - H / 2) * S - f.wz), k = y * GW + x;
      const t = 1 - sstep(f.r, f.r * 1.9, d);
      if (t > 0 && Hf[k] > -1) Hf[k] = f.lowerOnly ? Math.min(Hf[k], lerp(Hf[k], f.h, t)) : lerp(Hf[k], f.h, t);
    }
  }
  const heightAt = (wx, wz) => hSample(Hf, wx / S + W / 2, wz / S + H / 2);

  /* 6. автоматические леса, кусты, камни */
  say('Сажаю лес…', 0.45);
  const nearBuilding = (wx, wz, pad) => { for (const k of colliders) if ((k.x - wx) ** 2 + (k.z - wz) ** 2 < (k.r + pad) ** 2) return true; return false; };
  const slopeAt = (wx, wz) => Math.hypot(heightAt(wx + 2, wz) - heightAt(wx - 2, wz), heightAt(wx, wz + 2) - heightAt(wx, wz - 2)) / 4;
  const gAt = (F, px_, py_) => F[Math.min(GH - 1, Math.max(0, Math.round(py_ / CELL))) * GW + Math.min(GW - 1, Math.max(0, Math.round(px_ / CELL)))];
  const biome = (x, y, h) => { const rg = region(x, y); return (rg === 'king' || rg === 'ninja' || rg === 'pirate' || rg === 'fishers' || (rg === 'main' && y > 470 && x > 620 && x < 1180) || rg === 'gulf') ? 'tropic' : (h > 9 ? 'conifer' : 'conifer'); };
  const TREE_RE = /^(fir|palm|oak|birch|willow)/, treeHash = new Map();
  const scatter = (id, wx, wz, s, y) => {
    if (TREE_RE.test(id)) {       // стволы — физические: держим между ними ≥ 7.6, чтобы проход (диаметр Ричарда ≈ 2.2) был всегда
      if (nearBuilding(wx, wz, 6)) return;
      const cx = Math.floor(wx / 7), cz = Math.floor(wz / 7);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = treeHash.get((cx + i) + ',' + (cz + j)); if (a) for (const q of a) if ((q[0] - wx) ** 2 + (q[1] - wz) ** 2 < 7.6 * 7.6) return; }
      const k = cx + ',' + cz; (treeHash.get(k) || treeHash.set(k, []).get(k)).push([wx, wz]);
    }
    const seedS = Math.floor(rnd() * 3);
    placements.push({ id, seedV: seedS, x: wx, z: wz, rot: rnd() * Math.PI * 2, s: s * fitK(id, variant(id, seedS), false), vessel: false, y });
  };
  // ближайшая ровная лужайка (для старта игрока)
  const findSpot = (px0, py0, rad = 120) => {
    let best = null, bs = 1e9;
    for (let i = 0; i < 4000; i++) {
      const a = rnd() * 6.283, d = Math.sqrt(rnd()) * rad, x = (px0 + Math.cos(a) * d - W / 2) * S, z = (py0 + Math.sin(a) * d - H / 2) * S, h = heightAt(x, z);
      if (h < 1 || h > 6 || slopeAt(x, z) > 0.12 || nearBuilding(x, z, 25) || lakeM[Math.round((z / S + H / 2) / CELL) * GW + Math.round((x / S + W / 2) / CELL)]) continue;
      let flat = 0; for (const [dx, dz] of [[20, 0], [-20, 0], [0, 20], [0, -20]]) flat += Math.abs(heightAt(x + dx, z + dz) - h);
      if (flat + d * 0.02 < bs) { bs = flat + d * 0.02; best = { x, z }; }
    }
    return best || { x: (px0 - W / 2) * S, z: (py0 - H / 2) * S };
  };
  const startSpot = findSpot(950, 390, 110);
  const STEP = 4.5;
  const meadow = (x, y) => 0.12 + 0.2 * fbm(x * 0.02 + 9, y * 0.02);       // плотность травы 0.12…0.32 — отдельные пятна, цвет земли зелёный, голой земли нет
  for (let py = 8; py < H - 8; py += STEP) for (let pxx = 8; pxx < W - 8; pxx += STEP) {
    const jx = pxx + (rnd() - 0.5) * STEP * 1.6, jy = py + (rnd() - 0.5) * STEP * 1.6, wx = (jx - W / 2) * S, wz = (jy - H / 2) * S, h = heightAt(wx, wz);
    if ((wx - startSpot.x) ** 2 + (wz - startSpot.z) ** 2 < 38 * 38) continue;      // поляна вокруг старта игрока
    if (fieldAt(wx, wz)) continue;                       // на полях ничего не растёт, кроме посевов
    if (h < 0.35) {                                      // мелководье: камни/рифы
      if (h > -3 && h < 0.1 && rnd() < 0.0035 && gAt(b1, jx, jy) > 0.2) scatter(pick(['reef_rocks', 'reef_coral']), wx, wz, 0.9 + rnd() * 0.6, 0);
      continue;
    }
    const kk = (Math.round(jy / CELL)) * GW + Math.round(jx / CELL);
    if (lakeM[kk] || pathM[kk] > 0.5) continue;
    const dn = db[kk], rg = region(jx, jy), sl = slopeAt(wx, wz);
    if (nearBuilding(wx, wz, 4)) continue;
    const bm = biome(jx, jy, h);
    const inJungle = ((jx - 865) / 200) ** 2 + ((jy - 655) / 125) ** 2 < 1;       // пальмовые джунгли юга главного острова
    if (((dn > 0.12 && rnd() < Math.min(0.95, dn * 1.9)) || (inJungle && rnd() < 0.32)) && sl < 0.9) {
      const r2 = rnd();
      let id;
      if (bm === 'tropic') id = r2 < 0.5 ? pick(['palm_straight', 'palm_lean', 'palm_coco', 'palm_short']) : r2 < 0.65 ? pick(['bush_green', 'bush_flower', 'bush_berry']) : r2 < 0.8 ? pick(['fern_tree', 'fern_a']) : r2 < 0.9 ? 'oak' : 'bush_green';
      else id = h > 24 ? 'fir_snow' : r2 < 0.5 ? 'fir_tall' : r2 < 0.75 ? 'fir_wide' : r2 < 0.88 ? 'fir_young' : pick(['birch', 'oak', 'bush_green']);
      if (rg === 'gulf' && rnd() < 0.7) continue;
      scatter(id, wx, wz, 0.6 + rnd() * 0.45, undefined);
    } else if (rock[kk] > 0 && sl > 0.5 && rnd() < 0.05) scatter(pick(['rock_large', 'rock_medium', 'rock_sharp', 'rock_mossy']), wx, wz, 1 + rnd() * 1.5);
    else if (h < 1.4 && gAt(b1, jx, jy) < 0.75 && rnd() < 0.015) scatter(pick(['beach_pebbles', 'shell_scallop', 'shell_conch', 'starfish', 'pebbles_pile']), wx, wz, 1 + rnd() * 0.6);
    else if (!rock[kk] && sl < 0.55 && h > 0.5 && rnd() < meadow(jx, jy)) {
      const f = fbm(jx * 0.03 + 40, jy * 0.03), r3 = rnd();
      const id = f > 0.62 && r3 < 0.5 ? pick(['grass_flowers', 'flowerbed_daisy', 'flowerbed_mixed', 'flowerbed_tulip']) : r3 < 0.5 ? 'grass_tall' : r3 < 0.8 ? 'grass_low' : r3 < 0.9 ? 'grass_wheat' : r3 < 0.975 ? pick(['bush_flower', 'bush_green']) : pick(['stump_a', 'log_fallen']);
      scatter(id, wx, wz, 0.8 + rnd() * 0.7);
    }
    else if (hseq > 0 && rnd() < 0.0006 && sl < 0.4 && h > 0.5 && h < 3 && region(jx, jy) !== 'gulf') scatter(pick(['stone_cairn', 'rock_flat', 'hill_rocky']), wx, wz, 0.9 + rnd() * 0.5);
  }
  // морские скалы и арки вокруг островов
  for (let n = 0, tries = 0; n < 14 && tries < 3000; tries++) {
    const jx = 40 + rnd() * (W - 80), jy = 40 + rnd() * (H - 80), wx = (jx - W / 2) * S, wz = (jy - H / 2) * S, h = heightAt(wx, wz);
    if (h < -6 && h > -14 && gAt(b1, jx, jy) > 0.02) { scatter(pick(['sea_stack', 'sea_arch', 'sea_stack']), wx, wz, 0.7 + rnd() * 0.5, -1); n++; }
  }

  /* 7. рельеф-меш */
  say('Строю рельеф…', 0.6);
  const SEGX = 800, SEGY = 550;
  const tGeo = new THREE.PlaneGeometry(W * S, H * S, SEGX, SEGY); tGeo.rotateX(-Math.PI / 2);
  const pos = tGeo.attributes.position, col = new Float32Array(pos.count * 3), tc = new THREE.Color();
  const PAL = { sand: new THREE.Color(0xe8d49b), g1: new THREE.Color(0x8fbf55), g2: new THREE.Color(0x6aa845), forest: new THREE.Color(0x3f7f38), dirt: new THREE.Color(0xb59a6a), rockA: new THREE.Color(0x8c8478), rockB: new THREE.Color(0x6e675f), snow: new THREE.Color(0xf4f7fa), bedS: new THREE.Color(0xc9b98a), bedD: new THREE.Color(0x174567), wet: new THREE.Color(0x9a8a5c) };
  const pathB = boxBlur(pathM, GW, GH, 1, 1);
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i), wz = pos.getZ(i), h = heightAt(wx, wz);
    pos.setY(i, h);
    const px_ = wx / S + W / 2, py_ = wz / S + H / 2, nzv = fbm(px_ * 0.06, py_ * 0.06), nz2 = vnoise(px_ * 0.5, py_ * 0.5);
    const bb_ = hSample(b1, px_, py_), rk = hSample(rb, px_, py_), dk = hSample(db, px_, py_), pt = hSample(pathB, px_, py_);
    if (h < 0) tc.copy(PAL.bedS).lerp(PAL.bedD, sstep(0.3, 7, -h));
    else {
      tc.copy(PAL.g1).lerp(PAL.g2, sstep(0.3, 0.7, nzv + (nz2 - 0.5) * 0.25));
      tc.lerp(PAL.forest, Math.min(0.85, dk * 1.5));
      const sa = 1 - sstep(0.4, 1.3, h + (nzv - 0.5) * 0.9); tc.lerp(PAL.sand, sa);
      const rr = sstep(0.25, 0.6, rk) * sstep(1.5, 4, h); if (rr > 0) tc.lerp(nz2 > 0.5 ? PAL.rockA : PAL.rockB, rr);
      if (h > 33) tc.lerp(PAL.snow, sstep(33, 44, h + (nzv - 0.5) * 8) * 0.75);
      if (pt > 0.3) tc.lerp(PAL.dirt, Math.min(1, (pt - 0.3) * 2.2));
      { const fd = fieldAt(wx, wz); if (fd) { const row = 0.5 + 0.5 * Math.sin(wz / 4.2 * Math.PI * 2); tc.setHex(0x6e4e2e).lerp(new THREE.Color(0x8a6a40), row * 0.55); } }      // вспаханное поле: борозды
    }
    tc.multiplyScalar(0.94 + nz2 * 0.12); tc.convertSRGBToLinear();
    col.set([tc.r, tc.g, tc.b], i * 3);
  }
  tGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); tGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true; terrain.castShadow = true; terrain.name = 'Terrain'; scene.add(terrain);

  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f9ec4, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.72, depthWrite: false });
  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000).rotateX(-Math.PI / 2), waterMat); waterMesh.position.y = -0.05; waterMesh.name = 'Water'; scene.add(waterMesh);
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x174567 })); abyss.position.y = -26; scene.add(abyss);

  /* 8. строим объекты (инстансинг + анимированные отдельно) */
  say('Собираю объекты…', 0.7);
  const batches = new Map(), animated = [], vessels = [], solidBoxes = [], subSolids = [];      // subSolids — подводные «юбки» скал: твёрдые только для плывущего (ходьба их не видит: верх ниже воды)
  const ROCK_RE = /^(rock_(large|medium|sharp|mossy|flat)|cliff|sea_stack|stone_cairn|hill_rocky)/;
  const SKIP_RE = /^(grass|flowerbed|bush|fern|clover|moss|reef|shell|beach|pebbles|starfish|waterlily|reed|torii|gate_|bridge|sea_arch|cave|mount|hill_round|hill_twin|volcano|torch|buoy|rope|net_|boarding|x_mark|boat|raft|canoe)/;
  const trunkCache = new Map(), tv = new THREE.Vector3();
  function trunkRadius(v) {          // макс. |x|,|z| вершин на высоте 0.3…2.5 над основанием
    const key = v.id + ':' + v.seedV; if (trunkCache.has(key)) return trunkCache.get(key);
    let m = 0;
    for (const part of v.parts || []) { const pa = part.g.attributes.position; for (let i = 0; i < pa.count; i++) { tv.fromBufferAttribute(pa, i).applyMatrix4(part.mat); if (tv.y > 0.3 && tv.y < 2.5) m = Math.max(m, Math.abs(tv.x), Math.abs(tv.z)); } }
    const r = m > 0 ? m : Math.max(v.size.x, v.size.z) * 0.06; trunkCache.set(key, r); return r;
  }
  const SOLID_RE = /^(hut|town|fish|pirate|jp_|farm|tavern|inn|church|fortress|citadel|tower|pagoda|warehouse|lighthouse|windmill|big_hall|manor|tent|wall|pier|fountain|crane|stall|barracks|smithy|townhall|gate_|dock)/;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  // перед дверью дома — свободно: деревья, камни, кусты и мелочь в 5.5 ед. от точки перед дверью убираем
  for (const p of placements) {
    if (p.dead || p.vessel || p.pier) continue; const v = variant(p.id, p.seedV); if (!v || !v.door || !BUILD_RE.test(p.id)) continue;
    const q = doorOut(p.x, p.z, p.rot, p.s, v);
    for (const o of placements) if (o !== p && !o.dead && !o.vessel && !o.pier && (TREE_RE.test(o.id) || /^(rock|stone|bush|fern|stump|log_|barrel|crate|sack)/.test(o.id)) && (o.x - q.x) ** 2 + (o.z - q.z) ** 2 < 5.5 * 5.5) o.dead = true;
  }
  /* 8a. столкновения объектов между собой: слабый уступает сильному (стена > постройка > дерево/камень > мелочь), равные — меньший по площади */
  say('Проверяю столкновения…', 0.68);
  const FP = placements.map(p => {
    if (p.vessel) return null; const v = variant(p.id, p.seedV); if (!v) return null;
    const c_ = Math.abs(Math.cos(p.rot)), s_ = Math.abs(Math.sin(p.rot)), sx_ = v.size.x * p.s, sz_ = v.size.z * p.s;
    let ex = (c_ * sx_ + s_ * sz_) / 2 * 0.85, ez = (s_ * sx_ + c_ * sz_) / 2 * 0.85;
    if (TREE_RE.test(p.id)) ex = ez = Math.min(2, Math.max(0.6, trunkRadius(v) * p.s));
    if (/^flag/.test(p.id)) ex = ez = 0.7 * p.s;
    return { x0: p.x - ex, x1: p.x + ex, z0: p.z - ez, z1: p.z + ez, area: ex * ez };
  });
  const prioOf = p => p.pier || /^wall/.test(p.id) ? 9 : SOLID_RE.test(p.id) ? 3 : (TREE_RE.test(p.id) || ROCK_RE.test(p.id)) ? 2 : /^(grass|flowerbed|reef|shell|beach|pebbles|starfish)/.test(p.id) ? 0 : 1;
  const colInfo = { checked: FP.filter(Boolean).length, overlaps: 0, removed: 0, removedByKind: {} };
  {
    const CS = 24, grid = new Map(), gk = (a, b) => a + ',' + b;
    FP.forEach((f, i) => { if (!f) return; for (let cx = Math.floor(f.x0 / CS); cx <= Math.floor(f.x1 / CS); cx++) for (let cz = Math.floor(f.z0 / CS); cz <= Math.floor(f.z1 / CS); cz++) (grid.get(gk(cx, cz)) || grid.set(gk(cx, cz), []).get(gk(cx, cz))).push(i); });
    for (const list of grid.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const i = list[a], j = list[b], p = placements[i], q = placements[j]; if (p.dead || q.dead) continue;
      const A = FP[i], B = FP[j]; if (A.x1 <= B.x0 || B.x1 <= A.x0 || A.z1 <= B.z0 || B.z1 <= A.z0) continue;
      const pp = prioOf(p), pq = prioOf(q);
      if (pp === 9 && pq === 9) continue;                                                       // куски стен/пирса стыкуются
      if ((pp === 9 && /^tower/.test(q.id)) || (pq === 9 && /^tower/.test(p.id))) continue;     // башни на углах стены — так задумано
      if (Math.max(pp, pq) < 3 && Math.min(pp, pq) === 0) continue;                              // трава под деревьями и мелочью — нормально
      colInfo.overlaps++;
      const loser = pp < pq ? p : pq < pp ? q : (A.area <= B.area ? p : q);
      loser.dead = true; colInfo.removed++; const kd = prioOf(loser); colInfo.removedByKind[kd] = (colInfo.removedByKind[kd] || 0) + 1;
    }
  }
  console.info('[столкновения]', JSON.stringify(colInfo));
  const treeCanopy = [];      // кроны деревьев для полёта драконов: {x, z, top (высота макушки), cr (радиус кроны)}
  for (const p of placements) {
    const v = variant(p.id, p.seedV); if (!v || p.dead) continue;
    let y = p.y !== undefined ? p.y : p.vessel || p.pier ? 0 : Math.max(heightAt(p.x, p.z), 0) - (/^(palm|fir|oak|birch|willow|bush|fern|rock|cliff)/.test(p.id) ? 0.15 : 0);
    if (v.door && BUILD_RE.test(p.id) && !p.vessel) { const q_ = doorOut(p.x, p.z, p.rot, p.s, v), ty = heightAt(q_.x, q_.z), dd_ = v.door.bodies.find(b => b.hasDoor), want = ty - dd_.y0 * p.s + 0.1; if (Math.abs(want - y) > 1.0) y = Math.min(y + 7, Math.max(y - 9, want)); if (Math.abs(ty - (y + dd_.y0 * p.s)) > 1.8) continue; }      // дверь на обрыве или в скале (перепад > 3 ед. даже после подгонки) — такой дом не ставим: войти в него нельзя      // склон выше порога: дом приподнимаем (до 4 ед.), чтобы дверь не оказалась «в горе».
    {
      const hgt = v.bb.max.y * p.s;
      let box = null;
      if (TREE_RE.test(p.id)) {                                  // ствол: радиус считаем по вершинам у основания модели
        const r = Math.min(2.0, Math.max(0.6, trunkRadius(v) * p.s));
        box = { x0: p.x - r, x1: p.x + r, z0: p.z - r, z1: p.z + r, y0: y - 30, y1: y + hgt, grab: false, kind: 'tree' };
        treeCanopy.push({ x: p.x, z: p.z, top: y + hgt, cr: Math.min(11, Math.max(5, hgt * 0.28)) });
      } else if (/^crane/.test(p.id)) {                           // кран: твёрдое только основание 7×7 (стрела с контргрузом поворачивается и раздувала габарит до ~25 ед.)
        const r = 3.6 * p.s; box = { x0: p.x - r, x1: p.x + r, z0: p.z - r, z1: p.z + r, y0: y - 30, y1: y + hgt, grab: false, kind: 'building' };
      } else if (/^flag/.test(p.id)) {                            // флаги: твёрдым считаем только древко (полотнище в габарите раздувало бокс на ~9 ед. — к флагу нельзя было подойти)
        const r = 0.7 * p.s; box = { x0: p.x - r, x1: p.x + r, z0: p.z - r, z1: p.z + r, y0: y - 30, y1: y + hgt, grab: false, kind: 'rock' };
      } else if (!p.vessel && (SOLID_RE.test(p.id) || ROCK_RE.test(p.id) || !SKIP_RE.test(p.id))) {   // всё, кроме травы/зелени/мелочи без коллизии — твёрдое (низкое — высота min 0.5; проходимость низкие боксы и так игнорирует)
        const c_ = Math.abs(Math.cos(p.rot)), s_ = Math.abs(Math.sin(p.rot)), sx_ = v.size.x * p.s, sz_ = v.size.z * p.s, k_ = ROCK_RE.test(p.id) ? 0.78 : 0.92;
        const ex = (c_ * sx_ + s_ * sz_) / 2 * k_, ez = (s_ * sx_ + c_ * sz_) / 2 * k_;
        box = { x0: p.x - ex, x1: p.x + ex, z0: p.z - ez, z1: p.z + ez, y0: y - 30, y1: y + Math.max(hgt, 0.5), kind: SOLID_RE.test(p.id) ? 'building' : 'rock' };
        if (ROCK_RE.test(p.id) && heightAt(p.x, p.z) < 1.5) { const kk = 1 / k_ + 0.04; subSolids.push({ x0: p.x - ex * kk, x1: p.x + ex * kk, z0: p.z - ez * kk, z1: p.z + ez * kk, y0: -40, y1: -0.3 }); }      // скала в воде: под водой её видимая часть шире сжатого бокса — пловец не должен проходить сквозь неё
        if (/^(pier|dock)/.test(p.id)) { box.y1 = y + (v.deckTop ?? 1.1) * p.s; box.y0 = box.y1 - 2.2; box.kind = 'pier'; const kx = 1.08 / 0.92, cx_ = (box.x0 + box.x1) / 2, cz_ = (box.z0 + box.z1) / 2, hx2 = (box.x1 - box.x0) / 2 * kx, hz2 = (box.z1 - box.z0) / 2 * kx; box.x0 = cx_ - hx2; box.x1 = cx_ + hx2; box.z0 = cz_ - hz2; box.z1 = cz_ + hz2; }      // сегменты настила перекрываются (раньше между ними были щели ≈1 ед. — в них проваливались), плита толще      // по пирсу/причалу можно ходить: твёрдая только тонкая плита настила, столбики и кнехты не мешают
        if (box && /^wall/.test(p.id)) { box.grab = false; box.nowall = true; }      // городская стена: на неё нельзя ни подтянуться, ни забраться отталкиванием от стены
        if (v.door && BUILD_RE.test(p.id)) {
          const cs = Math.cos(p.rot), sn = Math.sin(p.rot), R2 = (lx, lz) => [p.x + (lx * cs + lz * sn) * p.s, p.z + (-lx * sn + lz * cs) * p.s], swap = Math.abs(cs) < 0.5;
          box.houses = v.door.bodies.map(dI => {
            const bc = R2(dI.cx, dI.cz), hx_ = (swap ? dI.hz : dI.hx) * p.s, hz_ = (swap ? dI.hx : dI.hz) * p.s;
            const hs = { id: p.id, bx0: bc[0] - hx_, bx1: bc[0] + hx_, bz0: bc[1] - hz_, bz1: bc[1] + hz_, top: y + dI.topY * p.s, y, t: 0.6 * p.s, hasDoor: dI.hasDoor, gy: y + Math.max(dI.hasDoor ? dI.y0 : 0.4, 0.4) * p.s };      // пол городских зданий лежит на 0.4 (FL), а низ двери — на 0: опора кончалась ниже видимого пола, и игрок проваливался по грудь
            if (dI.round) { hs.round = { cx: p.x, cz: p.z, R0: dI.round.R0 * p.s, R1: dI.round.R1 * p.s, H: dI.round.H * p.s, t: dI.round.t * p.s, y }; const lq = dI.round.lantern, pl = dI.round.platform; if (lq) hs.round.lantern = { R: lq.R * p.s, y0: y + lq.y0 * p.s, y1: y + lq.y1 * p.s }; if (pl) hs.round.platform = { rI: pl.rI * p.s, rO: pl.rO * p.s, y: y + pl.y * p.s }; }
            if (dI.extra) {
              const wBox = b3 => { const xs = [], zs = []; for (const [lx, lz] of [[b3.min.x, b3.min.z], [b3.max.x, b3.min.z], [b3.min.x, b3.max.z], [b3.max.x, b3.max.z]]) { const q = R2(lx, lz); xs.push(q[0]); zs.push(q[1]); } return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: y + b3.min.y * p.s, y1: y + b3.max.y * p.s }; };
              hs.steps = dI.extra.steps.map(wBox); hs.floors = dI.extra.floors.map(wBox); hs.tiers = dI.extra.tiers.map(b3 => wBox(b3)); hs.windows = dI.extra.windows.map(wBox); hs.silos = dI.extra.silos.map(b3 => { const q = R2((b3.min.x + b3.max.x) / 2, (b3.min.z + b3.max.z) / 2); return { cx: q[0], cz: q[1], R: (b3.max.x - b3.min.x) / 2 * p.s, y0: y + b3.min.y * p.s, y1: y + b3.max.y * p.s }; });
              hs.ladders = dI.extra.ladders.map(L => { const q = R2(L.cx, L.cz); return { px: q[0], pz: q[1], n: { x: Math.round(L.n[0] * cs + L.n[1] * sn), z: Math.round(-L.n[0] * sn + L.n[1] * cs) }, hw: L.hw * p.s, bottom: y + L.bottom * p.s, top: y + L.top * p.s }; });
              hs.upper = dI.extra.upper && dI.extra.floors.length ? Object.assign(wBox(dI.extra.upper), { top: y + dI.extra.upper.max.y * p.s }) : null;
            }
            if (!dI.hasDoor) return hs;
            const dc = R2(dI.n[0] ? dI.cx + dI.n[0] * dI.hx : dI.off, dI.n[1] ? dI.cz + dI.n[1] * dI.hz : dI.off);
            Object.assign(hs, { n: [Math.round(dI.n[0] * cs + dI.n[1] * sn), Math.round(-dI.n[0] * sn + dI.n[1] * cs)], dx: dc[0], dz: dc[1], dw: dI.w * p.s, dh: dI.h * p.s });
            hs.makeDoor = () => {            // настоящая дверь модели (отдельный объект, открывается по E): создаём модель целиком и оставляем только эту дверь
              const g = catalog.get(p.id).make(THREE, p.seedV, { doorOpen: false }), ds = findDoors(g), set = new Set(ds);
              g.position.set(p.x, y, p.z); g.rotation.y = p.rot; g.scale.setScalar(p.s); g.updateMatrixWorld(true);
              g.traverse(o => { if (o.isMesh) { if (inGroups(o, set)) o.castShadow = true; else o.visible = false; } });
              let best = null, bd = -1; for (const d of ds) { const c_ = new THREE.Box3().setFromObject(d).getCenter(new THREE.Vector3()), dist = (c_.x - hs.dx) ** 2 + (c_.z - hs.dz) ** 2; if (bd < 0 || dist < bd) { bd = dist; best = d; } }
              for (const d of ds) if (d !== best) d.visible = false;
              const open0 = best.rotation.y;
              return { g, setOpen: t => { if (best.userData.setOpen) best.userData.setOpen(t > 0.5); else best.rotation.y = open0 - 1.75 * t; } };
            };
            return hs;
          });
        }
      }
      if (!box && p.vessel && v.hull && !(v.hull.getSize(new THREE.Vector3()).length() > 14)) {      // малая лодка: раньше коллизии не было совсем (проплывали и проходили насквозь) — теперь твёрдый корпус до палубы
        const hs = v.hull.getSize(new THREE.Vector3()), sw = Math.abs(Math.cos(p.rot)) < 0.5, L_ = Math.max(hs.x, hs.z) * p.s, W_ = Math.min(hs.x, hs.z) * p.s, ex = (sw ? W_ : L_) * 0.5 * 0.8, ez = (sw ? L_ : W_) * 0.5 * 0.8;
        box = { x0: p.x - ex, x1: p.x + ex, z0: p.z - ez, z1: p.z + ez, y0: y - 30, y1: y + Math.max(0.8, (v.deckY ?? v.hull.max.y * 0.42) * p.s), grab: true, kind: 'boat' };
      }
      if (!box && p.vessel && v.hull) {       // корабль: твёрдый корпус до палубы; за борт можно ухватиться и залезть (grab)
        const hs = v.hull.getSize(new THREE.Vector3()), big = hs.length() > 14;
        if (big) {
          const sw = Math.abs(Math.cos(p.rot)) < 0.5, L_ = Math.max(hs.x, hs.z) * p.s, W_ = Math.min(hs.x, hs.z) * p.s, ex = (sw ? W_ : L_) * 0.5 * 0.72, ez = (sw ? L_ : W_) * 0.5 * 0.72;
          const alongX = hs.x > hs.z, ex2 = (alongX !== sw) ? L_ * 0.36 : W_ * 0.36, ez2 = (alongX !== sw) ? W_ * 0.36 : L_ * 0.36;
          box = { x0: p.x - ex2, x1: p.x + ex2, z0: p.z - ez2, z1: p.z + ez2, y0: y - 30, y1: y + (v.deckY ?? v.hull.max.y * 0.42) * p.s, grab: true, kind: 'ship' };
          p.shipBox = box; p.hullL = Math.max(hs.x, hs.z) * p.s; p.hullW = Math.min(hs.x, hs.z) * p.s; p.shipV = v;
        }
      }
      if (box && box.houses && v.door && v.door.outer && v.door.outer.length) {      // ограда замка: боксы в мировых координатах (поворот кратен 90°)
        const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
        box.walls = v.door.outer.map(b3 => {
          const xs = [], zs = []; for (const [lx, lz] of [[b3.min.x, b3.min.z], [b3.max.x, b3.min.z], [b3.min.x, b3.max.z], [b3.max.x, b3.max.z]]) { xs.push(p.x + (lx * cs + lz * sn) * p.s); zs.push(p.z + (-lx * sn + lz * cs) * p.s); }
          return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: y + b3.min.y * p.s - 1, y1: y + b3.max.y * p.s };
        });
      }
      if (box && box.kind === 'rock' && !ROCK_RE.test(p.id)) {     // длинные предметы (бревно, скамья, забор): один AABB под углом раздувается далеко за предмет — заменяем цепочкой маленьких боксов вдоль оси
        const sx_ = v.size.x * p.s, sz_ = v.size.z * p.s, Lg = Math.max(sx_, sz_), Wd = Math.min(sx_, sz_);
        if (Lg > 2.4 * Wd && Lg > 4 && Math.abs(Math.sin(2 * p.rot)) > 0.1) {
          const ax = sx_ >= sz_ ? [Math.cos(p.rot), -Math.sin(p.rot)] : [Math.sin(p.rot), Math.cos(p.rot)], n = Math.ceil(Lg / (Wd * 1.5)), h = Math.max(0.5, Wd / 2) * 0.92;
          for (let i = 0; i < n; i++) {
            const t_ = (i + 0.5) / n * Lg - Lg / 2, cx_ = p.x + ax[0] * t_, cz_ = p.z + ax[1] * t_, bb_ = { ...box, x0: cx_ - h, x1: cx_ + h, z0: cz_ - h, z1: cz_ + h };
            if (i === 0) box = bb_; else solidBoxes.push(bb_);
          }
        }
      }
      if (box) solidBoxes.push(box);
    }
    if (v.parts) {
      let b = batches.get(p.id + ':' + p.seedV); if (!b) batches.set(p.id + ':' + p.seedV, b = { v, mats: [] });
      Q.setFromAxisAngle(UP, p.rot); M4.compose(V3.set(p.x, y, p.z), Q, S3.setScalar(p.s)); b.mats.push(M4.clone());
    } else {
      const g = catalog.get(p.id).make(THREE, p.seedV, { doorOpen: false });
      g.position.set(p.x, y, p.z); g.rotation.y = p.rot; g.scale.setScalar(p.s);
      if (v.door && BUILD_RE.test(p.id)) findDoors(g).forEach(d => { d.visible = false; });      // анимированные здания (мельница, маяк): створку рисует отдельная дверь, открывающаяся по E
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(g);
      if (g.userData.animate) animated.push(g);
      if (p.vessel) {
        const V_ = { id: p.id, g, y0: y, ph: rnd() * 6, box: p.shipBox || null, L: p.hullL || 0, W: p.hullW || 0, yaw: p.rot, rv: 0, s: p.s };
        const sv = p.shipV;
        if (V_.box && sv && sv.hull) {            // у большого корабля: лестница на борт (правый борт, посередине) и штурвал на корме; плыть можно только от штурвала
          const hb = sv.hull, dk = sv.deckY ?? hb.max.y * 0.42, zL = (hb.min.z + hb.max.z) / 2 - (hb.max.z - hb.min.z) * 0.08, zH = (() => { const ms = []; sv.proto.traverse(o => { if (!o.isMesh && o.name === 'Mast') { const b_ = new THREE.Box3().setFromObject(o); ms.push((b_.min.z + b_.max.z) / 2); } }); ms.sort((a, b) => a - b); const z = ms.length >= 2 ? (ms[0] + ms[1]) / 2 : ms.length ? ms[0] - 8 : hb.min.z + (hb.max.z - hb.min.z) * 0.17; return Math.max(hb.min.z + 4, z); })(), xo = hb.max.x * 0.99;      // штурвал — на палубе между двумя кормовыми мачтами (не внутри мачты)
          const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.8 }), box_ = (w, h, d, x, yy, z, m) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.position.set(x, yy, z); q.castShadow = true; return q; };
          const lad = new THREE.Group(); lad.name = 'ShipLadder'; const yb = -2.2, yt = hb.max.y + 0.6;
          for (const dz of [-0.55, 0.55]) lad.add(box_(0.16, yt - yb, 0.16, xo + 0.15, (yt + yb) / 2, zL + dz, wood));
          for (let yy = yb + 0.6; yy < yt; yy += 0.9) lad.add(box_(0.12, 0.12, 1.2, xo + 0.15, yy, zL, dark));
          g.add(lad);
          const helm = new THREE.Group(); helm.name = 'ShipHelm'; helm.position.set(0, dk, zH);
          helm.add(box_(0.5, 1.5, 0.5, 0, 0.75, 0, dark));
          const wheel = new THREE.Group(); wheel.position.set(0, 1.9, 0.1); const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 8, 24), wood); wheel.add(ring);
          for (let k = 0; k < 8; k++) { const sp = box_(0.12, 2.5, 0.12, 0, 0, 0, dark); sp.rotation.z = k * Math.PI / 8; wheel.add(sp); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), wood); kn.position.set(Math.sin(k * Math.PI / 4) * 1.15, Math.cos(k * Math.PI / 4) * 1.15, 0); wheel.add(kn); }
          helm.add(wheel); g.add(helm);
          V_.sails = []; g.traverse(o => { if (o.isMesh && /^(Sail|Jib)$/.test(o.name)) { o.geometry.computeBoundingBox(); V_.sails.push({ m: o, ymax: o.geometry.boundingBox.max.y, y0: o.position.y }); } }); V_.sailK = 0.07; V_.sailsUp = false;
          V_.wheel = wheel; V_.heel = 0; V_.noRock = true; V_.ladder ={ x: xo, z: zL, yTop: dk }; V_.helm = { x: 0, y: dk, z: zH - 1.2 }; V_.deckY = Math.max(dk, 0.7 / p.s);      // у маленьких лодок палуба у самой воды — настил поднимаем минимум на 0.7 над морем, чтобы по нему можно было ходить V_.beam = (hb.max.x - hb.min.x);
        }
        vessels.push(V_);
      }
    }
  }
  let meshCount = 0;
  // части модели с одинаковым материалом склеиваем в одну геометрию → 1 InstancedMesh на материал (а не на каждую деталь)
  const mergedCache = new Map();
  function mergedParts(v) {
    const key = v.id + ':' + v.seedV; if (mergedCache.has(key)) return mergedCache.get(key);
    const byMat = new Map();
    for (const part of v.parts) { const k = Array.isArray(part.m) ? null : part.m; if (!k) { byMat.set(Symbol(), [part]); continue; } (byMat.get(k) || byMat.set(k, []).get(k)).push(part); }
    const out = [];
    for (const [m, list] of byMat) {
      if (list.length === 1 || !m) { for (const p of list) out.push({ g: p.g, m: p.m, mat: p.mat }); continue; }
      try {
        const geos = list.map(p => { let g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); g.applyMatrix4(p.mat); for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n); return g; });
        const has = n => geos.every(g => g.attributes[n]);
        for (const g of geos) for (const n of ['normal', 'uv', 'color']) if (!has(n) && g.attributes[n]) g.deleteAttribute(n);
        const merged = mergeGeometries(geos, false);
        if (!merged) throw new Error('merge null');
        out.push({ g: merged, m, mat: new THREE.Matrix4() });
      } catch (e) { for (const p of list) out.push({ g: p.g, m: p.m, mat: p.mat }); }
    }
    mergedCache.set(key, out); return out;
  }
  for (const b of batches.values()) for (const part of mergedParts(b.v)) {
    const im = new THREE.InstancedMesh(part.g, part.m, b.mats.length);
    b.mats.forEach((m, i) => im.setMatrixAt(i, m.clone().multiply(part.mat)));
    im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); im.name = b.v.id;
    scene.add(im); meshCount++;
  }
  // подписи
  const labels = [];
  for (const L of showLabels ? ops.label : []) {
    const cvs = document.createElement('canvas'), g = cvs.getContext('2d'), fs = 64;
    g.font = `bold ${fs}px Georgia, serif`; const w = Math.ceil(g.measureText(L.text).width) + 40; cvs.width = w; cvs.height = fs + 30;
    g.font = `bold ${fs}px Georgia, serif`; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = 'rgba(255,248,230,.95)'; g.strokeText(L.text, 20, cvs.height / 2); g.fillStyle = L.color; g.fillText(L.text, 20, cvs.height / 2);
    const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    const sh = L.size * 2.6; sp.scale.set(sh * cvs.width / cvs.height, sh, 1);
    sp.position.set((L.x - W / 2) * S, Math.max(heightAt((L.x - W / 2) * S, (L.y - H / 2) * S), 0) + 42 + L.size, (L.y - H / 2) * S); sp.renderOrder = 10; scene.add(sp); labels.push(sp);
  }

  const spots = {
    'Город короля': { x: (255 - W / 2) * S, z: (372 - H / 2) * S, yaw: Math.PI },
    'Главный остров — лес': { x: (880 - W / 2) * S, z: (470 - H / 2) * S, yaw: 0 },
    'Деревня у озера': { x: (1045 - W / 2) * S, z: (410 - H / 2) * S, yaw: 0 },
    'Рыбацкая деревня': { x: (1075 - W / 2) * S, z: (625 - H / 2) * S, yaw: 0 },
    'Горная крепость': { x: (800 - W / 2) * S, z: (330 - H / 2) * S, yaw: Math.PI },
    'Пиратский остров': { x: (340 - W / 2) * S, z: (880 - H / 2) * S, yaw: Math.PI },
    'Остров ниндзей': { x: (1230 - W / 2) * S, z: (215 - H / 2) * S, yaw: Math.PI },
    'Губа смерти': { x: (1388 - W / 2) * S, z: (436 - H / 2) * S, yaw: 0 },
  };
  /* 9. проверка проходимости: от старта должны достигаться все ключевые точки (старт, телепорты, улицы);
        если нет — на кратчайшем пути «прорубаем» мешающие объекты (деревья/камни дёшево, постройки — в последнюю очередь) */
  say('Проверяю проходимость…', 0.99);
  const passInfo = { keys: 0, carved: 0, unreachable: 0, carvedKinds: {}, trees: placements.filter(p => TREE_RE.test(p.id)).length };
  const WS = W * S, HS = H * S, GS = 2.4, CW = Math.ceil(WS / GS), CH = Math.ceil(HS / GS), PAD = 1.15, NC = CW * CH;      // PAD = радиус Ричарда 1.1 + чуть-чуть
  const keys = [[startSpot.x, startSpot.z], ...Object.values(spots).map(p => [p.x, p.z])];
  for (const l of ops.line) if (l.k === 'street' || l.k === 'road') for (let i = 0; i < l.pts.length - 1; i++) { const a = l.pts[i], b = l.pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 18)); for (let k = 0; k < n; k++) keys.push([(lerp(a[0], b[0], k / n) - W / 2) * S, (lerp(a[1], b[1], k / n) - H / 2) * S]); }
  const cellOf = (x, z) => Math.min(CH - 1, Math.max(0, Math.floor((z + HS / 2) / GS))) * CW + Math.min(CW - 1, Math.max(0, Math.floor((x + WS / 2) / GS)));
  const BIG_ROCK = b => b.kind === 'rock' && Math.max(b.x1 - b.x0, b.z1 - b.z0) > 7;      // большие валуны/скалы — настоящая преграда: их не «прорубаем» (раньше валун на пути удалялся, и сквозь него можно было ходить)
  function raster() {
    const cnt = new Uint16Array(NC), hard = new Uint8Array(NC), owners = new Map();
    solidBoxes.forEach((b, i) => {
      if (b.removed || b.houses || b.kind === 'ship' || b.kind === 'pier' || b.kind === 'boat') return;      // дома с дверью проходимы (можно войти), корабли/причалы — не преграда
      if (b.y1 - Math.max(0, heightAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)) < 5) return;       // ниже высоты прыжка — не преграда
      const c0 = Math.max(0, Math.floor((b.x0 - PAD + WS / 2) / GS)), c1 = Math.min(CW - 1, Math.floor((b.x1 + PAD + WS / 2) / GS)), r0 = Math.max(0, Math.floor((b.z0 - PAD + HS / 2) / GS)), r1 = Math.min(CH - 1, Math.floor((b.z1 + PAD + HS / 2) / GS));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const cx = (c + 0.5) * GS - WS / 2, cz = (r + 0.5) * GS - HS / 2;
        if (cx < b.x0 - PAD || cx > b.x1 + PAD || cz < b.z0 - PAD || cz > b.z1 + PAD) continue;
        const k = r * CW + c; cnt[k]++; if (b.kind !== 'tree' && !(b.kind === 'rock' && !BIG_ROCK(b))) hard[k] = 1; (owners.get(k) || owners.set(k, []).get(k)).push(i);
      }
    });
    return { cnt, hard, owners };
  }
  function flood(cnt, from) {
    const seen = new Uint8Array(NC), st = [from]; seen[from] = 1;
    while (st.length) { const k = st.pop(), x = k % CW, y = (k / CW) | 0; for (const n of [x > 0 ? k - 1 : -1, x < CW - 1 ? k + 1 : -1, y > 0 ? k - CW : -1, y < CH - 1 ? k + CW : -1]) if (n >= 0 && !seen[n] && !cnt[n]) { seen[n] = 1; st.push(n); } }
    return seen;
  }
  function carve(R, seen, from) {          // Дейкстра от недостижимой точки до достижимой области; удаляем объекты на пути
    const dist = new Float32Array(NC).fill(1e9), prev = new Int32Array(NC).fill(-1), heap = [[0, from]]; dist[from] = 0;
    const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    let goal = -1;
    while (heap.length) {
      const [d, k] = pop(); if (d > dist[k]) continue; if (seen[k]) { goal = k; break; }
      const x = k % CW, y = (k / CW) | 0;
      for (const n of [x > 0 ? k - 1 : -1, x < CW - 1 ? k + 1 : -1, y > 0 ? k - CW : -1, y < CH - 1 ? k + CW : -1]) { if (n < 0) continue; const nd = d + (R.cnt[n] ? (R.hard[n] ? 40 : 6) : 1); if (nd < dist[n]) { dist[n] = nd; prev[n] = k; push([nd, n]); } }
    }
    let removed = 0;
    for (let k = goal; k >= 0; k = prev[k]) for (const i of R.owners.get(k) || []) if (!solidBoxes[i].removed && solidBoxes[i].kind !== 'building' && !BIG_ROCK(solidBoxes[i])) { solidBoxes[i].removed = true; removed++; passInfo.carvedKinds[solidBoxes[i].kind] = (passInfo.carvedKinds[solidBoxes[i].kind] || 0) + 1; }
    return removed;
  }
  passInfo.keys = keys.length;
  {
    const from = cellOf(startSpot.x, startSpot.z);
    const tBudget = performance.now() + 5000;      // защита от «вечной загрузки»: на проверку проходимости — не больше ~5 с
    for (let pass = 0; pass < 5 && performance.now() < tBudget; pass++) {
      const R = raster(); R.cnt[from] = 0; const seen = flood(R.cnt, from);
      const bad = keys.filter(([x, z]) => !seen[cellOf(x, z)]);
      if (pass === 0) passInfo.unreachableBefore = bad.length;
      passInfo.unreachable = bad.length; if (!bad.length) break;
      for (const [x, z] of bad) { if (performance.now() > tBudget) break; const k = cellOf(x, z); if (!seen[k]) passInfo.carved += carve(R, seen, k); }
    }
    let land = 0, reach = 0; { const R = raster(); R.cnt[from] = 0; const seen = flood(R.cnt, from); for (let k = 0; k < NC; k++) { const x = (k % CW + 0.5) * GS - WS / 2, z = ((k / CW | 0) + 0.5) * GS - HS / 2; if (heightAt(x, z) > 0.7 && !R.cnt[k]) { land++; if (seen[k]) reach++; } } passInfo.landReachable = +(reach / land).toFixed(3); }
    console.info('[проходимость]', JSON.stringify(passInfo));
  }
  const finalSolids = solidBoxes.filter(b => !b.removed);
  const BG = new Map(), BCS = 16;       // сетка для blockedAt: «в этой точке стоит что-то твёрдое» (для жителей и животных)
  for (const b of finalSolids) { if (b.kind === 'ship' || b.kind === 'pier' || b.kind === 'boat') continue; for (let cx = Math.floor(b.x0 / BCS); cx <= Math.floor(b.x1 / BCS); cx++) for (let cz = Math.floor(b.z0 / BCS); cz <= Math.floor(b.z1 / BCS); cz++) { const k = cx + ',' + cz; (BG.get(k) || BG.set(k, []).get(k)).push(b); } }
  const TCS = 24, TG = new Map(); for (const t of treeCanopy) { const k = Math.floor(t.x / TCS) + ',' + Math.floor(t.z / TCS); (TG.get(k) || TG.set(k, []).get(k)).push(t); }
  /** высота ближайшей к точке кроны дерева (макушка), в радиусе r от крон; -Infinity, если деревьев рядом нет */
  const treeTopAt = (x, z, r = 0) => { const cx = Math.floor(x / TCS), cz = Math.floor(z / TCS); let best = -Infinity; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a_ = TG.get((cx + i) + ',' + (cz + j)); if (a_) for (const t of a_) { const d = (t.x - x) ** 2 + (t.z - z) ** 2, m = t.cr + r; if (d < m * m && t.top > best) best = t.top; } } return best; };
  const blockedAt = (x, z, pad = 0) => { const cx = Math.floor(x / BCS), cz = Math.floor(z / BCS); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a_ = BG.get((cx + i) + ',' + (cz + j)); if (a_) for (const b of a_) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return true; } return false; };
  say('Готово', 1);
  return {
    heightAt, blockedAt, treeTopAt, vessels, subSolids, fields, houses: finalSolids.flatMap(b => (b.houses || []).filter(h => h.hasDoor)), colliders, spots, solidBoxes: finalSolids, passInfo, startSpot, places: objs.map(o => ({ t: o.t, x: (o.x - W / 2) * S, z: (o.y - H / 2) * S })), S, collisions: colInfo, region: (wx, wz) => region(wx / S + W / 2, wz / S + H / 2),
    ops: { lines: ops.line, labels: ops.label }, findSpot, lakeAt: (wx, wz) => !!lakeM[Math.round((wz / S + H / 2) / CELL) * GW + Math.round((wx / S + W / 2) / CELL)], bounds: { x0: -W * S / 2 + 6, x1: W * S / 2 - 6, z0: -H * S / 2 + 6, z1: H * S / 2 - 6 }, size: { W: W * S, H: H * S },
    stats: { scale: S, collisions: colInfo, placements: placements.length, drawMeshes: meshCount, animated: animated.length, models: variantCache.size },
    update(t) {
      for (const g of animated) try { g.userData.animate(t); } catch (e) { /* ignore */ }
      for (const v of vessels) { const k = v.noRock ? 0 : 1; v.g.position.y = v.y0 + Math.sin(t * 1.3 + v.ph) * 0.35 * k; v.g.rotation.z = Math.sin(t * 0.9 + v.ph) * 0.02 * k + (v.heel || 0); }      // корабли с лестницей не качаются: настил — статичные коробки
      for (const v of vessels) if (v.noRock) { const f = v.fl || (v.fl = v.g.getObjectByName('Float')); if (f) { f.rotation.set(0, 0, 0); f.position.y = 0; } }      // собственная качка модели (rock()) двигала корпус относительно твёрдой палубы — «трясло»; у кораблей, по которым ходят, убрана
      waterMesh.position.y = -0.05 + Math.sin(t * 0.8) * 0.03;
    },
  };
}
