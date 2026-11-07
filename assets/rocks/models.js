// Библиотека процедурных моделей группы «rocks» для фильма «Ниндзи».
// 1 единица = 1 условный метр; персонаж ≈ 6.5. Низ модели на y=0, центр в (0,0), вход/лицо смотрит в +z.
export const MODELS = [];
let T; // THREE (передаётся в make)

/* ───────── утилиты ───────── */
function rng(seed){ let a = (seed|0) + 0x9e3779b9 | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a>>>15, 1|a); t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; }; }
const strHash = s => { let h = 7; for (const ch of s) h = Math.imul(h*31 + ch.charCodeAt(0), 1) | 0; return Math.abs(h); };
const sstep = (a,b,x) => { const t = Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };
const lerp = (a,b,t) => a + (b-a)*t;
function h3(x,y,z,s){ let h = Math.imul(x,374761393) ^ Math.imul(y,668265263) ^ Math.imul(z,1274126177) ^ Math.imul(s|0,2147483629); h = Math.imul(h ^ h>>>13, 1274126177); h ^= h>>>16; return (h>>>0)/4294967296; }
function vn(x,y,z,s=0){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z), xf=x-xi, yf=y-yi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf), w=zf*zf*(3-2*zf), c=(i,j,k)=>h3(xi+i,yi+j,zi+k,s);
  return lerp(lerp(lerp(c(0,0,0),c(1,0,0),u), lerp(c(0,1,0),c(1,1,0),u), v), lerp(lerp(c(0,0,1),c(1,0,1),u), lerp(c(0,1,1),c(1,1,1),u), v), w);
}
const fbm = (x,y,z,s=0) => vn(x,y,z,s)*0.6 + vn(x*2.1,y*2.1,z*2.1,s+1)*0.3 + vn(x*4.3,y*4.3,z*4.3,s+2)*0.1;

const matCache = new Map();
function mat(hex, o = {}){
  const k = hex + JSON.stringify(o);
  if (!matCache.has(k)) matCache.set(k, new T.MeshStandardMaterial(Object.assign({color:hex, roughness:0.92, metalness:0, flatShading:true}, o)));
  return matCache.get(k);
}
function vcMat(double){
  const k = 'VC' + (double ? 2 : 1);
  if (!matCache.has(k)) matCache.set(k, new T.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:0.95, metalness:0, side: double ? T.DoubleSide : T.FrontSide}));
  return matCache.get(k);
}
function mesh(geo, material, name, shadow = true){
  const m = new T.Mesh(geo, material); m.castShadow = shadow; m.receiveShadow = true; if (name) m.name = name; return m;
}
const nonIdx = g => g.index ? g.toNonIndexed() : g;
/** красит неиндексированную геометрию по граням: fn(cx,cy,cz,nx,ny,nz) -> Color */
function paint(geo, fn){
  geo = nonIdx(geo);
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n*3);
  for (let i = 0; i < n; i += 3){
    const ax=p.getX(i), ay=p.getY(i), az=p.getZ(i), bx=p.getX(i+1), by=p.getY(i+1), bz=p.getZ(i+1), cx=p.getX(i+2), cy=p.getY(i+2), cz=p.getZ(i+2);
    let nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay), ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az), nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
    const l = Math.hypot(nx,ny,nz) || 1; nx/=l; ny/=l; nz/=l;
    const c = fn((ax+bx+cx)/3, (ay+by+cy)/3, (az+bz+cz)/3, nx, ny, nz);
    for (let k = 0; k < 3; k++){ col[(i+k)*3]=c.r; col[(i+k)*3+1]=c.g; col[(i+k)*3+2]=c.b; }
  }
  geo.setAttribute('color', new T.BufferAttribute(col,3));
  return geo;
}
/** трансформ + однотонная окраска, возвращает неиндексированную геометрию position/normal/color */
function piece(geo, {c, p=[0,0,0], r=[0,0,0], s=[1,1,1], q} = {}){
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  const quat = q || new T.Quaternion().setFromEuler(new T.Euler(r[0],r[1],r[2]));
  g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p), quat, new T.Vector3(...s)));
  if (c !== undefined){
    const cc = new T.Color(c), n = g.attributes.position.count, a = new Float32Array(n*3);
    for (let i = 0; i < n; i++){ a[i*3]=cc.r; a[i*3+1]=cc.g; a[i*3+2]=cc.b; }
    g.setAttribute('color', new T.BufferAttribute(a,3));
  }
  return g;
}
function merge(list){
  list = list.map(g => { g = nonIdx(g); if (g.attributes.uv){ g = g.clone(); g.deleteAttribute('uv'); } if (!g.attributes.normal){ g = g.clone(); g.computeVertexNormals(); } return g; });
  let n = 0; list.forEach(g => n += g.attributes.position.count);
  const hasC = list.every(g => g.attributes.color);
  const P = new Float32Array(n*3), N = new Float32Array(n*3), C = hasC ? new Float32Array(n*3) : null; let o = 0;
  list.forEach(g => { P.set(g.attributes.position.array, o*3); N.set(g.attributes.normal.array, o*3); if (hasC) C.set(g.attributes.color.array, o*3); o += g.attributes.position.count; });
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(P,3)); out.setAttribute('normal', new T.BufferAttribute(N,3));
  if (hasC) out.setAttribute('color', new T.BufferAttribute(C,3));
  return out;
}
function displace(g, fn){ const p = g.attributes.position; for (let i = 0; i < p.count; i++){ const o = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i,o[0],o[1],o[2]); } return g; }

/* ───────── камни ───────── */
function stoneColor(r, base = '#9b958c'){ return new T.Color(base).offsetHSL((r()-.5)*.04, (r()-.5)*.08, (r()-.5)*.08); }
function rockGeo({sx=1, sy=1, sz=1, amp=.3, freq=1.4, detail=2, cut=.6, seed=0}){
  const g = new T.IcosahedronGeometry(1, detail), p = g.attributes.position;
  for (let i = 0; i < p.count; i++){
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
    const d = 1 + (fbm(x*freq+seed*3.1, y*freq+seed*1.7, z*freq-seed*2.3, seed) - .5)*2*amp;
    p.setXYZ(i, x*d*sx, Math.max(y*d*sy, -cut*sy), z*d*sz);
  }
  return g;
}
function paintRock(g, r, base, moss){
  const mc = moss && new T.Color(moss);
  return paint(g, (cx,cy,cz,nx,ny,nz) => {
    let c = base.clone().offsetHSL(0, 0, ny*.05 + (r()-.5)*.05);
    if (mc && ny > .45 + (vn(cx*.7,cy*.7,cz*.7,4)-.5)*.5) c = mc.clone().offsetHSL(0, 0, (r()-.5)*.08 + ny*.02);
    return c;
  });
}
function rockMesh(r, o, base, moss){
  const b = base ? new T.Color(base) : stoneColor(r);
  const m = mesh(paintRock(rockGeo(o), r, b, moss), vcMat(false), 'Rock');
  return m;
}
function shardGeo({rad=2.5, h=8, seg=5, hs=3, lean=0, seed=0}){
  const g = new T.ConeGeometry(rad, h, seg, hs, true); g.translate(0, h/2, 0);
  displace(g, (x,y,z) => { const k = 1 - y/h, n = (fbm(x*.4+seed, y*.3, z*.4, seed) - .5)*.9*rad*k; return [x + n + lean*y/h*h*.3, y + (fbm(x*.5, y*.5, z*.5, seed+3)-.5)*.6*(y<h-.1?1:0), z + n*.8]; });
  return nonIdx(g);
}

