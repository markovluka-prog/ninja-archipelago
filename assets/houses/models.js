// Процедурные дома для фильма «Ниндзи». Three.js r160. Только код, без внешних моделей/текстур.
// Конвенция: низ на y=0, центр в (0,0), вход смотрит в +z. Дверь >=4.6 x 8.8, пол внутри, Roof/Door отдельными группами.
// make(THREE, seed=0, {doorOpen:false}) -> THREE.Group; group.userData.animate(t), setDoorOpen(b), setRoofVisible(b)

const MAT = new Map(), TEXC = new Map();
const TILE = { plank: 4, log: 4, stone: 6, thatch: 4, tile: 4, plaster: 6, shoji: 2, stripe: 4, tatami: 4, net: 2, cloth: 3, parch: 4 };

function rng32(seed) {
  let a = ((seed * 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function makeTexture(THREE, kind, color, c2) {
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const R = rng32(kind.length * 977 + (color % 9973));
  const base = new THREE.Color(color), white = new THREE.Color(0xffffff);
  const sh = (k) => { const q = base.clone(); if (k < 0) q.multiplyScalar(1 + k); else q.lerp(white, k); return '#' + q.getHexString(); };
  const fr = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  fr(sh(0), 0, 0, S, S);
  if (kind === 'plank') {
    for (let i = 0; i < 4; i++) { fr(sh((R() - .5) * .18), i * 16, 0, 16, S); fr(sh(-.4), i * 16, 0, 2, S); for (let j = 0; j < 3; j++) fr(sh(-.14), i * 16 + 3 + R() * 10, R() * S, 1, 8 + R() * 20); }
  } else if (kind === 'log') {
    for (let i = 0; i < 4; i++) { const y = i * 16; fr(sh((R() - .5) * .14), 0, y, S, 16); fr(sh(.15), 0, y + 1, S, 3); fr(sh(-.38), 0, y + 13, S, 3); if (R() < .6) fr(sh(-.3), R() * 56, y + 5, 5, 4); }
  } else if (kind === 'stone') {
    fr(sh(-.42), 0, 0, S, S);
    for (let r = 0; r < 4; r++) for (let b = -1; b < 3; b++) fr(sh((R() - .5) * .3), (r % 2) * 16 + b * 32 + 1, r * 16 + 1, 30, 14);
  } else if (kind === 'thatch') {
    for (let i = 0; i < 70; i++) fr(sh((R() - .5) * .3), R() * S, R() * S, 1 + R() * 1.5, 10 + R() * 30);
    for (let i = 0; i < 4; i++) { g.globalAlpha = .3; fr(sh(-.5), 0, i * 16 + 13, S, 2); g.globalAlpha = 1; }
  } else if (kind === 'tile') {
    for (let r = 0; r < 4; r++) for (let b = -1; b < 5; b++) { const x = b * 16 + (r % 2) * 8; fr(sh((R() - .5) * .22), x + 1, r * 16, 14, 14); fr(sh(-.45), x, r * 16, 1, 16); fr(sh(-.5), x, r * 16 + 13, 16, 3); }
  } else if (kind === 'plaster') {
    for (let i = 0; i < 160; i++) fr(sh((R() - .5) * .14), R() * S, R() * S, 1 + R() * 2, 1 + R() * 2);
  } else if (kind === 'shoji') {
    fr(sh(0), 0, 0, S, S); const f = c2 || 0x4a3020, fc = '#' + new THREE.Color(f).getHexString();
    for (let k = 0; k <= 32; k += 32) { fr(fc, k, 0, 3, S); fr(fc, 0, k, S, 3); }
    fr(fc, 15, 0, 1, S); fr(fc, 47, 0, 1, S); fr(fc, 0, 15, S, 1); fr(fc, 0, 47, S, 1);
  } else if (kind === 'stripe') {
    const fc = '#' + new THREE.Color(c2 || 0xffffff).getHexString();
    for (let i = 0; i < 8; i += 2) fr(fc, i * 8, 0, 8, S);
    for (let i = 0; i < 60; i++) fr('rgba(0,0,0,.05)', R() * S, R() * S, 1, 4);
  } else if (kind === 'tatami') {
    fr(sh(-.3), 0, 0, S, 2); fr(sh(-.3), 0, 32, S, 2); fr(sh(-.3), 0, 0, 2, 32);
    for (let i = 0; i < S; i += 3) fr('rgba(0,0,0,.06)', 0, i, S, 1);
  } else if (kind === 'cloth') {
    for (let i = 0; i < S; i += 2) { fr('rgba(0,0,0,.05)', 0, i, S, 1); fr('rgba(255,255,255,.05)', i, 0, 1, S); }
  } else if (kind === 'parch') {
    for (let i = 0; i < 40; i++) fr(sh(-.2), R() * S, R() * S, 4 + R() * 12, 1);
    g.strokeStyle = '#7a4a2a'; g.lineWidth = 1; g.beginPath(); g.moveTo(6, 40); g.lineTo(25, 20); g.lineTo(40, 36); g.lineTo(58, 12); g.stroke();
    fr('#b83a2a', 24, 18, 4, 4);
  } else if (kind === 'net') {
    g.clearRect(0, 0, S, S); g.strokeStyle = '#' + base.getHexString(); g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(-32, 32); g.lineTo(0, 0); g.moveTo(64, 0); g.lineTo(96, 32); g.moveTo(0, 64); g.lineTo(32, 96); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function worldUV(geo, ox, oy, oz) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i) + oz;
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax > .5) uv.setXY(i, z, y); else if (ay > .5) uv.setXY(i, x, z); else uv.setXY(i, x, y);
  }
}

// треугольный/усечённый «шатёр»: 4 грани, мировые UV
function frustumGeo(THREE, hx, hz, rx, rz, h) {
  const P = [], U = [];
  const sl = (a, b) => Math.hypot(a, b);
  const face = (A, B, C, D, uA, uB, vL) => { [A, B, C, A, C, D].forEach(v => P.push(...v)); U.push(uA, 0, uB, 0, uB * (C[0] === D[0] && C[2] === D[2] ? 0 : 1), vL, uA, 0, 0, vL, uA * 0, vL); };
  const quad = (A, B, C, D, ua, ub, vL, uc, ud) => { P.push(...A, ...B, ...C, ...A, ...C, ...D); U.push(ua, 0, ub, 0, uc, vL, ua, 0, uc, vL, ud, vL); };
  const sF = sl(h, hz - rz), sS = sl(h, hx - rx);
  quad([-hx, 0, hz], [hx, 0, hz], [rx, h, rz], [-rx, h, rz], -hx, hx, sF, rx, -rx);
  quad([hx, 0, -hz], [-hx, 0, -hz], [-rx, h, -rz], [rx, h, -rz], -hx, hx, sF, rx, -rx);
  quad([hx, 0, hz], [hx, 0, -hz], [rx, h, -rz], [rx, h, rz], -hz, hz, sS, rz, -rz);
  quad([-hx, 0, -hz], [-hx, 0, hz], [-rx, h, rz], [-rx, h, -rz], -hz, hz, sS, rz, -rz);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.computeVertexNormals();
  return geo;
}

function roofProfile(style, s, h) {
  const L = [], N = 8;
  if (style === 'gable') return [[-s, 0], [s, 0], [0, h]];
  if (style === 'shed') return [[-s, 0], [s, 0], [s, h]];
  if (style === 'mansard') return [[-s, 0], [s, 0], [s * .8, h * .72], [s * .45, h], [-s * .45, h], [-s * .8, h * .72]];
  if (style === 'gambrel') return [[-s, 0], [s, 0], [s * .62, h * .62], [0, h], [-s * .62, h * .62]];
  for (let i = 0; i <= N; i++) {
    const t = i / N; let x = -s * (1 - t), y;
    if (style === 'thatch') { x -= s * .1 * Math.sin(Math.PI * t) * (1 - t * .3); y = h * Math.pow(t, .85); }
    else { y = h * Math.pow(t, 1.7) + h * .14 * Math.pow(Math.max(0, 1 - t * 4), 2); } // curve (японская)
    L.push([x, y]);
  }
  const pts = [[-s, 0], ...L, ...L.slice(0, -1).reverse().map(p => [-p[0], p[1]]), [s, 0]];
  return pts;
}

function ctx(THREE, seed, opts) {
  const rnd = rng32(seed * 7919 + 13);
  const c = { THREE, opts: opts || {}, rnd, anims: [], doors: [], roofs: [] };
  const K = .95 + rnd() * .1;
  c.s = v => Math.round(v * K * 10) / 10;
  c.pick = a => a[Math.floor(rnd() * a.length)];
  c.vary = (hex, a = .06) => { const col = new THREE.Color(hex), h = {}; col.getHSL(h); col.setHSL(h.h + (rnd() - .5) * a * .4, h.s, Math.min(.95, Math.max(.05, h.l + (rnd() - .5) * a * 2))); return col.getHex(); };
  c.m = (s) => {
    if (s && s.isMaterial) return s;
    if (typeof s !== 'object') s = { color: s };
    const key = [s.tex, s.color, s.c2, s.tile, s.side, s.basic, s.em, s.rep && s.rep.join(',')].join('|');
    let m = MAT.get(key); if (m) return m;
    const o = { color: s.color };
    if (s.tex) {
      const tile = s.tile || TILE[s.tex] || 4, tk = [s.tex, s.color, s.c2, tile, s.rep && s.rep.join(',')].join('|');
      let t = TEXC.get(tk);
      if (!t) { t = makeTexture(THREE, s.tex, s.color, s.c2); if (s.rep) t.repeat.set(s.rep[0], s.rep[1]); else t.repeat.set(1 / tile, 1 / tile); TEXC.set(tk, t); }
      o.map = t; o.color = 0xffffff; if (s.tex === 'net') o.alphaTest = .4;
    }
    if (s.side === 'double' || s.tex === 'net') o.side = THREE.DoubleSide;
    if (s.em) o.emissive = s.em;
    m = s.basic ? new THREE.MeshBasicMaterial({ color: s.color, side: o.side }) : new THREE.MeshLambertMaterial(o);
    MAT.set(key, m); return m;
  };
  c.grp = (p, name, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = name || ''; g.position.set(x, y, z); if (p) p.add(g); return g; };
  c.mesh = (p, geo, mat, x, y, z, name) => { const m = new THREE.Mesh(geo, c.m(mat)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; if (name) m.name = name; p.add(m); return m; };
  c.box = (p, w, h, d, x, y, z, mat, name) => { const geo = new THREE.BoxGeometry(w, h, d); const mm = c.m(mat); if (mm.map) worldUV(geo, x, y + h / 2, z); return c.mesh(p, geo, mm, x, y + h / 2, z, name); };
  c.cyl = (p, rt, rb, h, x, y, z, mat, seg = 8, name) => c.mesh(p, new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y + h / 2, z, name);
  c.cylH = (p, r, len, x, y, z, mat, axis = 'x', seg = 6) => { const m = c.mesh(p, new THREE.CylinderGeometry(r, r, len, seg), mat, x, y, z); if (axis === 'x') m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2; return m; };
  c.sph = (p, r, x, y, z, mat, sx = 1, sy = 1, sz = 1, seg = 8) => { const m = c.mesh(p, new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
  c.prism = (p, pts, depth, x, y, z, mat, name) => {
    const sh = new THREE.Shape(pts.map(q => new THREE.Vector2(q[0], q[1])));
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); geo.translate(0, 0, -depth / 2);
    return c.mesh(p, geo, mat, x, y, z, name);
  };
  c.rot = (m, x = 0, y = 0, z = 0) => { m.rotation.set(x, y, z); return m; };

  // ---------- крыша ----------
  c.roofGroup = (g) => { const r = c.grp(g, 'Roof'); c.roofs.push(r); return r; };
  // o: style W D ridge('x'|'z') h over overEnd y mat
  c.roof = (p, o) => {
    const rz = o.ridge === 'z', over = o.over ?? 1.3, oe = o.overEnd ?? .8;
    const mat = o.mat;
    if (o.style === 'hip') {
      const hx = o.W / 2 + over, hz = o.D / 2 + over;
      const rx = rz ? 0 : Math.max(0, hx - hz), rzz = rz ? Math.max(0, hz - hx) : 0;
      const geo = frustumGeo(THREE, hx, hz, rx, rzz, o.h);
      return c.mesh(p, geo, mat, 0, o.y, 0, 'RoofShell');
    }
    const span = (rz ? o.W : o.D) + 2 * over, len = (rz ? o.D : o.W) + 2 * oe;
    const m = c.prism(p, roofProfile(o.style, span / 2, o.h), len, 0, o.y, 0, mat, 'RoofShell');
    if (!rz) m.rotation.y = Math.PI / 2;
    return m;
  };
  // тонкая крыша из плит (ridge по z; если ridgeX — повернуть группу). hatch: люк в левом скате
  c.slabRoof = (p, o) => { // s=полуширина по x, h высота конька от y, ye высота карниза, D длина
    const g = c.grp(p, 'RoofSlabs', 0, o.y, 0), th = o.th || .6, s = o.s, ye = o.ye || 0;
    const ang = Math.atan2(o.h - ye, s), L = Math.hypot(s, o.h - ye) + (o.ext ?? 1.2);
    const mk = (side, z0, z1, par, lx) => {
      const m = c.box(par, L, th, z1 - z0, lx ?? 0, -th / 2, (z0 + z1) / 2, o.mat); return m;
    };
    for (const sd of [-1, 1]) {
      const pivot = c.grp(g, '', sd * s * .5, (ye + o.h) / 2 + 0, 0); // центр ската
      pivot.rotation.z = -sd * -ang * -1; // sd=-1: +ang ; sd=1: -ang
      pivot.rotation.z = sd < 0 ? ang : -ang;
      if (sd < 0 && o.hatch) {
        const hw = o.hatch.w, hc = o.hatch.c, D = o.D;
        mk(0, -D / 2, hc - hw / 2, pivot); mk(0, hc + hw / 2, D / 2, pivot);
        const Lh = L * .55;
        const hg = c.grp(pivot, 'RoofHatch', L / 2 - .3, 0, hc); // шарнир у конька
        const panel = c.box(hg, Lh, th, hw - .15, -Lh / 2, -th / 2, 0, o.mat);
        c.box(hg, Lh - 1, .35, .35, -Lh / 2, th / 2, 0, o.hatch.trim || 0x6b4527);
        const open = !!c.opts.doorOpen; hg.rotation.z = open ? -1.15 : 0;
        hg.userData.setOpen = b => { hg.rotation.z = b ? -1.15 : 0; };
        g.userData.hatch = hg;
        const lerpTo = { v: hg.rotation.z };
        c.anims.push(t => { const tg = hg.userData.target ?? (hg.rotation.z); });
      } else mk(0, -o.D / 2, o.D / 2, pivot);
    }
    c.box(g, .7, .7, o.D + 1.4, 0, o.h - .2, 0, o.ridge || 0x6b4527);
    return g;
  };

  // ---------- двери ----------
  c.door = (p, o) => {
    const d = c.grp(p, o.name || 'Door', o.x, o.y, o.z); c.doors.push(d);
    const w = o.w, h = o.h, th = o.th || .35, mat = o.mat || { tex: 'plank', color: 0x6b4527 };
    const open = !!c.opts.doorOpen; const parts = [];
    const panel = (g, pw, px) => {
      c.box(g, pw, h, th, px, 0, 0, mat);
      if (!o.noBrace) { c.box(g, pw - .3, .35, th + .1, px, h * .25, 0, o.brace || 0x3d2a18); c.box(g, pw - .3, .35, th + .1, px, h * .7, 0, o.brace || 0x3d2a18); }
    };
    if (o.type === 'slide') {
      const a = c.grp(d, '', 0, 0, -.18), b = c.grp(d, '', 0, 0, .18);
      panel(a, w / 2 + .15, 0); panel(b, w / 2 + .15, 0);
      d.userData.setOpen = op => { a.position.x = op ? -w * .78 : -w / 4; b.position.x = op ? w * .78 : w / 4; };
    } else if (o.leaves === 2) {
      const L = c.grp(d, '', -w / 2, 0, 0), Rr = c.grp(d, '', w / 2, 0, 0);
      panel(L, w / 2, w / 4); panel(Rr, w / 2, -w / 4);
      c.sph(L, .22, w / 2 - .5, h * .5, th, 0xc8b070); c.sph(Rr, .22, -w / 2 + .5, h * .5, th, 0xc8b070);
      d.userData.setOpen = op => { L.rotation.y = op ? -1.75 : 0; Rr.rotation.y = op ? 1.75 : 0; };
    } else {
      const H = c.grp(d, '', -w / 2, 0, 0); panel(H, w, w / 2);
      c.sph(H, .22, w - .6, h * .5, th, 0xc8b070);
      d.userData.setOpen = op => { H.rotation.y = op ? -1.75 : 0; };
    }
    d.userData.setOpen(open); return d;
  };

  // ---------- стены с проёмами ----------
  // s: W D H t y mat floorMat door{w,h,x,type,leaves,mat} wins[{side,c,w,y0,y1,shut,fill}] skip[] floor(bool) hole{x0,x1,z0,z1} corner beams
  c.shell = (p, s) => {
    const { W, D, H } = s, t = s.t || .5, y0 = s.y || 0, wm = s.mat, dr = s.door;
    const body = c.grp(p, s.name || 'Body');
    const defs = { F: { ax: 'x', f: D / 2 - t / 2, a0: -W / 2, a1: W / 2 }, B: { ax: 'x', f: -D / 2 + t / 2, a0: -W / 2, a1: W / 2 }, L: { ax: 'z', f: -W / 2 + t / 2, a0: -D / 2 + t, a1: D / 2 - t }, R: { ax: 'z', f: W / 2 - t / 2, a0: -D / 2 + t, a1: D / 2 - t } };
    const ops = { F: [], B: [], L: [], R: [] };
    const DH = dr ? dr.h + .4 : 0;
    if (dr) ops.F.push({ c: dr.x || 0, w: dr.w, y0: 0, y1: DH, door: true });
    (s.wins || []).forEach(w => ops[w.side].push(w));
    const seg = (k, a0, a1, ya, yb) => {
      if (a1 - a0 < .02 || yb - ya < .02) return; const d = defs[k];
      if (d.ax === 'x') c.box(body, a1 - a0, yb - ya, t, (a0 + a1) / 2, y0 + ya, d.f, wm); else c.box(body, t, yb - ya, a1 - a0, d.f, y0 + ya, (a0 + a1) / 2, wm);
    };
    for (const k in defs) {
      if ((s.skip || []).includes(k)) continue;
      const d = defs[k], list = ops[k].slice().sort((a, b) => a.c - b.c); let cur = d.a0;
      for (const o of list) {
        const l = o.c - o.w / 2, r = o.c + o.w / 2; seg(k, cur, l, 0, H); seg(k, l, r, 0, o.y0); seg(k, l, r, o.y1, H); cur = r;
      }
      seg(k, cur, d.a1, 0, H);
    }
    // рамка окна/двери
    const B = (k, a, yy, aw, h, dep, mat) => { const d = defs[k]; if (d.ax === 'x') c.box(body, aw, h, dep, a, y0 + yy, d.f, mat); else c.box(body, dep, h, aw, d.f, y0 + yy, a, mat); };
    const fm = s.frame || 0x5a3a20;
    for (const k in ops) for (const o of ops[k]) {
      if (o.door) {
        const x = o.c; B(k, x - o.w / 2 - .25, 0, .5, o.y1 + .3, t + .3, fm); B(k, x + o.w / 2 + .25, 0, .5, o.y1 + .3, t + .3, fm); B(k, x, o.y1, o.w + 1.2, .5, t + .45, fm);
        c.box(body, o.w + 1.8, .3, 1.6, x, y0, D / 2 + .5, s.stepMat || 0x9b958c);
      } else {
        const hh = o.y1 - o.y0, am = (o.y0 + o.y1) / 2;
        if (o.fill) B(k, o.c, o.y0, o.w, hh, .2, o.fill);
        B(k, o.c, o.y1, o.w + .6, .3, t + .3, fm); B(k, o.c, o.y0 - .3, o.w + .8, .3, t + .5, fm);
        B(k, o.c - o.w / 2 - .15, o.y0, .3, hh, t + .3, fm); B(k, o.c + o.w / 2 + .15, o.y0, .3, hh, t + .3, fm);
        if (!o.fill && o.w >= 2.4) { B(k, o.c, o.y0, .2, hh, t - .15, fm); B(k, o.c, am - .1, o.w, .2, t - .3, fm); }
        if (o.shut) { const d = defs[k]; for (const sd of [-1, 1]) { const a = o.c + sd * (o.w / 2 + o.w * .2 + .3); if (d.ax === 'x') c.box(body, o.w * .4, hh, .2, a, y0 + o.y0, d.f + (k === 'F' ? t / 2 + .15 : -t / 2 - .15), o.shut); } }
      }
    }
    if (s.corner) for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.box(body, t + .3, H, t + .3, sx * (W / 2 - t / 2), y0, sz * (D / 2 - t / 2), s.corner);
    // пол
    const fy = y0 + .4;
    if (s.floor !== false) c.slab(body, W - 2 * t, D - 2 * t, y0, .4, s.hole, s.floorMat || { tex: 'plank', color: 0x8a6038 });
    if (s.beams) for (let i = 0; i < s.beams; i++) c.box(body, W - 2 * t, .5, .5, 0, y0 + H - .5, -D / 2 + t + (i + 1) * (D - 2 * t) / (s.beams + 1), 0x5a3a20);
    if (dr) c.door(body, { x: dr.x || 0, y: y0 + .4, z: D / 2 - t / 2, w: dr.w, h: dr.h, type: dr.type, leaves: dr.leaves, mat: dr.mat, name: dr.name });
    return { body, y0, top: y0 + H, fy, W, D, t, defs, door: dr, ops, wl: s.wins || [] };
  };
  // плита с дырой (hole в координатах центра)
  c.slab = (p, W, D, y, th, hole, mat) => {
    if (!hole) return c.box(p, W, th, D, 0, y, 0, mat);
    const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2, h = hole;
    c.box(p, W, th, h.z0 - z0, 0, y, (z0 + h.z0) / 2, mat); c.box(p, W, th, z1 - h.z1, 0, y, (z1 + h.z1) / 2, mat);
    c.box(p, h.x0 - x0, th, h.z1 - h.z0, (x0 + h.x0) / 2, y, (h.z0 + h.z1) / 2, mat); c.box(p, x1 - h.x1, th, h.z1 - h.z0, (x1 + h.x1) / 2, y, (h.z0 + h.z1) / 2, mat);
  };
  // каркас фахверка по стене: k сторона, step шаг, пропускает проёмы
  c.timber = (S, k, color, step = 4.5, yb = 0, yt) => {
    const d = S.defs[k], H = (yt ?? S.top - S.y0), list = (S.ops ? S.ops[k] : []) || [];
    const t = S.t, off = k === 'F' || k === 'R' ? t / 2 + .1 : -t / 2 - .1;
    const place = (a, w, h, yy) => { if (d.ax === 'x') c.box(S.body, w, h, .2, a, S.y0 + yy, d.f + (k === 'F' ? t / 2 + .05 : -t / 2 - .05), color); else c.box(S.body, .2, h, w, d.f + (k === 'R' ? t / 2 + .05 : -t / 2 - .05), S.y0 + yy, a, color); };
    const len = d.a1 - d.a0, n = Math.max(1, Math.round(len / step));
    place((d.a0 + d.a1) / 2, len, .45, H - .45); place((d.a0 + d.a1) / 2, len, .45, yb);
    for (let i = 0; i <= n; i++) { const a = d.a0 + len * i / n; if ((S.wl || []).some(o => o.side === k && Math.abs(o.c - a) < o.w / 2 + .5) || (k === 'F' && S.door && Math.abs(a - (S.door.x || 0)) < S.door.w / 2 + .8)) continue; place(a, .45, H - yb, yb); }
  };

  // ---------- мебель ----------
  const WOOD = { tex: 'plank', color: 0x9a6a3e }, WD = 0x6b4527, ST = { tex: 'stone', color: 0x9b958c };
  c.table = (p, x, y, z, w, d, ry = 0, h = 3.1, mat = WOOD) => { const g = c.grp(p, 'Table', x, y, z); g.rotation.y = ry; c.box(g, w, .35, d, 0, h - .35, 0, mat); for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.box(g, .4, h - .35, .4, sx * (w / 2 - .4), 0, sz * (d / 2 - .4), WD); return g; };
  c.bench = (p, x, y, z, len, ry = 0, h = 1.7) => { const g = c.grp(p, 'Bench', x, y, z); g.rotation.y = ry; c.box(g, len, .3, 1.2, 0, h - .3, 0, WOOD); c.box(g, .35, h - .3, 1, -len / 2 + .5, 0, 0, WD); c.box(g, .35, h - .3, 1, len / 2 - .5, 0, 0, WD); return g; };
  c.stool = (p, x, y, z, r = .8) => { const g = c.grp(p, 'Stool', x, y, z); c.cyl(g, r, r, .3, 0, 1.4, 0, WOOD, 8); c.cyl(g, .12, .12, 1.4, 0, 0, 0, WD, 5); for (const a of [0, 2.1, 4.2]) c.cyl(g, .12, .12, 1.4, Math.cos(a) * r * .6, 0, Math.sin(a) * r * .6, WD, 5); return g; };
  c.bed = (p, x, y, z, ry = 0, blanket = 0xa8412e, len = 7, wid = 4.6) => {
    const g = c.grp(p, 'Bed', x, y, z); g.rotation.y = ry;
    c.box(g, wid, .5, len, 0, .9, 0, WOOD); for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.box(g, .45, 1.4, .45, sx * (wid / 2 - .25), 0, sz * (len / 2 - .25), WD);
    c.box(g, wid, 2.4, .4, 0, 0, -len / 2 + .2, WD);
    c.box(g, wid - .4, .7, len - .6, 0, 1.4, .1, 0xf1e6cc); c.box(g, wid - .2, .5, len * .6, 0, 1.7, len * .17, blanket);
    c.box(g, wid - 1.4, .5, 1.3, 0, 2.1, -len / 2 + 1.1, 0xfffaf0); return g;
  };
  c.fire = (p, x, y, z, s = 1) => {
    const g = c.grp(p, 'Fire', x, y, z); g.scale.setScalar(s);
    const f1 = c.mesh(g, new THREE.ConeGeometry(.8, 2.2, 6), { color: 0xff8a2a, basic: true }, 0, 1.1, 0), f2 = c.mesh(g, new THREE.ConeGeometry(.5, 1.5, 6), { color: 0xffd34a, basic: true }, 0, .8, 0);
    f1.castShadow = f2.castShadow = false; const ph = rnd() * 6;
    c.cylH(g, .22, 2.2, 0, .25, 0, WD, 'x'); c.cylH(g, .22, 2.2, 0, .25, 0, WD, 'z');
    c.anims.push(t => { const k = 1 + Math.sin(t * 11 + ph) * .14 + Math.sin(t * 17 + ph) * .08; f1.scale.set(1 / k, k, 1 / k); f2.scale.set(k, 1.1 / k, k); });
    return g;
  };
  c.firepit = (p, x, y, z, r = 1.8) => { const g = c.grp(p, 'Firepit', x, y, z); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; c.box(g, .9, .7, .9, Math.cos(a) * r, 0, Math.sin(a) * r, ST).rotation.y = a; } c.cyl(g, r, r, .15, 0, 0, 0, 0x3a332e, 8); c.fire(g, 0, .1, 0, .9); return g; };
  // камин у стены: задняя стена на локальном z=0, открыт в +z
  c.hearth = (p, x, y, z, ry = 0, w = 5.4, hh = 7.5) => {
    const g = c.grp(p, 'Hearth', x, y, z); g.rotation.y = ry;
    c.box(g, w, hh, .8, 0, 0, .4, ST); for (const sx of [-1, 1]) c.box(g, 1, 3.4, 2.6, sx * (w / 2 - .5), 0, 1.3, ST);
    c.box(g, w, 1, 2.6, 0, 3.4, 1.3, ST); c.box(g, w - 1.6, .2, 2.2, 0, 0, 1.3, 0x3a332e); c.box(g, w + .4, .4, 3, 0, 4.4, 1.4, WD);
    c.fire(g, 0, .2, 1.1, 1); return g;
  };
  c.chest = (p, x, y, z, ry = 0, s = 1) => { const g = c.grp(p, 'Chest', x, y, z); g.rotation.y = ry; g.scale.setScalar(s); c.box(g, 3, 1.6, 1.8, 0, 0, 0, WOOD); c.box(g, 3.1, .5, 1.9, 0, 1.6, 0, WD); c.box(g, .4, 2, 1.95, 0, 0, 0, 0x3b3a38); return g; };
  c.barrel = (p, x, y, z, r = 1.1, h = 2.8) => {
    const pts = []; for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push(new THREE.Vector2(r * (.82 + .18 * Math.sin(t * Math.PI)), t * h)); }
    const m = c.mesh(p, new THREE.LatheGeometry(pts, 9), 0x8a5a30, x, y, z, 'Barrel'); c.cyl(p, r * 1.0, r * 1.0, .12, x, y + h * .22, z, 0x3b3a38, 9); c.cyl(p, r * 1.0, r * 1.0, .12, x, y + h * .78, z, 0x3b3a38, 9); return m;
  };
  c.crate = (p, x, y, z, s = 1.6, ry = 0) => { const m = c.box(p, s, s, s, x, y, z, { tex: 'plank', color: 0xb98550, tile: 2 }); m.rotation.y = ry; return m; };
  c.shelf = (p, x, y, z, w, ry = 0, n = 3) => { const g = c.grp(p, 'Shelf', x, y, z); g.rotation.y = ry; c.box(g, .4, n * 2.2 + .4, .9, -w / 2, 0, 0, WD); c.box(g, .4, n * 2.2 + .4, .9, w / 2, 0, 0, WD); for (let i = 0; i < n; i++) { c.box(g, w, .3, 1, 0, .5 + i * 2.2, 0, WOOD); if (i % 2 === 0) c.cyl(g, .5, .4, .9, -w / 4, .8 + i * 2.2, 0, 0xb85a30, 7); c.box(g, .8, .9, .7, w / 4, .8 + i * 2.2, 0, 0xd8b45a); } return g; };
  c.ladder = (p, x, y, z, h, ry = 0) => { const g = c.grp(p, 'Ladder', x, y, z); g.rotation.y = ry; for (const sx of [-.6, .6]) c.box(g, .22, h, .22, sx, 0, 0, WD); for (let i = 1; i < h / 1.1; i++) c.box(g, 1.2, .18, .18, 0, i * 1.1, 0, WOOD); return g; };
  // лестница вдоль -z (поднимается к -z): n ступеней
  c.stairs = (p, x, y, z, n, w, rise, run, ry = 0) => { const g = c.grp(p, 'Stairs', x, y, z); g.rotation.y = ry; for (let i = 0; i < n; i++) c.box(g, w, rise * (i + 1), run, 0, 0, -i * run - run / 2, WOOD); return g; };
  c.rug = (p, x, y, z, w, d, col, round) => { if (round) { const m = c.cyl(p, w / 2, w / 2, .08, x, y, z, col, 14); c.cyl(p, w / 3, w / 3, .1, x, y, z, 0xe6d29a, 14); return m; } const g = c.grp(p, 'Rug', x, y, z); c.box(g, w, .08, d, 0, 0, 0, col); c.box(g, w - 1, .1, d - 1, 0, 0, 0, 0xe6d29a); return g; };
  c.cushion = (p, x, y, z, col = 0xa8412e, s = 1.6) => c.box(p, s, .5, s, x, y, z, col);
  c.pot = (p, x, y, z, s = 1, col = 0x3a332e) => c.sph(p, .9 * s, x, y + .8 * s, z, col, 1, .85, 1);
  c.counter = (p, x, y, z, w, d, ry = 0) => { const g = c.grp(p, 'Counter', x, y, z); g.rotation.y = ry; c.box(g, w, 3.2, d, 0, 0, 0, WOOD); c.box(g, w + .4, .35, d + .5, 0, 3.2, 0, WD); return g; };
  c.lantern = (p, x, y, z, col = 0xffc94a) => { const g = c.grp(p, 'Lantern', x, y, z); c.box(g, .6, .8, .6, 0, 0, 0, { color: col, basic: true }); c.box(g, .8, .15, .8, 0, .8, 0, 0x2a2a2a); c.box(g, .8, .15, .8, 0, -.15, 0, 0x2a2a2a); return g; };
  c.smoke = (p, x, y, z) => { const g = c.grp(p, 'Smoke', x, y, z), ps = []; for (let i = 0; i < 4; i++) { const m = c.sph(g, 1, 0, 0, 0, { color: 0xdedad2 }, 1, 1, 1, 6); m.castShadow = false; ps.push(m); } c.anims.push(t => ps.forEach((m, i) => { const k = ((t * .25 + i / 4) % 1); m.position.set(Math.sin(k * 5 + i) * .7, k * 7, 0); m.scale.setScalar(.5 + k * 1.3); m.material.opacity = 1; })); return g; };
  c.flag = (p, x, y, z, w, h, col, tex) => {
    const geo = new THREE.PlaneGeometry(w, h, 6, 1), m = c.mesh(p, geo, { color: col, side: 'double', tex }, x + w / 2, y + h / 2, z); m.castShadow = false;
    const pos = geo.attributes.position, x0 = []; for (let i = 0; i < pos.count; i++) x0.push(pos.getX(i));
    c.anims.push(t => { for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(t * 4 + (x0[i] + w / 2) * .9) * ((x0[i] + w / 2) / w) * .7); pos.needsUpdate = true; });
    return m;
  };
  c.boat = (p, L, B, dp, x, y, z, hull = 0x6b4527, inner = 0xb98550) => {
    const g = c.grp(p, 'Boat', x, y, z), geo = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i); pos.setXYZ(i, px, py + .35 * px * px, pz * (1 - .9 * px * px)); }
    geo.computeVertexNormals(); geo.scale(L / 2, dp, B / 2); geo.translate(0, dp * 1.02, 0);
    c.mesh(g, geo, { color: hull, side: 'double' }, 0, 0, 0, 'Hull');
    for (const sx of [-.3, .3]) c.box(g, .8, .3, B * .8, sx * L, dp * .55, 0, inner);
    return g;
  };
  for (const k_ of ['table', 'bench', 'stool', 'bed', 'chest', 'crate', 'shelf', 'counter', 'hearth', 'barrel']) { const f_ = c[k_]; if (f_) c[k_] = (...a) => { const r_ = f_(...a); if (r_) r_.userData.solid = true; return r_; }; }      // мебель — твёрдая (build-map собирает userData.solid в коллизию)
  // добавляет мебель по стенам там, где её мало: считаем твёрдые предметы на каждом этаже и добираем до нормы по площади (не трогая проход от двери и лестницы)
  c.furnish = (g) => {
    const I = []; g.traverse(o => { if (!o.isMesh && o.name === 'Interior') I.push(o); }); if (!I.length) return;
    const In = I[0]; if (Math.abs(In.rotation.y) > 1e-3) return;
    g.updateMatrixWorld(true);
    const B3 = o => new THREE.Box3().setFromObject(o), floors = [];
    const slabBox = (root, y0lim) => { const u = new THREE.Box3(); let any = false; root.traverse(m => { if (!m.isMesh) return; const b = B3(m), z = b.getSize(new THREE.Vector3()); if (z.y > .2 && z.y < .6 && z.x > 2 && z.z > 2 && (y0lim == null || Math.abs(b.min.y - y0lim) < 1)) { u.union(b); any = true; } }); return any ? u : null; };
    g.traverse(o => { if (!o.isMesh && o.name === 'Body') { const f = slabBox(o); if (f) floors.push(f); } });
    g.traverse(o => { if (!o.isMesh && o.name === 'Floor2') { const f = B3(o); if (f.max.x - f.min.x > 4) floors.push(f); } });
    const avoid = []; g.traverse(o => { if (!o.isMesh && (o.name === 'Stairs' || o.name === 'Ladder')) avoid.push(B3(o).expandByVector(new THREE.Vector3(2.4, 0, 2.4))); });
    for (const d of c.doors) { if (!d.isObject3D) continue; const b = B3(d), cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z); avoid.push(new THREE.Box3(new THREE.Vector3(cx - w / 2 - 1.8, -1e3, cz - w / 2 - 1.8), new THREE.Vector3(cx + w / 2 + 1.8, 1e3, cz + w / 2 + 1.8)).expandByVector(new THREE.Vector3(0, 0, 0))); }
    const items = () => { const r = []; In.children.forEach(ch => { const b = B3(ch), z = b.getSize(new THREE.Vector3()); if (z.y >= .6) { b.solid = !!ch.userData.solid; r.push(b); } }); return r; };
    const rect = (x, z, w, d) => new THREE.Box3(new THREE.Vector3(x - w / 2, -1e3, z - d / 2), new THREE.Vector3(x + w / 2, 1e3, z + d / 2));
    const hit2 = (a, b, pad = 0) => a.min.x < b.max.x + pad && a.max.x > b.min.x - pad && a.min.z < b.max.z + pad && a.max.z > b.min.z - pad;
    for (const F of floors) {
      const fy = F.max.y, x0 = F.min.x + 1.4, x1 = F.max.x - 1.4, z0 = F.min.z + 1.4, z1 = F.max.z - 1.4; if (x1 - x0 < 4 || z1 - z0 < 4) continue;
      const area = (x1 - x0) * (z1 - z0), want = Math.max(4, Math.min(11, Math.round(area / 32)));
      const onFloor = b => b.min.y > fy - 1.5 && b.min.y < fy + 1.2 && b.min.x < F.max.x && b.max.x > F.min.x && b.min.z < F.max.z && b.max.z > F.min.z;
      let have = items().filter(onFloor), n = have.filter(b => b.solid).length; if (n >= want) continue;
      const kinds = [['barrel', 2.4, 2.4], ['crate', 2, 2], ['chest', 3.2, 2], ['shelf', 4, 1.2], ['crate', 2, 2], ['barrel', 2.4, 2.4], ['chest', 3.2, 2], ['stool', 1.6, 1.6]];
      const spots = [];
      for (let x = x0; x <= x1; x += 2.6) { spots.push([x, z0, 0, 0]); spots.push([x, z1, Math.PI, 0]); }
      for (let z = z0; z <= z1; z += 2.6) { spots.push([x0, z, Math.PI / 2, 1]); spots.push([x1, z, -Math.PI / 2, 1]); }
      for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(c.rnd() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
      let ki = 0;
      for (const [sx, sz, ry, side] of spots) {
        if (n >= want) break;
        const [kind, kw, kd] = kinds[ki % kinds.length], w = side ? kd : kw, d = side ? kw : kd;
        const cx = side ? sx + (sx < (x0 + x1) / 2 ? kd / 2 : -kd / 2) : sx, cz = side ? sz : sz + (sz < (z0 + z1) / 2 ? kd / 2 : -kd / 2), fp = rect(cx, cz, w, d);
        if (cx - w / 2 < x0 - 1 || cx + w / 2 > x1 + 1 || cz - d / 2 < z0 - 1 || cz + d / 2 > z1 + 1) continue;
        if (have.some(b => onFloor(b) && hit2(fp, b, .9)) || avoid.some(a => hit2(fp, a) && (a.min.y < -999 ? fy < 2 : fy > a.min.y - 3 && fy < a.max.y + 3))) continue;
        const lx = cx - In.position.x, lz = cz - In.position.z, ly = fy - In.position.y;
        let m; if (kind === 'barrel') m = c.barrel(In, lx, ly, lz, 1.1, 2.6); else if (kind === 'crate') m = c.crate(In, lx, ly + .8, lz, 1.6, ry); else if (kind === 'chest') m = c.chest(In, lx, ly, lz, ry); else if (kind === 'shelf') m = c.shelf(In, lx, ly, lz, 3.4, ry, 3); else m = c.stool(In, lx, ly, lz);
        ki++; n++; g.updateMatrixWorld(true); have = items();
      }
    }
  };
  // мебель наверху не должна перекрывать лестницу: убираем предметы верхнего этажа над проёмом и на выходе (по ходу подъёма), иначе кровать/стол мешают спуститься
  c.clearStairs = (g) => {
    const I = []; g.traverse(o => { if (!o.isMesh && o.name === 'Interior') I.push(o); });
    const st = []; g.traverse(o => { if (!o.isMesh && o.name === 'Stairs') st.push(o); });
    g.updateMatrixWorld(true);
    for (const S of st) {
      const sb = new THREE.Box3().setFromObject(S); if (sb.max.y < 6) continue;
      let lo = null, hi = null; S.children.forEach(ch => { const b = new THREE.Box3().setFromObject(ch), cy = b.max.y; if (!lo || cy < lo.y) lo = { y: cy, b }; if (!hi || cy > hi.y) hi = { y: cy, b }; });
      const zone = [sb.clone().expandByVector(new THREE.Vector3(1, 0, 1))];
      if (lo && hi){ const lc = lo.b.getCenter(new THREE.Vector3()), hc = hi.b.getCenter(new THREE.Vector3()), d = new THREE.Vector3(hc.x - lc.x, 0, hc.z - lc.z); if (d.lengthSq() > 1e-4){ d.normalize(); const c = hc.clone().addScaledVector(d, 3); zone.push(new THREE.Box3(new THREE.Vector3(c.x - 2.6, -1e3, c.z - 2.6), new THREE.Vector3(c.x + 2.6, 1e3, c.z + 2.6))); } }
      for (const In of I) for (const ch of [...In.children]) {
        const b = new THREE.Box3().setFromObject(ch); if (b.min.y < sb.max.y - 2 || b.getSize(new THREE.Vector3()).y < .6) continue;      // только верхний этаж
        if (zone.some(z => b.min.x < z.max.x && b.max.x > z.min.x && b.min.z < z.max.z && b.max.z > z.min.z)) ch.removeFromParent();
      }
    }
  };
  c.done = (g) => {
    try { c.clearStairs(g); } catch (e) { /* необязательно */ }
    try { c.furnish(g); } catch (e) { /* автомебель необязательна */ }
    g.userData.doors = c.doors; g.userData.roofs = c.roofs;
    g.userData.animate = (t) => { for (const f of c.anims) f(t); };
    g.userData.setDoorOpen = (b) => c.doors.forEach(d => d.userData.setOpen(b));
    g.userData.setRoofVisible = (b) => c.roofs.forEach(r => r.visible = b);
    return g;
  };
  c.root = () => new THREE.Group();
  return c;
}

