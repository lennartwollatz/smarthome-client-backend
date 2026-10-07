# Smarthome Backend

Node.js/TypeScript-Backend (Express, Socket.IO, MySQL) für das Smarthome-Frontend.

## Voraussetzungen

- Node.js 20+
- MySQL 8.0.19+ (Schema `smarthome`, wird beim Start angelegt)
- Python 3 für die LG- und Xiaomi-Skripte unter `scripts/`

## Einrichtung

```bash
npm install
cp .env.example .env   # Werte anpassen, API_TOKEN = apiToken im Frontend
npm run dev            # Entwicklung mit Neustart bei Änderungen
```

| Skript | Zweck |
|--------|-------|
| `npm run dev` | Startet `src/index.ts` mit tsx im Watch-Modus |
| `npm run build` | Kompiliert nach `dist/` und kopiert die SQL-Migrationen |
| `npm start` | Startet den Build (`dist/index.js`) |
| `npm run migrate` | Führt nur die Datenbank-Migrationen aus |

## Struktur

```
src/
├── index.ts              Einstieg: DB verbinden, Manager starten, HTTP-Server
├── server.ts             Express-App, WebSocket, Fehlerbehandlung
├── config/               .env-Konfiguration und Logger
├── api/
│   ├── router.ts         Layer 1: Authentifizierung für alle /api-Routen
│   ├── middleware/       authenticate, validate, errorHandler
│   ├── validation/       Layer 2: zod-Schemas je Ressource
│   ├── http/             endpoint() verbindet die Layer, ApiError
│   ├── routes/           Layer 4: dünne Routen (auch modules/ für Modul-Endpunkte)
│   └── services/         Layer 5: Verarbeitung je Ressource bzw. Modul
├── model/
│   ├── requests/         Layer 3: Request_<Api>
│   ├── responses/        Layer 6: Response_<Api>
│   ├── db/               Abbildungen der Datenbanktabellen (Db<Tabelle>)
│   └── devices/ …        Domänenmodelle
├── db/                   Verbindung, Migrationen (migrations/*.sql), Repositories
├── modules/              Geräteintegrationen (Hue, Matter, LG, Sonos, …)
├── actions/              Aktionen, Workflows und Szenen
├── events/               Ereignisse und EventManager
├── live/                 Live-Updates über Socket.IO (/ws)
└── types/                Typdeklarationen für Bibliotheken ohne Typen
scripts/                  Python- und PowerShell-Hilfsskripte
data/                     Laufzeitdaten (nicht versioniert)
```

## Authentifizierung

Alle Anfragen an `/api` und der WebSocket (`/ws`) benötigen den Token aus `API_TOKEN`:
REST über `Authorization: Bearer <token>`, Socket.IO über `auth: { token }`.