add('rock_small', 'Валун мелкий', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  const m = rockMesh(r, {sx:1.5+r()*.5, sy:1.1+r()*.3, sz:1.3+r()*.4, amp:.3, seed:S}); b.add(m);
  for (let i = 0; i < 2; i++){ const p = rockMesh(r, {sx:.5+r()*.3, sy:.4+r()*.2, sz:.5+r()*.3, amp:.25, detail:1, seed:S+i+1}); const a = r()*6.28; p.position.set(Math.cos(a)*2.4, 0, Math.sin(a)*2.4); b.add(p); }
  g.add(b);
});
add('rock_medium', 'Валун средний', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  b.add(rockMesh(r, {sx:3.1+r()*.5, sy:2.4+r()*.4, sz:2.8+r()*.4, amp:.3, seed:S}));
  const m2 = rockMesh(r, {sx:1.5, sy:1.3, sz:1.4, amp:.3, seed:S+1}); m2.position.set(3.3, 0, 1.6); b.add(m2);
  const m3 = rockMesh(r, {sx:.8, sy:.6, sz:.8, amp:.3, detail:1, seed:S+2}); m3.position.set(-2.8, 0, 3); b.add(m3);
  g.add(b);
});
add('rock_large', 'Валун крупный', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  b.add(rockMesh(r, {sx:6.2+r(), sy:5.6+r(), sz:5.6+r(), amp:.28, cut:.45, seed:S}));
  const m2 = rockMesh(r, {sx:3.6, sy:3.4, sz:3.2, amp:.3, seed:S+1}); m2.position.set(5.2, 0, 2.8); b.add(m2);
  const m3 = rockMesh(r, {sx:2.4, sy:2, sz:2.4, amp:.3, seed:S+2}); m3.position.set(-5, 0, 3.6); b.add(m3);
  const m4 = rockMesh(r, {sx:1.3, sy:1, sz:1.3, amp:.3, detail:1, seed:S+3}); m4.position.set(1, 0, 7); b.add(m4);
  g.add(b);
});
add('rock_flat', 'Валун плоский', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  b.add(rockMesh(r, {sx:5.6+r(), sy:1.2, sz:4.6+r(), amp:.2, cut:.55, seed:S}));
  const m2 = rockMesh(r, {sx:3.4, sy:1, sz:2.8, amp:.2, cut:.5, seed:S+1}); m2.position.set(-.8, 1.3, -.4); m2.rotation.y = r()*3; b.add(m2);
  const m3 = rockMesh(r, {sx:1.6, sy:.6, sz:1.4, amp:.2, cut:.5, detail:1, seed:S+2}); m3.position.set(6, 0, 3); b.add(m3);
  g.add(b);
});
add('rock_sharp', 'Валун острый', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  const base = stoneColor(r, '#8a857e');
  const defs = [[0,0,2.7,9.5,0],[3.2,1.4,2,6.5,.5],[-2.8,1.8,1.9,5.5,-.6],[1.2,-3.2,1.7,4.5,.4],[-.8,3.4,1.2,3,-.3]];
  const geos = defs.map((d, i) => { const gg = shardGeo({rad:d[2], h:d[3], lean:d[4], seed:S+i}); gg.translate(d[0], 0, d[1]); return paint(gg, (cx,cy,cz,nx,ny) => base.clone().offsetHSL(0,0,ny*.07 + cy/14*.06 + (r()-.5)*.05)); });
  b.add(mesh(merge(geos), vcMat(false), 'Shards'));
  g.add(b);
});
add('rock_mossy', 'Валун замшелый', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  b.add(rockMesh(r, {sx:3.4, sy:2.8, sz:3.1, amp:.3, seed:S}, null, '#5d8a3c'));
  const m2 = rockMesh(r, {sx:1.9, sy:1.5, sz:1.7, amp:.3, seed:S+1}, null, '#6ea848'); m2.position.set(3.5, 0, 1.8); b.add(m2);
  const geos = [];
  for (let i = 0; i < 6; i++){ const a = r()*6.28, d = 2.8 + r()*1.2; geos.push(piece(new T.IcosahedronGeometry(1,0), {c:new T.Color('#6ea848').offsetHSL(0,0,(r()-.5)*.1), p:[Math.cos(a)*d, .2, Math.sin(a)*d], s:[.9+r()*.6, .35, .9+r()*.6]})); }
  const mo = mesh(merge(geos), vcMat(false), 'Moss'); b.add(mo);
  g.add(b);
});

/* ───────── утёсы ───────── */
function pillar({rb, rt, h, seg=8, hs=4, amp=.22, x=0, y=0, z=0, seed=0, lean=0, ry=0}){
  const g = new T.CylinderGeometry(rt, rb, h, seg, hs); g.translate(0, h/2, 0);
  displace(g, (X,Y,Z) => { const k = 1 + (fbm(X*.2+seed, Y*.2, Z*.2, seed)-.5)*2*amp; let yy = Y; if (Y > h-.01) yy += (fbm(X*.3+9, 0, Z*.3, seed+4)-.5)*h*.1; return [X*k + lean*Y/h, yy, Z*k]; });
  g.rotateY(ry); g.translate(x, y, z);
  return nonIdx(g);
}
function cliffPaint(g, r, {top='#6ea848', a='#a79f92', b='#8f877b', band=3} = {}){
  const ct = new T.Color(top), ca = new T.Color(a), cb = new T.Color(b);
  return paint(g, (cx,cy,cz,nx,ny) => {
    if (ny > .72) return ct.clone().offsetHSL(0,0,(r()-.5)*.06);
    const k = Math.floor(cy/band + (fbm(cx*.1,0,cz*.1,3)-.5)*1.2);
    return (k & 1 ? ca : cb).clone().offsetHSL(0, 0, (r()-.5)*.05 - (cy < 2 ? .06 : 0));
  });
}
function addBase(group, r, S, list){ list.forEach((d, i) => { const m = rockMesh(r, {sx:d[2], sy:d[2]*.75, sz:d[2]*.9, amp:.3, detail:1, seed:S+10+i}); m.position.set(d[0], 0, d[1]); group.add(m); }); }

