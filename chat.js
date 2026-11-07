// chat.js — чат игроков. Enter — открыть поле ввода, Enter — отправить, Esc — закрыть. Сообщения видны всем, кто на сервере (и зрителям тоже).
// Старые строки через 15 секунд гаснут (пока поле ввода открыто — видны все).
import { CHARS } from './network.js';

export function startChat({ net, getName }) {
  const css = document.createElement('style');
  css.textContent = `
  #chat{position:fixed;left:14px;bottom:14px;width:min(380px,70vw);z-index:30;font:13px/1.35 -apple-system,"Segoe UI",Roboto,sans-serif;pointer-events:none}
  #chat .log{display:flex;flex-direction:column;gap:3px;max-height:34vh;overflow:hidden;justify-content:flex-end}
  #chat .ln{background:rgba(10,20,30,.62);color:#fff;border-radius:8px;padding:4px 9px;word-break:break-word;transition:opacity .6s;text-shadow:0 1px 2px #0008}
  #chat .ln b{color:#ffd36b} #chat .ln.me b{color:#8fe3a1} #chat .ln.sys{color:#cfd8e0;font-style:italic}
  #chat .ln.old{opacity:0}
  #chat.open .ln.old{opacity:1}
  #chat input{display:none;width:100%;margin-top:6px;font:inherit;font-size:14px;padding:8px 10px;border:2px solid #b8861b;border-radius:10px;background:rgba(255,255,255,.95);pointer-events:auto}
  #chat.open input{display:block}
  #chat .hintc{color:#fff;opacity:.7;font-size:11px;margin-top:4px;text-shadow:0 1px 2px #000}
  #chat.open .hintc{display:none}`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'chat';
  el.innerHTML = '<div class="log"></div><input maxlength="200" placeholder="Сообщение… (Enter — отправить, Esc — закрыть)" autocomplete="off"><div class="hintc">Enter — чат</div>';
  document.body.appendChild(el);
  const log = el.querySelector('.log'), input = el.querySelector('input');

  function add(name, text, cls = '') {
    const ln = document.createElement('div'); ln.className = 'ln ' + cls;
    if (name) { const b = document.createElement('b'); b.textContent = name + ': '; ln.appendChild(b); }
    ln.appendChild(document.createTextNode(text));
    log.appendChild(ln); while (log.children.length > 40) log.firstChild.remove();
    setTimeout(() => ln.classList.add('old'), 15000);
  }
  const isOpen = () => el.classList.contains('open');
  function open() { if (document.pointerLockElement) document.exitPointerLock(); el.classList.add('open'); input.value = ''; input.focus(); }
  function close() { el.classList.remove('open'); input.blur(); }
  input.addEventListener('keydown', e => {
    e.stopPropagation();                                       // чтобы WASD и прочие клавиши игры не срабатывали во время набора
    if (e.key === 'Enter') { const t = input.value.trim(); if (t) { const me = net.me; add(me ? me.name : getName(), t, 'me'); if (!net.chat(t)) add('', 'Сервер не запущен — сообщение никто не увидит', 'sys'); } close(); }
    else if (e.key === 'Escape') close();
  });
  input.addEventListener('keyup', e => e.stopPropagation());
  addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.repeat && !isOpen() && !(document.activeElement && document.activeElement.tagName === 'INPUT')) { e.preventDefault(); open(); }
  });
  net.onChat((name, text, ch) => add(name + (CHARS[ch] ? ' (' + CHARS[ch].name + ')' : ''), text));
  net.onChange((roster, api) => {                              // системные строки: кто вошёл/вышел
    const ids = new Set(roster.filter(p => p.play).map(p => p.id));
    if (!startChat._seen) { startChat._seen = new Map(); }
    const seen = startChat._seen;
    for (const p of roster) if (p.play && !seen.has(p.id) && p.id !== api.id) add('', `${p.name} вошёл в игру (${CHARS[p.ch] ? CHARS[p.ch].name : ''})`, 'sys');
    for (const [id, nm] of [...seen]) if (!ids.has(id)) add('', `${nm} вышел`, 'sys');
    seen.clear(); for (const p of roster) if (p.play) seen.set(p.id, p.name);
  });
  return { add, open, close };
}
