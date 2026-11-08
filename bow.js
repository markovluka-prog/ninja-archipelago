// bow.js — лук: клавиша 2 (или Z). Зажать ЛКМ/J — натянуть тетиву (чем дольше, тем сильнее и дальше), отпустить — выстрел. Работает и в прыжке.
// Стрела летит в точку прицела (точка над головой игрока), падает по дуге, бьёт врагов арены, чучела и мишени, втыкается и остаётся.
// Щит (блок/парирование) отбивает стрелы, летящие спереди (их выпускают стрелковые турели на тренировочной площадке).
export function createBow({ THREE, scene, world, getG, getCam, training }) {
  const V = THREE.Vector3, hAt = (x, z) => world.heightAt(x, z);
  const woodM = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.7 }), strM = new THREE.MeshBasicMaterial({ color: 0xf1ece0 });
  const shaftM = new THREE.MeshStandardMaterial({ color: 0xc8a96a, roughness: 0.8 }), headM = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.5, roughness: 0.4 }), featM = new THREE.MeshStandardMaterial({ color: 0xb02a22, roughness: 0.9 });
  const hostileM = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.8 });

  function makeArrow(hostile = false) {
    const g = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 5, 5), hostile ? hostileM : shaftM); sh.rotation.x = Math.PI / 2; g.add(sh);
    const hd = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 6), headM); hd.rotation.x = Math.PI / 2; hd.position.z = 2.8; g.add(hd);
    for (const a of [0, 1.57]) { const f = new THREE.Mesh(new THREE.BoxGeometry(a ? 0.55 : 0.04, a ? 0.04 : 0.55, 0.9), hostile ? hostileM : featM); f.position.z = -2.2; g.add(f); }
    return g;
  }

  // ───── модель лука: дуга в вертикальной плоскости, выгнута вперёд (+z), тетива ближе к стрелку. Не крепится к кисти (оси кисти у героев разные),
  // а каждый кадр ставится в мировую позицию левой кисти и поворачивается вместе с персонажем ─────
  const R = 3.3, SPAN = Math.PI * 0.8;
  function makeBowModel() {
    const g = new THREE.Group(); g.name = 'Bow';
    const geo = new THREE.TorusGeometry(R, 0.14, 6, 20, SPAN); geo.rotateZ(-SPAN / 2); geo.rotateY(-Math.PI / 2); geo.translate(0, 0, -R);
    g.add(new THREE.Mesh(geo, woodM));
    const zs = R * Math.cos(SPAN / 2) - R, half = R * Math.sin(SPAN / 2);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, half * 2, 4), strM); str.position.set(0, 0, zs); g.add(str);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x3a2412 })); g.add(grip);
    for (const sy of [-1, 1]) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), new THREE.MeshStandardMaterial({ color: 0xd9a92b })); tip.position.set(0, sy * half, zs); g.add(tip); }
    const nock = makeArrow(); nock.position.set(0, 0, zs + 2.2); nock.scale.setScalar(0.85); g.add(nock);
    g.userData = { nock, str, zs, half };
    return g;
  }
  let bowObj = null, on = false, cd = 0, kick = 0, drawing = false, drawT = 0, mouseL = false;
  const arrows = [], _w = new V(), _o = new V(), _d = new V(), ndc = { x: 0, y: 0, ok: false };
  addEventListener('mousedown', e => { if (e.button === 0) mouseL = true; }); addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; });

  // прицел: точка над головой игрока (проекция на экран); стрела летит по лучу камеры через эту точку
  const crosshair = document.createElement('div');
  crosshair.style.cssText = 'position:fixed;left:50%;top:40%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.65);pointer-events:none;display:none;z-index:30';
  const ring = document.createElement('div'); ring.style.cssText = 'position:absolute;left:-12px;top:-12px;width:30px;height:30px;border:2px solid rgba(255,255,255,.8);border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.45)'; crosshair.appendChild(ring);
  document.body.appendChild(crosshair);
  const power = () => Math.max(0.2, Math.min(1, drawT / 0.9));

  function show(fig, vis) {
    if (!bowObj) { bowObj = makeBowModel(); bowObj.visible = false; scene.add(bowObj); }
    bowObj.visible = !!vis; crosshair.style.display = vis ? 'block' : 'none'; ndc.ok = false;
    if (!vis) return;
    const wrist = fig.getObjectByName('WristL'), G = getG(), cam = getCam(); if (!wrist || !G) { bowObj.visible = false; return; }
    wrist.getWorldPosition(_w); const yaw = G.P.yawVis ?? G.P.yaw, pw = drawing ? power() : 0;
    bowObj.position.copy(_w); bowObj.position.x += Math.sin(yaw) * 0.9; bowObj.position.z += Math.cos(yaw) * 0.9;
    bowObj.rotation.set(0, yaw, 0); bowObj.scale.setScalar(1 + kick * 0.08);
    const u = bowObj.userData, back = 1.6 * pw;                         // при натяжении тетива и стрела уходят назад
    u.str.position.z = u.zs - back; u.nock.position.z = u.zs + 2.2 - back; u.nock.visible = cd <= 0.05 || drawing;
    ring.style.transform = `scale(${1.5 - 0.5 * pw})`;
    const head = fig.getObjectByName('Head'); (head || fig).getWorldPosition(_o); _o.y += 3.5;                   // точка над головой → на экран
    if (cam) { _d.copy(_o).project(cam); if (_d.z < 1 && Math.abs(_d.x) < 1.2 && Math.abs(_d.y) < 1.2) { ndc.x = _d.x; ndc.y = _d.y; ndc.ok = true; crosshair.style.left = ((ndc.x + 1) / 2 * 100) + '%'; crosshair.style.top = ((1 - ndc.y) / 2 * 100) + '%'; } }
    if (!ndc.ok) { crosshair.style.left = '50%'; crosshair.style.top = '45%'; }
  }

  function fire(pw) {
    const G = getG(), cam = getCam(); if (!G || !cam) return false;
    const P = G.P; cd = 0.35; kick = 1;
    cam.updateMatrixWorld(true);
    const aimDir = ndc.ok ? new V(ndc.x, ndc.y, 0.5).unproject(cam).sub(cam.position).normalize() : cam.getWorldDirection(new V());
    const aim = new V().copy(cam.position).addScaledVector(aimDir, 90);
    _o.set(P.pos.x, P.pos.y + 6.4, P.pos.z);
    const dir = aim.sub(_o).normalize();
    _o.addScaledVector(dir, 2.2);
    P.yaw = Math.atan2(dir.x, dir.z);
    spawn(_o, dir, 50 + 90 * pw, false, 6 + 10 * pw); window.__snd && window.__snd('shoot', 0.6 + 0.5 * pw);
    return true;
  }
  function spawn(origin, dir, speed, hostile, dmg = 12) {
    const a = makeArrow(hostile); a.position.copy(origin); scene.add(a);
    arrows.push({ g: a, v: dir.clone().multiplyScalar(speed), life: 5, stuck: 0, prev: origin.clone(), hostile, dmg });
  }
  function begin() { if (cd > 0 || drawing) return false; drawing = true; drawT = 0; window.__snd && window.__snd('draw'); return true; }       // нажали — натягиваем; выстрел при отпускании

  const solidHit = (G, p) => { for (const b of G.solids) if (p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z) return true; return false; };
  const MAX_STUCK = 120;
  const drop = a => { a.g.parent && a.g.parent.remove(a.g); };
  function stick(a, parent, life) {
    a.stuck = life; a.v.set(0, 0, 0); window.__snd && window.__snd('arrowhit', 0.7);
    if (parent) parent.attach(a.g);
    const st = arrows.filter(q => q.stuck > 0); if (st.length > MAX_STUCK) { const old = st[0]; drop(old); arrows.splice(arrows.indexOf(old), 1); }
  }

  function tick(dt) {
    cd = Math.max(0, cd - dt); kick = Math.max(0, kick - dt * 5);
    const G = getG(); if (!G) return;
    if (drawing) {                                                         // идёт натяжение: выстрел, когда кнопку отпустили
      drawT += dt;
      const held = mouseL || G.kd.has('KeyJ');
      if (!on || (!held && drawT > 0.06) || drawT > 8) { const pw = power(); drawing = false; if (on) fire(pw); drawT = 0; }
    }
    const P = G.P, blocking = ['block', 'parry', 'bash'].includes(P.state), fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      if (a.stuck > 0) { a.stuck -= dt; if (a.stuck <= 0) { drop(a); arrows.splice(i, 1); } continue; }
      a.life -= dt; if (a.life <= 0) { drop(a); arrows.splice(i, 1); continue; }
      a.prev.copy(a.g.position); a.v.y -= 16 * dt; a.g.position.addScaledVector(a.v, dt);
      a.g.lookAt(_o.copy(a.g.position).add(a.v));
      const p = a.g.position;
      if (a.hostile) {                                                       // стрела турели: щит отбивает, иначе толкает (без урона)
        const dx = p.x - P.pos.x, dz = p.z - P.pos.z;
        if (dx * dx + dz * dz < 2.8 * 2.8 && p.y > P.pos.y && p.y < P.pos.y + 9.5) {
          const sp = a.v.length() || 1, vx = a.v.x / sp, vz = a.v.z / sp, front = -(vx * fx + vz * fz);
          if (blocking && front > 0.2) { a.v.multiplyScalar(-0.5); a.v.y += 8; a.hostile = false; window.__snd && window.__snd('clang'); training && training.float && training.float(p.clone().setY(P.pos.y + 7), 'отбито!', '#8fd6ff'); }
          else { training && training.knockPlayer && training.knockPlayer(vx, vz, 20); training && training.float && training.float(p.clone().setY(P.pos.y + 8), 'попал!', '#ff8a6a'); drop(a); arrows.splice(i, 1); }
          continue;
        }
      } else {
        const it = training && training.hitArrow ? training.hitArrow(a.prev, p, a.dmg) : null;
        if (it) { a.g.position.addScaledVector(a.v.clone().normalize(), 0.6); stick(a, it.stick, 90); continue; }
        let hitE = null; for (const e of G.enemies || []) { if (e.state === 'dead') continue; const dx = e.g.position.x - p.x, dz = e.g.position.z - p.z; if (dx * dx + dz * dz < 2.6 * 2.6 && p.y > e.g.position.y && p.y < e.g.position.y + 9) { hitE = e; break; } }
        if (hitE) { G.damageEnemy && G.damageEnemy(hitE, a.dmg + 2, a.v.clone().setY(0).normalize(), 6, 0.3); stick(a, hitE.g, 8); continue; }
      }
      if (p.y < hAt(p.x, p.z) + 0.2 || solidHit(G, p)) { a.g.position.addScaledVector(a.v.clone().normalize(), -0.3); stick(a, null, 90); }
    }
  }
  return { get on() { return on; }, get drawing() { return drawing; }, set(v, fig) { on = !!v; if (!on) drawing = false; if (fig) show(fig, on); }, show, begin, spawn, tick };
}
