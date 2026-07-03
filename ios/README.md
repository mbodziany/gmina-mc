# Gmina MC — aplikacja iOS + Apple Watch

Natywna apka SwiftUI pokazująca, kto z ekipy aktualnie gra na serwerze Minecraft,
oraz listę graczy z ostatnich 7 dni. Powiadomienia push (APNs) informują, gdy ktoś
dołączy.

## Struktura

| Folder | Co to |
|--------|-------|
| `Shared/` | Modele, klient API, `ServerStore`, provider i widoki widgetów (iOS + Watch) |
| `iOSApp/` | Aplikacja na iPhone (lista, ustawienia, rejestracja push) |
| `WatchApp/` | Aplikacja na Apple Watch |
| `iOSWidget/` | Widget na ekran główny i Lock Screen (WidgetKit) |
| `WatchWidget/` | Komplikacje na tarczę zegarka (WidgetKit, rodziny `accessory*`) |
| `project.yml` | Definicja projektu dla [XcodeGen](https://github.com/yonaskolb/XcodeGen) |

## Widgety i komplikacje

- **iPhone:** `systemSmall` / `systemMedium` (ekran główny) oraz `accessoryCircular`,
  `accessoryInline`, `accessoryRectangular` (Lock Screen) — licznik online + nicki.
- **Apple Watch:** komplikacje `accessoryCircular`, `accessoryInline`,
  `accessoryRectangular`, `accessoryCorner` — dodaj je do tarczy przez *Edytuj tarczę*.

Widgety pobierają status z backendu (odświeżanie ~co 15 min, budżet systemowy) i
korzystają ze wspólnego cache w App Group, więc renderują się natychmiast. Gdy
aplikacja jest otwarta, odświeża je po każdej realnej zmianie (`WidgetCenter`).
Wszystkie targety współdzielą App Group `group.xyz.mikebravo.gminamc`.

### Ustawienia na zegarku

App Group **nie synchronizuje się między iPhonem a zegarkiem** (osobne urządzenia),
więc `WatchSync` (WatchConnectivity) sam przesyła adres backendu i token na Watch —
po starcie apki iOS oraz po każdym zapisie w ⚙️ Ustawieniach. Wystarczy raz otworzyć
apkę na iPhonie przy sparowanym zegarku; nic nie konfigurujesz na zegarku ręcznie.

> Plik `.xcodeproj` **nie jest** w repo — generujemy go z `project.yml`, żeby uniknąć
> konfliktów. To standardowe podejście.

## Wymagania

- macOS z Xcode 15+
- Konto Apple Developer (do push i instalacji na zegarku)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`

## Uruchomienie

```bash
cd ios
# 1. Wpisz swój Team ID w project.yml (pole DEVELOPMENT_TEAM)
xcodegen generate
open GminaMC.xcodeproj
```

W Xcode:
1. Wybierz target **GminaMC** → zakładka *Signing & Capabilities* → ustaw swój zespół.
   To samo dla **GminaMC Watch App**.
2. Uruchom na iPhonie (push działa tylko na fizycznym urządzeniu, nie w symulatorze).
3. W apce otwórz ⚙️ i wpisz adres backendu, np. `https://gmina-mc.fly.dev`
   (oraz token, jeśli ustawiłeś `API_TOKEN` na serwerze).

## Powiadomienia push (APNs)

Aby działały powiadomienia „X dołączył do serwera":

1. W [Apple Developer](https://developer.apple.com) → *Keys* utwórz klucz APNs (.p8).
   Zapisz **Key ID** i **Team ID**.
2. Włącz *Push Notifications* dla App ID `xyz.mikebravo.gminamc`.
3. Wartości klucza ustaw jako sekrety na backendzie (`APNS_KEY`, `APNS_KEY_ID`,
   `APNS_TEAM_ID`, `APNS_BUNDLE_ID`) — patrz `../server/README.md`.

Apka przy starcie prosi o zgodę na powiadomienia i sama rejestruje token urządzenia
w backendzie (`POST /api/devices`).

## Konfiguracja identyfikatorów

Domyślnie używamy:
- Bundle ID iOS: `xyz.mikebravo.gminamc`
- Bundle ID Watch: `xyz.mikebravo.gminamc.watchkitapp`
- App Group: `group.xyz.mikebravo.gminamc` (współdzielone ustawienia iOS ↔ Watch)

Jeśli chcesz własny prefix, zmień je spójnie w `project.yml`, `WatchApp/Info.plist`
(`WKCompanionAppBundleIdentifier`) oraz w `Shared/APIClient.swift` (nazwa App Group).
