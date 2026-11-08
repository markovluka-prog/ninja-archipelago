# Игра без своего сервера: Supabase Realtime + GitHub Pages

1. **Таблица монет (один раз).** Supabase → проект `cxhpcmgtvuhxhqhjryth` → SQL Editor → вставить `supabase/ninja_schema.sql` → Run.
   Он создаёт только `ninja_coins`; чужие таблицы проекта (rooms, matches, progress, sessions…) не затрагиваются.
2. **Публичный ключ.** Project Settings → API Keys → *Publishable key* (`sb_publishable_…`) → вписать в `config.js` (`SUPABASE_KEY`).
   Секретный ключ (`sb_secret_…`, в `.env`) в браузер/`config.js` класть нельзя — он только для `server.js`/`db.js`.
3. **Сайт.** GitHub → репозиторий → Settings → Pages → Branch `main` / root. Игра откроется по `https://<логин>.github.io/ninja-archipelago/index.html` — и там сеть автоматически идёт через Supabase.
   Проверить на своём компьютере можно ссылкой `…/index.html?rt=1`.

Как это устроено: комната — канал Realtime `ninja-r-<код>`; «сервером» комнаты (режимы, голосование, очки) работает браузер первого игрока (`core.js`, сгенерирован из `server.js`). Вышел он — судьёй становится следующий, а комната начинает с чистого состояния.
