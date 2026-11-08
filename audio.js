// audio.js — звук игры целиком синтезируется на лету (Web Audio), без аудиофайлов:
//  • музыка: процедурная, настроение меняется (спокойная днём, тихая ночью, напряжённая в боях, эпичная на драконах);
//  • окружение: вода у берега и в воде, ветер (выше и быстрее — сильнее), птицы днём, сверчки ночью, чайки у моря;
//  • эффекты: шаги по траве/песку/камню/доскам, прыжок и приземление, удары, щит, лук, стрелы, раны, смерть, плеск, лестницы, копыта, крылья и огонь дракона, пушки, победа.
// Разговоров (голоса жителей) здесь нет. Звук включается после первого нажатия/клика на странице (правило браузеров). Кнопка 🔊 слева внизу — выключить/включить.
// Другие модули дёргают эффекты так:  window.__snd('имя', громкость)   и   window.__sndLoop('fire', вкл, громкость).
export function createAudio({ world, richard, net }) {
  const P = richard.P, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  if (window.__stream) { window.__snd = () => {}; window.__sndLoop = () => {}; return { update() {} }; }      // стрим-вкладка на машине хозяина звук не воспроизводит
  let ctx = null, master, musicG, sfxG, ambG, delayIn, noiseW, noiseB;
  let muted = false; try { muted = localStorage.getItem('ninja.mute') === '1'; } catch { /* */ }
  const hAt = (x, z) => world.heightAt(x, z);

  /* ───── граф: музыка / эффекты / окружение → мастер → компрессор ───── */
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(comp);
    musicG = ctx.createGain(); musicG.gain.value = 0.28; musicG.connect(master);
    sfxG = ctx.createGain(); sfxG.gain.value = 0.75; sfxG.connect(master);
    ambG = ctx.createGain(); ambG.gain.value = 0.6; ambG.connect(master);
    const n = ctx.sampleRate * 2; noiseW = ctx.createBuffer(1, n, ctx.sampleRate); noiseB = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = noiseW.getChannelData(0), b = noiseB.getChannelData(0); let last = 0; for (let i = 0; i < n; i++) { const x = Math.random() * 2 - 1; w[i] = x; last = (last + 0.02 * x) / 1.02; b[i] = last * 3.5; }      // белый и «коричневый» шум
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.375; const fb = ctx.createGain(); fb.gain.value = 0.34; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    delayIn = ctx.createGain(); delayIn.gain.value = 0.55; delayIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musicG);      // эхо для арпеджио
    startAmbient(); return ctx;
  }
  const unlock = () => { if (ensure()) { removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); } };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

  /* ───── кирпичики ───── */
  function tone({ f = 440, f2 = null, type = 'sine', a = 0.005, d = 0.2, v = 0.3, at = 0, out = null, detune = 0 }) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + a + d); o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    o.connect(g); g.connect(out || sfxG); o.start(t); o.stop(t + a + d + 0.05); return g;
  }
  function noise({ dur = 0.2, type = 'lowpass', f = 800, f2 = null, q = 1, a = 0.005, v = 0.3, at = 0, out = null, brown = false }) {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = brown ? noiseB : noiseW; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out || sfxG); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return g;
  }

  /* ───── эффекты ───── */
  const SFX = {
    step_grass: v => noise({ dur: 0.1, f: rnd(380, 600), v: 0.16 * v, brown: true }),
    step_sand: v => noise({ dur: 0.12, f: rnd(700, 1100), v: 0.13 * v }),
    step_stone: v => { noise({ dur: 0.06, type: 'bandpass', f: rnd(1700, 2400), q: 2, v: 0.2 * v }); tone({ f: rnd(150, 190), f2: 90, d: 0.07, v: 0.1 * v }); },
    step_wood: v => { tone({ f: rnd(110, 150), f2: 70, type: 'triangle', d: 0.09, v: 0.22 * v }); noise({ dur: 0.05, type: 'bandpass', f: 900, q: 1.5, v: 0.1 * v }); },
    step_water: v => noise({ dur: 0.18, type: 'bandpass', f: rnd(900, 1500), f2: 500, q: 1, v: 0.16 * v }),
    jump: v => { tone({ f: 200, f2: 420, type: 'triangle', d: 0.13, v: 0.1 * v }); noise({ dur: 0.1, type: 'highpass', f: 1500, v: 0.05 * v }); },
    land: v => { tone({ f: 120, f2: 55, d: 0.16, v: 0.3 * v }); noise({ dur: 0.14, f: 500, v: 0.2 * v, brown: true }); },
    swing: v => noise({ dur: 0.2, type: 'bandpass', f: 700, f2: 2600, q: 1.2, a: 0.04, v: 0.2 * v }),
    whoosh: v => noise({ dur: 0.35, type: 'bandpass', f: 300, f2: 1400, q: 0.8, a: 0.1, v: 0.22 * v }),
    clang: v => { for (const f of [820, 1330, 2210]) tone({ f, f2: f * 0.985, type: 'square', d: 0.35, v: 0.05 * v }); noise({ dur: 0.05, type: 'highpass', f: 3000, v: 0.12 * v }); },
    thunk: v => { tone({ f: 170, f2: 70, type: 'triangle', d: 0.12, v: 0.3 * v }); noise({ dur: 0.07, f: 1200, v: 0.14 * v }); },
    ping: v => { tone({ f: 1500, f2: 1480, d: 0.28, v: 0.14 * v }); tone({ f: 2250, d: 0.2, v: 0.06 * v }); },
    shoot: v => { tone({ f: 340, f2: 110, type: 'triangle', d: 0.16, v: 0.22 * v }); noise({ dur: 0.18, type: 'bandpass', f: 1800, f2: 600, v: 0.1 * v }); },
    draw: v => noise({ dur: 0.5, type: 'bandpass', f: 220, f2: 420, q: 4, a: 0.2, v: 0.08 * v }),
    arrowhit: v => { tone({ f: 190, f2: 90, type: 'triangle', d: 0.08, v: 0.2 * v }); noise({ dur: 0.04, f: 2000, v: 0.08 * v }); },
    hurt: v => { tone({ f: 330, f2: 160, type: 'sawtooth', d: 0.2, v: 0.14 * v }); noise({ dur: 0.12, f: 900, v: 0.12 * v }); },
    death: v => { tone({ f: 300, f2: 55, type: 'sawtooth', d: 0.9, v: 0.18 * v }); noise({ dur: 0.7, f: 600, f2: 120, v: 0.14 * v }); },
    splash: v => { noise({ dur: 0.5, type: 'lowpass', f: 2600, f2: 400, a: 0.02, v: 0.3 * v }); noise({ dur: 0.3, type: 'highpass', f: 2500, v: 0.08 * v, at: 0.03 }); },
    clank: v => { tone({ f: rnd(700, 900), f2: 600, type: 'square', d: 0.08, v: 0.05 * v }); noise({ dur: 0.04, type: 'highpass', f: 2500, v: 0.08 * v }); },
    scrape: v => noise({ dur: 0.45, type: 'bandpass', f: 1200, f2: 600, q: 1.5, a: 0.05, v: 0.12 * v }),
    hoof: v => { tone({ f: rnd(220, 260), f2: 120, type: 'triangle', d: 0.06, v: 0.2 * v }); noise({ dur: 0.04, type: 'bandpass', f: 1500, q: 2, v: 0.1 * v }); },
    flap: v => { noise({ dur: 0.38, f: 260, f2: 120, a: 0.06, v: 0.34 * v, brown: true }); noise({ dur: 0.3, type: 'bandpass', f: 700, f2: 300, a: 0.08, v: 0.08 * v }); },
    roar: v => { tone({ f: 95, f2: 50, type: 'sawtooth', a: 0.12, d: 1.2, v: 0.16 * v }); tone({ f: 140, f2: 70, type: 'square', a: 0.15, d: 1.0, v: 0.06 * v }); noise({ dur: 1.2, f: 700, f2: 200, a: 0.2, v: 0.22 * v, brown: true }); },
    boom: v => { tone({ f: 90, f2: 30, d: 0.7, v: 0.4 * v }); noise({ dur: 0.7, f: 900, f2: 90, v: 0.35 * v, brown: true }); },
    relic: v => [0, 4, 7, 12].forEach((s, i) => tone({ f: 784 * Math.pow(2, s / 12), type: 'triangle', d: 0.5, v: 0.1 * v, at: i * 0.08 })),
    start: v => [0, 7, 12].forEach((s, i) => tone({ f: 330 * Math.pow(2, s / 12), type: 'sawtooth', a: 0.02, d: 0.5, v: 0.07 * v, at: i * 0.14 })),
    win: v => [0, 4, 7, 12, 16, 19].forEach((s, i) => tone({ f: 392 * Math.pow(2, s / 12), type: 'triangle', a: 0.01, d: 0.8, v: 0.12 * v, at: i * 0.12 })),
    kill: v => { tone({ f: 520, f2: 260, type: 'square', d: 0.15, v: 0.06 * v }); noise({ dur: 0.12, type: 'bandpass', f: 1200, v: 0.1 * v }); },
    chirp: v => { const f = rnd(2300, 3600), n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) tone({ f, f2: f * rnd(0.7, 1.4), d: 0.07, v: 0.035 * v, at: i * 0.1 }); },
    gull: v => { tone({ f: 900, f2: 1500, type: 'sawtooth', a: 0.05, d: 0.35, v: 0.03 * v }); tone({ f: 1400, f2: 800, type: 'sawtooth', a: 0.05, d: 0.3, v: 0.025 * v, at: 0.35 }); },
    cricket: v => { for (let i = 0; i < 3; i++) tone({ f: 4300, d: 0.035, v: 0.015 * v, at: i * 0.06 }); },
  };
  const gap = { step_grass: 0.07, step_sand: 0.07, step_stone: 0.07, step_wood: 0.07, step_water: 0.07, flap: 0.25, hoof: 0.05, clank: 0.08, chirp: 0.5, cricket: 0.2 }, lastAt = {};
  function play(name, v = 1) {
    if (!ctx || ctx.state !== 'running' || muted || !SFX[name]) return;
    const t = performance.now() / 1000; if (t - (lastAt[name] || 0) < (gap[name] || 0.03)) return; lastAt[name] = t;
    try { SFX[name](v); } catch { /* звук не должен ломать игру */ }
  }
  window.__snd = play;

  /* ───── непрерывные звуки: вода, ветер, огонь дракона ───── */
  const loops = {};
  function mkLoop(buf, type, f, q, lfoHz, lfoDepth) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(ambG); s.start();
    if (lfoHz) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = lfoHz; og.gain.value = lfoDepth; o.connect(og); og.connect(g.gain); o.start(); }
    return { g, fl, target: 0 };
  }
  function startAmbient() {
    loops.water = mkLoop(noiseB, 'lowpass', 650, 0.7, 0.13, 0.08);      // волны: набегают и отступают
    loops.surf = mkLoop(noiseW, 'highpass', 3200, 0.5, 0.17, 0.02);     // шипение пены
    loops.wind = mkLoop(noiseW, 'bandpass', 480, 0.6, 0.07, 0.04);
    loops.fire = mkLoop(noiseB, 'lowpass', 1100, 0.8, 11, 0.12);        // огненное дыхание (с потрескиванием)
    loops.fire2 = mkLoop(noiseW, 'highpass', 2200, 0.7, 23, 0.04);
  }
  const loopTarget = { fire: 0 };
  window.__sndLoop = (name, on, v = 1) => { if (name === 'fire') loopTarget.fire = on && !muted ? v : 0; };
  const setLoop = (L, v, dt, rate = 4) => { if (!L) return; L.target = v; L.g.gain.value += (v - L.g.gain.value) * Math.min(1, dt * rate); };

  /* ───── музыка ───── */
  const MOODS = {
    calm:   { bpm: 76, root: 48, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], scale: [0, 2, 4, 7, 9], perc: 0, arp: 0.5, pad: 0.9 },
    night:  { bpm: 58, root: 45, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], scale: [0, 3, 5, 7, 10], perc: 0, arp: 0.28, pad: 1.0 },
    battle: { bpm: 112, root: 38, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7]], scale: [0, 3, 5, 7, 10], perc: 1, arp: 0.7, pad: 0.75 },
    epic:   { bpm: 98, root: 40, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], scale: [0, 3, 5, 7, 10], perc: 2, arp: 0.8, pad: 1.0 },
  };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let mood = 'calm', nextBar = 0, barNo = 0, curMood = null;
  function pad(t, notes, dur, M) {
    for (const n of notes) for (const dt of [-7, 7]) {
      const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = dt; fl.type = 'lowpass'; fl.frequency.value = M.perc ? 1300 : 800; fl.Q.value = 0.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045 * M.pad, t + dur * 0.35); g.gain.setValueAtTime(0.045 * M.pad, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
      o.connect(fl); fl.connect(g); g.connect(musicG); o.start(t); o.stop(t + dur + 0.7);
    }
  }
  function pluck(t, m, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = mtof(m); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); o.connect(g); g.connect(musicG); g.connect(delayIn); o.start(t); o.stop(t + 0.6); }
  function bass(t, m, dur, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = mtof(m); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(musicG); o.start(t); o.stop(t + dur + 0.05); }
  function drum(t, kind, v) {
    if (kind === 'kick') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(musicG); o.start(t); o.stop(t + 0.25); return; }
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseW; fl.type = kind === 'hat' ? 'highpass' : 'bandpass'; fl.frequency.value = kind === 'hat' ? 7000 : 1800;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'hat' ? 0.05 : 0.14)); s.connect(fl); fl.connect(g); g.connect(musicG); s.start(t, Math.random()); s.stop(t + 0.2);
  }
  function scheduleBar(t, M) {
    const spb = 60 / M.bpm, chord = M.chords[barNo % 4], root = M.root;
    pad(t, chord.map(n => root + 12 + n), spb * 4, M);
    const bn = root - 12 + chord[0];
    bass(t, bn, spb * 1.8, 0.16); bass(t + spb * 2, bn + (M.perc ? 7 : 0), spb * 1.8, 0.13); if (M.perc) { bass(t + spb, bn, spb * 0.8, 0.1); bass(t + spb * 3, bn + 12, spb * 0.8, 0.09); }
    for (let i = 0; i < 8; i++) {                       // арпеджио/мелодия по восьмым
      if (Math.random() > M.arp) continue; const tt = t + i * spb / 2;
      const pickChord = Math.random() < 0.55, n = pickChord ? root + 12 + chord[Math.floor(Math.random() * chord.length)] + (Math.random() < 0.4 ? 12 : 0) : root + 12 + M.scale[Math.floor(Math.random() * M.scale.length)] + 12 * Math.floor(rnd(0, 2));
      pluck(tt, n, rnd(0.04, 0.085));
    }
    if (M.perc) for (let i = 0; i < 8; i++) {
      const tt = t + i * spb / 2; if (i % 4 === 0) drum(tt, 'kick', 0.4 * (M.perc > 1 ? 1.2 : 1)); if (i === 2 || i === 6) drum(tt, 'snare', 0.1); if (M.perc > 1 || i % 2 === 1) drum(tt, 'hat', 0.03);
    }
  }
  function pickMood() {
    const g = net.game, ph = world.tod && world.tod.phase;
    if (window.__dragonOn || (g && g.phase === 'play' && g.mode === 'dragons')) return 'epic';
    if (g && g.phase === 'play' && ['battle', 'capture', 'ctf', 'naval'].includes(g.mode)) return 'battle';
    if (ph === 'night' || (g && g.phase === 'play' && g.mode === 'hide')) return 'night';
    return 'calm';
  }
  function musicTick() {
    if (!ctx || ctx.state !== 'running') return; const m = pickMood();
    if (curMood !== m) { curMood = m; barNo = 0; mood = m; }
    const M = MOODS[mood], spb = 60 / M.bpm;
    if (!nextBar || nextBar < ctx.currentTime - 1) nextBar = ctx.currentTime + 0.1;
    while (nextBar < ctx.currentTime + 0.8) { if (!muted) scheduleBar(nextBar, M); nextBar += spb * 4; barNo++; }
  }
  setInterval(musicTick, 150);

  /* ───── кнопка звука ───── */
  const btn = document.createElement('div');
  btn.style.cssText = 'position:fixed;left:12px;bottom:34px;z-index:40;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;font:18px/34px sans-serif;text-align:center;cursor:pointer;user-select:none';
  btn.title = 'Звук: вкл/выкл'; const paint = () => { btn.textContent = muted ? '🔇' : '🔊'; }; paint();
  btn.addEventListener('click', e => { e.stopPropagation(); ensure(); muted = !muted; try { localStorage.setItem('ninja.mute', muted ? '1' : '0'); } catch { /* */ } if (master) master.gain.value = muted ? 0 : 0.85; paint(); });
  btn.addEventListener('mousedown', e => e.stopPropagation());
  document.body.appendChild(btn);

  /* ───── слежение за игрой: шаги, прыжки, удары, раны, вода, ветер ───── */
  let prevSt = '', prevHp = P.hp, prevDead = false, stepAcc = 0, lastX = P.pos.x, lastZ = P.pos.z, minVy = 0, ambT = 0, birdT = rnd(3, 8), hoofAcc = 0, ladderAcc = 0;
  const sm = { water: 0, wind: 0 };
  function surface() {
    const h = hAt(P.pos.x, P.pos.z);
    if (P.pos.y > h + 1.5) return 'wood';       // стоим выше земли — на настиле/крыше/палубе
    return h < 0.5 ? 'water' : h < 2.3 ? 'sand' : (P.pos.y > 28 && h > 30) ? 'stone' : 'grass';
  }
  function onState(prev, st) {
    const vy = P.vel.y;
    if (st === 'attack' || st === 'kick' || st === 'bash') play('swing', st === 'bash' ? 0.8 : 1);
    else if (st === 'parry') play('clang'); else if (st === 'block') play('clang', 0.5);
    else if (st === 'roll') play('whoosh', 0.8); else if (st === 'slide') play('scrape');
    else if (st === 'air' && (prev === 'ground' || prev === 'land') && vy > 3) play('jump');
    else if (st === 'swim' && prev !== 'swim') play('splash');
    else if (st === 'hit') play('hurt');
    if ((st === 'ground' || st === 'land') && ['air', 'glide', 'wallslide', 'hang', 'climb'].includes(prev)) { const k = clamp(-minVy / 55, 0.25, 1.3); if (surface() === 'water') play('splash', k); else play('land', k); }
    if (st === 'air' || st === 'glide') minVy = 0;
  }
  function update(dt) {
    if (!ctx || ctx.state !== 'running') return; dt = Math.min(dt, 0.1);
    const st = P.state, dx = P.pos.x - lastX, dz = P.pos.z - lastZ, spd = Math.hypot(dx, dz) / Math.max(dt, 1e-3); lastX = P.pos.x; lastZ = P.pos.z;
    if (Math.abs(spd) > 400) { /* телепорт: шаги не считаем */ } else {
      if (st !== prevSt) { onState(prevSt, st); prevSt = st; }
      if (st === 'air' || st === 'glide') minVy = Math.min(minVy, P.vel.y);
      if (!window.__dragonOn && !window.__riding && (st === 'ground') && spd > 2) { stepAcc += spd * dt; if (stepAcc > 6.5) { stepAcc = 0; play('step_' + surface(), clamp(spd / 22, 0.5, 1.2)); } } else stepAcc = 0;
      if (window.__ridingKind === 'horse' && spd > 3) { hoofAcc += spd * dt; if (hoofAcc > 4.2) { hoofAcc = 0; play('hoof', clamp(spd / 30, 0.5, 1)); } }
      if ((st === 'ladder' || st === 'climb') && spd + Math.abs(P.vel.y) > 1) { ladderAcc += dt; if (ladderAcc > 0.32) { ladderAcc = 0; play('clank'); } }
    }
    if (P.hp < prevHp - 0.5) play('hurt', clamp((prevHp - P.hp) / 25, 0.5, 1.3)); prevHp = P.hp;
    if (P.dead && !prevDead) play('death'); prevDead = !!P.dead;
    // вода и ветер: считаем 3 раза в секунду
    ambT -= dt; if (ambT <= 0) {
      ambT = 0.33; let dmin = 1e9;
      if (st === 'swim') dmin = 0; else for (const r of [8, 20, 45, 90]) { for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; if (hAt(P.pos.x + Math.cos(a) * r, P.pos.z + Math.sin(a) * r) < 0.3) { dmin = Math.min(dmin, r); break; } } if (dmin < 1e8) break; }
      const alt = Math.max(0, P.pos.y - Math.max(0, hAt(P.pos.x, P.pos.z)));
      const water = (dmin > 1e8 ? 0 : Math.pow(clamp(1 - dmin / 100, 0, 1), 1.2)) * clamp(1 - alt / 260, 0.15, 1);
      const dg = window.__dragonDbg, flying = window.__dragonOn && dg ? clamp(Math.abs(dg.speed) / 100, 0, 1) : 0;
      const wind = clamp(0.06 + alt / 160 * 0.35 + flying * 0.7 + (st === 'glide' ? 0.3 : 0), 0, 1);
      sm.water = water; sm.wind = wind;
    }
    setLoop(loops.water, sm.water * 0.55, dt, 2); setLoop(loops.surf, sm.water * 0.07, dt, 2); setLoop(loops.wind, sm.wind * 0.5, dt, 2.5);
    if (loops.wind) loops.wind.fl.frequency.value = 350 + sm.wind * 900;
    setLoop(loops.fire, loopTarget.fire * 0.55, dt, 12); setLoop(loops.fire2, loopTarget.fire * 0.22, dt, 12);
    // птицы днём, сверчки ночью, чайки у моря
    birdT -= dt; if (birdT <= 0) {
      const ph = world.tod && world.tod.phase; birdT = rnd(2.5, 7);
      if (ph === 'day' && sm.water < 0.5 && !P.dead) play('chirp', rnd(0.6, 1)); else if (ph === 'night') { play('cricket', 1); birdT = rnd(0.6, 1.8); } else if (sm.water > 0.35 && Math.random() < 0.5) play('gull', 1);
    }
  }
  /* ───── события игры ───── */
  net.on && net.on('ev', m => { const t = String(m.text || ''); if (t.includes('🏆')) play('win'); else if (t.includes('🎮')) play('start'); else if (t.includes('💎')) play('relic'); else if (t.includes('⚔')) play('kill'); });
  net.on && net.on('boom', () => play('boom', 0.8));
  return { update, get muted() { return muted; } };
}