// ================= общие вещи моделей =================
const RED = 0xa8412e, WOODC = 0x9a6a3e, WOODL = 0xb98550, WOODD = 0x6b4527, STONEC = 0x9b958c, STRAW = 0xd8b45a;
const win = (side, cc, w = 3, y0 = 4.5, y1 = 7.8, extra) => Object.assign({ side, c: cc, w, y0, y1 }, extra);
const tileRoof = (c, col = RED) => ({ tex: 'tile', color: c.vary(col), side: 'double' });
const setup = (THREE, seed, opts) => { const c = ctx(THREE, seed, opts || {}); return [c, c.root()]; };

function basicInterior(c, g, S, o = {}) {
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = S.W / 2 - S.t, hz = S.D / 2 - S.t;
  c.hearth(I, o.hx ?? 0, fy, -hz, 0);
  c.bed(I, -hx + 2.6, fy, -hz + 4.2, 0, o.blanket ?? RED);
  c.table(I, hx - 4.5, fy, 1, 5, 3, 0); c.bench(I, hx - 4.5, fy, 3.4, 4.5); c.stool(I, hx - 4.5, fy, -1.3);
  c.chest(I, hx - 2, fy, -hz + 1.3); c.barrel(I, -hx + 1.5, fy, hz - 1.5); c.crate(I, -hx + 1.3, fy, hz - 3.6);
  c.lantern(I, hx - 4.5, fy + 3.1, 1);
  return I;
}
// двухэтажный каркас: нижний + плита с дырой + верхний
function twoStory(c, g, o) {
  const sl = .5;
  const S1 = c.shell(g, { W: o.W, D: o.D, H: o.h1 - sl, mat: o.mat1, door: o.door, wins: o.wins1, floorMat: o.floorMat, corner: o.corner1, name: 'Body' });
  const W2 = o.W + 2 * (o.jet || 0), D2 = o.D + 2 * (o.jet || 0);
  const F2 = c.grp(g, 'Floor2'); c.slab(F2, W2, D2, o.h1 - sl, sl, o.hole, o.slabMat || { tex: 'plank', color: 0x6b4527 });
  const S2 = c.shell(g, { W: W2, D: D2, H: o.h2, y: o.h1, mat: o.mat2, floor: false, door: o.door2 || false, wins: o.wins2, corner: o.corner2, name: 'Upper' });
  S2.fy = o.h1;
  return { S1, S2, W2, D2, top: o.h1 + o.h2 };
}
function stairHole(c, I, S, xs, zStart, n, w, h1) {
  w = Math.max(w, 5);      // ширина лестницы и проёма не меньше 5 (игрок 2.2 + запас)
  const L0 = n * .85; n = Math.ceil((h1 - .4) / .5);      // подъём ступени ≤ .5 (после увеличения дома ×2.3 ≤ 1.2 < шага игры 1.55), длина лестницы прежняя
  const rise = (h1 - .4) / n, run = L0 / n;
  c.stairs(I, xs, .4, zStart, n, w, rise, run);
  const zEnd = zStart - n * run;
  return { x0: xs - w / 2, x1: xs + w / 2, z0: zEnd, z1: zEnd + n * run * .97 };      // проём над всей лестницей (раньше .55: головой в плиту упирались уже на середине — рост 9)
}
const timberAll = (c, S, col, step, yb = 0) => ['F', 'B', 'L', 'R'].forEach(k => c.timber(S, k, col, step, yb));

