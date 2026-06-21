# Gmina MC

Powiadomienia i status na żywo — kto z ekipy aktualnie gra na waszym serwerze
Minecraft, plus lista graczy z ostatnich 7 dni. Aplikacja na **iOS i Apple Watch**
zasilana lekkim backendem w chmurze.

## Dlaczego tak

Serwer to **vanilla Java** wystawiony do internetu przez **joinmc.gg**, więc nie da
się (i nie trzeba) instalować pluginów u kolegi. Zamiast tego backend odpytuje serwer
**protokołem Server List Ping** — tym samym, którego używa lista serwerów w grze —
i na tej podstawie wie, kto jest online. Zero ingerencji w serwer, wystarczy adres.

```
   ┌────────────────┐   Server List Ping    ┌───────────────────┐
   │  Serwer MC      │◄──────(co ~20 s)──────│  Backend (chmura) │
   │  (joinmc.gg)    │                       │  poller + API     │
   └────────────────┘                       │  SQLite (sesje)   │
                                             └─────────┬─────────┘
                                          REST/WS │     │ APNs push
                                                  ▼     ▼
                                       ┌──────────────────────────┐
                                       │  iOS + Apple Watch (app)  │
                                       │  live status + 7 dni      │
                                       └──────────────────────────┘
```

## Co jest w repo

| Folder | Opis | Status |
|--------|------|--------|
| [`server/`](server/) | Backend: poller SLP, API REST/WebSocket, push APNs, SQLite | ✅ działa, przetestowany lokalnie |
| [`ios/`](ios/) | Aplikacja SwiftUI na iPhone + Apple Watch (XcodeGen) | ✅ kompletny szkielet, do zbudowania w Xcode |

Szczegóły uruchomienia w `server/README.md` i `ios/README.md`.

## Szybki start

1. **Backend:** `cd server && cp .env.example .env` → wpisz `MC_HOST` → `npm install && npm run dev`.
   Sprawdź `http://localhost:8080/api/status`.
2. **Wdrożenie:** `fly deploy` (gotowy `Dockerfile` + `fly.toml`).
3. **Apka:** `cd ios && xcodegen generate && open GminaMC.xcodeproj`, wpisz adres
   backendu w ustawieniach, zbuduj na iPhone (+ Watch).
4. **Push:** dodaj klucz APNs jako sekrety backendu (instrukcja w obu README).

## Funkcje

- 🟢 Lista „kto teraz gra" odświeżana na żywo
- 🕓 Gracze z ostatnich 7 dni (konfigurowalne) z łącznym czasem gry
- 🔔 Powiadomienie push, gdy ktoś dołączy do serwera
- ⌚️ Pełna aplikacja na Apple Watch
- 🔒 Opcjonalny token API
- 🧩 API gotowe również na przyszły plugin Paper/Spigot (gdyby serwer się zmienił)

## Następne kroki (pomysły)

- Komplikacja na tarczę zegarka i widget na ekran iPhone'a (WidgetKit) z licznikiem online
- Wykresy aktywności / „o której zwykle gracie"
- Wariant powiadomień przez Telegram/ntfy bez konta Apple Developer
