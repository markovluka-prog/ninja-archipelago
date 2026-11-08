// Группа «city»: общественные и городские объекты. Процедурные модели (Three.js r160).
// Масштаб: 1 ед. = 1 «метр», персонаж ≈ 6.5 ед. Низ модели на y=0, вход смотрит в +z.
// Каждая модель: make(THREE, seed=0, opts={doorOpen:true}) -> THREE.Group; у анимированных — userData.animate(t).

let T = null, MC = new Map();
const TAU = Math.PI * 2, FL = 0.4;   // FL — высота пола внутри зданий
export const MODELS = [];

const K = {
  stone:0x9b958c, stoneD:0x7d7870, stoneL:0xb8b2a6, wood:0x9a6a3e, woodL:0xb98550, woodD:0x6b4527,
  roof:0xa8412e, roofD:0x7e2f22, sand:0xe6d29a, grass:0x6ea848, blue:0x2f9ec4, white:0xf1ead8, cream:0xe9dcb8,
  gold:0xe3b341, glass:0x7fb8d0, red:0xc04a38, green:0x3a8f6a, dark:0x3a332c, soil:0x6b4a32, hay:0xe0b94e,
  iron:0x55575c, water:0x4fb6d8
};
const hexMul = (c,k) => { const f=v=>Math.max(0,Math.min(255,(v*k)|0)); return (f((c>>16)&255)<<16)|(f((c>>8)&255)<<8)|f(c&255); };
const rng = s => { let a=(Math.imul((s|0)+1,2654435761)+12345)>>>0; return ()=>{ a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; };
const vary = (r,c,a=0.08) => hexMul(c, 1+(r()*2-1)*a);

function M(c,o={}) {
  const k=[c,o.fs===false?0:1,o.e||0,o.o??1,o.ds?1:0,o.bs?1:0,o.r??.85,o.m||0].join('|');
  let m=MC.get(k);
  if(!m){ m=new T.MeshStandardMaterial({color:c,roughness:o.r??.85,metalness:o.m||0,flatShading:o.fs!==false,
    emissive:o.e||0,side:o.bs?T.BackSide:(o.ds?T.DoubleSide:T.FrontSide),transparent:(o.o??1)<1,opacity:o.o??1}); MC.set(k,m); }
  return m;
}
function mesh(p,geo,c,x=0,y=0,z=0,o={}) {
  const m=new T.Mesh(geo,(c&&c.isMaterial)?c:M(c,o)); m.position.set(x,y,z);
  m.castShadow=o.cs!==false&&(o.o===undefined||o.o>=1); m.receiveShadow=true; if(p)p.add(m); return m;
}
const grp = (p,name,x=0,y=0,z=0) => { const g=new T.Group(); g.name=name; g.position.set(x,y,z); if(p)p.add(g); return g; };
const bx = (p,w,h,d,x,y,z,c,o) => mesh(p,new T.BoxGeometry(w,h,d),c,x,y+h/2,z,o);                  // y = низ
const cy = (p,rt,rb,h,x,y,z,c,seg=12,o) => mesh(p,new T.CylinderGeometry(rt,rb,h,seg),c,x,y+h/2,z,o);  // y = низ
const cn = (p,r,h,x,y,z,c,seg=12,o) => mesh(p,new T.ConeGeometry(r,h,seg),c,x,y+h/2,z,o);
const sp = (p,r,x,y,z,c,o,ws=10,hs=8) => mesh(p,new T.SphereGeometry(r,ws,hs),c,x,y,z,o);
function onAnim(g,fn){ const p=g.userData.animate; g.userData.animate = p ? (t)=>{p(t);fn(t);} : fn; }

// призма-крыша, конёк вдоль z; ov — свес
function gable(p,w,h,d,x,y,z,c,ov=1,name){
  const s=new T.Shape(); s.moveTo(-w/2-ov,0); s.lineTo(w/2+ov,0); s.lineTo(0,h); s.closePath();
  const geo=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false}); geo.translate(0,0,-d/2);
  const m=mesh(p,geo,c,x,y,z); if(name)m.name=name; return m;
}
// четырёхскатная (пирамидальная) крыша
function hip(p,w,d,h,x,y,z,c){
  const geo=new T.ConeGeometry(Math.SQRT1_2,1,4); geo.rotateY(Math.PI/4); geo.translate(0,.5,0);
  const m=mesh(p,geo,c,x,y,z); m.scale.set(w,h,d); return m;
}
function lathe(p,pts,x,y,z,c,seg=14,o={}){
  const geo=new T.LatheGeometry(pts.map(q=>new T.Vector2(q[0],q[1])),seg);
  return mesh(p,geo,c,x,y,z,Object.assign({ds:true,fs:false},o));
}
function onion(p,R,H,x,y,z,c){
  const P=[[.5,0],[.82,.08],[1,.26],[.9,.44],[.55,.64],[.2,.84],[0,1]].map(q=>[q[0]*R,q[1]*H]);
  return lathe(p,P,x,y,z,c,12,{m:.3,r:.5});
}
function bowl(p,R,H,x,y,z,c){
  const P=[[.01,0],[.3,.18],[.78,.6],[1,1],[.9,1],[.7,.72],[.01,.58]].map(q=>[q[0]*R,q[1]*H]);
  return lathe(p,P,x,y,z,c,20);
}
function water(p,r,x,y,z,seg=24){
  const m=cy(p,r,r,.2,x,y,z,M(K.water,{e:0x0b3a52,o:.88,r:.25,fs:false}),seg,{cs:false}); m.name='Water'; return m;
}
// брызги/капли: возвращает функцию обновления
function spray(p,x,y,z,o){
  const n=o.n||12, geo=new T.OctahedronGeometry(o.s||.35,0), mat=M(0xcdeeff,{e:0x335a70,o:.85});
  const gg=grp(p,'Spray',x,y,z), ds=[];
  for(let i=0;i<n;i++){ const m=new T.Mesh(geo,mat); gg.add(m); ds.push(m); }
  const v=o.v||.6, h=o.h||6, R=o.r||1, dir=o.dir, fall=o.fall;
  return t=>{ for(let i=0;i<n;i++){ const ph=(t*v+i/n)%1, a=dir!==undefined?dir+Math.sin(i*5.1)*.12:i*2.399;
      if(fall){ ds[i].position.set(Math.cos(a)*(R+ph*(o.out||0)),h*(1-ph*ph),Math.sin(a)*(R+ph*(o.out||0))); }
      else ds[i].position.set(Math.cos(a)*R*ph,h*4*ph*(1-ph),Math.sin(a)*R*ph); } };
}
function flag(p,x,y,z,len,w,h,c,ph=0){
  const g=grp(p,'Flag',x,y,z); cy(g,.18,.22,len,0,0,0,K.woodD,6);
  const cl=grp(g,'Cloth',0,len-h-.4,0); const f=bx(cl,w,h,.12,w/2,0,0,c,{ds:true}); f.castShadow=false;
  g.userData.cloth=cl; g.userData.ph=ph; return g;
}
const flagAnim = (root,flags) => onAnim(root,t=>{ for(const f of flags){ f.userData.cloth.rotation.y=Math.sin(t*3+f.userData.ph)*.28; f.userData.cloth.rotation.z=Math.sin(t*2.2+f.userData.ph)*.05; } });

// дверной проём + стены. door={w,h,x}. Стены пустотелые, пол — отдельный mesh 'Floor'.
function room(p,w,d,h,t,wc,fc,door,o={}){
  const g=grp(p,o.name||'Walls'), hx=w/2, hz=d/2;
  if(fc!=null){ const f=bx(g,w-.1,FL,d-.1,0,0,0,fc); f.name='Floor'; }
  bx(g,t,h,d,-hx+t/2,0,0,wc); bx(g,t,h,d,hx-t/2,0,0,wc);
  const mid=w-2*t;
  const wall=(z,gap)=>{
    if(!gap){ bx(g,mid,h,t,0,0,z,wc); return; }
    const dl=gap.x-gap.w/2, dr=gap.x+gap.w/2, L=-mid/2, R=mid/2;
    if(dl>L+.01) bx(g,dl-L,h,t,(L+dl)/2,0,z,wc);
    if(R>dr+.01) bx(g,R-dr,h,t,(R+dr)/2,0,z,wc);
    if(h>gap.h+.01) bx(g,gap.w,h-gap.h,t,gap.x,gap.h,z,wc);
  };
  wall(hz-t/2,door===undefined?null:door);
  if(!o.skipBack) wall(-hz+t/2,o.back?door:null);
  return g;
}
function doorLeaf(p,w,h,x,z,c,open,name='Door'){
  const g=grp(p,name,x-w/2,0,z); bx(g,w-.1,h-.1,.35,(w-.1)/2,.05,0,c);
  bx(g,.18,h-.4,.45,(w-.1)/2,.2,0,K.woodD); bx(g,w-.3,.2,.45,(w-.1)/2,h*.35,0,K.woodD); bx(g,w-.3,.2,.45,(w-.1)/2,h*.75,0,K.woodD);
  sp(g,.22,w-.7,h*.5,.3,K.gold,{},6,5);
  g.rotation.y=open?-1.75:0; return g;
}
// окно: ось 'x' — стена с нормалью по x (на боковых стенах), 'z' — на передней/задней
function win(p,x,y,z,ww,hh,axis='z',t=.8,c=K.glass){
  const g=grp(p,'Window',x,y,z);
  if(axis==='z'){ bx(g,ww,hh,t+.4,0,0,0,M(c,{e:0x1a3342,fs:false,r:.3})); bx(g,ww+.5,.3,t+.7,0,hh,0,K.white); bx(g,.25,hh,t+.7,0,0,0,K.white); bx(g,ww+.5,.3,t+.7,0,-.3,0,K.white); }
  else { bx(g,t+.4,hh,ww,0,0,0,M(c,{e:0x1a3342,fs:false,r:.3})); bx(g,t+.7,.3,ww+.5,0,hh,0,K.white); bx(g,t+.7,hh,.25,0,0,0,K.white); bx(g,t+.7,.3,ww+.5,0,-.3,0,K.white); }
  return g;
}
// круглая/коническая оболочка с толщиной (внешняя+внутренняя поверхность) и дверным проёмом
function tube(p,r0,r1,y0,H,t,c,seg=16,o={}){
  const g=grp(p,o.name||'Tube',0,y0,0), rr=f=>r0+(r1-r0)*f, fs=o.fs===true;
  const m0=M(c,{fs}), m1=M(c,{fs,bs:true});
  const part=(f0,f1,gap)=>{ const h=H*(f1-f0), ta=gap?gap/2:0, tl=TAU-(gap||0);
    const a=new T.Mesh(new T.CylinderGeometry(rr(f1),rr(f0),h,seg,1,true,ta,tl),m0);
    const b=new T.Mesh(new T.CylinderGeometry(rr(f1)-t,rr(f0)-t,h,seg,1,true,ta,tl),m1);
    a.position.y=b.position.y=H*f0+h/2; a.castShadow=true; a.receiveShadow=b.receiveShadow=true; g.add(a,b); };
  if(o.dw){ const f=Math.min(1,o.dh/H), gap=2*Math.asin(Math.min(.95,o.dw/2/(r0-t/2)));
    part(0,f,gap); if(f<1) part(f,1);
    for(const s of[-1,1]) bx(g,.6,o.dh,t+.3,s*(o.dw/2+.3),0,r0-t/2,c);
  } else part(0,1);
  const rim=new T.Mesh(new T.RingGeometry(rr(1)-t,rr(1),seg),M(c,{ds:true,fs:false})); rim.rotation.x=-Math.PI/2; rim.position.y=H; rim.receiveShadow=true; g.add(rim);
  if(o.floor!==false){ const f=cy(g,r0-t,r0-t,FL,0,0,0,o.fc||K.stoneL,seg); f.name='Floor'; }
  return g;
}
// зубцы по кругу
function merlonsRing(p,R,y,n,w,h,t,c){
  for(let i=0;i<n;i++){ const a=i/n*TAU, m=bx(p,w,h,t,Math.sin(a)*R,y,Math.cos(a)*R,c); m.rotation.y=a; }
}
// зубцы по прямой (шаг 3, ширина 1.5)
function merlonsLine(p,len,y,z,h,c,tz=1.2){
  const n=Math.round(len/3); for(let i=0;i<n;i++) bx(p,1.5,h,tz,-len/2+1.5+i*3,y,z,c);
}
function crate(p,x,y,z,s,c=K.woodL){ const m=bx(p,s,s,s,x,y,z,c); m.userData.solid=true; m.rotation.y=(x*7+z*3)%1; bx(p,s+.1,.18,s+.1,x,y+s*.5-.09,z,K.woodD); return m; }
function barrel(p,x,y,z,r=1.1,h=2.4,c=K.woodL){ cy(p,r,r*.9,h,x,y,z,c,10).userData.solid=true; cy(p,r*1.04,r*1.04,.2,x,y+h*.2,z,K.iron,10); cy(p,r*1.04,r*1.04,.2,x,y+h*.75,z,K.iron,10); }
function sack(p,x,y,z,c=K.cream){ const s=sp(p,.9,x,y+.8,z,c,{},7,6); s.scale.set(1,1.15,.9); return s; }
function table(p,x,y,z,w=5,d=3,h=2.8){ const g=grp(p,'Table',x,y,z); g.userData.solid=true; bx(g,w,.3,d,0,h-.3,0,K.woodL); for(const a of[-1,1])for(const b of[-1,1]) bx(g,.35,h-.3,.35,a*(w/2-.4),0,b*(d/2-.4),K.woodD); return g; }
function bench(p,x,y,z,w=5,rot=0){ const g=grp(p,'Bench',x,y,z); g.userData.solid=true; bx(g,w,.3,1.2,0,1.3,0,K.woodL); bx(g,.35,1.3,1,-w/2+.5,0,0,K.woodD); bx(g,.35,1.3,1,w/2-.5,0,0,K.woodD); g.rotation.y=rot; return g; }
function bed(p,x,y,z,rot=0,c=K.red){ const g=grp(p,'Bed',x,y,z); g.userData.solid=true; bx(g,3.2,1,6.4,0,0,0,K.woodD); bx(g,2.8,.7,5.6,0,1,.2,K.cream); bx(g,2.8,.5,2.6,0,1.2,1.8,c); bx(g,2.2,.4,1.2,0,1.7,-2.2,K.white); g.rotation.y=rot; return g; }