add('cliff_tower', 'Утёс-башня', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  const gs = [pillar({rb:10,rt:8.5,h:11,seed:S}), pillar({rb:7.5,rt:6,h:9,y:10.5,x:1.2,z:-.5,seed:S+1,lean:1}), pillar({rb:5.2,rt:3.6,h:7.5,y:19,x:-.5,z:.8,seed:S+2,lean:-.8}), pillar({rb:5,rt:3,h:8,x:7.5,z:2.5,seed:S+3,hs:3}), pillar({rb:3.5,rt:2.4,h:5,x:-8,z:3,seed:S+4,hs:2})];
  b.add(mesh(cliffPaint(merge(gs), r), vcMat(false), 'Cliff'));
  addBase(b, r, S, [[11,6,2.4],[-7,8,2],[3,10,1.4]]);
  g.add(b);
});
add('cliff_coast', 'Прибрежный обрыв', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  const bx = new T.BoxGeometry(34, 18, 14, 11, 6, 5); bx.translate(0, 9, 0);
  displace(bx, (x,y,z) => {
    const t = (-z + 7)/14, f = y/18;
    let yy = y - f*t*t*9; yy *= 1 - .35*sstep(10, 17, x);
    const nx = (fbm(x*.12, y*.12, z*.12, S) - .5)*4*(f + .3), nz = (fbm(x*.12+7, y*.12, z*.12, S+1) - .5)*4;
    return [x + nx, yy, z + nz + f*1.6];
  });
  b.add(mesh(cliffPaint(nonIdx(bx), r, {a:'#b3a58b', b:'#9c8e76', band:2.8}), vcMat(false), 'Cliff'));
  addBase(b, r, S, [[-13,10,2.8],[4,10.5,2],[14,9,3],[-5,11,1.2]]);
  g.add(b);
});
add('cliff_layered', 'Слоёный утёс', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  const rad = [11,10,9.5,8,9.5,6.5,5.5,4.2], gs = []; let y = 0;
  rad.forEach((R, i) => { const t = 3; gs.push(pillar({rb:R, rt:R*.96, h:t, seg:9, hs:1, amp:.2, y, x:(r()-.5)*2.2, z:(r()-.5)*2.2, seed:S+i, ry:r()*3})); y += t - .1; });
  b.add(mesh(cliffPaint(merge(gs), r, {a:'#c2a580', b:'#a98862', band:3}), vcMat(false), 'Cliff'));
  addBase(b, r, S, [[12,5,2.2],[-10,9,1.8]]);
  g.add(b);
});
add('cliff_spires', 'Скальные зубцы', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  const base = stoneColor(r, '#8c8780');
  const defs = [[0,0,4.6,30,.6],[6.5,2,3.6,20,-.5],[-6,3,3.8,24,-.4],[3,-6,3,16,.3],[-3.5,-5.5,2.8,14,.5],[10,-3,2,11,.4]];
  const gs = defs.map((d,i) => { const gg = shardGeo({rad:d[2], h:d[3], seg:6, hs:6, lean:d[4], seed:S+i}); gg.translate(d[0], 0, d[1]); return paint(gg, (cx,cy,cz,nx,ny) => base.clone().offsetHSL(0,0,cy/30*.08 + ny*.05 + (r()-.5)*.05 - (cy<2?.05:0))); });
  b.add(mesh(merge(gs), vcMat(false), 'Spires'));
  addBase(b, r, S, [[-1,6,2.6],[8,6,2],[-9,0,2.2]]);
  g.add(b);
});

/* ───────── арки и столбы ───────── */
function foamRing(r1, r2){ const m = new T.Mesh(new T.RingGeometry(r1, r2, 28), new T.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.6, depthWrite:false})); m.rotation.x = -Math.PI/2; m.position.y = .12; m.userData.nobox = true; m.name = 'Foam'; return m; }
function foamAnim(g, foams){ g.userData.animate = t => foams.forEach((f,i) => { const s = 1 + .07*Math.sin(t*1.6 + i*1.7); f.scale.set(s,1,s); f.material = f.material; f.position.y = .12; }); }
function extruded(shape, depth, bev = .6){ const g = new T.ExtrudeGeometry(shape, {depth, bevelEnabled:true, bevelThickness:bev, bevelSize:bev, bevelSegments:1, curveSegments:10}); g.translate(0, 0, -depth/2); return g; }
function roughen(g, S, a = .8){ return displace(g, (x,y,z) => [x + (fbm(x*.2,y*.2,z*.2,S)-.5)*a*2, y + (fbm(x*.2+5,y*.2,z*.2,S+1)-.5)*a*2, z + (fbm(x*.2,y*.2+5,z*.2,S+2)-.5)*a*2]); }

add('sea_arch', 'Скальная арка у моря', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  const s = new T.Shape();
  s.moveTo(-15,0); s.lineTo(-7,0); s.lineTo(-7,5); s.absellipse(0,5,7,6,Math.PI,0,true); s.lineTo(7,0); s.lineTo(15,0);
  s.lineTo(14,8); s.lineTo(10,14); s.lineTo(4,16); s.lineTo(-4,16.5); s.lineTo(-10,13); s.lineTo(-14,8); s.lineTo(-15,0);
  const geo = roughen(extruded(s, 8, .8), S, .7);
  b.add(mesh(cliffPaint(nonIdx(geo), r, {a:'#cbbfa5', b:'#b5a88d', band:2.6, top:'#78a84e'}), vcMat(false), 'Arch'));
  addBase(b, r, S, [[-13,5,2.6],[13,4.5,2.2],[-16,-1,1.6]]);
  const foams = [foamRing(7,10), foamRing(8,11)]; foams[0].position.set(-11,.12,0); foams[1].position.set(11,.12,0); foams.forEach(f => b.add(f)); foamAnim(g, foams);
  g.add(b);
});
add('sea_stack', 'Морской столб', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  const gs = [pillar({rb:7,rt:5.6,h:12,seg:9,seed:S}), pillar({rb:5.8,rt:4.4,h:10,y:11.5,x:.6,seed:S+1,lean:1}), pillar({rb:4.4,rt:3,h:9,y:21,x:-.4,z:.5,seed:S+2,lean:-.8}),
    pillar({rb:3.2,rt:2.2,h:13,x:9,z:3,seed:S+3,lean:.6}), pillar({rb:2.4,rt:1.5,h:7,x:-8,z:4,seed:S+4,hs:3})];
  b.add(mesh(cliffPaint(merge(gs), r, {a:'#b8ae9c', b:'#9a907e', band:2.5, top:'#78a84e'}), vcMat(false), 'Stack'));
  const foams = [foamRing(7,10.5), foamRing(3,5.5), foamRing(2.4,4.5)]; foams[1].position.set(9,.12,3); foams[2].position.set(-8,.12,4); foams.forEach(f => b.add(f)); foamAnim(g, foams);
  g.add(b);
});

