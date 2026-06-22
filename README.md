# Gmina MC

Powiadomienia i status na żywo — kto z ekipy aktualnie gra na waszym serwerze
Minecraft, plus lista graczy z ostatnich 7 dni. Aplikacja na **iOS i Apple Watch**
zasilana lekkim backendem w chmurze.

## Dlaczego tak — dwa źródła danych

System sprawdza obecność graczy na **dwa sposoby**, z automatycznym przełączaniem:

1. **Plugin do gry (podstawowe, dokładne)** — plugin na Paper wysyła do backendu pełną
   listę online + natychmiastowe zdarzenia join/quit. Prawdziwe nicki, UUID, całą listę
   (nie ograniczoną próbkę), push w ~1 s. Komunikacja wychodząca, więc działa przez
   joinmc.gg bez otwierania portów.
2. **Ping / Server List Ping (fallback)** — gdy plugin nie raportuje (nie zainstalowany
   lub serwer na vanilli), backend sam odpytuje serwer tak jak lista serwerów w grze.
   Działa na czymkolwiek, wystarczy adres.

Backend uznaje plugin za aktywny, dopóki dostaje heartbeaty; gdy ucichną — bezszwowo
wraca do pingu. Aplikacja pokazuje, które źródło jest aktualnie aktywne.

```
   ┌────────────────┐                         ┌───────────────────┐
   │  Serwer MC      │  ① plugin (POST events) │  Backend (chmura) │
   │  Paper          │────────────────────────►│  tracker (wspólny │
   │  + GminaMC.jar  │                         │  reconcile)       │
   │                 │  ② Server List Ping      │  API + SQLite     │
   │  (joinmc.gg)    │◄────(fallback, co ~20 s)─│                   │
   └────────────────┘                         └─────────┬─────────┘
                                            REST/WS │     │ APNs push
                                                    ▼     ▼
                                         ┌──────────────────────────┐
                                         │  iOS + Apple Watch (app)  │
                                         │  live status + 7 dni      │
                                         │  + wskaźnik źródła         │
                                         └──────────────────────────┘
```

## Co jest w repo

| Folder | Opis | Status |
|--------|------|--------|
| [`server/`](server/) | Backend: tracker (plugin + ping), API REST/WebSocket, push APNs, SQLite | ✅ działa, przetestowany lokalnie |
| [`plugin/`](plugin/) | Plugin Paper raportujący graczy do backendu | ✅ sprawdzony kompilacyjnie |
| [`ios/`](ios/) | Aplikacja SwiftUI na iPhone + Apple Watch (XcodeGen) | ✅ kompletny szkielet, do zbudowania w Xcode |

Szczegóły uruchomienia w `server/README.md`, `plugin/README.md` i `ios/README.md`.

## Szybki start

1. **Backend:** `cd server && cp .env.example .env` → wpisz `MC_HOST` (do fallbacku) oraz
   `INGEST_TOKEN` (sekret dla pluginu) → `npm install && npm run dev`.
   Sprawdź `http://localhost:8080/api/status`.
2. **Plugin (opcjonalnie, wymaga Papera):** `cd plugin && mvn package`, wrzuć
   `target/GminaMC.jar` do `plugins/`, ustaw `backend-url` + `ingest-token` w config.
3. **Wdrożenie:** `fly deploy` (gotowy `Dockerfile` + `fly.toml`).
4. **Apka:** `cd ios && xcodegen generate && open GminaMC.xcodeproj`, wpisz adres
   backendu w ustawieniach, zbuduj na iPhone (+ Watch).
5. **Push:** dodaj klucz APNs jako sekrety backendu (instrukcja w obu README).

## Funkcje

- 🟢 Lista „kto teraz gra" odświeżana na żywo
- 🔌 Dwa źródła: dokładny plugin + fallback po pingu, z automatycznym przełączaniem
- 🕓 Gracze z ostatnich 7 dni (konfigurowalne) z łącznym czasem gry
- 🔔 Powiadomienie push, gdy ktoś dołączy do serwera
- ⌚️ Pełna aplikacja na Apple Watch
- 🧩 Widgety na iPhone (ekran główny + Lock Screen) i komplikacje na tarczę zegarka (WidgetKit)
- 🏷️ Wskaźnik aktywnego źródła danych (wtyczka / ping) w apce
- 🔒 Opcjonalny token API + osobny sekret dla pluginu

## Następne kroki (pomysły)

- Wykresy aktywności / „o której zwykle gracie"
- Wariant powiadomień przez Telegram/ntfy bez konta Apple Developer
