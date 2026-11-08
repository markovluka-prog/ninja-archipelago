// stream.js — «пиксельный стрим»: игроки, которые зашли НЕ с компьютера хозяина, не запускают Three.js у себя.
// Для каждого такого игрока на машине хозяина поднимается свой безголовый Chrome-вкладка (отдельный профиль), в ней открывается обычная игра (index.html?full=1),
// а её картинка (JPEG-кадры CDP screencast) летит игроку по WebSocket /stream; клавиши, мышь и колесо летят обратно и подаются в ту вкладку.
// Хозяин (открыл с этого же компьютера без прокси) играет как раньше — напрямую. Принудительно полный клиент: добавить ?full=1 к ссылке.
'use strict';
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_SESSIONS = +(process.env.STREAM_MAX || 4), MAX_W = +(process.env.STREAM_W || 1280), MAX_H = +(process.env.STREAM_H || 720), QUALITY = +(process.env.STREAM_Q || 82), NTH = +(process.env.STREAM_NTH || 2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sessions = new Set();

/* ───── безголовый Chrome и CDP ───── */
let chromeProc = null, conn = null, connP = null;
const findChrome = () => [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean).find(p => fs.existsSync(p));
const killChrome = () => { try { chromeProc && chromeProc.kill(); } catch { /* */ } chromeProc = null; };
for (const ev of ['exit']) process.on(ev, killChrome);
for (const sg of ['SIGINT', 'SIGTERM']) process.on(sg, () => { killChrome(); process.exit(0); });

function getConn() {
  if (conn && conn.ws.readyState === 1) return Promise.resolve(conn);
  if (connP) return connP;
  connP = (async () => {
    const exe = findChrome(); if (!exe) throw new Error('Chrome не найден: задайте переменную CHROME_PATH');
    const dir = path.join(os.tmpdir(), 'ninja-stream-chrome-' + process.pid); fs.rmSync(dir, { recursive: true, force: true });
    const flags = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required', '--window-size=' + MAX_W + ',' + MAX_H];
    if (process.env.STREAM_SOFTWARE) flags.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
    chromeProc = spawn(exe, [...flags, '--user-data-dir=' + dir, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
    chromeProc.on('exit', () => { chromeProc = null; conn = null; for (const s of [...sessions]) s.close('браузер игры закрылся'); });
    let info = null;
    for (let i = 0; i < 80 && !info; i++) { await sleep(250); try { const t = fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n'); if (t[0] && t[1]) info = { port: t[0], path: t[1] }; } catch { /* ещё не записан */ } }
    if (!info) throw new Error('Chrome не запустился');
    const ws = await new Promise((res, rej) => { const w = new WebSocket(`ws://127.0.0.1:${info.port}${info.path}`); w.onopen = () => res(w); w.onerror = () => rej(new Error('нет связи с Chrome')); });
    const c = { ws, id: 0, pend: new Map(), ev: new Map() };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.id) { const p = c.pend.get(m.id); if (p) { c.pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } }
      else if (m.sessionId) { const h = c.ev.get(m.sessionId); if (h) h(m.method, m.params); } };
    ws.onclose = () => { if (conn === c) conn = null; };
    conn = c; return c;
  })().finally(() => { connP = null; });
  return connP;
}
const call = (c, method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++c.id; c.pend.set(id, { res, rej }); try { c.ws.send(JSON.stringify({ id, method, params, sessionId })); } catch (e) { c.pend.delete(id); rej(e); } });

/* ───── WebSocket к игроку ───── */
function wsFrame(buf, op) {
  const n = buf.length; let head;
  if (n < 126) head = Buffer.from([0x80 | op, n]); else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(n, 2); } else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([head, buf]);
}
// скрипт, который выполняется в игровой вкладке до загрузки страницы: «захват мыши» подменяется (в безголовом браузере настоящего нет)
const SHIM = `(()=>{ window.__stream = true; window.__streamLocked = false;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get() { return window.__streamLocked ? (window.__canvas || null) : null; } });
  Document.prototype.exitPointerLock = function () {}; Element.prototype.requestPointerLock = function () {};
  window.__rm = (dx, dy) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true }));
})();`;
const VK = { Space: 32, Enter: 13, Backspace: 8, Tab: 9, Escape: 27, ShiftLeft: 16, ShiftRight: 16, ControlLeft: 17, ControlRight: 17, AltLeft: 18, AltRight: 18, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46, Home: 36, End: 35, PageUp: 33, PageDown: 34 };
const vkOf = code => VK[code] || (/^Key[A-Z]$/.test(code) ? code.charCodeAt(3) : /^Digit\d$/.test(code) ? code.charCodeAt(5) : 0);
// профиль качества зависит от числа стрим-игроков: чем больше, тем меньше разрешение и частота кадров — нагрузка на компьютер хозяина держится в пределах
const profile = () => { const n = sessions.size; return n >= 4 ? { f: 0.8, nth: 2, q: 70 } : n === 3 ? { f: 0.9, nth: 2, q: 76 } : { f: 1, nth: NTH, q: QUALITY }; };
const effSize = (S, p) => [Math.max(320, Math.round(S.rw * p.f)), Math.max(200, Math.round(S.rh * p.f))];
function applyProfile(S) {
  if (!S.s || S.closed) return; const p = profile(), [w, h] = effSize(S, p);
  if (w === S.w && h === S.h && p.nth === S.nth && p.q === S.q) return;
  S.w = w; S.h = h; S.nth = p.nth; S.q = p.q;
  S.s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }).catch(() => {});
  S.s('Page.stopScreencast').then(() => S.s('Page.startScreencast', { format: 'jpeg', quality: p.q, maxWidth: w, maxHeight: h, everyNthFrame: p.nth })).catch(() => {});
}
const applyAll = () => { for (const S of sessions) applyProfile(S); };
const clampSize = (w, h) => { w = Math.max(320, Math.min(MAX_W, Math.round(+w) || MAX_W)); h = Math.max(200, Math.min(MAX_H, Math.round(+h) || MAX_H)); return [w, h]; };

