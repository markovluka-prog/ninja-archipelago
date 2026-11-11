// game.js — клиентская часть режимов игры (судья — server.js): HUD, 3D-объекты (реликвии, флаги, точки захвата), удары между игроками,
// гибель/возрождение, «слепой» искатель в прятках, запрет телепорта. Режимы: battle, relics, capture, ctf, hide.
export const MODE_INFO = {
  battle:  { icon: '⚔️', name: 'Битва', desc: 'Бей соперников — первый, у кого 10 побед, получает 🪙. Телепорт выключен.',
    goal: 'Первым одержать 10 побед над соперниками.', rules: ['Бейте других игроков — каждое убийство = 1 победа', 'Через 45 секунд красная зона начнёт сужаться; вне неё вы теряете здоровье — держитесь ближе к центру', 'После гибели вы возрождаетесь через 3 секунды в случайном месте', 'Телепорт выключен. Времени на раунд нет — только 10 побед'] },
  relics:  { icon: '💎', name: 'Поиск реликвий', desc: 'Реликвии спрятаны в сложных местах (крыши, вершины) и издалека не видны — ищите! Кто соберёт 10 — победил. Подобранные появляются снова в других местах.',
    goal: 'Первым собрать 10 реликвий.', rules: ['Все стартуют в одном месте, реликвии разбросаны случайно по миру', 'Реликвии спрятаны на крышах и вершинах — видны только вблизи (≈28 м)', 'Подойдите вплотную, чтобы подобрать', 'Подобранная реликвия через 25 секунд появится в другом месте'] },
  capture: { icon: '🚩', name: 'Захват точек', desc: 'Две команды бьются за острова: стойте у флага, чтобы захватить. Побеждает команда, захватившая больше половины точек.',
    goal: 'Первыми захватить больше половины точек (на каждом острове по одной).', rules: ['На каждом острове — одна точка с флагом; стойте у флага, чтобы захватить её (чем больше вас — тем быстрее)', 'Побеждает команда, которая первой держит больше половины точек. Таймера нет', 'Бейте соперников и не давайте им отбить точки'] },
  ctf:     { icon: '🏴', name: 'Битва флагов', desc: 'Командная битва: украдите флаг соперника и принесите на свою базу. До 3 захватов.',
    goal: 'Первой команде притащить на свою базу 3 флага соперника.', rules: ['Бой идёт на самом большом острове — там базы и флаги', 'Подбегите к флагу соперника — вы понесёте его', 'Принесите его на свою базу, пока ваш флаг лежит дома', 'Убитый носитель роняет флаг; упавший флаг сам вернётся через 20 с. Таймера нет — играем до 3 флагов'] },
  hide:    { icon: '🙈', name: 'Прятки', desc: 'Один искатель (30 с слепой), остальные прячутся. Найденный (удар) становится искателем. Продержись 3 минуты!',
    goal: 'Прячущимся — продержаться 3 минуты. Искателю — найти всех.', rules: ['Один случайный игрок — искатель: первые 30 секунд он слеп, но потом бегает в 1.75 раза быстрее',  'Игра идёт на одном случайном острове; в здания заходить нельзя', 'Остальные прячутся (имена над головами скрыты)', 'Найденный (удар искателя) сам становится искателем'] },
  naval:   { icon: '🚢', name: 'Морской бой', desc: 'У каждого свой корабль. Стреляйте из пушек бортовыми залпами и топите чужие корабли — побеждает последний на плаву.',
    goal: 'Потопить корабли соперников и остаться на плаву последним.', rules: ['Каждый стартует на своём корабле у штурвала: Q — паруса, A/D — поворот', 'Пушки стоят на бортах: подойдите к пушке и нажмите E, наведите (A/D — поворот ствола, W/S — угол; видна траектория) и стреляйте на X. E — отойти. Перезарядка 1 с', 'Пустые корабли тоже можно топить, но очков за них нет. Корабли сталкиваться не могут. Корпус держит ≈17 попаданий, потопленный игрок выбывает', 'Таймера нет — побеждает последний корабль на плаву'] },
  dragons: { icon: '🐉', name: 'Поединки драконов', desc: 'Все верхом на драконах. Сожгите пламенем всадника чужого дракона — первый, у кого 10 побед, получает 🪙.',
    goal: 'Первым одержать 10 побед: спалить всадника чужого дракона.', rules: ['Дракон прилетает и садится рядом — подойдите и нажмите E, чтобы забраться. В полёте: W/S — вперёд/назад, A/D — поворот, Z/X — вверх/вниз, Shift — ускорение', 'Пробел или левая кнопка мыши (зажать) — огненное дыхание. Пламя поражает всадника, дракон неуязвим', 'Всадник сгорает за пару секунд огня; убитый возрождается через 3 секунды на новом драконе', 'Хлопайте крыльями выше гор: пламя бьёт далеко, но дракон не пролетит сквозь постройки'] },
  explore: { icon: '🧭', name: 'Изучение', desc: 'Без целей и времени: просто гуляйте по архипелагу и общайтесь вдвоём. Телепорт и чат работают.',
    goal: 'Никаких целей — исследуйте острова и общайтесь.', rules: ['Все стартуют в одном месте и гуляют вместе', 'Enter — чат, N — карта с положением друга, T — телепорт по карте', 'Когда зайдёт второй игрок, начнётся голосование за режим'] },
};
const COL = { red: 0xe0453a, blue: 0x3a7be0 }, CSS = { red: '#ff6b6b', blue: '#6bb6ff' }, TEAM = { red: '🔴 Красные', blue: '🔵 Синие' };
const SWING = { attack: [0.22, 20, 7.5], kick: [0.2, 12, 6.5], bash: [0.25, 15, 6.5], heavy: [0.82, 55, 11.5] };      // состояние → [когда в клипе бьём (с), урон, дальность]
const SEEKER_SPEED = 1.75;      // искатель в прятках быстрее остальных в 1.75 раза (между 1.5 и 2)
const PVP = new Set(['battle', 'capture', 'ctf', 'hide', 'dragons']);

