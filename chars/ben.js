// Бэн Соммерс: меши один в один из Бэн/3D/ben.html, прикреплённые к суставам клона Ричарда.
// Суставы не трогаем (анимации Ричарда идут по их именам); меши Ричарда скрываются.
// У Бэна нет локтей/колен: части предплечья и голени крепятся к ElbowL/R и KneeL/R с поправкой на смещение сустава.

export function dress(c, { THREE, RoundedBoxGeometry }){
  // 1) скрыть меши Ричарда, убрать меч/щит/корону/табард
  c.traverse(o => { if (o.isMesh) o.visible = false; });
  for (const n of ['Sword', 'Shield', 'Crown']) c.getObjectByName(n)?.removeFromParent();
  const tb = []; c.traverse(o => { if (o.name && o.name.startsWith('Tabard')) tb.push(o); }); tb.forEach(o => o.removeFromParent());
  const J = n => c.getObjectByName(n);
  const joint = (parent, name, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };

  const rb = (w,h,d,r=0.12,seg=4) => new RoundedBoxGeometry(w,h,d,seg,Math.min(r, w/2-1e-3, h/2-1e-3, d/2-1e-3));
  function mesh(parent, geo, mat, x=0,y=0,z=0, name){
    const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z);
    m.castShadow = true; m.receiveShadow = true; if (name) m.name = name; parent.add(m); return m;
  }
  function canvasTex(w, h, draw){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const plastic = (color, o={}) => new THREE.MeshPhysicalMaterial({color, roughness:0.38, clearcoat:0.6, clearcoatRoughness:0.28, ...o});
  const goldOpts = {color:0xc08e2c, metalness:0.62, roughness:0.34, clearcoat:0.45, clearcoatRoughness:0.28};
  const M = {
    skin: plastic(0xf2b9a2, {roughness:0.45}),
    hair: plastic(0x7a2619, {roughness:0.5, side:THREE.DoubleSide}),
    gold: new THREE.MeshPhysicalMaterial(goldOpts),
    goldDS: new THREE.MeshPhysicalMaterial({...goldOpts, side:THREE.DoubleSide}),
    blue: plastic(0x1f4aa8), red: plastic(0xb5161c), white: plastic(0xf3efe6),
    iron: new THREE.MeshPhysicalMaterial({color:0x3b3e45, metalness:0.7, roughness:0.4, clearcoat:0.2}),
  };

  function drawLion(g, cx, cy, s, mane, face, ink, crown){
    g.save(); g.translate(cx, cy); g.scale(s, s);
    g.fillStyle = mane; g.beginPath();
    const N = 18;
    for (let i = 0; i < N*2; i++){
      const a = i/(N*2)*Math.PI*2 - Math.PI/2, r = i%2 ? 0.8 : 1.0;
      g.lineTo(Math.cos(a)*r*0.95, Math.sin(a)*r + 0.12);
    }
    g.closePath(); g.fill();
    g.fillStyle = face; g.beginPath(); g.ellipse(0, 0.14, 0.56, 0.62, 0, 0, 7); g.fill();
    for (const sx of [-1,1]){ g.beginPath(); g.arc(sx*0.5, -0.4, 0.15, 0, 7); g.fill(); }
    g.fillStyle = ink;
    for (const sx of [-1,1]){
      g.beginPath(); g.moveTo(sx*0.1,-0.02); g.lineTo(sx*0.44,-0.16); g.lineTo(sx*0.36,0.04); g.closePath(); g.fill();
    }
    g.beginPath(); g.moveTo(-0.15,0.2); g.lineTo(0.15,0.2); g.lineTo(0,0.34); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(0, 0.47, 0.27, 0.17, 0, 0, Math.PI); g.fill();
    g.fillStyle = face;
    for (const sx of [-0.12, 0.12]){ g.beginPath(); g.moveTo(sx-0.045,0.47); g.lineTo(sx+0.045,0.47); g.lineTo(sx,0.57); g.fill(); }
    g.fillStyle = crown; g.beginPath();
    g.moveTo(-0.46,-0.78); g.lineTo(-0.5,-1.2); g.lineTo(-0.24,-0.98); g.lineTo(0,-1.32); g.lineTo(0.24,-0.98); g.lineTo(0.5,-1.2); g.lineTo(0.46,-0.78);
    g.closePath(); g.fill();
    for (const [x,y] of [[-0.5,-1.22],[0,-1.34],[0.5,-1.22]]){ g.beginPath(); g.arc(x,y,0.06,0,7); g.fill(); }
    g.restore();
  }
  function fleur(g, cx, cy, s, col){
    g.save(); g.translate(cx, cy); g.scale(s, s); g.fillStyle = col;
    g.beginPath(); g.moveTo(0,-1); g.quadraticCurveTo(0.34,-0.45,0.1,0.1); g.lineTo(-0.1,0.1); g.quadraticCurveTo(-0.34,-0.45,0,-1); g.fill();   // центральный лепесток
    for (const sx of [-1,1]){
      g.beginPath(); g.moveTo(sx*0.12,0.05); g.quadraticCurveTo(sx*0.95,-0.7,sx*0.8,-0.05); g.quadraticCurveTo(sx*0.7,0.3,sx*0.2,0.38); g.fill();
      g.beginPath(); g.moveTo(sx*0.7,0.28); g.quadraticCurveTo(sx*0.9,0.5,sx*0.45,0.6); g.lineTo(sx*0.15,0.45); g.fill();
    }
    g.fillRect(-0.42,0.28,0.84,0.12); g.beginPath(); g.moveTo(-0.1,0.35); g.lineTo(0.1,0.35); g.lineTo(0,1.05); g.fill();
    g.restore();
  }
  // передняя часть табарда: золотой нагрудник с ромбом и лилией на синем торсе (текстура 640x432 ↔ 2.6x1.75)
  const chestFront = canvasTex(640, 432, (g, w, h) => {
    g.clearRect(0,0,w,h);
    const gr = g.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#d9a73c'); gr.addColorStop(.5,'#b98728'); gr.addColorStop(1,'#9a6f1c');
    g.fillStyle = gr; g.beginPath();
    g.moveTo(40,0); g.lineTo(600,0); g.lineTo(560,70); g.lineTo(520,200); g.lineTo(450,262); g.lineTo(190,262); g.lineTo(120,200); g.lineTo(80,70); g.closePath(); g.fill();
    g.fillStyle = '#1f4aa8'; g.beginPath(); g.moveTo(320,16); g.lineTo(470,118); g.lineTo(320,236); g.lineTo(170,118); g.closePath(); g.fill();
    g.fillStyle = '#1f4aa8'; g.beginPath(); g.moveTo(300,0); g.lineTo(340,0); g.lineTo(320,16); g.fill();
    fleur(g, 320, 128, 70, '#f3efe6');
    g.strokeStyle = 'rgba(80,50,5,.55)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(40,0); g.lineTo(80,70); g.lineTo(120,200); g.moveTo(600,0); g.lineTo(560,70); g.lineTo(520,200); g.stroke();
  });
  const chestBack = canvasTex(640, 432, (g, w, h) => {
    g.clearRect(0,0,w,h);
    const gr = g.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#d9a73c'); gr.addColorStop(1,'#9a6f1c');
    g.fillStyle = gr; g.beginPath(); g.moveTo(30,0); g.lineTo(610,0); g.lineTo(570,60); g.lineTo(520,130); g.lineTo(120,130); g.lineTo(70,60); g.closePath(); g.fill();
  });
  const R_HEAD = 1.0, H_HEAD = 1.9;
  const faceTex = canvasTex(2048, 512, (g, W, H) => {
    g.fillStyle = '#f2b9a2'; g.fillRect(0,0,W,H);
    const px = x => W/2 + Math.asin(Math.max(-1, Math.min(1, x/R_HEAD)))/(2*Math.PI)*W;
    const py = y => (1 - y/H_HEAD)*H;
    g.fillStyle = '#4a2418';
    for (const sx of [-1,1]){ g.beginPath(); g.ellipse(px(sx*0.42), py(0.98), 36, 31, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(px(sx*0.42)+10, py(0.98)-10, 7, 0, 7); g.fill(); g.fillStyle = '#4a2418'; }
    g.beginPath(); g.moveTo(px(-0.25), py(0.62)); g.quadraticCurveTo(px(0), py(0.3), px(0.25), py(0.62));
    g.quadraticCurveTo(px(0), py(0.56), px(-0.25), py(0.62)); g.fill();                              // улыбка
    g.fillStyle = 'rgba(214,120,110,.22)';
    for (const sx of [-1,1]){ g.beginPath(); g.ellipse(px(sx*0.62), py(0.66), 30, 18, 0, 0, 7); g.fill(); }
  }); faceTex.wrapS = THREE.RepeatWrapping;
  const shieldTex = canvasTex(512, 1024, (g, w, h) => {
    const half = w/2, mid = h*0.46;
    g.fillStyle='#1f4aa8'; g.fillRect(0,0,half,mid); g.fillStyle='#c3151b'; g.fillRect(half,0,half,mid);
    g.fillStyle='#c3151b'; g.fillRect(0,mid,half,h-mid); g.fillStyle='#1f4aa8'; g.fillRect(half,mid,half,h-mid);
    g.strokeStyle='#c08e2c'; g.lineWidth=10; g.beginPath(); g.moveTo(half,0); g.lineTo(half,h); g.moveTo(0,mid); g.lineTo(w,mid); g.stroke();
    drawLion(g, half, h*0.40, 175, '#16358a', '#2f5cc0', '#eaf0fb', '#e0aa22');
  });

  const torso = J('Torso');
  const wristL = J('WristL'), wristR = J('WristR');
  const elbowL = J('ElbowL'), elbowR = J('ElbowR');

  mesh(torso, rb(2.6,1.75,1.3,0.22), M.blue, 0, 1.32, 0, 'TabardBody');
  mesh(torso, rb(2.3,1.0,1.22,0.2), M.red, 0, 0.42, 0, 'Hips');
  for (const [tex, z, ry, nm] of [[chestFront, 0.665, 0, 'ChestPlateFront'], [chestBack, -0.665, Math.PI, 'ShoulderPlateBack']]){
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.75), new THREE.MeshPhysicalMaterial({
      map:tex, transparent:true, alphaTest:0.5, roughness:0.34, metalness:0.35, clearcoat:0.45, polygonOffset:true, polygonOffsetFactor:-2}));
    p.position.set(0, 1.32, z); p.rotation.y = ry; p.receiveShadow = true; p.castShadow = true; p.name = nm; torso.add(p);
  }
  // ламели кирасы (рельеф) и плечевая накладка на спине
  for (const [w, y, z] of [[1.65, 1.05, 0.7], [1.45, 0.9, 0.7], [1.22, 0.76, 0.7]]) mesh(torso, rb(w, 0.2, 0.14, 0.07, 3), M.gold, 0, y, z, 'Lame');
  mesh(torso, rb(2.0, 0.55, 0.14, 0.07, 3), M.gold, 0, 1.97, -0.7, 'BackPlate');
  // шея + бувигер
  mesh(torso, new THREE.CylinderGeometry(0.44,0.5,0.42,32), M.gold, 0, 2.3, 0, 'Neck');
  const collar = mesh(torso, new THREE.TorusGeometry(0.58,0.1,10,40), M.gold, 0, 2.18, 0); collar.rotation.x = Math.PI/2;

  // голова
  const head = J('Head');
  {
    const prof = new THREE.SplineCurve([[0,0],[0.55,0.02],[0.86,0.18],[0.985,0.55],[1.0,0.95],[0.99,1.3],[0.9,1.62],[0.65,1.82],[0.3,1.895],[0,1.9]].map(p => new THREE.Vector2(...p))).getPoints(48);
    const geo = new THREE.LatheGeometry(prof, 56);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, Math.atan2(pos.getX(i), pos.getZ(i))/(2*Math.PI) + 0.5, pos.getY(i)/H_HEAD);
    mesh(head, geo, new THREE.MeshPhysicalMaterial({map:faceTex, roughness:0.42, clearcoat:0.5, clearcoatRoughness:0.3}), 0, 0, 0, 'HeadShell');
    // волосы: каштаново-рыжее каре, видно по бокам лица
    const dome = mesh(head, new THREE.SphereGeometry(1.06, 40, 20, 0, Math.PI*2, 0, Math.PI/2), M.hair, 0, 1.2, 0, 'HairDome'); dome.scale.y = 0.72;
    mesh(head, new THREE.CylinderGeometry(1.06, 1.08, 0.7, 48, 1, true, THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(280)), M.hair, 0, 0.95, 0, 'HairSides');
    const fr = [], idx = [], T = 8, a0 = THREE.MathUtils.degToRad(-60), a1 = THREE.MathUtils.degToRad(60);
    for (let i = 0; i <= T*2; i++){
      const a = a0 + (a1 - a0)*i/(T*2), r = 1.07;
      fr.push(Math.sin(a)*r, 1.42, Math.cos(a)*r); fr.push(Math.sin(a)*r, i%2 ? 1.2 : 1.3, Math.cos(a)*r);
    }
    for (let i = 0; i < T*2; i++){ const k = i*2; idx.push(k,k+1,k+2, k+1,k+3,k+2); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fr,3)); fg.setIndex(idx); fg.computeVertexNormals();
    mesh(head, fg, M.hair, 0, 0, 0, 'Fringe');

    // шлем (Playmobil): купол, назатыльник с щеками, носовая планка, надбровье, заклёпки
    const helm = joint(head, 'Helmet');
    mesh(helm, new THREE.SphereGeometry(1.17, 56, 24, 0, Math.PI*2, 0, Math.PI*0.42), M.goldDS, 0, 1.0, 0, 'HelmetCap');
    const flare = THREE.MathUtils.degToRad(48);
    mesh(helm, new THREE.SphereGeometry(1.21, 56, 20, Math.PI/2 + flare, Math.PI*2 - 2*flare, Math.PI*0.4, Math.PI*0.36), M.goldDS, 0, 1.0, 0, 'HelmetSkirt');
    const brow = mesh(helm, new THREE.TorusGeometry(1.14, 0.075, 10, 40, THREE.MathUtils.degToRad(190)), M.gold, 0, 1.31, 0, 'Brow');
    brow.rotation.set(Math.PI/2, 0, 0); brow.rotateZ(THREE.MathUtils.degToRad(-5));   // дуга спереди
    const nasal = mesh(helm, rb(0.2, 0.75, 0.1, 0.045, 3), M.gold, 0, 1.0, 1.15, 'Nasal'); nasal.rotation.x = -0.12;
    const crest = mesh(helm, new THREE.TorusGeometry(1.2, 0.07, 8, 48, Math.PI), M.gold, 0, 1.0, 0, 'Crest'); crest.rotation.y = Math.PI/2;
    for (let i = 0; i < 20; i++){ const a = i/20*Math.PI*2; if (Math.abs(((a - 0 + Math.PI) % (Math.PI*2)) - Math.PI) < 0.8) continue;
      mesh(helm, new THREE.SphereGeometry(0.05, 8, 6), M.gold, Math.sin(a)*1.185, 1.17, Math.cos(a)*1.185); }
    for (let i = 0; i < 9; i++){ const a = (-0.35 + i*0.0875)*Math.PI + Math.PI; mesh(helm, new THREE.SphereGeometry(0.045, 8, 6), M.gold, Math.sin(a)*1.215, 0.78, Math.cos(a)*1.215); }
    // бувигер: заострённая золотая накладка на подбородок
    const s = new THREE.Shape(); s.moveTo(-0.85,-0.2); s.lineTo(0.85,-0.2); s.lineTo(0.62,0.12); s.lineTo(0,0.36); s.lineTo(-0.62,0.12); s.closePath();
    const bg = new THREE.ExtrudeGeometry(s, {depth:0.34, bevelEnabled:true, bevelSize:0.05, bevelThickness:0.05, bevelSegments:2, curveSegments:8}); bg.translate(0,0,-0.17);
    const bev = mesh(head, bg, new THREE.MeshPhysicalMaterial({...goldOpts, roughness:0.5, clearcoat:0.2}), 0, 0.14, 0.78, 'Bevor'); bev.rotation.x = 0.3;
    const side = mesh(head, new THREE.CylinderGeometry(1.0, 0.88, 0.5, 32, 1, true, THREE.MathUtils.degToRad(-100), THREE.MathUtils.degToRad(200)), M.goldDS, 0, 0.2, 0, 'BevorWrap'); side.rotation.y = Math.PI;
  }

  // руки: плечо Бэна (шарнир на Shoulder), предплечье крепится к локтю Ричарда (локоть на y=-0.85 от плеча)
  function handGeo(){
    const R = 0.34, r = 0.165, gap = 0.75, s = new THREE.Shape();
    const a0 = -Math.PI/2 + gap/2, a1 = -Math.PI/2 + Math.PI*2 - gap/2;
    s.absarc(0,0,R,a0,a1,false); s.absarc(0,0,r,a1,a0,true); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {depth:0.55, bevelEnabled:true, bevelSize:0.035, bevelThickness:0.035, bevelSegments:2, curveSegments:28});
    g.translate(0,0,-0.275); return g;
  }
  const EY = -0.85;
  function buildArm(L){
    const sh = J(L ? 'ShoulderL' : 'ShoulderR'), el = L ? elbowL : elbowR, wrist = L ? wristL : wristR;
    const pa = mesh(sh, new THREE.SphereGeometry(0.6, 28, 16, 0, Math.PI*2, 0, Math.PI*0.6), M.goldDS, 0, 0.08, 0, 'Pauldron'); pa.scale.set(1.0,0.85,1.0);
    for (const [y, r, h] of [[-0.3,0.46,0.42],[-0.68,0.41,0.34]]) mesh(sh, new THREE.CylinderGeometry(r*0.97, r, h, 28), M.gold, 0, y, 0);
    mesh(el, new THREE.CylinderGeometry(0.45*0.97, 0.45, 0.3, 28), M.gold, 0, -1.0 - EY, 0);
    mesh(el, new THREE.CylinderGeometry(0.3,0.33,0.5,20), M.gold, 0, -1.22 - EY, 0);
    mesh(wrist, handGeo(), M.gold, 0, 0, 0, 'Hand');
  }
  buildArm(true); buildArm(false);

  // ноги: красный верх бедра, золотые поножи и сапоги (голень крепится к колену Ричарда, колено на y=-1.55)
  function buildLeg(L){
    const hip = J(L ? 'HipL' : 'HipR'), knee = J(L ? 'KneeL' : 'KneeR'), KY = -1.55;
    mesh(hip, rb(1.0,1.55,1.08,0.2), M.gold, 0, -0.78, 0, 'Thigh');
    mesh(hip, rb(1.02,0.55,1.1,0.18), M.red, 0, -0.32, 0, 'ThighRed');
    const kn = mesh(knee, new THREE.SphereGeometry(0.5, 20, 14), M.gold, 0, 0, 0.3, 'Knee'); kn.scale.set(0.95, 0.75, 0.8);
    mesh(knee, rb(0.98,1.6,1.06,0.2), M.gold, 0, -2.2 - KY, 0, 'Boot');
    mesh(knee, rb(0.98,0.45,1.5,0.18), M.gold, 0, -2.78 - KY, 0.22, 'Foot');
    const toe = mesh(knee, new THREE.SphereGeometry(0.4, 16, 12), M.gold, 0, -2.8 - KY, 0.82, 'Toe'); toe.scale.set(1.15, 0.9, 0.95);
  }
  buildLeg(true); buildLeg(false);

  // палка (в левой руке), ось = локальный +Z. Группа называется Sword: клипы Ричарда двигают её как меч
  const STAFF = {zBot:-1.5, zTop:4.5};
  const staff = joint(wristL, 'Sword');
  {
    const cyl = (r1, r2, len, z) => { const m = mesh(staff, new THREE.CylinderGeometry(r1, r2, len, 20), M.gold, 0, 0, z); m.rotation.x = Math.PI/2; return m; };
    cyl(0.085, 0.085, STAFF.zTop - STAFF.zBot - 0.2, (STAFF.zTop + STAFF.zBot)/2 - 0.1);
    for (let i = 0; i < 9; i++){ mesh(staff, new THREE.TorusGeometry(0.1, 0.035, 8, 20), M.gold, 0, 0, 1.6 + i*0.13); }
    cyl(0.3, 0.09, 0.14, 4.4); cyl(0.3, 0.3, 0.05, 4.5); cyl(0.12, 0.12, 0.22, 4.6);
    mesh(staff, new THREE.SphereGeometry(0.16, 16, 12), M.gold, 0, 0, STAFF.zBot - 0.02);
  }
  // щит
  const shield = joint(wristR, 'Shield');
  {
    const S = (sc) => { const k = sc, s = new THREE.Shape();
      s.moveTo(-1.15*k,1.8*k); s.quadraticCurveTo(0,1.95*k,1.15*k,1.8*k); s.lineTo(1.15*k,0.25*k);
      s.bezierCurveTo(1.15*k,-0.95*k,0.5*k,-1.5*k,0,-1.9*k); s.bezierCurveTo(-0.5*k,-1.5*k,-1.15*k,-0.95*k,-1.15*k,0.25*k); s.closePath(); return s; };
    const body = new THREE.Group(); body.position.set(0, -0.45, 0.42); body.scale.setScalar(0.8);
    mesh(body, new THREE.ExtrudeGeometry(S(1), {depth:0.12, bevelEnabled:true, bevelSize:0.05, bevelThickness:0.05, bevelSegments:3, curveSegments:24}), M.gold, 0, 0, 0, 'ShieldRim');
    const fg = new THREE.ShapeGeometry(S(0.86), 24), p = fg.attributes.position, uv = fg.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i)+0.99)/1.98, (p.getY(i)+1.634)/3.27);
    mesh(body, fg, new THREE.MeshPhysicalMaterial({map:shieldTex, roughness:0.55, clearcoat:0.15, envMapIntensity:0.5, polygonOffset:true, polygonOffsetFactor:-2}), 0, 0, 0.205, 'ShieldFace');
    for (const [x,y] of [[-1.0,1.65],[1.0,1.65],[0,-1.72]]) { const d = mesh(body, new THREE.OctahedronGeometry(0.09), plastic(0x1f4aa8), x, y, 0.19); d.scale.z = 0.5; }
    const bar = mesh(shield, rb(0.2,0.2,1.0,0.07,3), M.gold, 0, 0, 0, 'GripBar'); bar.rotation.y = Math.PI/2;
    for (const sy of [-0.55, 0.55]) mesh(shield, rb(0.14,0.2,0.46,0.04,2), M.gold, 0, sy*0.8, 0.22);
    shield.add(body);
    shield.rotation.y = Math.PI/2;
  }
}
