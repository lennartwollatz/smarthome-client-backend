/**
 * Einmaliges Backfill: MQTT-Daten aus dem Event-Log in die Telemetrie-Historie
 * schreiben und erkannte Fahrten ausgeben.
 *
 * Aufruf (Backend darf nicht laufen):
 *   npx tsx scripts/backfill-bmw-trips.ts
 *
 * Optional: DB_URL=data/smarthomeNew.sqlite npx tsx scripts/backfill-bmw-trips.ts
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { DatabaseManager } from "../com/smarthome/backend/server/db/database.js";
import { EventLogStore } from "../com/smarthome/backend/server/db/eventLogStore.js";
import { BmwCarTelemetryHistoryStore } from "../com/smarthome/backend/server/db/bmwCarTelemetryHistoryStore.js";
import { JsonRepository } from "../com/smarthome/backend/server/db/jsonRepository.js";
import { Device } from "../com/smarthome/backend/model/devices/Device.js";
import { DeviceCar } from "../com/smarthome/backend/model/devices/DeviceCar.js";
import { BMWCarFuelSettingsStore } from "../com/smarthome/backend/server/api/modules/bmw/bmwCarFuelSettingsStore.js";
import { backfillBmwTripsFromDatabase } from "../com/smarthome/backend/server/api/modules/bmw/bmwCarTripBackfill.js";

const dbPath = process.env.DB_URL ?? "data/smarthomeNew.sqlite";

function fmt(ms?: number): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString("de-DE");
}

function main(): void {
  if (!existsSync(dbPath)) {
    console.error(`Datenbank nicht gefunden: ${dbPath}`);
    process.exit(1);
  }

  const db = new DatabaseManager(dbPath);
  db.connect();

  const eventLogStore = new EventLogStore(db);
  const telemetryStore = new BmwCarTelemetryHistoryStore(db);
  const fuelStore = new BMWCarFuelSettingsStore(db);
  const deviceRepo = new JsonRepository<Device>(db, "Device");

  const bmwDevices = deviceRepo
    .findAll()
    .filter(d => d.moduleId === "bmw" && d.id);

  if (bmwDevices.length === 0) {
    console.log("Keine BMW-Geräte in der Datenbank gefunden.");
    db.close();
    return;
  }

  console.log(`Datenbank: ${dbPath}`);
  console.log(`BMW-Fahrzeuge: ${bmwDevices.length}\n`);

  for (const device of bmwDevices) {
    const car = device as DeviceCar;
    const tankCapacityLiters = fuelStore.getCapacityLiters(device.id);
    console.log(`-- ${device.id} (${car.vin ?? "ohne VIN"}) --`);

    const result = backfillBmwTripsFromDatabase(telemetryStore, eventLogStore, device.id, {
      vin: car.vin,
      tankCapacityLiters
    });

    console.log(`MQTT-Events synchronisiert: ${result.mqttEventsSynced}`);
    if (result.syncFromMs != null) {
      console.log(`Zeitraum Event-Log: ${fmt(result.syncFromMs)} – ${fmt(result.syncToMs)}`);
    }
    console.log(
      `Telemetrie Tür: ${result.doorPointsBefore} → ${result.doorPointsAfter} Punkte, ` +
        `Tachostand: ${result.mileagePointsAfter} Punkte`
    );

    if (result.months.length === 0) {
      console.log("Keine Monate mit Telemetrie – keine Fahrten erkannt.\n");
      continue;
    }

    console.log("Erkannte Fahrten pro Monat:");
    for (const m of result.months) {
      const label = `${String(m.month).padStart(2, "0")}.${m.year}`;
      console.log(`  ${label}: ${m.tripCount} Fahrt(en), ${m.totalKm} km`);
    }
    console.log(`Gesamt: ${result.totalTrips} Fahrt(en), ${result.totalKm} km\n`);
  }

  db.close();
  console.log("Backfill abgeschlossen. Backend neu starten und Widget öffnen.");
}

main();
