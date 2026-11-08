// minimap.js — миникарта в углу экрана: рельеф архипелага, вы (красная стрелка), другие игроки (цветные точки с именами и расстоянием),
// а в режимах — базы, точки захвата и флаги. N — размер (малая / большая / скрыть). В «Прятках» чужие игроки на карте скрыты.
import { CHARS } from './network.js';

const TEAM_COL = { red: '#ff5a4f', blue: '#4f9bff' };
const hue = id => `hsl(${(id * 67) % 360},85%,58%)`;

export function startMinimap({ world, net, richard, getGame, getMode, ships, getDbg }) {
  const WW = world.size.W, WH = world.size.H, CW = 440, CH = Math.round(CW * WH / WW);
  const css = document.createElement('style');
  css.textContent = `
  #mmap{position:fixed;left:14px;top:92px;z-index:45;display:none;pointer-events:none;font:600 12px -apple-system,"Segoe UI",sans-serif;color:#fff;text-shadow:0 1px 2px #000}
  #mmap.on{display:block} #mmap canvas{display:block;border-radius:12px;border:2px solid rgba(255,255,255,.85);box-shadow:0 4px 18px rgba(0,0,0,.45);background:#2a6c9c}
  #mmap .lg{margin-top:5px;display:flex;flex-direction:column;gap:2px} #mmap .lg div{background:rgba(10,20,30,.7);border-radius:8px;padding:2px 8px;width:max-content;max-width:100%}
  #mmap .hint{opacity:.75;font-weight:400;margin-top:3px}`;
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'mmap';
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; box.appendChild(cv);
  const lg = document.createElement('div'); lg.className = 'lg'; box.appendChild(lg);
  const hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = 'N — размер карты'; box.appendChild(hint);
  document.body.appendChild(box);
  const g = cv.getContext('2d');

  /* рельеф рисуем один раз во вспомогательный холст */
  const bg = document.createElement('canvas'); bg.width = CW; bg.height = CH; let baked = false;
  const bake = () => {
    const c = bg.getContext('2d'), im = c.createImageData(CW, CH), d = im.data;
    for (let py = 0; py < CH; py++) for (let px = 0; px < CW; px++) {
      const x = (px / CW - 0.5) * WW, z = (py / CH - 0.5) * WH, h = world.heightAt(x, z); let r, gg, b;
      if (h < 0) { const t = Math.min(1, -h / 14); r = 70 - 50 * t; gg = 140 - 80 * t; b = 195 - 55 * t; }
      else if (h < 0.8) { r = 232; gg = 212; b = 155; }
      else if (h < 14) { const t = h / 14; r = 120 - 30 * t; gg = 175 - 40 * t; b = 85 - 10 * t; }
      else if (h < 30) { r = 130; gg = 122; b = 110; } else { r = 240; gg = 244; b = 248; }
      const k = (py * CW + px) * 4; d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
    }
    c.putImageData(im, 0, 0); baked = true;
  };
  const toP = (x, z) => [(x / WW + 0.5) * CW, (z / WH + 0.5) * CH];
  const size = [250, 520, 0]; let sizeIdx = 0;
  const applySize = () => { cv.style.width = size[sizeIdx] + 'px'; cv.style.height = Math.round(size[sizeIdx] * CH / CW) + 'px'; box.classList.toggle('on', sizeIdx < 2 && active()); };
  addEventListener('keydown', e => { if (e.code === 'KeyN' && !e.repeat && !/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) { sizeIdx = (sizeIdx + 1) % size.length; applySize(); } });
  const active = () => !!(net.me && net.me.play) && getMode() === 'walk';

  const dot = (x, z, col, r, label) => {
    const [px, py] = toP(x, z); g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); g.stroke();
    if (label) { g.font = 'bold 15px -apple-system,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(label, px + r + 4, py); g.fillStyle = '#fff'; g.fillText(label, px + r + 4, py); }
  };
  function draw() {
    if (!active()) { box.classList.remove('on'); return; }
    applySize(); if (sizeIdx >= 2) return;
    if (!baked) bake();
    g.drawImage(bg, 0, 0);
    const G = getGame() || {}, inPlay = G.phase === 'play', P = richard.P, pl = new Map((G.pl || []).map(a => [a[0], a])), names = new Map((net.roster || []).map(p => [p.id, p]));
    // объекты режима: базы, точки захвата, флаги
    if (inPlay) {
      if (G.bases) for (const t of ['red', 'blue']) { const b = G.bases[t]; if (!b) continue; const [px, py] = toP(b.x, b.z); g.strokeStyle = TEAM_COL[t]; g.lineWidth = 3; g.beginPath(); g.arc(px, py, 9, 0, 7); g.stroke(); g.font = '15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('🏠', px, py + 1); }
      if (G.points) for (const q of G.points) { const col = q.o ? TEAM_COL[q.o] : Math.abs(q.p) > 0.02 ? TEAM_COL[q.p > 0 ? 'red' : 'blue'] : '#cfcfcf', [px, py] = toP(q.x, q.z); g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 8, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#000'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚑', px, py + 1); }
      if (G.flags) for (const f of G.flags) { if (f.st === 'carried') continue; const [px, py] = toP(f.x, f.z); g.font = '16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = TEAM_COL[f.team]; g.fillText('🚩', px, py); }
    }
    // корабли: свои/чужие цветом хозяина, пустые — серые, потонувшие — крестом
    if (ships) { const own = new Map(); for (const a of G.pl || []) if (a[8] != null) own.set(a[8], a); const nvHp = new Map((G.nv || []).map(q => [q[0], q[1]]));
      ships.list.forEach((v, k) => {
        const [px, py] = toP(v.g.position.x, v.g.position.z), o = inPlay ? own.get(k) : null, dead = (o && o[7] <= 0) || (!o && nvHp.get(k) === 0), col = o ? (o[0] === net.id ? '#ff5a4f' : hue(o[0])) : '#e8e8e8';
        g.save(); g.translate(px, py); g.rotate(Math.PI - v.yaw); g.fillStyle = dead ? 'rgba(80,80,80,.6)' : col; g.strokeStyle = '#102030'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -9); g.lineTo(4.5, 3); g.lineTo(3, 8); g.lineTo(-3, 8); g.lineTo(-4.5, 3); g.closePath(); g.fill(); g.stroke(); g.restore();
        if (dead) { g.strokeStyle = '#ff6b6b'; g.lineWidth = 2; g.beginPath(); g.moveTo(px - 5, py - 5); g.lineTo(px + 5, py + 5); g.moveTo(px + 5, py - 5); g.lineTo(px - 5, py + 5); g.stroke(); }
      }); }
    // другие игроки (в прятках не показываем)
    const hideAll = inPlay && G.mode === 'hide', rows = [];
    if (!hideAll) for (const b of net.bodies()) {
      const a = pl.get(b.id), who = names.get(b.id), col = inPlay && a && a[3] ? TEAM_COL[a[3]] : hue(b.id), nm = who ? who.name : 'Игрок ' + b.id;
      dot(b.x, b.z, col, 7, nm);
      const dx = b.x - P.pos.x, dz = b.z - P.pos.z, dist = Math.round(Math.hypot(dx, dz)), arrows = ['⬆', '↗', '➡', '↘', '⬇', '↙', '⬅', '↖'];      // стороны света: вверх по карте = −z
      const dirI = Math.round(((Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
      rows.push(`<div style="border-left:4px solid ${col}">${CHARS[who && who.ch] ? CHARS[who.ch].icon : '👤'} ${nm.replace(/</g, '&lt;')} — ${dist} м ${arrows[dirI]}</div>`);
    }
    // я: красная стрелка по направлению взгляда
    { const [px, py] = toP(P.pos.x, P.pos.z), yaw = P.yawVis ?? P.yaw; g.save(); g.translate(px, py); g.rotate(Math.PI - yaw); g.fillStyle = '#ff2d2d'; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -11); g.lineTo(7.5, 8); g.lineTo(0, 4); g.lineTo(-7.5, 8); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    const html = hideAll ? '<div>🙈 В прятках игроки на карте скрыты</div>' : rows.join('') || '<div>Других игроков пока нет</div>';
    if (html !== draw.last) { draw.last = html; lg.innerHTML = html; }
  }
  setInterval(draw, 100);
  applySize();
  return { draw };
}