/* ───────── рельеф: горы, холмы, вулкан ───────── */
function terrain({rings=16, segs=30, sx=1, sz=1, h}){
  const pos = [0, Math.max(0,h(0,0,0,0)), 0], idx = [];
  for (let i = 1; i <= rings; i++){ const u = i/rings; for (let j = 0; j < segs; j++){ const th = j/segs*Math.PI*2, x = Math.cos(th)*u*sx, z = Math.sin(th)*u*sz; pos.push(x, i === rings ? 0 : Math.max(0, h(x,z,u,th)), z); } }
  const v = (i,j) => 1 + (i-1)*segs + (j % segs);
  for (let j = 0; j < segs; j++) idx.push(0, v(1,j+1), v(1,j));
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++){ const a=v(i,j), b=v(i,j+1), c=v(i+1,j), d=v(i+1,j+1); idx.push(a,b,c, b,d,c); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
  return nonIdx(g);
}
const GR = '#6ea848';
function mountPaint(g, r, o){
  const grass = new T.Color(GR), dgrass = new T.Color('#7f9a55'), rock = new T.Color(o.rock || '#8b857c'), rock2 = new T.Color(o.rock2 || '#a39d93'), snow = new T.Color('#f4f8fb'), snow2 = new T.Color('#d3e1ee');
  return paint(g, (cx,cy,cz,nx,ny) => {
    const t = cy/o.H; let c;
    if (o.snow && (t > o.snow || (t > o.snow - .15 && ny > .55 + (vn(cx*.1,cy*.1,cz*.1,2)-.5)*.5))) c = (ny > .6 ? snow : snow2).clone();
    else if (t < .12 && ny > .6) c = grass.clone();
    else if (t < .3 && ny > .75) c = dgrass.clone();
    else c = (Math.floor(cy/4) & 1 ? rock : rock2).clone().offsetHSL(0,0,(t-.4)*.1);
    return c.offsetHSL(0, 0, (r()-.5)*.05);
  });
}
add('mount_cone', 'Гора-конус', (g, r, S) => {
  const H = 64 + r()*10, R = 52 + r()*6;
  const geo = terrain({rings:20, segs:32, sx:R, sz:R, h:(x,z,u,th) => {
    const ridge = 1 + .14*Math.sin(th*5 + fbm(x*.05,0,z*.05,S)*4);
    return Math.min(H*.98, H*Math.pow(1-u,1.35)*ridge + 18*Math.exp(-((x-24)**2 + (z+8)**2)/190)*(1-u) + (fbm(x*.08,0,z*.08,S)-.5)*9*u*(1-u)*2);
  }});
  g.add(mesh(mountPaint(geo, r, {H}), vcMat(false), 'Mountain'));
});
add('mount_ridge', 'Зубчатая гряда', (g, r, S) => {
  const peaks = [-48,-26,-5,18,42].map((x,i) => [x + (r()-.5)*8, 30 + r()*30, 12 + r()*8]);
  const spine = x => { let m = 12; peaks.forEach(p => m = Math.max(m, p[1]*Math.max(0, 1 - Math.abs(x-p[0])/p[2]))); return m + (fbm(x*.1,0,S,S)-.5)*8; };
  const H = Math.max(...peaks.map(p => p[1]));
  const geo = terrain({rings:18, segs:44, sx:70, sz:26, h:(x,z,u) => spine(x)*sstep(1,.45,u)*(.55 + .45*Math.max(0, 1-(z/26)**2)) + (fbm(x*.2,0,z*.2,S+3)-.5)*5*(1-u)});
  g.add(mesh(mountPaint(geo, r, {H, snow:.88, rock:'#7f7a74', rock2:'#97918a'}), vcMat(false), 'Mountain'));
});
add('mount_snow', 'Снежная вершина', (g, r, S) => {
  const H = 80 + r()*10, R = 46;
  const geo = terrain({rings:20, segs:32, sx:R, sz:R, h:(x,z,u,th) => {
    const ridge = 1 + .2*Math.cos(4*th + 1 + fbm(x*.04,0,z*.04,S)*2);
    return H*Math.pow(1-u,1.15)*ridge + 24*Math.exp(-((x+22)**2 + (z-12)**2)/160)*(1-u) + (fbm(x*.1,0,z*.1,S)-.5)*6*u*(1-u)*2;
  }});
  g.add(mesh(mountPaint(geo, r, {H, snow:.58, rock:'#7a7775', rock2:'#8d8a87'}), vcMat(false), 'Mountain'));
});
add('mount_mesa', 'Плосколобая гора (плато)', (g, r, S) => {
  const H = 40 + r()*6, R = 58;
  const geo = terrain({rings:24, segs:36, sx:R, sz:R, h:(x,z,u,th) => {
    const rs = 1 + (fbm(Math.cos(th)*1.3+5, Math.sin(th)*1.3, S, S)-.5)*.22, v = u/rs; let t;
    if (v < .3) t = 1; else if (v < .46) t = 1 - .62*sstep(.3,.46,v); else t = .38*Math.pow(Math.max(0, 1-(v-.46)/.44), 1.3);
    return H*t + (v < .3 ? (fbm(x*.3,0,z*.3,S)-.5)*.7 : (fbm(x*.15,0,z*.15,S)-.5)*3*(v<.5?1:.4));
  }});
  const a = new T.Color('#b8a58a'), b = new T.Color('#a08f78'), tal = new T.Color('#9aa468'), gc = new T.Color(GR);
  paint(geo, (cx,cy,cz,nx,ny) => {
    let c; if (cy > H*.93 && ny > .9) c = gc.clone(); else if (ny < .82 && cy > H*.33) c = (Math.floor(cy/3) & 1 ? a : b).clone(); else c = tal.clone().lerp(new T.Color('#d8c690'), 1 - sstep(0, H*.4, cy));
    return c.offsetHSL(0,0,(r()-.5)*.05);
  });
  const m = mesh(geo, vcMat(false), 'Mountain'); g.add(m);
  const top = new T.Group(); top.name = 'PlateauProps'; top.position.y = H;
  [[10,6,1.6],[-12,-5,2.2],[3,-14,1.4],[-6,12,1.2]].forEach((d,i) => { const k = rockMesh(r, {sx:d[2], sy:d[2]*.7, sz:d[2], detail:1, seed:S+i}); k.position.set(d[0], 0, d[1]); top.add(k); });
  g.add(top);
});