export function startGame({ net, richard, world, scene, THREE, ships: SH }) {
  const P = richard.P, shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let G = { phase: 'idle' }, lastHurtT = -99, lastAtk = { id: 0, t: -99 }, reported = false, fired = true, prevT = 0, prevState = '', grabT = 0, wasSeeker = false, lastPhase = 'idle';
  const T = () => performance.now() / 1000;
  let islandAt = () => -1, hideGood = null, autoRepT = 0;

  /* ───── данные мира для сервера: точки (острова/места) и места для реликвий (верхушки построек, вершины рельефа) ───── */
  function markIslands(spots) {              // острова = связные участки суши (сетка 20 м); spot.i — номер острова, spot.big — точка на самом большом
    const B = world.bounds, ST = 20, nx = Math.ceil((B.x1 - B.x0) / ST), nz = Math.ceil((B.z1 - B.z0) / ST), lab = new Int16Array(nx * nz).fill(-1), area = [];
    const land = (ix, iz) => world.heightAt(B.x0 + ix * ST, B.z0 + iz * ST) > -1;
    for (let s = 0; s < nx * nz; s++) {
      if (lab[s] !== -1 || !land(s % nx, (s / nx) | 0)) continue;
      const id = area.length; let n = 0; const st = [s]; lab[s] = id;
      while (st.length) { const c = st.pop(); n++; const cx = c % nx, cz = (c / nx) | 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nx || z >= nz) continue; const k = z * nx + x; if (lab[k] === -1 && land(x, z)) { lab[k] = id; st.push(k); } } }
      area.push(n);
    }
    const near = sp => { const cx = Math.round((sp.x - B.x0) / ST), cz = Math.round((sp.z - B.z0) / ST);
      for (let r = 0; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, z = cz + dz; if (x >= 0 && z >= 0 && x < nx && z < nz && lab[z * nx + x] >= 0) return lab[z * nx + x]; } return -1; };
    islandAt = (x, z) => { const ix = Math.round((x - B.x0) / ST), iz = Math.round((z - B.z0) / ST); return ix >= 0 && iz >= 0 && ix < nx && iz < nz ? lab[iz * nx + ix] : -1; };
    for (const sp of spots) sp.i = near(sp);
    let bigId = -1; for (let i = 0; i < area.length; i++) if (bigId < 0 || area[i] > area[bigId]) bigId = i;
    for (const sp of spots) sp.big = sp.i === bigId;
    console.log('[острова]', spots.map(s => `${s.n}: остров ${s.i}${s.big ? ' (большой)' : ''}`).join('; '));
  }
  /* карта достижимости: суша, связанная пешком с побережьем (на остров всегда можно доплыть), без клеток внутри твёрдых построек */
  function reachMap() {
    const B = world.bounds, ST = 10, nx = Math.ceil((B.x1 - B.x0) / ST), nz = Math.ceil((B.z1 - B.z0) / ST), seen = new Uint8Array(nx * nz), X = i => B.x0 + i * ST, Z = j => B.z0 + j * ST;
    const land = (i, j) => world.heightAt(X(i), Z(j)) > 0.3, free = (i, j) => land(i, j) && !(world.blockedAt && world.blockedAt(X(i), Z(j), 1.2));
    const q = []; const push = (i, j) => { if (i < 0 || j < 0 || i >= nx || j >= nz) return; const k = j * nx + i; if (seen[k] || !free(i, j)) return; seen[k] = 1; q.push(k); };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (land(i, j) && (!land(i + 1, j) || !land(i - 1, j) || !land(i, j + 1) || !land(i, j - 1))) push(i, j);      // берег
    for (let h = 0; h < q.length; h++) { const k = q[h], i = k % nx, j = (k / nx) | 0; push(i + 1, j); push(i - 1, j); push(i, j + 1); push(i, j - 1); }
    return { has: (x, z) => { const i = Math.round((x - B.x0) / ST), j = Math.round((z - B.z0) / ST); return i >= 0 && j >= 0 && i < nx && j < nz && seen[j * nx + i] === 1; }, size: q.length };
  }
  function buildInfo() {
    const spots = Object.entries(world.spots).map(([n, s]) => ({ n, x: +s.x.toFixed(1), z: +s.z.toFixed(1), y: +Math.max(0, world.heightAt(s.x, s.z)).toFixed(1), yaw: s.yaw || 0 }));
    markIslands(spots);
    const cand = [], B = world.bounds, reach = reachMap(), CLIMB = 14;      // CLIMB: с земли персонаж забирается на выступ до ~14 ед. (прыжок ≈5.5 + подтягивание за кромку на 6…10.8)
    // крыши/верхушки построек: только то, на что реально можно забраться — не выше CLIMB над ближайшей достижимой землёй, без домов с дверью (их крыши не твёрдые) и без кораблей/деревьев
    const roofOk = b => {
      if (b.houses || b.kind === 'ship' || b.kind === 'boat' || b.kind === 'tree' || b.grab === false || b.removed) return false;
      let best = -1; for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
        const px = dx < 0 ? b.x0 - 3 : dx > 0 ? b.x1 + 3 : (b.x0 + b.x1) / 2, pz = dz < 0 ? b.z0 - 3 : dz > 0 ? b.z1 + 3 : (b.z0 + b.z1) / 2;
        if (reach.has(px, pz)) best = Math.max(best, Math.max(0, world.heightAt(px, pz)));
      }
      return best >= 0 && b.y1 - best <= CLIMB;
    };
    const boxes = (world.solidBoxes || []).filter(b => { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, gr = Math.max(0, world.heightAt(cx, cz)); return b.y1 - gr >= 3 && b.x1 - b.x0 >= 4 && b.z1 - b.z0 >= 4 && b.y1 < 500 && roofOk(b); });
    for (const b of shuffle(boxes).slice(0, 70)) cand.push([(b.x0 + b.x1) / 2, b.y1 + 1.6, (b.z0 + b.z1) / 2]);
    // вершины рельефа: идти пешком можно везде (подъём до 45 ед/с), поэтому важно только, чтобы точка была связана с побережьем и не стояла внутри постройки
    const pts = []; for (let x = B.x0; x < B.x1; x += 60) for (let z = B.z0; z < B.z1; z += 60) { const h = world.heightAt(x, z); if (h > 25 && reach.has(x, z)) pts.push([x, h, z]); }
    pts.sort((a, b) => b[1] - a[1]); for (const p of shuffle(pts.slice(0, Math.max(40, Math.floor(pts.length * 0.25)))).slice(0, 70)) cand.push([p[0], p[1] + 1.6, p[2]]);
    // низкие места: полянки на суше (если высоких мест мало — реликвии всё равно должны быть в мире)
    if (cand.length < 30) { const flat = []; for (let x = B.x0; x < B.x1; x += 80) for (let z = B.z0; z < B.z1; z += 80) { const h = world.heightAt(x, z); if (h > 2 && reach.has(x, z)) flat.push([x, h + 1.6, z]); } for (const p of shuffle(flat).slice(0, 40)) cand.push(p); }
    if (cand.length < 10) for (const s of spots) cand.push([s.x + 6, s.y + 1.6, s.z + 6]);
    const shipsInfo = SH ? SH.list.map((v, k) => ({ k, x: +v.g.position.x.toFixed(1), z: +v.g.position.z.toFixed(1), yaw: +v.yaw.toFixed(3), L: +v.L.toFixed(1), W: +v.W.toFixed(1) })) : [];
    if (SH) for (const v of SH.list.slice(0, 8)) cand.push([v.g.position.x, v.g.position.y + 5, v.g.position.z]);      // палубы кораблей (по положению на старте)
    return { spots, ships: shipsInfo, relic: cand.map(c => c.map(v => +v.toFixed(1))) };
  }
  let lastInfo = null, lastWorldT = -99;
  try { lastInfo = buildInfo(); } catch (e) { console.error('buildInfo', e); try { lastInfo = { spots: Object.entries(world.spots).map(([n, s]) => ({ n, x: s.x, z: s.z, y: Math.max(0, world.heightAt(s.x, s.z)), yaw: s.yaw || 0 })), ships: [], relic: [] }; } catch (e2) { console.error(e2); } }
  if (lastInfo) net.sendWorld(lastInfo);

  /* ───── HUD ───── */
  const css = document.createElement('style');
  css.textContent = `
  #gHud{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:46;display:none;text-align:center;color:#fff;font:700 15px -apple-system,"Segoe UI",sans-serif;text-shadow:0 1px 3px #000;pointer-events:none}
  #gHud .bx{background:rgba(10,20,30,.7);border-radius:12px;padding:6px 14px;display:inline-block;min-width:200px}
  #gHud small{font-weight:400;opacity:.9;display:block}
  #gBan{position:fixed;top:13%;left:50%;transform:translate(-50%,-50%);z-index:47;background:rgba(10,20,30,.82);color:#fff;border-radius:16px;padding:16px 28px;font:800 26px -apple-system,sans-serif;text-align:center;display:none;pointer-events:none;max-width:90vw}
  #gFeed{position:fixed;top:10px;right:10px;z-index:46;display:flex;flex-direction:column;gap:3px;align-items:flex-end;pointer-events:none;font:13px -apple-system,sans-serif}
  #gFeed div{background:rgba(10,20,30,.62);color:#fff;border-radius:8px;padding:3px 9px}
  #gBlind{position:fixed;inset:0;background:#000;z-index:44;display:none;place-items:center;color:#fff;font:800 28px -apple-system,sans-serif;text-align:center}
  #gIntro{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:48;display:none;width:min(520px,92vw);background:rgba(10,20,30,.88);color:#fff;border-radius:18px;padding:18px 24px;font:15px/1.45 -apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6);pointer-events:none;text-align:left}
  #gIntro h2{margin:0 0 2px;font-size:28px;text-align:center;color:#ffd84a} #gIntro h3{margin:0 0 10px;font-size:19px;text-align:center}
  #gIntro b{color:#ffd84a} #gIntro ul{margin:4px 0 0;padding-left:20px} #gIntro .who{margin-top:10px;text-align:center;font-weight:700}
  #gPrompt{position:fixed;left:50%;bottom:26%;transform:translateX(-50%);z-index:46;display:none;max-width:90vw;background:rgba(10,20,30,.82);color:#fff;border-radius:12px;padding:8px 16px;font:700 16px -apple-system,sans-serif;pointer-events:none;text-align:center}
  #gDead{position:fixed;inset:0;z-index:43;display:none;place-items:center;background:rgba(120,0,0,.35);color:#fff;font:800 26px -apple-system,sans-serif;pointer-events:none;text-shadow:0 2px 6px #000}`;
  document.head.appendChild(css);
  const mk = (id, cls) => { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); return d; };
  const hud = mk('gHud'), ban = mk('gBan'), feed = mk('gFeed'), blind = mk('gBlind'), dead = mk('gDead'), intro = mk('gIntro');
  /* ───── табличка голосования (поверх игры, не в меню): сначала режим, потом — остров ───── */
  const vcss = document.createElement('style');
  vcss.textContent = `#gVote{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:49;display:none;width:min(560px,94vw);background:rgba(10,20,30,.92);color:#fff;border-radius:18px;padding:16px 20px;font:14px/1.4 -apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)}
  #gVote h2{margin:0 0 2px;font-size:22px;text-align:center;color:#ffd84a} #gVote .sub{text-align:center;opacity:.8;margin-bottom:10px;font-size:13px}
  #gVote .opts{display:grid;grid-template-columns:1fr 1fr;gap:8px} #gVote button{background:rgba(255,255,255,.1);color:#fff;border:2px solid transparent;border-radius:12px;padding:9px 10px;font:inherit;cursor:pointer;text-align:left}
  #gVote button:hover{background:rgba(255,255,255,.2)} #gVote button.sel{border-color:#ffd84a;background:rgba(255,216,74,.18)} #gVote button b{display:block;font-size:15px} #gVote button small{opacity:.75;display:block;font-size:11.5px;line-height:1.25} #gVote .n{float:right;font-weight:800;color:#ffd84a}`;
  document.head.appendChild(vcss);
  const vote = mk('gVote'); let voteSig = '', voteWas = false;
  vote.addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (!b) return; if (G.iv) net.send({ t: 'ivote', i: +b.dataset.k }); else net.send({ t: 'vote', mode: b.dataset.k }); });
  function renderVote() {
    if (G.an) banner('🎮 ' + G.an.text, 1.5);      // выбор сделан: название на экране, потом спавнится игра
    const iv = G.iv, modeVote = !iv && G.phase !== 'play' && G.phase !== 'over' && G.cd != null && !G.armed && net.online && (net.roster || []).filter(p => p.play).length >= 2;
    const meVoting = !!(net.me && net.me.play);
    if (!(iv || modeVote) || !meVoting) { vote.style.display = 'none'; voteSig = ''; voteWas = false; return; }
    const mine = ((iv ? iv.pv : G.pv) || []).find(a => a[0] === net.id), my_ = mine ? mine[1] : null, vc = (iv ? iv.votes : G.votes) || {}, cd = iv ? iv.cd : G.cd;
    const sig = (iv ? 'i' : 'm') + '|' + my_ + '|' + JSON.stringify(vc) + '|' + (iv ? JSON.stringify(iv.opts) : '');
    if (!voteWas) { voteWas = true; document.exitPointerLock && document.exitPointerLock(); }      // чтобы можно было кликнуть
    vote.style.display = 'block';
    if (sig !== voteSig) {
      voteSig = sig;
      const btns = iv ? iv.opts.map(o => `<button data-k="${o.i}" class="${my_ === o.i ? 'sel' : ''}"><span class="n">${vc[o.i] ? '🗳 ' + vc[o.i] : ''}</span><b>🏝 Остров ${o.i + 1}</b><small>${o.n}</small></button>`).join('')
        : Object.entries(MODE_INFO).map(([k, m]) => `<button data-k="${k}" class="${my_ === k ? 'sel' : ''}"><span class="n">${vc[k] ? '🗳 ' + vc[k] : ''}</span><b>${m.icon} ${m.name}</b><small>${m.desc}</small></button>`).join('');
      vote.innerHTML = `<h2>${iv ? '🗺 Голосуем за остров' : '🗳 Голосуем за режим'}</h2><div class="sub">${iv ? MODE_INFO[iv.mode].icon + ' ' + MODE_INFO[iv.mode].name + ' · ' : ''}осталось <span id="gVoteCd"></span> с · старт, когда проголосуют все</div><div class="opts">${btns}</div>`;
    }
    const c = vote.querySelector('#gVoteCd'); if (c) c.textContent = cd;
  }
  let introT = 0;
  function showIntro() {                       // «Игра началась»: режим, цель, правила и кто вы — одним окном
    const info = MODE_INFO[G.mode]; if (!info) return; const a = my(), tm = a && a[3], sk = a && a[6];
    const who = G.mode === 'hide' ? (sk ? '👀 Вы — ИСКАТЕЛЬ' : '🙈 Вы прячетесь') : tm ? 'Ваша команда: ' + TEAM[tm] : '';
    intro.innerHTML = `<h2>🎮 Игра началась!</h2><h3>${info.icon} ${info.name}</h3><div>🎯 <b>Цель:</b> ${info.goal}</div><div style="margin-top:8px">📜 <b>Правила:</b></div><ul>${info.rules.map(r => `<li>${r}</li>`).join('')}</ul>${who ? `<div class="who">${who}</div>` : ''}`;
    intro.style.display = 'block'; introT = 11;
  }
  let banT = 0;
  const banner = (text, sec = 5) => { ban.textContent = text; ban.style.display = 'block'; banT = sec; };
  const feedAdd = text => { const d = document.createElement('div'); d.textContent = text; feed.appendChild(d); while (feed.children.length > 6) feed.firstChild.remove(); setTimeout(() => d.remove(), 9000); };

  /* ───── 3D-объекты ───── */
  const root = new THREE.Group(); scene.add(root);
  /* зона сужения («Битва»): красноватая стена-цилиндр; вне неё — урон (считаем у себя), на HUD — таймер */
  let zoneMesh = null, outT = 0;
  const zoneTick = dt => {
    const zn = (G.mode === 'battle' || G.mode === 'naval') && G.phase === 'play' && meIn() ? G.zn : null;
    if (!zn) { if (zoneMesh) zoneMesh.visible = false; outT = 0; return; }
    if (!zoneMesh) {
      zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 500, 96, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      zoneMesh.frustumCulled = false; zoneMesh.renderOrder = 5; root.add(zoneMesh);
    }
    zoneMesh.visible = true; zoneMesh.position.set(zn[0], 100, zn[1]); zoneMesh.scale.set(zn[2], 1, zn[2]);
    const out = Math.hypot(P.pos.x - zn[0], P.pos.z - zn[1]) > zn[2];
    if (G.mode === 'naval') { const ms = myShip(), o = ms && Math.hypot(ms.g.position.x - zn[0], ms.g.position.z - zn[1]) > zn[2]; if (o && outT === 0) banner('⚠ Корабль вне зоны! Плывите к центру', 3); outT = o ? 1 : 0; return; }      // в морском бою урон считает сервер
    if (out && !P.dead) {
      if (outT === 0) banner('⚠ Вы вне зоны! Бегите к центру', 3); outT += dt; lastHurtT = T();
      P.hp -= 5 * dt; if (P.hp <= 0) { P.hp = 0; richard.hurt(9999, P.pos.x, P.pos.y, P.pos.z); }      // гибель вне зоны оформляется обычной смертью
    } else outT = 0;
  };
  const relicObjs = new Map(), pointObjs = [], baseObjs = {}, flagObjs = {}, carryOnRemote = new Map();
  const makeRelic = v => {      // маленькая и незаметная: ни луча, ни кольца — найти её можно, только подойдя близко (видна ближе 28 м)
    const g = new THREE.Group(), gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshStandardMaterial({ color: v === 3 ? 0xfff070 : 0xffd84a, emissive: v === 3 ? 0xffaa00 : 0xb87800, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 }));
    gem.scale.y = 1.4; if (v === 3) gem.scale.multiplyScalar(1.5); g.add(gem); g.userData = { gem }; g.visible = false; return g;
  };
  const makeFlag = (color, k = 1) => {
    const g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * k, 0.25 * k, 14 * k, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd })); pole.position.y = 7 * k;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(6 * k, 3.6 * k), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); cloth.position.set(3 * k, 12 * k, 0);
    g.add(pole, cloth); g.userData.cloth = cloth; return g;
  };
  const makeRing = (r, color) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - 1.2, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; };
  const born = o => { o.userData.born = T(); o.scale.setScalar(0.01); return o; };        // объекты не «выскакивают», а вырастают за секунду
  const disposeObj = o => { o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); o.removeFromParent(); };
  const crateObjs = [];
  const carryLocal = makeFlag(0xffffff, 0.8); carryLocal.visible = false; scene.add(carryLocal);

  function clearWorldObjs() {
    for (const o of relicObjs.values()) disposeObj(o); relicObjs.clear(); for (const o of pkObjs.values()) disposeObj(o); pkObjs.clear();
    for (const o of pointObjs) disposeObj(o.g); pointObjs.length = 0;
    for (const k of Object.keys(baseObjs)) { disposeObj(baseObjs[k]); delete baseObjs[k]; }
    for (const k of Object.keys(flagObjs)) { disposeObj(flagObjs[k]); delete flagObjs[k]; }
    for (const o of carryOnRemote.values()) disposeObj(o.m); carryOnRemote.clear(); carryLocal.visible = false;
  }

  const my = () => (G.pl || []).find(a => a[0] === net.id);
  const meIn = () => G.phase === 'play' && !!my();
  let lastHiders = -1, seekSince = 0, stepT = 0, fpT = 0, decoyUsed = false; const stepPos = new Map(), prints = [];
  const fpGeo = new THREE.CircleGeometry(0.35, 8).rotateX(-Math.PI / 2), fpMat = new THREE.MeshBasicMaterial({ color: 0x3a2a1a, transparent: true, opacity: 0.6, depthWrite: false });
  net.on('decoy', m => { let n = 0; const iv = setInterval(() => { const d = Math.hypot(m.x - P.pos.x, m.z - P.pos.z); if (d < 90) bang(0.35 * (1 - d / 90)); if (++n >= 6) clearInterval(iv); }, 800); });
  net.on('radar', m => {      // радар искателя: красный столб-круг на 8 с
    if (!mySeeker()) return; const c = new THREE.Mesh(new THREE.CylinderGeometry(m.r, m.r, 160, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    c.position.set(m.x, P.pos.y + 40, m.z); scene.add(c); banner('📡 Радар: в красном круге кто-то прячется', 4); setTimeout(() => { scene.remove(c); c.geometry.dispose(); c.material.dispose(); }, 8000);
  });      // прятки: счётчик прячущихся, усталость и шаги
  const mySeeker = () => { const a = my(); return !!(a && a[6]); };
  const myTeam = () => { const a = my(); return a ? a[3] : null; };

  /* ───── морской бой ───── */
  let navalUsed = false, sendShipT = 0; const balls = new Map(), fx = [];
  const fxRoot = new THREE.Group(); scene.add(fxRoot);
  const mat = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
  const ballGeo = new THREE.SphereGeometry(0.55, 10, 8), ballMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.5, metalness: 0.6 });
  function puff(x, y, z, color, s0, s1, dur) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(color, 0.85)); m.position.set(x, y, z); m.scale.setScalar(s0); fxRoot.add(m); fx.push({ m, t: 0, dur, s0, s1 }); }
  function bang(vol) { try { const AC = window.AudioContext || window.webkitAudioContext; const ac = bang.ac || (bang.ac = new AC()), n = ac.sampleRate * 0.5, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain(); f.type = 'lowpass'; f.frequency.value = 500; gn.gain.value = vol; s.buffer = buf; s.connect(f); f.connect(gn); gn.connect(ac.destination); s.start(); } catch { /* звук необязателен */ } }
  const distTo = (x, z) => Math.hypot(x - P.pos.x, z - P.pos.z), vol = (x, z) => Math.max(0.05, Math.min(0.9, 90 / (30 + distTo(x, z))));
  function applyNaval(m, prev) {
    navalUsed = true; for (const v of SH.list) v.hp = null; for (const [k, hp] of m.nv || []) if (SH.list[k]) SH.list[k].hp = hp; const owned = new Set(m.pl.map(a => a[8]));
    SH.list.forEach((v, k) => { v.frozen = !owned.has(k); });
    for (const a of m.pl) { const v = SH.list[a[8]]; if (v) { v.remote = a[0] !== net.id; v.hp = a[7]; } }
    const was = (prev.pl || []).find(a => a[0] === net.id), now = m.pl.find(a => a[0] === net.id);
    if (was && now && was[7] > 0 && now[7] <= 0) banner('⚓ Ваш корабль потоплен! Вы выбыли — плывите к берегу', 6);
  }
  const myShip = () => { const a = my(); return a && a[8] != null && SH ? SH.list[a[8]] : null; };
  const shipDbg = { rx: 0, tx: 0, lastRx: -99, lastK: -1, mine: -1 };      // счётчики для строки диагностики на миникарте
  net.on('ship', m => { if (!SH) return; shipDbg.rx++; shipDbg.lastRx = T(); shipDbg.lastK = m.k; const v = SH.list[m.k]; if (!v || SH.riding() === v) return; v.remote = true; v.lastNet = T(); v.tgt = { x: m.x, z: m.z, yaw: m.yaw }; v.sailsUp = !!m.su; });      // кто-то правит этим кораблём — повторяем за ним
  net.on('shot', m => {
    const mesh = new THREE.Mesh(ballGeo, ballMat); mesh.position.set(m.x, m.y, m.z); fxRoot.add(mesh); balls.set(m.b, { m: mesh, vx: m.vx, vy: m.vy, vz: m.vz });
    puff(m.x, m.y + 0.3, m.z, 0xdddddd, 0.6, 3.2, 1.1); bang(vol(m.x, m.z) * 0.6);
    { const sv = SH && SH.list[m.s], q = sv && sv.guns && sv.guns[m.gun]; if (q) q.recoil = 1; }
  });
  net.on('slow', m => { if (G.mode !== 'naval') return; shipSlowUntil = T() + m.s; banner('⛓ Цепное ядро! Корабль замедлен', 2); });
  net.on('boom', m => {
    const b = balls.get(m.b); if (b) { b.m.removeFromParent(); balls.delete(m.b); }
    if (m.h) { puff(m.x, m.y, m.z, 0xff8a1f, 0.8, 5.5, 0.7); puff(m.x, m.y + 1, m.z, 0x333333, 0.6, 6.5, 1.6); bang(vol(m.x, m.z)); }
    else { puff(m.x, 0.3, m.z, 0xbfe6ff, 0.5, 4.2, 0.8); }
  });
  /* ───── пушки: подойти → E (встать за пушку) → A/D поворот ствола, W/S угол, X выстрел, E отойти. Сервер проверяет, что вы стоите у пушки ───── */
  const AIM = { speed: 88, g: 30, elMin: 0.03, elMax: 0.62, relMax: 1.1 }, reloadGun = {}, keysG = new Set(); let gunner = null, chainShot = false, shipSlowUntil = 0, deadAt = 0;
  const gPrompt = mk('gPrompt'), aimGeo = new THREE.BufferGeometry();
  aimGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(70 * 3), 3));
  const aimLine = new THREE.Line(aimGeo, new THREE.LineBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.95, depthTest: false, fog: false })), aimRing = makeRing(7, 0xffe14a);
  aimLine.frustumCulled = false; aimLine.renderOrder = 40; aimLine.visible = false; aimRing.material.depthTest = false; aimRing.renderOrder = 40; aimRing.visible = false; fxRoot.add(aimLine, aimRing);
  const gunWorld = (v, i) => { const q = v.guns[i], fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), off = v.W * 0.5 - 1.3, al = q.along * v.L; return { x: v.g.position.x + Math.cos(v.yaw) * q.side * off + fx * al, z: v.g.position.z - Math.sin(v.yaw) * q.side * off + fz * al }; };
  const aimYaw = () => gunner.v.yaw + gunner.v.guns[gunner.i].side * Math.PI / 2 + gunner.rel;
  function nearGun(mine) { const y = SH.deckY(mine); let best = null; for (let i = 0; i < mine.guns.length; i++) { const w = gunWorld(mine, i), d = Math.hypot(w.x - P.pos.x, w.z - P.pos.z); if (d < 3.4 && Math.abs(P.pos.y - y) < 3 && (!best || d < best.d)) best = { i, d }; } return best; }
  function takeGun(v, i) { gunner = { v, i, rel: 0, el: 0.2 }; window.__gunner = true; richard.clearKeys(); }
  function leaveGun() { if (!gunner) return; const q = gunner.v.guns[gunner.i]; q.pivot.rotation.y = q.side * Math.PI / 2; q.barrel.rotation.x = 0; gunner = null; window.__gunner = false; aimLine.visible = aimRing.visible = false; gPrompt.style.display = 'none'; }
  function fireGun() { const t = T(); if (!gunner || (reloadGun[gunner.i] || 0) > t) return; reloadGun[gunner.i] = t + 1; net.send({ t: 'fire', ch: chainShot ? 1 : 0, gun: gunner.i, yaw: +aimYaw().toFixed(4), el: +gunner.el.toFixed(4) }); }
  addEventListener('keydown', e => {
    if (e.repeat || !SH || /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) return;
    if (e.code === 'KeyE') {
      if (gunner) { leaveGun(); return; }
      const mine = meIn() && G.mode === 'naval' && !P.dead ? myShip() : null; if (!mine || !mine.guns || SH.nearHelm() || SH.riding()) return;
      const c = nearGun(mine); if (c) takeGun(mine, c.i); return;
    }
    keysG.add(e.code); if (gunner && e.code === 'KeyX') fireGun();
  });
  addEventListener('keyup', e => keysG.delete(e.code)); addEventListener('blur', () => keysG.clear());
  function gunnerUpdate(dt, mine, naval) {
    for (const v of SH.list) if (v.guns) for (const q of v.guns) if (q.recoil > 0) { q.recoil = Math.max(0, q.recoil - dt * 3.2); q.barrel.position.z = -0.7 * q.recoil; }      // откат ствола после выстрела
    const a = my();
    if (gunner && (!naval || !mine || mine !== gunner.v || !a || a[7] <= 0 || P.dead)) leaveGun();
    if (!gunner) {
      aimLine.visible = aimRing.visible = false;
      const c = naval && mine && mine.guns && a && a[7] > 0 && !P.dead && !SH.riding() && !SH.nearHelm() ? nearGun(mine) : null;
      gPrompt.style.display = c ? 'block' : 'none'; if (c) gPrompt.textContent = '🎯 E — встать к пушке №' + (c.i + 1) + ' (прицелиться и стрелять)';
      return;
    }
    const q = gunner.v.guns[gunner.i], sh = keysG.has('ShiftLeft') || keysG.has('ShiftRight') ? 0.3 : 1;
    gunner.rel = Math.max(-AIM.relMax, Math.min(AIM.relMax, gunner.rel + ((keysG.has('KeyA') ? 1 : 0) - (keysG.has('KeyD') ? 1 : 0)) * dt * 0.7 * sh));      // A — ствол влево, D — вправо
    gunner.el = Math.max(AIM.elMin, Math.min(AIM.elMax, gunner.el + ((keysG.has('KeyW') ? 1 : 0) - (keysG.has('KeyS') ? 1 : 0)) * dt * 0.35 * sh));        // W — выше, S — ниже
    q.pivot.rotation.y = q.side * Math.PI / 2 + gunner.rel; q.barrel.rotation.x = -gunner.el;
    const w = gunWorld(gunner.v, gunner.i), yaw = aimYaw(), dx = Math.sin(yaw), dz = Math.cos(yaw);
    P.pos.set(w.x - dx * 2.4, SH.deckY(gunner.v) + 0.05, w.z - dz * 2.4); P.vel.set(0, 0, 0); P.yaw = P.yawVis = yaw; richard.clearKeys();      // стоим позади ствола и смотрим по линии огня
    // траектория: те же формулы, что у сервера
    const pos = aimGeo.attributes.position.array, hv = AIM.speed * Math.cos(gunner.el); let x = w.x + dx * 2.6, y = 3.4, z = w.z + dz * 2.6, vy = AIM.speed * Math.sin(gunner.el), n = 0;
    for (; n < 70; n++) { pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; if (y < 0 && n > 0) break; x += dx * hv * 0.07; z += dz * hv * 0.07; y += vy * 0.07; vy -= AIM.g * 0.07; }
    aimGeo.setDrawRange(0, Math.min(n + 1, 70)); aimGeo.attributes.position.needsUpdate = true; aimLine.visible = true;
    aimRing.position.set(x, 0.6, z); aimRing.visible = true;
    const wait = Math.max(0, Math.ceil((reloadGun[gunner.i] || 0) - T()));
    gPrompt.style.display = 'block'; gPrompt.textContent = `🎯 Пушка №${gunner.i + 1} · дальность ≈ ${Math.round(Math.hypot(x - w.x, z - w.z))} м · A/D — поворот, W/S — угол, Shift — точнее · X — ВЫСТРЕЛ ${wait ? '(перезарядка ' + wait + ' с)' : '✔'} · E — отойти`;
  }
  /* метки над чужими кораблями: за туманом (с 500 м) корабль не разглядеть — метка с именем и расстоянием видна всегда */
  const markers = new Map(), mhue = id => `hsl(${(id * 67) % 360},85%,58%)`;
  function drawMarker(m, name, dist) { const g = m.cv.getContext('2d'); g.clearRect(0, 0, 256, 96); g.fillStyle = 'rgba(10,20,30,.72)'; g.beginPath(); g.roundRect(4, 6, 248, 58, 14); g.fill(); g.font = 'bold 28px -apple-system,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = m.col; g.fillText('⚓ ' + name, 128, 24); g.fillStyle = '#fff'; g.font = '24px -apple-system,sans-serif'; g.fillText(dist + ' м', 128, 49); g.fillStyle = m.col; g.beginPath(); g.moveTo(112, 66); g.lineTo(144, 66); g.lineTo(128, 90); g.closePath(); g.fill(); m.tex.needsUpdate = true; }
  function clearMarkers() { for (const m of markers.values()) { m.sp.removeFromParent(); m.tex.dispose(); m.sp.material.dispose(); } markers.clear(); }
  function updateMarkers() {
    const seen = new Set(), nm = new Map((net.roster || []).map(p => [p.id, p.name]));
    for (const a of G.pl || []) {
      const v = a[0] !== net.id && SH.list[a[8]]; if (!v || a[7] <= 0) continue; seen.add(a[0]);
      let m = markers.get(a[0]);
      if (!m) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const tex = new THREE.CanvasTexture(cv), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false })); sp.renderOrder = 30; fxRoot.add(sp); m = { cv, tex, sp, col: mhue(a[0]), last: -1 }; markers.set(a[0], m); }
      const dist = Math.hypot(v.g.position.x - P.pos.x, v.g.position.z - P.pos.z);
      m.sp.position.set(v.g.position.x, v.y0 + 26, v.g.position.z); const s = Math.min(90, Math.max(5, dist * 0.04)); m.sp.scale.set(s * 2.67, s, 1); m.sp.visible = dist > 50;
      const d10 = Math.round(dist / 10) * 10; if (d10 !== m.last) { m.last = d10; drawMarker(m, nm.get(a[0]) || 'Игрок', d10); }
    }
    for (const [id, m] of [...markers]) if (!seen.has(id)) { m.sp.removeFromParent(); m.tex.dispose(); m.sp.material.dispose(); markers.delete(id); }
  }
  function navalUpdate(dt) {
    const t = T();
    for (const [id, b] of balls) { b.m.position.x += b.vx * dt; b.m.position.z += b.vz * dt; b.m.position.y += b.vy * dt; b.vy -= 30 * dt; if (b.m.position.y < -3) { b.m.removeFromParent(); balls.delete(id); } }
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; const u = f.t / f.dur; if (u >= 1) { f.m.removeFromParent(); f.m.material.dispose(); f.m.geometry.dispose(); fx.splice(i, 1); continue; } f.m.scale.setScalar(f.s0 + (f.s1 - f.s0) * Math.sqrt(u)); f.m.material.opacity = 0.85 * (1 - u); }
    if (!SH) return;
    const k = 1 - Math.exp(-10 * dt), mine = myShip(), naval = navalUsed && G.mode === 'naval', riden = SH.riding();
    gunnerUpdate(dt, mine, naval && G.phase === 'play');
    if (mine) mine.slowK = t < shipSlowUntil ? 0.4 : 1;
    { const a_ = my();      // потопленный: через 4 с переносимся на палубу живого корабля и наблюдаем за боем
      if (naval && G.phase === 'play' && a_ && a_[7] <= 0) { if (!deadAt) deadAt = t; else if (deadAt > 0 && t - deadAt > 4) { deadAt = -1; let tg = null; for (const b of G.pl || []) if (b[0] !== net.id && b[7] > 0 && SH.list[b[8]]) tg = SH.list[b[8]]; if (tg) { richard.teleport(tg.g.position.x, tg.g.position.z, 0); banner('👁 Вы наблюдаете за боем с палубы корабля', 4); } } } else deadAt = 0; }
    SH.list.forEach((v, k_) => {
      if (naval && v.hp != null && v.hp <= 0) { SH.sink(v, dt); if (v === mine && riden === v) SH.release(); return; }
      if (!naval) {                                                      // свободная игра: корабли общие. Правит тот, кто у штурвала (и пока корабль плывёт сам после него)
        if (riden === v) { v.remote = false; v.mineT = t; }
        else if (v.remote && t - (v.lastNet || 0) > 1.5) v.remote = false;      // давно нет вестей — корабль снова «свой»
        if (!v.remote && (riden === v || (v.mineT && t - v.mineT < 600 && (v.sailsUp || Math.abs(v.rv) > 0.05))) && (v.sendT = (v.sendT || 0) + dt) > 0.1) { v.sendT = 0; shipDbg.tx++; shipDbg.mine = k_; net.send({ t: 'ship', k: k_, x: +v.g.position.x.toFixed(2), z: +v.g.position.z.toFixed(2), yaw: +v.yaw.toFixed(3), su: v.sailsUp ? 1 : 0 }); }
      }
      if (v.remote && v.tgt && !(naval && v.hp != null && v.hp <= 0)) { const x = v.g.position.x + (v.tgt.x - v.g.position.x) * k, z = v.g.position.z + (v.tgt.z - v.g.position.z) * k, d = Math.atan2(Math.sin(v.tgt.yaw - v.yaw), Math.cos(v.tgt.yaw - v.yaw)); SH.setPoseCarry(v, x, z, v.yaw + d * k); }
    });
    if (!naval) { if (markers.size) clearMarkers(); return; }
    updateMarkers();
    if (G.phase === 'play' && mine && mine.hp > 0 && (sendShipT += dt) > 0.1) { sendShipT = 0; net.send({ t: 'ship', x: +mine.g.position.x.toFixed(2), z: +mine.g.position.z.toFixed(2), yaw: +mine.yaw.toFixed(3), su: mine.sailsUp ? 1 : 0 }); }
  }

  function applyGame(m) {
    const prev = G; G = m;
    { const sg = [m.phase, m.mode, m.cd != null, !!m.iv, !!m.an, !!(net.me && net.me.play)].join('|'); if (sg !== applyGame.sg) { applyGame.sg = sg; window.__dbg && window.__dbg('game ' + sg + ' np=' + m.np); } }
    if (m.world === false && lastInfo && T() - lastWorldT > 3) { lastWorldT = T(); net.sendWorld(lastInfo); }      // сервер не получил данные карты — шлём ещё раз
    if (m.phase !== lastPhase) {
      if (m.phase !== 'play') { clearWorldObjs(); net.hideLabels = false; net.setTeams({}); intro.style.display = 'none'; introT = 0; if (P.dead) richard.respawnAt(P.pos.x, P.pos.z, 0); }
      if (m.phase === 'play') { clearWorldObjs(); G = m; showIntro(); if (SH && m.mode === 'naval') SH.reset(); }
      lastPhase = m.phase;
    }
    if (m.phase !== 'play') renderHud();
    window.__gameLock = meIn() && m.mode !== 'explore';     // телепорт и облёт выключены в любом активном режиме, кроме «Изучения»
    if (m.phase === 'over') banner('🏆 ' + (m.winner || 'Конец игры'), 9);
    if (SH && (m.phase === 'play' || m.phase === 'over') && m.mode === 'naval') applyNaval(m, prev);
    if (m.phase === 'idle' && navalUsed) { navalUsed = false; SH.release(); SH.reset(); for (const b of balls.values()) disposeObj(b.m); balls.clear(); clearMarkers(); leaveGun(); }
    if (m.phase !== 'play') return;
    net.hideLabels = m.mode === 'hide';
    if (m.mode === 'capture' || m.mode === 'ctf') { const map = {}; for (const a of m.pl) if (a[3]) map[a[0]] = CSS[a[3]]; net.setTeams(map); }
    if (m.pk) {      // аптечки (зелёные) и щиты (синие)
      const ids = new Set(m.pk.map(a => a[0]));
      for (const [id, o] of [...pkObjs]) if (!ids.has(id)) { disposeObj(o); pkObjs.delete(id); }
      for (const a of m.pk) if (!pkObjs.has(a[0])) { const o = makeRing(3, a[4] === 'h' ? 0x3fdc5a : 0x4aa8ff); o.position.set(a[1], a[2] + 1.5, a[3]); o.userData.pk = a; root.add(o); pkObjs.set(a[0], o); }
    } else if (pkObjs.size) { for (const o of pkObjs.values()) disposeObj(o); pkObjs.clear(); }
    // реликвии
    if (m.relics) {
      const ids = new Set(m.relics.map(r => r.id));
      for (const [id, o] of [...relicObjs]) if (!ids.has(id)) { disposeObj(o); relicObjs.delete(id); }
      for (const r of m.relics) if (!relicObjs.has(r.id)) { const o = makeRelic(r.v); o.position.set(r.x, r.y, r.z); o.userData.rid = r.id; born(o); root.add(o); relicObjs.set(r.id, o); }
    }
    // базы и точки
    if (m.bases) for (const T_ of ['red', 'blue']) if (!baseObjs[T_]) { const b = m.bases[T_], g = new THREE.Group(); g.add(makeRing(10, COL[T_])); g.position.set(b.x, b.y + 1, b.z); born(g); root.add(g); baseObjs[T_] = g; }
    if (m.points) {
      if (!pointObjs.length) for (const q of m.points) { const g = new THREE.Group(), f = makeFlag(0xaaaaaa, 1.3), r = makeRing(30, 0xaaaaaa); g.add(f, r); g.position.set(q.x, q.y + 1, q.z); born(g); root.add(g); pointObjs.push({ g, f, r }); }
      m.points.forEach((q, i) => { const o = pointObjs[i]; if (!o) return; const c = q.o ? COL[q.o] : Math.abs(q.p) > 0.02 ? COL[q.p > 0 ? 'red' : 'blue'] : 0xaaaaaa; o.f.userData.cloth.material.color.setHex(c); o.r.material.color.setHex(c); o.r.scale.setScalar(q.o ? 1 : 0.25 + 0.75 * Math.abs(q.p)); o.f.scale.setScalar(q.w === 2 ? 1.5 : 1); o.f.userData.cloth.position.y = (q.o ? 12 : 3 + 9 * Math.abs(q.p)) * 1.3; });
    }
    // флаги CTF: на базе/на земле — обычный флаг; несомый — на плече у носителя
    if (m.flags) for (const f of m.flags) {
      let o = flagObjs[f.team]; if (!o) { o = born(makeFlag(COL[f.team], 1.1)); root.add(o); flagObjs[f.team] = o; }
      o.visible = f.st !== 'carried'; o.position.set(f.x, f.y + 0.5, f.z);
    }
    const carriers = new Map(); for (const a of m.pl) if (a[5]) carriers.set(a[0], a[5]);
    for (const [id, o] of [...carryOnRemote]) if (!carriers.has(id) || o.m.parent !== net.group(id)) { disposeObj(o.m); carryOnRemote.delete(id); }
    for (const [id, tm] of carriers) if (id !== net.id && !carryOnRemote.has(id)) { const g = net.group(id); if (g) { const f = makeFlag(COL[tm], 0.7); f.position.set(0, 9, -1.4); g.add(f); carryOnRemote.set(id, { m: f }); } }
    const mc = my() && my()[5]; window.__carrying = !!mc && G.mode === 'ctf'; carryLocal.visible = !!mc;
    if (m.crates) { for (let i = 0; i < m.crates.length; i++) { const c = m.crates[i]; let o = crateObjs[i]; if (!o) { o = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshBasicMaterial({ color: 0x33dd55 })); born(o); root.add(o); crateObjs[i] = o; } o.position.set(c[0], c[1] + 1.5, c[2]); o.visible = !!c[3]; o.rotation.y += 0.05; } } else { while (crateObjs.length) { const o = crateObjs.pop(); disposeObj(o); } } if (mc) carryLocal.userData.cloth.material.color.setHex(COL[mc]);
    // события «я искатель»
    if (m.mode === 'hide' && mySeeker() && !wasSeeker && prev.phase === 'play' && prev.sub === 'seek') banner('👀 Вас нашли — теперь вы ищете остальных!', 4);
    wasSeeker = mySeeker();
    if (m.mode === 'hide' && m.phase === 'play') { const hn = m.pl.filter(a => !a[6]).length; if (hn !== lastHiders && lastHiders >= 0 && m.sub === 'seek') banner(`🙈 Осталось прячущихся: ${hn}`, 3); lastHiders = hn; } else lastHiders = -1;
    renderHud();
  }

  const fmt = s => s == null ? '' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  function renderHud() {
    renderVote();
    if (G.phase !== 'play' && G.phase !== 'over' && net.online && (net.roster || []).filter(p => p.play).length >= 2 && (G.ver !== 4 || G.world === false)) {
      hud.innerHTML = `<div class="bx">⚠ Игра не может начаться<small>${G.ver !== 4 ? 'Сервер запущен старой версией — остановите его и снова выполните: node server.js' : 'Сервер ещё не получил данные карты — обновите страницу (Cmd+R)'}</small></div>`; hud.style.display = 'block'; return;
    }
    if (G.phase !== 'play' && G.phase !== 'over') {      // игры нет: если режим выбран, ждём второго игрока — пока все ходят свободно
      const am = G.armed && MODE_INFO[G.armed];
      if (G.cd != null && !am) { const dm = G.dm && MODE_INFO[G.dm]; hud.innerHTML = `<div class="bx">👥 Выбор режима: осталось ${G.cd} с<small>${dm ? 'Лидирует: ' + dm.icon + ' ' + dm.name : 'Голосуйте на табличке'} · при ничьей решает первый игрок</small></div>`; hud.style.display = 'block'; return; }
      if (am) { hud.innerHTML = `<div class="bx">${am.icon} ${am.name}<small>⏳ Ждём второго игрока — игра начнётся сама. Пока ходите где хотите</small></div>`; hud.style.display = 'block'; } else hud.style.display = 'none';
      return;
    }
    if (!G.mode) { hud.style.display = 'none'; return; }
    const info = MODE_INFO[G.mode], a = my(); let l1 = `${info.icon} ${info.name}`, l2 = '';
    if (G.left != null && G.phase === 'play') l1 += ` · ${fmt(G.left)}`;
    if (G.mode === 'battle' || G.mode === 'dragons') l2 = `Ваши победы: ${a ? a[1] : 0} / ${G.limit}` + topLine() + (G.mode === 'battle' && G.zn ? (G.zn[3] ? ` · 🔴 зона начнёт сужаться через ${G.zn[3]} с` : ` · 🔴 зона сужается (радиус ${G.zn[2]} м)`) : '');
    else if (G.mode === 'relics') l2 = `Реликвии: ${a ? a[1] : 0} / ${G.limit} · ищите по всему миру · 💎 золотая = 3` + topLine(9) + (G._hint > T() ? ' · 🔥 реликвия в радиусе 80 м!' : '');
    else if (G.mode === 'capture') l2 = `Точки: 🔴 ${G.sc.red} : ${G.sc.blue} 🔵 · нужно больше половины (${G.limit})` + (myTeam() ? ` · вы: ${TEAM[myTeam()]}` : '');
    else if (G.mode === 'ctf') l2 = `🔴 ${G.sc.red} : ${G.sc.blue} 🔵 (до ${G.limit})` + (myTeam() ? ` · вы: ${TEAM[myTeam()]}` : '') + (a && a[5] ? ' · 🚩 вы несёте флаг!' : '');
    else if (G.mode === 'explore') { const nm = new Map((net.roster || []).map(p => [p.id, p.name])); l2 = 'Гуляйте и общайтесь (Enter — чат, N — карта, T — телепорт) · рядом: ' + ((G.pl || []).filter(x => x[0] !== net.id).map(x => nm.get(x[0]) || x[0]).join(', ') || 'никого'); }
    else if (G.mode === 'naval') { const mine_ = myShip(), rl = s => { const w = Math.ceil(reloadAt[s] - T()); return w > 0 ? w + ' с' : '✔'; }, nm = new Map((net.roster || []).map(p => [p.id, p.name])); l2 = a && a[7] <= 0 ? '⚓ Ваш корабль потоплен — вы выбыли' : `⚓ Корпус ${a ? a[7] : 0}% · потоплено ${a ? a[2] : 0} · пушки: E · ядра: ${chainShot ? '⛓ цепные' : '⚫ обычные'} (I) · ремонт O · курс ${mine_ ? Math.round(((mine_.yaw * 180 / Math.PI) % 360 + 360) % 360) + '°' : '-'}` + (G.zn ? (G.zn[3] ? ` · 🔴 зона через ${G.zn[3]} с` : ` · 🔴 зона ${G.zn[2]} м`) : ''); l2 += ' · ' + (G.pl || []).filter(x => x[0] !== net.id).map(x => `${nm.get(x[0]) || x[0]}: ${x[7]}%`).join(' | '); }
    else if (G.mode === 'hide') l2 = mySeeker() ? (G.sub === 'hiding' ? `Вы искатель: ждите ${G.hideLeft} с` : 'Вы ищете — бейте прячущихся!') : (G.sub === 'hiding' ? `Прячьтесь! ${G.hideLeft} с` : 'Не попадитесь искателю!');
    hud.innerHTML = `<div class="bx">${l1}<small>${l2}</small></div>`; hud.style.display = 'block';
  }
  function topLine(cnt = 3) { const names = new Map((net.roster || []).map(p => [p.id, p.name])); const top = [...(G.pl || [])].sort((x, y) => y[1] - x[1]).slice(0, cnt).map(a => `${names.get(a[0]) || a[0]}: ${a[1]}`); return top.length > 1 ? ' · ' + top.join(' | ') : ''; }
  function nearestRelic() { let b = null; for (const r of G.relics || []) { const d = Math.hypot(r.x - P.pos.x, r.z - P.pos.z); if (!b || d < b.d) b = { d, r }; } return b; }

  /* ───── сообщения сервера ───── */
  net.on('game', applyGame);
  net.onChange(() => { if (G.phase !== 'play' && G.phase !== 'over') renderHud(); });      // состав игроков изменился — обновить подсказку/отсчёт
  const tone = (f, d, v = 0.15, ty = 'square') => { try { const AC = window.AudioContext || window.webkitAudioContext; const ac = bang.ac || (bang.ac = new AC()), o = ac.createOscillator(), gn = ac.createGain(); o.type = ty; o.frequency.value = f; gn.gain.value = v; gn.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d); o.connect(gn); gn.connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch { /* звук необязателен */ } };
  function capBal() { const pl = G.pl || [], n = pl.length, tm = myTeam(); if (n % 2 === 0 || !tm) return 1; const c = pl.filter(a => a[3] === tm).length; return c < n - c ? 1.08 : 1; }      // нечётное число игроков: слабая команда чуть быстрее
  net.on('snd', m => { if (G.mode !== 'capture') return; const mine = m.team === myTeam(); if (m.k === 'cap') (mine ? [523, 659, 784] : [330, 262]).forEach((f, i) => setTimeout(() => tone(f, 0.25), i * 110)); else (mine ? [392, 311, 233] : [440, 587]).forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.15, 'sawtooth'), i * 120)); });
  net.on('ev', m => { if (m.big) banner(m.text, 5); feedAdd(m.text); if (G.mode === 'ctf') { const c = m.text[0]; if (c === '🚩') { tone(520, 0.2); setTimeout(() => tone(780, 0.25), 150); } else if (c === '↩') tone(440, 0.3, 0.15, 'sine'); else if (c === '🏴') [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.3), i * 120)); else if (c === '⚠') tone(300, 0.5, 0.2, 'sawtooth'); } });
  net.on('heal', m => { richard.P.hp = Math.min(richard.P.hpMax || 100, (richard.P.hp || 0) + (m.hp || 40)); feedAdd('💚 Аптечка'); });
  let shieldUntil = 0, slowUntil = 0, revId = 0, revUntil = 0, revMesh = null; const pkObjs = new Map();      // «Битва»: щит, замедление от bash, метка убийцы, подбираемые аптечки/щиты
  net.on('hurt', m => { lastAtk = { id: m.from, t: T() }; lastHurtT = T(); richard.hurt(T() < shieldUntil ? m.dmg * 0.4 : m.dmg, m.x, m.y, m.z); });
  net.on('pk', m => { if (m.k === 'h') { P.hp = Math.min(P.hpMax, P.hp + 40); banner('+40 здоровья', 1.5); } else { shieldUntil = T() + 12; banner('Щит на 12 с', 1.5); } });
  net.on('slow', m => { if (G.mode === 'naval') return; slowUntil = T() + (m.s || 0.4); });
  net.on('rev', m => { revId = m.id; revUntil = T() + 8; banner('Месть! Убийца помечен на 8 с', 3); });
  net.on('spawn', m => {
    richard.respawnAt(m.x, m.z, m.yaw || 0); reported = false;
    if (m.ship != null && SH && SH.list[m.ship]) { SH.release(); if (G.phase !== 'play') SH.reset(); SH.board(SH.list[m.ship]); }      // морской бой: каждый стартует у штурвала своего корабля
  });

  /* ───── каждый кадр ───── */
  const _f = new THREE.Vector3();
  function strike(reach, dmg) {      // кто перед нами в пределах reach — тому уходит hit (сервер проверит)
    const yaw = P.yawVis ?? P.yaw; _f.set(Math.sin(yaw), 0, Math.cos(yaw));
    for (const b of net.bodies()) {
      const dx = b.x - P.pos.x, dz = b.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.1 || d > reach || Math.abs(b.y - P.pos.y) > 12) continue;
      if ((dx * _f.x + dz * _f.z) / d < 0.3) continue;          // только перед собой (≈ ±70°)
      net.send({ t: 'hit', to: b.id, dmg, st: P.state });
    }
  }
  addEventListener('mountedswing', () => { if (meIn() && (PVP.has(G.mode) || G.mode === 'relics') && !P.dead) strike(11, 20); });      // удар с лошади (дальше: всадник выше и длиннее хват)
  /* ───── Изучение: счётчики, квесты, фоторежим, «к другу» ───── */
  const xp = { d: 0, lx: null, lz: 0, cells: new Set(), q: 0, hinted: false }, xpEl = document.createElement('div');
  xpEl.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:20;background:rgba(20,30,40,.6);color:#fff;font:12px system-ui,sans-serif;padding:4px 12px;border-radius:99px;display:none;pointer-events:none';
  document.body.appendChild(xpEl);
  const XQ = [['Пройдите 300 м', () => xp.d >= 300], ['Откройте 8 мест', () => xp.cells.size >= 8], ['Пройдите 1500 м', () => xp.d >= 1500], ['Откройте 30 мест', () => xp.cells.size >= 30]];
  net.on('fx', m => { if (m.k === 'f') { window.__flags = window.__flags || []; window.__flags.push([m.x, m.z, 1]); if (window.__flags.length > 20) window.__flags.shift(); banner('🚩 ' + (m.name || 'Игрок') + ' поставил флажок', 3); } else banner((m.name || 'Игрок') + ': ' + m.v, 3); });
  function exploreTick() {
    const on = meIn() && G.mode === 'explore' && !P.dead;
    if (!on) { xpEl.style.display = 'none'; xp.lx = null; return; }
    if (xp.lx != null) { const s = Math.hypot(P.pos.x - xp.lx, P.pos.z - xp.lz); if (s < 5) xp.d += s; }      // большие скачки (телепорт) не считаем
    xp.lx = P.pos.x; xp.lz = P.pos.z; xp.cells.add(Math.round(P.pos.x / 100) + ',' + Math.round(P.pos.z / 100));
    while (xp.q < XQ.length && XQ[xp.q][1]()) { banner('✅ Выполнено: ' + XQ[xp.q][0], 4); xp.q++; }
    if (!xp.hinted) { xp.hinted = true; banner('🧭 WASD — идти · мышь — камера · Пробел — прыжок · T — телепорт · N — карта · Enter — чат · H — подсказка', 8); }
    xpEl.textContent = `👣 ${Math.round(xp.d)} м · 🗺 мест: ${xp.cells.size}` + (xp.q < XQ.length ? ` · 🎯 ${XQ[xp.q][0]}` : ' · все цели выполнены');
    xpEl.style.display = document.body.classList.contains('nohud') ? 'none' : 'block';
  }
  function update(dt) {
    const t = T(), inG = meIn();
    exploreTick();
    window.__gameLock = inG && G.mode !== 'explore';
    zoneTick(dt);
    if (inG && G.mode === 'naval' && !P.dead && (autoRepT = (autoRepT || 0) + dt) > 6) { autoRepT = 0; net.send({ t: 'repair', auto: 1 }); }      // ремонт сам: простоял на корабле — корпус чинится
    window.__noEnter = !!(inG && G.mode === 'hide');      // прятки: в здания входить нельзя
    if (window.__noEnter && G.isl != null && !P.dead) {      // и только на выбранном острове: ушёл на другой — возвращаем на последнее место на своём
      const il = islandAt(P.pos.x, P.pos.z);
      if (il === G.isl) hideGood = { x: P.pos.x, z: P.pos.z };
      else if (il >= 0 && hideGood) { richard.respawnAt(hideGood.x, hideGood.z, 0); banner('🚫 Играем только на этом острове', 2); }
    } else hideGood = null;
    for (const o of root.children) if (o.userData.born != null && o.scale.x < 1) o.scale.setScalar(Math.min(1, 0.01 + (t - o.userData.born) / 1.2));
    if (introT > 0 && (introT -= dt) <= 0) intro.style.display = 'none';
    if (banT > 0 && (banT -= dt) <= 0) ban.style.display = 'none';
    if (inG && G.mode === 'battle' && !P.dead) for (const [id, o] of pkObjs) { o.rotation.z += dt * 2; if (t - grabT > 0.5 && Math.hypot(o.position.x - P.pos.x, o.position.z - P.pos.z) < 4 && Math.abs(o.position.y - P.pos.y) < 8) { grabT = t; net.send({ t: 'pick', id }); } }
    if (t < revUntil) {      // метка убийцы после возрождения
      const b = net.bodies().find(q => q.id === revId); if (!revMesh) { revMesh = makeRing(4, 0xff2a2a); root.add(revMesh); }
      revMesh.visible = !!b; if (b) revMesh.position.set(b.x, b.y + 12 + Math.sin(t * 8), b.z), revMesh.rotation.set(0, t * 4, 0), revMesh.rotation.x = -Math.PI / 2;
    } else if (revMesh) revMesh.visible = false;
    for (const [id, o] of relicObjs) { o.userData.gem.rotation.y += dt * 1.8; const dd = Math.hypot(o.position.x - P.pos.x, o.position.z - P.pos.z); o.visible = dd < 28 && Math.abs(o.position.y - P.pos.y) < 40; o.userData.gem.material.emissiveIntensity = 0.6 + (dd < 28 ? (1 - dd / 28) * (1.2 + 0.5 * Math.sin(t * 6)) : 0); }
    if (G.mode === 'relics' && G.phase === 'play' && !P.dead && t - (G._hintT || 0) > 30) { G._hintT = t; const nr = nearestRelic(); if (nr && nr.d < 80) { G._hint = T() + 8; feedAdd('🔥 Горячо! Реликвия совсем рядом (до 80 м)'); } }
    for (const o of pointObjs) o.f.userData.cloth.rotation.y = Math.sin(t * 3) * 0.15;
    for (const f of Object.values(flagObjs)) f.userData.cloth.rotation.y = Math.sin(t * 3) * 0.15;
    carryLocal.position.set(P.pos.x, P.pos.y + 9.5, P.pos.z); carryLocal.rotation.y = P.yawVis ?? P.yaw;
    const blindNow = inG && G.mode === 'hide' && G.sub === 'hiding' && mySeeker();
    blind.style.display = blindNow ? 'grid' : 'none'; if (blindNow) { blind.textContent = `🙈 Вы искатель. Глаза закрыты: ${G.hideLeft} с`; richard.clearKeys(); }
    dead.style.display = inG && P.dead && PVP.has(G.mode) && G.mode !== 'hide' ? 'grid' : 'none'; if (dead.style.display === 'grid') dead.textContent = '☠ Вы погибли — возрождение…';
    const seekNow = inG && G.mode === 'hide' && G.sub === 'seek' && mySeeker();
    if (seekNow) { if (!seekSince) seekSince = t; } else seekSince = 0;
    P.speedMul = inG && G.mode === 'hide' && mySeeker() ? (seekSince && t - seekSince > 60 ? 1.4 : SEEKER_SPEED) : (inG && G.mode === 'ctf' && my() && my()[5] ? 0.85 : inG && G.mode === 'capture' ? capBal() : 1);      // искатель бегает быстрее; после 60 с поиска устаёт (1.4)
    if (t < slowUntil) P.speedMul *= 0.5;      // удар щитом (bash) замедляет на 0.4 с
    if (seekNow) {      // шаги, следы (5 с, до 40) и «замерший» прячущийся (3 с без движения) виден только вблизи (<15 м)
      stepT -= dt; fpT -= dt;
      for (const b of net.bodies()) {
        const o = stepPos.get(b.id) || { x: b.x, z: b.z, still: 0 }, mv = Math.hypot(b.x - o.x, b.z - o.z) > 0.08; o.still = mv ? 0 : o.still + dt; o.x = b.x; o.z = b.z; stepPos.set(b.id, o);
        const gr = net.group(b.id), dd = Math.hypot(b.x - P.pos.x, b.z - P.pos.z); if (gr) gr.visible = !(o.still > 3 && dd > 15);
        if (mv && stepT <= 0 && dd < 10) { bang(0.12); stepT = 0.4; }
        if (mv && fpT <= 0 && prints.length < 40) { const m = new THREE.Mesh(fpGeo, fpMat); m.position.set(b.x, b.y + 0.08, b.z); m.userData.t0 = t; scene.add(m); prints.push(m); }
      }
      if (fpT <= 0) fpT = 0.5;
    } else { for (const id of stepPos.keys()) { const gr = net.group(id); if (gr) gr.visible = true; } stepPos.clear(); }
    for (let i = prints.length - 1; i >= 0; i--) if (!seekNow || t - prints[i].userData.t0 > 5) { scene.remove(prints[i]); prints.splice(i, 1); }
    if (!(inG && G.mode === 'hide' && G.sub === 'seek')) decoyUsed = false;
    navalUpdate(dt);
    if (!inG) return;
    if (!P.dead && P.hp < P.hpMax && t - lastHurtT > 5) P.hp = Math.min(P.hpMax, P.hp + 6 * dt);    // без боя здоровье медленно восстанавливается
    // гибель → серверу
    if (P.dead && !reported && PVP.has(G.mode) && G.mode !== 'hide') { reported = true; net.send({ t: 'died', by: t - lastAtk.t < 8 ? lastAtk.id : 0 }); }
    if (!P.dead) reported = false;
    if (P.dead && window.__riding) dispatchEvent(new CustomEvent('forcedismount'));      // погибший не остаётся в седле
    // удар: в нужный момент клипа проверяем, кто перед нами
    const sw = SWING[P.state];
    if (sw && (PVP.has(G.mode) || G.mode === 'relics') && !P.dead && !blindNow) {
      if (prevState !== P.state || P.t < prevT) fired = false;
      if (!fired && P.t >= sw[0]) { fired = true; strike(sw[2], sw[1]); }
    } else fired = true;
    prevState = P.state; prevT = P.t;
    // реликвии: подобрать, если рядом
    if (G.mode === 'relics' && !P.dead && !window.__riding && !window.__dragonOn && t - grabT > 0.4) for (const r of G.relics || []) {
      if (Math.hypot(r.x - P.pos.x, r.z - P.pos.z) < 5 && Math.abs(r.y - P.pos.y) < 8) { grabT = t; net.send({ t: 'grab', id: r.id }); break; }
    }
    if (G.mode === 'naval' || G.mode === 'relics' || G.mode === 'hide' || G.mode === 'capture' || G.mode === 'ctf') { if ((G._hudT = (G._hudT || 0) + dt) > 0.25) { G._hudT = 0; renderHud(); } }
  }
  return { update, get dbg() { return { ...shipDbg, ago: T() - shipDbg.lastRx, ships: SH ? SH.list.length : 0, riding: SH && SH.riding() ? SH.list.indexOf(SH.riding()) : -1, ridingId: SH && SH.riding() ? SH.riding().id : '', remote: SH ? SH.list.map((v, i) => v.remote ? i : -1).filter(i => i >= 0) : [] }; }, get active() { return meIn(); }, get state() { return G; } };
}
