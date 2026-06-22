# Jak to przetestować

Testuj warstwami — od najłatwiejszej (bez niczego) do pełnej (Mac + serwer).

## Warstwa 1 — backend bez Minecrafta i bez Maca ✅ (najszybsze)

Udajemy plugin symulatorem; widać cały przepływ: status, przełączanie źródła, push.

```bash
cd server
cp .env.example .env          # MC_HOST może zostać byle jaki
npm install

# Terminal 1 — backend:
INGEST_TOKEN=dev npm run dev

# Terminal 2 — symulator graczy (udaje plugin):
BASE_URL=http://localhost:8080 INGEST_TOKEN=dev npm run simulate

# Terminal 3 — podgląd:
curl -s localhost:8080/api/status     # zobaczysz source:"plugin", listę online i roster 7 dni
```

Gracze losowo wchodzą/wychodzą co kilka sekund. To dowodzi, że poprawnie działają:
sesje, statusy live, roster z 7 dni i (jeśli skonfigurujesz APNs) powiadomienia.

Podgląd zdarzeń na żywo przez WebSocket:
```bash
npx wscat -c ws://localhost:8080/ws    # albo dowolny klient WS
```

## Warstwa 2 — backend przeciw waszemu serwerowi (ścieżka ping) ✅ bez Maca

Sprawdza fallback po Server List Ping na prawdziwym adresie z joinmc.gg.

```bash
cd server
# w .env ustaw MC_HOST=twoj-serwer.joinmc.gg  (INGEST_TOKEN zostaw pusty)
npm run dev
curl -s localhost:8080/api/status     # source:"slp"; wejdź na serwer w grze i odśwież
```

> Uwaga: ping pokazuje próbkę nicków (do ~12) i przybliżony czas. To oczekiwane —
> od dokładności jest plugin (warstwa 3).

## Warstwa 3 — plugin na testowym serwerze Paper

Potrzebny komputer z internetem (pobranie Papera i zależności).

```bash
cd plugin
mvn package                              # -> target/GminaMC.jar
```
1. Pobierz [Paper](https://papermc.io/downloads/paper), uruchom raz lokalnie
   (`java -jar paper.jar`), zaakceptuj EULA.
2. Wrzuć `target/GminaMC.jar` do `plugins/`, odpal serwer ponownie.
3. W `plugins/GminaMC/config.yml` ustaw `backend-url` (np. `http://TWOJE-IP:8080`)
   i `ingest-token` taki sam jak `INGEST_TOKEN` backendu.
4. Wejdź na `localhost` w Minecrafcie — w `/api/status` zobaczysz `source:"plugin"`
   i swój prawdziwy nick z UUID. Wyłącz serwer → po ~minucie wraca `source:"slp"`.

## Warstwa 4 — aplikacja iOS + Apple Watch 🖥️ wymaga Maca z Xcode

Natywnej apki nie da się zbudować bez macOS — to twardy wymóg Apple.

```bash
cd ios
xcodegen generate                        # brew install xcodegen, jeśli brak
open GminaMC.xcodeproj
```
- **Symulator iPhone/Watch** — testuje UI, listę, widgety i komplikacje
  (status czyta z backendu; ustaw adres w ⚙️ aplikacji).
- **Fizyczny iPhone** — dodatkowo testuje **powiadomienia push** (APNs nie działa
  w symulatorze) oraz instalację apki na sparowanym Apple Watch.
- Widget: przytrzymaj ekran → „+" → Gmina MC. Komplikacja: *Edytuj tarczę* na zegarku.

Bez własnego Maca: można skorzystać z chmurowego Maca (np. MacStadium, MacinCloud)
albo pożyczyć — sam build i symulator wystarczą do obejrzenia apki; push wymaga
iPhone'a podpiętego do konta Apple Developer.

## Szybka checklista

| Chcę sprawdzić | Warstwa | Potrzebne |
|----------------|---------|-----------|
| Logikę online/offline, roster, źródła | 1 | tylko Node |
| Realny ping waszego serwera | 2 | adres joinmc.gg |
| Dokładny plugin | 3 | Paper + internet |
| UI / widgety / komplikacje | 4 | Mac + Xcode |
| Powiadomienia push | 4 | Mac + iPhone + konto Apple Dev |