// ================= 1. простые хижины =================
function hutThatch(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(18), D = c.s(16), H = 10.6;
  const S = c.shell(g, { W, D, H, mat: { tex: 'plaster', color: c.vary(0xd9c28f) }, door: { w: 5, h: 8.8 }, wins: [win('L', -1), win('R', -1), win('F', -5.8, 3, 4.5, 7.8, { shut: WOODD }), win('B', 4)], corner: WOODD, beams: 3 });
  const R = c.roofGroup(g);
  c.roof(R, { style: 'thatch', W, D, ridge: 'x', h: 7.5, over: 1.8, overEnd: 1.4, y: H, mat: { tex: 'thatch', color: c.vary(STRAW), side: 'double' } });
  c.cylH(R, .6, W + 3.4, 0, H + 7.3, 0, 0xb08a3a, 'x', 6);
  basicInterior(c, g, S);
  for (let i = 0; i < 6; i++) c.cylH(g, .5, 3, W / 2 + 2, .5 + (i > 2 ? 1 : 0) * .9, -3 + (i % 3) * 1.0 + (i > 2 ? .5 : 0), WOODC, 'z', 6);
  return c.done(g);
}
function hutLog(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(20), D = c.s(16), H = 10.6;
  const S = c.shell(g, { W, D, H, mat: { tex: 'log', color: c.vary(WOODC) }, door: { w: 5, h: 8.8 }, wins: [win('L', 0, 3.5), win('R', 0, 3.5), win('F', -6.5), win('F', 6.5)], beams: 3 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let k = 0; k < 7; k++) c.cylH(g, .45, 1.8, sx * (W / 2 - .2), .6 + k * 1.5, sz * (D / 2 - .25), k % 2 ? WOODL : WOODC, 'x', 6);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'gable', W, D, ridge: 'x', h: 6.5, over: 1.5, overEnd: 1, y: H, mat: { tex: 'tile', color: c.vary(WOODD), side: 'double' } });
  c.cylH(R, .45, W + 3, 0, H + 6.5, 0, WOODL, 'x', 6);
  const P = c.grp(g, 'Porch');
  for (const sx of [-1, 1]) c.cyl(P, .4, .4, 9.5, sx * 4.8, 0, D / 2 + 3.2, WOODC, 6);
  const pr = c.box(P, 11.5, .4, 4.4, 0, 0, 0, { tex: 'plank', color: WOODD, side: 'double' }); pr.position.set(0, 10.1, D / 2 + 1.9); pr.rotation.x = .2;
  c.box(P, 11.5, .4, 4, 0, 0, D / 2 + 2.2, { tex: 'plank', color: 0x8a6038 });
  basicInterior(c, g, S, { blanket: 0x2f9ec4 });
  return c.done(g);
}
function hutStone(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(18), D = c.s(15), H = 10.4;
  const S = c.shell(g, { W, D, H, t: .6, mat: { tex: 'stone', color: c.vary(STONEC) }, door: { w: 5, h: 8.8 }, frame: 0x6b665f, wins: [win('L', 0, 1.6, 5, 8), win('R', 0, 1.6, 5, 8), win('F', -6, 1.6, 5, 8), win('F', 6, 1.6, 5, 8)], beams: 3, floorMat: { tex: 'stone', color: 0x7d776e } });
  c.box(g, 4.2, H + 5.5, 2, 0, 0, -D / 2 - .9, { tex: 'stone', color: 0x8a847b }); c.box(g, 5, .6, 2.8, 0, H + 5.5, -D / 2 - .9, 0x6b665f);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'gable', W, D, ridge: 'x', h: 5, over: 1.2, overEnd: .9, y: H, mat: { tex: 'thatch', color: c.vary(0x6ea848), side: 'double' } });
  for (let i = 0; i < 7; i++) c.sph(R, .35, (c.rnd() - .5) * W * .9, H + 1 + c.rnd() * 3, (c.rnd() - .5) * D * .6, c.pick([0xf2c94a, 0xe86a8a, 0xffffff]), 1, 1, 1, 5);
  basicInterior(c, g, S, { blanket: 0x2f9ec4 });
  return c.done(g);
}
function hutStilts(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(17), D = c.s(14), H = 10.2, B = 3.5;
  const S = c.shell(g, { W, D, H, y: B, mat: { tex: 'plank', color: c.vary(WOODL) }, door: { w: 5, h: 8.8 }, wins: [win('L', 0), win('R', 0), win('F', -6), win('F', 6), win('B', 0)], corner: WOODD, floorMat: { tex: 'plank', color: 0x8a6038 } });
  const P = c.grp(g, 'Piles');
  for (const x of [-7.6, 0, 7.6]) for (const z of [-5.5, 5.5]) c.cyl(P, .55, .65, B + .4, x, 0, z, WOODD, 7);
  for (const z of [-5.5, 5.5]) c.box(P, W - 1, .4, .4, 0, 1.6, z, WOODC);
  const dk = c.grp(g, 'Deck'); c.box(dk, W + 2, .4, 5.5, 0, B, D / 2 + 2.6, { tex: 'plank', color: 0xa87a4a });
  for (const x of [-W / 2 - .8, W / 2 + .8]) for (const z of [D / 2 + 1, D / 2 + 5]) c.cyl(dk, .35, .35, 4.2, x, 0, z, WOODD, 6);
  for (const sx of [-1, 1]) c.box(dk, .25, .3, 5.2, sx * (W / 2 + .8), B + 2.6, D / 2 + 3, WOODC);
  c.box(dk, W + 2, .3, .25, 0, B + 2.6, D / 2 + 5.3, WOODC);
  const n = 7, rise = (B + .4) / n; for (let i = 0; i < n; i++) c.box(dk, 6, rise * (i + 1), 1, 0, 0, D / 2 + 5.5 + (n - 1 - i) * 1 + 0.0, { tex: 'plank', color: 0xa87a4a });
  // ступени: нижняя дальше от дома
  const R = c.roofGroup(g);
  c.roof(R, { style: 'hip', W, D, h: 8.5, over: 2.4, y: B + H, mat: { tex: 'thatch', color: c.vary(0xc9a24c), side: 'double' } });
  c.sph(R, .7, 0, B + H + 8.6, 0, 0xb08a3a, 1, 1.4, 1, 6);
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .5;
  c.firepit(I, 0, fy, -1, 1.6); c.bed(I, -hx + 2.6, fy, -D / 2 + 4.2, 0, 0x2f9ec4); c.table(I, hx - 3.2, fy, -1, 4, 3, 0, 2.2); c.cushion(I, hx - 3.2, fy, 2, 0xe0a030); c.chest(I, hx - 2, fy, -D / 2 + 1.5);
  c.pot(I, -hx + 1.5, fy, 4, 1.1); c.barrel(I, hx - 1.5, fy, D / 2 - 1.5);
  return c.done(g);
}
function hutChimney(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(19), D = c.s(15), H = 10.6;
  const S = c.shell(g, { W, D, H, mat: { tex: 'plaster', color: c.vary(0xeadfc5) }, door: { w: 5, h: 8.8 }, wins: [win('L', 0), win('F', -6, 3, 4.5, 7.8, { shut: 0x2f9ec4 }), win('F', 6, 3, 4.5, 7.8, { shut: 0x2f9ec4 }), win('B', 0)], beams: 3 });
  timberAll(c, S, WOODD, 4.6);
  c.box(g, 2.6, H + 9, 4, W / 2 + 1.1, 0, 0, { tex: 'stone', color: 0x9b958c }); c.box(g, 3.4, .6, 4.8, W / 2 + 1.1, H + 9, 0, 0x6b665f);
  c.smoke(g, W / 2 + 1.1, H + 9.8, 0);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'gable', W, D, ridge: 'x', h: 6.5, over: 1.4, overEnd: 1, y: H, mat: tileRoof(c) });
  const I = basicInterior(c, g, S); c.hearth(I, W / 2 - .5, S.fy, 0, -Math.PI / 2);
  return c.done(g);
}
function hutTwoFloor(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(14), D = c.s(13), h1 = 10.9, h2 = 9;
  const I = c.grp(g, 'Interior');
  const hole = stairHole(c, I, null, -W / 2 + .5 + 2.8, D / 2 - 4.5, 10, 3.2, h1);
  const T = twoStory(c, g, { W, D, h1, h2, jet: .8, mat1: { tex: 'plank', color: c.vary(WOODL) }, mat2: { tex: 'plaster', color: 0xe8dcc0 }, door: { w: 5, h: 8.8 }, wins1: [win('L', 2), win('R', 0), win('F', 4.3, 2.4, 4.5, 7.8)], wins2: [win('F', -3.5), win('F', 3.5), win('L', 0), win('R', 0), win('B', 0)], hole, corner1: WOODD });
  timberAll(c, T.S2, WOODD, 4.2);
  const fy = .4, hx = W / 2 - .5, hz = D / 2 - .5;
  c.hearth(I, 2, fy, -hz, 0); c.table(I, 3.5, fy, 1.5, 4.5, 3, 0); c.bench(I, 3.5, fy, 3.5, 4.5); c.barrel(I, hx - 1.2, fy, -hz + 5.5); c.crate(I, hx - 1.2, fy, hz - 1.2);
  const up = T.S2.fy, wx = T.W2 / 2 - .5;
  c.bed(I, wx - 2.8, up, -T.D2 / 2 + 4.2, 0, 0x2f9ec4); c.bed(I, wx - 8, up, -T.D2 / 2 + 4.2, 0, RED); c.chest(I, 2, up, T.D2 / 2 - 1.5); c.shelf(I, 3, up, -T.D2 / 2 + .8, 5);
  c.rail = null;
  const R = c.roofGroup(g);
  c.roof(R, { style: 'gable', W: T.W2, D: T.D2, ridge: 'z', h: 8, over: .8, overEnd: 1.2, y: T.top, mat: tileRoof(c) });
  return c.done(g);
}

