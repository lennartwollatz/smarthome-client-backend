# Smarthome Backend (Node.js)

REST- und WebSocket-API für das Smarthome-System. Der Server verwaltet Geräte, Module, Szenen, Aktionen, Grundriss, Audit-Logs und optionale ML-Datensammlung. Persistenz erfolgt über SQLite (`better-sqlite3`).

Das Angular-Frontend (`smarthome-client-frontend`) spricht standardmäßig mit `http://localhost:4040/api`.

## Projektstruktur

```
smarthome-client-backend/
├── install_raspberry_pi.sh          # Produktions-Setup (Pi, nginx, PM2)
├── README.md
└── src/main/node/                   # ← Node-Backend (Arbeitsverzeichnis)
    ├── package.json
    ├── tsconfig.json
    ├── .env                         # Lokal, nicht im Git (siehe unten)
    ├── data/                        # SQLite-Dateien (gitignored)
    ├── scripts/
    │   ├── backfill-bmw-trips.ts    # BMW: Event-Log → Telemetrie → Fahrten
    │   └── backfill-bmw-trips.py    # Wie oben, ohne better-sqlite3 (Windows)
    ├── cleanup.ts                   # Einmaliges Wartungs-/Reset-Skript
    ├── inspectMlData.ts             # ML-Datenbank auswerten
    └── com/smarthome/backend/
        ├── index.ts                 # Einstiegspunkt
        ├── logger.ts
        ├── model/                   # Geräte- und Domänenmodelle
        └── server/
            ├── api/                 # Express-Router, Services, Module
            ├── db/                  # SQLite-Zugriff (JsonRepository)
            ├── events/              # Event-System, Event-Log
            ├── geo/                 # Reverse-Geocoding (Nominatim)
            └── ml/                  # DataCollector (separate ML-DB)
```

> **Hinweis:** Im Repository liegen noch Maven-Artefakte (`pom.xml`, `src/main/resources/application.properties`). Sie gehören zu einer älteren Java-Implementierung und werden **nicht** für den laufenden Server verwendet.

## Voraussetzungen

- **Node.js 20** oder höher (empfohlen; Pi-Install-Skript nutzt Node 20)
- **npm**
- Build-Tools für **better-sqlite3** (native Addon):
  - Linux/macOS: meist out-of-the-box
  - Windows: Visual Studio Build Tools („Desktop development with C++“) oder `npm rebuild better-sqlite3`

## Schnellstart

Alle Befehle im Verzeichnis `src/main/node` ausführen:

```bash
cd src/main/node
npm install
```

Optional `.env` anlegen (siehe Konfiguration), dann:

```bash
# Entwicklung mit Hot-Reload
npm run dev

# Produktion
npm run build
npm start
```

Der Server lauscht standardmäßig auf `http://127.0.0.1:4040`. API-Basis: `/api`.

## Konfiguration

Umgebungsvariablen (Datei `.env` im Ordner `src/main/node` oder System-Env):

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `HOST` | `127.0.0.1` | Bind-Adresse |
| `PORT` | `4040` | HTTP-Port |
| `DB_URL` | `data/smarthomeNew.sqlite` | Haupt-Datenbank (Geräte, Module, Einstellungen, Event-Log, …) |
| `ML_DB_URL` | `data/ml.sqlite` | ML-/Snapshot-Datenbank |
| `VACUUM_CLEANING_HISTORY_DB_URL` | `data/vacuum-cleaning-history.sqlite` | Staubsauger-Verlauf |
| `LOG_LEVEL` | (pino-Default) | z. B. `warn`, `info`, `debug` |

Beispiel `.env`:

```env
PORT=4040
HOST=127.0.0.1
DB_URL=data/smarthomeNew.sqlite
ML_DB_URL=data/ml.sqlite
LOG_LEVEL=warn
```

Das Verzeichnis `data/` wird beim ersten Start automatisch angelegt.

## API-Überblick

| Pfad | Inhalt |
|------|--------|
| `/api/users` | Benutzer |
| `/api/settings` | Globale Einstellungen |
| `/api/scenes` | Szenen |
| `/api/modules` | Modul-Liste, Install/Activate |
| `/api/modules/{id}/…` | Modul-spezifische Endpunkte (siehe unten) |
| `/api/devices` | Geräte, Steuerung, Sensor-Verlauf |
| `/api/actions` | Aktionen und Ausführung |
| `/api/floorplan` | Grundriss |
| `/api/audit` | Event-Log, Geräteänderungen |