function hillBuild(g, r, S, o){
  const geo = terrain({rings:o.rings || 12, segs:26, sx:o.sx, sz:o.sz, h:o.h});
  const gc = new T.Color(GR), lc = new T.Color('#84b858'), yc = new T.Color('#9cb663'), rc = new T.Color('#9b958c');
  paint(geo, (cx,cy,cz,nx,ny) => {
    let c = o.rocky && ny < .78 ? rc.clone() : gc.clone().lerp(lc, sstep(0, o.H, cy)).lerp(yc, 1 - sstep(0, o.H*.25, cy)*1);
    return c.offsetHSL(0,0,(r()-.5)*.06);
  });
  g.add(mesh(geo, vcMat(false), 'Hill'));
}
add('hill_round', 'Холм круглый', (g, r, S) => {
  const H = 10 + r()*3, R = 24;
  hillBuild(g, r, S, {H, sx:R, sz:R, h:(x,z,u) => H*Math.pow(1-u*u,1.5)*(1 + (fbm(x*.1,0,z*.1,S)-.5)*.5)});
  const p = new T.Group(); p.name = 'Props'; p.userData = {};
  [[8,6],[-6,-9]].forEach((d,i) => { const k = rockMesh(r, {sx:1.2, sy:.9, sz:1.1, detail:1, seed:S+i}); k.position.set(d[0], 0, d[1]); p.add(k); });
  g.add(p); p.children.forEach(k => { const u = Math.hypot(k.position.x, k.position.z)/R; k.position.y = H*Math.pow(1-u*u,1.5)*.9 - .2; });
});
add('hill_twin', 'Холм двойной', (g, r, S) => {
  const H1 = 12, H2 = 8;
  hillBuild(g, r, S, {H:H1, sx:32, sz:20, rings:14, h:(x,z,u) => (H1*Math.exp(-((x+9)**2 + z**2)/90) + H2*Math.exp(-((x-11)**2 + (z-2)**2)/50))*sstep(1,.6,u) + (fbm(x*.1,0,z*.1,S)-.5)*1.5*(1-u)});
});
add('hill_rocky', 'Холм с каменным выходом', (g, r, S) => {
  const H = 13, R = 22;
  const hf = (x,z,u) => H*Math.pow(1-u*u,1.3)*(1 + .35*Math.max(0, -x/R)) * (1 + (fbm(x*.12,0,z*.12,S)-.5)*.5);
  hillBuild(g, r, S, {H, sx:R, sz:R, rocky:true, h:hf});
  const o = new T.Group(); o.name = 'Outcrop';
  [[-6,-2,3.4,3.2],[-3,2,2.4,2.4],[-9,3,2.2,2],[0,-5,1.6,1.4]].forEach((d,i) => { const k = rockMesh(r, {sx:d[2], sy:d[3], sz:d[2]*.9, seed:S+i, detail:2}); const u = Math.hypot(d[0], d[1])/R; k.position.set(d[0], hf(d[0], d[1], u)*.85 - .4, d[1]); o.add(k); });
  g.add(o);
});

add('volcano', 'Вулкан с кратером', (g, r, S) => {
  const H = 52, R = 60, UR = .16;
  const hc = (u) => { const hr = H*Math.pow(1-UR,1.5); return u >= UR ? H*Math.pow(1-u,1.5) + H*.03*Math.exp(-(((u-UR-.01)/.05)**2)) : hr*(.7 + .3*sstep(0,UR,u)); };
  const geo = terrain({rings:22, segs:32, sx:R, sz:R, h:(x,z,u,th) => hc(u)*(1 + .06*Math.sin(th*7 + S)) + (fbm(x*.1,0,z*.1,S)-.5)*4*u*(1-u)*2});
  const dark = new T.Color('#5a4a44'), ash = new T.Color('#756860'), gc = new T.Color(GR), dg = new T.Color('#7f9a55');
  paint(geo, (cx,cy,cz,nx,ny) => { const t = cy/H; let c = t < .1 && ny > .6 ? gc.clone() : t < .25 && ny > .7 ? dg.clone() : (Math.floor(cy/4)&1 ? dark : ash).clone(); return c.offsetHSL(0,0,(r()-.5)*.05); });
  g.add(mesh(geo, vcMat(false), 'Mountain'));
  const hr = H*Math.pow(1-UR,1.5), L = hr*.8; let uL = 0; for (let u = 0; u < UR; u += .001) if (hc(u) < L) uL = u;
  const lava = new T.Mesh(new T.CircleGeometry(uL*R*1.02, 14), new T.MeshBasicMaterial({color:0xff6a1f})); lava.rotation.x = -Math.PI/2; lava.position.y = L + .15; lava.name = 'Lava'; g.add(lava);
  const lmat = new T.MeshBasicMaterial({color:0xff7a2a, side:T.DoubleSide}), streams = [];
  for (let k = 0; k < 3; k++){
    const j = Math.floor(r()*32), pts = [];
    for (let i = 4; i <= 18; i++){ const u = i/22, th = j/32*Math.PI*2 + Math.sin(i*.7+k)*.04; pts.push([Math.cos(th)*u*R, 0, Math.sin(th)*u*R, th, i]); }
    const pos = [], ix = [];
    pts.forEach((p, n) => { const u = p[4]/22, th = j/32*Math.PI*2, y = geo.userData.hAt ? 0 : (hc(u)*(1 + .06*Math.sin(th*7+S)) + (fbm(p[0]*.1,0,p[2]*.1,S)-.5)*4*u*(1-u)*2) + .9, w = 1 + n*.18, tx = -Math.sin(th), tz = Math.cos(th); pos.push(p[0]-tx*w, y, p[2]-tz*w, p[0]+tx*w, y, p[2]+tz*w); if (n) { const a = (n-1)*2; ix.push(a,a+1,a+2, a+1,a+3,a+2); } });
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pos,3)); sg.setIndex(ix); const sm = new T.Mesh(sg, lmat); sm.name = 'LavaStream'; sm.userData.nobox = false; g.add(sm); streams.push(sm);
  }
  const smoke = new T.Group(); smoke.name = 'Smoke'; smoke.userData.nobox = true;
  const puffs = []; for (let i = 0; i < 14; i++){ const m = new T.Mesh(new T.IcosahedronGeometry(1,0), new T.MeshLambertMaterial({color:0x6d6560, transparent:true, depthWrite:false, flatShading:true})); puffs.push(m); smoke.add(m); }
  g.add(smoke);
  const c1 = new T.Color(0xff5a1a), c2 = new T.Color(0xffb347), tmp = new T.Color();
  g.userData.animate = t => {
    tmp.copy(c1).lerp(c2, .5 + .5*Math.sin(t*2.2)); lava.material.color.copy(tmp); lmat.color.copy(tmp).lerp(c1, .3);
    puffs.forEach((m, i) => { const ph = (t*.07 + i/14) % 1; m.position.set(Math.sin(i*2.1)*3 + ph*ph*26, hr + 2 + ph*46, Math.cos(i*1.7)*3); m.scale.setScalar(3 + ph*9); m.material.opacity = (1-ph)*.85*Math.min(1, ph*8); m.rotation.y = i + t*.2; });
  };
  g.userData.animate(0);
});

