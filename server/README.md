# Gmina MC — backend (poller + API + push)

Usługa, która:

1. **Odpytuje** wasz serwer Minecraft protokołem *Server List Ping* (to samo, czym
   posługuje się lista serwerów w grze) — **nie trzeba niczego instalować na serwerze
   kolegi**, wystarczy adres z joinmc.gg.
2. **Wykrywa** kto dołączył / wyszedł, zapisuje sesje w SQLite i liczy statystyki
   z ostatnich N dni.
3. **Wysyła push** (APNs) do apki na iPhone/Apple Watch, gdy ktoś wejdzie na serwer.
4. **Udostępnia API** dla aplikacji mobilnej.

## Jak to działa (i ograniczenia)

Vanilla Java w odpowiedzi na ping zwraca liczbę graczy online oraz *próbkę* nicków
(domyślnie do ~12). Dla paczki znajomych to wystarcza i daje prawdziwe nicki + UUID.
Czas wejścia jest przybliżony z dokładnością do interwału odpytywania (domyślnie 20 s).

> Gdyby serwer kiedyś przeszedł na Paper/Spigot, można dopisać plugin wysyłający
> dokładne zdarzenia webhookiem do tego samego API — API jest na to gotowe.

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
| `API_TOKEN` | Opcjonalny sekret; klient wysyła `Authorization: Bearer <token>` |
| `APNS_*` | Dane do powiadomień push (patrz niżej) |

## API

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/health` | Status usługi |
| GET | `/api/status` | Online + roster z ostatnich N dni |
| POST | `/api/devices` | Rejestracja tokenu APNs: `{"token":"..."}` |
| DELETE | `/api/devices/:token` | Wyrejestrowanie |
| WS | `/ws` | Strumień zdarzeń na żywo (join/leave/tick) |

Przykład odpowiedzi `/api/status`:

```json
{
  "serverReachable": true,
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
# push (jednolinijkowo, klucz .p8 jako sekret):
fly secrets set APNS_KEY="$(cat AuthKey_XXXX.p8)" APNS_KEY_ID=... APNS_TEAM_ID=... APNS_BUNDLE_ID=xyz.mikebravo.gminamc APNS_PRODUCTION=false
fly deploy
```

Po wdrożeniu wpisz adres `https://<twoja-apka>.fly.dev` w ustawieniach aplikacji iOS.

> Alternatywy: Railway / Render działają tak samo (Dockerfile w repo). Pamiętaj o
> trwałym wolumenie na plik SQLite oraz o tym, by maszyna nie usypiała (poller musi
> chodzić 24/7) — w `fly.toml` ustawione jest `min_machines_running = 1`.