// ================= 2. большие дома / таверны =================
function bigHall(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(34), D = c.s(16), H = 11.2;
  const S = c.shell(g, { W, D, H, mat: { tex: 'plank', color: c.vary(0x8a6038) }, door: { w: 6.4, h: 9, leaves: 2 }, wins: [win('F', -8), win('F', 8), win('F', -13), win('F', 13), win('L', 0, 3.5), win('R', 0, 3.5), win('B', -8), win('B', 8)], corner: WOODD, beams: 5 });
  timberAll(c, S, WOODD, 5.5);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'gable', W, D, ridge: 'x', h: 7.2, over: 1.6, overEnd: 1.2, y: H, mat: tileRoof(c, 0x7a3a2a) });
  for (const sx of [-1, 1]) for (const s of [-1, 1]) c.rot(c.box(R, .6, 4.5, .6, sx * (W / 2 + 1.1), H + 7.2, 0, WOODD), 0, 0, s * .6);
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .5;
  c.hearth(I, -8, fy, -D / 2 + .5, 0); c.hearth(I, 8, fy, -D / 2 + .5, 0, 5.4);
  c.firepit(I, 0, fy, -3.5, 1.6);
  for (const x of [-10, 10]) { c.table(I, x, fy, 2, 10, 3, 0); c.bench(I, x, fy, 4.2, 9.5); c.bench(I, x, fy, -.2, 9.5); }
  for (const x of [-hx + 2.6, hx - 2.6]) c.bed(I, x, fy, -D / 2 + 4.8, 0, c.pick([RED, 0x2f9ec4]));
  c.bed(I, -hx + 8, fy, -D / 2 + 4.8, 0, 0x6ea848); c.bed(I, hx - 8, fy, -D / 2 + 4.8, 0, 0xe0a030);
  for (let i = 0; i < 4; i++) c.barrel(I, 14 + (i % 2) * 2.3, fy, 5.5 - Math.floor(i / 2) * 2.3);
  c.chest(I, -14, fy, 6); c.lantern(I, 0, fy + 8, 0);
  for (let i = 0; i < 5; i++) { const sh = c.cyl(I, 1.3, 1.3, .25, -10 + i * 5, 6.5, -D / 2 + 1.05, i % 2 ? RED : 0x2f9ec4, 10); sh.rotation.x = Math.PI / 2; }
  return c.done(g);
}
function tavern(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(26), D = c.s(20), h1 = 11.9, h2 = 9.5;
  const I = c.grp(g, 'Interior');
  const hole = stairHole(c, I, null, -W / 2 + .5 + 2.8, D / 2 - 3, 12, 3.6, h1);
  const T = twoStory(c, g, { W, D, h1, h2, jet: .9, mat1: { tex: 'plaster', color: 0xe9dcc0 }, mat2: { tex: 'plaster', color: 0xe9dcc0 }, door: { w: 6.4, h: 9, leaves: 2, x: 2 }, wins1: [win('F', -6), win('F', 9.5), win('L', 3), win('R', -3), win('R', 5)], wins2: [win('F', -8), win('F', -2.5), win('F', 3), win('F', 8.5), win('L', 0), win('R', 0), win('B', 0)], hole });
  timberAll(c, T.S1, WOODD, 4.6); timberAll(c, T.S2, WOODD, 4.6);
  const fy = .4, hx = W / 2 - .5;
  c.hearth(I, 0, fy, -D / 2 + .5, 0, 6); c.counter(I, hx - 2.2, fy, 1, 3.4, 12);
  for (let i = 0; i < 3; i++) c.barrel(I, 6 + i * 2.4, fy, -D / 2 + 1.6);
  c.shelf(I, hx - .9, fy + 3.5, 4, 6, -Math.PI / 2, 2);
  for (const [x, z] of [[-3, 2], [3, 0], [-2, -4]]) { c.table(I, x, fy, z, 4, 3, 0, 3); c.stool(I, x - 3, fy, z); c.stool(I, x + 3, fy, z); }
  const up = T.S2.fy;
  for (let i = 0; i < 3; i++) c.bed(I, T.W2 / 2 - 3 - i * 6.5, up, -T.D2 / 2 + 4.6, 0, c.pick([RED, 0x2f9ec4, 0x6ea848]));
  c.chest(I, 3, up, T.D2 / 2 - 1.5); c.table(I, 4, up, 2, 4, 3);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'gable', W: T.W2, D: T.D2, ridge: 'x', h: 8.5, over: 1.2, overEnd: 1.2, y: T.top, mat: tileRoof(c, 0x8a3a2a) });
  c.box(R, 3, 5, 3, 7, T.top + 4, -3, STONEC);
  // вывеска
  const sg = c.grp(g, 'Sign', -W / 2 - .5, 0, T.D2 / 2 + 1);
  c.box(sg, .3, .3, 3.4, 0, 9.8, -1.5, 0x3b3a38).position.x = 0; c.cyl(sg, .2, .2, 10, 0, 0, 0, 0x3b3a38, 5);
  const sw = c.grp(sg, 'SignSwing', 0, 9.8, -2.7); c.box(sw, .3, 2.6, 3, 0, -3, 0, { tex: 'plank', color: WOODL }); c.sph(sw, .7, 0, -1.5, 0, 0xe0a030, 1, 1, 1, 6);
  const ph = c.rnd() * 3; c.anims.push(t => { sw.rotation.x = Math.sin(t * 1.6 + ph) * .1; });
  return c.done(g);
}
function manor(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(26), D = c.s(18), H = 12, tw = 10, td = 11, TH = 11, TH2 = 9;
  const tx = -(W / 2 + tw / 2 - .5), tz = -D / 2 + td / 2 - .4;
  const mat = { tex: 'plaster', color: c.vary(0xe6dcc0) };
  const S = c.shell(g, { W, D, H, mat, door: { w: 6, h: 9, leaves: 2 }, wins: [win('F', -8), win('F', 8), win('R', -3), win('R', 3), win('B', 0, 3), win('L', 4, 3), { side: 'L', c: tz, w: 5, y0: 0, y1: 9.2 }], corner: 0x8a847b });
  timberAll(c, S, WOODD, 5.2, 0);
  const Tw = c.grp(g, 'Tower', tx, 0, tz), mt = { tex: 'stone', color: 0xa39d92 };
  const t1 = c.shell(Tw, { W: tw, D: td, H: TH, mat: mt, door: false, skip: ['R'], wins: [win('L', 0, 2.2, 5, 8), win('B', 0, 2.2, 5, 8), win('F', 0, 2.2, 5, 8)], name: 'TowerLow', floorMat: { tex: 'stone', color: 0x7d776e } });
  const Hh = { x0: -2.5, x1: -.5, z0: -1.6, z1: 1.6 };
  c.slab(c.grp(Tw, 'TowerFloor2'), tw, td, TH, .5, Hh, WOODD);
  const t2 = c.shell(Tw, { W: tw, D: td, H: TH2, y: TH + .5, mat: mt, floor: false, door: false, skip: ['R'], wins: [win('L', 0, 2.2, 3.5, 7), win('B', 0, 2.2, 3.5, 7), win('F', 0, 2.2, 3.5, 7)], name: 'TowerUp' });
  c.ladder(Tw, -1.5, .4, 1.9, TH + .9, Math.PI);
  const I = c.grp(g, 'Interior'), fy = .4, hx = W / 2 - .5;
  c.hearth(I, 3, fy, -D / 2 + .5, 0, 6); c.table(I, 2, fy, 1, 11, 3.2); for (const s of [-1, 1]) { c.bench(I, 2, fy, 1 + s * 2.4, 10); }
  c.rug(I, 2, fy, 1, 15, 8, 0x8a2a2a); c.shelf(I, hx - .9, fy, 0, 8, -Math.PI / 2, 4); c.shelf(I, -hx + .9, fy, -6, 6, Math.PI / 2, 4); c.bed(I, hx - 3, fy, -D / 2 + 4.5, 0, 0x2f9ec4); c.chest(I, -4, fy, -D / 2 + 1.4);
  c.bed(Tw, 2.8, TH + .5, -td / 2 + 4.6, 0, 0xe0a030); c.chest(Tw, -3.4, TH + .5, 3); c.table(Tw, 1, .4, 2, 3.5, 3.5, 0, 3);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'gable', W, D, ridge: 'x', h: 8.5, over: 1.3, overEnd: 1, y: H, mat: tileRoof(c, 0x7a3a2a) });
  const tr = c.grp(R, 'TowerRoof', tx, TH + TH2 + .5, tz);
  c.mesh(tr, new c.THREE.ConeGeometry(7.6, 10.5, 12), { tex: 'tile', color: 0x3b7a9a, side: 'double', rep: [4, 2] }, 0, 5.25, 0);
  c.cyl(tr, .15, .15, 3, 0, 10.4, 0, 0x3b3a38, 4); c.flag(tr, 0, 12, 0, 3, 1.6, RED);
  return c.done(g);
}
function inn(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(30), D = c.s(20), H = 11.6;
  const S = c.shell(g, { W, D, H, mat: { tex: 'plaster', color: c.vary(0xe8d7ae) }, door: { w: 6.4, h: 9, leaves: 2 }, wins: [win('F', -8), win('F', 8), win('F', -12.5), win('F', 12.5), win('L', 0, 3.5), win('R', 0, 3.5), win('B', -8), win('B', 8)], corner: WOODD, beams: 5 });
  timberAll(c, S, WOODD, 5);
  const P = c.grp(g, 'Porch'); c.box(P, W - 2, .4, 7, 0, 0, D / 2 + 3.9, { tex: 'plank', color: 0xa87a4a });
  for (let i = 0; i < 6; i++) c.cyl(P, .5, .5, 10.5, -W / 2 + 2.5 + i * (W - 5) / 5, .4, D / 2 + 7, WOODD, 6);
  c.box(P, W - 1, .6, .6, 0, 10.8, D / 2 + 7, WOODD);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'hip', W, D, h: 8.2, over: 1.8, y: H, mat: tileRoof(c, 0xa8412e) });
  const pr = c.box(R, W - 1, .5, 8, 0, -.25, 0, tileRoof(c, 0xa8412e)); pr.position.set(0, 10.9 + 1.1, D / 2 + 4); pr.rotation.x = -.34 * 0 + .3;
  const sg = c.grp(P, 'Sign', 9, 9.2, D / 2 + 7); c.box(sg, 4, 1.8, .3, 0, -2.4, 0, { tex: 'plank', color: WOODL }); c.cyl(sg, .08, .08, 1, -1.6, -.6, 0, 0x3b3a38, 4); c.cyl(sg, .08, .08, 1, 1.6, -.6, 0, 0x3b3a38, 4);
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .5;
  c.hearth(I, 0, fy, -D / 2 + .5, 0, 6); c.counter(I, -hx + 2, fy, 3, 3.2, 12);
  for (let i = 0; i < 3; i++) c.barrel(I, -hx + 1.4 + i * 2.2, fy, -5);
  for (let i = 0; i < 4; i++) c.bed(I, hx - 3 - i * 6, fy, -D / 2 + 4.5, 0, c.pick([RED, 0x2f9ec4, 0x6ea848, 0xe0a030]));
  for (const [x, z] of [[-6, 1], [-6, -4], [7, 3]]) { c.table(I, x, fy, z, 5, 3); c.bench(I, x, fy, z + 2.2, 4.5); c.bench(I, x, fy, z - 2.2, 4.5); }
  c.chest(I, hx - 2, fy, 6);
  const cart = c.grp(g, 'Cart', W / 2 + 6, 0, 4); c.box(cart, 7, .5, 4, 0, 2.2, 0, WOODC); for (const s of [-1, 1]) { const w = c.cyl(cart, 2.2, 2.2, .4, 0, 0, 0, WOODD, 10); w.rotation.x = Math.PI / 2; w.position.set(0, 2.2, s * 2.3); } c.box(cart, 7, 1, .3, 0, 2.7, 2, WOODL); c.box(cart, 7, 1, .3, 0, 2.7, -2, WOODL);
  return c.done(g);
}

