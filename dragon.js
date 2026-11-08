// dragon.js — драконы: процедурная 3D-модель (тело-труба с чешуёй, шипы, рога, голова с челюстью, крылья с костями и перепонкой, ноги),
// полёт верхом (A/D — поворот, W/S — нырок/подъём, Shift — ускорение, Пробел/ЛКМ — огненное дыхание, V — призвать/слезть вне боёв),
// огненное дыхание (частицы + свет) и режим «Поединки драконов»: пламя сжигает ВСАДНИКА чужого дракона (сам дракон неуязвим).
// Дракон — это всадник: у других игроков дракон строится по положению их фигуры + короткому полю dg из сообщения 'st' (тангаж, крен, огонь, окраска).
const PALETTES = [
  { body: 0xb8281f, belly: 0xf0c27a, mem: 0xd24a2a, horn: 0xf3e2b8, eye: 0xffd23a, name: 'алый' },
  { body: 0x1f8f4e, belly: 0xe8e0a0, mem: 0x2fb06a, horn: 0xe6dcc0, eye: 0xff7a1a, name: 'изумрудный' },
  { body: 0x2457c9, belly: 0xcfe7ff, mem: 0x4a86e8, horn: 0xeef4ff, eye: 0x7fffd4, name: 'сапфировый' },
  { body: 0x7a2fc0, belly: 0xf0d0ff, mem: 0xa855e0, horn: 0xffe0a0, eye: 0xff5ad0, name: 'аметистовый' },
  { body: 0xd89a1a, belly: 0xfff0b8, mem: 0xf2c040, horn: 0x6b3a1a, eye: 0xff3030, name: 'золотой' },
];
const SEAT = 4.4, LIFT = 4.2;                      // от седла до ступней всадника (как у лошади)

