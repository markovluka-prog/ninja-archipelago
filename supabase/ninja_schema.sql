-- Схема игры «Ниндзи» для Supabase-проекта cxhpcmgtvuhxhqhjryth.
-- В проекте уже есть таблицы других приложений (rooms, matches, progress, sessions …), поэтому все таблицы игры — с префиксом ninja_ и ничего чужого не трогают.
-- Выполнить один раз: Supabase → SQL Editor → вставить и Run.
create table if not exists public.ninja_coins (
  name        text primary key,                 -- имя игрока
  coins       integer not null default 0,       -- монеты за победы
  updated_at  timestamptz not null default now()
);
-- RLS включён и политик нет: из браузера таблица недоступна, пишет только сервер игры секретным ключом (он обходит RLS).
alter table public.ninja_coins enable row level security;

-- Игра без своего сервера (rt.js) пишет монеты из браузера публичным ключом, поэтому нужны политики для роли anon.
-- (Это игра для друзей: монеты может изменить любой, у кого есть ссылка. Для строгой защиты нужен вход через Supabase Auth.)
drop policy if exists ninja_coins_read   on public.ninja_coins;
drop policy if exists ninja_coins_insert on public.ninja_coins;
drop policy if exists ninja_coins_update on public.ninja_coins;
create policy ninja_coins_read   on public.ninja_coins for select to anon using (true);
create policy ninja_coins_insert on public.ninja_coins for insert to anon with check (coins >= 0 and coins < 100000);
create policy ninja_coins_update on public.ninja_coins for update to anon using (true) with check (coins >= 0 and coins < 100000);
