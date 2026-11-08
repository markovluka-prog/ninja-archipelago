// house-collision.js — коллизия зданий (стены с проёмами под двери и окна, этажи, лестницы, круглые башни): чистая функция от данных дома (box.houses из build-map),
// общая для игры (richard-mode.js) и для проверочных скриптов.
export function makeHousePlanner(THREE) {
  const V = THREE.Vector3;
  const box = (x0, x1, y0, y1, z0, z1) => ({ min: new V(x0, y0, z0), max: new V(x1, y1, z1) });
  // стена-коробка с проёмами под окна/вторые двери: ниже подоконника и выше перемычки стена остаётся; проём считаем проходимым при ширине ≥ 2.8 и высоте ≥ 3.4
  function addWall(out, x0, x1, y0, y1, z0, z1, holes){
    const along = (x1 - x0) >= (z1 - z0) ? 'x' : 'z', a0 = along === 'x' ? x0 : z0, a1 = along === 'x' ? x1 : z1;
    const hs = (holes || []).filter(w => { const wa0 = along === 'x' ? w.x0 : w.z0, wa1 = along === 'x' ? w.x1 : w.z1;
      return w.y1 > y0 + 0.5 && w.y0 < y1 - 0.5 && w.x0 < x1 && w.x1 > x0 && w.z0 < z1 && w.z1 > z0 && wa1 - wa0 >= 2.8 && w.y1 - w.y0 >= 3.4 && wa0 > a0 - 0.5 && wa1 < a1 + 0.5; })
      .sort((p, q) => (along === 'x' ? p.x0 - q.x0 : p.z0 - q.z0));
    const mk = (s0, s1, ya, yb) => { if (s1 - s0 < 0.05 || yb - ya < 0.05) return; out.push(along === 'x' ? box(s0, s1, ya, yb, z0, z1) : box(x0, x1, ya, yb, s0, s1)); };
    let cur = a0;
    for (const w of hs){ const wa0 = Math.max(a0, along === 'x' ? w.x0 : w.z0), wa1 = Math.min(a1, along === 'x' ? w.x1 : w.z1); if (wa0 < cur) continue; mk(cur, wa0, y0, y1); mk(wa0, wa1, y0, Math.max(y0, w.y0)); mk(wa0, wa1, Math.min(y1, w.y1), y1); cur = wa1; }
    mk(cur, a1, y0, y1);
  }
  function planRound(b, h){          // круглая башня/маяк/мельница: стены — кольцо коробок (радиус сужается кверху), проём двери — разрыв в нижнем кольце
    const rd = h.round, { gy, dw, dh, dx, dz, n: [nx, nz] } = h, out = [box(h.bx0, h.bx1, b.y0, gy, h.bz0, h.bz1)], top = rd.y + rd.H, half = 0.85;
    const bounds = [gy, Math.min(gy + dh, top)]; for (let y = bounds[1] + 7; y < top - 3; y += 7) bounds.push(y); bounds.push(top);
    for (let i = 0; i < bounds.length - 1; i++){
      const y0 = bounds[i], y1 = bounds[i + 1]; if (y1 - y0 < 0.3) continue;
      const f = Math.min(1, Math.max(0, ((y0 + y1) / 2 - rd.y) / rd.H)), R = rd.R0 + (rd.R1 - rd.R0) * f - rd.t / 2, N = Math.max(16, Math.ceil(6.283 * R / 1.5));
      for (let k = 0; k < N; k++){
        const a = k / N * 6.283, ux = Math.sin(a), uz = Math.cos(a), x = rd.cx + ux * R, z = rd.cz + uz * R;
        if (i === 0 && ux * nx + uz * nz > 0 && Math.abs(ux * -nz + uz * nx) * R < dw / 2 + 0.4) continue;      // проём двери
        out.push(box(x - half, x + half, y0, y1, z - half, z + half));
      }
    }
    if (rd.platform){      // кольцевая площадка маяка: твёрдое кольцо по радиусам (проём в центре — для лестничного колодца)
      const pl = rd.platform;
      for (let r = pl.rI + 0.8; r <= pl.rO - 0.3; r += 1.4){ const N = Math.max(8, Math.ceil(6.283 * r / 1.4)); for (let k = 0; k < N; k++){ const a = k / N * 6.283, x = rd.cx + Math.sin(a) * r, z = rd.cz + Math.cos(a) * r; out.push(box(x - 0.75, x + 0.75, pl.y - 0.4, pl.y + 0.8, z - 0.75, z + 0.75)); } }
    }
    if (rd.lantern){ const lq = rd.lantern; addSilos(out, { silos: [{ cx: rd.cx, cz: rd.cz, R: lq.R, y0: rd.platform ? rd.platform.y + 0.8 : lq.y0, y1: lq.y1 }] }); }      // фонарь маяка (стекло) — твёрдый цилиндр
    for (const s_ of h.steps || []) out.push(box(s_.x0, s_.x1, s_.y0, s_.y1, s_.z0, s_.z1));
    for (const f of h.floors || []) out.push(box(f.x0, f.x1, f.y0, f.y1, f.z0, f.z1));
    const tx = nz ? dw / 2 : 1.4, tz = nz ? 1.4 : dw / 2, door = box(dx - tx, dx + tx, gy, gy + dh, dz - tz, dz + tz);
    return { out, door, yt: top };
  }
  function addSilos(out, h){          // силосы и прочие круглые пристройки: твёрдый цилиндр (кольцо коробок по радиусу + заполнение) — в них нельзя зайти
    for (const q of h.silos || []){
      const N = Math.max(10, Math.ceil(6.283 * q.R / 1.8)), half = 1.0, Rr = Math.max(0.5, q.R - half);
      for (let k = 0; k < N; k++){ const a = k / N * 6.283; out.push(box(q.cx + Math.sin(a) * Rr - half, q.cx + Math.sin(a) * Rr + half, q.y0, q.y1, q.cz + Math.cos(a) * Rr - half, q.cz + Math.cos(a) * Rr + half)); }
      const fh = Math.max(0.5, (q.R - 2 * half) * 0.72); out.push(box(q.cx - fh, q.cx + fh, q.y0, q.y1, q.cz - fh, q.cz + fh));
    }
  }
  function planHouse(b, h){
    if (!h.round) { const r_ = planHouse2(b, h); addSilos(r_.out, h); return r_; }
    return planHouse2(b, h);
  }
  function planHouse2(b, h){
    if (h.round) return planRound(b, h);
    const { bx0: x0, bx1: x1, bz0: z0, bz1: z1, gy, top, t, dw, dh, dx, dz, n: [nx, nz] } = h;
    const out = [box(x0, x1, b.y0, gy, z0, z1)], yt = Math.max(top, gy + dh + 0.5);
    const lo = (c) => c - dw / 2, hi = (c) => c + dw / 2;
    let door;
    if (nz){      // дверь в стене z
      const wz0 = nz > 0 ? z1 - t : z0, wz1 = nz > 0 ? z1 : z0 + t, oz0 = nz > 0 ? z0 : z1 - t, oz1 = nz > 0 ? z0 + t : z1;
      addWall(out, x0, x0 + t, gy, yt, z0, z1, h.windows); addWall(out, x1 - t, x1, gy, yt, z0, z1, h.windows); addWall(out, x0 + t, x1 - t, gy, yt, oz0, oz1, h.windows);
      addWall(out, x0 + t, lo(dx), gy, yt, wz0, wz1, h.windows); addWall(out, hi(dx), x1 - t, gy, yt, wz0, wz1, h.windows); out.push(box(lo(dx), hi(dx), gy + dh, yt, wz0, wz1));
      door = box(lo(dx), hi(dx), gy, gy + dh, wz0, wz1);
    } else {      // дверь в стене x
      const wx0 = nx > 0 ? x1 - t : x0, wx1 = nx > 0 ? x1 : x0 + t, ox0 = nx > 0 ? x0 : x1 - t, ox1 = nx > 0 ? x0 + t : x1;
      addWall(out, x0, x1, gy, yt, z0, z0 + t, h.windows); addWall(out, x0, x1, gy, yt, z1 - t, z1, h.windows); addWall(out, ox0, ox1, gy, yt, z0, z1, h.windows);
      addWall(out, wx0, wx1, gy, yt, z0 + t, lo(dz), h.windows); addWall(out, wx0, wx1, gy, yt, hi(dz), z1 - t, h.windows); out.push(box(wx0, wx1, gy + dh, yt, lo(dz), hi(dz)));
      door = box(wx0, wx1, gy, gy + dh, lo(dz), hi(dz));
    }
    for (const s_ of h.steps || []) out.push(box(s_.x0, s_.x1, s_.y0, s_.y1, s_.z0, s_.z1));      // ступени лестницы (стопка боксов — Ричард поднимается шагами ≤ 1.55)
    let ytop = yt;
    for (const f of h.floors || []) out.push(box(f.x0, f.x1, f.y0, f.y1, f.z0, f.z1));        // плиты второго этажа (с проёмом под лестницу)
    if (h.upper && h.floors && h.floors.length){                                                // двухэтажный дом: стены верхнего этажа и крыша над ним
      const u = h.upper, ft = Math.max(...h.floors.map(f => f.y1));
      addWall(out, u.x0, u.x0 + t, ft, u.top, u.z0, u.z1, h.windows); addWall(out, u.x1 - t, u.x1, ft, u.top, u.z0, u.z1, h.windows); addWall(out, u.x0 + t, u.x1 - t, ft, u.top, u.z0, u.z0 + t, h.windows); addWall(out, u.x0 + t, u.x1 - t, ft, u.top, u.z1 - t, u.z1, h.windows);
      if (b.y1 > u.top + 0.3) out.push(box(u.x0, u.x1, u.top, Math.min(b.y1, u.top + 10), u.z0, u.z1));
      ytop = u.top;
    } else if (h.tiers && h.tiers.length){                                                      // пагода: стены каждого яруса, потолок и крыша над верхним
      for (const T of h.tiers){ const tt = t; addWall(out, T.x0, T.x0 + tt, T.y0, T.y1, T.z0, T.z1, h.windows); addWall(out, T.x1 - tt, T.x1, T.y0, T.y1, T.z0, T.z1, h.windows); addWall(out, T.x0 + tt, T.x1 - tt, T.y0, T.y1, T.z0, T.z0 + tt, h.windows); addWall(out, T.x0 + tt, T.x1 - tt, T.y0, T.y1, T.z1 - tt, T.z1, h.windows); }
      const tp = h.tiers[h.tiers.length - 1]; out.push(box(tp.x0, tp.x1, tp.y1 - 0.6, tp.y1, tp.z0, tp.z1)); if (b.y1 > tp.y1 + 0.3) out.push(box(tp.x0, tp.x1, tp.y1, Math.min(b.y1, tp.y1 + 8), tp.z0, tp.z1)); ytop = tp.y1;
    } else {
      out.push(box(x0, x1, yt - 0.6, yt, z0, z1));                                               // потолок: на крышу можно залезть, внутрь провалиться нельзя
      if (b.y1 > yt + 0.3) out.push(box(x0, x1, yt, Math.min(b.y1, yt + 10), z0, z1));          // крыша над корпусом
    }
    return { out, door, yt: ytop };
  }
  return { planHouse, planRound, addWall, box };
}