function winR(p,R,a,y,ww=.9,hh=2.6){ const w=win(p,Math.sin(a)*R,y,Math.cos(a)*R,ww,hh,'z',.8); w.rotation.y=a; return w; }
function def(id,name,fn){
  MODELS.push({id,name,group:'city',make(THREE,seed=0,opts={}){
    if(T!==THREE){ T=THREE; MC=new Map(); }
    const r=rng(seed), g=new T.Group(); g.name=id; fn(g,r,Object.assign({doorOpen:true},opts)); if(g.userData.animate)g.userData.animate(0); return g; }});
}

/* ───────────── ЦЕРКВИ ───────────── */
def('church_a','Часовня с колокольней',(g,r,op)=>{
  const wc=vary(r,K.cream), W=16,D=24,H=12,t=.6, b=grp(g,'Body',0,0,-4.5);
  room(b,W,D,H,t,wc,K.stoneL,{w:5.2,h:9.4,x:0});
  for(const s of[-1,1])for(const z of[-7,0,7]) win(b,s*W/2,4,z,2,5,'x');
  const rf=grp(g,'Roof',0,0,-4.5); gable(rf,W,7,D+1,0,H,0,vary(r,K.roof),1);
  const zc=D/2+4.5-.6, tw=grp(b,'Tower',0,0,zc);
  room(tw,9,9,16,.6,K.stoneL,K.stone,{w:5.2,h:9.4,x:0},{back:true});
  doorLeaf(tw,5.2,9.4,0,4.5-.3,K.woodD,op.doorOpen);
  bx(tw,9.4,.6,9.4,0,16,0,K.stoneD);
  for(const a of[-1,1])for(const c of[-1,1]) bx(tw,.8,6,.8,a*4,16.6,c*4,K.stone);
  const bell=cy(tw,.2,1.3,2,0,18.6,0,K.gold,8,{m:.4}); bell.name='Bell';
  const sr=grp(g,'SpireRoof',0,0,-4.5+zc); hip(sr,10,10,13,0,22.6,0,K.roofD);
  bx(sr,.4,3,.4,0,35.4,0,K.gold); bx(sr,2,.4,.4,0,37,0,K.gold);
  sr.position.z=zc; rf.add(sr);   // rf уже сдвинут на -4.5 по z, поэтому внутри него шпиль стоит ровно над башней (раньше сдвигался дважды — купол «съезжал»)
  for(let i=0;i<4;i++){ bench(b,-3.6,FL,-8+i*3.6,5.2,Math.PI/2); bench(b,3.6,FL,-8+i*3.6,5.2,Math.PI/2); }
  bx(b,3,.1,18,0,FL,0,K.red); bx(b,5,2.4,1.8,0,FL,-10.4,K.stoneL); bx(b,5.4,.3,2.2,0,FL+2.4,-10.4,K.white);
});

def('church_b','Собор с куполом',(g,r,op)=>{
  const W=20,D=22,H=12,t=.7, wc=vary(r,K.white);
  room(g,W,D,H,t,wc,K.stoneL,{w:6,h:10,x:0});
  doorLeaf(g,6,10,0,D/2-t/2,K.woodD,op.doorOpen);
  // портик
  for(const s of[-1,1]) for(const q of[-.3,.3]) cy(g,.8,.8,10,s*(2.3+q*0+ (q>0?4:0)),0,D/2+3,K.stoneL,10);
  bx(g,16,.8,4.6,0,10,D/2+1.9,K.stoneL);
  gable(g,14,3,4.6,0,10.8,D/2+1.9,K.stoneL,1);
  // апсида
  const ap=mesh(g,new T.CylinderGeometry(7,7,H-1,12,1,false,Math.PI,Math.PI),wc,0,(H-1)/2,-D/2+.5); ap.rotation.y=0; 
  const apr=mesh(g,new T.ConeGeometry(7,3,12,1,false,Math.PI,Math.PI),K.roofD,0,H-1+1.5,-D/2+.5);
  for(const s of[-1,1])for(const z of[-6,0,6]) win(g,s*W/2,4,z,2.2,5,'x');
  const rf=grp(g,'Roof'); bx(rf,W+1,.8,D+1,0,H,0,K.roofD);
  cy(rf,6,6.2,4.5,0,H+.8,0,wc,16);
  const dm=mesh(rf,new T.SphereGeometry(6.4,18,8,0,TAU,0,Math.PI/2),M(K.green,{fs:false,m:.2}),0,H+5.3,0);
  cy(rf,.9,1.3,2.4,0,H+11.6,0,K.gold,8); bx(rf,.4,3.4,.4,0,H+14,0,K.gold); bx(rf,2,.4,.4,0,H+15.4,0,K.gold);
  for(const s of[-1,1])for(const z of[-1,1]){ cy(rf,1.6,1.6,3,s*8.8,H+.8,z*9.5,wc,8); sp(rf,1.7,s*8.8,H+3.8,z*9.5,K.green,{},8,5); }
  for(let i=0;i<4;i++){ bench(g,-5,FL,-6+i*3.8,6,Math.PI/2); bench(g,5,FL,-6+i*3.8,6,Math.PI/2); }
  bx(g,6,2.4,2,0,FL,-8,K.stoneL);
});

def('church_c','Храм с луковичными куполами',(g,r,op)=>{
  const S=18,H=11,t=.7, wc=vary(r,K.cream);
  room(g,S,S,H,t,wc,K.stoneL,{w:5.2,h:9.4,x:0});
  doorLeaf(g,5.2,9.4,0,S/2-t/2,K.woodD,op.doorOpen);
  // крыльцо
  for(const s of[-1,1]) bx(g,.8,10,.8,s*3.6,0,S/2+3.2,K.woodL);
  bx(g,9.4,.6,4.4,0,10,S/2+2.2,K.red); hip(g,10,5.2,3,0,10.6,S/2+2.2,K.roofD);
  bx(g,10,.5,4,0,0,S/2+2.2,K.stone);
  for(const s of[-1,1])for(const z of[-5,0,5]) win(g,s*S/2,4.5,z,1.8,4.5,'x');
  for(const z of[-5,5]) win(g,z,4.5,-S/2,1.8,4.5,'z');
  const rf=grp(g,'Roof'); bx(rf,S+1,.7,S+1,0,H,0,K.roofD);
  hip(rf,S+1,S+1,2.5,0,H+.7,0,K.roofD);
  const dc=K.green;
  cy(rf,3.4,3.4,6.8,0,H+.7,0,wc,12); onion(rf,4.4,7.5,0,H+7.5,0,dc);      // барабан стоит на крыше (раньше начинался на 1.8 выше крыши и висел)
  cy(rf,.15,.15,3,0,H+15,0,K.gold,5); bx(rf,1.6,.25,.25,0,H+17,0,K.gold);
  for(const s of[-1,1])for(const z of[-1,1]){ cy(rf,1.2,1.2,4.3,s*7,H+.7,z*7,wc,8); onion(rf,2.1,3.6,s*7,H+5,z*7,dc); cy(rf,.1,.1,1.6,s*7,H+8.6,z*7,K.gold,4); }
  for(let i=0;i<3;i++){ bx(g,2,2.2,2,-6.6,FL,-5+i*4,K.woodD); bx(g,2,2.2,2,6.6,FL,-5+i*4,K.woodD); }
  bx(g,6,2.2,2,0,FL,-7,K.stoneL);
});

/* ───────────── МЕЛЬНИЦЫ ───────────── */
def('windmill','Ветряная мельница',(g,r,op)=>{
  const R0=9,R1=7,H=21, c=vary(r,K.cream);
  bx(g,2.2,.01,.01,0,0,0,K.cream).visible=false;
  const body=tube(g,R0,R1,0,H,.6,c,8,{dw:5,dh:9,name:'Body',fs:true});
  doorLeaf(g,5,9,0,R0-.3-.2,K.woodD,op.doorOpen);
  cy(g,R0+.6,R0+.6,2.4,0,0,0,K.stone,8,{fs:true}).name='Base';
  const roof=grp(g,'Roof'); cn(roof,R1+1.2,8,0,H,0,vary(r,K.roof),8,{fs:true});
  // лопасти
  const hubZ=R1+2.2, hubY=H+1.5, blades=grp(g,'Blades',0,hubY,hubZ);
  cy(roof,.9,.9,4,0,hubY-2,hubZ-1.5,K.woodD,8).rotation.x=Math.PI/2;
  sp(blades,1.4,0,0,.5,K.woodD,{},8,6);
  for(let i=0;i<4;i++){ const a=grp(blades,'Blade',0,0,0); a.rotation.z=i*Math.PI/2;
    bx(a,.8,19,.5,0,.8,0,K.woodD); bx(a,3.6,.25,.2,1.9,5,.3,K.woodL).scale.y=1;
    const sail=bx(a,3.8,11,.2,2.1,5.5,.35,K.white,{ds:true}); sail.castShadow=false;
    for(let j=0;j<4;j++) bx(a,3.9,.18,.3,2.1,6+j*2.8,.4,K.woodL); }
  onAnim(g,t=>{ blades.rotation.z=-t*.6; });
  // интерьер
  cy(g,2.4,2.4,1.2,0,FL,-2,K.stoneD,12); cy(g,2.1,2.1,.5,0,FL+1.2,-2,K.stone,12);
  for(let i=0;i<4;i++) sack(g,-5+i*.5,FL,3-i*1.6);
  barrel(g,5,FL,-3);
  { const ST=grp(g,'Stairs'); for(let i=0;i<15;i++){ const a=Math.PI/2+i*.4, y=FL+i*.75, rin=R0+(R1-R0)*y/H-.6, rc=rin-2.9; bx(ST,3.4,.35,2.8,Math.sin(a)*rc,y,Math.cos(a)*rc,K.woodL).rotation.y=a; } }      // винтовая лестница по стене до высоты ≈ 11
  table(g,3,FL,2,4.4,2.6); crate(g,-4,FL,4.6,2.2); barrel(g,5.6,FL,-5,1,2.2); sack(g,-3,FL,-5.2);
});

def('watermill','Водяная мельница',(g,r,op)=>{
  const W=14,D=14,H=10.8,t=.6, wc=vary(r,K.cream);
  const b=grp(g,'Body',4,0,0);
  room(b,W,D,H,t,wc,K.woodL,{w:4.6,h:8.6,x:0});
  doorLeaf(b,4.6,8.6,0,D/2-t/2,K.woodD,op.doorOpen);
  for(const z of[-3,3]) win(b,W/2,5,z,2,2.6,'x'); win(b,0,5.5,-D/2,2.4,2.6,'z');
  // фахверк
  for(const x of[-W/2+.2,W/2-.2]) for(const z of[-D/2+.2,D/2-.2]) bx(b,.5,H,.5,x,0,z,K.woodD);
  gable(b,W,6,D+1,0,H,0,vary(r,K.roof),1.2,'Roof');
  const roof=b.getObjectByName('Roof');
  // колесо
  const wheel=grp(g,'Wheel',-4.2,5.6,0);
  const tor=mesh(wheel,new T.TorusGeometry(5.1,.35,5,20),K.woodD); tor.position.z=1.6; mesh(wheel,new T.TorusGeometry(5.1,.35,5,20),K.woodD,0,0,-1.6);
  for(let i=0;i<8;i++){ const a=grp(wheel,'Spoke'); a.rotation.z=i*Math.PI/8; bx(a,.5,10.2,.4,0,-5.1,1.6,K.woodD); bx(a,.5,10.2,.4,0,-5.1,-1.6,K.woodD); }
  for(let i=0;i<12;i++){ const a=grp(wheel,'Paddle'); a.rotation.z=i*TAU/12; bx(a,.4,1.3,3.8,0,5.1,0,K.woodL); }
  cy(wheel,.6,.6,4.4,0,0,-2.2,K.woodD,6).rotation.x=Math.PI/2;
  onAnim(g,t=>{ wheel.rotation.z=-t*.7; });
  // ручей и лоток
  const w=water(g,1,-10,0,0); w.scale.set(1,1,1); w.geometry=new T.BoxGeometry(11,.2,20); w.position.set(-8,.1,0);
  bx(g,6,.4,2,-2.5,0,0,K.stone).visible=false;
  bx(g,1,2,6,-10,0,0,K.woodD).visible=false;
  const fl=bx(g,10,.5,2.2,-2,8.8,-7.2,K.woodL); bx(g,.5,.8,2.2,-2,9.3,-7.2,K.woodD).visible=false;
  for(const x of[-6,2]) bx(g,.6,8.8,.6,x,0,-7.2,K.woodD);
  cy(b,2,2,1,-3,FL,-3,K.stoneD,10); cy(b,1.8,1.8,.5,-3,FL+1,-3,K.stone,10);
  for(let i=0;i<4;i++) sack(b,3+(i%2)*1.5,FL,-4+i*1.8);
  table(b,-3,FL,3,4,2.4);
});

