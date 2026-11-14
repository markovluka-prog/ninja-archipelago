// bodies.js — единый слой «тел» для магии. Любой объект мира (предмет, житель, животное, другой игрок, чучело арены, дерево, куст, постройка) показывается заклинаниям
// одинаково: положение, масса, скорость и одинаковый набор операций (поднять, разогнать, остановить, скрыть, ранить, связать, усыпить, нагреть, вылечить…).
// Заклинание не знает, что перед ним: оно меняет свойства по законам физики; а что именно умеет объект — решает его переходник здесь.
// Операция, которой у объекта нет, возвращает false — тогда магия честно объясняет, почему не вышло.
export function createBodies({ THREE, world, richard, net, npcs, animals, dragons, items, heatDT }) {
  const V = THREE.Vector3, hAt = (x, z) => world.heightAt(x, z), cache = new WeakMap(), G = 46;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const kin = new Set();      // существа, на которых сейчас действует магия (парят, летят, удержаны)
  const MASS = { horse: 450, cow: 600, sheep: 60, goat: 50, dog: 25, cat: 4, raven: 1, deer: 120, fish: 2, boat: 120 };
  const cached = (raw, make) => { let b = cache.get(raw); if (!b) cache.set(raw, b = make(raw)); return b; };

  /* ───── предмет (в том числе «проснувшийся» объект мира) ───── */
  const ofItem = it => cached(it, it => ({
    kind: 'item', raw: it, alive: false, movable: true, get name() { return it.name; }, get mass() { return it.m; }, get r() { return it.r; }, get p() { return it.p; }, get vel() { return it.v; }, get dormant() { return it.dormant; },
    speed() { return it.v.length(); },
    lift(dy) { it.held = 0; it.pin = 0; it.hover = it.hover || { y: it.p.y, t: Infinity }; it.hover.y += dy; return true; },
    setVel(dir, v) { it.held = 0; it.hover = null; it.pin = 0; it.rest = 0; it.v.copy(dir).multiplyScalar(v); return true; },
    damp(f) { it.v.multiplyScalar(f); it.hover = null; return true; },
    hold() { it.held = 1; it.hover = null; it.hd = clamp(it.p.distanceTo(richard.P.pos), 8, 26); return true; },
    release() { it.held = 0; it.hover = null; it.pin = 0; return true; },
    hide(on) { it.hid = !!on; it.g.visible = !on; return true; }, isHidden() { return !!it.hid; },
    bind(sec) { it.pin = sec; return true; }, sleep() { return false; }, wake() { it.pin = 0; return true; },
    hurt() { return false; }, heal() { return false; }, say() { return false; },
    heat(raw) { it.T += heatDT(it, raw); return true; }, douse() { it.wet = 1; it.T = Math.min(it.T, 20); if (it.burn) it.burn = 0; return true; }, freeze() { it.T = -30; return true; },
  }));

  /* ───── существа без собственной физики (жители, животные): кинематика магии c.mag, видимая игре через c.my / c.hidden / c.mag.active ───── */
  const magOf = c => c.mag || (c.mag = { v: new V(), y: 0, vy: 0, hoverY: null, held: false, freezeT: 0, active: false, k: 0 });
  const ofCreature = (c, mod, kind) => cached(c, c => {
    const m = magOf(c), P_ = new V(), isNpc = kind === 'npc';
    const b = {
      kind, raw: c, alive: true, movable: true, mod, get name() { return mod.nameOf ? mod.nameOf(c) : kind; }, get mass() { return isNpc ? 75 : (MASS[c.sp] || 40); }, r: 1.4,
      get p() { return P_.set(c.x, (c.y !== undefined ? c.y : Math.max(0, hAt(c.x, c.z))) + (m.y || 0) + 4, c.z); }, get vel() { return m.v; },
      speed() { return Math.hypot(m.v.x, m.v.y, m.v.z, m.vy); },
      lift(dy) { m.hoverY = (m.hoverY ?? m.y) + dy; m.held = true; kin.add(c); return true; },
      setVel(dir, v) { m.hoverY = null; m.held = false; m.v.set(dir.x * v, 0, dir.z * v); m.vy = dir.y * v; if (m.vy > 0) m.y += 0.3; kin.add(c); return true; },
      damp(f) { m.v.multiplyScalar(f); m.vy *= f; return true; },
      hold() { m.held = true; m.hoverY = m.y; kin.add(c); return true; }, release() { m.hoverY = null; m.held = false; m.freezeT = 0; return true; },
      hide(on) { c.hidden = !!on; return true; }, isHidden() { return !!c.hidden; },
      hurt(dmg, J) { if (isNpc) mod.hitAt(c.x, c.z, 2.2, J > 150); else { m.freezeT = Math.max(m.freezeT, 1.5); kin.add(c); } return true; },
      bind(sec) { m.freezeT = Math.max(m.freezeT, sec); kin.add(c); if (isNpc) mod.afflictC(c, 'bind', sec); return true; },
      sleep(sec) { if (isNpc) mod.afflictC(c, 'sleep', sec); m.freezeT = Math.max(m.freezeT, sec); kin.add(c); return true; },
      wake() { if (isNpc) mod.afflictC(c, 'wake', 0); m.freezeT = 0; return true; },
      heal() { if (isNpc) mod.sayC(c, 'Спасибо!'); return true; }, say(t) { if (isNpc) mod.sayC(c, t); return isNpc; },
      heat(raw) { if (raw > 0) { m.k += raw; if (m.k > 40) { m.k = 0; b.hurt(4, 60); } } return true; }, douse() { return true; }, freeze() { return b.bind(4); },
    };
    return b;
  });
  function tickKin(dt) {      // физика существ под магией: парение, полёт, падение (удар о землю сбивает с ног), трение
    for (const c of [...kin]) {
      const m = c.mag; if (!m) { kin.delete(c); continue; }
      if (m.hoverY !== null) m.vy = clamp((m.hoverY - m.y) * 4, -30, 30); else if (m.y > 0 || m.vy > 0) m.vy -= G * dt;
      m.y += m.vy * dt;
      if (m.y <= 0) { const imp = -m.vy; m.y = 0; if (m.vy < 0) { m.vy = 0; if (imp > 22 && !c.sp && npcs && npcs.afflictC) npcs.afflictC(c, 'fall', 3); } }
      const nx = c.x + m.v.x * dt, nz = c.z + m.v.z * dt; if (hAt(nx, nz) > 0.4 || c.sp === 'fish') { c.x = nx; c.z = nz; } else m.v.set(0, 0, 0);
      const fr = m.y > 0.05 ? 0.3 : 2.4; m.v.multiplyScalar(Math.max(0, 1 - fr * dt)); m.freezeT = Math.max(0, m.freezeT - dt);
      c.my = m.y; m.active = m.held || m.hoverY !== null || m.y > 0.2 || m.freezeT > 0 || m.v.length() > 1.5;
      if (!m.active && m.y <= 0) { m.active = false; c.my = 0; kin.delete(c); }
    }
  }
  const releaseAllCreatures = () => { for (const c of kin) { const m = c.mag; if (m) { m.hoverY = null; m.held = false; m.freezeT = 0; } } };

  /* ───── другие игроки: только то, что можно сделать через сервер (урон, замедление) и скрыть из своего поля зрения ───── */
  const ofPlayer = pb => cached(pb, pb => ({
    kind: 'player', raw: pb, alive: true, movable: false, name: 'игрок', mass: 75, r: 1.4, get p() { return pb._p || (pb._p = new V()), pb._p.set(pb.x, pb.y + 4.4, pb.z); }, vel: null, speed: () => 0,
    hurt(dmg, J, st) { net.send({ t: 'hit', to: pb.id, dmg: Math.max(1, Math.round(dmg)), st: st || 'spell' }); return true; },
    bind() { net.send({ t: 'hit', to: pb.id, dmg: 1, st: 'spell_ice' }); return true; }, hide(on) { net.cloak && net.cloak(pb.id, on); pb.hid = !!on; return !!net.cloak; }, isHidden() { return !!pb.hid; },
    lift: () => false, setVel: () => false, damp: () => false, hold: () => false, release: () => true, sleep: () => false, wake: () => true, heal: () => false, say: () => false, heat() { return false; }, douse() { return false; }, freeze() { net.send({ t: 'hit', to: pb.id, dmg: 5, st: 'spell_ice' }); return true; },
  }));
  /* ───── чучела и враги арены ───── */
  const ofEnemy = e => cached(e, e => ({
    kind: 'enemy', raw: e, alive: true, movable: false, name: 'враг', mass: 80, r: 1.4, get p() { return e.g.position; }, vel: null, speed: () => 0,
    hurt(dmg) { const d = new V(e.g.position.x - richard.P.pos.x, 0, e.g.position.z - richard.P.pos.z).normalize(); window.__g && window.__g.damageEnemy && window.__g.damageEnemy(e, Math.round(dmg), d, 6, 0.3); return true; },
    bind(sec) { const d = new V(0, 0, 1); window.__g && window.__g.damageEnemy && window.__g.damageEnemy(e, 0, d, 0, sec); return true; }, hide(on) { e.g.visible = !on; e.hid = !!on; return true; }, isHidden() { return !!e.hid; },
    lift: () => false, setVel: () => false, damp: () => false, hold: () => false, release: () => true, sleep(sec) { return this.bind(sec); }, wake: () => true, heal: () => false, say: () => false, heat(raw) { return raw > 0; }, douse() { return false; }, freeze() { return true; },
  }));

  /* ───── растения, деревья, постройки, корабли (реестр горючего мира) ───── */
  const ofFlora = o => cached(o, o => {
    const k = o.k === 'house' ? 'house' : o.k === 'tree' ? 'tree' : 'plant', P_ = new V(), mass = Math.max(1, Math.min(2e5, (2 * o.r * U3()) ** 2 * o.h * U3() * (k === 'house' ? 80 : k === 'tree' ? 14 : 2))), thr = k === 'house' ? 900 : k === 'tree' ? 800 : 120;
    const b = {
      kind: k, raw: o, alive: false, movable: false, name: k === 'house' ? (o.g && o.g.name ? 'постройка' : 'постройка') : k === 'tree' ? 'дерево' : 'куст', mass, r: o.r, get p() { return P_.set(o.x, o.y + o.h / 2, o.z); }, vel: null, speed: () => 0,
      heat(raw) { o.heatAcc = (o.heatAcc || 0) + raw; if (o.heatAcc >= thr) { o.heatAcc = 0; b.ignite(); } return true; }, ignite() { dragons && dragons.ignite(o.x, o.y + o.h * 0.4, o.z, 3 + o.r); return true; },
      douse() { dragons && dragons.extinguish(o.x, o.y, o.z, o.r + 4); dragons && dragons.wet(o.x, o.z, o.r + 6, 20); return true; }, freeze() { return b.douse(); },
      hide(on) { if (o.rec && world.setHiddenPlaced) { world.setHiddenPlaced(o.rec, on); o.hid = !!on; return true; } if (o.g) { o.g.visible = !on; o.hid = !!on; return true; } return false; }, isHidden() { return !!o.hid; },
      lift: () => false, setVel: () => false, damp: () => false, hold: () => false, release: () => true, bind: () => false, sleep: () => false, wake: () => true, hurt: () => false, heal: () => false, say: () => false,
    };
    return b;
  });
  const U3 = () => 0.19;

  /* ───── поиск тел рядом с точкой ───── */
  function creaturesNear(x, z, R) {
    const out = [];
    if (npcs && npcs.near) for (const c of npcs.near(x, z, R)) out.push(ofCreature(c, npcs, 'npc'));
    if (animals && animals.near) for (const c of animals.near(x, z, R)) out.push(ofCreature(c, animals, 'animal'));
    for (const pb of net.bodies()) if (Math.hypot(pb.x - x, pb.z - z) < R) out.push(ofPlayer(pb));
    const en = (window.__g && window.__g.enemies) || []; for (const e of en) if (e.state !== 'dead' && e.g && Math.hypot(e.g.position.x - x, e.g.position.z - z) < R) out.push(ofEnemy(e));
    return out;
  }
  function floraNear(x, z, R, kinds) { const out = []; if (world.flamNear) world.flamNear(x, z, R, o => { if (o.h < 0.05 || Math.hypot(o.x - x, o.z - z) > R + o.r) return; if (kinds && !kinds.includes(o.k)) return; if (o.ash === Infinity) return; out.push(ofFlora(o)); }); return out; }
  return { ofItem, ofCreature, ofPlayer, ofEnemy, ofFlora, creaturesNear, floraNear, tick: tickKin, releaseAll: releaseAllCreatures };
}
