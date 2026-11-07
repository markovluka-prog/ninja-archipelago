// lobby.js — меню входа. Появляется при КАЖДОМ открытии ссылки: имя, выбор персонажа тапом (занятых другим нельзя),
// «＋ Добавить игрока» / «− Убрать игрока», список тех, кто сейчас в игре. Состояние решает сервер (network.js), меню лишь его показывает.
import { CHARS } from './network.js';
import { MODE_INFO } from './game.js';

export function startLobby({ net, richard, world, setMode, getMode }) {
  const css = document.createElement('style');
  css.textContent = `
  #lobby{position:fixed;inset:0;z-index:60;display:none;place-items:center;background:rgba(10,25,40,.78);backdrop-filter:blur(4px);padding:12px;overflow:auto}
  #lobby.on{display:grid}
  #lobby .box{width:min(560px,96vw);background:#fffdf8;border-radius:18px;padding:18px;box-shadow:0 14px 50px rgba(0,0,0,.5);color:#2a2723}
  #lobby h1{margin:0 0 4px;font-size:22px} #lobby p.sub{margin:0 0 12px;color:#7a746b;font-size:13px}
  #lobby label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#7a746b;margin:12px 0 5px}
  #lobby input{width:100%;font:inherit;font-size:16px;padding:10px 12px;border:2px solid #d6d1c6;border-radius:10px;background:#fff}
  #lobby input:focus{outline:0;border-color:#b8861b}
  #lobby .chars{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
  #lobby .ch{position:relative;border:3px solid #d6d1c6;background:#fff;border-radius:14px;padding:10px;cursor:pointer;text-align:center;font:inherit;color:inherit;min-height:140px;touch-action:manipulation}
  #lobby .ch .pic{height:84px;display:grid;place-items:center;font-size:48px} #lobby .ch img{height:84px;object-fit:contain}
  #lobby .ch b{display:block;font-size:16px} #lobby .ch small{color:#7a746b;display:block;min-height:15px}
  #lobby .ch.mine{border-color:#b8861b;background:#fff7e0} #lobby .ch.taken{opacity:.5;cursor:not-allowed;background:#eee}
  #lobby .ch .st{position:absolute;top:6px;right:8px;font-size:11px;font-weight:700;color:#fff;background:#3f8f5a;border-radius:99px;padding:1px 8px}
  #lobby .ch.taken .st{background:#a33}
  #lobby .row{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
  #lobby .btn{flex:1;min-width:150px;font:inherit;font-size:16px;font-weight:700;border:0;border-radius:12px;padding:13px;cursor:pointer;color:#fff;touch-action:manipulation}
  #lobby .add{background:#3f8f5a} #lobby .del{background:#b3402f} #lobby .alt{background:#7a746b} #lobby .btn:disabled{opacity:.4;cursor:not-allowed}
  #lobby ul{list-style:none;margin:0;padding:0;font-size:14px} #lobby li{padding:5px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;gap:8px}
  #lobby .modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
  #lobby .md{border:3px solid #d6d1c6;background:#fff;border-radius:12px;padding:8px;cursor:pointer;font:inherit;color:inherit;text-align:center;touch-action:manipulation}
  #lobby .md.sel{border-color:#3f8f5a;background:#eaf7ee} #lobby .md b{display:block}
  #lobby .mdesc{font-size:13px;color:#4a463f;margin:8px 0 0;min-height:36px}
  #lobby li em{font-style:normal;color:#7a746b}
  #lobby .roombox{background:#f3efe4;border-radius:12px;padding:10px 12px;margin:6px 0 4px}
  #lobby .roombox .code{font:800 34px/1 ui-monospace,Menlo,monospace;letter-spacing:.25em;text-align:center}
  #lobby .roomrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  #lobby .roomrow input{width:130px;flex:0 0 auto;text-align:center;font:800 28px ui-monospace,Menlo,monospace;letter-spacing:.25em;padding:6px}
  #lobby .rl button{font:inherit;font-weight:700;border:2px solid #b8861b;background:#fff;border-radius:99px;padding:3px 12px;margin:3px 4px 0 0;cursor:pointer}
  #lobby .err{color:#b3402f;font-weight:700;margin:6px 0 0;min-height:18px}`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'lobby';
  el.innerHTML = `<div class="box"><h1>⚔️ Ниндзи — вход в игру</h1><p class="sub" id="lbConn">Подключение…</p>
    <div id="lbRoomEnter" class="roombox"><label style="margin-top:0">Комната — код из 3 цифр (одинаковый код = вы в одной игре)</label>
      <div class="roomrow"><input id="lbRoom" maxlength="3" inputmode="numeric" placeholder="123" autocomplete="off"><button class="btn add" id="lbJoin" style="min-width:120px">Войти</button><button class="btn alt" id="lbNewRoom" style="min-width:120px">Создать новую</button></div>
      <div class="err" id="lbErr"></div><div class="rl" id="lbRooms"></div></div>
    <div id="lbInRoom" class="roombox" style="display:none"><div style="text-align:center;font-size:12px;color:#7a746b;text-transform:uppercase;letter-spacing:.08em">Ваша комната — назовите этот код второму игроку</div><div class="code" id="lbCode"></div>
      <div class="row" style="margin-top:8px"><button class="btn alt" id="lbLeaveRoom">Выйти из комнаты</button></div></div>
    <div id="lbMain"><label for="lbName">Ваше имя</label><input id="lbName" maxlength="16" placeholder="Как вас звать?" autocomplete="off">
    <label>Персонаж (тапните, чтобы выбрать)</label><div class="chars" id="lbChars"></div>
    <div class="row"><button class="btn add" id="lbAdd">▶ Играть (добавить игрока)</button><button class="btn del" id="lbDel">− Убрать игрока</button></div>
    <div class="row" style="margin-top:8px"><button class="btn alt" id="lbClose">Закрыть меню</button></div>
    <label>Голосуйте за режим (нужно 2+ игрока; при ничьей решает первый игрок)</label><div class="modes" id="lbModes"></div><p class="mdesc" id="lbDesc"></p>
    <div class="row"><button class="btn add" id="lbStart">▶ Начать режим</button><button class="btn del" id="lbStop">⏹ Закончить игру</button></div>
    <label>Сейчас в комнате</label><ul id="lbList"></ul></div></div>`;
  document.body.appendChild(el);
  const $ = id => el.querySelector('#' + id), nameIn = $('lbName');
  nameIn.value = net.lobby ? net.lobby.name : '';
  const cards = {};
  for (const [key, c] of Object.entries(CHARS)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ch';
    b.innerHTML = `<span class="st"></span><div class="pic">${c.img ? `<img alt="" src="${c.img.split('/').map(encodeURIComponent).join('/')}">` : c.icon}</div><b>${c.name}</b><small>${c.role}</small><small class="who"></small>`;
    const im = b.querySelector('img'); if (im) im.onerror = () => { b.querySelector('.pic').textContent = c.icon; };
    b.onclick = () => { const o = net.roster.find(p => p.ch === key && p.id !== net.id); if (o) return; net.setLobby({ ch: key }); };
    $('lbChars').appendChild(b); cards[key] = b;
  }
  let selMode = 'battle'; const mdBtns = {};
  for (const [key, m] of Object.entries(MODE_INFO)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'md'; b.innerHTML = `<span style="font-size:26px">${m.icon}</span><b>${m.name}<i style="font-style:normal;font-size:12px"></i></b>`;
    b.onclick = () => { selMode = key; if (net.me && net.me.play) net.send({ t: 'vote', mode: key }); render(); }; $('lbModes').appendChild(b); mdBtns[key] = b;
  }
  $('lbStart').onclick = () => net.send({ t: 'start', mode: selMode });
  $('lbStop').onclick = () => net.send({ t: 'stop' });
  const roomIn = $('lbRoom');
  const doJoin = () => { const c = roomIn.value.replace(/\D/g, ''); if (c.length !== 3) { $('lbErr').textContent = 'Код комнаты — ровно 3 цифры'; return; } $('lbErr').textContent = ''; net.join(c); };
  roomIn.addEventListener('input', () => { roomIn.value = roomIn.value.replace(/\D/g, '').slice(0, 3); });
  roomIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') doJoin(); }); roomIn.addEventListener('keyup', e => e.stopPropagation());
  $('lbJoin').onclick = doJoin; $('lbNewRoom').onclick = () => net.createRoom(); $('lbLeaveRoom').onclick = () => net.leaveRoom();
  setInterval(() => { if (open_ && net.online && !net.room) net.requestRooms(); }, 2000);
  nameIn.addEventListener('keydown', e => e.stopPropagation()); nameIn.addEventListener('keyup', e => e.stopPropagation());
  nameIn.addEventListener('input', () => net.setLobby({ name: nameIn.value }));
  $('lbAdd').onclick = () => { if (!nameIn.value.trim()) nameIn.value = 'Игрок'; net.setLobby({ name: nameIn.value, play: true }); };      // имя не введено — «Игрок»
  $('lbDel').onclick = () => net.setLobby({ play: false });
  $('lbClose').onclick = () => close();

  let open_ = false, wasPlay = false, wasCh = null;
  function render() {
    const roster = net.roster, me = net.me, needRoom = net.online && !net.room;
    $('lbRoomEnter').style.display = needRoom ? '' : 'none'; $('lbInRoom').style.display = net.room ? '' : 'none'; $('lbMain').style.display = needRoom ? 'none' : '';
    $('lbCode').textContent = net.room || ''; $('lbErr').textContent = net.roomErr || $('lbErr').textContent;
    $('lbRooms').innerHTML = needRoom && net.roomList.length ? 'Открытые комнаты: ' + net.roomList.map(r => `<button data-c="${r.code}">${r.code} · ${r.n} игр.${r.playing ? ' · идёт игра' : ''}</button>`).join('') : '';
    for (const b of $('lbRooms').querySelectorAll('button')) b.onclick = () => net.join(b.dataset.c);
    if (needRoom) { $('lbConn').textContent = 'Введите код комнаты (3 цифры) — или создайте новую и скажите код второму игроку.'; return; }
    $('lbConn').textContent = net.online ? 'Вы в комнате ' + net.room + '. ① тапните персонажа → ② нажмите зелёную «Играть». Имя можно не вводить.' : 'Сервер не запущен (node server.js) — играть можно в одиночку.';
    for (const [key, b] of Object.entries(cards)) {
      const o = roster.find(p => p.ch === key && p.id !== net.id), mine = me && me.ch === key;
      b.classList.toggle('mine', !!mine); b.classList.toggle('taken', !!o);
      b.querySelector('.st').textContent = mine ? 'ваш' : o ? 'занят' : 'свободен'; b.querySelector('.st').style.display = '';
      b.querySelector('.who').textContent = o ? '👤 ' + o.name : mine ? '👤 это вы' : ' ';
    }
    const gm = net.game, running = !!(gm && gm.phase === 'play');
    const mv = gm && (gm.pv || []).find(a => a[0] === net.id); if (mv && !running) selMode = mv[1];
    const vc = (gm && gm.votes) || {}, fp = roster.find(p => p.id === (gm && gm.first));
    for (const [k, b] of Object.entries(mdBtns)) { b.classList.toggle('sel', k === selMode); b.querySelector('i').textContent = vc[k] ? ' · 🗳 ' + vc[k] : ''; }
    $('lbDesc').textContent = running ? `Сейчас идёт: ${MODE_INFO[gm.mode].icon} ${MODE_INFO[gm.mode].name}` : MODE_INFO[selMode].desc;
    const playing = !!(me && me.play);
    const nPl = roster.filter(p => p.play).length, armed = gm && gm.armed;
    $('lbStart').disabled = running || !playing || !net.online; $('lbStop').disabled = !running && !armed;
    $('lbStart').textContent = nPl < 2 ? '⏳ Выбрать режим (старт при 2 игроках)' : '▶ Начать режим';
    $('lbStop').textContent = running ? '⏹ Закончить игру' : '✖ Отменить выбор';
    if (!running && gm && gm.cd != null) $('lbDesc').textContent = `⏳ Выберите режим! Игра начнётся через ${gm.cd} с (или когда проголосуют все). Голос — тап по режиму.`;
    else if (!running && armed) $('lbDesc').textContent = `⏳ Выбран «${MODE_INFO[armed].name}» — игра начнётся сама, когда войдёт второй игрок. Пока ходите где хотите.`;
    else if (!running && nPl < 2) $('lbDesc').textContent += ' · Сейчас в игре ' + nPl + ' из 2 нужных.';
    if (!running && Object.keys(vc).length) { const lead = Object.entries(vc).sort((a, b) => b[1] - a[1]), tie = lead.length > 1 && lead[0][1] === lead[1][1]; $('lbDesc').textContent += tie ? ` · Ничья голосов — выбирает первый игрок${fp ? ' (' + fp.name + ')' : ''}.` : ` · Лидирует «${MODE_INFO[lead[0][0]].name}».`; }
    $('lbStart').title = !net.online ? 'Режимы работают только при запущенном сервере' : !playing ? 'Сначала добавьте себя в игру' : '';
    $('lbAdd').disabled = playing || !(me && me.ch); $('lbDel').disabled = !playing;
    $('lbAdd').textContent = me && me.ch ? '▶ Играть (добавить игрока)' : '① Сначала тапните персонажа';
    $('lbClose').textContent = playing ? 'Вернуться в игру' : 'Смотреть без игры';
    $('lbList').innerHTML = roster.length ? roster.map(p => `<li><span>${p.id === net.id ? '⭐ ' : ''}${p.name.replace(/</g, '&lt;')}</span><em>${p.play ? '⚔️ ' + CHARS[p.ch].name : p.ch ? 'выбрал ' + CHARS[p.ch].name : 'в меню'} · 🪙 ${p.coins || 0}</em></li>`).join('') : '<li><em>никого</em></li>';
  }
  function applyState() {                                      // реакция игры на изменение «я в игре / не в игре / сменил персонажа»
    const me = net.me, play = !!(me && me.play), prevPlay = wasPlay, prevCh = wasCh;
    wasPlay = play; wasCh = play ? me.ch : null;               // сначала состояние, потом действия (close() смотрит на wasPlay)
    if (play && (!prevPlay || me.ch !== prevCh)) {
      richard.setCharacter(me.ch); richard.setVisible(true);   // одна фигура: setCharacter показывает выбранную и прячет вторую
      if (!prevPlay) { const s = world.richardStart; if (s) richard.teleport(s.x + ((Object.keys(CHARS).indexOf(me.ch) - 2) * 8), s.z, s.yaw || 0); close(); }
    }
    if (!play && prevPlay) { richard.setVisible(false); setMode('orbit'); }
  }
  function open() { open_ = true; el.classList.add('on'); if (document.pointerLockElement) document.exitPointerLock(); if (getMode() === 'walk' && !window.__gameLock) setMode('orbit'); render(); }
  function close() { open_ = false; el.classList.remove('on'); if (wasPlay) setMode('walk'); }
  let lastPh = 'idle';
  let cdOpened = false;
  net.onChange(() => { applyState(); render(); { const cd = net.game && net.game.cd != null; if (cd && !cdOpened && net.me && net.me.play && !open_) open(); cdOpened = !!cd; } const ph = net.game ? net.game.phase : 'idle'; if (ph === 'play' && lastPh !== 'play' && open_) close(); lastPh = ph; });
  addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat && document.activeElement !== nameIn) { open_ ? close() : open(); } });

  richard.setVisible(false); setMode('orbit');
  net.setLobby({});                                           // офлайн: заполнит список; онлайн — ничего не меняет
  open();
  return { open, close };
}