/* ───────── пещеры ───────── */
function tunnelPaint(g, r, o){
  const dk1 = new T.Color('#5b4d42'), dk2 = new T.Color('#15110e'), cp = o.cp;
  const base = cliffPaint(g, r, cp);
  return base;
}
function caveBuild(g, r, S, o){
  const b = new T.Group(); b.name = 'Body';
  const front = roughen(extruded(o.outline(true), o.depth, .6), S, .5);
  const back = roughen(extruded(o.outline(false), 8, .6), S+3, .5); back.translate(0, 0, -o.depth/2 - 4);
  const cp = new T.Color(o.a), cq = new T.Color(o.b), ct = new T.Color(o.top), dk1 = new T.Color('#5b4d42'), dk2 = new T.Color('#15110e');
  const z0 = -o.depth/2, z1 = o.depth/2;
  const paintFn = (cx,cy,cz,nx,ny,nz) => {
    if (Math.abs(cx) < o.hw + .7 && cy < o.hh + .7 && Math.abs(nz) < .6 && cz > z0 - .5 && cz < z1 + .7 && ny < .7) return dk1.clone().lerp(dk2, sstep(z1, z0, cz)*.9);
    if (ny > .72) return ct.clone().offsetHSL(0,0,(r()-.5)*.06);
    return ((Math.floor(cy/3 + (fbm(cx*.1,0,cz*.1,3)-.5)) & 1) ? cp : cq).clone().offsetHSL(0,0,(r()-.5)*.05 - (cy<2?.06:0));
  };
  b.add(mesh(paint(merge([nonIdx(front), nonIdx(back)]), paintFn), vcMat(false), 'Rock'));
  // тёмный проём и пол
  const dark = new T.Mesh(new T.ShapeGeometry(o.outline(true, true)), new T.MeshBasicMaterial({color:0x0a0806})); dark.position.z = z0 + 1.5; dark.name = 'Darkness'; b.add(dark);
  const floor = new T.Mesh(new T.PlaneGeometry(o.hw*2 + 1, o.depth - 1.5), new T.MeshStandardMaterial({color:0x3a3028, roughness:1})); floor.rotation.x = -Math.PI/2; floor.position.set(0, .05, (z0 + 1.5 + z1)/2 + .3); floor.name = 'Floor'; floor.receiveShadow = true; b.add(floor);
  g.add(b); return {b, z1};
}
add('cave_arch', 'Пещера в скале', (g, r, S) => {
  const outline = (hole, holeOnly) => {
    const s = new T.Shape();
    if (holeOnly){ s.moveTo(-5.4,0); s.lineTo(-5.4,6); s.absellipse(0,6,5.4,5.4,Math.PI,0,true); s.lineTo(5.4,0); s.lineTo(-5.4,0); return s; }
    s.moveTo(-19,0);
    if (hole){ s.lineTo(-5.5,0); s.lineTo(-5.5,6); s.absellipse(0,6,5.5,5.5,Math.PI,0,true); s.lineTo(5.5,0); }
    s.lineTo(19,0); s.lineTo(18,8); s.bezierCurveTo(16,17, 8,22, 0,22); s.bezierCurveTo(-8,22,-16,17,-18,8); s.lineTo(-19,0); return s;
  };
  const {b, z1} = caveBuild(g, r, S, {outline, depth:12, hw:5.5, hh:11.5, a:'#a79f92', b:'#8f877b', top:GR});
  addBase(b, r, S, [[-13,z1+2,3],[12.5,z1+1.5,2.5],[-7.5,z1+2.5,1.2],[8,z1+3,1]]);
});
add('cave_mine', 'Пещера-шахта со срубом', (g, r, S) => {
  const outline = (hole, holeOnly) => {
    const s = new T.Shape();
    if (holeOnly){ s.moveTo(-3.3,0); s.lineTo(-3.3,7.5); s.lineTo(0,12); s.lineTo(3.3,7.5); s.lineTo(3.3,0); s.lineTo(-3.3,0); return s; }
    s.moveTo(-13,0);
    if (hole){ s.lineTo(-3.4,0); s.lineTo(-3.4,7.5); s.lineTo(0,12.5); s.lineTo(3.4,7.5); s.lineTo(3.4,0); }
    [[13,0],[12,9],[9,17],[4,23],[-2,25],[-8,19],[-12,10],[-13,0]].forEach(p => s.lineTo(p[0], p[1])); return s;
  };
  const {b, z1} = caveBuild(g, r, S, {outline, depth:9, hw:3.4, hh:12, a:'#8d8880', b:'#77726b', top:'#6a9a46'});
  const wood = new T.Group(); wood.name = 'Frame';
  const w1 = '#9a6a3e', w2 = '#6b4527', zf = z1 + .9;
  const bx = (w,h,d,x,y,z,c,rz=0) => { const m = mesh(new T.BoxGeometry(w,h,d), mat(c), 'Beam'); m.position.set(x,y,z); m.rotation.z = rz; wood.add(m); return m; };
  bx(.9, 9.4, .9, -3.9, 4.7, zf, w1); bx(.9, 9.4, .9, 3.9, 4.7, zf, w1); bx(9.2, .9, 1, 0, 9.5, zf, w2);
  bx(.7, 3.2, .7, -2.4, 8.4, zf, w2, -.8); bx(.7, 3.2, .7, 2.4, 8.4, zf, w2, .8);
  for (const sx of [-1.8, 1.8]) bx(.35, .25, 14, sx, .15, z1 - 2, '#6b4527');
  for (let i = 0; i < 6; i++) bx(5, .2, .6, 0, .08, z1 + 1.5 - i*2.2, w1);
  const lamp = mesh(new T.BoxGeometry(.7,1,.7), new T.MeshStandardMaterial({color:0xffcf6a, emissive:0xffa530, emissiveIntensity:1.2}), 'Lantern', false); lamp.position.set(-3.2, 7.4, zf + .9); wood.add(lamp);
  bx(.15, 1.4, .15, -3.2, 8.7, zf + .9, w2);
  b.add(wood);
  addBase(b, r, S, [[-10,z1+2,2.4],[10,z1+1,2],[7,z1+3.5,1.1]]);
  g.userData.animate = t => { lamp.material.emissiveIntensity = 1.1 + .35*Math.sin(t*9) + .2*Math.sin(t*23); };
});