/* ───────────── КОЛОДЦЫ ───────────── */
def('well_a','Колодец с воротом',(g,r)=>{
  tube(g,3.4,3.4,0,3.2,.8,vary(r,K.stone),12,{floor:false,name:'Ring'});
  cy(g,3.4,3.4,.5,0,0,0,K.stoneD,12);
  water(g,2.4,0,1.3,0,14);
  for(const s of[-1,1]) bx(g,.6,7.6,.6,s*3.2,3,0,K.woodD);
  const cr=cy(g,.35,.35,7.6,0,8.2,0,K.woodL,6); cr.rotation.z=Math.PI/2;
  const rf=grp(g,'Roof'); gable(rf,8,2.6,5,0,10.8,0,K.roof,.6); rf.rotation.y=0;
  cy(g,.45,.45,.5,4.2,8,0,K.woodD,6).rotation.z=Math.PI/2; bx(g,.3,1.8,.3,4.6,7.4,0,K.woodD);
  cy(g,.06,.06,5,0,3.5,0,K.dark,4).position.y=5.8;
  cy(g,.7,.55,1,0,3,0,K.woodL,8).position.y=3.4;
  bx(g,9,.01,.01,0,0,0,K.dark).visible=false;
});
def('well_b','Колодец-журавль',(g,r)=>{
  tube(g,3,3,0,2.4,.7,vary(r,K.stoneD),10,{floor:false,name:'Ring'});
  water(g,2.2,0,1,0,12);
  bx(g,.9,12,.9,-4,0,0,K.woodD); bx(g,.7,.7,2,-4,11.2,0,K.woodD);
  const sw=grp(g,'Sweep',-4,11.6,0);
  const beam=bx(sw,.6,.6,17,0,-.3,-0,K.woodL); beam.rotation.set(0,0,0); beam.position.set(0,0,0); beam.rotation.y=Math.PI/2; beam.position.x=3;
  bx(sw,1.6,1.6,1.6,-5,-2.2,0,K.stone);
  const rope=bx(sw,.12,6,.12,11,-6,0,K.dark); const bkt=cy(sw,.7,.55,1.2,11,-7.4,0,K.woodL,8);
  cy(g,.1,.1,.1,0,0,0,K.dark,3).visible=false;
  onAnim(g,t=>{ const a=Math.sin(t*.8)*.1; sw.rotation.z=a; rope.rotation.z=-a; bkt.rotation.z=-a; });
  for(let i=0;i<5;i++){ const a=i/5*TAU; bx(g,1.2,.5,2.2,Math.sin(a)*5.4,0,Math.cos(a)*5.4,K.stone).rotation.y=a; }
});
def('well_c','Колодец-беседка',(g,r)=>{
  tube(g,4.6,4.6,0,3.4,.9,vary(r,K.stoneL),8,{floor:false,fs:true,name:'Ring'});
  cy(g,5.6,5.6,.6,0,0,0,K.stone,8); water(g,3.6,0,1.6,0,12);
  for(let i=0;i<4;i++){ const a=i/4*TAU+Math.PI/4; cy(g,.45,.45,9,Math.sin(a)*4.3,.6,Math.cos(a)*4.3,K.woodD,6); }
  const rf=grp(g,'Roof'); cn(rf,7.2,4.5,0,10,0,K.roof,8,{fs:true}); cy(rf,.2,.2,2,0,13.8,0,K.gold,5);
  const bk=cy(g,.8,.7,1.3,0,6,0,K.woodL,8); bx(g,.1,4,.1,0,7.3,0,K.dark);
  onAnim(g,t=>{ bk.position.y=6.65+Math.sin(t)*.3; });
  bx(g,4,.01,4,0,0,0,K.stone).visible=false;
  for(let s=0;s<3;s++) bx(g,4-s*.3,.35,1,0,s*.2,6.2-s*.6,K.stone);
});

/* ───────────── ФОНТАНЫ ───────────── */
def('fountain_small','Фонтан малый',(g,r)=>{
  const c=vary(r,K.stoneL);
  tube(g,5,5,0,2,.8,c,14,{floor:false,name:'Basin'}); cy(g,5,5,.4,0,0,0,K.stoneD,14);
  const w=water(g,4.2,0,1.2,0,16);
  cy(g,.9,1.3,4,0,0,0,c,8); bowl(g,2.6,1.4,0,4,0,c);
  cy(g,.3,.3,1.2,0,5.2,0,c,6);
  const s1=spray(g,0,6.4,0,{n:10,h:2.8,r:.9,v:.8,s:.28});
  const s2=spray(g,0,1.3,0,{n:12,h:4,r:3.2,v:.6,s:.25});
  onAnim(g,t=>{ s1(t); s2(t); w.scale.set(1,1,1); });
});
def('fountain_big','Фонтан с тремя чашами',(g,r)=>{
  const c=vary(r,K.stoneL);
  tube(g,11,11,0,2.2,1,c,20,{floor:false,name:'Basin'}); cy(g,11,11,.4,0,0,0,K.stoneD,20);
  water(g,10,0,1.2,0,24);
  cy(g,1.6,2.4,4,0,0,0,c,10); bowl(g,6.4,2.2,0,3.6,0,c);
  cy(g,.9,1.3,3.4,0,5.4,0,c,8); bowl(g,4.2,1.8,0,8.4,0,c);
  cy(g,.7,.9,2.8,0,9.8,0,c,8); bowl(g,2.5,1.4,0,12.2,0,c);
  cy(g,.4,.4,1.4,0,13.4,0,c,6); sp(g,.8,0,15,0,K.gold,{m:.4},8,6);
  const anims=[spray(g,0,15.4,0,{n:12,h:3.5,r:1,v:.9,s:.3}),
    spray(g,0,5.8,0,{n:16,fall:true,h:3.2,R:6,r:6,out:1.2,v:.7,s:.25}),
    spray(g,0,9.6,0,{n:14,fall:true,h:3.2,R:4,r:4,out:1,v:.7,s:.25}),
    spray(g,0,13,0,{n:10,fall:true,h:3,R:2.4,r:2.4,out:.8,v:.7,s:.22})];
  // fall: R читается как o.r
  onAnim(g,t=>anims.forEach(f=>f(t)));
});
def('fountain_statue','Фонтан со статуей',(g,r)=>{
  const c=vary(r,K.stoneL);
  tube(g,8.5,8.5,0,2.2,.9,c,8,{floor:false,fs:true,name:'Basin'}); cy(g,8.5,8.5,.4,0,0,0,K.stoneD,8);
  water(g,7.6,0,1.2,0,16);
  const st=grp(g,'Statue');
  bx(st,4.6,1.2,4.6,0,0,0,c); bx(st,3.4,5,3.4,0,1.2,0,K.stone); bx(st,4,.7,4,0,6.2,0,c);
  const fig=grp(st,'Figure',0,6.9,0);
  cy(fig,1.2,1.5,4.6,0,0,0,K.white,8); sp(fig,1,0,5.6,0,K.white,{},8,6);
  const arm=bx(fig,.6,3,.6,1.6,3,0,K.white); arm.rotation.z=-.5; bx(fig,.3,3.4,.3,2.6,5.4,0,K.gold,{m:.4});
  const arm2=bx(fig,.6,2.4,.6,-1.5,2.4,0,K.white); arm2.rotation.z=.3;
  const sa=[];
  for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4; sa.push(spray(g,Math.sin(a)*2.6,3.2,Math.cos(a)*2.6,{n:10,h:2.2,r:4.2,dir:Math.PI/2-a,v:.7,s:.26})); sp(g,.5,Math.sin(a)*2.5,3.4,Math.cos(a)*2.5,K.gold,{m:.4},6,5); }
  onAnim(g,t=>sa.forEach(f=>f(t)));
});
def('fountain_plaza','Фонтан площадной',(g,r)=>{
  const c=vary(r,K.stoneL);
  cy(g,17,17,.5,0,0,0,K.sand,28); cy(g,15,15,.8,0,.5,0,K.stone,28,{cs:false});
  cy(g,12.5,12.5,1.1,0,1.3,0,K.stoneD,28,{cs:false});
  tube(g,10,10,1.3,2.4,1,c,24,{floor:false,name:'Basin'}); cy(g,10,10,.4,0,1.3,0,K.stoneD,24);
  const wt=water(g,9,0,2.6,0,28);
  cy(g,1.4,2,5,0,1.7,0,c,10); bowl(g,4,2,0,6.7,0,c); cy(g,.6,.6,3,0,8.5,0,c,6); sp(g,.9,0,12,0,K.gold,{m:.4},8,6);
  const an=[spray(g,0,12.6,0,{n:14,h:5,r:1.2,v:.8,s:.32}), spray(g,0,8.7,0,{n:12,fall:true,h:2.5,r:3.6,out:1,v:.7,s:.25})];
  for(let i=0;i<8;i++){ const a=i/8*TAU; sp(g,.45,Math.sin(a)*7.2,3,Math.cos(a)*7.2,K.gold,{m:.4},6,5);
    an.push(spray(g,Math.sin(a)*7.2,3,Math.cos(a)*7.2,{n:8,h:4,r:4.2,dir:Math.PI/2-a+Math.PI,v:.7,s:.24})); }
  const rip=[0,1,2].map(i=>{ const m=new T.Mesh(new T.RingGeometry(.9,1,28),M(0xffffff,{o:.5,ds:true,fs:false,e:0x445566})); m.rotation.x=-Math.PI/2; m.position.y=2.75; g.add(m); return m; });
  for(const a of[0,1,2,3]){ const ang=a*Math.PI/2+Math.PI/4; cy(g,.5,.6,7,Math.sin(ang)*13.6,1.3,Math.cos(ang)*13.6,K.iron,6); sp(g,.9,Math.sin(ang)*13.6,8.7,Math.cos(ang)*13.6,0xffe9a8,{e:0x886622},8,6); }
  onAnim(g,t=>{ an.forEach(f=>f(t)); rip.forEach((m,i)=>{ const ph=(t*.35+i/3)%1; m.scale.setScalar(1+ph*7.5); m.material=M(0xffffff,{o:.5,ds:true,fs:false,e:0x445566}); }); });
});

