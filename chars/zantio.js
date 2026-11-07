// Зантио — капитан, королевский шпагоносец.
// Точный внешний вид из Зантио/3D/zantio.html (меши, материалы, текстуры, шпага), но на суставах Ричарда:
// dress() прячет все меши клона Ричарда и строит меши Зантио на тех же суставах (имена/иерархия не меняются),
// поэтому играются все анимации Ричарда. Правки координат: плечи x+0.1 (1.62 вместо 1.52), голова y+0.02,
// рукав делится по локтю Ричарда, сапоги/стопы крепятся к колену, кисть и шпага — к запястью (ниже на 0.3).

export function dress(c, { THREE, RoundedBoxGeometry }) {
  // 1) прячем/удаляем всё от Ричарда
  const kill = [];
  c.traverse(o => {
    if (o.isMesh) o.visible = false;
    if (o.name === 'Sword' || o.name === 'Shield' || o.name === 'Crown' || o.name === 'Cape' || o.name.startsWith('Tabard')) kill.push(o);
  });
  kill.forEach(o => o.removeFromParent());

  const D = THREE.MathUtils.degToRad;

const rb = (w,h,d,r=0.12,seg=4) => new RoundedBoxGeometry(w,h,d,seg,Math.min(r, w/2-1e-3, h/2-1e-3, d/2-1e-3));
function mesh(parent, geo, mat, x=0,y=0,z=0, name){
  const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z);
  m.castShadow = true; m.receiveShadow = true; if (name) m.name = name; parent.add(m); return m;
}
function joint(parent, name, x=0,y=0,z=0){ const g = new THREE.Group(); g.name = name; g.position.set(x,y,z); parent.add(g); return g; }
function canvasTex(w, h, draw){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const plastic = (color, o={}) => new THREE.MeshPhysicalMaterial({color, roughness:0.38, clearcoat:0.6, clearcoatRoughness:0.28, ...o});
const goldMetal = (color, o={}) => new THREE.MeshPhysicalMaterial({color, metalness:0.6, roughness:0.34, clearcoat:0.45, clearcoatRoughness:0.28, ...o});
const M = {
  skin: plastic(0xf0b9a0, {roughness:0.45}),
  hair: plastic(0x6b3a22, {roughness:0.5, side:THREE.DoubleSide}),
  sleeve: goldMetal(0xc9a041, {metalness:0.45}),          // золотые рукава (бронзово-золотой металлик)
  boot: goldMetal(0xbc9232, {metalness:0.45}),
  boot2: goldMetal(0xd4ab48, {metalness:0.45}),
  blade: goldMetal(0xd8aa3c, {roughness:0.28}),
  bladeDS: goldMetal(0xd8aa3c, {roughness:0.28, side:THREE.DoubleSide}),
  red: plastic(0xc3151b), blue: plastic(0x1f3f9e), white: plastic(0xf3efe6),
  hat: plastic(0x8a806c, {roughness:0.5, side:THREE.DoubleSide, emissive:0x4a4234}),
  buckle: goldMetal(0xd8aa3c),
};
function gold(g){ const gr = g.createLinearGradient(0,0,0,1); return '#e0b04a'; }
function drawLion(g, cx, cy, s){
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.fillStyle = '#e0b04a'; g.beginPath();
  const N = 16;
  for (let i = 0; i < N*2; i++){ const a = i/(N*2)*Math.PI*2 - Math.PI/2, r = i%2 ? 0.8 : 1.0; g.lineTo(Math.cos(a)*r*0.95, Math.sin(a)*r + 0.12); }
  g.closePath(); g.fill();
  g.fillStyle = '#c3151b'; g.beginPath(); g.ellipse(0, 0.14, 0.5, 0.56, 0, 0, 7); g.fill();
  g.fillStyle = '#e0b04a'; g.beginPath(); g.ellipse(0, 0.2, 0.42, 0.48, 0, 0, 7); g.fill();
  g.fillStyle = '#c3151b';
  for (const sx of [-1,1]){ g.beginPath(); g.moveTo(sx*0.08,-0.02); g.lineTo(sx*0.34,-0.12); g.lineTo(sx*0.28,0.05); g.closePath(); g.fill(); }
  g.beginPath(); g.moveTo(-0.12,0.22); g.lineTo(0.12,0.22); g.lineTo(0,0.34); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(0, 0.5, 0.2, 0.12, 0, 0, Math.PI); g.fill();
  g.restore();
}
function drawCrown(g, cx, cy, s, col){
  g.save(); g.translate(cx, cy); g.scale(s, s); g.fillStyle = col;
  g.beginPath(); g.moveTo(-0.8,0.5); g.lineTo(-0.9,-0.3); g.lineTo(-0.45,0.1); g.lineTo(0,-0.55); g.lineTo(0.45,0.1); g.lineTo(0.9,-0.3); g.lineTo(0.8,0.5); g.closePath(); g.fill();
  g.fillRect(-0.85,0.55,1.7,0.22);
  for (const [x,y] of [[-0.9,-0.36],[0,-0.62],[0.9,-0.36]]){ g.beginPath(); g.arc(x,y,0.12,0,7); g.fill(); }
  g.fillRect(-0.04,-1.0,0.08,0.4); g.fillRect(-0.18,-0.88,0.36,0.08);
  g.restore();
}
function drawFleur(g, cx, cy, s, col){
  g.save(); g.translate(cx, cy); g.scale(s, s); g.fillStyle = col;
  g.beginPath(); g.moveTo(0,-1); g.bezierCurveTo(0.42,-0.6,0.32,0.05,0,0.25); g.bezierCurveTo(-0.32,0.05,-0.42,-0.6,0,-1); g.fill();
  for (const sx of [-1,1]){
    g.beginPath(); g.moveTo(sx*0.12,0.2); g.bezierCurveTo(sx*0.2,-0.4,sx*0.95,-0.5,sx*0.95,0.0);
    g.bezierCurveTo(sx*0.95,0.35,sx*0.5,0.35,sx*0.3,0.2); g.bezierCurveTo(sx*0.55,0.12,sx*0.65,-0.05,sx*0.45,-0.12);
    g.bezierCurveTo(sx*0.3,-0.1,sx*0.3,0.1,sx*0.12,0.2); g.fill();
  }
  g.fillRect(-0.55,0.28,1.1,0.14);
  g.beginPath(); g.moveTo(-0.22,0.42); g.lineTo(0.22,0.42); g.lineTo(0,0.95); g.fill();
  g.restore();
}
function drawSwordEmblem(g, cx, cy, s, col){
  g.save(); g.translate(cx, cy); g.rotate(0.35); g.scale(s, s); g.fillStyle = col;
  g.beginPath(); g.moveTo(0,-1); g.lineTo(0.09,-0.3); g.lineTo(0.09,0.35); g.lineTo(-0.09,0.35); g.lineTo(-0.09,-0.3); g.closePath(); g.fill();
  g.fillRect(-0.32,0.35,0.64,0.1); g.fillRect(-0.05,0.45,0.1,0.35);
  g.beginPath(); g.arc(0,0.85,0.1,0,7); g.fill();
  g.restore();
}
const TW = 512, TH = 560;
const tabardFront = canvasTex(TW, TH, (g, w, h) => {
  g.fillStyle = '#1f3f9e'; g.fillRect(0,0,w,h);
  // поля геральдики: x 36..476, y 70..520
  const x0 = 36, x1 = w-36, y0 = 78, y1 = h-34, mx = (x0+x1)/2, my = (y0+y1)/2;
  g.fillStyle = '#c3151b'; g.fillRect(x0, y0, mx-x0, my-y0); g.fillRect(mx, my, x1-mx, y1-my);
  g.strokeStyle = '#e0b04a'; g.lineWidth = 7;
  g.strokeRect(x0, y0, x1-x0, y1-y0);
  g.beginPath(); g.moveTo(mx, y0); g.lineTo(mx, y1); g.moveTo(x0, my); g.lineTo(x1, my); g.stroke();
  g.fillStyle = '#e0b04a'; g.beginPath(); g.moveTo(mx,my-24); g.lineTo(mx+24,my); g.lineTo(mx,my+24); g.lineTo(mx-24,my); g.closePath(); g.fill();
  g.fillStyle = '#1f3f9e'; g.beginPath(); g.moveTo(mx,my-12); g.lineTo(mx+12,my); g.lineTo(mx,my+12); g.lineTo(mx-12,my); g.closePath(); g.fill();
  const qw = (x1-x0)/2, qh = (y1-y0)/2;
  drawLion(g, x0+qw/2, y0+qh*0.62, 58);
  drawCrown(g, x0+qw/2, y0+qh*0.2, 17, '#e0b04a');
  drawCrown(g, mx+qw/2, y0+qh*0.55, 42, '#e0b04a');
  drawSwordEmblem(g, x0+qw/2, my+qh*0.5, 62, '#e0b04a');
  drawFleur(g, mx+qw/2, my+qh*0.5, 55, '#e0b04a');
});
const R_HEAD = 1.0, H_HEAD = 1.9;
const faceTex = canvasTex(2048, 512, (g, W, H) => {
  g.fillStyle = '#f0b9a0'; g.fillRect(0,0,W,H);
  const px = x => W/2 + Math.asin(Math.max(-1, Math.min(1, x/R_HEAD)))/(2*Math.PI)*W;
  const py = y => (1 - y/H_HEAD)*H;
  // глаза: круглые коричневые диски без зрачков
  for (const sx of [-1,1]){
    g.fillStyle = '#4a2014'; g.beginPath(); g.ellipse(px(sx*0.42), py(0.98), 39, 38, 0, 0, 7); g.fill();
    g.fillStyle = '#6e3a28'; g.beginPath(); g.ellipse(px(sx*0.42), py(0.98), 31, 30, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(px(sx*0.42)+11, py(0.98)-11, 6, 0, 7); g.fill();
  }
  g.fillStyle = '#0f0d0d';
  // усы
  g.beginPath(); g.moveTo(px(0), py(0.78));
  g.bezierCurveTo(px(0.2), py(0.82), px(0.38), py(0.72), px(0.34), py(0.6));
  g.bezierCurveTo(px(0.26), py(0.66), px(0.12), py(0.66), px(0), py(0.68));
  g.bezierCurveTo(px(-0.12), py(0.66), px(-0.26), py(0.66), px(-0.34), py(0.6));
  g.bezierCurveTo(px(-0.38), py(0.72), px(-0.2), py(0.82), px(0), py(0.78)); g.fill();
  // открытый рот
  g.fillStyle = '#2b0d0a'; g.beginPath(); g.ellipse(px(0), py(0.56), 38, 26, 0, 0, 7); g.fill();
  // бородка-эспаньолка
  g.fillStyle = '#0f0d0d'; g.beginPath(); g.moveTo(px(-0.17), py(0.5));
  g.bezierCurveTo(px(-0.16), py(0.36), px(-0.06), py(0.28), px(0), py(0.27));
  g.bezierCurveTo(px(0.06), py(0.28), px(0.16), py(0.36), px(0.17), py(0.5));
  g.bezierCurveTo(px(0.1), py(0.46), px(-0.1), py(0.46), px(-0.17), py(0.5)); g.fill();
}); faceTex.wrapS = THREE.RepeatWrapping;

  const J = n => c.getObjectByName(n);
  const torso = J('Torso'), head0 = J('Head');
  const SH = 0.1;   // у Зантио плечи шире на 0.1

  // торс: синий табард, красный пояс, белые штаны

mesh(torso, rb(2.5,1.62,1.2,0.22), M.blue, 0, 1.45, 0, 'Tabard');
mesh(torso, rb(2.3,0.62,1.2,0.16), M.red, 0, 0.35, 0, 'Belt');
mesh(torso, rb(2.15,0.5,1.12,0.14), M.white, 0, -0.02, 0, 'Pelvis');
{
  const p = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.5), new THREE.MeshPhysicalMaterial({
    map:tabardFront, roughness:0.4, clearcoat:0.5, polygonOffset:true, polygonOffsetFactor:-2}));
  p.position.set(0, 1.42, 0.606); p.receiveShadow = true; p.name = 'TabardFront'; torso.add(p);
  // пряжка пояса — золотой завиток
  const bk = mesh(torso, rb(0.62,0.4,0.08,0.05,2), M.buckle, 0, 0.36, 0.62, 'Buckle');
  const bh = mesh(bk, rb(0.28,0.14,0.04,0.03,2), M.red, 0, 0, 0.03);
}
mesh(torso, new THREE.CylinderGeometry(0.44,0.5,0.42,32), M.skin, 0, 2.38, 0, 'Neck');

  // голова (у Зантио голова на y=2.5, у Ричарда 2.48)
  const head = new THREE.Group(); head.name = 'ZHead'; head.position.y = 0.02; head0.add(head);

