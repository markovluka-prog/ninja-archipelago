// training.js — тренировочная площадка в городе: соломенные чучела («чурбаны») с полосой жизней, которые крутятся от удара,
// и круглые мишени для лука. Площадка — ровный деревянный настил, ищется рядом с «Городом короля» (свободное плоское место).
// Попадания: ближний бой — hitMelee (вызывается из meleeHits Ричарда), стрелы — hitArrow (из bow.js).
export function createTraining({ THREE, scene, world, solids, anchor }) {
  const V = THREE.Vector3, hAt = (x, z) => world.heightAt(x, z);
  const HALF_X = 40, HALF_Z = 13;                                   // половина размера настила (80×26: чучела с большим шагом; к югу от него — длинные дорожки для лука)
  // ───── поиск места: ровное, не вода, ничего твёрдого ─────
  const flatOk = (cx, cz, tol) => {
    let lo = 1e9, hi = -1e9;
    for (let i = -4; i <= 4; i++) for (let j = -1; j <= 1; j++) {
      const x = cx + i * HALF_X / 4, z = cz + j * HALF_Z, h = hAt(x, z);
      if (h < 0.9 || (world.lakeAt && world.lakeAt(x, z)) || (world.blockedAt && world.blockedAt(x, z, 3))) return null;
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    return hi - lo < tol ? { lo, hi } : null;
  };
  let site = null;
  const ax = anchor.x, az = anchor.z;
  search: for (const tol of [1.2, 1.6]) for (let r = 0; r <= 420; r += 12) for (let k = 0; k < (r ? 20 : 1); k++) {
    const a = k / 20 * Math.PI * 2, cx = ax + Math.cos(a) * r, cz = az + Math.sin(a) * r, f = flatOk(cx, cz, tol);
    if (f) { site = { x: cx, z: cz, y: f.hi + 0.25 }; break search; }
  }
  if (!site) return { tick() {}, hitMelee: () => false, hitArrow: () => null, setBow() {}, float() {}, knockPlayer() {}, site: null };

  const root = new THREE.Group(); root.position.set(site.x, site.y, site.z); scene.add(root);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
  const M = { wood: mat(0x8a5a30), woodD: mat(0x5a3a1c), plank: mat(0xb98550), straw: mat(0xd8b45a), rope: mat(0xc8a96a), red: mat(0xb02a22), white: mat(0xf1ece0), gold: mat(0xd9a92b), iron: mat(0x3b3a38, { metalness: 0.4, roughness: 0.5 }) };
  const add = (p, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; p.add(o); return o; };

  // настил: доски, опоры (уходят в землю), бортик из столбиков, два флага
  add(root, new THREE.BoxGeometry(HALF_X * 2, 40, HALF_Z * 2), M.plank, 0, -20 + 0.0, 0);          // верхняя грань на y=0 (корень стоит на высоте настила)
  for (let x = -HALF_X; x <= HALF_X; x += 4) for (const z of [-HALF_Z, HALF_Z]) add(root, new THREE.CylinderGeometry(0.35, 0.4, 2.2, 6), M.woodD, x, 1.1, z);
  for (let z = -HALF_Z; z <= HALF_Z; z += 4) for (const x of [-HALF_X, HALF_X]) add(root, new THREE.CylinderGeometry(0.35, 0.4, 2.2, 6), M.woodD, x, 1.1, z);
  for (const sx of [-1, 1]) { add(root, new THREE.CylinderGeometry(0.2, 0.25, 16, 6), M.woodD, sx * (HALF_X - 1), 8, -HALF_Z + 1); add(root, new THREE.BoxGeometry(4.5, 2.6, 0.12), sx < 0 ? M.red : M.gold, sx * (HALF_X - 1) + 2.4 * sx, 14.4, -HALF_Z + 1); }
  // табличка
  add(root, new THREE.CylinderGeometry(0.2, 0.2, 6, 6), M.woodD, 0, 3, HALF_Z - 1.5);
  { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#b98550'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#5a3a1c'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 90); g.fillStyle = '#3a2412'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('ТРЕНИРОВКА', 128, 42); g.font = '22px sans-serif'; g.fillText('чучела и мишени', 128, 74);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sg = add(root, new THREE.BoxGeometry(7, 2.6, 0.25), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), 0, 6.6, HALF_Z - 1.5); sg.rotation.y = 0; }

  // твёрдый настил (шагать можно: он выше земли не более 1.5)
  const box = (x0, x1, y0, y1, z0, z1) => ({ min: new V(x0, y0, z0), max: new V(x1, y1, z1), grab: false });
  solids.push(box(site.x - HALF_X, site.x + HALF_X, site.y - 40, site.y, site.z - HALF_Z, site.z + HALF_Z));

  // ───── чучела ─────
  const items = [], texts = [], knock = { t: 0, x: 0, z: 0 };
  const hpBar = () => {
    const g = new THREE.Group(), bg = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.7, depthTest: false })), geo = new THREE.PlaneGeometry(3.8, 0.34); geo.translate(1.9, 0, 0);
    const fg = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x4fd25a, depthTest: false })); fg.position.set(-1.9, 0, 0.01); bg.renderOrder = 998; fg.renderOrder = 999; g.add(bg, fg); g.userData.fg = fg; return g;
  };
  function makeDummy(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    add(g, new THREE.CylinderGeometry(2.2, 2.6, 0.5, 10), M.woodD, 0, 0.25, 0);                      // основание (не вращается)
    const spin = new THREE.Group(); g.add(spin);
    add(spin, new THREE.CylinderGeometry(0.5, 0.55, 9.4, 8), M.wood, 0, 4.9, 0);                      // столб
    add(spin, new THREE.BoxGeometry(5.6, 0.55, 0.55), M.wood, 0, 6.6, 0);                             // руки
    const body = add(spin, new THREE.CylinderGeometry(1.5, 1.8, 3.6, 10), M.straw, 0, 5.1, 0);        // соломенное тело
    add(spin, new THREE.TorusGeometry(1.65, 0.12, 6, 14), M.rope, 0, 5.9, 0).rotation.x = Math.PI / 2;
    add(spin, new THREE.TorusGeometry(1.75, 0.12, 6, 14), M.rope, 0, 4.2, 0).rotation.x = Math.PI / 2;
    add(spin, new THREE.SphereGeometry(1.15, 12, 10), M.straw, 0, 8.3, 0);                           // голова
    add(spin, new THREE.BoxGeometry(0.5, 0.18, 0.1), M.red, 0, 8.4, 1.1);                            // «глаза»-метка спереди (видно вращение)
    add(spin, new THREE.ConeGeometry(1.0, 1.1, 10), M.woodD, 0, 9.55, 0);                             // колпак
    add(spin, new THREE.BoxGeometry(1.2, 1.2, 0.2), M.red, 0, 5.5, 1.62);                             // мишень-метка на груди
    const bar = hpBar(); bar.position.set(0, 11.4, 0); g.add(bar);
    const it = { kind: 'dummy', stick: spin, g, spin, bar, body, x: site.x + x, z: site.z + z, r: 2.2, h: 10, hp: 100, maxHp: 100, av: 0, flash: 0, fall: 0, down: 0, mats: [] };
    spin.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); it.mats.push(o.material); } });
    world.addFlam && world.addFlam({ x: it.x, z: it.z, y: site.y, h: 10, r: 2.2, k: 'plant' });      // чучело горит от пламени дракона
    items.push(it); solids.push(box(it.x - 1.4, it.x + 1.4, site.y, site.y + 10, it.z - 1.4, it.z + 1.4));
    return it;
  }
  // ───── мишени ─────
  function makeTarget(x, z, yaw, gy = 0) {
    const g = new THREE.Group(); g.position.set(x, gy, z); g.rotation.y = yaw; root.add(g);
    for (const sx of [-1, 1]) add(g, new THREE.CylinderGeometry(0.25, 0.3, 8, 6), M.wood, sx * 2.4, 4, -0.9).rotation.z = -sx * 0.12;
    add(g, new THREE.BoxGeometry(5.4, 0.4, 0.4), M.wood, 0, 3.0, -0.6);
    const pivot = new THREE.Group(); pivot.position.set(0, 7.1, 0); g.add(pivot);
    const rings = [[3.6, M.white], [3.0, M.red], [2.3, M.white], [1.6, M.red], [0.85, M.gold]], mats = [];
    rings.forEach(([r, m], i) => { const d = add(pivot, new THREE.CylinderGeometry(r, r, 0.35 + i * 0.03, 24), m.clone(), 0, 0, 0.02 * i); d.rotation.x = Math.PI / 2; mats.push(d.material); });
    const wx = site.x + x, wz = site.z + z;
    const it = { kind: 'target', stick: pivot, g, pivot, mats, x: wx, z: wz, cy: site.y + gy + 7.1, r: 3.7, av: 0, ang: 0, flash: 0, hits: 0, mats0: mats.map(m => m.color.clone()) };
    world.addFlam && world.addFlam({ x: wx, z: wz, y: site.y + gy, h: 8, r: 3, k: 'plant' });      // мишень тоже горит
    items.push(it); solids.push(box(wx - 1.2, wx + 1.2, site.y + gy - 1, site.y + gy + 8, wz - 2.9, wz + 2.9));
    return it;
  }
  // чучела в ряд: шаг 13.5 = 1.5 роста игрока (рост 9)
  for (let i = 0; i < 5; i++) makeDummy((i - 2) * 13.5, 0);
  // дорожки для лука: 4 дорожки по 14 в ширину, идут на юг от настила; на каждой своя мишень на разной дистанции (если дорожка упирается в препятствие — мишень ближе)
  const LANES = [-21, -7, 7, 21], DIST = [50, 80, 110, 140], plank = new THREE.BoxGeometry(8, 0.12, 5.6);
  LANES.forEach((lx, li) => {
    let free = 0; const z0 = HALF_Z + 2;
    for (let d = 4; d <= DIST[li] + 8; d += 4) { const wx = site.x + lx, wz = site.z + z0 + d; if (hAt(wx, wz) < 0.8 || (world.lakeAt && world.lakeAt(wx, wz)) || (world.blockedAt && world.blockedAt(wx, wz, 3))) break; free = d; }
    const L = Math.min(DIST[li], free - 4); if (L < 24) return;
    for (let d = 0; d <= L; d += 6) add(root, plank, (Math.floor(d / 6) % 2) ? M.plank : M.wood, lx, hAt(site.x + lx, site.z + z0 + d) - site.y + 0.06, z0 + d);
    add(root, new THREE.BoxGeometry(8.4, 0.2, 0.7), M.red, lx, 0.14, z0 - 1);                                  // линия стрельбы
    for (let d = 30; d <= L; d += 30) for (const sx of [-1, 1]) add(root, new THREE.CylinderGeometry(0.18, 0.2, 2.4, 6), M.woodD, lx + sx * 4.4, hAt(site.x + lx, site.z + z0 + d) - site.y + 1.2, z0 + d);   // вешки каждые 30
    const tz = z0 + L, gy = hAt(site.x + lx, site.z + tz) - site.y; makeTarget(lx, tz, Math.PI, gy);
  });
  // ───── стрелковые турели: стоят по краям настила, предупреждают («!», красная вспышка) и стреляют в игрока, пока он на настиле. Щит (блок/парирование) отбивает стрелу ─────
  const turrets = []; let bowRef = null;
  function makeTurret(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    add(g, new THREE.CylinderGeometry(1.4, 1.8, 0.6, 8), M.woodD, 0, 0.3, 0);
    add(g, new THREE.CylinderGeometry(0.5, 0.6, 4.4, 8), M.wood, 0, 2.7, 0);
    const head = new THREE.Group(); head.position.set(0, 5.2, 0); g.add(head);
    const hm = add(head, new THREE.BoxGeometry(1.6, 1.3, 2.4), M.iron.clone(), 0, 0, 0.3);
    add(head, new THREE.BoxGeometry(4.2, 0.35, 0.5), M.wood, 0, 0.1, 1.2);                       // дуга арбалета
    add(head, new THREE.CylinderGeometry(0.08, 0.08, 3.2, 5), M.rope, 0, 0.1, 0.4).rotation.z = Math.PI / 2;
    const it = { g, head, hm, x: site.x + x, z: site.z + z, cd: 2 + Math.random() * 2, wind: 0 };
    turrets.push(it); return it;
  }
  makeTurret(-HALF_X + 3, -HALF_Z + 4); makeTurret(HALF_X - 3, -HALF_Z + 4);
  // ───── рычаг: включает и выключает турели (E рядом) ─────
  let turretsOn = true, leverA = -0.7, nearLever = false, lastP = null;
  const lever = new THREE.Group(); lever.position.set(-HALF_X + 8, 0, -HALF_Z + 4); root.add(lever);
  add(lever, new THREE.BoxGeometry(2.2, 1.4, 1.4), M.woodD, 0, 0.7, 0);
  add(lever, new THREE.BoxGeometry(1.6, 0.25, 1.0), M.iron, 0, 1.45, 0);
  const leverArm = new THREE.Group(); leverArm.position.set(0, 1.5, 0); lever.add(leverArm);
  add(leverArm, new THREE.CylinderGeometry(0.13, 0.13, 3.0, 6), M.iron, 0, 1.5, 0); add(leverArm, new THREE.SphereGeometry(0.4, 10, 8), M.red, 0, 3.1, 0);
  const lampM = new THREE.MeshStandardMaterial({ color: 0x3ddc4a, emissive: 0x28b030, emissiveIntensity: 1.2 }); add(lever, new THREE.SphereGeometry(0.32, 10, 8), lampM, 0, 1.0, 0.78);
  { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#5a3a1c'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#d9a92b'; g.lineWidth = 6; g.strokeRect(4, 4, 248, 88); g.fillStyle = '#f1ece0'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('ТУРЕЛИ', 128, 44); g.font = 'bold 26px sans-serif'; g.fillText('рычаг: вкл / выкл', 128, 76);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })); sg.position.set(0, 3.0, -0.8); sg.rotation.y = Math.PI; lever.add(sg);
    add(lever, new THREE.CylinderGeometry(0.1, 0.1, 2.4, 5), M.woodD, 0, 1.8, -0.8); }
  const leverPrompt = document.createElement('div');
  leverPrompt.style.cssText = 'position:fixed;left:50%;bottom:26%;transform:translateX(-50%);font:600 15px -apple-system,Segoe UI,sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:6px 14px;border-radius:10px;pointer-events:none;display:none;z-index:15';
  document.body.appendChild(leverPrompt);
  addEventListener('keydown', e => {
    if (e.code !== 'KeyE' || e.repeat || !nearLever || /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) return;
    turretsOn = !turretsOn; floatText(new V(site.x + lever.position.x, site.y + 6, site.z + lever.position.z), turretsOn ? 'турели ВКЛ' : 'турели ВЫКЛ', turretsOn ? '#8fe86a' : '#ff8a6a');
  });
  function leverTick(dt, P) {
    leverA += ((turretsOn ? -0.7 : 0.7) - leverA) * Math.min(1, dt * 8); leverArm.rotation.z = leverA;
    lampM.color.setHex(turretsOn ? 0x3ddc4a : 0xdc3a2a); lampM.emissive.setHex(turretsOn ? 0x28b030 : 0xb02418);
    nearLever = !!P && !window.__riding && Math.hypot(P.pos.x - (site.x + lever.position.x), P.pos.z - (site.z + lever.position.z)) < 5 && Math.abs(P.pos.y - site.y) < 6 && !P.dead;
    window.__leverNear = nearLever; leverPrompt.style.display = nearLever ? 'block' : 'none';
    if (nearLever) leverPrompt.textContent = `E — рычаг: ${turretsOn ? 'выключить' : 'включить'} турели`;
  }
  function turretTick(dt, P) {
    leverTick(dt, P);
    for (const t of turrets) {
      t.head.rotation.x += ((turretsOn ? 0 : 0.5) - t.head.rotation.x) * Math.min(1, dt * 4);      // выключенная турель «опускает голову»
      if (!turretsOn) { t.wind = 0; t.cd = Math.max(t.cd, 2); t.hm.material.emissive && t.hm.material.emissive.setRGB(0, 0, 0); continue; }
      const dx = P.pos.x - t.x, dz = P.pos.z - t.z, d = Math.hypot(dx, dz);
      const inPlaza = Math.abs(P.pos.x - site.x) < HALF_X + 6 && Math.abs(P.pos.z - site.z) < HALF_Z + 4 && Math.abs(P.pos.y - site.y) < 8;
      if (inPlaza && d > 6) { const ang = Math.atan2(dx, dz), diff = Math.atan2(Math.sin(ang - t.head.rotation.y), Math.cos(ang - t.head.rotation.y)); t.head.rotation.y += diff * Math.min(1, dt * 5); }      // плавно наводится на игрока
      if (!inPlaza || d < 6) { t.wind = 0; t.cd = Math.max(t.cd, 1.2); } else if (t.wind > 0) {
        t.wind -= dt; const e = 0.4 + 0.4 * Math.sin(t.wind * 30); t.hm.material.emissive && t.hm.material.emissive.setRGB(e, 0.05, 0);
        if (t.wind <= 0) {
          t.hm.material.emissive && t.hm.material.emissive.setRGB(0, 0, 0); t.cd = 3 + Math.random() * 1.5;
          if (bowRef) { const o = new V(t.x, site.y + 5.2, t.z), dir = new V(P.pos.x, P.pos.y + 5, P.pos.z).sub(o).normalize(); o.addScaledVector(dir, 3); bowRef.spawn(o, dir, 75, true); if (window.__snd && Math.hypot(P.pos.x - t.x, P.pos.z - t.z) < 160) window.__snd('shoot', 0.5); }
        }
      } else { t.cd -= dt; if (t.cd <= 0) { t.wind = 0.85; floatText(new V(t.x, site.y + 9, t.z), '!', '#ff4a3a'); } }
    }
  }

  // ───── попадания ─────
  function floatText(pos, txt, color = '#fff') {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(txt, 64, 46); g.fillStyle = color; g.fillText(txt, 64, 46);
    const t = new THREE.CanvasTexture(c), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(4.5, 2.25, 1); sp.position.copy(pos); sp.renderOrder = 1000; scene.add(sp); texts.push({ sp, t: 0 });
  }
  function apply(it, dmg, fromX, fromZ, hitY) {
    const side = Math.sign((it.x - fromX) * Math.cos(it.g.rotation.y) - (it.z - fromZ) * Math.sin(it.g.rotation.y)) || 1;
    it.flash = 0.2;
    if (it.kind === 'dummy') {
      if (it.down > 0) return;
      it.hp = Math.max(0, it.hp - dmg); it.av += (Math.random() < 0.5 ? -1 : 1) * (12 + dmg * 0.8) * (0.8 + Math.random() * 0.4);      // крутится сильнее при сильном ударе
      floatText(new V(it.x, site.y + 12, it.z), '-' + Math.round(dmg), '#ffd24a'); window.__snd && window.__snd('thunk', 1);
      if (it.hp <= 0) { it.down = 3.2; it.fall = 0; floatText(new V(it.x, site.y + 14, it.z), 'сломано!', '#ff7a5a'); }
      else if (!(it.wind > 0) && !(it.swing > 0)) { it.wind = 0.65; floatText(new V(it.x, site.y + 14.5, it.z), '!', '#ff4a3a'); }      // предупреждение: чучело «замахивается» — успейте отойти
    } else { window.__snd && window.__snd('ping', 1); it.hits++; it.av += side * (3 + dmg * 0.15); floatText(new V(it.x, site.y + 10, it.z), String(it.hits), '#9be86a'); }
  }
  return {
    site,
    setBow(b) { bowRef = b; },
    float: (pos, txt, color) => floatText(pos, txt, color),
    knockPlayer(nx, nz, power) { knock.x = nx * power; knock.z = nz * power; knock.t = 0.3; },
    hitMelee(P, f, reachR, cosArc, dmg, push, set) {
      let any = false;
      for (const it of items) {
        if (set.has(it)) continue;
        const dx = it.x - P.pos.x, dz = it.z - P.pos.z, d = Math.hypot(dx, dz) - it.r * 0.6;
        if (d > reachR || Math.abs(site.y - P.pos.y) > 8) continue;
        if (d > 0.5 && (f.x * dx + f.z * dz) / (Math.hypot(dx, dz) || 1) < cosArc) continue;
        set.add(it); any = true; apply(it, dmg, P.pos.x, P.pos.z, P.pos.y);
      }
      return any;
    },
    hitArrow(p0, p1, dmg = 12) {
      for (const it of items) {
        const cy = it.kind === 'target' ? it.cy : site.y + 5;
        for (let k = 0; k <= 4; k++) {
          const t = k / 4, x = p0.x + (p1.x - p0.x) * t, y = p0.y + (p1.y - p0.y) * t, z = p0.z + (p1.z - p0.z) * t;
          const dx = x - it.x, dz = z - it.z;
          const hit = it.kind === 'target' ? (dx * dx + dz * dz < 4.4 * 4.4 && Math.abs(y - cy) < it.r) : (dx * dx + dz * dz < 2.3 * 2.3 && y > site.y && y < site.y + it.h);
          if (hit) { apply(it, dmg, p0.x, p0.z, y); return it; }
        }
      }
      return null;
    },
    tick(dt, camPos, P) {
      if (P && !texts.length && Math.hypot(P.pos.x - site.x, P.pos.z - site.z) > 300) return;      // площадка далеко — её чучела, турели и рычаг не считаем
      if (P) turretTick(dt, P);
      // ответный удар чучела: сначала предупреждение (трясётся и краснеет, над ним «!»), потом резкий разворот «руками» — отталкивает, если игрок рядом (урона нет)
      for (const it of items) {
        if (it.kind !== 'dummy') continue;
        if (it.down > 0) { it.wind = 0; it.swing = 0; continue; }
        if (it.wind > 0) { it.wind -= dt; it.spin.rotation.x = Math.sin(it.wind * 60) * 0.06; it.spin.rotation.z = Math.cos(it.wind * 47) * 0.05; if (it.wind <= 0) { it.spin.rotation.x = it.spin.rotation.z = 0; it.swing = 0.45; it.hitDone = false; it.av += (it.av < 0 ? -1 : 1) * 20; } }
        else if (it.swing > 0) it.swing -= dt;
      }
      if (P) {
        if (knock.t > 0) { knock.t -= dt; const k = Math.max(0, knock.t / 0.28); P.vel.x = knock.x * k; P.vel.z = knock.z * k; }
        for (const it of items) {
          if (it.kind !== 'dummy' || !(it.swing > 0) || it.hitDone) continue;
          const dx = P.pos.x - it.x, dz = P.pos.z - it.z, d = Math.hypot(dx, dz);
          if (d < 4.6 && P.pos.y > site.y - 1 && P.pos.y < site.y + 8) {
            const nx = dx / (d || 1), nz = dz / (d || 1); knock.x = nx * 26; knock.z = nz * 26; knock.t = 0.3; it.hitDone = true;
            P.vel.y = Math.max(P.vel.y, 6); floatText(new V(P.pos.x, P.pos.y + 11, P.pos.z), 'оп!', '#ffffff');
          }
        }
      }
      for (const it of items) {
        it.flash = Math.max(0, it.flash - dt);
        if (it.kind === 'dummy') {
          it.spin.rotation.y += it.av * dt; it.av *= Math.exp(-2.1 * dt);
          if (it.down > 0) { it.down -= dt; it.fall = Math.min(1, it.fall + dt * 3); if (it.down <= 0) { it.hp = it.maxHp; } }
          else it.fall = Math.max(0, it.fall - dt * 2);
          it.g.rotation.x = -it.fall * 1.45;                         // сломанное чучело падает
          const k = it.hp / it.maxHp; it.bar.userData.fg.scale.x = Math.max(0.001, k); it.bar.userData.fg.material.color.setHSL(0.33 * k, 0.75, 0.5);
          it.bar.visible = it.fall < 0.3; if (camPos) it.bar.lookAt(camPos.x, it.bar.getWorldPosition(new V()).y, camPos.z);
          const e = it.flash > 0 ? 0.6 : (it.wind > 0 ? 0.35 + 0.3 * Math.sin(it.wind * 40) : 0); for (const m of it.mats) { if (m.emissive) m.emissive.setRGB(e, e * 0.25, 0); }
        } else {
          it.ang += it.av * dt; it.av += (-it.ang * 60 - it.av * 5) * dt;                          // качается на пружине
          it.pivot.rotation.x = it.ang * 0.4; it.pivot.rotation.z = it.ang * 0.15;
          it.mats.forEach((m, i) => { if (m.emissive) m.emissive.setRGB(it.flash > 0 ? 0.5 : 0, it.flash > 0 ? 0.4 : 0, 0); });
        }
      }
      for (let i = texts.length - 1; i >= 0; i--) { const q = texts[i]; q.t += dt; q.sp.position.y += dt * 5; q.sp.material.opacity = Math.max(0, 1 - q.t / 1.1); if (q.t > 1.1) { scene.remove(q.sp); q.sp.material.map.dispose(); q.sp.material.dispose(); texts.splice(i, 1); } }
    },
  };
}