// ================= 3. дома горожан =================
function townInterior(c, I, W, D, h1, xs, T, extra) {
  const fy = .4, hz = D / 2 - .5, hx = W / 2 - .5;
  c.hearth(I, hx - 4, fy, -hz, 0, 5); c.table(I, 1, fy, 0, 4.6, 3); c.stool(I, -1.8, fy, 0); c.stool(I, 3.8, fy, 0); c.barrel(I, hx - 1.2, fy, hz - 1.2); c.chest(I, hx - 2, fy, -hz + 5);
  const up = T.S2.fy, wx = T.W2 / 2 - .5;
  c.bed(I, wx - 2.8, up, -T.D2 / 2 + 4.4, 0, 0xa8412e); c.chest(I, 0, up, -T.D2 / 2 + 1.4); c.table(I, 0, up, 2, 4, 3); if (T.W2 > 14) c.bed(I, wx - 8, up, -T.D2 / 2 + 4.4, 0, 0x2f9ec4);
  if (extra) extra();
}
function townNarrow(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(12), D = c.s(17), h1 = 10.9, h2 = 9.4, I = c.grp(g, 'Interior');
  const hole = stairHole(c, I, null, -W / 2 + .5 + 2.8, D / 2 - 4.5, 10, 3.2, h1);
  const col = c.pick([0xd98a6a, 0xe0b26a, 0xcf7f6f]);
  const T = twoStory(c, g, { W, D, h1, h2, jet: .6, mat1: { tex: 'plaster', color: c.vary(col) }, mat2: { tex: 'plaster', color: c.vary(col) }, door: { w: 5, h: 8.8, x: 1.2 }, wins1: [win('F', -3.4, 2.2), win('L', 0), win('R', 0)], wins2: [win('F', -2.6), win('F', 2.6), win('L', 0), win('R', 0), win('B', 0)], hole, corner1: 0xeadfc5, corner2: 0xeadfc5 });
  townInterior(c, I, W, D, h1, 0, T);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'gable', W: T.W2, D: T.D2, ridge: 'z', h: 9.5, over: .7, overEnd: 1.1, y: T.top, mat: tileRoof(c, 0x6b4527) });
  const fillM = c.m({ tex: 'plaster', color: col });
  c.prism(R, [[-T.W2 / 2 - .6, 0], [T.W2 / 2 + .6, 0], [0, 9.5 * 1.0]], .3, 0, T.top, T.D2 / 2 + 1.2, fillM);
  c.sph(R, .6, 0, T.top + 5.4, T.D2 / 2 + 1.45, 0xf1e6cc, 1, 1, .3, 8);
  c.box(R, 1.4, 1.2, 1.4, -2, T.top + 7, -3, STONEC); c.box(R, 1.6, .3, 1.6, -2, T.top + 8.2, -3, 0x6b665f);
  return c.done(g);
}
function townWide(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(24), D = c.s(14), h1 = 10.9, h2 = 9.4, I = c.grp(g, 'Interior');
  const hole = stairHole(c, I, null, -W / 2 + .5 + 2.8, D / 2 - 3.8, 10, 3.2, h1);
  const col = c.pick([0xe8c878, 0xe8d7ae]);
  const T = twoStory(c, g, { W, D, h1, h2, jet: .5, mat1: { tex: 'plaster', color: c.vary(col) }, mat2: { tex: 'plaster', color: c.vary(col) }, door: { w: 5, h: 8.8, x: -3 }, wins1: [win('F', -9, 3), win('F', 4, 3.2), win('F', 9, 3.2), win('R', 0), win('B', -5), win('B', 5)], wins2: [win('F', -9), win('F', -3), win('F', 3), win('F', 9), win('L', 0), win('R', 0), win('B', -5), win('B', 5)], hole, corner1: 0xeadfc5, corner2: 0xeadfc5 });
  townInterior(c, I, W, D, h1, 0, T);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'hip', W: T.W2, D: T.D2, h: 8, over: 1.3, y: T.top, mat: tileRoof(c, 0xa8412e) });
  for (const x of [-6, 7]) { c.box(R, 2, 4, 2, x, T.top + 4.5, 0, STONEC); c.box(R, 2.5, .4, 2.5, x, T.top + 8.5, 0, 0x6b665f); }
  c.smoke(R, 7, T.top + 9, 0);
  return c.done(g);
}
function townMansard(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(15), D = c.s(15), h1 = 10.9, h2 = 9.4, I = c.grp(g, 'Interior');
  const hole = stairHole(c, I, null, -W / 2 + .5 + 2.8, D / 2 - 4, 10, 3.2, h1);
  const T = twoStory(c, g, { W, D, h1, h2, jet: 0, mat1: { tex: 'stone', color: 0xcfc6b0 }, mat2: { tex: 'plaster', color: 0xe6dcc0 }, door: { w: 5, h: 8.8 }, wins1: [win('F', -4.5), win('F', 4.5), win('L', 0), win('R', 0)], wins2: [win('F', -4.5), win('F', 4.5), win('L', 0), win('R', 0), win('B', 0)], hole, corner2: 0xcfc6b0 });
  townInterior(c, I, W, D, h1, 0, T);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'mansard', W, D, ridge: 'x', h: 9, over: .8, overEnd: .6, y: T.top, mat: { tex: 'tile', color: 0x5b6770, side: 'double' } });
  for (const x of [-4.8, 0, 4.8]) {
    const dz = D / 2 + .8 - 2.2; // dormer on front slope
    c.box(R, 3, 3.2, 2.4, x, T.top + 1.2, D / 2 - .6, 0xe6dcc0); c.box(R, 1.8, 1.8, .2, x, T.top + 1.9, D / 2 + .65, 0x2a2a30);
    c.prism(R, [[-1.9, 0], [1.9, 0], [0, 1.7]], 2.8, x, T.top + 4.4, D / 2 - .6, tileRoof(c, 0x3f4a52)).rotation.y = 0;
  }
  c.box(R, 1.8, 3, 1.8, 5, T.top + 7, -4, STONEC);
  return c.done(g);
}
function townShop(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(18), D = c.s(14), h1 = 10.9, h2 = 9, I = c.grp(g, 'Interior');
  const hole = stairHole(c, I, null, -W / 2 + .5 + 2.8, D / 2 - 3.5, 10, 3.2, h1);
  const T = twoStory(c, g, { W, D, h1, h2, jet: .6, mat1: { tex: 'plank', color: c.vary(WOODL) }, mat2: { tex: 'plaster', color: 0xe8dcc0 }, door: { w: 5, h: 8.8, x: -4.5 }, wins1: [win('F', 3.8, 7, 3, 8.2), win('R', 0), win('B', 0)], wins2: [win('F', -4), win('F', 4), win('L', 0), win('R', 0)], hole, corner1: WOODD });
  const fy = .4;
  c.counter(I, 3.8, fy, D / 2 - 2.6, 8, 2); c.shelf(I, 0, fy, -D / 2 + .8, 9, 0, 3); c.shelf(I, 6, fy, -D / 2 + .8, 5, 0, 3);
  c.barrel(I, W / 2 - 1.4, fy, -2); c.barrel(I, W / 2 - 1.4, fy, 0.5); c.crate(I, W / 2 - 1.3, fy, 3.5); c.crate(I, W / 2 - 1.3, fy + 1.6, 3.5, 1.2);
  c.hearth(I, W / 2 - 4, fy, -D / 2 + .5 + 0, 0, 4.4).position.x = W / 2 - 4;
  const up = T.S2.fy; c.bed(I, 4, up, -T.D2 / 2 + 4.4, 0, RED); c.chest(I, -1, up, -T.D2 / 2 + 1.4); c.table(I, 3, up, 3, 4, 3);
  // навес
  const aw = c.grp(g, 'Awning', 0, 0, D / 2 + .3); const ap = c.box(aw, W - 2, .3, 4.6, 0, 0, 0, { tex: 'stripe', color: RED, c2: 0xf1e6cc, side: 'double' }); ap.position.set(0, 9.4, 2.1); ap.rotation.x = .3;
  for (const s of [-1, 1]) c.cyl(aw, .2, .2, 8.6, s * (W / 2 - 1.2), 0, 4, WOODD, 5);
  c.barrel(g, W / 2 + 1.2, 0, D / 2 + 1.5); c.crate(g, W / 2 + 3.6, 0, D / 2 + 1.5, 1.6);
  const sg = c.grp(g, 'Sign', -W / 2 - 1.2, 10, D / 2 - 1); c.box(sg, .3, 2.6, 3.2, 0, -2.6, 0, { tex: 'plank', color: WOODL }); c.box(sg, .25, .25, 4, 0, 0, 1, 0x3b3a38);
  const ph = c.rnd() * 3; c.anims.push(t => { sg.rotation.x = Math.sin(t * 1.5 + ph) * .06; });
  const R = c.roofGroup(g);
  c.roof(R, { style: 'shed', W: T.W2, D: T.D2, ridge: 'x', h: 5, over: .8, overEnd: .8, y: T.top, mat: tileRoof(c, 0x7a3a2a) });
  c.box(R, 2.2, 3, 2.2, -5, T.top + 3, -4, STONEC);
  return c.done(g);
}
function townBalcony(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(16), D = c.s(13), h1 = 10.9, h2 = 9.4, I = c.grp(g, 'Interior');
  const hole = stairHole(c, I, null, -W / 2 + .5 + 2.8, D / 2 - 3.5, 10, 3.2, h1);
  const col = c.pick([0xe6b99a, 0xcfd9a8, 0xa9cfe0]);
  const T = twoStory(c, g, { W, D, h1, h2, jet: 0, mat1: { tex: 'plaster', color: c.vary(col) }, mat2: { tex: 'plaster', color: c.vary(col) }, door: { w: 5, h: 8.8, x: 3 }, wins1: [win('F', -4.5), win('L', 0), win('R', 0)], wins2: [win('F', -5, 2.6), win('L', 0), win('R', 0), win('B', 0)], door2: { w: 5, h: 8, x: 2.5, name: 'BalconyDoor' }, hole, corner1: 0xeadfc5 });
  townInterior(c, I, W, D, h1, 0, T);
  const B = c.grp(g, 'Balcony'); c.box(B, 12, .5, 4.2, 1, h1 - .5, D / 2 + 2.1, { tex: 'plank', color: 0x8a6038 });
  for (const x of [-4.5, 6.5]) c.cyl(B, .35, .35, h1 - .5, x, 0, D / 2 + 3.7, WOODD, 6);
  c.box(B, 12, .3, .3, 1, h1 + 2.6, D / 2 + 4.1, WOODD);
  for (let i = 0; i <= 10; i++) c.box(B, .22, 2.6, .22, -5 + i * 1.2, h1, D / 2 + 4.1, WOODL);
  for (const s of [-1, 1]) { c.box(B, .3, .3, 4, 1 + s * 5.9, h1 + 2.6, D / 2 + 2.1, WOODD); }
  for (let i = 0; i < 4; i++) c.sph(B, .55, -4 + i * 2.2, h1 + 3, D / 2 + 4.1, c.pick([0xe86a8a, 0xf2c94a]), 1, 1, 1, 5);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'gable', W, D, ridge: 'x', h: 6.8, over: 3.2, overEnd: 1.2, y: T.top, mat: tileRoof(c, 0xb5532f) });
  c.box(R, 2, 4, 2, -4, T.top + 3, -2, STONEC);
  return c.done(g);
}
function townCorner(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(17), D = c.s(17), h1 = 10.9, h2 = 9.4, I = c.grp(g, 'Interior');
  const hole = stairHole(c, I, null, W / 2 - .5 - 2.8, -D / 2 + 10.5, 10, 3.2, h1);
  const col = c.pick([0xe0b26a, 0xd98a6a]);
  const T = twoStory(c, g, { W, D, h1, h2, jet: .5, mat1: { tex: 'plaster', color: c.vary(col) }, mat2: { tex: 'plaster', color: c.vary(col) }, door: { w: 5, h: 8.8, x: 3.2 }, wins1: [win('F', -4.8), win('L', -3.5), win('L', 3.5), win('B', 0), win('R', 0)], wins2: [win('F', 0), win('F', 5), win('L', -3.5), win('L', 3.5), win('R', 0), win('B', 0)], hole, corner1: 0xeadfc5, corner2: 0xeadfc5 });
  const fy = .4, hz = D / 2 - .5;
  c.hearth(I, -2, fy, -hz, 0, 5); c.table(I, -1, fy, 1, 4.6, 3); c.stool(I, -4, fy, 1); c.stool(I, 2, fy, 1); c.barrel(I, -W / 2 + 1.4, fy, hz - 1.2); c.chest(I, -W / 2 + 2, fy, -hz + 4.5);
  const up = T.S2.fy; c.bed(I, -T.W2 / 2 + 3, up, -T.D2 / 2 + 4.4, 0, 0x2f9ec4); c.chest(I, 3, up, -T.D2 / 2 + 1.4); c.table(I, 2, up, 3, 4, 3);
  // угловой эркер
  const tx = -T.W2 / 2 + .2, tz = T.D2 / 2 - .2, E = c.grp(g, 'Oriel', tx, 0, tz);
  c.mesh(E, new THREE.ConeGeometry(3.2, 3.5, 10), 0x8a847b, 0, h1 - 1.75 - .2, 0).rotation.x = Math.PI;
  c.cyl(E, 3.2, 3.2, h2, 0, h1, 0, { color: col }, 12); for (let i = 0; i < 3; i++) { const a = i * .9 + 0.7; c.box(E, 1.4, 3, .3, Math.sin(a) * 3.25, h1 + 3, Math.cos(a) * 3.25, 0x2a2a30).rotation.y = a; }
  const R = c.roofGroup(g);
  c.roof(R, { style: 'hip', W: T.W2, D: T.D2, h: 7.5, over: 1.2, y: T.top, mat: tileRoof(c, 0xa8412e) });
  const cr = c.mesh(R, new THREE.ConeGeometry(4.2, 7, 10), { tex: 'tile', color: 0x3b7a9a, side: 'double', rep: [3, 2] }, tx, T.top + 3.5, tz);
  c.cyl(R, .12, .12, 2.2, tx, T.top + 7, tz, 0x3b3a38, 4);
  c.box(R, 2, 4, 2, 4, T.top + 3, -4, STONEC);
  return c.done(g);
}