/* ───────── галька, пирамидка ───────── */
function pebbleGeo(sx, sy, sz, seed, detail = 1){ return rockGeo({sx, sy, sz, amp:.14, detail, cut:.7, seed}); }
add('pebbles_pile', 'Кучка камешков', (g, r, S) => {
  const cols = ['#a39d94','#8e8880','#b5ab98','#7f7a74','#c2b8a3'], gs = [];
  for (let i = 0; i < 16; i++){
    const rad = Math.sqrt(r())*3.3, a = r()*6.28, s = .7 + r()*.7*(1 - rad/5);
    gs.push(piece(pebbleGeo(s*1.2, s*.8, s, S+i), {c:new T.Color(cols[i%5]).offsetHSL(0,0,(r()-.5)*.06), p:[Math.cos(a)*rad, s*.5 + 1.5*Math.max(0, 1 - rad/3.4), Math.sin(a)*rad], r:[0, r()*6, 0]}));
  }
  const b = new T.Group(); b.name = 'Body'; b.add(mesh(merge(gs), vcMat(false), 'Pebbles')); g.add(b);
});
add('beach_pebbles', 'Галька на пляже', (g, r, S) => {
  const cols = ['#cfc6b0','#b7ab94','#e2dccb','#9a9286','#a8806a'], gs = [], pts = [];
  for (let i = 0, tries = 0; i < 30 && tries < 400; tries++){
    const rad = Math.sqrt(r())*8, a = r()*6.28, x = Math.cos(a)*rad, z = Math.sin(a)*rad, s = i < 3 ? .8 + r()*.4 : .3 + r()*.45;
    if (pts.some(p => Math.hypot(p[0]-x, p[1]-z) < (p[2]+s)*1.5)) continue;
    pts.push([x,z,s]); i++;
    gs.push(piece(pebbleGeo(s*1.3, s*.45, s, S+i, i < 10 ? 1 : 0), {c:new T.Color(cols[i%5]).offsetHSL(0,0,(r()-.5)*.06), p:[x, s*.2, z], r:[0, r()*6, 0]}));
  }
  const b = new T.Group(); b.name = 'Body'; b.add(mesh(merge(gs), vcMat(false), 'Pebbles')); g.add(b);
});
add('stone_cairn', 'Пирамидка из камней', (g, r, S) => {
  const gs = []; let y = 0;
  for (let i = 0; i < 7; i++){
    const w = 2.8*Math.pow(.76, i) + .5, t = w*.42;
    gs.push(piece(pebbleGeo(w, t, w*.9, S+i), {c:new T.Color(['#a39d94','#8e8880','#b5ab98'][i%3]).offsetHSL(0,0,(r()-.5)*.05), p:[(r()-.5)*w*.25, y + t*.7, (r()-.5)*w*.25], r:[0, r()*6, 0]}));
    y += t*1.5;
  }
  for (let i = 0; i < 4; i++){ const a = r()*6.28, s = .4 + r()*.3; gs.push(piece(pebbleGeo(s*1.2, s*.7, s, S+20+i), {c:'#9b958c', p:[Math.cos(a)*3.2, s*.3, Math.sin(a)*3.2]})); }
  const b = new T.Group(); b.name = 'Body'; b.add(mesh(merge(gs), vcMat(false), 'Stones')); g.add(b);
});

/* ───────── ракушки и морские звёзды ───────── */
function starfishGeo(R, rin){
  const s = new T.Shape();
  for (let i = 0; i < 10; i++){ const a = i*Math.PI/5 + Math.PI/2, rr = i%2 ? rin : R; i ? s.lineTo(Math.cos(a)*rr, Math.sin(a)*rr) : s.moveTo(Math.cos(a)*rr, Math.sin(a)*rr); }
  const g = new T.ExtrudeGeometry(s, {depth:.4, bevelEnabled:true, bevelThickness:.3, bevelSize:.3, bevelSegments:2}); g.rotateX(-Math.PI/2);
  displace(g, (x,y,z) => [x, y > .2 ? y + .5*(1 - Math.min(1, Math.hypot(x,z)/R)) : y, z]);
  return nonIdx(g);
}
add('starfish', 'Морские звёзды', (g, r, S) => {
  const gs = [], defs = [['#e8863a',0,0,2.4,.9,0],['#d9503a',4.8,2.2,1.6,.6,1],['#f0b070',-3.6,3.8,1.1,.45,2]];
  defs.forEach(d => {
    gs.push(piece(starfishGeo(d[3], d[4]), {c:d[0], p:[d[1],0,d[2]], r:[0, r()*6, 0]}));
    const dc = new T.Color(d[0]).offsetHSL(0,0,.2);
    for (let a = 0; a < 5; a++) for (let k = 1; k <= 2; k++){ const an = a*Math.PI*2/5 + Math.PI/2 + 0, rr = d[3]*(.3 + k*.28); gs.push(piece(new T.IcosahedronGeometry(d[3]*.07,0), {c:dc, p:[d[1] + Math.cos(an)*rr, .75*(1 - rr/d[3]) + .4 + d[3]*.08, d[2] - Math.sin(an)*rr]})); }
  });
  const b = new T.Group(); b.name = 'Body'; b.add(mesh(merge(gs), vcMat(false), 'Starfish')); g.add(b);
});
function scallopGeo(R, ribs = 7){
  const rows = 4, cols = ribs*2 + 1, span = 1.1, pos = [], ix = [];
  for (let k = 0; k <= rows; k++) for (let j = 0; j < cols; j++){
    const f = k/rows, a = lerp(-span, span, j/(cols-1)), rib = j%2, rr = R*f*(k === rows ? 1 + .05*rib : 1);
    pos.push(Math.sin(a)*rr, R*.32*Math.sin(Math.PI*f)*(1 - Math.abs(a)/span*.45) + rib*R*.05*f, -Math.cos(a)*rr + R*.1);
  }
  for (let k = 0; k < rows; k++) for (let j = 0; j < cols-1; j++){ const a = k*cols + j, b = a+1, c = a+cols, d = c+1; ix.push(a,c,b, b,c,d); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos,3)); g.setIndex(ix); g.computeVertexNormals(); return nonIdx(g);
}
add('shell_scallop', 'Ракушки-гребешки', (g, r, S) => {
  const gs = [], defs = [['#f2d3b0','#e9a58f',0,0,2.6,0],['#f6e2c6','#eeb8a0',3.6,1.8,1.9,2.2],['#efc9a0','#e29a80',-3.2,2.8,1.3,4]];
  defs.forEach(d => {
    const sg = scallopGeo(d[4]); paint(sg, (cx,cy,cz,nx,ny) => new T.Color(Math.floor((Math.atan2(cx, -cz) + 1.2)/.33) & 1 ? d[0] : d[1]).offsetHSL(0,0,(r()-.5)*.03));
    gs.push(piece(sg, {p:[d[2],0,d[3]], r:[0, d[5], 0]}));
  });
  const b = new T.Group(); b.name = 'Body'; b.add(mesh(merge(gs), vcMat(true), 'Shells')); g.add(b);
});
add('shell_conch', 'Раковины-улитки', (g, r, S) => {
  const prof = []; for (let i = 0; i <= 12; i++){ const t = i/12; prof.push(new T.Vector2(Math.max(.05, 1.9*Math.pow(1 - t, .75)*Math.sin(Math.PI*Math.min(1, .15 + t*.9))*(1 + .12*Math.sin(t*26))), t*5.2)); }
  const whelk = new T.LatheGeometry(prof, 9); whelk.rotateY(.3);
  const gs = [piece(whelk, {c:'#f0d9b8', p:[0,1.6,0], r:[0,0,1.25]})];
  const lip = piece(new T.IcosahedronGeometry(1,1), {c:'#f3a89a', p:[-.9,1.3,1.4], r:[0,.5,0], s:[1.3,.55,1.0]}); gs.push(lip);
  for (let k = 0; k < 5; k++){ const rr = 1.1*Math.pow(.78, k), a = k*1.5; gs.push(piece(new T.IcosahedronGeometry(rr,1), {c:k%2 ? '#d9b98c' : '#e8cfa4', p:[5 + Math.cos(a)*.3*k, rr*.8 + k*.55 + (k?0:0), 3 + Math.sin(a)*.3*k], s:[1,.9,1]})); }
  gs.push(piece(new T.IcosahedronGeometry(.8,1), {c:'#e6d29a', p:[-4.2,.5,-2.4], s:[1.3,.7,1]}));
  const b = new T.Group(); b.name = 'Body'; b.add(mesh(merge(gs), vcMat(false), 'Shells')); g.add(b);
});