Live-Updates (Geräte, Szenen, Einstellungen) laufen über **Socket.IO** auf demselben HTTP-Server.

### Integrierte Module (Sub-Router unter `/api/modules/…`)

| Modul | Pfad | Kurzbeschreibung |
|-------|------|------------------|
| Kalender | `/calendar` | Zentraler Kalender |
| Apple Kalender | `/calendar-apple` | CalDAV / Apple |
| Wetter | `/weather` | Wettergerät |
| Denon HEOS | `/denon` | Multiroom-Audio |
| Matter | `/matter` | Matter-Geräte |
| Sonoff / eWeLink | `/sonoff` | Cloud-Schalter |
| Philips Hue | `/hue` | Bridge & Lampen |
| LG | `/lg` | LG-Geräte |
| Sonos | `/sonos` | Sonos-Lautsprecher |
| WAC Lighting | `/waclighting` | Beleuchtung |
| BMW CarData | `/bmw` | Fahrzeug-Telemetrie, Fahrten, MQTT |
| Xiaomi | `/xiaomi` | Mi-Geräte |

Beispiel BMW-Fahrten:

```http
GET  /api/modules/bmw/devices/{deviceId}/trips/available-months
GET  /api/modules/bmw/devices/{deviceId}/trips?from={ms}&to={ms}
POST /api/modules/bmw/devices/{deviceId}/trips/backfill
```

## Datenbank

Alle Anwendungsdaten (außer ML und Staubsauger-Historie) liegen in **einer SQLite-Datei** (`DB_URL`). Objekte werden typisiert über `JsonRepository` gespeichert (`objects`-Tabelle mit `id`, `type`, `data`).

Wichtige Typen u. a.:

- `Device`, `Module`, `Scene`, `Settings`, `User`, `FloorPlan`
- `EventLog` – Audit & MQTT-Rohdaten (`carMqttReceived` für BMW)
- `BmwCarTelemetryHistory` – Zeitreihen (Tür, GPS, Tachostand, …)
- `DeviceSensorHistory` – Sensor-Verläufe

**Backup:** Server stoppen, Dateien unter `data/*.sqlite` kopieren.

## Hilfs-Skripte

Im Ordner `src/main/node`, **Server sollte gestoppt sein**:

| Befehl | Zweck |
|--------|--------|
| `npm run backfill-bmw-trips` | MQTT-Events aus dem Event-Log in die Telemetrie-Historie schreiben und erkannte Fahrten ausgeben |
| `python scripts/backfill-bmw-trips.py` | Nur Telemetrie-Sync (ohne native SQLite-Bindings) |
| `npx tsx cleanup.ts` | Einmaliges Cleanup (Matter-VA, Aktionen, ML, …) |
| `npx tsx inspectMlData.ts` | ML-Datenbank inspizieren |

Alternativ BMW-Backfill per API (Server läuft):

```bash
curl -X POST http://localhost:4040/api/modules/bmw/devices/{deviceId}/trips/backfill
```

## Tests

Tests nutzen [Vitest](https://vitest.dev/) (Dev-Dependency über `npx`):

```bash
cd src/main/node
npx vitest run
# oder ein Modul:
npx vitest run com/smarthome/backend/server/api/modules/bmw/__tests__/
```

## Produktion (Raspberry Pi)

Das Skript `install_raspberry_pi.sh` im Repository-Root automatisiert u. a.:

1. Node.js 20
2. `npm install` / `npm run build` im Backend
3. Angular-Production-Build fürs Frontend
4. nginx als Reverse-Proxy (HTTPS)
5. **PM2** für den Prozess `smarthome-backend`:

```bash
pm2 start dist/com/smarthome/backend/index.js --name smarthome-backend
```

Details und manuelle Schritte (Fritzbox, Zertifikate, Webhook) stehen im Install-Skript.

## Entwicklung

- **TypeScript**, ES Modules (`"type": "module"`)
- Compiler-Ziel: `ES2022`, Output: `dist/`
- Logging: **pino** / **pino-http**
- HTTP: **Express 4**, CORS aktiv, JSON-Body bis 10 MB

Bei Änderungen am Backend das Frontend neu bauen oder `ng serve` mit passendem API-Proxy verwenden, damit `/api`-Aufrufe den Node-Server treffen.