async function openSession(sock, q) {
  const S = { sock, closed: false, w: 0, h: 0, mx: 0.5, my: 0.5, btn: 0, timers: [], close: null };
  sessions.add(S);
  const toThin = (obj) => { try { sock.write(wsFrame(Buffer.from(JSON.stringify(obj)), 1)); } catch { /* */ } };
  S.close = (why) => {
    if (S.closed) return; S.closed = true; sessions.delete(S); S.timers.forEach(clearInterval); setTimeout(applyAll, 0);
    if (why) { toThin({ t: 'err', msg: why }); console.log('[стрим] ошибка: ' + why); }
    (async () => { try { if (S.c && S.sid) { await call(S.c, 'Page.stopScreencast', {}, S.sid).catch(() => {}); } if (S.c && S.target) await call(S.c, 'Target.closeTarget', { targetId: S.target }).catch(() => {}); if (S.c && S.ctx) await call(S.c, 'Target.disposeBrowserContext', { browserContextId: S.ctx }).catch(() => {}); } catch { /* */ } })();
    try { sock.end(); } catch { /* */ }
    console.log(`[стрим] игрок отключился; сессий: ${sessions.size}`);
  };
  if (sessions.size > MAX_SESSIONS) return S.close('Слишком много игроков смотрят стрим — попробуйте позже');
  toThin({ t: 'msg', msg: 'Запускаем вашу игру на компьютере хозяина…' });
  try {
    const c = S.c = await getConn(); if (S.closed) return;
    const [rw, rh] = clampSize(q.w, q.h); S.rw = rw; S.rh = rh; const pf = profile(), [w, h] = effSize(S, pf); S.w = w; S.h = h; S.nth = pf.nth; S.q = pf.q;
    S.ctx = (await call(c, 'Target.createBrowserContext', { disposeOnDetach: false })).browserContextId;
    S.target = (await call(c, 'Target.createTarget', { url: 'about:blank', browserContextId: S.ctx, width: w, height: h })).targetId;
    const sid = S.sid = (await call(c, 'Target.attachToTarget', { targetId: S.target, flatten: true })).sessionId;
    const s = (m, p) => call(c, m, p, sid).catch(e => { throw new Error(m + ': ' + e.message); });
    c.ev.set(sid, (method, p) => {
      if (method === 'Page.screencastFrame') {
        s('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
        if (S.closed || sock.writableLength > 600000) return;        // клиент не успевает — пропускаем кадр
        try { sock.write(wsFrame(Buffer.from(p.data, 'base64'), 2)); } catch { /* */ }
      } else if (method === 'Inspector.targetCrashed') S.close('Игровая вкладка упала');
    });
    await s('Page.enable'); await s('Emulation.setFocusEmulationEnabled', { enabled: true });
    await s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await s('Page.addScriptToEvaluateOnNewDocument', { source: SHIM });
    const qs = new URLSearchParams({ full: '1' }); if (/^\d{3}$/.test(q.room || '')) qs.set('room', q.room);
    await s('Page.navigate', { url: `http://127.0.0.1:${q.port}/index.html?${qs}` });
    s('Page.bringToFront').catch(() => {});
    for (let i = 0; ; i++) { try { await s('Page.startScreencast', { format: 'jpeg', quality: S.q, maxWidth: w, maxHeight: h, everyNthFrame: S.nth }); break; } catch (e) { if (i >= 20 || S.closed) throw e; await sleep(400); } }      // сразу после navigate вкладка иногда ещё не «активна»
    toThin({ t: 'ready', w, h });
    console.log(`[стрим] новая сессия ${w}×${h}; сессий: ${sessions.size}`);
    S.timers.push(setInterval(async () => {           // состояние страницы для клиента: открыто ли меню (тогда мышь — обычная) и можно ли «захватить» мышь
      try { const r = await s('Runtime.evaluate', { expression: "JSON.stringify({lobby:!!document.querySelector('#lobby.on'),walk:!!window.__richardActive})", returnByValue: true }); if (r.result && r.result.value) toThin({ t: 'st', ...JSON.parse(r.result.value) }); } catch { /* страница грузится */ }
    }, 500));
    S.s = s; applyAll();
  } catch (e) { S.close('Не удалось запустить игру: ' + e.message); }
  return S;
}

function onThin(S, m) {
  if (!S.s || S.closed) return; const s = S.s, px = () => Math.round(S.mx * S.w), py = () => Math.round(S.my * S.h);
  const mod = (m.a ? 1 : 0) | (m.c ? 2 : 0) | (m.m ? 4 : 0) | (m.sh ? 8 : 0), er = () => {};
  if (m.t === 'k') {
    const down = !!m.d, text = down && typeof m.key === 'string' && m.key.length === 1 && !m.c && !m.m ? m.key : (down && m.key === 'Enter' ? '\r' : undefined), vk = vkOf(m.code);
    s('Input.dispatchKeyEvent', { type: down ? (text ? 'keyDown' : 'rawKeyDown') : 'keyUp', key: m.key, code: m.code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text, unmodifiedText: text, modifiers: mod, autoRepeat: !!m.rep }).catch(er);
  } else if (m.t === 'mm') { S.mx = +m.x || 0; S.my = +m.y || 0; s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: px(), y: py(), button: 'none', buttons: S.btn, modifiers: mod }).catch(er); }
  else if (m.t === 'mb') {
    if (m.x != null) { S.mx = +m.x || 0; S.my = +m.y || 0; }
    const bit = m.b === 2 ? 2 : m.b === 1 ? 4 : 1; S.btn = m.d ? S.btn | bit : S.btn & ~bit;
    s('Input.dispatchMouseEvent', { type: m.d ? 'mousePressed' : 'mouseReleased', x: px(), y: py(), button: m.b === 2 ? 'right' : m.b === 1 ? 'middle' : 'left', buttons: S.btn, clickCount: 1, modifiers: mod }).catch(er);
  } else if (m.t === 'md') s('Runtime.evaluate', { expression: `window.__rm&&window.__rm(${Math.round(+m.dx || 0)},${Math.round(+m.dy || 0)})` }).catch(er);
  else if (m.t === 'w') s('Input.dispatchMouseEvent', { type: 'mouseWheel', x: px(), y: py(), deltaX: 0, deltaY: Math.max(-400, Math.min(400, +m.dy || 0)), button: 'none' }).catch(er);
  else if (m.t === 'lock') { if (m.on) { S.mx = S.my = 0.5; } s('Runtime.evaluate', { expression: `window.__streamLocked=${m.on ? 'true' : 'false'}` }).catch(er); }
  else if (m.t === 'size') { const [rw, rh] = clampSize(m.w, m.h); S.rw = rw; S.rh = rh; applyProfile(S); }
}