/* ───────────── РЫНОЧНЫЕ ЛАВКИ ───────────── */
function stallFrame(g,w,d,h,counterCol){
  bx(g,w+1,.3,d+1,0,0,0,K.woodD);
  for(const a of[-1,1]) bx(g,.7,h,.7,a*(w/2-.3),.3,-d/2+.5,K.woodD);
  for(const a of[-1,1]) bx(g,.7,h*.8,.7,a*(w/2-.3),.3,d/2-.5,K.woodD);
  bx(g,w-.6,2.6,2.2,0,.3,d/2-1.2,counterCol||K.woodL); bx(g,w-.4,.3,2.6,0,2.9,d/2-1.2,K.woodD);
  bx(g,w-.6,6,.4,0,.3,-d/2+.3,K.woodL);
}
function stripes(p,w,d,n,y,z,c1,c2,tilt){
  const a=grp(p,'Awning',0,y,z); a.rotation.x=tilt;
  for(let i=0;i<n;i++) bx(a,w/n,.3,d,-w/2+(i+.5)*w/n,0,0,i%2?c2:c1,{ds:true});
  return a;
}
function veg(p,x,y,z,c,n=6){ for(let i=0;i<n;i++) sp(p,.55,x+(i%3-1)*1.2,y+.5+(i>2?.8:0),z+((i>2)?.4:-.2),vary(()=>.5,c,.12),{},6,5); }
def('stall_veg','Лавка овощная',(g,r)=>{
  const w=11,d=8,h=10; stallFrame(g,w,d,h);
  stripes(g,w+1.4,d+2,6,h+.2,0,K.green,K.cream,.16);
  const gs=[K.red,0xe28a2c,K.green,0x8a5a9a];
  for(let i=0;i<4;i++){ bx(g,2.2,.8,1.8,-3.6+i*2.4,3.2,d/2-1.2,K.woodD); veg(g,-3.6+i*2.4,4,d/2-1.2,gs[i],4); }
  for(let i=0;i<3;i++){ crate(g,-3.5+i*3.5,.3,-1,2.2); veg(g,-3.5+i*3.5,2.6,-1,gs[(i+1)%4],3); }
  sack(g,4.4,.3,-1.5,K.hay);
});
def('stall_fish','Лавка рыбная',(g,r)=>{
  const w=11,d=8,h=10; stallFrame(g,w,d,h,0x9fb8c0);
  gable(g,w+1,2.6,d+1.5,0,h+.2,0,K.blue,.8);
  bx(g,w-.2,.3,.3,0,h-1.2,d/2-1,K.woodD);
  for(let i=0;i<5;i++){ const f=sp(g,.6,-4+i*2,h-3,d/2-1,0xb7c8cf,{},6,5); f.scale.set(.4,1.5,.8); bx(g,.1,2,.1,-4+i*2,h-2.2,d/2-1,K.dark); }
  for(let i=0;i<4;i++){ const f=sp(g,.7,-3.6+i*2.4,3.5,d/2-1.2,i%2?0xc9b27a:0x9db0b8,{},6,5); f.scale.set(1.8,.5,.8); cn(g,.5,.9,-3.6+i*2.4+1.5,3.1,d/2-1.2,K.stoneD,4).rotation.z=-Math.PI/2; }
  for(let i=0;i<2;i++){ barrel(g,-3+i*6,.3,-1.4,1.3,2.6,K.woodD); water(g,.9,-3+i*6,2.65,-1.4,8).material=M(K.water,{o:.8}); }
  bx(g,2.5,.8,1.8,3.8,.3,1,K.stoneL); 
});
def('stall_weapon','Лавка оружейная',(g,r)=>{
  const w=12,d=8,h=10; stallFrame(g,w,d,h,K.woodD);
  bx(g,w+1.4,.5,d+1.4,0,h+.2,0,K.roofD); bx(g,w+1,.5,d+1,0,h+.7,0,K.stoneD,{o:undefined});
  for(let i=0;i<5;i++){ const s=grp(g,'Sword',-4+i*2,4.2,d/2-1.2); bx(s,.35,4.2,.08,0,0,0,0xc6ccd2,{m:.6,r:.4}); bx(s,1.4,.25,.25,0,0,0,K.gold); bx(s,.3,1,.3,0,-1.2,0,K.woodD); s.rotation.z=(i-2)*.08; s.position.y=3.2; }
  for(let i=0;i<4;i++){ const sh=cy(g,1.5,1.5,.3,-4.5+i*3,5+(i%2)*.5,-d/2+.9,i%2?K.red:K.blue,10); sh.rotation.x=Math.PI/2; sp(g,.45,-4.5+i*3,5.15+(i%2)*.5,-d/2+1.1,K.gold,{m:.4},6,5); }
  for(let i=0;i<4;i++){ cy(g,.12,.12,8,5.2+(i-1.5)*.5,.3,-1.5+(i%2)*.5,K.woodL,5); cn(g,.3,1,5.2+(i-1.5)*.5,8.3,-1.5+(i%2)*.5,0xc6ccd2,5); }
  const hm=sp(g,1.1,-4.8,3.9,0,K.iron,{m:.5},8,6); hm.scale.y=.8;
});
def('stall_cloth','Лавка тканей',(g,r)=>{
  const w=11,d=8,h=10; stallFrame(g,w,d,h);
  const cols=[K.red,K.blue,K.gold,K.green,0x8a5a9a,K.cream];
  const tent=grp(g,'Awning'); cn(tent,Math.hypot(w,d)*.62,5.5,0,h+.2,0,K.cream,8,{ds:true});
  const t2=cn(tent,Math.hypot(w,d)*.6,5.4,0,h+.35,0,0xd9534f,8); t2.scale.set(1.001,1.001,1.001); t2.visible=false;
  for(let i=0;i<8;i++){ const a=i/8*TAU; if(i%2) bx(tent,2.8,1.2,.2,Math.sin(a)*(Math.hypot(w,d)*.6)*.35,h-1,Math.cos(a)*(Math.hypot(w,d)*.6)*.35,K.red).rotation.y=a; }
  for(let i=0;i<6;i++){ const b=cy(g,.7,.7,2.6,-4.5+i*1.8,3.2,d/2-1.2,cols[i],8); b.rotation.z=Math.PI/2; b.rotation.y=.5; }
  const dr=grp(g,'Drapes');
  for(let i=0;i<5;i++) bx(dr,1.6,5,.15,-4.4+i*2.2,3.6,-d/2+.8,cols[i],{ds:true});
  onAnim(g,t=>{ dr.children.forEach((c,i)=>{ c.rotation.x=Math.sin(t*1.5+i)*.04; }); });
});
def('stall_fruit','Лавка фруктовая',(g,r)=>{
  const w=11,d=8,h=10; stallFrame(g,w,d,h);
  bx(g,.6,6,.6,0,h,-d/2+.5,K.woodD).visible=false;
  const um=grp(g,'Awning'); cn(um,9,4.2,0,h+.2,0,K.red,10,{ds:true}); cy(um,.2,.2,2.5,0,h+4.2,0,K.gold,5);
  for(let i=0;i<10;i++){ const a=i/10*TAU; if(i%2) cn(um,.05,.05,0,0,0,K.red,3).visible=false; }
  const fc=[K.red,0xe28a2c,K.hay,K.green];
  for(let i=0;i<4;i++){ const bk=cy(g,1.3,1,1.4,-3.8+i*2.5,3.2,d/2-1.2,K.woodL,8);
    for(let j=0;j<5;j++) sp(g,.5,-3.8+i*2.5+Math.cos(j*1.26)*.6,4.8+(j==4?.4:0),d/2-1.2+Math.sin(j*1.26)*.6,fc[i],{},6,5); }
  for(let k=0;k<2;k++){ crate(g,-3+k*5,.3,-1,2.6); for(let j=0;j<6;j++) sp(g,.55,-3+k*5+(j%3-1)*.7,3.4+(j>2?.7:0),-1+(j>2?.2:-.2),fc[(j+k)%4],{},6,5); }
  for(let j=0;j<3;j++) sp(g,.5,4.8,.9+j*.9,-2.2,fc[1],{},6,5);
});

/* ───────────── БАШНИ ───────────── */
def('tower_watch','Сторожевая башня',(g,r,op)=>{
  const S=15,H=26,t=.7, FY=13, c=vary(r,K.stone);        // шире (было 12) и выше; этаж на высоте 13 — в обоих ярусах человек проходит с запасом
  room(g,S,S,H,t,c,K.stoneL,{w:4.8,h:8.8,x:0});
  doorLeaf(g,4.8,8.8,0,S/2-t/2,K.woodD,op.doorOpen);
  for(const y of[7,16,21]) { win(g,0,y,S/2,.8,2.6,'z'); win(g,S/2,y,0,.8,2.6,'x'); win(g,-S/2,y,0,.8,2.6,'x'); }
  // этаж: плита с проёмом над лестницей (западная полоса остаётся открытой); лестница — стопка ступеней вдоль западной стены
  const sx0=-S/2+t+4.2, sx1=S/2-.5, F2=grp(g,'Floor2'); bx(F2,sx1-sx0,.6,S-1.4,(sx0+sx1)/2,FY,0,K.woodD);
  const ST=grp(g,'Stairs'), nS=22, rS=(FY+.6-FL)/nS; for(let i=0;i<nS;i++) bx(ST,3.4,rS*(i+1),.45,-S/2+t+2.4,0,-S/2+t+1.6+i*.45,K.woodL);
  bx(g,1.6,.3,.3,0,0,0,K.woodD).visible=false;
  // мебель: нижний ярус — караульная (стол, лавки, койки, бочки, ящики), верхний — спальня и склад
  table(g,2,FL,-2,5,3); bench(g,2,FL,-.1,5);
  bed(g,S/2-2.2,FL,-S/2+4,0,K.blue);
  barrel(g,S/2-1.6,FL,1.6,1.1,2.4); crate(g,S/2-1.8,FL,S/2-1.8,2.2);
  const UP=FY+.6;
  bed(g,S/2-2.2,UP,-S/2+4,0,K.red);
  table(g,2,UP,1,5,3); crate(g,S/2-1.8,UP,S/2-1.8,2.2);
  const rf=grp(g,'Roof'); bx(rf,S+2.6,1,S+2.6,0,H,0,K.woodD);
  for(const a of[-1,1])for(const b of[-1,1]) bx(rf,.6,5,.6,a*(S/2+.8),H+1,b*(S/2+.8),K.woodL);
  for(let i=-2;i<=2;i++){ bx(rf,.3,2,.3,i*(S+1.4)/4,H+1,S/2+1.1,K.woodL); bx(rf,.3,2,.3,i*(S+1.4)/4,H+1,-S/2-1.1,K.woodL); bx(rf,.3,2,.3,S/2+1.1,H+1,i*(S+1.4)/4,K.woodL); bx(rf,.3,2,.3,-S/2-1.1,H+1,i*(S+1.4)/4,K.woodL); }
  hip(rf,S+4,S+4,6.5,0,H+6,0,vary(r,K.roof));
  const fl=flag(rf,0,H+12,0,5,3.2,2,K.red); flagAnim(g,[fl]);
  bx(g,S+1,1,S+1,0,0,0,K.stoneD).visible=false;
  const bell=cy(rf,.2,1,1.5,0,H+3.5,0,K.gold,8,{m:.4});
});
def('anchor_sign','Вывеска с якорем (порт)',(g,r)=>{      // якорь не стоит на берегу, а висит на вывеске: столб, консоль, цепи и доска с якорем
  cy(g,.4,.5,13,0,0,0,K.woodD,8); bx(g,6,.5,.5,3,12,0,K.woodD);
  for(const x of[1.2,4.8]) cy(g,.08,.08,2,x,10,0,K.iron,4);
  bx(g,5,3.8,.4,3,6.2,0,K.woodL); bx(g,5.4,.35,.55,3,10,0,K.woodD); bx(g,5.4,.35,.55,3,5.95,0,K.woodD).position.y=5.95;
  const A=grp(g,'Anchor',3,8.9,.3); A.scale.setScalar(.62); bx(A,.3,3.6,.25,0,-2.6,0,K.dark); bx(A,1.8,.3,.25,0,.4,0,K.dark);
  const ar=new T.Mesh(new T.TorusGeometry(1.0,.16,6,14,Math.PI),M(K.dark)); ar.rotation.z=Math.PI; ar.position.set(0,-1.7,0); ar.castShadow=true; A.add(ar);
  const rg=new T.Mesh(new T.TorusGeometry(.35,.09,6,10),M(K.dark)); rg.position.set(0,1.45,0); A.add(rg);
});
def('tower_gate','Башня-ворота',(g,r)=>{      // восстановлена упрощённо: две башни и надвратная часть с проездом
  const c=vary(r,K.stone), S=11, H=26, w=9;
  for(const q of[-1,1]){ const x=q*(S/2+w/2); bx(g,S,H,S,x,0,0,c); bx(g,S+1,1,S+1,x,H,0,K.stoneD); hip(g,S+3,S+3,6,x,H+1,0,vary(r,K.roof)); for(const y of[8,15,21]) bx(g,1,2.6,.3,x,y,S/2+.05,K.dark); }
  bx(g,w,H-14,S,0,14,0,c); for(const i of[-1,0,1]) bx(g,1.2,2.4,.3,i*2.6,H-8,S/2+.05,K.dark);
  bx(g,w,.8,S,0,0,0,K.stoneD).visible=false;
});
def('tower_round','Круглая башня',(g,r,op)=>{
  const R0=12,R1=11,H=26,t=.8, c=vary(r,K.stone);        // шире (было 9.5)
  tube(g,R0,R1,0,H,t,c,12,{dw:4.8,dh:8.8,name:'Body',fs:true});
  doorLeaf(g,4.8,8.8,0,R0-.35,K.woodD,op.doorOpen);
  tube(g,R0+.8,R0+.8,0,2,1.0,K.stoneD,12,{dw:4.8,dh:2,floor:false,name:'Plinth',fs:true});      // цоколь — кольцо с проёмом у двери (раньше сплошной диск перекрывал пол внутри)
  for(let i=0;i<3;i++) winR(g,R0-.5,Math.PI+(i-1)*1.2,14+i*3,.8,3);
  const rf=grp(g,'Roof'); cy(rf,R1+1.4,R1+1.4,1.2,0,H,0,K.stoneD,12,{fs:true});
  merlonsRing(rf,R1+1,H+1.2,16,2.2,2,1.2,c);
  cn(rf,R1-1,10,0,H+1.2,0,vary(r,K.roof),12,{fs:true});
  const fl=flag(rf,0,H+10.8,0,5,3,1.8,K.gold); flagAnim(g,[fl]);
  { const ST=grp(g,'Stairs'), n=19; for(let i=0;i<n;i++) { const a=i*.33; bx(ST,3.6,.35,3.0,Math.sin(a)*(R0-3.6),FL+i*.75,Math.cos(a)*(R0-3.6),K.woodL).rotation.y=a; } }      // винтовая лестница вдоль стены до высоты ≈ 14
  { const FLR=grp(g,'Floor2'); for(let a=6.25; a<7.3; a+=.3) bx(FLR,3.0,.35,5.0,Math.sin(a)*(R0-3.6),FL+18*.75,Math.cos(a)*(R0-3.6),K.woodL).rotation.y=a; }      // площадка на верху лестницы (раньше лестница обрывалась в воздухе, пола за ней не было); группа Floor2 — твёрдая для коллизии
  // мебель в центре (стены и ступени по краю свободны): стол со скамьями, койки, бочки, ящики, сундук, стеллаж
  table(g,0,FL,-2,5.5,3); bench(g,0,FL,.2,5.5);
  bed(g,-5.5,FL,-4.5,0,K.blue);
  barrel(g,4.6,FL,4.2,1.1,2.4); crate(g,6,FL,-3,2.2);
  crate(g,-3.8,FL,3.4,2.2); barrel(g,-.6,FL,5.4,1.1,2.4); crate(g,3.6,FL,-5.4,2);      // ещё мебели в центре: башня была пустой
});

