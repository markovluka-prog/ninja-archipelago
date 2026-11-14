// keybinds.js — свои клавиши управления. Классический скрипт, грузится ДО игры. Окно «⌨ Клавиши» (кнопка слева внизу или F2): у каждого действия можно назначить любую клавишу.
// Как работает: в игре везде зашиты стандартные коды клавиш. Нажатие настоящей клавиши перехватывается в фазе capture и переотправляется как стандартная клавиша действия;
// стандартная клавиша, которую переназначили, гасится. Так переназначение работает во всех режимах (ходьба, дракон, корабль, пушка, лук) без правки их кода.
(() => {
  const ACTIONS = [
    ['fwd', 'Вперёд', 'KeyW'], ['back', 'Назад', 'KeyS'], ['left', 'Влево', 'KeyA'], ['right', 'Вправо', 'KeyD'],
    ['jump', 'Прыжок / планировать', 'Space'], ['run', 'Шагом (идти медленнее) / ускорение дракона', 'ShiftLeft'],
    ['kick', 'Пинок / бочка-уворот на драконе', 'KeyF'], ['attack', 'Удар (как ЛКМ)', 'KeyJ'], ['block', 'Блок / парад / ульта дракона (как ПКМ)', 'KeyK'], ['spell', 'Заклинание на древнем языке', 'KeyY'], ['stopspell', 'Прервать заклинания-процессы (полёт, хватка…)', 'KeyU'],
    ['use', 'Действие (дверь, лошадь, штурвал, пушка, дракон)', 'KeyE'], ['dragon', 'Позвать дракона', 'KeyV'], ['bail', 'Паруса / спрыгнуть с дракона', 'KeyQ'],
    ['sword', 'Меч и щит', 'Digit1'], ['bow', 'Лук', 'Digit2'], ['draw', 'Достать/убрать оружие · огонь из пушки · дракон вниз', 'KeyX'], ['up', 'Дракон вверх', 'KeyZ'],
    ['respawn', 'Возродиться (с Shift)', 'KeyR'], ['help', 'Панель управления', 'KeyH'], ['tp', 'Телепорт (карта)', 'KeyT'], ['lobby', 'Лобби / игроки', 'KeyM'], ['orbit', 'Облёт / ходьба', 'KeyG'],
  ];
  const KEY = 'ninja.keys.v1';
  let map = {};                                  // действие → код клавиши
  try { map = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
  const def = Object.fromEntries(ACTIONS.map(a => [a[0], a[2]]));
  const cur = a => map[a] || def[a];
  const OFF = ['KeyL', 'KeyC'];      // отключённые клавиши боя (J — удар и K — блок/ульта дублируют мышь для тачпада)
  let rev = {}, defs = new Set([...ACTIONS.map(a => a[2]), ...OFF]);      // реальная клавиша → стандартный код действия
  const rebuild = () => { rev = {}; for (const [a, , d] of ACTIONS) rev[cur(a)] = d; };
  rebuild();
  const save = () => { const o = {}; for (const [a, , d] of ACTIONS) if (cur(a) !== d) o[a] = cur(a); map = o; try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} rebuild(); };
  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
  let inject = false, capturing = null;

  const onKey = e => {
    if (inject) return;
    if (capturing) {                             // окно ждёт новую клавишу
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.type === 'keydown' && !e.repeat && e.code !== 'F2') capturing(e.code);      // F2 зарезервирована под само окно
      return;
    }
    if (e.code === 'F2' && e.type === 'keydown' && !e.repeat) { e.preventDefault(); toggle(); return; }
    if (panel.classList.contains('on')) { if (e.code === 'Escape' && e.type === 'keydown') toggle(false); e.stopImmediatePropagation(); return; }
    if (typing()) return;
    const to = rev[e.code];
    if (to === e.code || (to === undefined && !defs.has(e.code))) return;      // не переназначена
    e.stopImmediatePropagation();
    if (to === undefined) { if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault(); return; }      // стандартная клавиша отдана другому действию — гасим
    const ne = new KeyboardEvent(e.type, { code: to, key: to, repeat: e.repeat, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, bubbles: true, cancelable: true });
    inject = true; let ok = true; try { ok = (e.target || document).dispatchEvent(ne); } finally { inject = false; }
    if (!ok || to === 'Space' || to === 'Tab') e.preventDefault();
  };
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);

  /* ───── окно настройки ───── */
  const css = document.createElement('style');
  css.textContent = `#kbBtn{position:fixed;left:10px;bottom:10px;z-index:45;border:0;border-radius:99px;background:rgba(20,30,40,.7);color:#fff;font:12px system-ui,sans-serif;padding:6px 11px;cursor:pointer}
  #kbBtn:hover{background:rgba(20,30,40,.9)}
  #kbPanel{position:fixed;inset:0;z-index:80;background:rgba(10,25,40,.72);display:none;place-items:center;font:13px system-ui,sans-serif}
  #kbPanel.on{display:grid}
  #kbPanel .box{background:#fffdf8;color:#222;border-radius:16px;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.4);width:min(560px,94vw);max-height:90vh;display:flex;flex-direction:column}
  #kbPanel h2{margin:0 0 4px;font-size:16px} #kbPanel p{margin:0 0 10px;opacity:.65;font-size:12px}
  #kbPanel .rows{overflow:auto;border-top:1px solid #e6e1d4}
  #kbPanel .row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 2px;border-bottom:1px solid #eee8da}
  #kbPanel .row button{min-width:92px;border:1px solid #cfc8b6;background:#fff;border-radius:8px;padding:4px 8px;cursor:pointer;font:600 12px ui-monospace,Menlo,monospace}
  #kbPanel .row button.ch{border-color:#b8861b;color:#b8861b} #kbPanel .row button.wait{background:#fff0c4;border-color:#b8861b}
  #kbPanel .foot{display:flex;gap:8px;justify-content:flex-end;margin-top:10px} #kbPanel .foot button{border:1px solid #cfc8b6;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit}`;
  document.head.appendChild(css);
  const panel = document.createElement('div'); panel.id = 'kbPanel';
  panel.innerHTML = '<div class="box"><h2>⌨ Клавиши управления</h2><p>Нажмите на кнопку действия, затем на нужную клавишу. Esc — отмена. Если клавиша занята, действия поменяются местами.</p><div class="rows"></div><div class="foot"><button data-r>Сбросить всё</button><button data-c>Закрыть</button></div></div>';
  const rows = panel.querySelector('.rows');
  const name = c => c.replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'Пробел').replace('ShiftLeft', 'Shift (лев.)').replace('ShiftRight', 'Shift (прав.)').replace('Arrow', '↔ ').replace('Backquote', '`').replace('Semicolon', ';').replace('Comma', ',').replace('Period', '.').replace('Slash', '/').replace('Quote', "'").replace('BracketLeft', '[').replace('BracketRight', ']').replace('Minus', '-').replace('Equal', '=').replace('Backslash', '\\').replace('Control', 'Ctrl').replace('Left', ' лев.').replace('Right', ' прав.');
  function draw() {
    rows.innerHTML = '';
    for (const [a, label, d] of ACTIONS) {
      const r = document.createElement('div'); r.className = 'row'; const b = document.createElement('button');
      b.textContent = name(cur(a)); if (cur(a) !== d) b.className = 'ch';
      b.onclick = () => {
        b.textContent = 'нажмите клавишу…'; b.className = 'wait';
        capturing = code => {
          capturing = null;
          if (code !== 'Escape') {
            const other = ACTIONS.find(x => x[0] !== a && cur(x[0]) === code); const old = cur(a);
            map[a] = code; if (other) map[other[0]] = old; save();
          }
          draw();
        };
      };
      r.innerHTML = `<span>${label}</span>`; r.appendChild(b); rows.appendChild(r);
    }
  }
  panel.querySelector('[data-r]').onclick = () => { map = {}; save(); draw(); };
  panel.querySelector('[data-c]').onclick = () => toggle(false);
  function toggle(v) { const on = v === undefined ? !panel.classList.contains('on') : v; capturing = null; panel.classList.toggle('on', on); if (on) { document.exitPointerLock && document.exitPointerLock(); draw(); } }
  const btn = document.createElement('button'); btn.id = 'kbBtn'; btn.textContent = '⌨ Клавиши (F2)'; btn.onclick = () => toggle();
  const mount = () => { document.body.appendChild(panel); document.body.appendChild(btn); };
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);
  window.__keybinds = { toggle, get: cur };
  /* отладка: ошибки браузера и ключевые события уходят в лог сервера (/__log), чтобы их можно было прочитать без консоли */
  const tag = Math.random().toString(36).slice(2, 5);
  window.__dbg = t => { try { navigator.sendBeacon('/__log', '[' + tag + '] ' + String(t).slice(0, 400)); } catch (e) {} };
  addEventListener('error', e => window.__dbg('ERR ' + e.message + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno));
  addEventListener('unhandledrejection', e => window.__dbg('REJ ' + (e.reason && e.reason.message || e.reason)));
  window.__dbg('страница загружена');
})();