// ================= 4. рыбацкие хижины =================
function netPlane(c, p, w, h, x, y, z, ry, col = 0xc9b27a) {
  const m = c.mesh(p, new c.THREE.PlaneGeometry(w, h), { tex: 'net', color: col, tile: 1.2 }, x, y, z); m.rotation.y = ry; m.castShadow = false;
  const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 1.2, uv.getY(i) * h / 1.2); return m;
}
function fishInterior(c, g, S, W, D) {
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .5;
  c.hearth(I, 0, fy, -D / 2 + .5, 0, 4.8); c.bed(I, -hx + 2.5, fy, -D / 2 + 4.4, 0, 0x2f9ec4);
  c.table(I, hx - 3.5, fy, 0, 4.5, 3); c.stool(I, hx - 3.5, fy, 2.3); c.barrel(I, hx - 1.3, fy, -D / 2 + 1.6); c.crate(I, -hx + 1.3, fy, D / 2 - 1.3);
  c.chest(I, hx - 6, fy, -D / 2 + 1.4);
  return I;
}
function fishA(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(15), D = c.s(12), H = 10.2;
  const S = c.shell(g, { W, D, H, mat: { tex: 'plank', color: c.vary(0x9aa7a0) }, door: { w: 5, h: 8.8, x: 2 }, wins: [win('F', -4.2, 2.6), win('R', 0), win('B', 0)], corner: WOODD });
  const R = c.roofGroup(g);
  c.roof(R, { style: 'gable', W, D, ridge: 'x', h: 5, over: 1.6, overEnd: 1.2, y: H, mat: { tex: 'thatch', color: c.vary(0xb59a52), side: 'double' } });
  fishInterior(c, g, S, W, D);
  // лодка-подвес слева
  const bx = -W / 2 - 6.5; c.cyl(g, .4, .45, 13, -W / 2 - 12.5, 0, 0, WOODD, 6); c.box(g, 13.5, .6, .6, bx - .25, 12, 0, WOODD);
  const bg = c.grp(g, 'HungBoat', bx, 6.2, 0); c.boat(bg, 11, 4.2, 2, 0, 0, 0, 0x6b4527, 0xb98550);
  for (const sx of [-3.5, 3.5]) for (const sz of [-1, 1]) { const l = c.cyl(bg, .08, .08, 5.9, sx, 2, sz * .9, 0xb09a6a, 4); l.rotation.x = sz * .16; }
  const ph = c.rnd() * 3; c.anims.push(t => { bg.rotation.z = Math.sin(t * 1.1 + ph) * .04; bg.rotation.x = Math.sin(t * .8 + ph) * .03; });
  c.barrel(g, 5.5, 0, D / 2 + 1.5); c.crate(g, -6, 0, D / 2 + 1.4);
  return c.done(g);
}
function fishB(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(14), D = c.s(11), H = 10, PW = 26, PD = 22, PH = 2.6;
  const dk = c.grp(g, 'Pier'); c.box(dk, PW, .5, PD, 0, PH - .5, -.5, { tex: 'plank', color: 0x8a6038 });
  for (const x of [-PW / 2 + 1, -PW / 4, 0, PW / 4, PW / 2 - 1]) for (const z of [-9, 0, 9]) c.cyl(dk, .5, .6, PH - .5, x, 0, z, WOODD, 6);
  const S = c.shell(g, { W, D, H, y: PH, mat: { tex: 'plank', color: c.vary(0x7f9aa6) }, door: { w: 5, h: 8.8 }, wins: [win('L', 0), win('R', 0), win('F', -4.2, 2.6)], corner: WOODD });
  // сдвиг дома на пирсе
  g.children.forEach(ch => { if (ch.name === 'Body') ch.position.z = -3; });
  const R = c.roofGroup(g); R.position.z = -3;
  c.roof(R, { style: 'shed', W, D, ridge: 'x', h: 4.2, over: 1.3, overEnd: 1, y: PH + H, mat: { tex: 'tile', color: c.vary(0x5a4a3a), side: 'double' } });
  const I = fishInterior(c, g, S, W, D); I.position.z = -3;
  // лестница вниз и кнехты
  const n = 4; for (let i = 0; i < n; i++) c.box(g, 5, (PH / n) * (i + 1), 1, 0, 0, PD / 2 - .5 + .5 + (n - 1 - i) * 1, { tex: 'plank', color: 0xa87a4a });
  // кран-шлюпбалка и лодка
  const cr = c.grp(g, 'Davit', PW / 2 - 2, PH, 5); c.cyl(cr, .45, .5, 13, 0, 0, 0, WOODD, 6); c.box(cr, 8, .5, .5, 4, 12.3, 0, WOODD); c.rot(c.box(cr, .4, 5, .4, 1.5, 8.5, 0, WOODC), 0, 0, -.9);
  const sw = c.grp(cr, 'BoatSwing', 7.2, 12.3, 0); const bt = c.grp(sw, '', 0, -7, 0); c.boat(bt, 11, 4.2, 2, 0, 0, 0, 0xa8412e, 0xe6d29a).rotation.y = Math.PI / 2;
  c.cyl(sw, .08, .08, 6.5, 0, -6.5, -.0, 0xb09a6a, 4); const ph = c.rnd() * 3; c.anims.push(t => { sw.rotation.z = Math.sin(t * 1.2 + ph) * .05; sw.rotation.x = Math.sin(t * .9) * .04; });
  for (const [x, z] of [[-9, 9], [9, 9]]) c.cyl(g, .6, .6, 1.4, x, PH, z, 0x3b3a38, 6);
  c.barrel(g, 6, PH, 7); c.barrel(g, 8.3, PH, 7); c.crate(g, -4, PH, 7);
  return c.done(g);
}
function fishC(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = 16, D = c.s(14), hw = 3.5, PK = 13.2, t = .5;
  const dh = 9.2; const body = c.grp(g, 'Body'); const wm = { tex: 'plank', color: c.vary(0xa98b62) };
  const tri = (door) => { const q = [[-8, 0]]; if (door) q.push([-2.6, 0], [-2.6, dh], [2.6, dh], [2.6, 0]); q.push([8, 0], [8, hw], [0, PK], [-8, hw]); return q; };
  c.prism(body, tri(true), t, 0, 0, D / 2 - t / 2, wm, 'FrontGable'); c.prism(body, tri(false), t, 0, 0, -D / 2 + t / 2, wm, 'BackGable');
  for (const s of [-1, 1]) c.box(body, t, hw, D - 2 * t, s * (W / 2 - t / 2), 0, 0, wm);
  c.slab(body, W - 2 * t, D - 2 * t, 0, .4, null, { tex: 'plank', color: 0x8a6038 });
  c.door(body, { x: 0, y: .4, z: D / 2 - t / 2, w: 5.2, h: 8.8 });
  for (const s of [-1, 1]) { c.box(body, .5, dh, .8, s * 2.85, 0, D / 2, 0x5a3a20); } c.box(body, 6.2, .5, .8, 0, dh, D / 2, 0x5a3a20);
  const S = { fy: .4 }, I = c.grp(g, 'Interior');
  c.firepit(I, 0, .4, -1, 1.5); c.bed(I, -5.2, .4, -2.5, 0, 0x2f9ec4, 6.5, 4); c.table(I, 5, .4, -2, 3.6, 3, 0, 2.6); c.stool(I, 5, .4, .4); c.barrel(I, 5.6, .4, -5.2); c.crate(I, -5.8, .4, 4.5); c.chest(I, -5.6, .4, -5.6, 0, .9);
  const R = c.roofGroup(g);
  c.slabRoof(R, { y: hw, s: 8.6, ye: 0, h: PK - hw - .0, D: D + 1.2, th: .6, mat: { tex: 'thatch', color: c.vary(0x8a6a3a), side: 'double' }, ridge: 0x6b4527 });
  c.barrel(g, -9.5, 0, D / 2 - 1);
  return c.done(g);
}

// ================= 5. фермерские дома с сараем =================
function farmHouse(c, g, x, W, D, H, wall, roofMat, ridge, S0) {
  const G = c.grp(g, 'House', x, 0, 0);
  const S = c.shell(G, { W, D, H, mat: wall, door: { w: 5, h: 8.8 }, wins: [win('F', -W * .3), win('F', W * .3), win('L', 0), win('R', 0), win('B', 0)], corner: WOODD, beams: 3 });
  const R = c.roofGroup(G); c.roof(R, { style: S0 || 'gable', W, D, ridge, h: 7, over: 1.4, overEnd: 1, y: H, mat: roofMat });
  const I = basicInterior(c, G, S); return { G, S, R };
}
function farmA(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o);
  const hs = farmHouse(c, g, -15, c.s(16), c.s(13), 10.4, { tex: 'plaster', color: c.vary(0xe9ddc0) }, tileRoof(c), 'x');
  timberAll(c, hs.S, WOODD, 4.6);
  const BW = c.s(20), BD = c.s(18), BH = 13, bx = 14.5;
  const B = c.grp(g, 'Barn', bx, 0, 0);
  const S = c.shell(B, { W: BW, D: BD, H: BH, mat: { tex: 'plank', color: c.vary(0xa8412e) }, door: { w: 9, h: 10.4, leaves: 2, name: 'BarnDoor', mat: { tex: 'plank', color: 0xe8dcc0 } }, wins: [{ side: 'F', c: 0, w: 4, y0: 11.3, y1: 13, fill: 0x2a1c12 }], corner: 0xe8dcc0, floorMat: { tex: 'plank', color: 0x7a5530 }, frame: 0xe8dcc0 });
  c.timber(S, 'F', 0xe8dcc0, 5, 0);
  const R = c.roofGroup(g); R.position.x = bx;
  c.roof(R, { style: 'gable', W: BW, D: BD, ridge: 'z', h: 9, over: .8, overEnd: 1.2, y: BH, mat: { tex: 'tile', color: c.vary(0x5a4a3a), side: 'double' } });
  const wv = c.grp(R, 'Vane', 0, BH + 9, 0); c.cyl(wv, .1, .1, 3, 0, 0, 0, 0x3b3a38, 4); const ar = c.box(wv, 2.4, .5, .15, 0, 3, 0, 0x3b3a38); c.anims.push(t => { wv.rotation.y = Math.sin(t * .7) * 1.2; });
  const hy = c.grp(B, 'Interior'), hx = BW / 2 - .5;
  for (let i = 0; i < 6; i++) c.box(hy, 3, 1.5, 1.6, hx - 2 - (i % 3) * 3.1, .4 + Math.floor(i / 3) * 1.5, -BD / 2 + 1.5 + (i > 4 ? 1.6 : 0), 0xd8b45a);
  c.box(hy, .3, 3.4, 8, -hx + 3, .4, -2, WOODC); c.box(hy, 5, .3, .3, -hx + .8, 2.4, -2, WOODC); c.cylH(hy, .15, 6, -hx + 1, 3.2, 3, WOODL, 'z');
  c.crate(hy, -hx + 1.3, .4, 5.5); c.barrel(hy, -hx + 3.5, .4, 6.5); c.lantern(hy, 0, 9, 0);
  c.cyl(g, 0, 3.4, 5.5, -3, 0, 12, 0xd8b45a, 8);
  return c.done(g);
}
function farmB(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o);
  const hs = farmHouse(c, g, -16, c.s(15), c.s(13), 10.4, { tex: 'plaster', color: c.vary(0xd9c28f) }, { tex: 'thatch', color: c.vary(0xc9a24c), side: 'double' }, 'x', 'hip');
  timberAll(c, hs.S, WOODD, 4.6);
  const BW = c.s(22), BD = c.s(20), BH = 10.5, bx = 12;
  const B = c.grp(g, 'Barn', bx, 0, 0);
  const S = c.shell(B, { W: BW, D: BD, H: BH, mat: { tex: 'plank', color: c.vary(0xa8412e) }, door: { w: 10, h: 9.6, leaves: 2, name: 'BarnDoor', mat: { tex: 'plank', color: 0xe8dcc0 } }, corner: 0xe8dcc0, floorMat: { tex: 'plank', color: 0x7a5530 }, frame: 0xe8dcc0, wins: [win('L', 0, 3, 5, 8), win('R', 0, 3, 5, 8)], beams: 3 });
  const R = c.roofGroup(g); R.position.x = bx;
  c.roof(R, { style: 'gambrel', W: BW, D: BD, ridge: 'z', h: 9.5, over: .8, overEnd: 1.2, y: BH, mat: { tex: 'tile', color: c.vary(0x3f4a52), side: 'double' } });
  const hy = c.grp(B, 'Interior'), hx = BW / 2 - .5;
  for (let i = 0; i < 8; i++) c.box(hy, 3, 1.5, 1.6, hx - 2 - (i % 4) * 3.1, .4 + Math.floor(i / 4) * 1.5, -BD / 2 + 1.5, 0xd8b45a);
  for (const z of [-2, 3]) { c.box(hy, 6, 2.2, .3, -hx + 3.2, .4, z, WOODC); c.box(hy, .3, 2.2, 5, -hx + 6.2, .4, z + 2.5, WOODC); } c.barrel(hy, -hx + 1.3, .4, 7); c.crate(hy, 0, .4, 5);
  const si = c.grp(g, 'Silo', bx + BW / 2 + 5.5, 0, -4); c.cyl(si, 3.8, 4, 20, 0, 0, 0, { tex: 'plank', color: 0xb8b0a0, tile: 3 }, 12); c.mesh(si, new THREE.SphereGeometry(3.8, 12, 5, 0, 6.283, 0, 1.57), 0x8a847b, 0, 20, 0);
  const sh = c.grp(g, 'HaySheds', -16, 0, -14); for (const x of [-5, 5]) for (const z of [-2, 2]) c.cyl(sh, .35, .35, 7, x, 0, z, WOODD, 6);
  const sr = c.box(sh, 13, .4, 6, 0, 0, 0, tileRoof(c, 0x7a3a2a)); sr.position.set(0, 7.3, 0); sr.rotation.x = .12; for (let i = 0; i < 4; i++) c.box(sh, 2.8, 1.5, 2, -4.2 + i * 2.8, 0, 0, 0xd8b45a);
  c.cyl(g, 0, 3.4, 5.5, -3, 0, 14, 0xd8b45a, 8);
  return c.done(g);
}

