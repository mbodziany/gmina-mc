# Gmina MC — plugin do serwera (Paper)

Podstawowe, **dokładne** źródło danych dla Gmina MC. Plugin nasłuchuje wejść/wyjść
graczy i wysyła je do backendu, dzięki czemu apka dostaje:

- prawdziwe nicki + UUID **całej** listy online (a nie ograniczonej do ~12 próbki z pingu),
- natychmiastowe powiadomienia (zdarzenie join leci od razu, nie czeka na cykl pingu),
- dokładne czasy wejścia/wyjścia.

Jeśli plugin przestanie raportować (np. nie jest zainstalowany), backend **automatycznie
wraca do pingu (Server List Ping)** — działa wtedy nawet na czystej vanilli.

## ⚠️ Wymóg: Paper / Spigot

Vanilla Java **nie ładuje pluginów**. Aby z niego korzystać, kolega musi uruchomić serwer
na [**Paper**](https://papermc.io/downloads/paper) — to zamiennik vanilli „w miejscu":
ten sam świat i pliki, kompatybilny z waniliowymi klientami, bez migracji. Wystarczy
podmienić plik `server.jar`. (Plugin działa też na Spigocie/Bukkicie.)

Bez Papera po prostu pomiń plugin — zadziała sam fallback po pingu.

## Budowanie

Wymagany JDK 17+ i Maven.

```bash
cd plugin
mvn package
# wynik: target/GminaMC.jar
```

> W tym repo plugin był sprawdzany kompilacyjnie; gotowy artefakt zbudujesz powyższą
> komendą tam, gdzie dostępne jest repozytorium PaperMC.

## Instalacja

1. Wrzuć `target/GminaMC.jar` do folderu `plugins/` na serwerze.
2. Uruchom serwer raz, żeby wygenerował `plugins/GminaMC/config.yml`.
3. Uzupełnij konfigurację i wpisz `/reload confirm` lub zrestartuj serwer.

## Konfiguracja (`config.yml`)

```yaml
backend-url: "https://gmina-mc.fly.dev"   # ten sam backend, co w apce
ingest-token: "CHANGE-ME"                 # musi być równy INGEST_TOKEN na backendzie
heartbeat-seconds: 20                     # co ile wysyłać pełną listę online
```

`ingest-token` to wspólny sekret — ustaw tę samą wartość w `INGEST_TOKEN` backendu
(`fly secrets set INGEST_TOKEN=...`).

## Jak to gada z backendem

Cała komunikacja jest **wychodząca** z serwera (POST przez HTTPS), więc przechodzi przez
NAT/joinmc.gg bez otwierania żadnych portów:

| Kiedy | Żądanie |
|-------|---------|
| Co `heartbeat-seconds` | `POST /api/ingest/heartbeat` z pełną listą online (źródło prawdy) |
| Wejście/wyjście gracza | `POST /api/ingest/event` (natychmiastowy push) |

Backend uznaje plugin za „aktywny" dopóki dostaje heartbeaty (`PLUGIN_TIMEOUT_SECONDS`).
Gdy ucichną — przełącza się na ping.