export function createDragons({ THREE, scene, world, richard, net, camera, renderer }) {
  const V = THREE.Vector3, P = richard.P, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const hAt = (x, z) => { const h = world.heightAt(x, z); return h < 0.3 ? -3 : h; };      // над водой «земля» — чуть ниже поверхности: дракон может сесть на воду и плыть над ней низко

  /* ───── текстура чешуи ───── */
  const scaleTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, 128, 128); g.lineWidth = 2;
    for (let row = 0; row < 8; row++) for (let col = -1; col < 9; col++) {
      const x = col * 16 + (row % 2 ? 8 : 0), y = row * 16 + 8;
      g.beginPath(); g.arc(x, y, 9.5, 0, Math.PI); g.fillStyle = row % 2 ? '#f4f4f4' : '#fbfbfb'; g.fill(); g.strokeStyle = 'rgba(70,60,60,.55)'; g.stroke();
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  /* ───── обобщённая «труба» с переменным радиусом (тело, шея, хвост, рога, лапы) ───── */
  function sweep(rings, sides, colorFn, uvk = [3, 12]) {
    const n = (sides + 1) * rings, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < rings; i++) for (let j = 0; j <= sides; j++) {
      const k = i * (sides + 1) + j, th = j / sides * Math.PI * 2, c = colorFn(i / (rings - 1), Math.sin(th));
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; uv[k * 2] = j / sides * uvk[0]; uv[k * 2 + 1] = i / (rings - 1) * uvk[1];
      if (i < rings - 1 && j < sides) { const a = k, b = k + sides + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    const T = new V(), N = new V(), S = new V(), X = new V(1, 0, 0), Y = new V(0, 1, 0);
    geo.userData.fill = (pts, radii, wS = 1, hS = 1) => {
      for (let i = 0; i < rings; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(rings - 1, i + 1)]; T.subVectors(b, a).normalize();
        N.crossVectors(T, X); if (N.lengthSq() < 1e-4) N.copy(Y); N.normalize(); S.crossVectors(N, T).normalize();
        const p = pts[i], r = radii[i];
        for (let j = 0; j <= sides; j++) {
          const th = j / sides * Math.PI * 2, c = Math.cos(th) * wS * r, s = Math.sin(th) * hS * r, k = (i * (sides + 1) + j) * 3;
          pos[k] = p.x + S.x * c + N.x * s; pos[k + 1] = p.y + S.y * c + N.y * s; pos[k + 2] = p.z + S.z * c + N.z * s;
        }
      }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.userData.N = N;
    };
    return geo;
  }
  const solidCol = c => () => c;
  function tube(ctrl, radii, mat, color, rings = 12, sides = 7) {              // неподвижная труба по точкам (рога, лапы)
    const curve = new THREE.CatmullRomCurve3(ctrl), rc = new THREE.CatmullRomCurve3(radii.map(r => new V(r, 0, 0)));
    const pts = [], rs = []; for (let i = 0; i < rings; i++) { const u = i / (rings - 1); pts.push(curve.getPoint(u)); rs.push(Math.max(0.03, rc.getPoint(u).x)); }
    const g = sweep(rings, sides, solidCol(new THREE.Color(color)), [1, 1]); g.userData.fill(pts, rs); return new THREE.Mesh(g, mat);
  }

  /* ───── модель дракона ───── */
  function makeDragon(pal) {
    const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);      // rig — покачивание корпуса; root — положение/поворот в мире
    const cBody = new THREE.Color(pal.body), cBelly = new THREE.Color(pal.belly), cMem = new THREE.Color(pal.mem), cDark = cBody.clone().multiplyScalar(0.55);
    const matBody = new THREE.MeshStandardMaterial({ vertexColors: true, map: scaleTex, roughness: 0.5, metalness: 0.12 });
    const matPlain = new THREE.MeshStandardMaterial({ color: pal.body, roughness: 0.5, metalness: 0.1 });
    const matDark = new THREE.MeshStandardMaterial({ color: cDark, roughness: 0.6 });
    const matHorn = new THREE.MeshStandardMaterial({ color: pal.horn, roughness: 0.35, metalness: 0.25 });
    const matMem = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.65, emissive: new THREE.Color(pal.mem).multiplyScalar(0.22), transparent: true, opacity: 0.94 });
    const matEye = new THREE.MeshStandardMaterial({ color: pal.eye, emissive: pal.eye, emissiveIntensity: 1.4, roughness: 0.2 });
    const matBlack = new THREE.MeshBasicMaterial({ color: 0x0a0505 });
    const matTooth = new THREE.MeshStandardMaterial({ color: 0xf5eedc, roughness: 0.4 });

    /* корпус: хвост → тело → шея; шипы вдоль хребта */
    const CTRL = [[-46, -1.5, .12], [-38, -4.6, .45], [-30, -5.4, .95], [-22, -4.4, 1.7], [-14, -3.6, 2.7], [-7, -3.3, 3.4], [-1, -3.3, 3.7], [4, -2.7, 3.2], [8, -1.2, 2.5], [11.5, 1.2, 2.1], [14, 3.2, 1.9], [16, 4.2, 1.75]];
    const RINGS = 64, SIDES = 14, radii = [];
    { const rc = new THREE.CatmullRomCurve3(CTRL.map(c => new V(c[2], 0, 0))); for (let i = 0; i < RINGS; i++) radii.push(Math.max(0.05, rc.getPoint(i / (RINGS - 1)).x)); }
    const bodyGeo = sweep(RINGS, SIDES, (t, s) => { const c = new THREE.Color(); const bel = clamp(-s * 2.2 + 0.2, 0, 1); c.copy(cBody).lerp(cDark, 0.55 * (1 - t) * (1 - t)).lerp(cBelly, bel * 0.92); return c; }, [4, 16]);
    const body = new THREE.Mesh(bodyGeo, matBody); body.frustumCulled = false; rig.add(body);
    const SPK = 34, spikes = [], spkGeo = new THREE.ConeGeometry(0.55, 2.0, 5); spkGeo.translate(0, 1.0, 0);
    for (let i = 0; i < SPK; i++) { const m = new THREE.Mesh(spkGeo, matHorn); m.userData.u = 0.1 + i / (SPK - 1) * 0.87; rig.add(m); spikes.push(m); }
    const pts = Array.from({ length: RINGS }, () => new V()), ctrlV = CTRL.map(c => new V(0, c[1], c[0])), Tt = new V(), curve = new THREE.CatmullRomCurve3(ctrlV);

    /* голова */
    const head = new THREE.Group(); rig.add(head);
    const cran = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 12), matPlain); cran.scale.set(1.05, 0.95, 1.45); cran.position.set(0, 0.25, 2.0); head.add(cran);
    const sn = new THREE.CylinderGeometry(0.75, 1.5, 5.5, 10); sn.rotateX(Math.PI / 2); const snout = new THREE.Mesh(sn, matPlain); snout.scale.set(1, 0.7, 1); snout.position.set(0, 0, 5.2); head.add(snout);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), matPlain); bulb.scale.set(1, 0.7, 1.1); bulb.position.set(0, -0.02, 7.9); head.add(bulb);
    const jawPivot = new THREE.Group(); jawPivot.position.set(0, -0.65, 1.4); head.add(jawPivot);
    const jg = new THREE.CylinderGeometry(0.5, 1.0, 5.3, 8); jg.rotateX(Math.PI / 2); const jaw = new THREE.Mesh(jg, matDark); jaw.scale.set(1, 0.5, 1); jaw.position.set(0, -0.1, 2.7); jawPivot.add(jaw);
    const tg = new THREE.ConeGeometry(0.17, 0.7, 5); tg.translate(0, -0.35, 0);
    for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) {
      const t1 = new THREE.Mesh(tg, matTooth); t1.position.set(sx * (0.9 - i * 0.07), -0.35, 3.2 + i * 0.72); head.add(t1);
      if (i % 2 === 0) { const t2 = new THREE.Mesh(tg, matTooth); t2.rotation.x = Math.PI; t2.position.set(sx * (0.55 - i * 0.02), 0.25, 2.2 + i * 0.62); jawPivot.add(t2); }
    }
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.5, 6), matTooth); f.position.set(sx * 0.7, -1.0, 6.2); f.rotation.x = Math.PI; head.add(f); f.position.y = -1.0; }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.0 })); glow.position.set(0, -0.15, 5.0); head.add(glow);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), matEye); eye.position.set(sx * 1.22, 0.85, 2.9); head.add(eye);
      const pup = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.6, 0.3), matBlack); pup.position.set(sx * 1.62, 0.85, 3.05); pup.rotation.y = sx * 0.55; head.add(pup);
      const brow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), matDark); brow.scale.set(1, 0.4, 1.6); brow.position.set(sx * 1.05, 1.42, 3.0); brow.rotation.x = -0.25; head.add(brow);
      const nos = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), matBlack); nos.position.set(sx * 0.38, 0.28, 8.2); head.add(nos);
      head.add(tube([new V(sx * .9, 1.3, 1.0), new V(sx * 1.5, 2.6, -0.6), new V(sx * 2.2, 3.6, -2.8), new V(sx * 2.7, 4.0, -5.2)], [.55, .42, .27, .04], matHorn, pal.horn, 10, 7));
      head.add(tube([new V(sx * 1.4, -0.1, 1.0), new V(sx * 2.4, -0.2, -0.3), new V(sx * 3.3, -0.9, -1.7)], [.3, .22, .04], matHorn, pal.horn, 8, 6));
      const fin = new THREE.BufferGeometry(); fin.setAttribute('position', new THREE.BufferAttribute(new Float32Array([sx * 1.4, 0.2, 0.2, sx * 4.4, 1.0, -2.3, sx * 3.9, -1.3, -1.9, sx * 1.5, -0.9, 0.6]), 3)); fin.setIndex([0, 1, 2, 0, 2, 3]); fin.computeVertexNormals();
      head.add(new THREE.Mesh(fin, new THREE.MeshStandardMaterial({ color: pal.mem, side: THREE.DoubleSide, roughness: 0.7, emissive: new THREE.Color(pal.mem).multiplyScalar(0.2) })));
    }
    head.position.set(0, 4.2, 16.2); head.rotation.x = 0.22;

    /* лапы (поджаты в полёте) */
    const legM = matBody, legC = pal.body;
    for (const sx of [-1, 1]) {
      const hind = tube([new V(sx * 3.0, -4.0, -11), new V(sx * 4.0, -8.0, -12.8), new V(sx * 3.7, -9.6, -8.8)], [1.5, 1.0, .55], legM, legC, 10, 8); rig.add(hind);
      const fore = tube([new V(sx * 2.8, -5.0, 0.5), new V(sx * 3.2, -8.2, 2.2), new V(sx * 3.0, -9.5, 4.6)], [1.3, .85, .5], legM, legC, 10, 8); rig.add(fore);
      for (const [x, y, z] of [[3.7, -9.7, -8.2], [3.0, -9.6, 5.2]]) for (let c = -1; c <= 1; c++) {
        const cl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.0, 5), matHorn); cl.rotation.x = Math.PI / 2 + 0.4; cl.position.set(sx * x + c * 0.45, y, z + 0.5); rig.add(cl);
      }
    }

    /* крылья: кости + перепонка, пересчитываются каждый кадр по фазе взмаха */
    const L1 = 10.5, L2 = 11.5, LF = [14, 16.5, 14.5, 10.5], PHI = [0.35, -0.15, -0.62, -0.98];
    const boneG = new THREE.CylinderGeometry(1, 1, 1, 6), wings = [];
    for (const side of [-1, 1]) {
      const memGeo = new THREE.BufferGeometry(), nv = 12; memGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const mc = new Float32Array(nv * 3); [0, 9, 10, 11].forEach(i => { const k = (i === 0 ? 0.5 : 0.62); mc[i * 3] = cMem.r * k; mc[i * 3 + 1] = cMem.g * k; mc[i * 3 + 2] = cMem.b * k; });
      [1, 2, 3, 4, 5, 6, 7, 8].forEach(i => { const e = i % 2 === 1 ? 1.12 : 0.92; mc[i * 3] = Math.min(1, cMem.r * e); mc[i * 3 + 1] = Math.min(1, cMem.g * e); mc[i * 3 + 2] = Math.min(1, cMem.b * e); });
      memGeo.setAttribute('color', new THREE.BufferAttribute(mc, 3)); const ix = []; for (let i = 1; i < nv - 1; i++) ix.push(0, i, i + 1); memGeo.setIndex(ix);
      const mem = new THREE.Mesh(memGeo, matMem); mem.frustumCulled = false; rig.add(mem);
      const bones = []; for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(boneG, i < 2 ? matPlain : matDark); b.frustumCulled = false; rig.add(b); bones.push(b); }
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 5), matHorn); rig.add(claw);
      wings.push({ side, memGeo, bones, claw, v: Array.from({ length: 16 }, () => new V()) });
    }
    const S0 = new V(), Bv = new V(), up = new V(0, 1, 0), tmp = new V();
    const placeBone = (b, a, c, r) => { tmp.subVectors(c, a); const len = tmp.length() || 0.01; b.position.copy(a).addScaledVector(tmp, 0.5); b.scale.set(r, len, r); b.quaternion.setFromUnitVectors(up, tmp.multiplyScalar(1 / len)); };
    function poseWing(w, f, fd) {
      const s = w.side, v = w.v; S0.set(s * 2.8, -0.5, -3.2); Bv.set(s * 2.4, -3.3, -13);
      const [Sv, E, W] = [v[0].copy(S0), v[1], v[2]], a1 = 0.1 + f * 0.62, a2 = 0.04 + f * 0.92;
      E.set(S0.x + s * Math.cos(a1) * 0.93 * L1, S0.y + Math.sin(a1) * L1, S0.z + 0.3 * L1);
      W.set(E.x + s * Math.cos(a2) * 0.88 * L2, E.y + Math.sin(a2) * L2, E.z - 0.28 * L2);
      const tips = [v[3], v[4], v[5], v[6]];
      for (let i = 0; i < 4; i++) {
        const ay = a2 * 0.9 - 0.11 * i - fd * 0.17 * (0.6 + i * 0.35), cp = Math.cos(PHI[i]), ca = Math.cos(ay);
        tips[i].set(W.x + s * cp * ca * LF[i], W.y + Math.sin(ay) * LF[i], W.z + Math.sin(PHI[i]) * ca * LF[i]);
      }
      const m = [v[7], v[8], v[9], v[10]];
      for (let i = 0; i < 4; i++) { const nxt = i < 3 ? tips[i + 1] : Bv; m[i].lerpVectors(tips[i], nxt, 0.5).lerp(W, i < 3 ? 0.2 : 0.14); m[i].y -= 0.4; }
      // порядок контура: W, F1, m1, F2, m2, F3, m3, F4, m4, B, S, E
      const poly = [W, tips[0], m[0], tips[1], m[1], tips[2], m[2], tips[3], m[3], Bv, Sv, E], a = w.memGeo.attributes.position.array;
      poly.forEach((p, i) => { a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z; });
      w.memGeo.attributes.position.needsUpdate = true; w.memGeo.computeVertexNormals();
      placeBone(w.bones[0], Sv, E, 0.62); placeBone(w.bones[1], E, W, 0.5); for (let i = 0; i < 4; i++) placeBone(w.bones[2 + i], W, tips[i], 0.22);
      w.claw.position.copy(W); w.claw.quaternion.setFromUnitVectors(up, tmp.set(s * 0.4, 0.6, 0.7).normalize());
    }

    const inst = { root, phase: Math.random() * 6, t: 0, jaw: 0, fire: 0, tail: 0, matBody, mouth: new V(), dir: new V(), mouthL: new V(0, -0.2, 8.6) };
    inst.update = (dt, st) => {      // st: { rate, amp, fire, turn, pitch }
      inst.t += dt; inst.phase += dt * st.rate; { const cyc = Math.floor(inst.phase / 6.2832); if (cyc !== inst.cyc) { inst.cyc = cyc; inst.flapped = true; } }
      const raw = Math.sin(inst.phase + 0.35 * Math.sin(inst.phase)), f = raw * st.amp + (1 - st.amp) * 0.12, fd = Math.cos(inst.phase) * st.amp * (st.rate > 0.5 ? 1 : 0);
      inst.fire += ((st.fire ? 1 : 0) - inst.fire) * Math.min(1, dt * 9); inst.tail += (st.turn - inst.tail) * Math.min(1, dt * 3);
      rig.position.y = -f * 0.35; for (const w of wings) poseWing(w, f, fd);
      // хребет с качанием хвоста и шеи
      CTRL.forEach((c, i) => { const z = c[0], tf = Math.pow(clamp((-8 - z) / 38, 0, 1), 1.3), nf = z > 4 ? clamp((z - 4) / 12, 0, 1) : 0;
        ctrlV[i].x = Math.sin(inst.t * 2.2 + z * 0.12) * 3.2 * tf - inst.tail * 3.2 * tf + Math.sin(inst.t * 1.3) * 0.45 * nf; ctrlV[i].y = c[1] + f * -0.6 * tf * 0.6 + (z > 4 ? Math.sin(inst.t * 1.7) * 0.18 * nf : 0); });
      curve.points = ctrlV; for (let i = 0; i < RINGS; i++) pts[i].copy(curve.getPoint(i / (RINGS - 1)));
      bodyGeo.userData.fill(pts, radii, 1.08, 1);
      for (const sp of spikes) {
        const fi = sp.userData.u * (RINGS - 1), i0 = Math.min(RINGS - 2, Math.floor(fi)), k = fi - i0; sp.position.lerpVectors(pts[i0], pts[i0 + 1], k);
        Tt.subVectors(pts[Math.min(RINGS - 1, i0 + 2)], pts[Math.max(0, i0 - 1)]).normalize();
        const r = lerp(radii[i0], radii[i0 + 1], k); sp.position.y += r * 0.92; sp.quaternion.setFromUnitVectors(up, tmp.set(0, 1, 0).addScaledVector(Tt, -0.45).normalize());
        const sz = 0.5 + r * 0.38; sp.scale.set(sz, sz * (0.9 + 0.5 * Math.sin(sp.userData.u * 9)), sz);
      }
      head.position.copy(pts[RINGS - 1]); head.rotation.x = 0.22;
      jawPivot.rotation.x = 0.04 + inst.fire * 0.62 + Math.sin(inst.t * 1.2) * 0.02; glow.material.opacity = inst.fire * 0.85; glow.scale.setScalar(0.8 + inst.fire * 0.5);
      // пасть и направление дыхания в мировых координатах
      root.updateMatrixWorld(true); head.updateMatrixWorld(true);
      inst.mouth.copy(inst.mouthL); head.localToWorld(inst.mouth); inst.dir.set(0, -0.1, 1).normalize(); inst.dir.transformDirection(head.matrixWorld);
    };
    inst.dispose = () => { root.parent && root.parent.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); [matBody, matPlain, matDark, matHorn, matMem, matEye, matBlack, matTooth].forEach(m => m.dispose()); };
    return inst;
  }

  /* ───── огонь: общий пул частиц ───── */
  const FN = 700, fpos = new Float32Array(FN * 3), fsz = new Float32Array(FN), fcol = new Float32Array(FN * 4);
  const fl = { x: new Float32Array(FN), y: new Float32Array(FN), z: new Float32Array(FN), vx: new Float32Array(FN), vy: new Float32Array(FN), vz: new Float32Array(FN), age: new Float32Array(FN).fill(9), life: new Float32Array(FN).fill(1), s0: new Float32Array(FN), s1: new Float32Array(FN) };
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3).setUsage(THREE.DynamicDrawUsage)); fgeo.setAttribute('aSize', new THREE.BufferAttribute(fsz, 1).setUsage(THREE.DynamicDrawUsage)); fgeo.setAttribute('aCol', new THREE.BufferAttribute(fcol, 4).setUsage(THREE.DynamicDrawUsage));
  const uScale = { value: 600 };
  const fmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale },
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nattribute float aSize; attribute vec4 aCol; uniform float uScale; varying vec4 vC; void main(){ vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=max(1.0,aSize*uScale/max(1.0,-mv.z)); gl_Position=projectionMatrix*mv;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: '#include <common>\n#include <logdepthbuf_pars_fragment>\nvarying vec4 vC; void main(){\n#include <logdepthbuf_fragment>\n float r=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,r); gl_FragColor=vec4(vC.rgb, vC.a*a); }' });
  const fire = new THREE.Points(fgeo, fmat); fire.frustumCulled = false; fire.renderOrder = 30; scene.add(fire);
  let fcur = 0;
  function emit(pos, dir, inherit, n) {
    for (let k = 0; k < n; k++) {
      const i = fcur, sp = 100 + Math.random() * 40; fcur = (fcur + 1) % FN;
      const rx = (Math.random() - 0.5) * 0.2, ry = (Math.random() - 0.5) * 0.2, rz = (Math.random() - 0.5) * 0.2, t = Math.random() * 0.15;
      fl.x[i] = pos.x + dir.x * sp * t; fl.y[i] = pos.y + dir.y * sp * t; fl.z[i] = pos.z + dir.z * sp * t;
      fl.vx[i] = (dir.x + rx) * sp + inherit.x; fl.vy[i] = (dir.y + ry) * sp + inherit.y; fl.vz[i] = (dir.z + rz) * sp + inherit.z;
      fireLive = 1.6; fl.age[i] = 0; fl.life[i] = 0.7 + Math.random() * 0.55; fl.s0[i] = 1.4 + Math.random(); fl.s1[i] = 9 + Math.random() * 5;
    }
  }
  let fireLive = 0;
  function fireTick(dt) {
    if (fireLive <= 0) return; fireLive -= dt;      // огня нет — 700 частиц не обходим
    if (renderer && camera) uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    for (let i = 0; i < FN; i++) {
      if (fl.age[i] >= fl.life[i]) { fsz[i] = 0; fcol[i * 4 + 3] = 0; fpos[i * 3 + 1] = -9999; continue; }
      fl.age[i] += dt; const k = fl.age[i] / fl.life[i];
      fl.x[i] += fl.vx[i] * dt; fl.y[i] += (fl.vy[i] + 6) * dt; fl.z[i] += fl.vz[i] * dt; const dr = 1 - Math.min(1, dt * 1.1); fl.vx[i] *= dr; fl.vy[i] *= dr; fl.vz[i] *= dr;
      fpos[i * 3] = fl.x[i]; fpos[i * 3 + 1] = fl.y[i]; fpos[i * 3 + 2] = fl.z[i]; fsz[i] = fl.s0[i] + (fl.s1[i] - fl.s0[i]) * k;
      let r, g, b, a; if (k < 0.15) { r = 1; g = 0.95; b = 0.7; a = 0.95; } else if (k < 0.5) { const u = (k - 0.15) / 0.35; r = 1; g = 0.95 - 0.4 * u; b = 0.7 - 0.6 * u; a = 0.9; } else if (k < 0.85) { const u = (k - 0.5) / 0.35; r = 1 - 0.15 * u; g = 0.55 - 0.4 * u; b = 0.1 - 0.05 * u; a = 0.85 - 0.4 * u; } else { r = 0.5; g = 0.12; b = 0.05; a = 0.45 * (1 - (k - 0.85) / 0.15); }
      fcol[i * 4] = r; fcol[i * 4 + 1] = g; fcol[i * 4 + 2] = b; fcol[i * 4 + 3] = a;
    }
    fgeo.attributes.position.needsUpdate = fgeo.attributes.aSize.needsUpdate = fgeo.attributes.aCol.needsUpdate = true;
  }
  const flameLight = new THREE.PointLight(0xff8a30, 0, 150, 1.4); scene.add(flameLight);

  /* ───── мой дракон ─────
     Жизненный цикл: none → arrive (подлетает и садится рядом) → landed (ждёт) → mount (игрок забирается: E) → ride (полёт) → land (E у земли: снижается)
     → hop (игрок спрыгивает) → landed → leave (улетает прочь и тает вдали) → none. Дракон не появляется из воздуха и не исчезает на месте. */
  const K = new Set(); let mouseDown = false;
  const typing = () => /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
  addEventListener('keydown', e => {
    if (typing()) return; K.add(e.code);
    if (mine.st === 'ride' && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
    if (e.repeat) return; if (e.code === 'KeyV') onV(); else if (e.code === 'KeyE') onE(); else if (e.code === 'KeyQ') bail();
  });
  addEventListener('keyup', e => K.delete(e.code)); addEventListener('blur', () => { K.clear(); mouseDown = false; });
  addEventListener('mousedown', e => { if (e.button === 0 && document.pointerLockElement) mouseDown = true; }); addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });

  const boxCss = 'position:fixed;left:50%;transform:translateX(-50%);font:600 14px -apple-system,Segoe UI,sans-serif;color:#fff;background:rgba(0,0,0,.5);padding:6px 14px;border-radius:10px;pointer-events:none;display:none;z-index:15;white-space:nowrap';
  const mkBox = bottom => { const d = document.createElement('div'); d.style.cssText = boxCss + ';bottom:' + bottom; document.body.appendChild(d); return d; };
  const hud = mkBox('5%'), toast = mkBox('16%'), prompt_ = mkBox('26%'); let toastT = 0;
  const say = t => { toast.textContent = t; toast.style.display = 'block'; toastT = 2.2; };

  const palOf = id => PALETTES[Math.abs(+id || 0) % PALETTES.length], REST = 10.2, easeN = u => u * u * (3 - 2 * u);
  const mine = { st: 'none', auto: false, d: null, pal: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0, vy: 0, fire: false, turn: 0, boost: 0, camYaw: 0, t: 0, tx: 0, tz: 0, from: new V(), dest: new V(), yaw0: 0, idle: 0, leaveT: 0, leaveMax: 6, emitAcc: 0, fireHitT: {}, rate: 2.3, amp: 1 };
  window.__dragonDbg = mine;
  const sup = { min: new V(), max: new V() }; let supOn = false;
  const setSup = () => { sup.min.set(P.pos.x - 1.3, P.pos.y - 0.9, P.pos.z - 1.3); sup.max.set(P.pos.x + 1.3, P.pos.y, P.pos.z + 1.3); if (!supOn) { richard.solids.push(sup); supOn = true; } };
  const dropSup = () => { if (supOn) { const i = richard.solids.indexOf(sup); if (i >= 0) richard.solids.splice(i, 1); } supOn = false; };
  const g_ = () => window.__g;
  const inDragonMode = () => { const g = net.game; return !!(g && g.phase === 'play' && g.mode === 'dragons'); };
  const riderBusy = () => ['mount', 'ride', 'land', 'hop'].includes(mine.st);
  const solidHitAt = (x, y, z, r) => { const S = richard.solids; for (let i = 0; i < S.length; i++) { const b = S[i]; if (b === sup || (b.max.y - b.min.y < 12 && (b.max.x - b.min.x) * (b.max.z - b.min.z) < 400)) continue; if (x > b.min.x - r && x < b.max.x + r && y > b.min.y - r && y < b.max.y + r && z > b.min.z - r && z < b.max.z + r) return true; } return false; };

  const PROBES = [[0, 3, 22, 4], [0, -2, 6, 5], [0, -3, -8, 5], [0, -4, -24, 3], [-22, 0, -3, 3.5], [22, 0, -3, 3.5]];      // [вбок, вверх, вперёд, радиус] в системе дракона
  const probeWorld = (x, y, z, yaw, p) => { const sn = Math.sin(yaw), cs = Math.cos(yaw); return [x + p[0] * cs + p[2] * sn, y + p[1], z - p[0] * sn + p[2] * cs]; };
  function probeSolid(x, y, z, yaw) { for (const p of PROBES) { const w = probeWorld(x, y, z, yaw, p); if (solidHitAt(w[0], w[1], w[2], p[3])) return true; } return false; }
  function terrainNeed(x, z, yaw) { let need = -1e9; for (const p of PROBES) { if (Math.abs(p[0]) > 10) continue;      // концы крыльев о рельеф не считаем (склоны держали дракона над землёй)
      const w = probeWorld(x, 0, z, yaw, p); need = Math.max(need, hAt(w[0], w[2]) + 0.4 + p[3] - p[1]); } return need; }
  /* сидящий дракон — препятствие для пешего игрока: три коробки вдоль корпуса */
  const landBoxes = [0, 1, 2].map(() => ({ min: new V(), max: new V(), grab: false })); let landOn = false;
  function landedBoxes(on) {
    if (on) { const sn = Math.sin(mine.yaw), cs = Math.cos(mine.yaw), g = mine.y - REST;
      [14, 0, -14].forEach((zl, i) => { const b = landBoxes[i], cx = mine.x + sn * zl, cz = mine.z + cs * zl; b.min.set(cx - 4.5, g, cz - 4.5); b.max.set(cx + 4.5, g + 9, cz + 4.5); if (!landOn) richard.solids.push(b); });
      landOn = true;
    } else if (landOn) { for (const b of landBoxes) { const i = richard.solids.indexOf(b); if (i >= 0) richard.solids.splice(i, 1); } landOn = false; }
  }
  function summon(auto) {
    if (mine.st !== 'none') return;
    const py = P.yawVis ?? P.yaw; let spot = null;
    for (const dist of [18, 30, 46]) { for (const da of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2, Math.PI]) {
      const x = P.pos.x + Math.sin(py + da) * dist, z = P.pos.z + Math.cos(py + da) * dist, h = hAt(x, z);
      if (Math.abs(h - P.pos.y) < 14 && !solidHitAt(x, h + 6, z, 8)) { spot = [x, z]; break; } } if (spot) break; }
    if (!spot) return say('Рядом нет места, где дракон мог бы сесть — отойдите от построек');
    if (!mine.d) { mine.pal = Math.abs(net.id ?? 0) % PALETTES.length; mine.d = makeDragon(PALETTES[mine.pal]); scene.add(mine.d.root); }
    const ang = Math.random() * 6.28, R = 300;
    Object.assign(mine, { st: 'arrive', auto: !!auto, tx: spot[0], tz: spot[1], x: spot[0] + Math.sin(ang) * R, z: spot[1] + Math.cos(ang) * R, pitch: 0, roll: 0, speed: 0, vy: 0, idle: 0, fire: false, fireHitT: {} });
    mine.y = hAt(spot[0], spot[1]) + REST + 95; mine.yaw = Math.atan2(spot[0] - mine.x, spot[1] - mine.z); mine.d.root.visible = true; mine.d.root.scale.setScalar(1);
    say('🐉 Дракон летит к вам…'); window.__snd && window.__snd('roar', 0.7);
  }
  function onV() {
    if (window.__gameLock || !window.__richardActive || inDragonMode()) return;
    if (mine.st === 'none') { if (P.dead || window.__riding) return; summon(false); }
    else if (mine.st === 'landed' || mine.st === 'arrive') leaveNow();
    else if (mine.st === 'ride') tryLand();
  }
  function nearDragon() { return mine.st === 'landed' && !P.dead && !window.__riding && Math.hypot(mine.x - P.pos.x, mine.z - P.pos.z) < 26 && Math.abs(mine.y - 6 - P.pos.y) < 22; }
  function onE() {
    if (!window.__richardActive) return;
    if (nearDragon()) { Object.assign(mine, { st: 'mount', t: 0, yaw0: P.yawVis ?? P.yaw }); mine.from.copy(P.pos); window.__riding = window.__dragonOn = true; richard.clearKeys(); window.__dragonNear = false; window.__snd && window.__snd('whoosh', 0.8); }
    else if (mine.st === 'ride') tryLand();
  }
  function tryLand() { if (mine.y - hAt(mine.x, mine.z) > 20) return say('Снизьтесь (X — вниз), чтобы приземлиться'); mine.st = 'land'; mine.fire = false; }
  function bail() {                                 // Q: спрыгнуть с дракона на лету (и в полёте, и при посадке): герой падает с инерцией, дракон улетает
    if (mine.st !== 'ride' && mine.st !== 'land') return;
    const sp = mine.speed, vx = Math.sin(mine.yaw) * sp * 0.6, vz = Math.cos(mine.yaw) * sp * 0.6, vy = Math.max(mine.vy * 0.5, 0) + 10;
    release(); P.pos.set(mine.x, mine.y - SEAT + LIFT + 1, mine.z); P.vel.set(vx, vy, vz);
    mine.st = 'leave'; mine.leaveT = 0; mine.leaveMax = 6; mine.fire = false; mine.speed = Math.max(sp, 30); window.__snd && window.__snd('whoosh', 1);
  }
  function leaveNow() { if (mine.st === 'landed' || mine.st === 'arrive') { mine.st = 'leave'; mine.leaveT = 0; mine.leaveMax = 6; mine.speed = Math.max(mine.speed, 20); } }
  function release() { const g = g_(); if (g && g.cam) g.cam(mine.camYaw, 0.3, 34); window.__dragonOn = false; window.__riding = false; window.__dragonNear = false; dropSup(); richard.release(); P.vel.set(0, 0, 0); hud.style.display = 'none'; }
  function riderDied() { release(); mine.st = 'leave'; mine.leaveT = 0; mine.leaveMax = 3.5; mine.fire = false; mine.speed = Math.max(mine.speed, 30); }
  window.__dragonSend = () => mine.d && mine.st !== 'none' ? { x: +mine.x.toFixed(1), y: +mine.y.toFixed(1), z: +mine.z.toFixed(1), w: +mine.yaw.toFixed(2), p: +mine.pitch.toFixed(2), r: +mine.roll.toFixed(2), f: mine.fire ? 1 : 0, c: mine.pal, b: mine.boost ? 1 : 0, t: +mine.turn.toFixed(2), l: mine.st === 'landed' || mine.st === 'mount' ? 1 : 0, k: mine.st === 'ride' ? 1 : 0, sc: +(mine.d.root.scale.x).toFixed(2) } : undefined;
  net.on && net.on('spawn', () => { if (mine.st === 'arrive' || mine.st === 'landed') { mine.st = 'none'; if (mine.d) mine.d.root.visible = false; } });      // переродились в другом месте — дракон прилетит заново

  const _a = new V(), _b = new V(), _c = new V(), _end = new V();
  const seat = () => { P.pos.set(mine.x, mine.y - SEAT + LIFT, mine.z); P.vel.set(0, 0, 0); P.yaw = P.yawVis = mine.yaw; setSup(); };
  // камера дракона: цель — ТОЧНО седло (без отставания), углы и дистанция сглажены; её ставит хук из richard-mode (в конце camUpdate), а не штатная камера героя
  const cam_ = { p: 0.3, d: 62 };
  const follow = dt => { mine.camYaw += angDiff(mine.camYaw, mine.yaw + Math.PI) * Math.min(1, dt * 2.6); cam_.p += (clamp(0.3 - mine.pitch * 0.25, 0.05, 0.75) - cam_.p) * Math.min(1, dt * 2); cam_.d += ((mine.boost ? 72 : 62) - cam_.d) * Math.min(1, dt * 2); };
  window.__camHook = (cam, tgt) => {
    if (mine.st !== 'ride' && mine.st !== 'land') return;
    tgt.set(mine.x, mine.y + 5, mine.z); const cp = Math.cos(cam_.p), d = window.__dragonCamD || cam_.d;
    cam.position.set(tgt.x + Math.sin(mine.camYaw) * cp * d, tgt.y + Math.sin(cam_.p) * d, tgt.z + Math.cos(mine.camYaw) * cp * d);
    const gy = hAt(cam.position.x, cam.position.z) + 3; if (cam.position.y < gy) cam.position.y = gy;
  };

  function step(dt) {
    const m = mine, d = m.d; if (!d || m.st === 'none') { landedBoxes(false); return; }
    landedBoxes(m.st === 'landed' && hAt(m.x, m.z) > 0);
    const gT = hAt(m.x, m.z) + REST; let rate = 2.3, amp = 1;
    if (m.st === 'arrive') {
      const dx = m.tx - m.x, dz = m.tz - m.z, dist = Math.hypot(dx, dz), gt = hAt(m.tx, m.tz) + REST, sp = clamp(dist * 1.05, 9, 90);
      if (dist > 5) m.yaw += angDiff(m.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 3);
      const mv = Math.min(dist, sp * dt); if (dist > 0.01) { m.x += dx / dist * mv; m.z += dz / dist * mv; }
      const alt = gt + Math.pow(clamp((dist - 4) / 80, 0, 1), 1.5) * 90, dy = (alt - m.y) * Math.min(1, dt * 2.4); m.y += dy;
      m.pitch += (clamp(dy / dt / Math.max(sp, 25) * 0.9, -0.5, 0.5) - m.pitch) * Math.min(1, dt * 3); m.roll *= 0.95; m.speed = sp;
      rate = dist < 40 ? 3.4 : 2.3; amp = 1;
      if (dist < 1.0 && Math.abs(m.y - gt) < 0.6) { m.st = 'landed'; window.__snd && window.__snd('land', 1.3); m.pitch = 0; m.speed = 0; m.idle = 0; m.yaw = Math.atan2(P.pos.x - m.x, P.pos.z - m.z) + 0.5; }
    } else if (m.st === 'landed') {
      m.y += (gT - m.y) * Math.min(1, dt * 5); m.pitch *= 0.9; m.roll *= 0.9; m.speed = 0; rate = 0.9; amp = 0.3; m.idle += dt;
      if (m.idle > 90 && !window.__riding) leaveNow();
    } else if (m.st === 'mount') {
      m.t += dt; const u = Math.min(1, m.t / 1.5), e = easeN(u); rate = 1.6; amp = 0.5;
      P.pos.set(lerp(m.from.x, m.x, e), lerp(m.from.y, m.y - SEAT + LIFT, e) + Math.sin(Math.PI * u) * 4, lerp(m.from.z, m.z, e)); P.vel.set(0, 0, 0);
      P.yaw = P.yawVis = m.yaw0 + angDiff(m.yaw0, m.yaw) * e; setSup(); m.camYaw = m.yaw + Math.PI;
      if (u >= 1) { m.st = 'ride'; m.vy = 26; m.speed = 0; richard.play('Верхом', { fade: 0.15 }); }
    } else if (m.st === 'ride' || m.st === 'land') {
      const ride = m.st === 'ride', ctl = ride && !P.dead;
      const turnIn = ctl ? (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0) - (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) : 0;
      const fwdIn = ctl ? (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) : 0;
      const vIn = ctl ? (K.has('KeyZ') ? 1 : 0) - (K.has('KeyX') ? 1 : 0) : 0;
      m.boost = ctl && (K.has('ShiftLeft') || K.has('ShiftRight')) ? 1 : 0;
      m.turn += (turnIn - m.turn) * Math.min(1, dt * 4); m.yaw += m.turn * 1.15 * dt;
      const spT = ride ? (fwdIn > 0 ? 66 * (m.boost ? 1.6 : 1) : fwdIn < 0 ? -24 : 0) : 0;
      m.speed += (spT - m.speed) * Math.min(1, dt * (ride ? 1.7 : 2.5));
      const vyT = ride ? (vIn > 0 ? 40 : vIn < 0 ? -50 : 0) : clamp((gT - m.y) * 2, -55, 55);
      m.vy += (vyT - m.vy) * Math.min(1, dt * 3);
      let nx = m.x + Math.sin(m.yaw) * m.speed * dt, ny = m.y + m.vy * dt, nz = m.z + Math.cos(m.yaw) * m.speed * dt;
      const B = world.bounds; if (B) { const mg = 120; if (nx < B.x0 + mg || nx > B.x1 - mg || nz < B.z0 + mg || nz > B.z1 - mg) m.yaw += angDiff(m.yaw, Math.atan2((B.x0 + B.x1) / 2 - nx, (B.z0 + B.z1) / 2 - nz)) * Math.min(1, dt * 1.8); }
      {                                  // столкновения: несколько щупов по телу (голова, грудь, круп, хвост, концы крыльев) — по осям, чтобы скользить вдоль стен
        const stuck = probeSolid(m.x, m.y, m.z, m.yaw); let ax = m.x, ay = m.y, az = m.z, hit = false;
        if (stuck || !probeSolid(nx, ay, az, m.yaw)) ax = nx; else hit = true;
        if (stuck || !probeSolid(ax, ay, nz, m.yaw)) az = nz; else hit = true;
        ny = Math.max(ny, terrainNeed(ax, az, m.yaw)); if (ny > ay && probeSolid(ax, ny, az, m.yaw) && !stuck) { ny = ay; m.vy = Math.min(m.vy, 0); hit = true; } else if (ny < ay && probeSolid(ax, ny, az, m.yaw) && !stuck) { ny = ay; m.vy = Math.max(m.vy, 0); hit = true; }
        if (hit) m.speed *= Math.pow(0.05, dt);
        for (const o of others.values()) { const ox = ax - o.x, oy = ay - o.y, oz = az - o.z, dd = Math.hypot(ox, oy, oz); if (dd < 20 && dd > 0.01) { const push = (20 - dd) / dd; ax += ox * push * 0.5; ay += oy * push * 0.5; az += oz * push * 0.5; m.speed *= Math.pow(0.3, dt); } }      // драконы не проходят друг сквозь друга
        nx = ax; nz = az; ny = Math.max(ny, hAt(nx, nz) + REST); if (ny > 560) { ny = 560; if (m.vy > 0) m.vy = 0; }
      }
      m.x = nx; m.y = ny; m.z = nz;
      m.pitch += (clamp(Math.atan2(m.vy, Math.max(Math.abs(m.speed), 30)), -0.6, 0.6) * clamp(Math.abs(m.speed) / 35, 0, 1) * Math.sign(m.speed || 1) - m.pitch) * Math.min(1, dt * 4);      // на месте Z/X — чистый подъём/спуск без наклона носа
      m.roll += ((ride ? -m.turn * 0.62 : 0) - m.roll) * Math.min(1, dt * 3.2);
      const hover = 1 - clamp(Math.abs(m.speed) / 45, 0, 1);
      rate = 2.3 + hover * 1.0 + (m.boost ? 1.4 : 0) + Math.max(0, m.vy) * 0.02; amp = 1;
      m.fire = ctl && (K.has('Space') || mouseDown);
      if (!P.dead) { seat(); follow(dt); }
      if (!ride && Math.abs(m.y - gT) < 0.5 && Math.abs(m.speed) < 6) {
        m.st = 'hop'; m.t = 0; m.from.copy(P.pos); m.yaw0 = m.yaw;
        for (const sg of [1, -1]) { const lx = Math.cos(m.yaw) * 11 * sg, lz = -Math.sin(m.yaw) * 11 * sg; if (hAt(m.x + lx, m.z + lz) > 0.3 || sg < 0) { m.dest.set(m.x + lx, Math.max(0, hAt(m.x + lx, m.z + lz)), m.z + lz); if (hAt(m.x + lx, m.z + lz) > 0.3) break; } }
      }
    } else if (m.st === 'hop') {
      m.t += dt; const u = Math.min(1, m.t / 0.8), e = easeN(u); rate = 0.9; amp = 0.3; m.speed = 0; m.y += (gT - m.y) * Math.min(1, dt * 5);
      P.pos.set(lerp(m.from.x, m.dest.x, e), lerp(m.from.y, m.dest.y, e) + Math.sin(Math.PI * u) * 3, lerp(m.from.z, m.dest.z, e)); P.vel.set(0, 0, 0); setSup();
      if (u >= 1) { release(); P.pos.copy(m.dest); m.st = 'landed'; m.idle = 0; }
    } else if (m.st === 'leave') {
      m.leaveT += dt; m.speed += (72 - m.speed) * Math.min(1, dt * 1.5); m.vy += (22 - m.vy) * Math.min(1, dt * 2);
      m.x += Math.sin(m.yaw) * m.speed * dt; m.z += Math.cos(m.yaw) * m.speed * dt; m.y = Math.max(m.y + m.vy * dt, hAt(m.x, m.z) + REST);
      m.pitch += (0.25 - m.pitch) * Math.min(1, dt * 2); m.roll *= 0.95; rate = 2.6; amp = 1;
      const k = clamp((m.leaveMax - m.leaveT) / 1.2, 0, 1); d.root.scale.setScalar(Math.max(0.02, k));
      if (m.leaveT >= m.leaveMax) { d.root.visible = false; m.st = 'none'; m.fire = false; }
    }
    if (m.st === 'none') return;
    d.root.position.set(m.x, m.y, m.z); d.root.rotation.set(-m.pitch, m.yaw, m.roll, 'YXZ');
    d.update(dt, { rate, amp, fire: m.fire, turn: m.turn, pitch: m.pitch });
    if (d.flapped) { d.flapped = false; if (window.__snd && m.st !== 'landed') window.__snd('flap', m.st === 'ride' || m.st === 'land' ? 0.9 : 0.6); }
    if (m.fire) {
      m.emitAcc += dt * 230; const n = Math.floor(m.emitAcc); m.emitAcc -= n; _a.set(Math.sin(m.yaw) * m.speed, m.vy, Math.cos(m.yaw) * m.speed).multiplyScalar(0.6);
      emit(d.mouth, d.dir, _a, n); burn(d.mouth, d.dir);
    }
  }
  function burn(mouth, dir) {                    // пламя поражает чужих всадников (сервер проверяет дальность и режим)
    if (!inDragonMode() || P.dead) return;
    _end.copy(mouth).addScaledVector(dir, 105); const t = performance.now() / 1000;
    for (const b of net.bodies()) {
      _a.set(b.x, b.y + 4.4, b.z); _b.subVectors(_end, mouth); const len2 = _b.lengthSq(); const u = clamp(_c.subVectors(_a, mouth).dot(_b) / len2, 0, 1);
      _c.copy(mouth).addScaledVector(_b, u); const r = 3.2 + 7 * u;
      if (_c.distanceTo(_a) < r && (!mine.fireHitT[b.id] || t - mine.fireHitT[b.id] > 0.3)) { mine.fireHitT[b.id] = t; net.send({ t: 'hit', to: b.id, dmg: 45 }); }
    }
  }

  /* ───── чужие драконы: сидящие, прилетающие, летящие с всадником и улетающие ───── */
  const others = new Map(); let othersFrame = 0, remoteFire = 0;
  function updateOthers(dt) {
    const list = net.dragonRiders ? net.dragonRiders() : [], seen = new Set(), k = 1 - Math.exp(-14 * dt);
    othersFrame++; remoteFire = 0;
    for (const r of list) {
      const dg = r.dg; if (!Number.isFinite(dg.x)) continue; seen.add(r.id); let o = others.get(r.id);
      if (!o) { o = { d: makeDragon(palOf(dg.c)), c: dg.c, x: dg.x, y: dg.y, z: dg.z, yaw: dg.w || 0, pitch: 0, roll: 0, turn: 0, acc: 0, px: dg.x, py: dg.y, pz: dg.z }; scene.add(o.d.root); others.set(r.id, o); }
      else if (o.c !== dg.c) { scene.remove(o.d.root); o.d.dispose(); o.d = makeDragon(palOf(dg.c)); o.c = dg.c; scene.add(o.d.root); }
      o.x += (dg.x - o.x) * k; o.y += (dg.y - o.y) * k; o.z += (dg.z - o.z) * k; o.yaw += angDiff(o.yaw, dg.w || 0) * k;
      o.pitch += ((dg.p || 0) - o.pitch) * k; o.roll += ((dg.r || 0) - o.roll) * k; o.turn += ((dg.t || 0) - o.turn) * k;
      o.d.root.position.set(o.x, o.y, o.z); o.d.root.rotation.set(-o.pitch, o.yaw, o.roll, 'YXZ'); o.d.root.scale.setScalar(dg.sc || 1);
      const vx = (o.x - o.px) / Math.max(dt, 1e-3), vy = (o.y - o.py) / Math.max(dt, 1e-3), vz = (o.z - o.pz) / Math.max(dt, 1e-3); o.px = o.x; o.py = o.y; o.pz = o.z;
      const dc = camera ? o.d.root.position.distanceTo(camera.position) : 0; o.d.root.visible = dc < 1600;
      if (dc > 1600 || (dc > 350 && (othersFrame & 1))) { if (dg.f && o.d.root.visible) { /* огонь рисуем всегда */ } else continue; }      // далёкие драконы: тело пересчитываем через кадр, совсем далёкие не считаем
      o.d.update(dt, dg.l ? { rate: 0.9, amp: 0.3, fire: false, turn: 0, pitch: 0 } : { rate: 2.5 + (dg.b ? 1.4 : 0), amp: 1, fire: !!dg.f, turn: o.turn, pitch: o.pitch });
      if (o.d.flapped) { o.d.flapped = false; const dv = 1 - dc / 500; if (dv > 0.05 && window.__snd && !dg.l) window.__snd('flap', dv * 0.8); }
      if (dg.f) remoteFire = Math.max(remoteFire, Math.max(0, 1 - dc / 400) * 0.8);
      if (dg.f) { o.acc += dt * 230; const n = Math.floor(o.acc); o.acc -= n; _a.set(clamp(vx, -90, 90), clamp(vy, -90, 90), clamp(vz, -90, 90)).multiplyScalar(0.6); emit(o.d.mouth, o.d.dir, _a, n); }
    }
    for (const [id, o] of [...others]) if (!seen.has(id)) { scene.remove(o.d.root); o.d.dispose(); others.delete(id); }
  }

  /* ───── главный цикл ───── */
  function update(dt) {
    dt = Math.min(dt, 0.1);
    const me = net.me, inDM = inDragonMode();
    if (toastT > 0 && (toastT -= dt) <= 0) toast.style.display = 'none';
    const st = mine.st;
    if (P.dead && (riderBusy())) riderDied();
    else if (P.dead && (st === 'arrive' || st === 'landed')) leaveNow();
    else if (mine.auto && !inDM && (st === 'arrive' || st === 'landed')) leaveNow();            // поединки кончились
    else if (mine.auto && !inDM && st === 'ride') mine.st = 'land';                             // …а всадника аккуратно сажаем
    if (mine.st === 'none' && inDM && !P.dead && window.__richardActive && me && me.play && !window.__riding) summon(true);
    step(dt);
    window.__dragonNear = nearDragon();
    prompt_.style.display = window.__dragonNear ? 'block' : 'none'; if (window.__dragonNear) prompt_.textContent = '🐉 E — забраться на дракона';
    if (mine.st === 'ride') {
      hud.style.display = 'block';
      hud.textContent = `🐉 ${PALETTES[mine.pal].name} дракон · W/S — вперёд/назад · A/D — поворот · Z/X — вверх/вниз · Shift — ускорение · Пробел/ЛКМ — огонь · E — приземлиться · Q — спрыгнуть · высота ${Math.round(mine.y - hAt(mine.x, mine.z))}`;
    } else if (mine.st === 'land') { hud.style.display = 'block'; hud.textContent = '🐉 Приземляемся…'; }
    updateOthers(dt);
    if (window.__sndLoop) window.__sndLoop('fire', true, Math.max(mine.st === 'ride' && mine.fire ? 1 : 0, remoteFire));
    fireTick(dt);
    const lit = mine.st === 'ride' && mine.fire;
    flameLight.intensity += ((lit ? 7 : 0) - flameLight.intensity) * Math.min(1, dt * 12);
    if (lit) flameLight.position.copy(mine.d.mouth).addScaledVector(mine.d.dir, 14);
  }
  return { update, get mounted() { return mine.st === 'ride'; } };
}