{
  const prof = new THREE.SplineCurve([[0,0],[0.55,0.02],[0.86,0.18],[0.985,0.55],[1.0,0.95],[0.99,1.3],[0.9,1.62],[0.65,1.82],[0.3,1.895],[0,1.9]].map(p => new THREE.Vector2(...p))).getPoints(48);
  const geo = new THREE.LatheGeometry(prof, 56);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, Math.atan2(pos.getX(i), pos.getZ(i))/(2*Math.PI) + 0.5, pos.getY(i)/H_HEAD);
  mesh(head, geo, new THREE.MeshPhysicalMaterial({map:faceTex, roughness:0.42, clearcoat:0.5, clearcoatRoughness:0.3}), 0, 0, 0, 'HeadShell');
}
  const HAIR_TOP = 0.55;
{
  const dome = mesh(head, new THREE.SphereGeometry(1.07, 40, 20, 0, Math.PI*2, 0, Math.PI/2), M.hair, 0, 1.2, 0, 'HairDome'); dome.scale.y = 0.72;
  const hh = 1.45 - HAIR_TOP;
  mesh(head, new THREE.CylinderGeometry(1.07, 1.08, hh, 48, 1, true, D(62), D(236)), M.hair, 0, HAIR_TOP + hh/2, 0, 'HairSides');
}
function hairPiece(name, a0, a1){
  const j = joint(head, name, 0, HAIR_TOP, 0);
  const h = 0.72, g = new THREE.CylinderGeometry(1.08, 1.13, h, 24, 3, true, D(a0), D(a1-a0));
  mesh(j, g, M.hair, 0, -h/2, 0, name + 'Mesh');
  return j;
}
const hairB = hairPiece('HairB', 118, 242), hairL = hairPiece('HairL', 62, 118), hairR = hairPiece('HairR', 242, 298);
  // треуголка
