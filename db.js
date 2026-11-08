// db.js — Supabase для сервера игры (без зависимостей, только fetch). Работает ТОЛЬКО с проектом cxhpcmgtvuhxhqhjryth и только с таблицами ninja_* (в проекте есть чужие таблицы).
// Ключ SUPABASE_API берётся из .env и остаётся на сервере: в браузер он не уходит и в лог не пишется. Нет ключа или таблицы — игра просто работает с coins.json, как раньше.
'use strict';
const fs = require('fs'), path = require('path');
const REF = 'cxhpcmgtvuhxhqhjryth', URL_ = `https://${REF}.supabase.co/rest/v1`, TABLE = 'ninja_coins';
try { for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch { /* .env нет */ }
const KEY = process.env.SUPABASE_API || '';
let on = false, last = {};
const call = (p, opt = {}) => fetch(URL_ + p, { ...opt, signal: AbortSignal.timeout(8000), headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', ...(opt.headers || {}) } });

/** Подключиться и вернуть монеты из облака ({имя: число}) либо null, если Supabase недоступен/не настроен. */
async function init() {
  if (!KEY) { console.log('[supabase] ключа нет (.env) — монеты только в coins.json'); return null; }
  try {
    const r = await call(`/${TABLE}?select=name,coins&limit=10000`);
    if (r.status === 404 || r.status === 400) { console.log(`[supabase] таблицы ${TABLE} ещё нет: выполните supabase/ninja_schema.sql в SQL Editor — пока монеты только в coins.json`); return null; }
    if (!r.ok) { console.log('[supabase] ошибка доступа: HTTP ' + r.status); return null; }
    const rows = await r.json(), out = {}; for (const x of rows) out[x.name] = x.coins | 0;
    on = true; last = { ...out }; console.log(`[supabase] подключено (${REF}), игроков с монетами: ${rows.length}`); return out;
  } catch (e) { console.log('[supabase] нет связи: ' + e.message); return null; }
}
/** Записать в облако только изменившиеся значения. Ошибки не мешают игре. */
async function sync(coins) {
  if (!on) return;
  const rows = []; for (const [name, n] of Object.entries(coins)) if (last[name] !== n) rows.push({ name, coins: n | 0, updated_at: new Date().toISOString() });
  if (!rows.length) return;
  try {
    const r = await call(`/${TABLE}?on_conflict=name`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
    if (r.ok) for (const x of rows) last[x.name] = x.coins; else console.log('[supabase] запись не удалась: HTTP ' + r.status);
  } catch (e) { console.log('[supabase] запись: ' + e.message); }
}
module.exports = { init, sync, get on() { return on; } };