const WL=12, WH=28, WT=4.4;      // высота 28 (было 12/18) и толщина 4.4 (было 3.2): стену нельзя перепрыгнуть
function wallStones(g,r,c){      // декоративная кладка на обеих гранях звена стены (восстановлена после случайного удаления)
  for(let i=0;i<16;i++){ const x=(r()-.5)*(WL-2), y=1.4+r()*(WH-3.8), s=1+r()*1.3; for(const q of[-1,1]) { const m=bx(g,s*1.5,s*.8,.12,x,y,q*(WT/2+.04),vary(r,K.stoneL)); m.castShadow=false; } }
}      // размеры звена стены (восстановлены после случайного удаления: длина 12 — как у плеча угловой стены, высота 12 — выше арки ворот, толщина 3.2)
def('wall_straight','Стена прямая',(g,r)=>{
  const c=vary(r,K.stone); bx(g,WL,WH,WT,0,0,0,c); bx(g,WL,1,WT+.6,0,WH-1,0,K.stoneD).visible=false;
  bx(g,WL,.8,WT+.5,0,0,0,K.stoneD);
  const rf=grp(g,'Walk'); merlonsLine(rf,WL,WH,WT/2-.6,2,c); merlonsLine(rf,WL,WH,-WT/2+.6,2,c);
  wallStones(g,r,c);
  for(let i=0;i<2;i++) bx(g,.7,1.8,.2,-3+i*6,18,WT/2+.05,K.dark);  // бойницы
});
def('wall_corner','Стена угловая',(g,r,op)=>{
  const c=vary(r,K.stone), S=9, TH=WH+8;
  // углы: плечи по -x и -z (длиной 6 от центра башни), наружные стороны +x/+z
  const room_=room(g,S,S,TH,.8,c,K.stoneL,{w:4.8,h:8.8,x:0});
  doorLeaf(g,4.8,8.8,0,S/2-.4,K.woodD,op.doorOpen);
  bx(g,6-S/2+.2,WH,WT,-(6+S/2)/2+.1,0,0,c); 
  const a2=bx(g,WT,WH,6-S/2+.2,0,0,-(6+S/2)/2+.1,c);
  const rf=grp(g,'Roof'); bx(rf,S+1.4,1,S+1.4,0,TH,0,K.stoneD);
  merlonsLine(rf,S+1,TH+1,S/2+.5,1.8,c,1); merlonsLine(rf,S+1,TH+1,-S/2-.5,1.8,c,1);
  for(const sx of[-1,1]) { const m=merlonsLine; }
  hip(rf,S-1,S-1,6,0,TH+1,0,vary(r,K.roof));
  merlonsLine(g,6-S/2+.2,WH,WT/2-.6,2,c); 
  const xw=-(6+S/2)/2+.1;
  for(const z of[-1.4,1.4]) for(let i=0;i<1;i++) bx(g,1.5,2,1.2,xw,WH,z,c);
  const zw=xw; for(const x of[-1.4,1.4]) bx(g,1.2,2,1.5,x,WH,zw,c);
  const fl=flag(rf,0,TH+7,0,4,3,1.8,K.red); flagAnim(g,[fl]);
  bx(g,S+.8,.8,S+.8,0,0,0,K.stoneD);
  win(g,0,13,S/2,.8,2.6,'z');
});
function archShape(w,hp,wallH,L,pointed){
  const s=new T.Shape(); s.moveTo(-L/2,0); s.lineTo(-w/2,0); s.lineTo(-w/2,hp);
  s.absarc(0,hp,w/2,Math.PI,0,true); s.lineTo(w/2,0); s.lineTo(L/2,0); s.lineTo(L/2,wallH); s.lineTo(-L/2,wallH); s.closePath(); return s;
}
def('gate_arch','Ворота-арка',(g,r)=>{
  const c=vary(r,K.stone), w=8, hp=7;
  const geo=new T.ExtrudeGeometry(archShape(w,hp,WH,WL),{depth:WT,bevelEnabled:false}); geo.translate(0,0,-WT/2);
  mesh(g,geo,c).name='Body';
  const rf=grp(g,'Walk'); merlonsLine(rf,WL,WH,WT/2-.6,2,c); merlonsLine(rf,WL,WH,-WT/2+.6,2,c);
  bx(g,.9,1.6,WT+.6,0,hp+w/2,0,K.stoneL).position.z=0;
  const ar=new T.Mesh(new T.TorusGeometry(w/2+.3,.35,4,12,Math.PI),M(K.stoneL)); ar.position.set(0,hp,WT/2); ar.castShadow=true; g.add(ar);
  bx(g,w,.3,WT,0,0,0,K.stoneD);
  for(const s of[-1,1]) { cy(g,.15,.15,1.4,s*(w/2+1.2),7,WT/2+.2,K.woodD,5); sp(g,.4,s*(w/2+1.2),8.7,WT/2+.2,0xffb347,{e:0xff7a1a},6,5); }
  bx(g,.7,1.8,.2,-5,8,WT/2+.05,K.dark); bx(g,.7,1.8,.2,5,8,WT/2+.05,K.dark);
});
def('gate_portcullis','Ворота с решёткой',(g,r)=>{
  const c=vary(r,K.stone), w=8, hp=7;
  const geo=new T.ExtrudeGeometry(archShape(w,hp,WH,WL),{depth:WT,bevelEnabled:false}); geo.translate(0,0,-WT/2);
  mesh(g,geo,c).name='Body';
  bx(g,WL,.8,WT+.5,0,0,0,K.stoneD).visible=false;
  const rf=grp(g,'Walk'); merlonsLine(rf,WL,WH,WT/2-.6,2,c); merlonsLine(rf,WL,WH,-WT/2+.6,2,c);
  for(const s of[-1,1]){ bx(g,1.2,WH+3,WT+1.2,s*(WL/2-.6),0,0,K.stoneD); bx(g,1.2,1.2,WT+1.6,s*(WL/2-.6),WH+3,0,K.stoneD); }
  const pc=grp(g,'Portcullis',0,0,WT/2-.9);
  const open=3.2; pc.position.y=open;
  for(let i=0;i<8;i++) bx(pc,.28,hp+3.5,.28,-3.5+i*1,0,0,K.iron);
  for(let j=0;j<5;j++) bx(pc,w-.2,.28,.28,0,j*1.9+.5,0,K.iron);
  for(let i=0;i<8;i++) cn(pc,.25,.7,-3.5+i,-.7,0,K.iron,4).rotation.x=Math.PI;
  bx(g,w,.3,WT,0,0,0,K.stoneD);
  const dd=bx(g,w+.6,.8,.5,0,hp+w/2-.2,WT/2+.1,K.stoneL).visible=false;
  const fl=flag(g,0,WH+.2,0,5,3.2,2,K.red); flagAnim(g,[fl]);
  onAnim(g,t=>{ pc.position.y=open+Math.sin(t*.6)*.4; });
  for(const s of[-1,1]){ cy(g,.15,.15,1.4,s*(w/2+.9),7,WT/2+.2,K.woodD,5); sp(g,.4,s*(w/2+.9),8.7,WT/2+.2,0xffb347,{e:0xff7a1a},6,5); }
});

/* ───────────── КРЕПОСТИ ───────────── */
function turret(p,R,H,x,z,c,rc,seg=10,flagCol){
  const g=grp(p,'Turret',x,0,z); cy(g,R,R+.5,H,0,0,0,c,seg,{fs:true}); cy(g,R+1,R+1,1,0,H,0,K.stoneD,seg,{fs:true});
  for(let i=0;i<3;i++) winR(g,R+.1,i*.8+.4,6+i*5,.8,2.4);
  const rf=grp(g,'Roof'); cn(rf,R+1.6,R*1.6,0,H+1,0,rc,seg,{fs:true}); 
  if(flagCol){ const f=flag(rf,0,H+1+R*1.6,0,4,2.8,1.6,flagCol); g.userData.flag=f; }
  return g;
}
def('fortress_big','Королевский дворец-крепость',(g,r,op)=>{
  const c=vary(r,K.stoneL), W=38,D=22,H=15,t=.8;
  const b=grp(g,'Body',0,0,0);
  room(b,W,D,H,t,c,K.red,{w:6.4,h:10.4,x:0});
  doorLeaf(b,6.4,10.4,0,D/2-t/2,K.woodD,op.doorOpen);
  bx(b,8,.4,10,0,0,D/2+3,K.red);
  for(const s of[-1,1])for(const x of[7,13]) win(b,s*x,7,D/2,2,4,'z');
  const rf=grp(g,'Roof'); gable(rf,W-4,8,D+1,0,H,0,K.roofD,1.5);
  const fl=[];
  for(const sx of[-1,1])for(const sz of[-1,1]){ const tt=turret(g,5.2,27,sx*(W/2+1),sz*(D/2+1),K.stone,sx<0?K.blue:K.roofD,10,sz>0?K.red:null); if(tt.userData.flag)fl.push(tt.userData.flag); }
  // донжон
  const dk=grp(g,'Keep',0,0,-D/2-6); room(dk,16,14,22,.8,c,K.stoneL,null,{skipBack:false});
  const dr=grp(dk,'Roof'); bx(dr,17.4,1,15.4,0,22,0,K.stoneD); merlonsLine(dr,16,23,7,2,c); merlonsLine(dr,16,23,-7,2,c);
  hip(dr,15,13,10,0,23,0,K.roofD); const f=flag(dr,0,33,0,6,3.5,2,K.gold); fl.push(f);
  bx(g,6,.1,9,0,0,0,K.red).visible=false;
  // прямой ковёр и колонны
  bx(b,5,.1,18,0,FL,0,0xb83a3a); for(const s of[-1,1])for(let i=0;i<3;i++) cy(b,.8,.8,H-.2,s*8,FL,-6+i*6,K.white,8);
  bx(b,5,1.2,5,0,FL,-D/2+4,K.gold,{m:.3});
  // мебель: длинные столы со скамьями, трон, кровати, сундуки, бочки
  { const FS=.55, SOf=(x,z)=>{ const q=grp(b,'Solid',x,FL,z); q.scale.setScalar(FS); return q; };      // дворец увеличивается ≈ в 2 раза — мебель уменьшаем, иначе стол выше половины роста игрока
    for(const s of[-1,1]){ const q=SOf(s*13,-2); table(q,0,0,0,3,12); bench(q,-2.4,0,0,10,Math.PI/2); bench(q,2.4,0,0,10,Math.PI/2); } }
  bx(b,3,3,2.4,0,FL,-D/2+2.2,K.woodD); bx(b,2.2,6,.5,0,FL+3,-D/2+1.2,K.red);
  for(const s of[-1,1]){ const SOf=(x,z)=>{ const q=grp(b,'Solid',x,FL,z); q.scale.setScalar(.55); return q; }; bed(SOf(s*15,-D/2+4.5),0,0,0,0,K.blue); crate(SOf(s*17,-D/2+1.5),0,0,0,1.6); barrel(SOf(s*17,D/2-2),0,0,0,1,2.2); }
  flagAnim(g,fl);
});
def('citadel','Малая цитадель',(g,r,op)=>{
  const c=vary(r,K.stone), S=22,H=18,t=.9, O=19;
  const k=grp(g,'Keep');
  room(k,S,S,H,t,c,K.stoneL,{w:5.6,h:9.6,x:0});
  doorLeaf(k,5.6,9.6,0,S/2-t/2,K.woodD,op.doorOpen);
  for(const y of[11,15]) for(const x of[-6,6]) win(k,x,y,S/2,.9,2.4,'z');
  const rf=grp(k,'Roof'); bx(rf,S+1.6,1,S+1.6,0,H,0,K.stoneD);
  for(const z of[-1,1]) merlonsLine(rf,S+1,H+1,z*(S/2+.2),2,c,1.2);
  for(const x of[-1,1]) { const m=grp(rf,'m'); m.rotation.y=Math.PI/2; m.position.x=x*(S/2+.2); merlonsLine(m,S+1,H+1,0,2,c,1.2); }
  const fl=[]; fl.push(flag(rf,0,H+1,0,7,4,2.2,K.red));
  for(const sx of[-1,1])for(const sz of[-1,1]){ const g2=grp(k,'Corner',sx*(S/2),0,sz*(S/2)); cy(g2,2.4,2.8,H+5,0,0,0,K.stone,8,{fs:true}); cn(g2,3.4,5,0,H+5,0,K.roofD,8,{fs:true}); }
  // внешняя ограда с воротами
  const ow=grp(g,'Outer'), hw=O+4;
  const seg=(w,x,z,rot)=>{ const s=grp(ow,'W',x,0,z); s.rotation.y=rot; bx(s,w,8,2,0,0,0,c); merlonsLine(s,w,8,0,1.6,c,1.2); };
  const gate=9;
  seg(2*hw,0,-hw,0); seg(2*hw,-hw,0,Math.PI/2); seg(2*hw,hw,0,Math.PI/2);
  seg(hw-gate/2,-(hw+gate/2)/2,hw,0); seg(hw-gate/2,(hw+gate/2)/2,hw,0);
  for(const s of[-1,1]) { cy(ow,2.2,2.5,12,s*gate/2,0,hw,K.stone,8,{fs:true}); cn(ow,3,4,s*gate/2,12,hw,K.roofD,8,{fs:true}); }
  for(const sx of[-1,1])for(const sz of[-1,1]) { cy(ow,2.6,3,11,sx*hw,0,sz*hw,K.stone,8,{fs:true}); cn(ow,3.6,4.5,sx*hw,11,sz*hw,K.roofD,8,{fs:true}); }
  // обстановка донжона. Цитадель в игре увеличивается ≈ в 3.2 раза (SCALE_H=90), поэтому мебель делаем в «человеческих» единицах и уменьшаем на F:
  // после увеличения стол ≈ 3 ед. высотой при росте Ричарда 9. Каждый предмет — группа 'Solid' (по ней строится коллизия)
  const F=.27;      // было .31 и огромные габариты: стол 32 длиной, койка ×1.7, ящики 5.5–6.5 — мебель в горной крепости получалась великанской при росте игрока 9
  { const I=grp(k,'Interior'), hz=S/2-t, hx=S/2-t, SO=(x,z,sc=1)=>{ const q=grp(I,'Solid',x,FL,z); q.scale.setScalar(F*sc); return q; };
    bx(I,6,.2,12,0,FL,-1,0x8a2a2a);                                    // ковёр от двери к трону
    { const q=SO(0,-hz+2.2); bx(q,16,2,9,0,0,0,K.woodD); bx(q,9,11,1.6,0,2,-3,K.woodD); bx(q,6,1.5,5,0,2,0,K.red); }    // трон на возвышении
    for(const s2 of[-1,1]){
      { const q=SO(s2*7.2,3); table(q,0,0,0,7,20,3.4); bench(q,-5.2,0,0,19,Math.PI/2); bench(q,5.2,0,0,19,Math.PI/2); }
      { const q=SO(s2*(hx-2.6),-hz+4.5,1.15); bed(q,0,0,0,0,s2<0?K.blue:K.red); }
      crate(SO(s2*(hx-1.5),-hz+9.5),0,0,0,4); barrel(SO(s2*(hx-1.5),hz-1.8),0,0,0,1.9,4.2); barrel(SO(s2*(hx-3.8),hz-1.8),0,0,0,1.9,4.2);
      { const q=SO(s2*(hx-5.5),-hz+1.6); bx(q,8,4,5,0,0,0,K.woodD); bx(q,8.2,1.4,5.2,0,4,0,K.gold,{m:.3}); bx(q,1.2,2,.5,0,1.4,2.6,K.iron); }
    }
  }
  // двор: ящики, бочки, мешки у стен
  { const Y=grp(g,'Yard'), hw2=O+4-2, SO=(x,z,sc=F)=>{ const q=grp(Y,'Solid',x,0,z); q.scale.setScalar(sc); return q; };
    for(const [x,z] of [[-hw2+3,-hw2+3],[hw2-3,-hw2+3],[hw2-3,hw2-3],[-hw2+3,hw2-3]]){ crate(SO(x,z),0,0,0,4.6); crate(SO(x+2.4,z),0,0,0,3.2); barrel(SO(x,z+(z>0?-2.4:2.4)),0,0,0,1.9,4.2); sack(SO(x+(x>0?-2.6:2.6),z+(z>0?-1.5:1.5)),0,0,0); }
    for(const x of[-14,14]) { const q=SO(x,-16,1); cy(q,.3,.35,3.2,0,0,0,K.woodD,6); sp(q,.5,0,3.4,0,K.white,{},8,6); }
  }
  flagAnim(g,fl);
  g.scale.setScalar(1);
});

