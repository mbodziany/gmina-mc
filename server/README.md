# Gmina MC — backend (tracker + API + push)

Usługa, która zbiera obecność graczy z **dwóch źródeł** i wystawia ją aplikacji:

1. **Plugin (podstawowe):** serwer z pluginem `GminaMC` wysyła pełną listę online
   (`/api/ingest/heartbeat`) oraz natychmiastowe zdarzenia join/quit (`/api/ingest/event`).
2. **Ping / Server List Ping (fallback):** gdy plugin milczy, backend sam odpytuje serwer
   tak jak lista serwerów w grze — **bez niczego instalowanego u kolegi**, wystarczy adres.

Wspólny moduł `tracker` reconciliuje stan niezależnie od źródła: otwiera/zamyka sesje
w SQLite, liczy statystyki z ostatnich N dni i wysyła **push (APNs)**, gdy ktoś wejdzie.

## Przełączanie źródeł

- Każdy heartbeat pluginu oznacza go jako „aktywny" na `PLUGIN_TIMEOUT_SECONDS`.
- Dopóki plugin jest aktywny, poller SLP **odpuszcza** (plugin jest dokładniejszy).
- Gdy heartbeaty ucichną, backend automatycznie wraca do pingu.
- `GET /api/status` zwraca pole `source`: `"plugin"`, `"slp"` albo `"none"`.

## Ograniczenia pingu (fallback)

Vanilla w odpowiedzi na ping zwraca liczbę online + *próbkę* nicków (do ~12) i przybliżony
czas wejścia (z dokładnością do interwału). Plugin tych ograniczeń nie ma. Wymaga jednak
serwera na Paper/Spigot — patrz `../plugin/README.md`.

## Konfiguracja

```bash
cp .env.example .env
# uzupełnij MC_HOST adresem z joinmc.gg
npm install
npm run dev      # tryb deweloperski z auto-reloadem
# lub:
npm run build && npm start
```

Najważniejsze zmienne (pełna lista w `.env.example`):

| Zmienna | Opis |
|---------|------|
| `MC_HOST` | Adres serwera, np. `twoj-serwer.joinmc.gg` |
| `MC_PORT` | Port — zostaw pusty, jeśli używany jest rekord SRV |
| `POLL_INTERVAL_SECONDS` | Co ile sekund odpytywać (domyślnie 20) |
| `ROSTER_DAYS` | Okno „ostatnich graczy" w dniach (domyślnie 7) |
| `API_TOKEN` | Opcjonalny sekret klienta; apka wysyła `Authorization: Bearer <token>` |
| `INGEST_TOKEN` | Sekret pluginu; plugin wysyła `Authorization: Bearer <token>` |
| `PLUGIN_TIMEOUT_SECONDS` | Po jakim czasie ciszy pluginu wrócić do pingu (domyślnie 60) |
| `PUSH_REJOIN_COOLDOWN_SECONDS` | Anti-flap: powrót w tym oknie nie wysyła ponownego push (300) |
| `SLP_STALE_SECONDS` | Przy uciętej próbce pingu: po ilu sekundach nieobecności w próbce uznać wyjście (180) |
| `INGEST_RATE_LIMIT_PER_MINUTE` | Limit żądań/min na IP dla `/api/ingest/*` (240) |
| `APNS_*` | Dane do powiadomień push (patrz niżej) |

## API

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/health` | Status usługi + aktywne źródło |
| GET | `/api/status` | `source` + online + roster z ostatnich N dni |
| POST | `/api/devices` | Rejestracja tokenu APNs: `{"token":"..."}` |
| DELETE | `/api/devices/:token` | Wyrejestrowanie |
| POST | `/api/ingest/heartbeat` | (plugin) pełna lista online: `{"players":[{"uuid","name"}]}` |
| POST | `/api/ingest/event` | (plugin) pojedyncze zdarzenie: `{"type":"join\|quit","uuid","name"}` |
| WS | `/ws` | Strumień zdarzeń na żywo (join/leave/tick); z niego korzysta apka |

Endpointy `/api/ingest/*` autoryzowane są nagłówkiem `Authorization: Bearer <INGEST_TOKEN>`
i objęte limitem żądań. Przy ustawionym `API_TOKEN` WebSocket wymaga tokenu —
nagłówkiem albo w URL: `wss://…/ws?token=<API_TOKEN>`.

Przykład odpowiedzi `/api/status`:

```json
{
  "serverReachable": true,
  "source": "plugin",
  "onlineCount": 1,
  "rosterDays": 7,
  "online": [{ "id": "…", "name": "Steve", "online": true, "currentSessionStart": 1750000000000, … }],
  "roster": [ … ],
  "updatedAt": 1750000000000
}
```

## Powiadomienia push (APNs)

Ustaw cztery sekrety (z konta Apple Developer → Keys, klucz .p8):

```
APNS_KEY        # zawartość pliku AuthKey_XXXX.p8
APNS_KEY_ID     # np. ABC123DEFG
APNS_TEAM_ID    # np. 1A2B3C4D5E
APNS_BUNDLE_ID  # xyz.mikebravo.gminamc
APNS_PRODUCTION # false dla buildów dev, true dla TestFlight/App Store
```

Bez nich API działa normalnie, tylko bez push.

## Wdrożenie na Fly.io (darmowy plan)

```bash
fly launch --no-deploy           # użyje dołączonego fly.toml; nazwij apkę
fly volumes create gmina_data --size 1 --region waw
fly secrets set MC_HOST=twoj-serwer.joinmc.gg
fly secrets set INGEST_TOKEN="$(openssl rand -hex 16)"   # ten sam wpisz w config pluginu
# push (jednolinijkowo, klucz .p8 jako sekret):
fly secrets set APNS_KEY="$(cat AuthKey_XXXX.p8)" APNS_KEY_ID=... APNS_TEAM_ID=... APNS_BUNDLE_ID=xyz.mikebravo.gminamc APNS_PRODUCTION=false
fly deploy
```

Po wdrożeniu wpisz adres `https://<twoja-apka>.fly.dev` w ustawieniach aplikacji iOS.

> Alternatywy: Railway / Render działają tak samo (Dockerfile w repo). Pamiętaj o
> trwałym wolumenie na plik SQLite oraz o tym, by maszyna nie usypiała (poller musi
> chodzić 24/7) — w `fly.toml` ustawione jest `min_machines_running = 1`.