const hat = joint(head, 'Hat'); hat.rotation.x = -0.1;
{
  const Rb = 1.7, amp = 0.25, nR = 10, nA = 72, y0 = 1.36;
  const Rth = th => Rb*(1 + amp*Math.cos(3*(th - Math.PI)));
  const rise = (th, u) => (0.32*(0.5 - 0.5*Math.cos(3*(th - Math.PI))) + 0.04)*Math.pow(u, 2.4);
  const pos = [], idx = [], rows = nR + 1, cols = nA;
  const addLayer = dy => { for (let i = 0; i <= nR; i++) for (let j = 0; j < nA; j++){
    const th = j/nA*Math.PI*2, u = 0.55 + 0.45*i/nR, r = u*Rth(th);   // внутреннее кольцо спрятано под тульёй
    pos.push(Math.sin(th)*r, y0 + rise(th, u) + dy, Math.cos(th)*r); } };
  addLayer(0); addLayer(-0.09);
  const L = rows*cols;
  for (let layer = 0; layer < 2; layer++) for (let i = 0; i < nR; i++) for (let j = 0; j < nA; j++){
    const a = layer*L + i*cols + j, b = layer*L + i*cols + (j+1)%cols, c = a + cols, d = b + cols;
    idx.push(a,c,b, b,c,d);
  }
  for (let j = 0; j < nA; j++){ const a = nR*cols + j, b = nR*cols + (j+1)%cols, c = L + a - 0, d = L + b - 0; idx.push(a,b,c, b,d,c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  mesh(hat, g, M.hat, 0, 0, 0, 'Brim');
  const crown = mesh(hat, new THREE.CylinderGeometry(1.08, 1.14, 0.62, 48), M.hat, 0, y0 + 0.28, 0, 'HatCrown');
  const top = mesh(hat, new THREE.SphereGeometry(1.08, 40, 12, 0, Math.PI*2, 0, Math.PI/2), M.hat, 0, y0 + 0.59, 0, 'HatTop'); top.scale.y = 0.22;
}

  // руки: золотые рукава, кисти кожи — C-захват. Рукав делится по локтю Ричарда (плечо -0.85 локоть, кисть ещё -0.7)
function handGeo(){
  const R = 0.32, r = 0.155, gap = 0.75, s = new THREE.Shape();
  const a0 = -Math.PI/2 + gap/2, a1 = -Math.PI/2 + Math.PI*2 - gap/2;
  s.absarc(0,0,R,a0,a1,false); s.absarc(0,0,r,a1,a0,true); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth:0.5, bevelEnabled:true, bevelSize:0.035, bevelThickness:0.035, bevelSegments:2, curveSegments:28});
  g.translate(0,0,-0.25); return g;
}
  function buildArm(side){
    const L = side > 0, sh = J(L ? 'ShoulderL' : 'ShoulderR'), el = J(L ? 'ElbowL' : 'ElbowR'), wr = J(L ? 'WristL' : 'WristR');
    const x = side*SH;
    mesh(sh, new THREE.SphereGeometry(0.4, 24, 16), M.sleeve, x, 0, 0, 'Shoulder');
    mesh(sh, new THREE.CylinderGeometry(0.4, 0.377, 0.85, 28), M.sleeve, x, -0.425, 0, 'UpperSleeve');
    mesh(el, new THREE.CylinderGeometry(0.377, 0.37, 0.25, 28), M.sleeve, x, -0.125, 0, 'UpperSleeve2');
    mesh(el, new THREE.CylinderGeometry(0.37, 0.34, 0.75, 28), M.sleeve, x, -0.35, 0, 'LowerSleeve');
    const cuff = mesh(el, new THREE.TorusGeometry(0.35, 0.05, 8, 28), M.boot2, x, -0.71, 0); cuff.rotation.x = Math.PI/2;
    mesh(wr, handGeo(), M.skin, x, -0.3, 0, 'Hand');
  }
  buildArm(+1); buildArm(-1);

  // ноги: белые штаны, высокие золотые сапоги с отворотом (сапог и стопа на колене Ричарда: -1.55)
  function buildLeg(side){
    const L = side > 0, hip = J(L ? 'HipL' : 'HipR'), knee = J(L ? 'KneeL' : 'KneeR');
    mesh(hip, rb(1.0,1.5,1.08,0.2), M.white, 0, -0.75, 0, 'Thigh');
    mesh(knee, rb(0.96,1.45,1.02,0.2), M.boot, 0, -2.2+1.55, 0, 'Boot');
    mesh(knee, rb(1.12,0.4,1.2,0.14), M.boot2, 0, -1.5+1.55, 0, 'BootCuff');
    mesh(knee, rb(0.96,0.42,1.5,0.18), M.boot, 0, -2.79+1.55, 0.24, 'Foot');
  }
  buildLeg(+1); buildLeg(-1);

  // клапаны табарда (синие; статичные — пружин в игре нет)