/* ───────────── МАЯКИ ───────────── */
function lamp(g,y,R,beamLen){
  const lr=grp(g,'Lantern',0,y,0);
  cy(lr,R+.6,R+.6,.6,0,0,0,K.iron,12);
  const gl=cy(lr,R,R,5,0,.6,0,M(0xfff2b0,{e:0xffd860,o:.55,fs:false}),12,{o:.55}); 
  for(let i=0;i<6;i++){ const a=i/6*TAU; cy(lr,.2,.2,5,Math.sin(a)*R,.6,Math.cos(a)*R,K.iron,4); }
  const rf=grp(lr,'Roof'); cn(rf,R+1.2,4,0,5.6,0,K.roof,12); sp(rf,.5,0,9.9,0,K.gold,{m:.4},6,5);
  const beam=grp(lr,'Beam',0,3,0);
  const bm=M(0xfff3b0,{e:0xffe070,o:.32,ds:true,fs:false});
  for(const s of[1,-1]){ const c=new T.Mesh(new T.ConeGeometry(4.2,beamLen,10,1,true),bm); c.rotation.z=s*Math.PI/2; c.rotation.set(0,0,0); c.position.set(0,0,0);
    c.geometry.translate(0,-beamLen/2,0); c.rotation.x=s*Math.PI/2*-1; beam.add(c); }
  onAnim(g,t=>{ beam.rotation.y=t*1.2; });
}
def('lighthouse_a','Маяк полосатый',(g,r,op)=>{
  const R0=8.5,R1=5.2,H=40,n=5, t=.9;
  for(let i=0;i<n;i++){ const f0=i/n,f1=(i+1)/n, ra=R0+(R1-R0)*f0, rb=R0+(R1-R0)*f1;
    tube(g,ra,rb,H*f0,H/n,t,i%2?K.red:K.white,16,i===0?{dw:4.8,dh:8.8,name:'Band0'}:{name:'Band'+i,floor:i===0}); }
  doorLeaf(g,4.8,8.8,0,R0-.45,K.woodD,op.doorOpen);
  // галерея и площадка: кольцо (внешний R1+2, внутренний R1-.5), центр открыт для лестницы
  const ring=(p,y,mat)=>{ const rO=R1+2, rI=R1-.5, rm=(rO+rI)/2, nr=16; for(let i=0;i<nr;i++){ const a=i/nr*TAU; bx(p,TAU*rm/nr*1.15,.8,rO-rI+.1,Math.sin(a)*rm,y,Math.cos(a)*rm,mat).rotation.y=a; } };
  ring(g,H,K.iron);
  for(let i=0;i<16;i++){ const a=i/16*TAU; cy(g,.15,.15,2,Math.sin(a)*(R1+1.9),H+.8,Math.cos(a)*(R1+1.9),K.iron,4); }
  lamp(g,H+.8,3.2,34);
  { const ST=grp(g,'Stairs'), n=Math.floor((H-FL)/.6)+1; for(let i=0;i<n;i++){ const a=Math.PI/2+i*.3, y=FL+i*.6, rin=R0+(R1-R0)*y/H-t, rc=rin-2.4; bx(ST,2.8,.35,2.0,Math.sin(a)*rc,y,Math.cos(a)*rc,K.woodL).rotation.y=a; if(i===n-1){ for(let rr=rc+1.7; rr<R1+1.6; rr+=1.7) bx(ST,2.8,.35,1.8,Math.sin(a)*rr,y,Math.cos(a)*rr,K.woodL).rotation.y=a; } } }      // мостик от последней ступени к кольцу площадки      // винтовая лестница: радиус сужается вместе со стеной, подъём ≤.6, идёт до высоты ≈ H-1
  ring(grp(g,'Floor2'),H,K.woodD);      // плита-кольцо площадки на высоте H (коллизия по группе Floor2)
  for(let i=0;i<3;i++) winR(g,R0-(R0-R1)*(14+i*8)/H-.1,i*2.1+1,14+i*8);
  table(g,0,FL,-.5,4.2,2.4); bench(g,0,FL,1.5,4.2); bed(g,-3.2,FL,-3.4,Math.PI/2,K.blue); barrel(g,3.2,FL,-3,1,2.2);
});
def('lighthouse_b','Маяк на скале со сторожкой',(g,r,op)=>{
  const c=vary(r,K.stoneL);
  // скала
  const rk=grp(g,'Rock'); for(let i=0;i<9;i++){ const a=i/9*TAU, d=i%2?13:11; const m=cy(rk,3.4+r()*1.5,5+r()*1.5,2.5+r()*3,Math.sin(a)*d*1.1,0,Math.cos(a)*d*.9-2,vary(r,K.stoneD),7); }
  cy(rk,10,12,3,0,0,-2,K.stone,8,{fs:true}).scale.set(1.2,1,1);
  const top=3;  
  const hs=grp(g,'House',0,top,2);
  room(hs,18,12,10.8,.6,vary(r,K.cream),K.woodL,{w:4.6,h:8.6,x:0});
  doorLeaf(hs,4.6,8.6,0,6-.3,K.woodD,op.doorOpen);
  gable(hs,18,5,13,0,10.8,0,K.roof,1.2,'Roof'); win(hs,6,5,6,2.2,2.6,'z'); win(hs,-6,5,6,2.2,2.6,'z');
  table(hs,3,FL,-2,4,2.4); bed(hs,-6,FL,-2.5,0);
  const tw=grp(g,'Tower',-6,top,-5);
  room(tw,9,9,32,.8,vary(r,K.white),K.stone,null,{});
  // небольшая дверь из сторожки: башня глухая
  bx(tw,9.4,.8,9.4,0,32,0,K.red); 
  for(const i of[0,1,2,3]) { bx(tw,9,.8,.1,0,6+i*7,4.5,K.red).visible=i%2==0; }
  for(const a of[-1,1])for(const b of[-1,1]) cy(tw,.4,.4,2,a*4.4,32.8,b*4.4,K.iron,5);
  for(const s of[[0,4.4,9,.2],[0,-4.4,9,.2]]) bx(tw,s[2],.3,s[3],0,34.5,s[1],K.iron);
  for(const s of[-1,1]) bx(tw,.2,.3,9,s*4.4,34.5,0,K.iron);
  { const SB=grp(g,'Stairs'); for(let i=0;i<3;i++) bx(SB,4,1.1*(i+1),1.2,0,0,11.4-i*1.2,K.stone); }      // ступени от земли к двери сторожки на скале
  lamp(tw,32.8,2.8,32);
  for(let i=0;i<3;i++) win(tw,0,10+i*8,4.4,.9,2.6,'z');
});

/* ───────────── ПАГОДЫ ───────────── */
function pagoda(g,r,op,n,base,sh,col){
  // каждый ярус — полая комната высотой F (в рост человека с запасом), этажи — плиты с проёмом, между ярусами — лестница вдоль северной стены
  const F=13, ST=grp(g,'Stairs'), FLR=grp(g,'Floor2');
  let w=base, y=0; const ws=[];
  for(let i=0;i<n;i++){
    const h=F; ws.push({w,y});
    if(i===0){ room(g,w,w,h,.6,K.red,K.woodL,{w:4.8,h:8.8,x:0}); doorLeaf(g,4.8,8.8,0,w/2-.3,K.woodD,op.doorOpen);
      for(const a of[-1,1])for(const b of[-1,1]) cy(g,.55,.55,h,a*(w/2),0,b*(w/2),K.woodD,6);
      for(const x of[-5,5]) win(g,x,5,w/2,1.8,3.2,'z');
      bx(g,w+3,1,w+3,0,0,0,K.stone).visible=false; bx(g,w+4,.8,w+4,0,0,0,K.stoneD); }
    else { const rw=room(g,w,w,h,.6,K.red,null,null,{name:'Tier'+i}); rw.position.y=y;
      for(const a of[-1,1]) { win(g,a*3.5,y+5,w/2,1.8,3.2,'z'); win(g,a*3.5,y+5,-w/2,1.8,3.2,'z'); }
      bx(g,w+.8,.5,w+.8,0,y,0,K.woodD); }
    const rf=grp(g,'Roof'+i);
    hip(rf,w+8,w+8,i===0?5.6:4.6,0,y+h,0,col); bx(rf,w+8.4,.6,w+8.4,0,y+h-.2,0,K.woodD).scale.y=.8;
    for(const a of[-1,1])for(const b of[-1,1]){ const e=cn(rf,.5,1.8,a*(w/2+4),y+h+.7,b*(w/2+4),col,4); e.rotation.z=a*.5; }
    y+=h; w-=(base-9)/n*.9;
  }
  const top=y;
  // лестницы между ярусами и плиты этажей (проём — над лестницей у северной стены)
  for(let i=0;i<n-1;i++){
    const lo=ws[i], up=ws[i+1], ft0=i===0?FL:lo.y+.5, ft1=up.y+.5, nS=22, rise=(ft1-ft0)/nS, wi=lo.w-1.2, off=i===0?2.6:1.6, run=(wi-(i===0?5.2:3.2))/nS, zN=-up.w/2+.6+2.1;
    const dS=i%2===0?1:-1, zS=dS===1?zN:-zN;      // пролёты чередуются: чётные — вдоль северной стены с запада на восток, нечётные — вдоль южной с востока на запад (иначе верх одного пролёта упирается в основание следующего)
    for(let k=0;k<nS;k++) bx(ST,run,ft0+rise*(k+1)-lo.y,3.8,dS*(-wi/2+off+k*run),lo.y,zS,K.woodL);      // ступень: глубина (вдоль пролёта, x) = run, ширина пролёта (z) = 2.2 — раньше размеры были перепутаны, и соседние ступени перекрывались
    const sw=up.w-1.2, d=sw-4.2; bx(FLR,sw,.5,d,0,up.y,dS*2.1,K.woodD);      // плита следующего яруса без полосы над лестницей
    // мебель на каждом ярусе (на южной стороне, вдали от лестницы)
    const zs=lo.w/2-2.2; table(g,-2,ft0,zs-1.6,4.4,2.6); crate(g,lo.w/2-2.2,ft0,zs,2.2);
  }
  { const lo=ws[n-1], ft0=lo.y+.5, zs=lo.w/2-2.2; table(g,-1,ft0,0,4.4,2.6); crate(g,lo.w/2-2,ft0,zs,2.2); }
  const sp=grp(g,'Spire',0,top+2,0); cy(sp,.35,.5,4,0,0,0,K.gold,6,{m:.4});
  for(let i=0;i<5;i++) cy(sp,1.1-i*.15,1.1-i*.15,.4,0,.5+i*.7,0,K.gold,8,{m:.4});
  cn(sp,.3,1.6,0,4,0,K.gold,6);
  return sp;
}
def('pagoda_3','Пагода 3 яруса',(g,r,op)=>{ pagoda(g,r,op,3,18,8,vary(r,K.green)); });
def('pagoda_5','Пагода 5 ярусов',(g,r,op)=>{ pagoda(g,r,op,5,20,7,vary(r,0x3a6d8f)); });