// ================= 6. пиратские лачуги из обломков =================
function junk(c, g, S, n) {
  const j = c.grp(g, 'Patches'), W = S.W, D = S.D, H = S.top - S.y0;
  for (let i = 0; i < n; i++) {
    const side = c.pick(['F', 'B', 'L', 'R']), len = 3 + c.rnd() * 4, w = .7 + c.rnd() * .7, col = c.pick([0x6f5a45, 0x8a6a48, 0x3f6a6a, 0x4a3a2c, 0x9a7a52, 0xa8412e]);
    const a = (c.rnd() - .5) * (side === 'F' || side === 'B' ? W - 4 : D - 4), y = S.y0 + .5 + c.rnd() * (H - len - .5 > 0 ? H - len - .5 : 1);
    if (side === 'F' && Math.abs(a) < 4.2) continue;
    const e = S.t / 2 + .15;
    const m = side === 'F' ? c.box(j, w, len, .25, a, y, D / 2 + e, col) : side === 'B' ? c.box(j, w, len, .25, a, y, -D / 2 - e, col) : side === 'L' ? c.box(j, .25, len, w, -W / 2 - e, y, a, col) : c.box(j, .25, len, w, W / 2 + e, y, a, col);
    m.rotation.z = (c.rnd() - .5) * .25 * (side === 'F' || side === 'B' ? 1 : 0); m.rotation.x = (side === 'L' || side === 'R') ? (c.rnd() - .5) * .25 : 0;
  }
}
function wheel(c, p, x, y, z, ry = 0) {
  const g = c.grp(p, 'Wheel', x, y, z); g.rotation.y = ry; const r = c.mesh(g, new c.THREE.TorusGeometry(1.6, .22, 5, 12), WOODD, 0, 0, 0);
  for (let i = 0; i < 4; i++) c.rot(c.box(g, .24, 3.8, .24, 0, -1.9, 0, WOODC), 0, 0, i * Math.PI / 4); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.box(g, .3, .8, .3, Math.cos(a) * 1.9, Math.sin(a) * 1.9 - .4, 0, WOODC).rotation.z = a - Math.PI / 2; }
  c.anims.push(t => { g.children[0].rotation.z = 0; }); return g;
}
function skullFlag(c, p, x, y, z) {
  const f = c.flag(p, x, y, z, 5, 3.2, 0x1c1c22); c.sph(p, .6, x + 2.4, y + 1.7, z + .12, 0xf1e6cc, 1, 1, .3, 6); c.rot(c.box(p, 2.4, .25, .1, x + 2.4, y + .8, z + .12, 0xf1e6cc), 0, 0, .5); c.rot(c.box(p, 2.4, .25, .1, x + 2.4, y + .8, z + .12, 0xf1e6cc), 0, 0, -.5); return f;
}
function pirateA(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(16), D = c.s(13), H = 10.2;
  const S = c.shell(g, { W, D, H, mat: { tex: 'plank', color: c.vary(0x6f5a45) }, door: { w: 5, h: 8.8, x: 2.5 }, wins: [win('F', -4, 2.6), win('L', 0), win('R', 0)], corner: 0x4a3a2c, frame: 0x3a2c20 });
  junk(c, g, S, 18);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'shed', W, D, ridge: 'x', h: 3.6, over: 1.6, overEnd: 1.3, y: H, mat: { tex: 'stripe', color: 0xe8dcc0, c2: 0xcdbf9a, side: 'double' } });
  for (const x of [-W / 2, 0, W / 2]) c.box(R, .5, .5, D + 3, x, H - .3, 0, 0x4a3a2c);
  const mast = c.cyl(g, .5, .7, 24, -W / 2 - 2.5, 0, -D / 2 + 1, WOODD, 7); mast.rotation.z = -.05; skullFlag(c, g, -W / 2 - 2.9, 20, -D / 2 + 1);
  c.cyl(g, .08, .08, 14, -W / 2 - 1, H + 1, -D / 2 + 1, 0xb09a6a, 3).rotation.z = 1.0;
  wheel(c, g, W / 2 - 2.5, 4.5, D / 2 + 1.2, .2); c.cyl(g, .3, .3, 3.2, W / 2 - 2.5, 0, D / 2 + 1.2, WOODD, 6);
  const an = c.grp(g, 'Anchor', -W / 2 - 1.4, 0, 3); c.box(an, .5, 6, .5, 0, .5, 0, 0x3b3a38); c.box(an, .5, .5, 4, 0, 5.4, 0, 0x3b3a38); c.mesh(an, new THREE.TorusGeometry(1.4, .25, 5, 10, Math.PI), 0x3b3a38, 0, .9, 0).rotation.z = Math.PI;
  for (let i = 0; i < 6; i++) c.sph(g, .55, W / 2 + 1.5 + (i % 3) * 1.1 - Math.floor(i / 3) * .5, .55 + Math.floor(i / 3) * .9, 2 + Math.floor(i / 3) * .55, 0x2a2a30, 1, 1, 1, 6);
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .5;
  c.firepit(I, 0, fy, -1, 1.5); c.barrel(I, hx - 1.5, fy, -D / 2 + 1.5); c.barrel(I, hx - 3.8, fy, -D / 2 + 1.5); c.table(I, hx - 4, fy, 1, 3.6, 3.6, 0, 3); c.stool(I, hx - 4, fy, 3.5); c.chest(I, -hx + 2, fy, -D / 2 + 1.4);
  c.box(I, 6, .25, 2.4, -hx + 1.2 + 0, fy + 3, 2, 0xc8b88a).rotation.set(0, Math.PI / 2, 0);
  for (const z of [-1.4, 5.4]) c.cyl(I, .25, .25, 7, -hx + .6, fy, z, WOODD, 5);
  return c.done(g);
}
function pirateB(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(20), D = c.s(14), H = 8.8;
  const S = c.shell(g, { W, D, H, mat: { tex: 'plank', color: c.vary(0x4a3a2c) }, door: { w: 5, h: 8.2, x: 3 }, wins: [win('F', -5, 2.4, 4, 6.8), win('B', 0, 2.4, 4, 6.8)], corner: 0x2f261e, frame: 0x2f261e });
  junk(c, g, S, 14);
  const R = c.roofGroup(g);
  const Rr = D / 2 + 1.4, hull = new THREE.CylinderGeometry(Rr, Rr, W + 3, 14, 10, true, -Math.PI / 2, Math.PI), hp = hull.attributes.position;
  hull.rotateZ(Math.PI / 2); hull.rotateY(0);
  // цилиндр лежит вдоль y -> после rotateZ вдоль x; профиль — полуокружность вверх
  const hh = hull.attributes.position;
  for (let i = 0; i < hh.count; i++) { const x = hh.getX(i), y = hh.getY(i), z = hh.getZ(i); const f = Math.max(0, x / (W / 2 + 1.5)); hh.setXYZ(i, x, y * (1 - .4 * f * f), z * (1 - .85 * f * f * f)); }
  hull.computeVertexNormals(); const hm = c.mesh(R, hull, { color: 0x3b3028, side: 'double' }, 0, H - .2, 0, 'Hull'); hm.scale.set(1, .9, 1);
  for (let i = 0; i < 7; i++) { const x = -W / 2 + 1.5 + i * (W - 3) / 6, f = x / (W / 2 + 1.5), pk = Math.max(0, f); const rb = c.mesh(R, new THREE.TorusGeometry(Rr * (1 - .4 * pk * pk) * .98, .25, 4, 10, Math.PI), 0x5a3a20, x, H - .2, 0); rb.rotation.y = Math.PI / 2; rb.scale.set(1, .9, 1 - .85 * pk * pk * pk - .0); rb.scale.x = 1 - .85 * pk * pk * pk; rb.scale.y = (1 - .4 * pk * pk) * .9 / (1 - .4 * pk * pk); }
  c.box(R, W + 3, .5, .6, 0, H + Rr * .9 - .1, 0, 0x5a3a20);
  const pl = c.cyl(g, .3, .35, 17, W / 2 + 3, 0, -3, WOODD, 6); skullFlag(c, g, W / 2 + 2.9, 14, -3);
  wheel(c, g, -W / 2 - .3, 5, D / 2 - 1, Math.PI / 2 + .2);
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .5;
  c.hearth(I, -4, fy, -D / 2 + .5, 0, 4.6); c.bed(I, hx - 2.5, fy, -D / 2 + 4.4, 0, 0x2a2a30); c.table(I, -3, fy, 1.5, 5, 3.4); c.bench(I, -3, fy, 3.6, 4.6); c.stool(I, -6.3, fy, 1.5); c.barrel(I, -hx + 1.3, fy, -D / 2 + 1.5); c.chest(I, hx - 2, fy, 3); c.chest(I, hx - 2, fy, 5.2, .5, .8);
  return c.done(g);
}
function pirateC(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(14), D = c.s(12), H = 10.2, B = 2.6;
  const P = c.grp(g, 'Stack');
  for (const x of [-W / 2 + 1.2, 0, W / 2 - 1.2]) for (const z of [-D / 2 + 1.2, D / 2 - 1.2]) { if (c.rnd() < .5) c.barrel(P, x, 0, z, 1.35, B + .2); else c.crate(P, x, 0, z, B + .2, c.rnd()); }
  c.box(P, W - 1.5, .4, 1, 0, B - .3, D / 2 - 1.2, 0x4a3a2c); c.box(P, W - 1.5, .4, 1, 0, B - .3, -D / 2 + 1.2, 0x4a3a2c);
  const S = c.shell(g, { W, D, H, y: B, mat: { tex: 'plank', color: c.vary(0x8a6a48) }, door: { w: 5, h: 8.8, x: -2 }, wins: [win('F', 4, 2.6), win('L', 0), win('R', 0)], corner: 0x4a3a2c, frame: 0x3a2c20 });
  junk(c, g, { ...S, y0: B, top: B + H, W, D, t: S.t }, 16);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'shed', W, D, ridge: 'x', h: 3.8, over: 1.5, overEnd: 1.2, y: B + H, mat: { tex: 'plank', color: 0x5a4a3a, side: 'double' } });
  const rp = c.box(g, 4.6, .4, 9.5, 0, 0, 0, WOODL); rp.position.set(-2, B / 2 + .0, D / 2 + 5.5); rp.rotation.x = Math.atan2(B, 9.5);
  const mx = W / 2 + 2.6; c.cyl(g, .45, .6, 27, mx, 0, -2, WOODD, 7);
  const nest = c.grp(g, 'CrowsNest', mx, 21, -2); c.cyl(nest, 2, 1.6, 2.2, 0, 0, 0, { tex: 'plank', color: 0x6b4527, tile: 2 }, 10); c.cyl(nest, 2.2, 2.2, .3, 0, 2.2, 0, WOODD, 10);
  skullFlag(c, g, mx - .1, 24, -2);
  for (let i = 0; i < 9; i++) { c.box(g, 3, .2, .2, mx - 1 - 0, 1.6 + i * 2, 1.3, 0xb09a6a); }
  const cn = c.grp(g, 'Cannon', -W / 2 - 3, 0, 2); c.cylH(cn, .8, 4, 0, 1.9, 0, 0x3b3a38, 'z', 8); for (const s of [-1, 1]) c.cylH(cn, 1, .4, s * 1.1, 1, .5, WOODD, 'x', 8);
  c.lantern(g, -W / 2 + 4, B + 9.2 - 1, D / 2 + 1);
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .5;
  c.firepit(I, 0, fy, -1, 1.4); c.bed(I, -hx + 2.6, fy, -D / 2 + 4.2, 0, 0xa8412e); c.table(I, hx - 3.5, fy, 0, 3.4, 3.4); c.stool(I, hx - 3.5, fy, 2.4); c.chest(I, hx - 2, fy, -D / 2 + 1.5); c.barrel(I, hx - 1.3, fy, D / 2 - 1.5); c.crate(I, -hx + 1.3, fy, D / 2 - 1.5);
  return c.done(g);
}

// ================= 7. палатки / шатры =================
function tentA(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = 16, D = c.s(15), PK = 14.2, dh = 9.2, t = .25;
  const cm = { tex: 'stripe', color: c.vary(0xe8dcc0), c2: c.pick([0xa8412e, 0x2f9ec4]), side: 'double' };
  const body = c.grp(g, 'Body');
  const tri = (door) => { const q = [[-8, 0]]; if (door) q.push([-2.7, 0], [-2.7, dh], [2.7, dh], [2.7, 0]); q.push([8, 0], [0, PK]); return q; };
  c.prism(body, tri(true), t, 0, 0, D / 2, cm, 'FrontPanel'); c.prism(body, tri(false), t, 0, 0, -D / 2, cm, 'BackPanel');
  c.box(body, W, .3, D, 0, 0, 0, { tex: 'plank', color: 0x8a6038, tile: 3 });
  c.door(body, { x: 0, y: .3, z: D / 2, w: 5.4, h: 8.9, leaves: 2, mat: cm, noBrace: true, th: .2 });
  const R = c.roofGroup(g);
  c.slabRoof(R, { y: 0, s: 8, ye: 0, h: PK, D: D + .2, th: .25, mat: cm, ridge: 0x6b4527, ext: .8 });
  for (const s of [-1, 1]) { const pg = c.cyl(g, .22, .22, PK + 1, s * 2.9, 0, D / 2 + 1.2, WOODC, 5); pg.rotation.z = -s * .17; }
  c.cylH(g, .25, D + 4, 0, PK + .6, 0, WOODC, 'z', 5);
  for (const s of [-1, 1]) for (const z of [-D / 2, D / 2]) { const p = c.cyl(g, .12, .12, 7, s * 11, 0, z * 1.15, 0xb09a6a, 3); p.rotation.z = s * .9; p.position.y = 3.2; p.position.x = s * (8.6 + 1.8); c.cyl(g, .2, 0, 1.2, s * 12.4, 0, z * 1.25, WOODD, 4); }
  const I = c.grp(g, 'Interior'); c.firepit(I, 0, .3, -1, 1.4); c.rug(I, -4, .3, -3, 4.2, 7.5, 0x2f9ec4); c.cushion(I, -4, .4, -5.5, 0xf1e6cc, 2.2); c.box(I, 2.2, 2.6, 1.6, 5, .3, -5, 0x6b4527); c.chest(I, 5, .3, -2.6, 0, .8); c.lantern(I, 0, 3.4, -4.5);
  return c.done(g);
}
function tentRound(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const r = c.s(10), H = 11.6, dh = 9.2, al = Math.asin(2.7 / r);
  const wm = { tex: 'stripe', color: c.vary(0xe8dcc0), c2: c.pick([0xa8412e, 0x2f9ec4]), side: 'double', rep: [4, 1] };
  const body = c.grp(g, 'Body');
  c.mesh(body, new THREE.CylinderGeometry(r, r, H, 22, 1, true, al, Math.PI * 2 - 2 * al), wm, 0, H / 2 + .3, 0, 'Wall');
  c.mesh(body, new THREE.CylinderGeometry(r, r, H - dh, 4, 1, true, -al, 2 * al), { color: 0xa8412e, side: 'double' }, 0, .3 + dh + (H - dh) / 2, 0, 'Lintel');
  c.cyl(body, r, r, .3, 0, 0, 0, { tex: 'plank', color: 0x8a6038, tile: 3 }, 22);
  const zc = Math.sqrt(r * r - 2.7 * 2.7);
  for (const s of [-1, 1]) c.cyl(body, .3, .3, dh + .5, s * 2.9, .3, zc, WOODD, 6);
  c.door(body, { x: 0, y: .3, z: zc, w: 5.4, h: dh - .3, leaves: 2, mat: { tex: 'stripe', color: 0xa8412e, c2: 0xe8dcc0, rep: [2, 1] }, noBrace: true, th: .2 });
  const R = c.roofGroup(g);
  c.mesh(R, new THREE.ConeGeometry(r + 1.3, 8.5, 22, 1, true), { tex: 'stripe', color: 0xa8412e, c2: 0xe8dcc0, side: 'double', rep: [3, 1] }, 0, H + .3 + 4.25, 0, 'Cone');
  c.cyl(R, .2, .2, 4, 0, H + 8.6, 0, WOODD, 5); c.sph(R, .7, 0, H + 9, 0, 0xe0a030, 1, 1, 1, 7); c.flag(R, 0, H + 10, 0, 3.4, 1.8, 0xa8412e);
  c.mesh(R, new THREE.TorusGeometry(r + .1, .3, 4, 22), 0xe0a030, 0, H + .4, 0).rotation.x = Math.PI / 2;
  const I = c.grp(g, 'Interior'); c.firepit(I, 0, .3, 0, 1.8); c.rug(I, 0, .3, 0, 15, 0, 0x8a2a2a, true);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + .5; if (Math.abs(Math.sin(a - 0)) > 1.5) continue; c.cushion(I, Math.sin(a) * 5, .35, -Math.cos(a) * 5, c.pick([0xa8412e, 0x2f9ec4, 0xe0a030])); }
  c.table(I, 5.5, .3, -3, 2.6, 2.6, 0, 1.8); c.bed(I, -5.5, .3, -3.5, .3, 0x2f9ec4, 6.5, 4); c.chest(I, 0, .3, -7.2); c.lantern(I, 0, 8, 0);
  return c.done(g);
}
function tentCommander(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(22), D = c.s(18), H = 10.8;
  const cm = { tex: 'cloth', color: c.vary(0xe8dcc0), side: 'double' };
  const S = c.shell(g, { W, D, H, t: .3, mat: cm, door: { w: 7, h: 9.2, leaves: 2, mat: { tex: 'stripe', color: 0xa8412e, c2: 0xe8dcc0, rep: [2, 1] }, brace: 0xe0a030, noBrace: true, x: 0 }, floorMat: { tex: 'plank', color: 0x7a5530 }, frame: 0x6b4527, corner: 0x6b4527, stepMat: 0x8a6038 });
  for (const k of ['F', 'B', 'L', 'R']) { const d = S.defs[k]; if (d.ax === 'x') c.box(S.body, W, 1, .4, 0, H - 1, d.f, 0xa8412e); else c.box(S.body, .4, 1, D - .6, d.f, H - 1, 0, 0xa8412e); }
  const R = c.roofGroup(g);
  c.roof(R, { style: 'hip', W, D, h: 8, over: 1.5, y: H, mat: { tex: 'stripe', color: 0xe8dcc0, c2: 0xa8412e, side: 'double', rep: [4, 2] } });
  for (let i = 0; i < 14; i++) { const x = -W / 2 - 1.4 + i * (W + 2.8) / 13; c.mesh(R, new THREE.ConeGeometry(.9, 1.4, 3), i % 2 ? 0xa8412e : 0xe0a030, x, H - .4, D / 2 + 1.4).rotation.x = Math.PI; }
  c.cyl(R, .2, .2, 4, 0, H + 8, 0, WOODD, 5); c.flag(R, 0, H + 9.3, 0, 4.4, 2.4, 0xa8412e);
  c.cyl(R, .3, .3, H + 8, 0, 0, 0, WOODD, 6);
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .4;
  c.rug(I, 0, fy, 1, 12, 8, 0x8a2a2a); const tb = c.table(I, 5.2, fy, 1, 6, 4, 0, 3.2); c.mesh(tb, new THREE.PlaneGeometry(4.6, 3), { tex: 'parch', color: 0xe8d7ae }, 0, 3.07, 0).rotation.x = -Math.PI / 2;
  c.bed(I, -hx + 3, fy, -D / 2 + 4.5, 0, 0x2f9ec4); c.box(I, 4.2, .3, 6, -hx + 3, fy + 2.3, -D / 2 + 4.6, 0x7a5a3a); c.chest(I, hx - 2, fy, -D / 2 + 1.5); c.chest(I, hx - 5.5, fy, -D / 2 + 1.4);
  const br = c.grp(I, 'Brazier', -4, fy, 3); c.cyl(br, .8, .4, 2.4, 0, 0, 0, 0x3b3a38, 6); c.cyl(br, 1.4, .8, 1, 0, 2.4, 0, 0x3b3a38, 8); c.fire(br, 0, 3.3, 0, .8);
  for (let i = 0; i < 4; i++) { c.cyl(I, .09, .09, 8, hx - 1.2 + (i % 2) * .8, fy, 4 + Math.floor(i / 2) * .8, WOODL, 4); }
  for (const x of [-hx + 1.2, hx - 1.2]) { c.cyl(I, .12, .12, 8, x, fy, D / 2 - 2, WOODD, 4); c.box(I, 1.6, 2.4, .1, x, fy + 5, D / 2 - 2, 0xa8412e); }
  return c.done(g);
}

