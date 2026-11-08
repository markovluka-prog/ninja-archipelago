// config.js — публичные настройки сети. Для игры без своего сервера (GitHub Pages) через Supabase Realtime.
// ВАЖНО: здесь только ПУБЛИЧНЫЙ ключ (Supabase → Project Settings → API Keys → «Publishable key», sb_publishable_…). Секретный ключ sb_secret_… (он в .env) сюда класть нельзя — файл виден всем.
export const SUPABASE_URL = 'https://cxhpcmgtvuhxhqhjryth.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_yX0EWf3P33twsEOIH3gtfQ_eLynPpj-';
export const FORCE_RT = false;      // true — всегда использовать Supabase Realtime (даже при открытии с вашего компьютера); ?rt=1 / ?rt=0 в ссылке переопределяют