/* ───────────── ТОРИИ ───────────── */
def('torii_red','Тории красные',(g,r)=>{
  const G=14,H=17, red=0xc2371f, blk=0x2c2622;
  for(const s of[-1,1]){ cy(g,.95,1.15,H,s*G/2,0,0,red,10); cy(g,1.25,1.25,.9,s*G/2,0,0,blk,10); }
  const nu=bx(g,G+1.6,1,.9,0,H-4.2,0,red); bx(g,G+.4,1.8,1.3,0,H-3.4+.3,0,red).visible=false;
  bx(g,G-.6,.9,.7,0,H-6.1+.1,0,red).position.y=H-5.9;
  bx(g,.9,1.6,.8,0,H-5,0,red);
  const ka=bx(g,G+5,1.2,1.5,0,H,0,blk); bx(g,G+7,.8,2.2,0,H+1.2,0,blk);
  for(const s of[-1,1]){ const e=bx(g,3.4,.8,2.2,s*(G/2+4),H+1.4,0,blk); e.rotation.z=s*.28; e.position.y=H+1.75; }
  bx(g,G+1,.5,.5,0,H-1.2,0,red).visible=false;
  bx(g,1.6,2.4,.3,0,H-4.6,.6,K.gold).visible=false;
});
def('torii_stone','Тории каменные с фонарями',(g,r)=>{
  const G=10,H=14,c=vary(r,K.stone);
  for(const s of[-1,1]){ bx(g,1.5,H,1.5,s*G/2,0,0,c); bx(g,2.1,.8,2.1,s*G/2,0,0,K.stoneD); }
  bx(g,G+4.4,1.2,1.4,0,H,0,K.stoneD); bx(g,G+5.4,.8,2,0,H+1.2,0,c);
  for(const s of[-1,1]){ const e=bx(g,2,.8,2,s*(G/2+2.8),H+1.6,0,c); e.rotation.z=s*.3; }
  bx(g,G+1.2,.9,.9,0,H-3.6,0,c); bx(g,1.8,2.6,.5,0,H-3.6-2.7,.1,K.stoneL);
  for(const s of[-1,1]){ const lx=s*(G/2+5);   // каменные фонари
    bx(g,2.2,.8,2.2,lx,0,4,K.stoneD); cy(g,.5,.6,3,lx,.8,4,c,6); bx(g,2,1.8,2,lx,3.8,4,c);
    bx(g,1,1,2.1,lx,4.2,4,0xffd780,{e:0xcc8a22}); hip(g,3.6,3.6,1.6,lx,5.6,4,K.stoneD); sp(g,.35,lx,7.4,4,c,{},6,5); }
  for(let i=0;i<4;i++) bx(g,6,.3,1.4,0,i*.15,3+i*1.4,K.stoneL);
});

/* ───────────── СКЛАДЫ ───────────── */
def('warehouse_barn','Амбар (красный)',(g,r,op)=>{
  const W=20,D=28,H=11,t=.6, c=vary(r,K.red);
  room(g,W,D,H,t,c,K.woodL,{w:8,h:9.6,x:0});
  // створки
  for(const s of[-1,1]){ const d=doorLeaf(g,4,9.5,s*2,D/2-.3,K.woodD,op.doorOpen); if(s<0){ d.position.x=-4; d.rotation.y=op.doorOpen?-1.75:0; } else { d.position.x=4; d.rotation.y=op.doorOpen?1.75:0; d.scale.x=-1; } }
  for(const z of[-8,0,8]) win(g,-W/2,6,z,2,2.4,'x',.8,K.glass);
  // мансардные ворота
  bx(g,0.1,.1,.1,0,0,0,K.white).visible=false;
  for(const s of[-1,1]) { bx(g,.5,H,.5,s*(W/2),0,D/2,K.white); bx(g,.5,H,.5,s*(W/2),0,-D/2,K.white); }
  // мансардная (gambrel) крыша
  const sh=new T.Shape(); sh.moveTo(-W/2-1,0); sh.lineTo(-W/2+.5,4); sh.lineTo(0,8.5); sh.lineTo(W/2-.5,4); sh.lineTo(W/2+1,0); sh.closePath();
  const geo=new T.ExtrudeGeometry(sh,{depth:D+2,bevelEnabled:false}); geo.translate(0,0,-(D+2)/2);
  const rf=grp(g,'Roof'); mesh(rf,geo,K.woodD,0,H,0);
  bx(g,5,3,.4,0,H+1.6,D/2+.4,K.cream).visible=false;
  for(let i=0;i<5;i++) bx(g,1.8,1.8,1.8,-7+(i%3)*2,FL+Math.floor(i/3)*1.8,-9+(i%2)*2,K.hay);
  for(let i=0;i<4;i++) bx(g,3.6,1.6,1.8,6,FL+(i%2)*1.6,-10+Math.floor(i/2)*4,K.hay);
  for(let i=0;i<3;i++) crate(g,-6+i*2.6,FL,6,2.2);
});
def('warehouse_granary','Зерновой амбар на сваях',(g,r,op)=>{
  const W=16,D=18,H=10.5,t=.6, FH=3.2, c=vary(r,K.woodL);
  for(const x of[-6,0,6])for(const z of[-6,0,6]){ cy(g,.5,.8,FH-.3,x,0,z,K.woodD,6); cy(g,1.5,1.2,.5,x,FH-.5,z,K.stone,8).position.y=FH-.25; }
  const b=grp(g,'Body',0,FH,0);
  room(b,W,D,H,t,c,K.woodD,{w:4.6,h:8.6,x:0});
  doorLeaf(b,4.6,8.6,0,D/2-t/2,K.woodD,op.doorOpen);
  bx(b,6,.4,3.4,0,0,D/2+1.8,K.woodL);
  for(let i=0;i<5;i++) bx(g,6,.4,1.0,0,i*.6+.1,D/2+7-i*.0+i*0,K.woodL).visible=false;
  const st=grp(g,'Stairs'); for(let i=0;i<7;i++) bx(st,5,.45,1,0,i*.45,D/2+5-i,K.woodL);
  for(const x of[-5,5]) win(b,x,5,D/2,1.8,2.2,'z');
  gable(b,W,7,D+1,0,H,0,K.hay,1.4,'Roof');
  for(let i=0;i<8;i++){ sack(b,-5+(i%4)*1.3,FL,-6+Math.floor(i/4)*1.5); }
  barrel(b,5,FL,-6); barrel(b,5,FL,-3.6); bx(b,5,3,3,-4,FL,-3,K.hay);
});
def('warehouse_stone','Каменный склад с краном',(g,r,op)=>{
  const W=30,D=16,H=12,t=.7, c=vary(r,K.stone);
  room(g,W,D,H,t,c,K.woodD,{w:7,h:9.4,x:0});
  doorLeaf(g,3.5,9.2,-3.5+0,D/2-.4,K.woodD,op.doorOpen);
  { const d=doorLeaf(g,3.5,9.2,0,D/2-.4,K.woodD,op.doorOpen); d.position.x=3.5; d.scale.x=-1; d.rotation.y=op.doorOpen?1.75:0; }
  for(const x of[-11,-7,7,11]) win(g,x,6,D/2,1.4,2.8,'z');
  for(const x of[-9,0,9]) win(g,x,6,-D/2,1.4,2.8,'z');
  const rf=grp(g,'Roof'); hip(rf,W+2,D+2,6,0,H,0,vary(r,K.roof));
  // кран-таль
  const cr=grp(g,'Crane',W/2-3,0,D/2+.2);
  bx(cr,.7,H+4,.7,3,0,0,K.woodD); const ar=bx(cr,.6,.6,7,3,H+3,3.2,K.woodD); const br=bx(cr,.4,.4,5,3,H,1.9,K.woodD); br.rotation.x=.6;
  const hk=grp(cr,'Hook',3,H+3,6.4); bx(hk,.08,5,.08,0,-5,0,K.dark); crate(hk,0,-7.4,0,2.4);
  onAnim(g,t=>{ hk.position.y=H+3-Math.sin(t*.7)*.6-.6; });
  for(let i=0;i<12;i++) crate(g,-12+(i%6)*2.6,FL+Math.floor(i/6)*2.4*0,-4+Math.floor(i/6)*4,2.2);
  for(let i=0;i<4;i++) barrel(g,10,FL,-5+i*2.6);
  for(let i=0;i<3;i++) barrel(g,-W/2-2.5,0,2+i*2.6);
});

/* ───────────── КАЗАРМЫ ───────────── */
def('barracks','Казармы',(g,r,op)=>{
  const W=38,D=14,H=11,t=.6,c=vary(r,K.stoneL);
  room(g,W,D,H,t,c,K.woodL,{w:5.2,h:9,x:0});
  doorLeaf(g,5.2,9,0,D/2-t/2,K.woodD,op.doorOpen);
  for(const s of[-1,1])for(const x of[5,9.5,14,17]) win(g,s*x,5.6,D/2,1.8,3,'z');
  for(const x of[-14,-7,0,7,14]) win(g,x,5.6,-D/2,1.8,3,'z');
  const rf=grp(g,'Roof'); gable(rf,D,5.5,W+1.2,0,H,0,vary(r,K.roofD),1.2).rotation.y=Math.PI/2;
  for(let i=0;i<6;i++){ bed(g,-16+i*5.6,FL,-D/2+4.4,0,K.blue); bed(g,-16+i*5.6+0,FL,D/2-4.4-2,Math.PI,K.blue).visible=(i!==3); }
  for(let i=0;i<2;i++) table(g,-5+i*10,FL,0,5,2.6);
  // стойка с оружием и манекен
  const rack=grp(g,'Rack',W/2+3,0,2); bx(rack,1,.4,7,0,0,0,K.woodD); bx(rack,.5,4,.5,0,0,-3,K.woodD); bx(rack,.5,4,.5,0,0,3,K.woodD); bx(rack,.4,.4,7,0,3.3,0,K.woodD);
  for(let i=0;i<4;i++){ cy(rack,.12,.12,6.5,0,.4,-2.4+i*1.6,K.woodL,5).rotation.x=0; cn(rack,.3,1,0,6.9,-2.4+i*1.6,0xc6ccd2,5); }
  const dm=grp(g,'Dummy',-W/2-4,0,3); cy(dm,.15,.15,4,0,0,0,K.woodD,5); bx(dm,2.8,.4,.5,0,3,0,K.woodD); cy(dm,1,1.2,2.6,0,1.2,0,K.hay,8); sp(dm,.8,0,4.4,0,K.hay,{},7,6);
  const fl=flag(g,W/2-1,H+5,0,9,3.6,2.2,K.blue); flagAnim(g,[fl]);
  fl.position.y=H+3; 
});

/* ───────────── КУЗНИЦА ───────────── */
def('smithy','Кузница',(g,r,op)=>{
  const W=18,D=14,H=10.8,t=.6,c=vary(r,K.stone);
  room(g,W,D,H,t,c,K.stoneD,{w:6,h:8.8,x:0});
  doorLeaf(g,6,8.8,0,D/2-t/2,K.woodD,op.doorOpen);
  win(g,-5.5,5.5,D/2,2,2.4,'z'); for(const z of[-2,3]) win(g,W/2,5.4,z,2,2.4,'x',.8,0xffb86a);
  const rf=grp(g,'Roof'); gable(rf,W,5.2,D+1,0,H,0,vary(r,K.roofD),1.2);
  // горн + дымоход
  const fg=grp(g,'Forge',-5.5,0,-D/2+3);
  bx(fg,6,3,4,0,FL,0,K.stone); bx(fg,4,.6,3,0,FL+3,0,0x2a2522); bx(fg,2.4,13,2.4,0,FL+3.6,-1,K.stone); 
  bx(fg,5,.4,.4,0,FL+3.2,1.6,K.stoneD);
  const fire=grp(fg,'Fire',0,FL+3.2,0);
  const fm=M(0xff8a1f,{e:0xff5a0a,o:.9,fs:false}), fm2=M(0xffd24a,{e:0xffbb22,o:.9,fs:false});
  const fl=[];
  for(let i=0;i<5;i++){ const f=new T.Mesh(new T.ConeGeometry(.5+(i%2)*.15,2.2,5),i%2?fm2:fm); f.position.set(-1.2+i*.6,1.1,(i%3-1)*.4); fire.add(f); fl.push(f); }
  const smoke=[]; const sm=M(0x777777,{o:.45,fs:false});
  for(let i=0;i<5;i++){ const s=new T.Mesh(new T.IcosahedronGeometry(.9,0),sm); rf.add(s); smoke.push(s); }
  // наковальня, бочка, мехи
  const an=grp(g,'Anvil',3,0,0); cy(an,1.1,1.3,1.8,0,FL,0,K.woodD,8); bx(an,3.6,.9,1.3,0,FL+1.8,0,K.iron,{m:.5}); bx(an,1.6,.7,1,0,FL+2.7,0,K.iron);
  cn(an,.5,1.4,2,FL+1.8,0,K.iron,4).rotation.z=-Math.PI/2;
  barrel(g,6.5,FL,-4.5,1.2,2.4,K.woodD); water(g,.9,6.5,FL+2.4,-4.5,8);
  const be=grp(g,'Bellows',-2.2,FL,-D/2+1.6); bx(be,2.2,.5,3.4,0,1,0,K.woodL); const bl=bx(be,2,.9,3,0,1.5,0,0x6b4a32); bx(be,.3,.3,2.5,0,1.2,2.5,K.iron);
  for(let i=0;i<5;i++) bx(g,.4,2.4,.15,W/2-1+0*i,0,0,K.dark).visible=false;
  const rack=grp(g,'Tools',-W/2+.6,0,3); bx(rack,.3,.3,6,0,5,0,K.woodD);
  for(let i=0;i<4;i++){ bx(rack,.3,3,.3,0,2,-2.4+i*1.6,K.iron); bx(rack,.5,.9,.9,0,4,-2.4+i*1.6,K.iron); }
  onAnim(g,t=>{ fl.forEach((f,i)=>{ const s=1+.35*Math.sin(t*9+i*1.7); f.scale.set(1+.15*Math.sin(t*7+i),s,1+.15*Math.cos(t*8+i)); f.position.y=1.1*s; f.rotation.z=Math.sin(t*5+i)*.12; });
    bl.scale.y=1+.2*Math.sin(t*2); smoke.forEach((s,i)=>{ const ph=(t*.35+i/5)%1; s.position.set(-5.5+ph*2,H+4+ph*9,-D/2+3-1); s.scale.setScalar(.5+ph*1.4); }); });
});