// ================= 8. японские дома =================
const shoji = (col = 0xf4ecd0) => ({ tex: 'shoji', color: col, c2: 0x4a3020 });
const DARK = 0x4a3020;
function jpInterior(c, g, S, W, D, o = {}) {
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .5, hz = D / 2 - .5;
  c.firepit(I, o.fx ?? 0, fy, o.fz ?? 0, 1.3);
  const k = c.grp(I, 'Kettle', o.fx ?? 0, fy + 2.9, o.fz ?? 0); c.cyl(k, .1, .1, 3, 0, 0, 0, 0x3b3a38, 3).position.y = 1.5; c.sph(k, .8, 0, 0, 0, 0x2a2a30, 1, .8, 1, 7);
  c.table(I, hx - 5, fy, 1, 5, 4, 0, 1.6); c.cushion(I, hx - 5, fy, 4, 0xa8412e); c.cushion(I, hx - 5, fy, -2, 0x2f9ec4);
  // токонома
  c.box(I, 5, .6, 2.2, -hx + 3.6 - 1, fy, -hz + 1.1, DARK); const sc = c.box(I, 2.6, 5, .1, -hx + 2.6, fy + 2.2, -hz + .1, { tex: 'parch', color: 0xe8d7ae }); c.cyl(I, .4, .6, 1.4, -hx + 5, fy + .6, -hz + 1.1, 0x2f9ec4, 7);
  c.bed(I, -hx + 3, fy, 3.2, 0, 0xe8dcc0, 7, 3.6); c.lantern(I, hx - 1.5, fy + 5, -hz + 1.5, 0xffd98a);
  return I;
}
function jpHouse(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(26), D = c.s(18), H = 10.6, B = 1.2;
  const S = c.shell(g, { W, D, H, y: B, t: .45, mat: shoji(), door: { w: 9.2, h: 9.2, type: 'slide', mat: shoji(), noBrace: true }, wins: [win('L', 0, 6, 3.5, 8, { fill: shoji() }), win('R', 0, 6, 3.5, 8, { fill: shoji() }), win('B', -6, 6, 3.5, 8), win('B', 6, 6, 3.5, 8)], floorMat: { tex: 'tatami', color: 0xb5b27a, tile: 4 }, frame: DARK, corner: DARK, stepMat: 0x8a847b });
  timberAll(c, S, DARK, 4.6, 0);
  const pl = c.grp(g, 'Platform'); c.box(pl, W + 1, B, D + 1, 0, 0, 0, { tex: 'stone', color: 0x8a847b });
  const ST = c.grp(g, 'Stairs');      // веранда и ступень перед входом — проходимые (раньше дверь была выше шага игры)
  const ev = c.box(ST, W + 4, .35, 5, 0, B, D / 2 + 2.6, { tex: 'plank', color: 0xb98550 }); for (const x of [-W / 2 - 1.4, W / 2 + 1.4]) c.cyl(pl, .35, .35, 4.2, x, B, D / 2 + 4.6, DARK, 6);
  for (const x of [-W / 2 + 3, -4.5, 4.5, W / 2 - 3]) c.cyl(pl, .35, .35, 4.2, x, B, D / 2 + 4.9, DARK, 6);
  c.box(ST, 6.5, B * .5, 1.8, 0, 0, D / 2 + 5.6, 0x8a847b);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'curve', W, D, ridge: 'x', h: 8, over: 3.2, overEnd: 2.2, y: B + H, mat: { tex: 'tile', color: 0x4a4f55, side: 'double' } });
  c.cylH(R, .8, W + 5, 0, B + H + 8.2, 0, 0x2a2e33, 'x', 6); for (const s of [-1, 1]) c.sph(R, 1.1, s * (W / 2 + 2.6), B + H + 8.8, 0, 0xc8a050, 1, 1.2, 1, 6);
  const I = jpInterior(c, g, S, W, D, { fx: 0, fz: -2 });
  return c.done(g);
}
function jpTea(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(17), D = c.s(15), H = 10.4, B = 1;
  const S = c.shell(g, { W, D, H, y: B, t: .45, mat: { tex: 'plaster', color: 0xd9c9a0 }, door: { w: 5.6, h: 8.8, type: 'slide', mat: shoji(), noBrace: true, x: 3 }, wins: [win('L', 0, 5, 3.5, 8, { fill: shoji() }), win('F', -4, 4, 3.5, 8, { fill: shoji() }), win('B', 0, 5, 3.5, 8, { fill: shoji() })], floorMat: { tex: 'tatami', color: 0xb5b27a, tile: 4 }, frame: DARK, corner: DARK });
  timberAll(c, S, DARK, 4.2, 0);
  c.box(g, W + 1, B, D + 1, 0, 0, 0, { tex: 'stone', color: 0x8a847b }); { const ST = c.grp(g, 'Stairs'); c.box(ST, W + 3, .35, 4, 0, B, D / 2 + 2.3, { tex: 'plank', color: 0xb98550 }); c.box(ST, 4, B * .5, 1.5, 3, 0, D / 2 + 4.7, 0x8a847b); }
  const R = c.roofGroup(g);
  c.roof(R, { style: 'hip', W, D, h: 4.2, over: 3.2, y: B + H, mat: { tex: 'thatch', color: 0x9a7a45, side: 'double' } });
  c.roof(R, { style: 'hip', W: W - 7, D: D - 7, h: 4.6, over: 1.4, y: B + H + 3.6, mat: { tex: 'thatch', color: 0xa88a52, side: 'double' } });
  c.sph(R, .8, 0, B + H + 8.5, 0, 0x6b4527, 1, 1.2, 1, 6);
  const ring = c.mesh(g, new THREE.TorusGeometry(1.7, .22, 5, 14), DARK, -W / 2 - .3, B + 6, -2); ring.rotation.y = Math.PI / 2;
  // фонарь и умывальник
  const ln = c.grp(g, 'StoneLantern', -W / 2 - 4, 0, 6); c.cyl(ln, 1.1, 1.3, .6, 0, 0, 0, 0x8a847b, 6); c.cyl(ln, .35, .35, 3, 0, .6, 0, 0x8a847b, 6); c.box(ln, 1.4, 1.2, 1.4, 0, 3.6, 0, 0x8a847b); c.box(ln, .6, .6, 1.5, 0, 3.9, 0, { color: 0xffd98a, basic: true }); c.mesh(ln, new THREE.ConeGeometry(1.4, .9, 4), 0x6b665f, 0, 5.2, 0).rotation.y = .78;
  const ts = c.grp(g, 'Tsukubai', W / 2 + 4, 0, 5); c.cyl(ts, 1.3, 1.5, 1.4, 0, 0, 0, 0x8a847b, 8); c.cyl(ts, 1, 1, .1, 0, 1.35, 0, 0x2f9ec4, 8); c.cylH(ts, .2, 2.4, .8, 2.3, 0, 0x7a9a4a, 'x', 5);
  for (let i = 0; i < 5; i++) c.cyl(g, .9, .9, .25, 3 - i * .6 + (i % 2) * .5, 0, D / 2 + 6 + i * 1.7, 0x9b958c, 7);
  const I = jpInterior(c, g, S, W, D, { fx: -2, fz: -1 });
  return c.done(g);
}
function jpDojo(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(34), D = c.s(24), H = 12, B = .8;
  const S = c.shell(g, { W, D, H, y: B, t: .5, mat: { tex: 'plank', color: c.vary(0x6b4527) }, door: { w: 10, h: 9.6, type: 'slide', mat: { tex: 'plank', color: 0x9a6a3e }, noBrace: false }, wins: [win('F', -11, 6, 7, 10.5, { fill: shoji() }), win('F', 11, 6, 7, 10.5, { fill: shoji() }), win('L', -5, 8, 7, 10.5, { fill: shoji() }), win('L', 6, 8, 7, 10.5, { fill: shoji() }), win('R', -5, 8, 7, 10.5, { fill: shoji() }), win('R', 6, 8, 7, 10.5, { fill: shoji() }), win('B', 0, 10, 7, 10.5, { fill: shoji() })], floorMat: { tex: 'plank', color: 0xb98550, tile: 3 }, frame: DARK, corner: DARK, stepMat: 0x8a847b });
  timberAll(c, S, DARK, 5.7, 0);
  c.box(g, W + 1, B, D + 1, 0, 0, 0, { tex: 'stone', color: 0x8a847b }); c.box(g, 12, B * .5, 2, 0, 0, D / 2 + 1.9, 0x8a847b);
  const R = c.roofGroup(g);
  c.roof(R, { style: 'curve', W, D, ridge: 'x', h: 9.5, over: 3.4, overEnd: 2.4, y: B + H, mat: { tex: 'tile', color: 0x3f4a52, side: 'double' } });
  c.cylH(R, .9, W + 5.5, 0, B + H + 9.7, 0, 0x2a2e33, 'x', 6); for (const s of [-1, 1]) c.sph(R, 1.2, s * (W / 2 + 3), B + H + 10.4, 0, 0xc8a050, 1, 1.3, 1, 6);
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .5, hz = D / 2 - .5;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) c.box(I, 4.8, .12, 4.8, -5 + i * 5, fy, -4 + j * 5, { tex: 'tatami', color: 0xb5b27a, tile: 4 });
  for (const x of [-hx + 3, hx - 3]) { const m = c.grp(I, 'Mokujin', x, fy, -3); c.cyl(m, .7, .7, 5.5, 0, 0, 0, WOODC, 6); for (const [hy, s] of [[3.2, 1], [4.2, -1]]) c.cylH(m, .22, 2.6, s * 1.1, hy, .3, WOODD, 'x', 5); c.cyl(m, .18, .18, 1.8, 0, 1, .6, WOODD, 4).rotation.x = 1.4; c.sph(m, .75, 0, 6, 0, WOODL, 1, 1, 1, 6); }
  const rk = c.grp(I, 'WeaponRack', 0, fy, -hz + .6); c.box(rk, 10, .3, .5, 0, 2, 0, DARK); c.box(rk, 10, .3, .5, 0, 5, 0, DARK); for (const x of [-5, 5]) c.box(rk, .4, 6, .5, x, 0, 0, DARK);
  for (let i = 0; i < 8; i++) { const w = c.cyl(rk, .13, .13, 6.5, -4.2 + i * 1.2, .1, .45, i % 3 ? 0xd8b45a : 0x6b4527, 4); w.rotation.z = (i % 2 - .5) * .04; }
  const dr = c.grp(I, 'Taiko', hx - 3, fy, -hz + 3); c.cylH(dr, 2, 2.4, 0, 3.2, 0, 0x8a2a2a, 'z', 10); c.box(dr, 2.6, 2, .6, 0, 0, -1, DARK); c.box(dr, .5, 2.2, .5, -1.5, 0, 0, DARK); c.box(dr, .5, 2.2, .5, 1.5, 0, 0, DARK);
  const ka = c.grp(I, 'Kamidana', 0, fy, -hz + .1); c.box(ka, 5, .3, 1.8, 0, 7.5, .9, DARK); c.box(ka, 3.4, 2, 1.4, 0, 7.8, .9, 0xb98550); c.mesh(ka, new THREE.ConeGeometry(2.6, 1.2, 4), 0x4a4f55, 0, 10.4, .9).rotation.y = .78;
  c.lantern(I, -hx + 1.5, fy + 8, hz - 1.5, 0xffd98a); c.lantern(I, hx - 1.5, fy + 8, hz - 1.5, 0xffd98a);
  const pole = c.cyl(g, .3, .35, 17, -W / 2 - 4, 0, D / 2 + 2, WOODD, 6); c.flag(g, -W / 2 - 3.8, 11, D / 2 + 2, 6, 5.4, 0xa8412e);
  return c.done(g);
}
function jpNinja(THREE, seed = 0, o) {
  const [c, g] = setup(THREE, seed, o); const W = c.s(17), D = c.s(14), H = 18.6, SP = 8.2, PK = 7;      // выше (было 10.6): над антресолью на высоте 8.6 человек проходит (≥ 9)
  const wm = { tex: 'plank', color: c.vary(0x7a6a55) };
  const S = c.shell(g, { W, D, H, mat: wm, door: { w: 5, h: 8.8, x: -2 }, wins: [win('F', 4.5, 2.4, 4.5, 7.5), win('L', 3, 2.4, 4.5, 7.5), win('R', -2, 2.4, 4.5, 7.5)], corner: 0x3a2c20, frame: 0x3a2c20, floorMat: { tex: 'tatami', color: 0x9a9560, tile: 4 }, beams: 0 });
  // фронтоны (треугольники, уходят в Body)
  const body = S.body;
  for (const s of [-1, 1]) { const m = c.prism(body, [[-D / 2, 0], [D / 2, 0], [0, PK]], .45, s * (W / 2 - .225), H, 0, wm, 'Gable'); m.rotation.y = Math.PI / 2; }
  // антресоль-лофт и лестница
  const lf = c.grp(g, 'Loft'); const lh = 8.6; c.box(lf, W - 1, .35, 5.2, 0, lh, -D / 2 + 3.1, { tex: 'plank', color: 0x5a3a20 });
  for (const x of [-W / 2 + 1, 0, W / 2 - 1]) c.box(lf, .4, lh, .4, x, 0, -D / 2 + 5.6, 0x3a2c20); c.ladder(lf, -3, .4, -D / 2 + 5.8, lh + 1, 0);
  const I = c.grp(g, 'Interior'), fy = S.fy, hx = W / 2 - .5;
  c.firepit(I, 3, fy, 0, 1.4); c.table(I, hx - 3, fy, 3, 4, 3, 0, 1.6); c.cushion(I, hx - 3, fy, 5.6, 0x2f4a6a); c.cushion(I, hx - 3, fy, .5, 0x2f4a6a); c.bed(I, -hx + 3, fy, 2.4, 0, 0x2a2a30, 6.5, 3.6);
  const sw = c.grp(I, 'SecretWall', -4, fy, -D / 2 + .5); const pn = c.grp(sw, '', -2.5, 0, .1); c.box(pn, 5, 8, .3, 2.5, 0, 0, wm); const op = !!c.opts.doorOpen; pn.rotation.y = op ? -1.2 : 0; pn.userData.setOpen = b => pn.rotation.y = b ? -1.2 : 0; c.doors.push(pn);
  for (let i = 0; i < 4; i++) { const w = c.cyl(I, .1, .1, 5, 2 + i * 1, lh + .4, -D / 2 + 2, 0x3b3a38, 3); w.rotation.z = 1.4; }
  c.box(lf, 2.4, 1.4, 1.6, 5, lh + .35, -D / 2 + 3, 0x3b3a38); c.chest(lf, -4, lh + .35, -D / 2 + 2.2, 0, .9);
  const R = c.roofGroup(g);
  const rm = { tex: 'thatch', color: c.vary(0x9a7f45), side: 'double' };
  c.slabRoof(R, { y: H, s: W / 2 * 0 + D / 2 + .6, ye: -.5, h: PK + .6, D: W + 2.2, th: .7, mat: rm, ridge: 0x6b4527, ext: 1.2, hatch: { w: 3.6, c: 2.5 } });
  const slab = R.children[0]; slab.rotation.y = Math.PI / 2;
  const hg = slab.userData.hatch; if (hg) { R.userData.hatch = hg; c.doors.push({ userData: { setOpen: b => hg.userData.setOpen(b) } }); }
  c.box(R, 3.8, .5, .5, 0, H + PK + .8, 6, 0x3a2c20).visible = false;
  return c.done(g);
}

export const MODELS = [
  { id: 'hut_thatch', name: 'Хижина соломенная', group: 'houses', make: hutThatch },
  { id: 'hut_log', name: 'Хижина бревенчатая', group: 'houses', make: hutLog },
  { id: 'hut_stone', name: 'Хижина каменная', group: 'houses', make: hutStone },
  { id: 'hut_stilts', name: 'Хижина на сваях', group: 'houses', make: hutStilts },
  { id: 'hut_chimney', name: 'Хижина с трубой', group: 'houses', make: hutChimney },
  { id: 'hut_two_floor', name: 'Двухэтажная малая', group: 'houses', make: hutTwoFloor },
  { id: 'big_hall', name: 'Длинный дом', group: 'houses', make: bigHall },
  { id: 'tavern', name: 'Таверна', group: 'houses', make: tavern },
  { id: 'manor', name: 'Большой дом с башней', group: 'houses', make: manor },
  { id: 'inn', name: 'Постоялый двор', group: 'houses', make: inn },
  { id: 'town_narrow', name: 'Городской узкий', group: 'houses', make: townNarrow },
  { id: 'town_wide', name: 'Городской широкий', group: 'houses', make: townWide },
  { id: 'town_mansard', name: 'Городской с мансардой', group: 'houses', make: townMansard },
  { id: 'town_shop', name: 'Городской с лавкой', group: 'houses', make: townShop },
  { id: 'town_balcony', name: 'Городской с балконом', group: 'houses', make: townBalcony },
  { id: 'town_corner', name: 'Городской угловой', group: 'houses', make: townCorner },
  { id: 'fish_a', name: 'Рыбацкая с сетью и лодкой', group: 'houses', make: fishA },
  { id: 'fish_b', name: 'Рыбацкий дом на причале', group: 'houses', make: fishB },
  { id: 'fish_c', name: 'Рыбацкая лачуга-лодка', group: 'houses', make: fishC },
  { id: 'jp_house', name: 'Японский дом (сёдзи)', group: 'houses', make: jpHouse },
  { id: 'jp_tea', name: 'Чайный домик', group: 'houses', make: jpTea },
  { id: 'jp_dojo', name: 'Додзё', group: 'houses', make: jpDojo },
  { id: 'jp_ninja', name: 'Хижина ниндзи (тайная крыша)', group: 'houses', make: jpNinja },
  { id: 'farm_a', name: 'Ферма с сараем', group: 'houses', make: farmA },
  { id: 'farm_b', name: 'Ферма с гамбрел-сараем и силосом', group: 'houses', make: farmB },
  { id: 'pirate_a', name: 'Лачуга пирата (парус)', group: 'houses', make: pirateA },
  { id: 'pirate_b', name: 'Лачуга-перевёрнутый корпус', group: 'houses', make: pirateB },
  { id: 'pirate_c', name: 'Лачуга на бочках с мачтой', group: 'houses', make: pirateC },
  { id: 'tent_a', name: 'Палатка', group: 'houses', make: tentA },
  { id: 'tent_round', name: 'Шатёр круглый', group: 'houses', make: tentRound },
  { id: 'tent_commander', name: 'Шатёр командира', group: 'houses', make: tentCommander },
];