function upgrade(req, sock, port) {
  const key = req.headers['sec-websocket-key']; if (!key) { sock.destroy(); return; }
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
  sock.setNoDelay(true);
  const url = new URL(req.url, 'http://x'), q = { w: url.searchParams.get('w'), h: url.searchParams.get('h'), room: url.searchParams.get('room'), port };
  let S = null, buf = Buffer.alloc(0), pending = [];
  openSession(sock, q).then(x => { S = x; for (const m of pending) onThin(S, m); pending = []; });
  const drop = () => { if (S) S.close(); else sock.destroy(); };
  sock.on('close', drop); sock.on('error', drop);
  sock.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const op = buf[0] & 0x0f, masked = !!(buf[1] & 0x80); let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 100000) { sock.destroy(); return; }
      const need = off + (masked ? 4 : 0) + len; if (buf.length < need) return;
      let data = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const mk = buf.subarray(off, off + 4); data = Buffer.from(data); for (let i = 0; i < data.length; i++) data[i] ^= mk[i & 3]; }
      buf = buf.subarray(need);
      if (op === 8) { try { sock.end(wsFrame(Buffer.alloc(0), 8)); } catch { /* */ } drop(); return; }
      if (op === 9) { try { sock.write(wsFrame(data, 10)); } catch { /* */ } continue; }
      if (op !== 1) continue;
      let m; try { m = JSON.parse(data.toString()); } catch { continue; }
      if (S) onThin(S, m); else if (pending.length < 200) pending.push(m);
    }
  });
}

// хозяин — тот, кто открыл с этого же компьютера напрямую (без туннеля/прокси); остальным отдаём тонкий клиент stream.html
const isHost = req => {
  if (process.env.STREAM_ALL === '1') return false;      // проверка: считать хозяином никого
  const a = req.socket.remoteAddress || '', loop = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(a);
  return loop && !req.headers['x-forwarded-for'] && !req.headers['cf-connecting-ip'] && !req.headers['x-real-ip'];
};
module.exports = { upgrade, isHost, enabled: process.env.NO_STREAM !== '1' };