function flap(name, w, d, x, z){
  const j = joint(torso, name, x, 0.66, z);
  mesh(j, rb(w, 1.15, d, Math.min(0.05, w/2-0.001, d/2-0.001), 2), M.blue, 0, -0.5, 0, name + 'Mesh');
  return j;
}
const flapB = flap('FlapB', 2.3, 0.1, 0, -0.56), flapL = flap('FlapL', 0.12, 0.8, 1.17, 0), flapR = flap('FlapR', 0.12, 0.8, -1.17, 0);

  // шпага в левой руке: группа Sword на WristL, хват в z=0, клинок вдоль +z; ниже на 0.3 (кисть Зантио)
  const sword = joint(J('WristL'), 'Sword'); sword.position.y = -0.3; sword.position.x = SH;
{
  const grip = mesh(sword, new THREE.CylinderGeometry(0.085,0.085,1.0,16), M.blade, 0, 0, 0.02, 'Grip'); grip.rotation.x = Math.PI/2;
  for (const z of [-0.25, 0, 0.25]) { const r = mesh(sword, new THREE.TorusGeometry(0.09,0.03,6,14), M.blade, 0, 0, z); }
  mesh(sword, new THREE.SphereGeometry(0.17,16,12), M.blade, 0, 0, -0.55, 'Pommel');
  const cup = mesh(sword, new THREE.SphereGeometry(0.34, 24, 12, 0, Math.PI*2, Math.PI/2, Math.PI/2), M.bladeDS, 0, 0, 0.5, 'Cup'); cup.rotation.x = -Math.PI/2; cup.scale.set(1,1,0.9);
  mesh(sword, rb(1.2,0.09,0.09,0.03,2), M.blade, 0, 0, 0.55, 'Crossguard');
  for (const sx of [-1,1]) mesh(sword, new THREE.SphereGeometry(0.075,10,8), M.blade, sx*0.62, 0, 0.55);
  const bow = mesh(sword, new THREE.TorusGeometry(0.46, 0.045, 8, 24, Math.PI), M.blade, 0.0, 0, 0.02, 'KnuckleBow');
  bow.rotation.set(0, Math.PI/2, Math.PI/2); bow.rotation.order = 'YXZ'; bow.position.set(0.47, 0, 0);
  // клинок: тонкий, сужается, лёгкий изгиб на конце
  const BL = 3.9, seg = 24, pos = [], idx = [];
  for (let i = 0; i <= seg; i++){
    const u = i/seg, z = 0.58 + u*BL, w = 0.11*(1-u) + 0.025*u, bend = 0.12*Math.pow(u, 4);
    pos.push(-w, bend, z,  w, bend, z,  0, bend + 0.03, z); // три точки сечения
  }
  for (let i = 0; i < seg; i++){ const a = i*3, b = a + 3;
    idx.push(a,a+2,b, a+2,b+2,b,  a+1,b+1,a+2, a+2,b+1,b+2, a,b,a+1, a+1,b,b+1); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); bg.setIndex(idx); bg.computeVertexNormals();
  mesh(sword, bg, M.bladeDS, 0, 0, 0, 'Blade');
}

  return c;
}
