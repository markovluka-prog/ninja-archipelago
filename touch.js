// touch.js — сенсорное управление для iPad/планшетов. Классический скрипт, грузится ДО игры (после keybinds.js).
// На десктопе (нет pointer: coarse и нет ontouchstart) не делает ничего.
// Как работает: экранные кнопки и джойстик отправляют синтетические KeyboardEvent (code как у настоящих клавиш, поэтому работают во всех режимах:
// ходьба, дракон, корабль, пушка, лук); перетаскивание по сцене даёт синтетический mousemove с movementX/Y (камера читает именно его);
// «захват мыши» подменяется (на iPad его нет) — document.pointerLockElement возвращает канвас, пока не открыто поле ввода.
(() => {
  const IS = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  if (!IS) return;
  window.__touch = true;

  /* ───── подмена pointer lock ───── */
  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
  try {
    Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get() { return typing() ? null : (window.__canvas || null); } });
    Document.prototype.exitPointerLock = function () {}; Element.prototype.requestPointerLock = function () {};
  } catch (e) {}

  /* ───── клавиши ───── */
  const KEYCH = c => c === 'Space' ? ' ' : /^Key[A-Z]$/.test(c) ? c[3].toLowerCase() : /^Digit\d$/.test(c) ? c[5] : c.startsWith('Shift') ? 'Shift' : c;
  const down = new Set();
  const fire = (type, code, extra) => document.dispatchEvent(new KeyboardEvent(type, Object.assign({ code, key: KEYCH(code), bubbles: true, cancelable: true, shiftKey: down.has('ShiftLeft') }, extra || {})));
  const kd = code => { if (down.has(code)) return; down.add(code); fire('keydown', code); };
  const ku = code => { if (!down.delete(code)) return; fire('keyup', code); };
  const tap = (code, extra) => { fire('keydown', code, extra); setTimeout(() => fire('keyup', code, extra), 70); };
  const releaseAll = () => { for (const c of [...down]) ku(c); };
  addEventListener('blur', releaseAll); document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  /* ───── режим игры ───── */
  const getMode = () => window.__dragonOn ? 'dragon' : window.__gunner ? 'gun' : window.__ridingKind === 'ship' ? 'ship' : window.__bow ? 'bow' : 'walk';

  /* ───── стили ───── */
  const css = document.createElement('style');
  css.textContent = `
  html,body{overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
  input,textarea{-webkit-user-select:text;user-select:text;font-size:16px !important}
  canvas{touch-action:none !important}
  #hint,#kbBtn{display:none !important}
  .tc{position:fixed;z-index:35;font-family:system-ui,-apple-system,sans-serif;touch-action:none;-webkit-user-select:none;user-select:none}
  .tc *{touch-action:none;-webkit-user-select:none;user-select:none}
  body.tc-typing .tc.hideTyping{display:none}
  .tc button{position:absolute;margin:0;padding:0;border:2px solid rgba(255,255,255,.55);background:rgba(20,30,45,.5);color:#fff;font:700 13px/1.1 system-ui,-apple-system,sans-serif;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
  .tc button.on{background:rgba(255,200,60,.75);border-color:#fff;color:#222}
  .tc button.hide{display:none}
  #tcMenu{left:calc(10px + env(safe-area-inset-left));top:calc(10px + env(safe-area-inset-top));display:flex;gap:6px;z-index:41}
  #tcMenu button{position:static;width:46px;height:46px;border-radius:12px;font-size:15px}
  #tcAux{right:calc(12px + env(safe-area-inset-right));bottom:calc(240px + env(safe-area-inset-bottom));width:272px;height:162px}
  #tcAct{right:calc(10px + env(safe-area-inset-right));bottom:calc(10px + env(safe-area-inset-bottom));width:262px;height:226px}
  #tcJoy{left:0;bottom:0;width:48vw;height:62vh;z-index:34}
  #tcJoy .base{position:absolute;width:140px;height:140px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:rgba(20,30,45,.28);left:calc(30px + env(safe-area-inset-left));bottom:calc(30px + env(safe-area-inset-bottom));pointer-events:none}
  #tcJoy .knob{position:absolute;width:62px;height:62px;border-radius:50%;left:39px;top:39px;background:rgba(255,255,255,.55);border:2px solid rgba(255,255,255,.8);pointer-events:none}`;
  document.head.appendChild(css);

  /* ───── метатеги ───── */
  const meta = (n, c) => { let m = document.querySelector('meta[name="' + n + '"]'); if (!m) { m = document.createElement('meta'); m.name = n; document.head.appendChild(m); } m.content = c; };
  meta('apple-mobile-web-app-capable', 'yes'); meta('mobile-web-app-capable', 'yes'); meta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  addEventListener('contextmenu', e => e.preventDefault(), true);
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, e => e.preventDefault(), { passive: false });
  addEventListener('orientationchange', () => { setTimeout(() => dispatchEvent(new Event('resize')), 250); setTimeout(() => dispatchEvent(new Event('resize')), 700); });
  // составные касания, которые браузер превращает в мышь, не должны бить/стрелять (мышь здесь не используется, ввод — от наших кнопок)
  for (const t of ['mousedown', 'mouseup']) addEventListener(t, e => { if (e.isTrusted && e.target === window.__canvas) e.stopImmediatePropagation(); }, true);

  /* ───── кнопки ───── */
  // m(режим) → { c: код, l: подпись, k: 'hold' | 'tap' | 'gest' } или null (скрыть). gest — по отпусканию пальца (нужно для экранной клавиатуры)
  const D = (c, l, k) => ({ c, l, k: k || 'tap' });
  const BTN = {
    atk:   { m: m => m === 'dragon' ? D('Space', 'Огонь', 'hold') : m === 'gun' ? D('KeyX', 'Огонь') : m === 'ship' ? null : m === 'bow' ? D('KeyJ', 'Выстрел', 'hold') : D('KeyJ', 'Удар', 'hold'), css: 'right:0;bottom:0;width:100px;height:100px;font-size:16px;background:rgba(200,50,40,.6)' },
    blk:   { m: m => m === 'dragon' ? D('KeyK', 'Ульта') : (m === 'walk') ? D('KeyK', 'Блок', 'hold') : null, css: 'right:112px;bottom:6px;width:78px;height:78px' },
    jump:  { m: m => m === 'dragon' ? D('KeyZ', 'Вверх', 'hold') : (m === 'walk' || m === 'bow') ? D('Space', 'Прыжок', 'hold') : null, css: 'right:10px;bottom:112px;width:78px;height:78px' },
    kick:  { m: m => m === 'dragon' ? D('KeyF', 'Бочка') : (m === 'walk') ? D('KeyF', 'Пинок') : null, css: 'right:104px;bottom:98px;width:62px;height:62px' },
    use:   { m: m => m === 'gun' ? null : D('KeyE', 'Дейст.'), css: 'right:200px;bottom:12px;width:62px;height:62px' },
    down:  { m: m => m === 'dragon' ? D('KeyX', 'Вниз', 'hold') : null, css: 'right:176px;bottom:84px;width:62px;height:62px' },
    boost: { m: m => m === 'dragon' ? D('ShiftLeft', 'Рывок', 'hold') : null, css: 'right:104px;bottom:166px;width:56px;height:56px' },
    bail:  { m: m => (m === 'dragon' || m === 'ship') ? D('KeyQ', m === 'ship' ? 'Паруса' : 'Слезть') : null, css: 'right:10px;bottom:196px;width:56px;height:56px' },
  };
  const AUX = [
    ['w1', 'Digit1', '⚔', m => m === 'walk' || m === 'bow'], ['w2', 'Digit2', '🏹', m => m === 'walk' || m === 'bow'], ['dr', 'KeyX', 'Оруж.', m => m === 'walk' || m === 'bow'],
    ['callD', 'KeyV', '🐉', m => m !== 'dragon' && m !== 'gun'], ['mag', 'KeyY', '✦', () => true, 'gest'], ['stp', 'KeyU', 'Стоп', () => true],
  ];
  const mk = (tag, id, cls) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; return e; };
  const root = mk('div'); const act = mk('div', 'tcAct', 'tc hideTyping'), aux = mk('div', 'tcAux', 'tc hideTyping'), menu = mk('div', 'tcMenu', 'tc'), joy = mk('div', 'tcJoy', 'tc hideTyping');
  const items = [];      // { el, def, held }

  function bind(el, def) {
    const it = { el, def, cur: null, held: null }; items.push(it);
    const start = e => {
      e.preventDefault(); const d = it.cur; if (!d) return;
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      el.classList.add('on'); it.pid = e.pointerId;
      if (d.x) { tap(d.c, d.x); return; }
      if (d.k === 'hold') { it.held = d.c; kd(d.c); } else if (d.k === 'tap') tap(d.c); else it.gest = d.c;
    };
    const end = e => {
      if (it.pid !== e.pointerId) return; it.pid = null; el.classList.remove('on');
      if (it.held) { ku(it.held); it.held = null; }
      if (it.gest) { const c = it.gest; it.gest = null; if (e.type === 'pointerup') tap(c); }
    };
    el.addEventListener('pointerdown', start); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
    return it;
  }
  for (const k in BTN) { const b = mk('button'); b.style.cssText = BTN[k].css; act.appendChild(b); bind(b).def = BTN[k].m; }
  AUX.forEach(([id, code, lbl, vis, kind], i) => {
    const b = mk('button'); b.style.cssText = `width:50px;height:50px;right:${(i % 5) * 54}px;bottom:${Math.floor(i / 5) * 54}px;font-size:${lbl.length > 2 ? 12 : 22}px`; b.textContent = lbl; aux.appendChild(b);
    bind(b).def = m => vis(m) ? D(code, lbl, kind || 'tap') : null;
  });
  // верхнее меню: метка, код, дополнительные свойства
  [['🗺', 'KeyT', 'Карта (T)'], ['👥', 'KeyM', 'Игроки (M)'], ['🦅', 'KeyG', 'Облёт / ходьба (G)'], ['?', 'KeyH', 'Справка (H)'], ['💬', 'Enter', 'Чат', 'gest'], ['↺', 'KeyR', 'Возродиться', 'tap', { shiftKey: true }], ['✕', 'Escape', 'Закрыть']].forEach(([lbl, code, title, kind, extra]) => {
    const b = mk('button'); b.textContent = lbl; b.title = title; menu.appendChild(b);
    const it = bind(b); it.def = () => D(code, lbl, kind || 'tap');
    if (extra) { const o = it.def; it.def = () => Object.assign(o(), { x: extra }); }
  });
  // обновление подписей и видимости по режиму
  let lastMode = '';
  function refresh() {
    const m = getMode(); if (m === lastMode) return; lastMode = m;
    document.body.dataset.tm = m;
    for (const it of items) {
      const d = it.def(m); it.cur = d;
      it.el.classList.toggle('hide', !d);
      if (d && it.el.dataset.l !== d.l && it.el.parentNode === act) { it.el.textContent = d.l; it.el.dataset.l = d.l; }
    }
  }
  setInterval(refresh, 150);

  /* ───── джойстик (плавающий) ───── */
  const base = mk('div', null, 'base'), knob = mk('div', null, 'knob'); base.appendChild(knob); joy.appendChild(base);
  const R = 62;
  let jp = null, ox = 0, oy = 0; const jk = { KeyW: 0, KeyA: 0, KeyS: 0, KeyD: 0 };
  const setK = (c, v) => { if (v) kd(c); else ku(c); };
  function jmove(e) {
    let dx = e.clientX - ox, dy = e.clientY - oy; const len = Math.hypot(dx, dy), s = len > R ? R / len : 1; const kx = dx * s, ky = dy * s;
    knob.style.transform = `translate(${kx}px,${ky}px)`;
    const nx = kx / R, ny = ky / R, mag = Math.hypot(nx, ny);
    setK('KeyW', ny < -0.38); setK('KeyS', ny > 0.38); setK('KeyA', nx < -0.38); setK('KeyD', nx > 0.38);
    if (getMode() === 'walk') setK('ShiftLeft', mag > 0.38 && mag < 0.6);      // лёгкий наклон — идти шагом, полный — бежать
  }
  function jend(e) {
    if (jp !== e.pointerId) return; jp = null; knob.style.transform = '';
    for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) ku(c); if (!items.some(i => i.held === 'ShiftLeft')) ku('ShiftLeft');
    base.style.left = base.style.bottom = base.style.top = '';
  }
  joy.addEventListener('pointerdown', e => {
    if (jp !== null) return; e.preventDefault(); jp = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch (x) {}
    ox = e.clientX; oy = e.clientY; base.style.left = Math.max(4, ox - 70) + 'px'; base.style.top = (oy - 70) + 'px'; base.style.bottom = 'auto';
  });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jp) jmove(e); });
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend); joy.addEventListener('lostpointercapture', jend);

  /* ───── камера: перетаскивание по сцене ───── */
  const SENS = 1.25; let cp = null, lx = 0, ly = 0;
  const rm = (dx, dy) => { const ev = new MouseEvent('mousemove', { bubbles: true, clientX: innerWidth / 2, clientY: innerHeight / 2 }); Object.defineProperty(ev, 'movementX', { value: dx }); Object.defineProperty(ev, 'movementY', { value: dy }); window.dispatchEvent(ev); };
  addEventListener('pointerdown', e => { if (cp === null && e.pointerType === 'touch' && window.__richardActive && window.__canvas && e.target === window.__canvas) { cp = e.pointerId; lx = e.clientX; ly = e.clientY; } });
  addEventListener('pointermove', e => { if (e.pointerId !== cp) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; rm(dx * SENS, dy * SENS); });
  const cend = e => { if (e.pointerId === cp) cp = null; }; addEventListener('pointerup', cend); addEventListener('pointercancel', cend);

  /* ───── сборка ───── */
  const mount = () => {
    document.body.append(joy, aux, act, menu); refresh();
    const upd = () => document.body.classList.toggle('tc-typing', typing());
    document.addEventListener('focusin', upd); document.addEventListener('focusout', () => setTimeout(upd, 0));
  };
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);
})();