/* ───────── коралловые рифы ───────── */
function branchList(list, r, o, dir, len, rad, depth, col){
  const end = o.clone().addScaledVector(dir, len), mid = o.clone().add(end).multiplyScalar(.5);
  const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0), dir);
  list.push(piece(new T.CylinderGeometry(rad*.7, rad, len, 5, 1, true), {c:col, p:[mid.x,mid.y,mid.z], q}));
  if (depth > 0){
    const n = 2 + (r() < .4 ? 1 : 0);
    for (let k = 0; k < n; k++){ const d2 = dir.clone().add(new T.Vector3((r()-.5)*1.3, .35 + r()*.2, (r()-.5)*1.3)).normalize(); branchList(list, r, end, d2, len*.72, rad*.7, depth-1, col); }
  } else list.push(piece(new T.IcosahedronGeometry(rad*1.2, 0), {c:new T.Color(col).offsetHSL(0,0,.12), p:[end.x,end.y,end.z]}));
}
add('reef_coral', 'Коралловый риф', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  const base = new T.Color('#5f7078');
  const rocks = [[0,0,5.2,3],[6,2,3.4,2.2],[-5,3,3,2],[2,-5,3.4,2]].map((d,i) => paint(piece(rockGeo({sx:d[2], sy:d[3], sz:d[2]*.9, amp:.3, detail:1, seed:S+i}), {p:[d[0],0,d[1]]}), (cx,cy,cz,nx,ny) => (cy < 1.2 ? new T.Color('#4f8a5a') : base).clone().offsetHSL(0,0,ny*.04+(r()-.5)*.04)));
  b.add(mesh(merge(rocks), vcMat(false), 'Rocks'));
  const corals = [], cols = ['#e8738a','#f2994a','#a76bc4'], spots = [[-1,2.4,0],[5.5,3.4,1],[-5.5,2.4,2],[2.5,-3,0]];
  spots.forEach((s, i) => {
    const list = []; branchList(list, r, new T.Vector3(0,0,0), new T.Vector3((r()-.5)*.3, 1, (r()-.5)*.3).normalize(), 2.2, .45, 2, cols[s[2]]);
    const c = mesh(merge(list), vcMat(false), 'Coral' + (i+1)); c.position.set(s[0], s[1], s[0]*0 + (i%2 ? 2 : -1) + s[0]*.2); b.add(c); corals.push(c);
  });
  const brain = mesh(paint(rockGeo({sx:1.8, sy:1.2, sz:1.8, amp:.18, detail:2, cut:.2, seed:S+7}), (cx,cy,cz) => new T.Color('#e5b36a').offsetHSL(0,0,(vn(cx*3,cy*3,cz*3,1)-.5)*.2)), vcMat(false), 'BrainCoral'); brain.position.set(-1.5, 2.8, 4); b.add(brain);
  const fan = mesh(paint(new T.CircleGeometry(1.8, 8, 0, Math.PI), () => new T.Color('#d9536f')), vcMat(true), 'FanCoral'); fan.position.set(7, 3.2, -1); fan.rotation.y = .6; b.add(fan);
  g.add(b);
  g.userData.animate = t => { corals.forEach((c, i) => { c.rotation.z = .06*Math.sin(t*1.3 + i*1.9); c.rotation.x = .05*Math.sin(t*1.1 + i); }); fan.rotation.x = .08*Math.sin(t*1.2); };
});
add('reef_rocks', 'Камни в воде', (g, r, S) => {
  const b = new T.Group(); b.name = 'Body';
  const base = new T.Color('#6f7a80'), alg = new T.Color('#4f8a5a');
  const defs = [[0,0,4,3.6],[5.5,2,2.8,2.4],[-5,2.5,2.4,3],[2,-5.5,2.2,1.8],[-3,-4.5,1.6,1.3],[9,-2,1.4,1]];
  const gs = defs.map((d,i) => paint(piece(rockGeo({sx:d[2], sy:d[3], sz:d[2]*.9, amp:.3, detail:1, cut:.35, seed:S+i}), {p:[d[0],0,d[1]]}), (cx,cy,cz,nx,ny) => (cy < 1.1 ? alg : base).clone().offsetHSL(0,0,ny*.05+(r()-.5)*.05)));
  b.add(mesh(merge(gs), vcMat(false), 'Rocks'));
  const sh = new T.Mesh(new T.CircleGeometry(15, 24), new T.MeshBasicMaterial({color:0x7fd6d6, transparent:true, opacity:.4, depthWrite:false})); sh.rotation.x = -Math.PI/2; sh.position.y = .05; sh.name = 'Shallows'; sh.userData.nobox = true; b.add(sh);
  const foams = defs.slice(0, 4).map((d, i) => { const f = foamRing(d[2]*.9, d[2]*1.5); f.position.set(d[0], .15, d[1]); b.add(f); return f; });
  foamAnim(g, foams);
  g.add(b);
});

/* ───────── финализация ───────── */
function bbox(g){
  const b = new T.Box3(), v = new T.Vector3(); g.updateMatrixWorld(true);
  const walk = o => { if (o.userData.nobox) return; if (o.isMesh){ const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld); b.expandByPoint(v); } } o.children.forEach(walk); };
  walk(g); return b;
}
function finish(g){
  const b = bbox(g), off = new T.Vector3(-(b.min.x+b.max.x)/2, -b.min.y, -(b.min.z+b.max.z)/2);
  g.children.forEach(c => c.position.add(off)); g.updateMatrixWorld(true); return g;
}
/** Замер: размеры без анимируемых эффектов (дым, пена) и число треугольников. */
export function measure(g){
  const b = bbox(g), s = b.getSize(new T.Vector3()); let tris = 0;
  g.traverse(o => { if (o.isMesh){ const p = o.geometry; tris += (p.index ? p.index.count : p.attributes.position.count)/3; } });
  return {w:s.x, h:s.y, d:s.z, minY:b.min.y, tris:Math.round(tris)};
}
function add(id, name, fn){
  MODELS.push({id, name, group:'rocks', make(THREE, seed = 0){
    T = THREE; matCache.clear();
    const S = (seed*31 + strHash(id)) % 1000, r = rng(seed*7919 + strHash(id));
    const g = new T.Group(); g.name = id; fn(g, r, S);
    g.traverse(o => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
    return finish(g);
  }});
}
