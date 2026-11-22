// Кнопка «во весь экран» (⛶ / ✕). В приложении и в режиме «На экран Домой» уже полный экран — кнопка не показывается.
(() => {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || location.protocol === 'ninjai:';
  if (!req || standalone) return;
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const b = document.createElement('button');
  Object.assign(b.style, { position: 'fixed', top: 'max(10px, env(safe-area-inset-top))', right: 'max(10px, env(safe-area-inset-right))', zIndex: 60, width: '44px', height: '44px', border: 0, borderRadius: '12px', background: 'rgba(0,0,0,.45)', color: '#fff', font: '22px/1 sans-serif', cursor: 'pointer', touchAction: 'manipulation' });
  const sync = () => { b.textContent = isFs() ? '✕' : '⛶'; b.title = isFs() ? 'Выйти из полного экрана' : 'Во весь экран'; };
  b.onclick = e => { e.stopPropagation(); try { isFs() ? exit.call(document) : req.call(el); } catch { /* не поддерживается */ } };
  for (const t of ['pointerdown', 'touchstart', 'mousedown']) b.addEventListener(t, e => e.stopPropagation());
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
  sync(); document.body.appendChild(b);
})();
