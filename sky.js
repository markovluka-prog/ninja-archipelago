// sky.js — солнце, луна и облака. Солнце и луна — спрайты на огромном расстоянии вокруг камеры (двигаются по тем же углам, что свет в applyTod);
// облака — спрайты в мировых координатах, плывут по ветру и зацикливаются вокруг камеры (есть параллакс при ходьбе). Туман на небо не действует.
export function createSky(THREE, scene) {
  const group = new THREE.Group(); scene.add(group);
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const sprite = (map, size, { ratio = 1, ...o } = {}) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false, ...o })); s.scale.set(size, size * ratio, 1); s.renderOrder = -5; group.add(s); return s; };
  const rg = (g, x, y, r, stops) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); for (const [p, c] of stops) gr.addColorStop(p, c); g.fillStyle = gr; };

  const glowTex = tex(256, 256, (g, w, h) => { rg(g, 128, 128, 128, [[0, 'rgba(255,240,200,.95)'], [0.18, 'rgba(255,220,150,.55)'], [0.5, 'rgba(255,190,110,.14)'], [1, 'rgba(255,170,90,0)']]); g.fillRect(0, 0, w, h); });
  const discTex = tex(256, 256, (g, w, h) => { rg(g, 128, 128, 128, [[0, '#fffbe8'], [0.34, '#fff6d0'], [0.37, 'rgba(255,240,190,.0)'], [1, 'rgba(255,240,190,0)']]); g.fillRect(0, 0, w, h); });
  const moonTex = tex(256, 256, (g, w, h) => {
    rg(g, 128, 128, 128, [[0, 'rgba(190,210,255,.35)'], [0.4, 'rgba(170,195,255,.12)'], [1, 'rgba(170,195,255,0)']]); g.fillRect(0, 0, w, h);
    g.save(); g.beginPath(); g.arc(128, 128, 54, 0, 7); g.clip(); g.fillStyle = '#e8ecf4'; g.fillRect(0, 0, w, h);
    for (const [x, y, r, a] of [[108, 108, 14, .18], [148, 122, 11, .16], [124, 152, 16, .15], [150, 96, 7, .14], [100, 138, 8, .13], [138, 150, 6, .12]]) { g.fillStyle = `rgba(110,120,140,${a})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    rg(g, 150, 110, 70, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(60,70,100,.35)']]); g.fillRect(0, 0, w, h); g.restore();
  });
  const cloudTex = tex(256, 128, (g, w, h) => {
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 16; i++) { const x = 40 + rnd() * 176, y = 52 + rnd() * 30 - Math.abs(x - 128) * 0.12, r = 22 + rnd() * 26; rg(g, x, y, r, [[0, 'rgba(255,255,255,.55)'], [0.6, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, w, h); }
  });

  const sunGlow = sprite(glowTex, 4200, { blending: THREE.AdditiveBlending, toneMapped: false });
  const sunDisc = sprite(discTex, 1500, { toneMapped: false });
  const moonSp = sprite(moonTex, 1900, { toneMapped: false });

  const clouds = []; let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const cx = (rnd() - 0.5) * 18000, cz = (rnd() - 0.5) * 18000, cy = 650 + rnd() * 650, n = 4 + Math.floor(rnd() * 4), parts = [];
    for (let k = 0; k < n; k++) { const sp = sprite(cloudTex, 1100 + rnd() * 900, { ratio: 0.5 }); sp.renderOrder = -4; parts.push({ sp, dx: (rnd() - 0.5) * 1500, dz: (rnd() - 0.5) * 900, dy: (rnd() - 0.5) * 80 }); }
    clouds.push({ cx, cz, cy, parts, v: 8 + rnd() * 10 });
  }
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const dayC = new THREE.Color(0xffffff), nightC = new THREE.Color(0x3a4666), warmC = new THREE.Color(0xffb27a), col = new THREE.Color(), d = new THREE.Vector3();
  let t0 = performance.now();
  return {
    // ang/el — угол и высота солнца (как в applyTod), f — день (0..1), warm — закатный оттенок
    update(camera, ang, el, f, warm) {
      const now = performance.now(), dt = Math.min(0.1, (now - t0) / 1000); t0 = now;
      const cp = camera.position; d.set(Math.cos(ang) * 0.9, el, 0.45).normalize();
      const R = 9000, sv = sm(-0.1, 0.05, el), mv = sm(-0.1, 0.05, -el);
      sunGlow.position.copy(cp).addScaledVector(d, R); sunDisc.position.copy(sunGlow.position);
      sunGlow.material.opacity = sv * (0.85 + 0.15 * warm); sunDisc.material.opacity = sv;
      sunGlow.material.color.setHex(0xffffff).lerp(warmC, warm); sunDisc.material.color.setHex(0xffffff).lerp(warmC, warm * 0.8);
      moonSp.position.copy(cp).addScaledVector(d, -R * 0.96); moonSp.material.opacity = mv;
      col.copy(nightC).lerp(dayC, f).lerp(warmC, warm * 0.55);
      for (const c of clouds) {
        const W = 18000; let x = c.cx + c.v * now / 1000, z = c.cz;
        x = cp.x + ((((x - cp.x) % W) + W * 1.5) % W - W / 2); z = cp.z + ((((z - cp.z) % W) + W * 1.5) % W - W / 2);       // зацикливание вокруг камеры
        for (const p of c.parts) { p.sp.position.set(x + p.dx, c.cy + p.dy, z + p.dz); p.sp.material.color.copy(col); p.sp.material.opacity = 0.55 + 0.3 * f; }
      }
    },
  };
}