/* ───────────── РАТУША ───────────── */
def('townhall','Ратуша с часами',(g,r,op)=>{
  const W=32,D=18,H=14,t=.7,c=vary(r,K.cream), b=grp(g,'Body',0,0,-4.5);
  room(b,W,D,H,t,c,K.stoneL,{w:5.6,h:9.4,x:0});
  for(const x of[-12,-8,8,12]) win(b,x,6.5,D/2,2,4,'z');
  for(const x of[-10,0,10]) win(b,x,6.5,-D/2,2,4,'z');
  for(const s of[-1,1])for(const z of[-5,0,5]) win(b,s*W/2,6.5,z,2,4,'x');
  const rf=grp(b,'Roof'); gable(rf,D,6,W+1.4,0,H,0,vary(r,K.roofD),1.2).rotation.y=Math.PI/2;
  // башня с часами над входом
  const zt=D/2+4.5-.7, tw=grp(b,'Tower',0,0,zt);
  room(tw,10,9,24,.7,K.stoneL,K.stone,{w:5.6,h:9.4,x:0},{back:true});
  doorLeaf(tw,5.6,9.4,0,4.5-.35,K.woodD,op.doorOpen);
  bx(tw,10.6,1,9.6,0,24,0,K.stoneD);
  const clocks=[];
  const mkClock=(x,z,ry)=>{ const cg=grp(tw,'Clock',x,19,z); cg.rotation.y=ry;
    cy(cg,2.6,2.6,.5,0,-2.6,0,K.gold,16,{m:.3}).rotation.x=Math.PI/2; const face=cy(cg,2.3,2.3,.6,0,-2.3,0,K.white,16); face.rotation.x=Math.PI/2; face.position.set(0,0,.05);
    for(let i=0;i<12;i++){ const a=i/12*TAU; bx(cg,.2,i%3?.4:.7,.2,Math.sin(a)*1.9,Math.cos(a)*1.9-.2,.38,K.dark).rotation.z=-a; }
    const mh=grp(cg,'Minute',0,0,.5), hh=grp(cg,'Hour',0,0,.55); bx(mh,.2,1.9,.12,0,0,0,K.dark); bx(hh,.3,1.2,.12,0,0,0,K.dark); sp(cg,.2,0,0,.55,K.gold,{},6,5); clocks.push([mh,hh]); };
  mkClock(0,4.9,0); mkClock(5.1,0,Math.PI/2); mkClock(-5.1,0,-Math.PI/2);
  for(const a of[-1,1])for(const bb of[-1,1]) bx(tw,.8,5,.8,a*4.4,24.8,bb*4,K.stone);
  cy(tw,.2,1.2,2,0,27,0,K.gold,8,{m:.4});
  const sr=grp(tw,'SpireRoof'); hip(sr,11.4,10.4,10,0,29.8,0,K.green); bx(sr,.3,3,.3,0,39.6,0,K.gold); sp(sr,.5,0,39.5,0,K.gold,{},6,5);
  const fl=[flag(rf,W/2-1,H+5.6,0,5,3,1.8,K.red),flag(rf,-W/2+1,H+5.6,0,5,3,1.8,K.red)]; flagAnim(g,fl);
  // интерьер
  bx(b,12,.7,2,0,FL,-6,K.woodD); bx(b,12,1.8,1,0,FL+.7,-6.4,K.woodD).visible=false;
  for(let i=0;i<8;i++) bench(b,-9+i*2.6,FL,2,2.2,Math.PI/2);
  onAnim(g,t=>{ for(const [m,h] of clocks){ m.rotation.z=-t*.5; h.rotation.z=-t*.5/12; } });
  bx(b,1.8,10,.2,0,0,0,K.dark).visible=false;
});

/* ───────────── МОСТ (длина 24 по z) ───────────── */
def('bridge_stone','Мост каменный арочный',(g,r)=>{
  const c=vary(r,K.stone), BW=10, in_=grp(g,'Span'); in_.rotation.y=Math.PI/2;
  const s=new T.Shape(); s.moveTo(-12,0); s.lineTo(-4,5.4); s.lineTo(4,5.4); s.lineTo(12,0);
  s.lineTo(9.7,0); s.absarc(8.2,0,1.5,0,Math.PI,false); s.lineTo(3.6,0); s.absarc(0,0,3.6,0,Math.PI,false); s.lineTo(-6.7,0); s.absarc(-8.2,0,1.5,0,Math.PI,false); s.lineTo(-12,0);
  const geo=new T.ExtrudeGeometry(s,{depth:BW-1.6,bevelEnabled:false}); geo.translate(0,0,-(BW-1.6)/2);
  mesh(in_,geo,c).name='Body';
  bx(in_,16.4,.3,BW,0,5.4,0,K.stoneL).visible=false;
  // настил и парапеты
  bx(in_,8,.3,BW-1.4,0,5.4,0,K.stoneL);
  for(const sd of[-1,1]){
    bx(in_,8.4,2.2,.9,0,5.4,sd*(BW/2-.45),K.stoneL);
    for(const sx of[-1,1]){ const L=Math.hypot(8,5.4); const p=bx(in_,L,2.2,.9,sx*8,0,sd*(BW/2-.45),K.stoneL); p.rotation.z=-sx*Math.atan2(5.4,8); p.position.y=2.7+1.1; p.position.x=sx*8; }
    for(const x of[-4.3,4.3]) bx(in_,1.3,3.4,1.3,x,5.4,sd*(BW/2-.45),K.stone);
    for(const x of[-12,12]) bx(in_,1.3,2.6,1.3,x+(x>0?-.6:.6),0,sd*(BW/2-.45),K.stone);
  }
  for(let i=0;i<4;i++){ bx(in_,3.6,.2,BW-1.4,-4*Math.cos(0)-0,0,0,K.stone).visible=false; }
  // каменные ступени на уклонах
  for(const sx of[-1,1])for(let i=0;i<7;i++){ const x=sx*(4.9+i*1.0), y=5.4*(1-(i+.9)/8); bx(in_,.2,.12,BW-1.5,x,y+.1,0,K.stoneD,{cs:false}); }
  const wt=bx(in_,30,.05,2,0,0,0,K.water).visible=false;
});

/* ───────────── ПОЛЯ 20×14 ───────────── */
function fieldBase(g,c){ bx(g,20,.4,14,0,0,0,c); }
function rows(g,nr,w,c){ for(let i=0;i<nr;i++) bx(g,w,.7,18.4,-8.6+i*17.2/(nr-1),.4,0,hexMul(c,.9+((i%2)?0:.1)),{cs:false}); }
def('field_veg','Огород-грядки',(g,r)=>{
  fieldBase(g,K.soil);
  const R=7, kinds=[[K.grass,0],[0x4e9a3e,1],[0xb5c94a,2],[0xe28a2c,3]];
  for(let i=0;i<R;i++){ const x=-8.4+i*2.8, k=kinds[(i+Math.floor(r()*3))%4];
    const mound=bx(g,1.9,.7,17.6,x,.4,0,hexMul(K.soil,1.1)); mound.rotation.y=0;
    mound.geometry=new T.BoxGeometry(1.9,.7,12.6); mound.rotation.y=Math.PI/2; mound.position.set(0,.75,-6+i*2);
  }
  g.children.length=1;
  const rowsN=6, pc=[0x5fae45,0x7bb84c,0x8fbf3a,0x4e9a3e];
  for(let i=0;i<rowsN;i++){ const z=-5.6+i*2.24, m=bx(g,18,.7,1.5,0,.4,z,hexMul(K.soil,1.15));
    for(let j=0;j<7;j++){ const x=-7.5+j*2.5; const kind=(i+(r()<.3?1:0))%3;
      if(kind===0){ const cb=sp(g,.85,x,1.55,z,pc[(i+j)%2],{},6,4); cb.scale.y=.8; }
      else if(kind===1){ for(let q=0;q<3;q++) cn(g,.3,1.5,x+(q-1)*.3,1.1,z+(q%2)*.2-.1,K.green,4).rotation.z=(q-1)*.35; sp(g,.28,x,1.2,z,0xe28a2c,{},5,4); }
      else { const l=sp(g,.8,x,1.5,z,0x7bd05a,{},5,4); l.scale.set(1,.7,1); sp(g,.35,x,1.9,z,K.red,{},5,4); } } }
  // колышки по углам
  for(const a of[-1,1])for(const b of[-1,1]) bx(g,.4,2,.4,a*9.7,.4,b*6.7,K.woodD);
});
def('field_wheat','Пшеничное поле',(g,r)=>{
  fieldBase(g,K.soil);
  const n=10*9, im=new T.InstancedMesh(new T.ConeGeometry(.75,1,5),M(K.hay,{}),n), im2=new T.InstancedMesh(new T.ConeGeometry(.5,1,5),M(0xcf9a35),n);
  const d=new T.Object3D(), col=new T.Color(); let k=0;
  for(let i=0;i<10;i++)for(let j=0;j<9;j++){
    const x=-8.6+i*1.9+(r()-.5)*.4, z=-6.2+j*1.55+(r()-.5)*.3, h=3.6+r()*1.3;
    d.position.set(x,.4+h/2,z); d.rotation.set((r()-.5)*.15,r()*3,(r()-.5)*.15); d.scale.set(1,h,1); d.updateMatrix(); im.setMatrixAt(k,d.matrix);
    d.position.set(x,.4+h-.3,z); d.scale.set(1,1.4,1); d.updateMatrix(); im2.setMatrixAt(k,d.matrix);
    im.setColorAt(k,col.setHex(hexMul(K.hay,.85+r()*.3))); k++; }
  im.castShadow=true; im.receiveShadow=true; g.add(im); g.add(im2); im.name='Wheat'; im2.name='Ears';
  // пугало
  const sc=grp(g,'Scarecrow',7.5,.4,-5); cy(sc,.2,.25,6,0,0,0,K.woodD,5); bx(sc,5,.3,.3,0,4.2,0,K.woodD); cy(sc,.9,1.1,2.4,0,2.6,0,K.red,7);
  sp(sc,.8,0,6.6,0,K.hay,{},7,6); cy(sc,1.4,1.4,.15,0,7.2,0,K.woodD,8); cy(sc,.6,.8,.9,0,7.3,0,K.woodD,8);
  onAnim(g,t=>{ sc.rotation.z=Math.sin(t*1.3)*.03; });
  for(const a of[-1,1])for(const b of[-1,1]) bx(g,.4,2,.4,a*9.7,.4,b*6.7,K.woodD);
});
def('field_rice','Рисовое поле',(g,r)=>{
  fieldBase(g,K.soil);
  for(const s of[-1,1]) bx(g,20,1.1,1.2,0,.4,s*6.6,hexMul(K.soil,1.2));
  for(const s of[-1,1]) bx(g,1.2,1.1,12.4,s*9.4,.4,0,hexMul(K.soil,1.2));
  const w=bx(g,17.6,.2,12.2,0,.4,0,M(K.water,{e:0x0b3a52,o:.82,r:.25,fs:false}),{cs:false}); w.name='Water';
  bx(g,17.6,.1,12.2,0,.35,0,0x5a4a35).visible=false;
  const n=8*7, im=new T.InstancedMesh(new T.ConeGeometry(.35,2.3,4),M(0x6fc04a),n*3), d=new T.Object3D(); let k=0;
  for(let i=0;i<8;i++)for(let j=0;j<7;j++){ const x=-7.5+i*2.15, z=-5+j*1.67;
    for(let q=0;q<3;q++){ d.position.set(x+(q-1)*.35,1.45,z+(q%2)*.25); d.rotation.set((r()-.5)*.4,0,(q-1)*.25); d.scale.set(1,.9+r()*.3,1); d.updateMatrix(); im.setMatrixAt(k++,d.matrix);} }
  im.castShadow=true; g.add(im); im.name='Rice';
  // мостик-доска
  bx(g,2,.3,14.4,0,1.2,0,K.woodL,{o:undefined}).position.x=-9.4; 
  onAnim(g,t=>{ w.position.y=.5+Math.sin(t*1.5)*.03; im.rotation.z=Math.sin(t*1.2)*.01; });
});
