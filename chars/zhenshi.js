// Чжэнь Ши — самурай-абордажник. Модель перенесена ОДИН В ОДИН из Чжен Ши/3D/zhenshi.html
// (материалы, текстуры, торс, голова, шлем, волосы, руки, ноги, двусторонний меч) и надета на риг Ричарда:
// все меши Ричарда скрываются, меши Чжэнь Ши крепятся к тем же суставам, поэтому клипы Ричарда работают как есть.
// Отличия от оригинала из-за другой риги: рука разбита на Shoulder (плечо + верх рукава) / Elbow (низ рукава) / Wrist (запястье, кисть),
// меч — в левой кисти (клинки вдоль +z), голень и стопа — на колене. Секундарное движение (полы, пряди) статично.

export function dress(c, { THREE, RoundedBoxGeometry }) {
  // 1) убрать Ричарда: аксессуары удалить, остальные меши скрыть; суставы не трогаем
  const kill = [];
  c.traverse(o => {
    if (o.name === 'Sword' || o.name === 'Shield' || o.name === 'Crown' || o.name.startsWith('Tabard')) kill.push(o);
    else if (o.isMesh) o.visible = false;
  });
  kill.forEach(o => o.removeFromParent());

  const get = n => c.getObjectByName(n);
  const torso = get('Torso'), head = get('Head');
  if (!torso || !head) return;

  /* ───── хелперы (как в zhenshi.html) ───── */
  const rb = (w, h, d, r = 0.12, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  function mesh(parent, geo, mat, x = 0, y = 0, z = 0, name) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; if (name) m.name = name; parent.add(m); return m;
  }
  function joint(parent, name, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; }
  function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const plastic = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, ...o });

  /* ───── текстуры ───── */
  function drawLion(g, cx, cy, s, mane, face, ink, crown) {
    g.save(); g.translate(cx, cy); g.scale(s, s);
    g.fillStyle = mane; g.beginPath();
    const N = 18;
    for (let i = 0; i < N * 2; i++) {
      const a = i / (N * 2) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.8 : 1.0;
      g.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r + 0.12);
    }
    g.closePath(); g.fill();
    g.fillStyle = face; g.beginPath(); g.ellipse(0, 0.14, 0.56, 0.62, 0, 0, 7); g.fill();
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 0.5, -0.4, 0.15, 0, 7); g.fill(); }
    g.fillStyle = ink;
    for (const sx of [-1, 1]) {
      g.beginPath(); g.moveTo(sx * 0.1, -0.02); g.lineTo(sx * 0.44, -0.16); g.lineTo(sx * 0.36, 0.04); g.closePath(); g.fill();
    }
    g.beginPath(); g.moveTo(-0.15, 0.2); g.lineTo(0.15, 0.2); g.lineTo(0, 0.34); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(0, 0.47, 0.27, 0.17, 0, 0, Math.PI); g.fill();
    g.fillStyle = face;
    for (const sx of [-0.12, 0.12]) { g.beginPath(); g.moveTo(sx - 0.045, 0.47); g.lineTo(sx + 0.045, 0.47); g.lineTo(sx, 0.57); g.fill(); }
    g.fillStyle = crown; g.beginPath();
    g.moveTo(-0.46, -0.78); g.lineTo(-0.5, -1.2); g.lineTo(-0.24, -0.98); g.lineTo(0, -1.32); g.lineTo(0.24, -0.98); g.lineTo(0.5, -1.2); g.lineTo(0.46, -0.78);
    g.closePath(); g.fill();
    for (const [x, y] of [[-0.5, -1.22], [0, -1.34], [0.5, -1.22]]) { g.beginPath(); g.arc(x, y, 0.06, 0, 7); g.fill(); }
    g.restore();
  }
  const lionTex = canvasTex(512, 435, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    drawLion(g, w / 2, 190, 118, '#f2f4f9', '#dfe5f3', '#2a45c2', '#f6f8fc');
  });
  const R_HEAD = 1.0, H_HEAD = 1.9;
  const faceTex = canvasTex(2048, 512, (g, W, H) => {
    g.fillStyle = '#f6c2a8'; g.fillRect(0, 0, W, H);
    const px = x => W / 2 + Math.asin(Math.max(-1, Math.min(1, x / R_HEAD))) / (2 * Math.PI) * W;
    const py = y => (1 - y / H_HEAD) * H;
    g.fillStyle = '#4a2820';
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(px(sx * 0.3), py(0.64), 38, 36, 0, 0, 7); g.fill(); }
    g.beginPath(); g.moveTo(px(-0.26), py(0.4)); g.quadraticCurveTo(px(0), py(0.1), px(0.26), py(0.4));
    g.quadraticCurveTo(px(0), py(0.34), px(-0.26), py(0.4)); g.fill();
  }); faceTex.wrapS = THREE.RepeatWrapping;
  const hairBump = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w; g.strokeStyle = Math.random() < .5 ? '#d0d0d0' : '#303030'; g.lineWidth = 2 + Math.random() * 3;
      g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (Math.random() - .5) * 14, h / 2, x + (Math.random() - .5) * 10, h); g.stroke();
    }
  }); hairBump.wrapS = hairBump.wrapT = THREE.RepeatWrapping;
  const braidTex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#c4962a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a07a1c'; g.lineWidth = 4;
    for (let x = -h; x < w + h; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * 0.8, h); g.stroke(); }
    g.strokeStyle = '#e8c660'; g.lineWidth = 3;
    for (let x = -h + 8; x < w + h; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * 0.8, h); g.stroke(); }
  }); braidTex.wrapS = braidTex.wrapT = THREE.RepeatWrapping;

  const M = {
    skin: plastic(0xf5c0a6, { roughness: 0.45 }),
    hair: plastic(0x9a9ca3, { roughness: 0.5, side: THREE.DoubleSide, bumpMap: hairBump, bumpScale: 1.4 }),
    helmet: new THREE.MeshPhysicalMaterial({ color: 0x8d9096, metalness: 0.55, roughness: 0.34, side: THREE.DoubleSide }),
    gold: new THREE.MeshPhysicalMaterial({ color: 0xd9ac2e, metalness: 0.5, roughness: 0.3 }),
    braid: new THREE.MeshPhysicalMaterial({ map: braidTex, bumpMap: braidTex, bumpScale: 2, metalness: 0.5, roughness: 0.38 }),
    blue: plastic(0x2740b8), red: plastic(0xc41a1d), black: plastic(0x1c1c1f, { roughness: 0.42 }),
    sleeve: plastic(0x4a4c51, { roughness: 0.4, metalness: 0.25 }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0xd2d5da, metalness: 0.45, roughness: 0.3 }),
    grip: plastic(0x8f1b22), guard: plastic(0xb3131b),
  };

  /* ───── торс: синий табард ───── */
  mesh(torso, rb(2.5, 1.7, 1.3, 0.22), M.blue, 0, 1.35, 0, 'Chest');
  mesh(torso, rb(2.3, 0.9, 1.15, 0.2), M.red, 0, 0.2, 0, 'Hips');
  {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.7), new THREE.MeshPhysicalMaterial({
      map: lionTex, transparent: true, alphaTest: 0.4, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
    p.position.set(0, 1.35, 0.658); p.name = 'Lion'; p.castShadow = true; torso.add(p);
  }
  // пояс
  mesh(torso, rb(2.58, 0.3, 1.38, 0.08, 3), M.black, 0, 0.62, 0, 'Belt');
  {
    const b = mesh(torso, new THREE.TorusGeometry(0.2, 0.07, 10, 28), plastic(0x3a3a3e, { metalness: 0.5 }), 0, 0.62, 0.72, 'Buckle'); b.scale.set(1, 1.1, 1);
    mesh(torso, new THREE.CylinderGeometry(0.07, 0.07, 0.3, 12), M.black, 0, 0.62, 0.72).rotation.x = Math.PI / 2;
    const st = mesh(torso, new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), M.black, -0.5, 0.62, -0.72); st.rotation.x = Math.PI / 2;
  }
  // полы табарда
  for (const [name, z] of [['ZsFlapF', 0.64], ['ZsFlapB', -0.64]]) {
    const j = joint(torso, name, 0, 0.5, z);
    const g = rb(2.28, 0.72, 0.14, 0.05, 3); g.translate(0, -0.34, 0);
    mesh(j, g, M.blue, 0, 0, 0, name + 'Cloth');
  }
  // золотой плетёный воротник и шея
  const collar = mesh(torso, new THREE.TorusGeometry(0.85, 0.3, 16, 56), M.braid, 0, 2.42, 0, 'Collar'); collar.rotation.x = Math.PI / 2;
  collar.material.map.repeat.set(7, 1); collar.material.bumpMap.repeat.set(7, 1);
  mesh(torso, new THREE.CylinderGeometry(0.62, 0.7, 0.5, 28), M.skin, 0, 2.35, 0, 'Neck');

  /* ───── голова (в zhenshi Head на y=2.5, у Ричарда 2.48 — поправка) ───── */
  const hd = joint(head, 'ZsHead', 0, 0.02, 0);
  {
    const prof = new THREE.SplineCurve([[0, 0], [0.55, 0.02], [0.86, 0.18], [0.985, 0.55], [1.0, 0.95], [0.99, 1.3], [0.9, 1.62], [0.65, 1.82], [0.3, 1.895], [0, 1.9]].map(p => new THREE.Vector2(...p))).getPoints(48);
    const geo = new THREE.LatheGeometry(prof, 56);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, Math.atan2(pos.getX(i), pos.getZ(i)) / (2 * Math.PI) + 0.5, pos.getY(i) / H_HEAD);
    mesh(hd, geo, new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.42 }), 0, 0, 0, 'HeadShell');
    // шлем
    const helmet = joint(hd, 'Helmet');
    const crown = new THREE.LatheGeometry([[1.1, 0.96], [1.14, 1.15], [1.14, 1.45], [1.06, 1.8], [0.82, 2.06], [0.42, 2.2], [0, 2.24]].map(p => new THREE.Vector2(...p)), 56);
    mesh(helmet, crown, M.helmet, 0, 0, 0, 'HelmetCrown');
    const brim = new THREE.LatheGeometry([[1.12, 1.0], [1.45, 0.97], [1.72, 0.89], [1.77, 0.85], [1.73, 0.82], [1.45, 0.9], [1.1, 0.93]].map(p => new THREE.Vector2(...p)), 64);
    mesh(helmet, brim, M.helmet, 0, 0, 0, 'Brim');
    const ridge = mesh(helmet, new THREE.TorusGeometry(1.1, 0.045, 8, 40, Math.PI), M.helmet, 0, 1.18, 0, 'Ridge'); ridge.rotation.y = Math.PI / 2;
    mesh(helmet, new THREE.SphereGeometry(0.1, 12, 8), M.helmet, 0, 2.27, 0);
    const band = mesh(helmet, new THREE.TorusGeometry(1.145, 0.04, 8, 56), M.helmet, 0, 1.02, 0, 'HelmetBand'); band.rotation.x = Math.PI / 2;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; mesh(helmet, new THREE.SphereGeometry(0.055, 8, 6), M.helmet, Math.sin(a) * 1.165, 1.12, Math.cos(a) * 1.165); }
    // волосы: три пряди
    const hairLock = (name, a0, a1) => {
      const j = joint(hd, name, 0, 0.95, 0);
      const g = new THREE.CylinderGeometry(1.07, 1.12, 1.3, 24, 6, true, THREE.MathUtils.degToRad(a0), THREE.MathUtils.degToRad(a1 - a0)); g.translate(0, -0.65, 0);
      mesh(j, g, M.hair, 0, 0, 0, name + 'Shell');
    };
    hairLock('ZsHairL', 36, 112); hairLock('ZsHairBack', 112, 248); hairLock('ZsHairR', 248, 324);
  }

  /* ───── руки ───── */
  function handGeo() {
    const R = 0.34, r = 0.165, gap = 0.75, s = new THREE.Shape();
    const a0 = -Math.PI / 2 + gap / 2, a1 = -Math.PI / 2 + Math.PI * 2 - gap / 2;
    s.absarc(0, 0, R, a0, a1, false); s.absarc(0, 0, r, a1, a0, true); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2, curveSegments: 28 });
    g.translate(0, 0, -0.275); return g;
  }
  // у Ричарда плечо на x=±1.52, у Чжэнь Ши ±1.55; Elbow на -0.85, Wrist на -1.55 от плеча (у Чжэнь Ши кисть на -1.8)
  function buildArm(side) {
    const L = side > 0, sx = side * 0.03;
    const sh = get(L ? 'ShoulderL' : 'ShoulderR'), el = get(L ? 'ElbowL' : 'ElbowR'), wr = get(L ? 'WristL' : 'WristR');
    if (!sh || !el || !wr) return null;
    const EY = -0.85;                                   // сустав локтя в системе плеча
    mesh(sh, new THREE.SphereGeometry(0.46, 24, 16), M.sleeve, sx, 0, 0, 'ShoulderCap');
    // рукав 1.35 (от -0.025 до -1.375): верх на плече, низ на локте, разрез на локтевом суставе
    const rS = 0.42 - 0.04 * ((-0.025 - EY) / 1.35);   // радиус в месте разреза
    mesh(sh, new THREE.CylinderGeometry(0.42, rS, -0.025 - EY, 24), M.sleeve, sx, (-0.025 + EY) / 2, 0, 'Sleeve');
    mesh(el, new THREE.CylinderGeometry(rS, 0.38, EY + 1.375, 24), M.sleeve, sx, (EY - 1.375) / 2 - EY, 0, 'SleeveLow');
    const ring = mesh(sh, new THREE.TorusGeometry(0.4, 0.03, 6, 24), M.black, sx, -0.75, 0); ring.rotation.x = Math.PI / 2;
    // запястье (в zhenshi y=-1.5 от плеча) и кисть (y=-1.8): Wrist-сустав Ричарда на -1.55
    mesh(wr, new THREE.CylinderGeometry(0.2, 0.22, 0.4, 16), M.skin, sx, -1.5 + 1.55, 0, 'ZsWrist');
    mesh(wr, handGeo(), M.skin, sx, -0.25, 0, 'Hand');
    return wr;
  }
  const wristL = buildArm(+1); buildArm(-1);

  /* ───── ноги: бедро на Hip, голень и стопа на Knee (колено Ричарда на -1.55) ───── */
  function buildLeg(side) {
    const L = side > 0, hip = get(L ? 'HipL' : 'HipR'), knee = get(L ? 'KneeL' : 'KneeR');
    if (!hip || !knee) return;
    mesh(hip, rb(0.96, 1.5, 0.96, 0.2), M.gold, 0, -0.76, 0, 'ThighCore');
    mesh(hip, rb(0.74, 1.45, 1.12, 0.18), M.red, side * 0.12, -0.72, 0, 'ThighRed');
    mesh(knee, rb(0.98, 1.6, 1.02, 0.2), M.gold, 0, -2.2 + 1.55, 0, 'Boot');
    mesh(knee, rb(0.98, 0.45, 1.5, 0.18), M.gold, 0, -2.78 + 1.55, 0.22, 'Foot');
  }
  buildLeg(+1); buildLeg(-1);

  /* ───── меч: двусторонний, рукоять посередине, клинок слегка изогнут ─────
     в zhenshi меч вертикальный (вдоль y); здесь обёрнут поворотом, чтобы клинки шли вдоль ±z, хват в z=0 (в отверстии кисти) */
  if (wristL) {
    const sword = joint(wristL, 'Sword', 0.03, -0.25, 0);
    const sw = joint(sword, 'SwordShape'); sw.rotation.x = Math.PI / 2;
    function blade(Len, flip) {
      const s = new THREE.Shape(); s.moveTo(-0.24, 0); s.lineTo(0.24, 0); s.lineTo(0.24, Len - 0.5); s.quadraticCurveTo(0.2, Len - 0.12, -0.03, Len); s.lineTo(-0.24, Len - 0.45); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 6 });
      g.translate(0, 0, -0.035);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) + 0.02 * y * y); }
      if (flip) g.rotateZ(Math.PI);
      g.translate(0, flip ? -0.95 : 0.95, 0); g.computeVertexNormals(); return g;
    }
    mesh(sw, blade(3.2, false), M.steel, 0, 0, 0, 'BladeTop');
    mesh(sw, blade(4.0, true), M.steel, 0, 0, 0, 'BladeBottom');
    mesh(sw, new THREE.CylinderGeometry(0.14, 0.14, 1.7, 18), M.grip, 0, 0, 0, 'Grip');
    { const rg = new THREE.TorusGeometry(0.145, 0.025, 6, 16), rm = plastic(0x6e1218); for (let i = 0; i < 9; i++) { const t = mesh(sw, rg, rm, 0, -0.7 + i * 0.175, 0); t.rotation.x = Math.PI / 2; } }
    for (const sy of [-1, 1]) mesh(sw, rb(0.62, 0.22, 0.36, 0.09, 3), M.guard, 0, sy * 0.9, 0, 'Guard');
  }
}
