# Ниндзи для iPad (TestFlight)

Нативная обёртка (SwiftUI + WKWebView) вокруг веб-игры. Файлы игры и three.js лежат внутри приложения.
Мультиплеер идёт через Supabase Realtime (`?rt=1`), управление — touch.js.

## Один раз
1. В Xcode → Settings → Components установить платформу iOS 26.5 (сейчас не установлена).
2. В `project.yml` заменить `DEVELOPMENT_TEAM` (Team ID) и `com.example` / `com.example.ninjai` (Bundle ID).
3. https://appstoreconnect.apple.com → Apps → «+» → New App (iOS, этот же Bundle ID).
4. Для TestFlight нужен платный Apple Developer Program ($99/год).

## Каждый раз
```
brew install xcodegen   # если нет
cd ios && xcodegen generate && open Ninjai.xcodeproj
```
Xcode: устройство «Any iOS Device» → Product → Archive → Distribute App → App Store Connect → Upload.
Через несколько минут сборка появится во вкладке TestFlight (добавь себя во внутренние тестеры).
Повторная загрузка: увеличь `CURRENT_PROJECT_VERSION`.
