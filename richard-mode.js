// richard-mode.js — режим прогулки: настоящий игровой Ричард из Ричард/3D/richard.html (?game),
// со всем его управлением (бег, прыжок, подтягивание, лазание, скольжение, перекат, планирование, плавание, бой, блок…),
// но на рельефе архипелага: земля = heightAt(), постройки = прямоугольные «коробки» (на крыши можно залезть), море = плавание.
// Как это сделано: берём inline-модуль richard.html, подменяем renderer/scene/camera на наши и правим несколько мест кода.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

import { makeHousePlanner } from './house-collision.js';
import { createTraining } from './training.js';
import { createBow } from './bow.js';

const DRESS = {};      // имя героя → dress(фигура, {THREE, RoundedBoxGeometry}); файлы лежат в chars/<имя>.js
export async function loadRichard({ renderer, scene, camera, world, url, start }) {
  for (const n of ['ben', 'zantio', 'zhenshi']) { try { DRESS[n] = (await import(`./chars/${n}.js`)).dress; } catch (e) { console.warn('нет одевалки героя', n, e.message); } }
  const html = await (await fetch(url)).text();
  const m = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].pop();
  const bodyHtml = (html.match(/<body[^>]*>([\s\S]*?)<script/) || [, ''])[1];
  let code = m[1].replace(/^\s*import\s[^;\n]*;?\s*$/gm, '');

  const miss = [];
  const rep = (re, to) => { const before = code; code = typeof re === 'string' ? code.split(re).join(to) : code.replace(re, to); if (code === before) miss.push(String(re).slice(0, 70)); };

  /* — уровень-шаблон убираем, землёй станет рельеф — */
  rep(/\/\/ пол: плиты[\s\S]*?(?=\/\* ─+ предметы исследования)/, 'const WATER_Y = 0; const GATE = mkBox(0, 1, -9000, -8999, 0, 1, 0, {nocol:true});\n');
  /* — «предметы исследования» (монеты, сундук, рычаг, реликвия, указатель) убираем: на карте просто гуляем — */
  rep(/\/\* ─+ предметы исследования[\s\S]*?(?=\/\* ─+ игрок)/, `const chest = {g:new THREE.Group(), lid:new THREE.Group(), open:0, target:0};
const lever = {g:new THREE.Group(), h:new THREE.Group(), on:false};
const relic = new THREE.Object3D();
`);
  rep('mkGuard(-6, 96); mkGuard(8, 104);', '');   // стражников тоже убираем: на карте никого убивать нельзя
  rep('g.position.set(x, 0, z);\n  const mO', 'g.position.set(x, __gh(x, z), z);\n  const mO');
  rep('spawn:new V3(x, 0, z)', 'spawn:new V3(x, __gh(x, z), z)');
  rep("if (e.state !== 'dead') g.position.y = 0;", "if (e.state !== 'dead') g.position.y = __gh(g.position.x, g.position.z);");
  /* — физика: рельеф + море — */
  rep(/function groundAt\(x, z, y, tol\)\{\s*let best = -Infinity;/, 'function groundAt(x, z, y, tol){\n  let best = -Infinity; { const t = __gh(x, z); if (t <= y + tol) best = t; }');
  rep(/const inWater = \(\) => \{[^\n]*\n/, "const __W = {x0:-1e9, x1:1e9, z0:-1e9, z1:1e9, y:0}; const __onSolid = () => { for (const b of solids){ if (Math.abs(b.max.y - P.pos.y) < 0.9 && ovXZ(b, P.pos.x, P.pos.z, R*0.55)) return true; } return false; }; const inWater = () => (__gh(P.pos.x, P.pos.z) < (P.state === 'swim' ? -1.6 : -2.2) && !__onSolid()) ? __W : null;\n");   // стоим на твёрдом (палуба корабля, настил пирса над глубокой водой) — это не вода: раньше игра по глубине дна сразу переводила в плавание и «проваливала» сквозь палубу
  rep('vmax = (walk ? 6 : 13)*mul;', 'vmax = (walk ? 6 : 13)*mul*(P.speedMul || 1);');
  rep('const dt = Math.min((now - last)/1000, 0.05); last = now; acc += dt; let n = 0; while (acc >= H && n++ < 6){ gStep(H); acc -= H; }', 'const dt = Math.min((now - last)/1000, 0.25); last = now; acc += dt; let n = 0; while (acc >= H && n++ < 15){ gStep(H); acc -= H; }');      // раньше потолок 0.05 с/кадр: при <20 FPS физика шла медленнее реального времени (ходьба, плавание «в замедлении»)
  rep(/function stGround\(h\)\{\s*const mv = moveInput\(\);/, "function stGround(h){\n  { const w = inWater(); if (w){ P.swimW = w; setState('swim'); P.vel.multiplyScalar(0.2); return; } }\n  const mv = moveInput();");
  rep(/function stSwim\(h\)\{\s*const w = P.swimW,/, "function stSwim(h){\n  if (!inWater()){ P.pos.y = Math.max(P.pos.y, __gh(P.pos.x, P.pos.z) + 0.3); setState('air'); P.air = 0; P.hasJumped = false; return; }\n  const w = P.swimW,");
  /* — блок «просто стоит»: не разворачивается к ближайшему врагу и не меняет позу на «Парирование» при ударе — */
  rep("locomotion(h, mv, 0.3, false); const e = nearestEnemy(30); if (e) faceToward(e.g.position.clone().sub(P.pos), 10, h);\n  moveBody(h, P.hh, STEP);", "locomotion(h, mv, 0.3, false);\n  moveBody(h, P.hh, STEP);");
  rep("if (P.state !== 'parry'){ setState('parry'); setAnim('Парирование', {fade:0.04, loop:false, restart:true}); }", "");
  /* — режимы игры: игра отдаёт наружу playerHit и respawn; удар «другого игрока» — это фиктивный враг (remote), без стагера/состояний врагов — */
  rep("estate(e, 'stagger'); e.stunDur = 1.9; e.vel.addScaledVector(to, 9);", "if (!e.remote){ estate(e, 'stagger'); e.stunDur = 1.9; e.vel.addScaledVector(to, 9); }");
  rep("if (pressed.has('KeyR') && (P.dead || kd.has('ShiftLeft'))) respawn();", "if (pressed.has('KeyR') && !window.__gameLock && (P.dead || kd.has('ShiftLeft'))) respawn();");
  rep("if (pressed.has('KeyV') && sp > 8) return startSlide();", '');      // V теперь зовёт дракона — подкат убран
  rep('C — кувырок · V — подкат (на бегу)', 'C — кувырок');
  rep('camera.lookAt(camTgt.x, camTgt.y + 0.5, camTgt.z);', 'if (window.__camHook) window.__camHook(camera, camTgt); camera.lookAt(camTgt.x, camTgt.y + 0.5, camTgt.z);');      // дракон ставит камеру сам
  rep("addEventListener('mousedown', e => { if (document.pointerLockElement !== renderer.domElement) return;", "addEventListener('mousedown', e => { if (window.__dragonOn) return; if (document.pointerLockElement !== renderer.domElement) return;");      // ЛКМ на драконе — огонь, а не удар героя
  /* — ввод работает только пока режим включён — */
  rep("renderer.domElement.addEventListener('click', () => {", "renderer.domElement.addEventListener('click', () => { if (!window.__richardActive) return;");
  rep("addEventListener('keydown', e => { if (GK.has(e.code)){", "addEventListener('keydown', e => { if (!window.__richardActive || window.__riding) return; if (GK.has(e.code)){");
  rep("vmax = (walk ? 6 : 13)*mul", "vmax = (walk ? 21 : 13)*mul");   // Shift = ускорение (спринт)
  // лестницы шаблона обобщены: нормаль — любой единичный вектор в плоскости xz, лестница может двигаться (корабль); вход — и с суши, и из воды (W)
  rep(/function ladderNear\(\)\{[\s\S]*?\n\}\n/, `function ladderNear(){
  for (const l of ladders){
    const dx = P.pos.x - l.px, dz = P.pos.z - l.pz, d = dx*l.n.x + dz*l.n.z, tt = dx*(-l.n.z) + dz*l.n.x;
    if (Math.abs(tt) > l.hw + 1.6 || d < -2.2 || d > R + 4.6) continue; if (P.pos.y < l.bottom - 0.5 || P.pos.y > (P.state === 'swim' ? l.top + 0.5 : l.top - HANG_H + 0.5)) continue; return l; }
  return null;
}
`);
  rep(/function startLadder\(l\)\{[^\n]*\n/, `function startLadder(l){ P.lad = l; setState('ladder'); P.vel.set(0, 0, 0); P.yaw = Math.atan2(-l.n.x, -l.n.z);
  { const dx = P.pos.x - l.px, dz = P.pos.z - l.pz, tt = clamp(dx*(-l.n.z) + dz*l.n.x, -l.hw + 0.4, l.hw - 0.4); P.lt = tt; P.pos.x = l.px + l.n.x*1.4 - l.n.z*tt; P.pos.z = l.pz + l.n.z*1.4 + l.n.x*tt; }
  P.gliding = false; logEv('ladder'); }
`);
  rep(/function stLadder\(h\)\{[\s\S]*?\n\}\nfunction stAir/, `function stLadder(h){
  const l = P.lad, up = kd.has('KeyW') ? 1 : 0, dn = kd.has('KeyS') ? 1 : 0, dir = up - dn;
  P.pos.y += dir*7*h; setAnim('Лестница', {speed:dir ? dir*1.0 : 0});
  if (!dir && gA) gA.timeScale = 0;
  P.pos.x = l.px + l.n.x*1.4 - l.n.z*P.lt; P.pos.z = l.pz + l.n.z*1.4 + l.n.x*P.lt; P.yaw = Math.atan2(-l.n.x, -l.n.z);      // лестница может ехать вместе с кораблём
  if (P.pos.y <= l.bottom){ P.pos.y = l.bottom; if (dn){ P.lad = null; P.regrabL = 0.4; P.regrab = 0.4; setState('air'); P.air = 0; return; } }
  const topY = l.top - HANG_H; if (P.pos.y >= topY){ P.pos.y = topY; P.lad = null; startClimb({n:l.n, top:l.top, face:{x:l.px, z:l.pz}}, 'Подтягивание', 1.0); return; }
  if (buf.jump > 0){ buf.jump = 0; P.vel.set(l.n.x*13, 18, l.n.z*13); P.lad = null; P.regrab = 0.5; setState('air'); P.air = 0; P.hasJumped = true; P.jumpHeld = false; setAnim('Взлёт', {loop:false, restart:true}); }
}
function stAir`);
  rep("if (L.n.x) P.ce.x = L.face - L.n.x*1.9; else P.ce.z = L.face - L.n.z*1.9;", "if (L.face && L.face.x !== undefined){ P.ce.x = L.face.x - L.n.x*1.9; P.ce.z = L.face.z - L.n.z*1.9; } else if (L.n.x) P.ce.x = L.face - L.n.x*1.9; else P.ce.z = L.face - L.n.z*1.9;");
  rep('const w = P.swimW, mv = moveInput(); P.regrab -= h;', "const w = P.swimW, mv = moveInput(); P.regrab -= h; if (kd.has('KeyW') && P.regrab <= 0){ const l = ladderNear(); if (l && mv.x*-l.n.x + mv.z*-l.n.z > 0.5) return startLadder(l); }");
  // верховая езда: три клипа (посадка, посадка в седле, прыжок верхом) и «удержание» анимации снаружи (window.__forceAnim)
  rep('const GCLIP = {', `const RIDEP = {...G1, Spin:[0.1,0,0], Head:[-0.05,0,0], HipL:[-1.05,0,0.6], KneeL:[1.1,0,0], HipR:[-1.05,0,-0.6], KneeR:[1.1,0,0], ShoulderL:[-1.0,0,0.2], ElbowL:[-1.1,0,0], ShoulderR:[-1.0,0,-0.2], ElbowR:[-1.1,0,0]};
const GCLIP = {
  'ПлаваниеНаМесте': [1.6, cyc(8, 1.6, a => { const s = Math.sin(a), c = Math.cos(a);   // держится на воде вертикально: корпус прямо, ноги вниз, руки подгребают
    return {G:[0], Spin:[0.03,0,0], Head:[0,0.1*s,0], Torso:[0,0.08*s,0], ShoulderL:[-0.35 + 0.3*s,0,0.75 + 0.2*c], ElbowL:[-0.5,0,0], WristL:[0,0,0], ShoulderR:[-0.35 - 0.3*s,0,-0.75 - 0.2*c], ElbowR:[-0.5,0,0],
      HipL:[-0.18 + 0.3*Math.sin(a),0,0.08], KneeL:[0.35 + 0.35*Math.max(0, -Math.sin(a)),0,0], HipR:[-0.18 - 0.3*Math.sin(a),0,-0.08], KneeR:[0.35 + 0.35*Math.max(0, Math.sin(a)),0,0]}; }), {}],
  'Верхом': [1.0, [{t:0, ...RIDEP}, {t:0.5, ...RIDEP, Spin:[0.14,0,0]}, {t:1.0, ...RIDEP}]],
  'ВерхомПрыжок': [0.6, [{t:0, ...RIDEP, Spin:[0.5,0,0], Head:[-0.2,0,0], HipL:[-1.25,0,0.5], HipR:[-1.25,0,-0.5], KneeL:[1.4,0,0], KneeR:[1.4,0,0], ShoulderL:[-1.4,0,0.2], ShoulderR:[-1.4,0,-0.2]}, {t:0.6, ...RIDEP, Spin:[0.5,0,0], Head:[-0.2,0,0], HipL:[-1.25,0,0.5], HipR:[-1.25,0,-0.5], KneeL:[1.4,0,0], KneeR:[1.4,0,0], ShoulderL:[-1.4,0,0.2], ShoulderR:[-1.4,0,-0.2]}]],
  'Посадка': [1.1, [{t:0, ...G1}, {t:0.25, ease:'out', ...G1, Spin:[0.25,0.25,0], ShoulderL:[-1.7,0,0.3], ElbowL:[-0.5,0,0], ShoulderR:[-1.1,0,-0.2], HipR:[-1.6,0,-0.3], KneeR:[1.6,0,0], HipL:[-0.2,0,0.1], KneeL:[0.3,0,0]}, {t:0.6, ease:'inout', ...G1, Spin:[0.15,0,0], ShoulderL:[-1.3,0,0.4], ShoulderR:[-1.2,0,-0.4], HipR:[-0.5,0,-1.0], KneeR:[0.9,0,0], HipL:[-1.0,0,0.5], KneeL:[1.0,0,0]}, {t:1.1, ease:'out', ...RIDEP}]],`);
  rep("  'Верхом': [1.0,", `  'ВерхомУдар': [0.7, [{t:0, ...RIDEP}, {t:0.2, ease:'out', ...RIDEP, Spin:[0.1,-0.6,0], Torso:[0,-0.5,0], ShoulderL:[-2.5,0,0.6], ElbowL:[-0.5,0,0]}, {t:0.4, ease:'in', ...RIDEP, Spin:[0.25,0.7,0], Torso:[0,0.6,0], ShoulderL:[-1.3,0,-0.7], ElbowL:[-0.2,0,0]}, {t:0.7, ease:'inout', ...RIDEP}]],
  'Верхом': [1.0,`);      // удар мечом сидя в седле: ноги остаются как у «Верхом», работает только рука и корпус
  rep('function setAnim(name, o = {}){', "function setAnim(name, o = {}){\n  { const F = window.__forceAnim; if (F){ if (gName === F.name && actions[F.name]) return; name = F.name; o = F.o || {}; } }");
  // плывём на глубине тела, но не глубже дна: у крутого берега тело поднимается по склону дна (раньше ноги уходили под рельеф и Ричард проваливался)
  // мерцание штриховкой на стенах = «shadow acne» от тени ключевого света Ричарда: увеличиваем смещения тени
  rep('bottom:-34, near:1, far:120}); key.shadow.camera.updateProjectionMatrix();', 'bottom:-34, near:1, far:120}); key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -0.0012; key.shadow.normalBias = 0.14;');
  rep('const target = w.y - 5.6;', 'const target = Math.max(w.y - (Math.hypot(P.vel.x, P.vel.z) < 1.5 ? 6.8 : 5.6), __gh(P.pos.x, P.pos.z) + 0.25);');   // на месте — выше из воды: корпус вертикально, плечи у поверхности
  rep("setAnim('Плавание', {speed:0.5 + sp/6, fade:0.2});", "if (sp > 1.5) setAnim('Плавание', {speed:0.5 + sp/6, fade:0.2}); else setAnim('ПлаваниеНаМесте', {fade:0.3});");
  rep('window.__g = {P,', 'window.__g = {playerHit: (e, d) => playerHit(e, d), respawn: () => respawn(), ladders, ladderNear, kd, key, rim, figure, solids, groundAt, interactNear, CLIPS, animName: () => gName, animAct: () => gA, P,');
  /* — камера: после расчёта третьего лица даём шанс перейти на первое лицо (см. fpTick ниже) — */
  rep('camera.lookAt(camTgt.x, camTgt.y + 0.5, camTgt.z);', 'camera.lookAt(camTgt.x, camTgt.y + 0.5, camTgt.z); __fpCam(camera, camTgt, dt);');

  rep('return b && b.max.y - b.min.y >= 14 && b.max.y > P.pos.y + 7 ? {n, b} : null;', 'return b && !b.nowall && b.max.y - b.min.y >= 14 && b.max.y > P.pos.y + 7 ? {n, b} : null;');      // по городской стене нельзя лезть отталкиваясь от неё
  /* — новые приёмы: удар в воздухе и в планировании, второй прыжок в полёте, лук, попадания по тренировочным чучелам — */
  rep("function stAir(h){\n  const mv = moveInput(); P.air += h;", "function stAir(h){\n  airAtkTick(h);\n  const mv = moveInput(); P.air += h;");
  rep("setAnim(P.vel.y > 3 ? 'Взлёт' : 'Падение', {fade:0.12, loop:P.vel.y <= 3});", "if (!(P.aa > 0)) setAnim(P.vel.y > 3 ? 'Взлёт' : 'Падение', {fade:0.12, loop:P.vel.y <= 3});");
  rep("  // планирование\n  if (pressed.has('Space') && P.hasJumped && P.air > 0.2 && P.vel.y < 6){",
      "  // удар в прыжке и второй прыжок в полёте\n  if (pressed.has('KeyJ') && !(P.aa > 0)) airAttack();\n  if (pressed.has('Space') && P.hasJumped && !P.dj && P.air > 0.12){ P.dj = true; P.vel.y = 21; P.jumpHeld = true; setAnim('Взлёт', {loop:false, fade:0.04, restart:true}); burst(P.pos.clone().setY(P.pos.y + 0.3), 6, 'dust', 8, 3); logEv('doublejump'); return; }\n  // планирование (после второго прыжка)\n  if (pressed.has('Space') && P.hasJumped && P.dj && P.air > 0.2 && P.vel.y < 6){");
  rep("function stGlide(h){\n  const mv = moveInput(); P.air += h; curMeta = {wind:2.8};",
      "function stGlide(h){\n  airAtkTick(h); if (pressed.has('KeyJ') && !(P.aa > 0)) airAttack();\n  if (pressed.has('Space') && !P.dj){ P.dj = true; P.gliding = false; curMeta = {}; setState('air'); P.vel.y = 21; P.jumpHeld = true; setAnim('Взлёт', {loop:false, fade:0.04, restart:true}); burst(P.pos.clone().setY(P.pos.y + 0.3), 6, 'dust', 8, 3); logEv('doublejump'); return; }\n  const mv = moveInput(); P.air += h; curMeta = {wind:2.8};");
  rep("  setAnim('Планирование', {fade:0.15});", "  if (!(P.aa > 0)) setAnim('Планирование', {fade:0.15});");
  rep("function startJump(){", "function airAtkTick(h){ if (P.aa > 0){ P.aaT += h; P.aa -= h; if (P.aaT > 0.12 && P.aaT < 0.34) meleeHits(9.5, 0.2, 11, 8, 0); } }\nfunction airAttack(){\n  if (window.__bow){ window.__bowShoot && window.__bowShoot(); return; }\n  P.aa = 0.5; P.aaT = 0; P.atkHit = new Set(); const e = nearestEnemy(16); if (e) snapFaceTo(e.g.position.clone().sub(P.pos));\n  P.aaN = ((P.aaN || 0) + 1) % 3; setAnim(['Атака 1', 'Атака 2', 'Атака 3'][P.aaN], {fade:0.05, loop:false, restart:true}); logEv('airattack');\n}\nfunction startJump(){ P.dj = false;");
  rep("function onLand(){\n  const imp = P.fallV;", "function onLand(){\n  P.dj = false; P.aa = 0;\n  const imp = P.fallV;");
  rep("function setState(s){ if (s !== P.state)", "function setState(s){ if (s === 'ground' || s === 'hang' || s === 'ladder' || s === 'swim' || s === 'wallslide' || s === 'climb') P.dj = false; if (s !== P.state)");
  rep("function startAttack(n){\n  setState('attack');", "function startAttack(n){\n  if (window.__bow){ window.__bowShoot && window.__bowShoot(); return; }\n  setState('attack');");
  rep("    P.atkHit.add(e); any = true; damageEnemy(e, dmg, f, push, stun); hitStop = 0.07; shake = Math.max(shake, 0.25); }\n  return any;", "    P.atkHit.add(e); any = true; damageEnemy(e, dmg, f, push, stun); hitStop = 0.07; shake = Math.max(shake, 0.25); }\n  if (window.__trainHit && window.__trainHit(f, reachR, cosArc, dmg, push, P.atkHit)){ any = true; hitStop = 0.07; shake = Math.max(shake, 0.25); }\n  return any;");
  rep("window.__g = {playerHit:", "window.__g = {damageEnemy: (e, d, f, p, s) => damageEnemy(e, d, f, p, s), playerHit:");

  /* — рабочее окружение — */
  const dom = document.createElement('div'); dom.id = '__rdom'; dom.style.display = 'none'; dom.innerHTML = bodyHtml; document.body.appendChild(dom);
  const loopRef = { fn: null };
  const T = { ...THREE };
  T.WebGLRenderer = class { constructor() { return new Proxy(renderer, { get: (t, k) => k === 'setAnimationLoop' ? (f => { loopRef.fn = f; }) : (typeof t[k] === 'function' ? t[k].bind(t) : t[k]), set: (t, k, v) => (t[k] = v, true) }); } };
  T.Scene = class { constructor() { return scene; } };
  T.PerspectiveCamera = class { constructor() { return camera; } };

  const SX = start.x, SZ = start.z;
  const __at = (dx, dz, dy = 0) => [SX + dx, world.heightAt(SX + dx, SZ + dz) + dy, SZ + dz];
  // коробки построек → solids (V3 доступен через THREE)
  /* ───── двери в домах: настоящие двери моделей (build-map: box.house), E — открыть/закрыть;
     внутри дома камера от первого лица ───── */
  const V = THREE.Vector3;
  const doors = [];
  let G = null;                                       // window.__g Ричарда (заполняется ниже)
  const box = (x0, x1, y0, y1, z0, z1) => ({ min: new V(x0, y0, z0), max: new V(x1, y1, z1) });
  // коллизия дома: фундамент, 4 стены (в стене с дверью — проём), крыша-«шапка» над стенами; проём перекрывает дверной бокс
  const { planHouse } = makeHousePlanner(THREE);      // коллизия зданий — в house-collision.js (общая с проверочными скриптами)
  const insideOf = d => { const h = d.h, p = P.pos; return p.x > h.bx0 && p.x < h.bx1 && p.z > h.bz0 && p.z < h.bz1 && p.y < d.yt && p.y > h.gy - 3; };
  let doorBuilds = 0;
  function doorsTick(dt){
    doorBuilds = 0;
    const p = P.pos;
    for (const d of doors){
      const dist = Math.hypot(d.h.dx - p.x, d.h.dz - p.z);
      if (!d.vis && dist < 300 && doorBuilds < 1){ doorBuilds++; d.vis = d.h.makeDoor(); scene.add(d.vis.g); }
      if (d.vis && dist > 380){ scene.remove(d.vis.g); d.vis = null; }
      d.open += (d.want - d.open) * (1 - Math.exp(-6 * dt));
      const solid = d.open < 0.5 && !insideOf(d);      // изнутри всегда можно выйти — застрять нельзя
      if (solid !== d.solidOn){ d.solidOn = solid; const i = G.solids.indexOf(d.door); if (solid) G.solids.push(d.door); else if (i >= 0) G.solids.splice(i, 1); }
      if (d.vis) d.vis.setOpen(d.open);
    }
  }
  function nearDoor(){   // ближайшая дверь: не дальше 6 м, игрок не на крыше
    let best = null, bd = 6;
    for (const d of doors){
      const dist = Math.hypot(d.h.dx - P.pos.x, d.h.dz - P.pos.z);
      if (dist < bd && P.pos.y < d.yt - 0.5 && P.pos.y > d.h.gy - 3){ bd = dist; best = d; }
    }
    return best;
  }
  const doorPrompt = document.createElement('div');
  doorPrompt.style.cssText = 'position:fixed;left:50%;bottom:20%;transform:translateX(-50%);font:600 16px -apple-system,Segoe UI,sans-serif;color:#fff;background:rgba(0,0,0,.45);padding:6px 14px;border-radius:10px;pointer-events:none;display:none';
  document.body.appendChild(doorPrompt);
  addEventListener('keydown', e => {
    if (e.code !== 'KeyE' || e.repeat || !window.__richardActive || window.__riding || window.__dragonNear || window.__leverNear || !G) return;
    const d = nearDoor();
    if (!d || !['ground', 'air'].includes(P.state) || G.interactNear()) return;   // у сундука/рычага E достаётся им
    if (d.want === 1 && Math.hypot(d.h.dx - P.pos.x, d.h.dz - P.pos.z) < 2.2) return;   // в проёме дверь не закрыть
    d.want = 1 - d.want;
  });
  /* оружие по команде: в ножнах (скрыто) при ходьбе, плавании и лазании; X — достать/убрать; удар, блок и парирование достают его сами */
  let armed = false, bowOn = false;
  const NOWEAPON = ['swim', 'ladder', 'climb', 'hang', 'wallslide', 'glide'];
  const weaponToast = document.createElement('div');
  weaponToast.style.cssText = 'position:fixed;left:50%;bottom:26%;transform:translateX(-50%);font:600 15px -apple-system,Segoe UI,sans-serif;color:#fff;background:rgba(0,0,0,.5);padding:5px 14px;border-radius:10px;pointer-events:none;display:none';
  document.body.appendChild(weaponToast); let toastT = 0;
  const say = t => { if (/достан|Меч и щит|Лук —/.test(t) && window.__snd) window.__snd('clang', 0.3); weaponToast.textContent = t; weaponToast.style.display = 'block'; toastT = 1.6; };
  // меч и щит: в ножнах — меч на левом бедре, щит за спиной (персонаж не выглядит «пустым»); при доставании переходят в руки с «выскоком» масштаба, при убирании — сжимаются в руках и появляются на теле
  const HOLSTER = {
    Sword: { pos: [-1.38, 0.5, -0.15], rot: [1.45, 0.12, 0.1], sc: 0.9 },      // блеск вдоль +z → клинок вниз вдоль бедра
    Shield: { pos: [0, 1.35, -0.98], rot: [0, Math.PI, 0], sc: 0.7 },          // лицом наружу, на лопатках
  };
  const WCACHE = new WeakMap(), HANDS = new WeakMap();      // кэш частей по фигуре (в userData нельзя: клон копирует его как обычный объект)
  function applyWeapon(fig, want, dt = 0.016){
    let wc = WCACHE.get(fig); if (!wc) WCACHE.set(fig, wc = {}); const body = wc.body || (wc.body = fig.getObjectByName('Torso') || fig.getObjectByName('Body'));
    let k = fig.userData.wk ?? 0; const tgt = want ? 1 : 0;
    if (k !== tgt) k = want ? Math.min(1, k + dt / 0.35) : Math.max(0, k - dt / 0.2);
    fig.userData.wk = k;
    const e = want ? 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2) : k;      // easeOutBack при доставании
    for (const n of ['Sword', 'Shield']){
      const o = wc[n] || fig.getObjectByName(n); if (!o) continue; wc[n] = o;
      let H = HANDS.get(o); if (!H) HANDS.set(o, H = { parent: o.parent, pos: o.position.clone(), quat: o.quaternion.clone(), sc: o.scale.clone() });
      const hol = HOLSTER[n];
      const inHand = o.parent === H.parent;
      if (want || k > 0){                                     // в руке (достаём или ещё убираем)
        if (!inHand){ H.parent.add(o); o.position.copy(H.pos); o.quaternion.copy(H.quat); }
        o.visible = true; o.scale.copy(H.sc).multiplyScalar(Math.max(0.001, e));
      } else if (body){                                       // в ножнах: на теле
        if (inHand){ body.add(o); o.position.set(...hol.pos); o.rotation.set(...hol.rot); }
        o.visible = true; o.scale.copy(H.sc).multiplyScalar(hol.sc);
      } else o.visible = false;
    }
  }
  // достать оружие можно, только если им можно пользоваться (не в воде, не на лестнице/стене, не верхом, не на драконе); убрать — всегда
  const typingNow = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');
  function drawBlocked(quiet){
    const bad = window.__riding || window.__dragonOn || P.dead || NOWEAPON.includes(P.state) || P.state === 'dead';
    if (bad && !armed && !bowOn){ if (!quiet) say(window.__riding || window.__dragonOn ? 'Верхом оружие не достать' : 'Сейчас оружием не воспользоваться'); return true; }
    return false;
  }
  addEventListener('keydown', e => {
    if (e.code !== 'KeyX' || e.repeat || !window.__richardActive || !G || window.__dragonOn || typingNow()) return;
    if (drawBlocked() && !armed) return; if (window.__riding && !armed) return;
    armed = !armed; if (armed) bowOn = false; say(armed ? 'Оружие достано' : 'Оружие убрано');
  });
  addEventListener('keydown', e => {      // 1 — меч, 2 — лук (повторное нажатие убирает оружие)
    if ((e.code !== 'Digit1' && e.code !== 'Digit2') || e.repeat || !window.__richardActive || !G || typingNow()) return;
    if (document.querySelector('#tp.on')) return;
    if (drawBlocked() && (e.code === 'Digit1' ? !armed : !bowOn)) return;      // в окне телепорта цифры выбирают место
    if (e.code === 'Digit1') { armed = !armed; bowOn = false; say(armed ? 'Меч и щит' : 'Оружие убрано'); }
    else { bowOn = !bowOn; if (bowOn) armed = false; say(bowOn ? 'Лук — зажмите ЛКМ/J, отпустите для выстрела' : 'Оружие убрано'); }
  });
  addEventListener('keydown', e => {      // Z — лук: ЛКМ/J стреляет по центру экрана (в том числе в прыжке)
    if (e.code !== 'KeyZ' || e.repeat || !window.__richardActive || !G || window.__dragonOn || typingNow()) return;
    if (drawBlocked() && !bowOn) return;
    bowOn = !bowOn; if (bowOn) armed = false; say(bowOn ? 'Лук — зажмите ЛКМ/J, отпустите для выстрела' : 'Лук убран');
  });
  /* защита от застревания в стенах (башни, дома, корабли): если ноги внутри твёрдого бокса дольше 0.35 с — выталкиваем к ближайшей свободной грани */
  let embT = 0;
  function unstick(dt){
    const st = P.state; if (['ladder', 'climb', 'hang', 'wallslide', 'dead', 'swim'].includes(st) || window.__riding) { embT = 0; return; }
    const p = P.pos; let hit = null;
    for (const b of G.solids){
      if (p.x <= b.min.x + 0.05 || p.x >= b.max.x - 0.05 || p.z <= b.min.z + 0.05 || p.z >= b.max.z - 0.05) continue;
      if (p.y <= b.min.y + 0.1 || p.y >= b.max.y - 0.6) continue;      // стоит на верхней грани или прыгает над ней — не застряли
      hit = b; break;
    }
    if (!hit){ embT = 0; return; }
    embT += dt; if (embT < 0.35) return;
    const free = (x, z) => !G.solids.some(b => x > b.min.x - 0.3 && x < b.max.x + 0.3 && z > b.min.z - 0.3 && z < b.max.z + 0.3 && p.y > b.min.y + 0.1 && p.y < b.max.y - 0.6);
    const opts = [[p.x - hit.min.x, -1, 0], [hit.max.x - p.x, 1, 0], [p.z - hit.min.z, 0, -1], [hit.max.z - p.z, 0, 1]].sort((a, c) => a[0] - c[0]);
    for (const [d, sx, sz] of opts){ const nx = p.x + sx * (d + 0.6), nz = p.z + sz * (d + 0.6); if (free(nx, nz)){ p.x = nx; p.z = nz; P.vel.set(0, Math.min(P.vel.y, 0), 0); embT = 0; return; } }
    p.y = hit.max.y + 0.1; P.vel.set(0, 0, 0); embT = 0;      // со всех сторон закрыто — поднимаем на верхнюю грань
  }
  const curFig = () => (char === 'richard' || hidden || !locals[char]) ? G.figure : locals[char].group;      // фигура, которую игрок реально видит (у Соколина, Бэна и др. это клон, а не Ричард)
  function weaponTick(dt){
    const st = P.state;
    if ((window.__dragonOn || P.dead || NOWEAPON.includes(st) || window.__ridingKind === 'ship') && (armed || bowOn)){ if (window.__dragonOn || window.__ridingKind === 'ship'){ armed = false; bowOn = false; } }
    if (!armed && !window.__dragonOn && window.__ridingKind !== 'ship' && ['attack', 'bash', 'block', 'parry'].includes(st)){ armed = true; { const F = curFig(); F.userData.wk = Math.max(F.userData.wk || 0, 0.85); } say('Оружие достано'); }
    if (toastT > 0){ toastT -= dt; if (toastT <= 0) weaponToast.style.display = 'none'; }
    applyWeapon(curFig(), armed && !NOWEAPON.includes(st), dt);
    window.__bow = bowOn && !NOWEAPON.includes(st); bow.set(window.__bow, curFig()); bow.tick(dt); training.tick(dt, camera.position, P);
  }
  // камера: первое лицо внутри дома; плавный переход
  let fpV = 0;
  const fwd = new V(), fpPos = new V(), fpLook = new V(), tpPos = new V(), tpLook = new V(), head = new V();
  function fpTick(cam, tgt, dt){
    if (!G) return;
    doorsTick(dt); weaponTick(dt); unstick(dt);
    const nd = nearDoor(), showP = !!nd && !G.interactNear() && ['ground', 'air'].includes(P.state) && window.__richardActive;
    doorPrompt.style.display = showP ? 'block' : 'none';
    if (showP) doorPrompt.textContent = nd.want ? 'E — закрыть дверь' : 'E — открыть дверь';
    const inside = doors.some(insideOf);
    fpV += ((inside ? 1 : 0) - fpV) * (1 - Math.exp(-6 * dt));      // первое лицо — только внутри дома
    const cape = scene.getObjectByName('Cape');       // плащ добавлен в сцену отдельно от фигуры — прячем его вместе с ней
    if (fpV < 0.002){ G.figure.visible = true; if (cape) cape.visible = true; return; }
    G.figure.getObjectByName('Head').getWorldPosition(head);
    tpPos.copy(cam.position); tpLook.set(tgt.x, tgt.y + 0.5, tgt.z);
    fwd.set(tgt.x - cam.position.x, tgt.y - cam.position.y, tgt.z - cam.position.z).normalize();
    fpPos.copy(head).addScaledVector(fwd, 0.9); fpLook.copy(fpPos).addScaledVector(fwd, 30);
    cam.position.lerpVectors(tpPos, fpPos, fpV);
    cam.lookAt(tpLook.lerp(fpLook, fpV));
    G.figure.visible = fpV < 0.5; if (cape) cape.visible = fpV < 0.5;
  }
  /* камера внутри дома/башни не выходит за внутреннюю поверхность стен (на любой высоте): круглая башня — по радиусу, прямоугольный дом — по габариту */
  function clampInside(cam){
    const d = doors.find(insideOf); if (!d || fpV < 0.01) return;
    const h = d.h, c = cam.position, m = (h.t || 0.6) + 0.45;
    if (h.round){
      const rd = h.round, f = Math.min(1, Math.max(0, (c.y - rd.y) / rd.H)), Rin = rd.R0 + (rd.R1 - rd.R0) * f - rd.t - 0.45, dx = c.x - rd.cx, dz = c.z - rd.cz, r = Math.hypot(dx, dz);
      if (r > Rin && r > 0.01){ c.x = rd.cx + dx / r * Rin; c.z = rd.cz + dz / r * Rin; }
    } else {
      c.x = Math.min(h.bx1 - m, Math.max(h.bx0 + m, c.x)); c.z = Math.min(h.bz1 - m, Math.max(h.bz0 + m, c.z));
    }
  }
  /* камера не лезет в стены, объекты, пол и воду: луч от головы Ричарда до камеры; ближайшее пересечение с твёрдыми боксами или рельефом — камера ставится перед ним;
     затем камера поднимается над землёй (≥ 0.9) и над водой (не уходит под воду) */
  const _o = new V(), _d = new V(), _p = new V();
  function rayBox(o, d, len, b){
    let t0 = 0, t1 = len;
    for (const ax of ['x', 'y', 'z']){
      const oa = o[ax], da = d[ax], mn = b.min[ax], mx = b.max[ax];
      if (Math.abs(da) < 1e-9){ if (oa < mn || oa > mx) return Infinity; }
      else { let a = (mn - oa) / da, c = (mx - oa) / da; if (a > c){ const q = a; a = c; c = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return Infinity; }
    }
    return t0;
  }
  function camCollide(cam, tgt){
    if (!G || !window.__richardActive) return;
    _o.set(tgt.x, tgt.y + 0.5, tgt.z); _d.subVectors(cam.position, _o); const len = _d.length(); if (len < 0.01) return; _d.divideScalar(len);
    const c = cam.position, x0 = Math.min(_o.x, c.x) - 1, x1 = Math.max(_o.x, c.x) + 1, y0 = Math.min(_o.y, c.y) - 1, y1 = Math.max(_o.y, c.y) + 1, z0 = Math.min(_o.z, c.z) - 1, z1 = Math.max(_o.z, c.z) + 1;
    let hit = len;
    for (const b of G.solids){
      if (b.min.x > x1 || b.max.x < x0 || b.min.z > z1 || b.max.z < z0 || b.min.y > y1 || b.max.y < y0) continue;
      if (_o.x > b.min.x && _o.x < b.max.x && _o.y > b.min.y && _o.y < b.max.y && _o.z > b.min.z && _o.z < b.max.z) continue;      // голова уже внутри бокса — он не преграда
      const t = rayBox(_o, _d, len, b); if (t < hit) hit = t;
    }
    for (let t = 1.0; t < hit; t += 1.0){ _p.copy(_o).addScaledVector(_d, t); if (_p.y < world.heightAt(_p.x, _p.z) + 0.8){ hit = Math.max(0, t - 1.0); break; } }
    let moved = false;
    if (hit < len){ const dist = Math.max(0.3, hit - 0.4); c.copy(_o).addScaledVector(_d, dist); moved = true; G.figure.visible = dist > 1.7; const cp = scene.getObjectByName('Cape'); if (cp) cp.visible = dist > 1.7; }      // камера строго перед препятствием (раньше min 1.6 мог вынести её за стену в узкой башне); вплотную к игроку — прячем фигуру
    const th = world.heightAt(c.x, c.z), minY = Math.max(th + 0.9, th < 0.3 ? 0.9 : -1e9);      // не ниже земли и не под водой
    if (c.y < minY){ c.y = minY; moved = true; }
    if (moved) cam.lookAt(_o);
  }
  const fpHook = (cam, tgt, dt) => { fpTick(cam, tgt, dt); camCollide(cam, tgt); clampInside(cam); };

  const fn = new Function('THREE', 'OrbitControls', 'RoomEnvironment', 'RoundedBoxGeometry', 'GLTFExporter', 'location', '__gh', '__at', '__ox', '__oz', '__fpCam', code);
  window.__richardActive = false;
  const before = new Set(document.body.children);
  fn(T, OrbitControls, RoomEnvironment, RoundedBoxGeometry, GLTFExporter, { search: '?game=1' }, world.heightAt, __at, SX, SZ, fpHook);
  if (miss.length) console.warn('richard-mode: не сработали патчи: ' + miss.join(' ||| '));
  if (!window.__g) throw new Error('richard-mode: игра не запустилась');
  setTimeout(() => { const h = [...document.querySelectorAll('div')].find(d => d.innerHTML.includes('Управление') && d.innerHTML.includes('Пробел')); if (h && !h.innerHTML.includes('X —')) h.innerHTML += '<br>1 — меч и щит · 2 — лук<br>V — позвать дракона, E — залезть/слезть, Q — спрыгнуть · в полёте: WASD по горизонтали, Z/X вверх/вниз, Пробел — огонь<br>Лук: зажать ЛКМ/J — натянуть, отпустить — выстрел<br>В прыжке: J — удар · Пробел — 2-й прыжок, затем планирование'; }, 0);
  const uiEls = [...document.body.children].filter(c => !before.has(c) && c.id !== '__rdom');
  const g = window.__g; G = g; uiEls.push(doorPrompt);
  // тренировочная площадка в городе и лук
  const sp_ = (world.spots && world.spots['Город короля']) || { x: start.x, z: start.z };
  const training = createTraining({ THREE, scene, world, solids: g.solids, anchor: sp_ });
  const bow = createBow({ THREE, scene, world, getG: () => G, getCam: () => camera, training });
  window.__trainHit = (f, reachR, cosArc, dmg, push, set) => training.hitMelee(G.P, f, reachR, cosArc, dmg, push, set);
  training.setBow(bow);
  window.__bowShoot = () => bow.begin();      // нажатие начинает натяжение; выстрел — при отпускании кнопки
  window.__bow = false;
  for (const b of world.subSolids || []) g.solids.push({ min: new THREE.Vector3(b.x0, b.y0, b.z0), max: new THREE.Vector3(b.x1, b.y1, b.z1), grab: false });      // подводные «юбки» скал
  // дома с настоящей дверью: сплошной бокс заменяем стенами с проёмом; остальные постройки — сплошные боксы
  for (const b of world.solidBoxes){
    if (!b.houses){ b.solidRef = { min: new THREE.Vector3(b.x0, b.y0, b.z0), max: new THREE.Vector3(b.x1, b.y1, b.z1), grab: b.grab, nowall: b.nowall }; g.solids.push(b.solidRef); continue; }
    for (const w of b.walls || []) g.solids.push(box(w.x0, w.x1, w.y0, w.y1, w.z0, w.z1));      // ограда замка
    for (const h of b.houses){          // у каждого корпуса (у фермы их два: дом и сарай) свои стены; пристройки без корпуса коллизии не имеют — только видимые стены
      if (!h.hasDoor){ g.solids.push(box(h.bx0, h.bx1, b.y0, Math.min(b.y1, h.top + 8), h.bz0, h.bz1)); continue; }
      const pd = planHouse(b, h); for (const L of h.ladders || []) g.ladders.push(L);      // стремянки на антресоль/в башню — как лестницы шаблона игры
      for (const s_ of pd.out) g.solids.push(s_);
      g.solids.push(pd.door);
      doors.push({ b, h, door: pd.door, yt: pd.yt, solidOn: true, want: h.dw > 8 ? 1 : 0, open: 0, vis: null });      // широкие ворота (сараи) стоят открытыми: закрытая створка была сплошной «стеной в воротах» h.doorObj = doors[doors.length - 1];
    }
  }
  const P = g.P;
  /* ───── персонаж: Ричард или Соколин. Соколин — ОТДЕЛЬНАЯ клонированная фигура (тот же риг и клипы, свои материалы):
     цвета по sokolin.html, со своими мечом и щитом (не Ричардовыми), без короны Ричарда, без плаща.
     Ричард и его материалы не меняются; переключатель лишь показывает одну фигуру и прячет другую. Гарпуна и магии нет. ───── */
  let char = 'richard', capeRef = null, lastNow = performance.now();
  const SOK_HEX = { 0xd29c1e: 0x9a9aa1, 0xc3151b: 0xb0171e, 0x121214: 0x6a3a22, 0x1b1b1e: 0x131316, 0x56555b: 0x55555b, 0xf3efe6: 0xb0171e };   // золото→серебро, красный, волосы, чёрный
  const SOK_NAME = { Thigh: 0x131316, KneeCap: 0x9a9aa1, Neck: 0xb0171e, Hand: 0x55555b };
  function cloneFig(src){   // копия иерархии с КЛОНИРОВАННЫМИ материалами: правки не затрагивают Ричарда
    const c = src.clone(true);
    c.traverse(o => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); });
    c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.visible = true; return c;
  }
  /* меч и щит Соколина — те же формы и материалы, что в Соколин/3D/sokolin.html; крепятся к кистям клона (WristL — меч, WristR — щит),
     поэтому все боевые клипы (удар мечом, удар щитом, блок, парирование) двигают их так же, как у Ричарда. */
  const SOKMAT = {
    steel: new THREE.MeshPhysicalMaterial({color:0x92929a, metalness:0.5, roughness:0.38, clearcoat:0.4}),
    silver: new THREE.MeshPhysicalMaterial({color:0x9a9aa1, metalness:0.55, roughness:0.34, clearcoat:0.5, clearcoatRoughness:0.25}),
    gem: new THREE.MeshPhysicalMaterial({color:0xd01020, roughness:0.15, emissive:0x600008, emissiveIntensity:0.8, clearcoat:1}),
  };
  let sokShieldTex = null;
  function sokShieldTexture(){
    if (sokShieldTex) return sokShieldTex;
    const w = 512, h = 1024, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g2 = cv.getContext('2d');
    g2.fillStyle = '#131316'; g2.fillRect(0, 0, w, h);
    g2.fillStyle = '#b0171e'; g2.beginPath(); g2.moveTo(w*.62, 0); g2.lineTo(w*.9, 0); g2.lineTo(w*.5, h); g2.lineTo(w*.34, h); g2.bezierCurveTo(w*.55, h*.6, w*.6, h*.3, w*.62, 0); g2.fill();
    g2.save(); g2.translate(w*.42, h*.36); g2.scale(190, 190); g2.fillStyle = '#a9aab0'; g2.beginPath();     // голова сокола
    g2.moveTo(-0.9,0.9); g2.bezierCurveTo(-1.0,0.2,-0.7,-0.5,-0.2,-0.75); g2.bezierCurveTo(0.2,-0.95,0.6,-0.75,0.8,-0.35);
    g2.bezierCurveTo(1.0,-0.2,1.05,0.1,0.9,0.4); g2.bezierCurveTo(0.75,0.15,0.6,0.05,0.4,0.1); g2.bezierCurveTo(0.2,0.3,0.1,0.6,-0.1,0.9);
    g2.bezierCurveTo(-0.3,1.1,-0.7,1.1,-0.9,0.9); g2.fill(); g2.fillStyle = '#131316'; g2.beginPath(); g2.arc(0.38,-0.32,0.1,0,7); g2.fill(); g2.restore();
    g2.strokeStyle = '#a9aab0'; g2.lineWidth = 12; g2.beginPath(); g2.moveTo(w*.3, h*.6); g2.quadraticCurveTo(w*.38, h*.75, w*.34, h*.92); g2.stroke();
    sokShieldTex = new THREE.CanvasTexture(cv); sokShieldTex.colorSpace = THREE.SRGBColorSpace; sokShieldTex.anisotropy = 8; return sokShieldTex;
  }
  function addSokolinGear(c){
    const rb = (w, h, d, r = 0.12, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w/2 - 1e-3, h/2 - 1e-3, d/2 - 1e-3));
    const mesh = (parent, geo, mat, x = 0, y = 0, z = 0, name) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; if (name) m.name = name; parent.add(m); return m; };
    const joint = (parent, name) => { const j = new THREE.Group(); j.name = name; parent.add(j); return j; };
    const { steel, silver, gem } = SOKMAT;
    const wristL = c.getObjectByName('WristL'), wristR = c.getObjectByName('WristR'); if (!wristL || !wristR) return;
    const sword = joint(wristL, 'Sword');
    { const sh = new THREE.Shape(); sh.moveTo(-0.26,0); sh.lineTo(0.26,0); sh.lineTo(0.24,2.7); sh.lineTo(0,3.05); sh.lineTo(-0.24,2.7); sh.closePath();
      const bg = new THREE.ExtrudeGeometry(sh, {depth:0.1, bevelEnabled:true, bevelSize:0.025, bevelThickness:0.025, bevelSegments:1}); bg.translate(0, 0, -0.05); bg.rotateX(Math.PI/2);
      mesh(sword, bg, steel, 0, 0, 0.5, 'Blade');
      mesh(sword, new THREE.CylinderGeometry(0.1, 0.1, 1.0, 16), steel, 0, 0, 0.02, 'Grip').rotation.x = Math.PI/2;
      mesh(sword, rb(1.25, 0.2, 0.42, 0.07, 3), steel, 0, 0, 0.5, 'Guard');
      for (const sx of [-1, 1]) mesh(sword, rb(0.3, 0.2, 0.3, 0.06, 2), steel, sx*0.68, 0, 0.62).rotation.z = sx*0.3;
      mesh(sword, new THREE.OctahedronGeometry(0.16), gem, 0, 0.12, 0.5, 'GuardGem').scale.set(1, 0.6, 1.4);
      mesh(sword, new THREE.SphereGeometry(0.17, 16, 12), steel, 0, 0, -0.5, 'Pommel');
      mesh(sword, new THREE.OctahedronGeometry(0.17), gem, 0, 0, -0.74, 'PommelGem'); }
    const shield = joint(wristR, 'Shield');
    { const shape = k => { const s = new THREE.Shape();      // асимметричный «полумесяц»
        s.moveTo(-1.1*k, 1.35*k); s.bezierCurveTo(-0.9*k, 1.85*k, 0, 1.95*k, 1.15*k, 1.85*k); s.bezierCurveTo(0.45*k, 0.9*k, 0.35*k, -0.7*k, 0.15*k, -1.9*k);
        s.bezierCurveTo(-0.7*k, -1.6*k, -1.35*k, -0.5*k, -1.1*k, 1.35*k); s.closePath(); return s; };
      const body = new THREE.Group(); body.position.set(0, -0.45, 0.42); body.scale.setScalar(0.8);
      mesh(body, new THREE.ExtrudeGeometry(shape(1), {depth:0.12, bevelEnabled:true, bevelSize:0.05, bevelThickness:0.05, bevelSegments:3, curveSegments:32}), silver, 0, 0, 0, 'ShieldRim');
      const fg = new THREE.ShapeGeometry(shape(0.88), 32), p = fg.attributes.position, uv = fg.attributes.uv; fg.computeBoundingBox(); const bb = fg.boundingBox;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - bb.min.x)/(bb.max.x - bb.min.x), (p.getY(i) - bb.min.y)/(bb.max.y - bb.min.y));
      mesh(body, fg, new THREE.MeshPhysicalMaterial({map:sokShieldTexture(), roughness:0.7, clearcoat:0, envMapIntensity:0.25, polygonOffset:true, polygonOffsetFactor:-2}), 0, 0, 0.18, 'ShieldFace');
      const rim = shape(0.94).getSpacedPoints(34);
      for (let i = 0; i < rim.length - 1; i++) mesh(body, new THREE.SphereGeometry(0.055, 8, 6), silver, rim[i].x, rim[i].y, 0.19);
      mesh(shield, rb(0.2, 0.2, 1.0, 0.07, 3), steel, 0, 0, 0, 'GripBar').rotation.y = Math.PI/2;
      for (const sy of [-0.45, 0.45]) mesh(shield, rb(0.14, 0.2, 0.46, 0.04, 2), steel, 0, sy, 0.22);
      shield.add(body); shield.rotation.y = Math.PI/2; }
  }
  function buildSokolin(src){
    const c = cloneFig(src);
    c.traverse(o => {
      if (!o.isMesh) return;
      if (o.name.startsWith('Tabard')){ o.visible = false; return; }
      const col = SOK_NAME[o.name] ?? (o.material.color ? SOK_HEX[o.material.color.getHex()] : undefined);
      if (col !== undefined) o.material.color.setHex(col);
    });
    for (const n of ['Sword', 'Shield', 'Crown']) c.getObjectByName(n)?.removeFromParent();
    addSokolinGear(c);   // свой меч (красный кристалл в гарде) и свой щит-«полумесяц» с соколом — по sokolin.html
    // диадема Соколина (серебро, зубцы по sokolin.html)
    const head = c.getObjectByName('Head');
    const sil = new THREE.MeshPhysicalMaterial({color:0x9a9aa1, metalness:0.55, roughness:0.34, clearcoat:0.5, clearcoatRoughness:0.25, side:THREE.DoubleSide});
    const t = new THREE.Group(); t.name = 'SokTiara';
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.13, 1.1, 0.5, 56, 1, true), sil); band.position.y = 1.68; t.add(band);
    for (const y of [1.44, 1.93]){ const r = new THREE.Mesh(new THREE.TorusGeometry(1.115, 0.05, 8, 64), sil); r.rotation.x = Math.PI/2; r.position.y = y; t.add(r); }
    for (let i = 0; i < 7; i++){
      const a = i/7*Math.PI*2, h = i % 2 ? 0.34 : 0.5;
      const z = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.16), sil);
      z.position.set(Math.sin(a)*1.1, 1.93 + h/2 - 0.02, Math.cos(a)*1.1); z.rotation.y = a; t.add(z);
    }
    head.add(t);
    return c;
  }
  // аватар: фигура + свой AnimationMixer; клипы — те же CLIPS, что у Ричарда
  function makeAvatar(fig){
    const mixer = new THREE.AnimationMixer(fig);
    const acts = {}; for (const [k, c] of Object.entries(g.CLIPS)) acts[k] = mixer.clipAction(c);
    let cur = null, curName = '', t = 0, spd = 0;
    return {
      group: fig,
      setAnim(name, speed = 1, once = false){
        const a = acts[name]; if (!a) return;
        if (name !== curName){ if (cur) cur.fadeOut(0.2); a.reset().fadeIn(0.2); if (once){ a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else { a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; } a.play(); cur = a; curName = name; }
        a.timeScale = speed;
      },
      restart(){ if (cur) cur.reset().play(); },
      update(dt){
        mixer.update(dt); t += dt;
        const cl = fig.userData.cloak; if (cl) cl.rotation.x = -0.1 + Math.sin(t*5)*0.04 - Math.min(0.7, spd);
      },
      setPose(x, y, z, yaw){ spd = Math.min(0.7, Math.hypot(x - fig.position.x, z - fig.position.z) * 0.15); fig.position.set(x, y, z); fig.rotation.y = yaw; },
      dispose(){ mixer.stopAllAction(); scene.remove(fig); },
    };
  }
  // любой герой = клон рига Ричарда + «одевалка» (Соколин — buildSokolin, остальные — chars/<имя>.js). Анимации общие.
  function buildChar(name, src){
    if (name === 'sokolin') return buildSokolin(src);
    const c = cloneFig(src);
    if (DRESS[name]){ c.traverse(o => { if (o.isMesh && o.name.startsWith('Tabard')) o.visible = false; }); try { DRESS[name](c, { THREE, RoundedBoxGeometry }); } catch (e) { console.error('одевалка', name, e); } }
    return c;
  }
  const locals = {};      // свои аватары по именам — создаются один раз, лениво
  const local = name => locals[name] || (locals[name] = (() => { const a = makeAvatar(buildChar(name, g.figure)); scene.add(a.group); a.group.visible = false; return a; })());
  let hidden = false;      // зритель без персонажа: своей фигуры в мире нет
  // Код камеры игры (первое лицо, столкновения камеры) каждый кадр сам включает g.figure.visible и плащ — из-за этого Ричард
  // проступал поверх выбранного героя. Поэтому у них видимость «с замком»: пока выбран не Ричард (или мы зритель), включить её нельзя.
  let forceHide = false;
  // сеттер зеркалит скрытие/показ «себя» (первое лицо, камера у стены) на клон выбранного героя
  const lockVis = o => { if (!o || o.__visLock) return; let v = o.visible; Object.defineProperty(o, 'visible', { configurable: true, get: () => v, set: x => { v = forceHide ? false : x; if (forceHide && !hidden && char !== 'richard'){ const l = locals[char]; if (l) l.group.visible = x; } } }); o.__visLock = true; };
  function applyVis(){     // ровно одна своя фигура: Ричард (оригинал) ИЛИ один из клонов
    capeRef = scene.getObjectByName('Cape');
    forceHide = char !== 'richard' || hidden; lockVis(g.figure); lockVis(capeRef);
    const rich = char === 'richard' && !hidden;
    g.figure.visible = rich; if (capeRef) capeRef.visible = rich;
    for (const k of Object.keys(locals)) locals[k].group.visible = false;
    if (char !== 'richard' && !hidden){ const l = local(char); l.group.visible = true; l.group.position.copy(g.figure.position); l.group.rotation.copy(g.figure.rotation); }
  }
  function syncLocal(){
    if (char === 'richard' || hidden) return;
    g.figure.visible = false; if (capeRef) capeRef.visible = false;            // Ричард скрыт, его плащ тоже — но его объекты не меняются
    const l = local(char);
    l.group.position.copy(g.figure.position); l.group.rotation.copy(g.figure.rotation);
    const nowT = performance.now(), dt = Math.min(0.1, (nowT - lastNow) / 1000); lastNow = nowT;
    const ga = g.animAct(), once = !!ga && ga.loop === THREE.LoopOnce;           // «Блок», удары и т.п. у Ричарда играются один раз и держат последний кадр
    l.setAnim(g.animName(), ga ? ga.timeScale : 1, once);
    if (once && ga.time < (l.lastT ?? 0) - 0.01) l.restart();                    // игра запустила тот же клип заново (повторный блок)
    l.lastT = ga ? ga.time : 0; l.update(dt);
  }
  const KNOWN = ['richard', 'sokolin', 'ben', 'zantio', 'zhenshi'];
  function setCharacter(name){
    if (!KNOWN.includes(name) || name === char) return;
    char = name; applyVis(); lastNow = performance.now();
    window.dispatchEvent(new CustomEvent('richardcharacter', { detail: name }));
  }
  function makeRemoteAvatar(role){   // отдельная фигура для другого игрока: 'sokolin' — Соколин, иначе как Ричард (клоны материалов)
    const fig = role === 'richard' ? cloneFig(g.figure) : buildChar(role, g.figure);
    scene.add(fig); return makeAvatar(fig);
  }
  // смена персонажа — только через меню лобби (там следят, чтобы двое не выбрали одного и того же)
  const api = {
    get armed() { return armed && !NOWEAPON.includes(P.state); }, applyWeapon,
    P, figure: g.figure, key: g.key, rim: g.rim, clearKeys: () => g.kd.clear(), solids: g.solids, ladders: g.ladders, ladderNear: () => g.ladderNear(),
    get character() { return char; }, setCharacter, setVisible(v) { hidden = !v; applyVis(); }, makeRemoteAvatar, animName: () => g.animName(), animOnce: () => { const a = g.animAct(); return !!a && a.loop === THREE.LoopOnce; },
    play(name, o) { window.__forceAnim = { name, o }; }, release() { window.__forceAnim = null; }, loop: now => { const B = world.bounds, p = P.pos; if (p.x < B.x0 || p.x > B.x1 || p.z < B.z0 || p.z > B.z1) { p.x = Math.min(B.x1, Math.max(B.x0, p.x)); p.z = Math.min(B.z1, Math.max(B.z0, p.z)); P.vel.x = P.vel.z = 0; } { const t = world.heightAt(p.x, p.z); if (p.y < t - 2.5 && !['swim', 'hang', 'climb'].includes(P.state)) { p.y = Math.max(t, 0) + 0.3; P.vel.y = 0; } if (p.y < -30) { p.y = Math.max(t, 0) + 0.3; P.vel.y = 0; } } loopRef.fn && loopRef.fn(now); syncLocal(); },
    hurt(dmg, x, y, z) { g.playerHit({ remote: true, g: { position: new THREE.Vector3(x, y, z) }, vel: new THREE.Vector3(), state: 'x' }, dmg); },      // удар от другого игрока
    respawnAt(x, z, yaw = 0) { api.teleport(x, z, yaw); g.respawn(); },
    teleport(x, z, yaw = 0) {
      // ближайшая свободная точка: не у стены/в воде (камера не должна упираться в здание)
      const free = (px, pz) => world.heightAt(px, pz) > 0.7 && !world.solidBoxes.some(b => Math.max(b.x0 - px, px - b.x1, 0) ** 2 + Math.max(b.z0 - pz, pz - b.z1, 0) ** 2 < 9 * 9);
      search: for (let r = 0; r <= 120; r += 4) for (let k = 0; k < (r ? 12 : 1); k++) { const a = k / 12 * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (free(px, pz)) { x = px; z = pz; break search; } }
      const y = world.heightAt(x, z); P.pos.set(x, Math.max(y, 0.3), z); P.spawn.copy(P.pos); P.vel.set(0, 0, 0); P.yaw = P.yawVis = yaw; g.cam(yaw + Math.PI, 0.3); g.step(2); },
    set active(v) { window.__richardActive = v; uiEls.forEach(d => { d.style.display = v ? '' : 'none'; }); if (!v) document.exitPointerLock?.(); },
    get active() { return window.__richardActive; },
  };
  api.active = false; api.teleport(SX, SZ, 0);
  return api;
}
