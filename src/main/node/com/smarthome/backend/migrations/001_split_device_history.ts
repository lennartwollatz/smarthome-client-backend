import type { Migration } from "./migrationRunner.js";
import { DeviceHistoryDatabase } from "../server/db/deviceHistoryDatabase.js";
import { SensorHistoryStore, type DeviceSensorHistoryData } from "../server/db/sensorHistoryStore.js";
import { BmwCarTelemetryHistoryStore, type BmwCarTelemetryHistoryData } from "../server/db/bmwCarTelemetryHistoryStore.js";
import {
  EnergyHistoryArchiveStore,
  type DeviceEnergyArchiveData
} from "../server/db/energyHistoryArchiveStore.js";
import type { EnergyUsage } from "../model/devices/energyTypes.js";
import { stripHistoryFieldsFromLoadedDevice } from "../server/api/entities/devices/serializeDeviceForDatabase.js";
import { logger } from "../logger.js";

const LEGACY_TYPES = ["DeviceSensorHistory", "BmwCarTelemetryHistory", "DeviceEnergyArchive"] as const;

type LegacyRow = { id: string; data: string };

function readLegacyRows(mainDb: import("../server/db/database.js").DatabaseManager, type: string): LegacyRow[] {
  return mainDb
    .getConnection()
    .prepare("SELECT id, data FROM objects WHERE type = ?")
    .all(type) as LegacyRow[];
}

function mergeEnergyUsages(
  target: Record<string, EnergyUsage[]>,
  source: Record<string, EnergyUsage[]>
): void {
  for (const [buttonId, usages] of Object.entries(source)) {
    if (!Array.isArray(usages) || usages.length === 0) continue;
    const byTime = new Map<number, EnergyUsage>();
    for (const u of target[buttonId] ?? []) {
      if (typeof u.time === "number" && Number.isFinite(u.value)) {
        byTime.set(u.time, u);
      }
    }
    for (const u of usages) {
      if (typeof u.time === "number" && Number.isFinite(u.value)) {
        byTime.set(u.time, { time: u.time, value: u.value });
      }
    }
    target[buttonId] = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  }
}

export const migration001SplitDeviceHistory: Migration = {
  id: "001_split_device_history",
  up(ctx) {
    const deviceHistoryDb = new DeviceHistoryDatabase(ctx.deviceHistoryDir);
    const sensorStore = new SensorHistoryStore(deviceHistoryDb);
    const bmwStore = new BmwCarTelemetryHistoryStore(deviceHistoryDb);
    const energyStore = new EnergyHistoryArchiveStore(deviceHistoryDb);
    const conn = ctx.mainDb.getConnection();

    let sensorCount = 0;
    for (const row of readLegacyRows(ctx.mainDb, "DeviceSensorHistory")) {
      try {
        const data = JSON.parse(row.data) as DeviceSensorHistoryData;
        sensorStore.importLegacyRow(row.id, data);
        sensorCount += 1;
      } catch (e) {
        logger.warn({ e, deviceId: row.id }, "Migration: DeviceSensorHistory Zeile übersprungen");
      }
    }

    let bmwCount = 0;
    for (const row of readLegacyRows(ctx.mainDb, "BmwCarTelemetryHistory")) {
      try {
        const data = JSON.parse(row.data) as BmwCarTelemetryHistoryData;
        bmwStore.importLegacyRow(row.id, data);
        bmwCount += 1;
      } catch (e) {
        logger.warn({ e, deviceId: row.id }, "Migration: BmwCarTelemetryHistory Zeile übersprungen");
      }
    }

    let energyArchiveCount = 0;
    for (const row of readLegacyRows(ctx.mainDb, "DeviceEnergyArchive")) {
      try {
        const data = JSON.parse(row.data) as DeviceEnergyArchiveData;
        energyStore.importLegacyArchive(row.id, data);
        energyArchiveCount += 1;
      } catch (e) {
        logger.warn({ e, deviceId: row.id }, "Migration: DeviceEnergyArchive Zeile übersprungen");
      }
    }

    const deviceRows = conn.prepare("SELECT id, data FROM objects WHERE type = 'Device'").all() as LegacyRow[];
    let devicesStripped = 0;
    let energyLiveFromDevices = 0;

    for (const row of deviceRows) {
      try {
        const device = JSON.parse(row.data) as Record<string, unknown>;
        const liveButtons: Record<string, EnergyUsage[]> = {};
        const buttons = device.buttons;
        if (buttons && typeof buttons === "object") {
          for (const [buttonId, rawBtn] of Object.entries(buttons as Record<string, unknown>)) {
            if (!rawBtn || typeof rawBtn !== "object") continue;
            const usages = (rawBtn as { energyUsages?: EnergyUsage[] }).energyUsages;
            if (Array.isArray(usages) && usages.length > 0) {
              mergeEnergyUsages(liveButtons, { [buttonId]: usages });
            }
          }
        }

        const hadHistory =
          Array.isArray(device.temperatureHistory) && device.temperatureHistory.length > 0;
        const hadEnergy = Object.keys(liveButtons).length > 0;
        if (!hadHistory && !hadEnergy) continue;

        if (hadEnergy && row.id) {
          energyStore.importLegacyLiveFromDevice(row.id, liveButtons);
          energyLiveFromDevices += 1;
        }

        stripHistoryFieldsFromLoadedDevice(device);
        conn
          .prepare(
            `
            UPDATE objects SET data = ?, updated_at = datetime('now')
            WHERE id = ? AND type = 'Device'
          `
          )
          .run(JSON.stringify(device), row.id);
        devicesStripped += 1;
      } catch (e) {
        logger.warn({ e, deviceId: row.id }, "Migration: Device-Zeile übersprungen");
      }
    }

    for (const type of LEGACY_TYPES) {
      const result = conn.prepare("DELETE FROM objects WHERE type = ?").run(type);
      logger.info({ type, deleted: result.changes }, "Migration: Legacy-Verlaufstyp entfernt");
    }

    deviceHistoryDb.closeAll();

    logger.info(
      {
        sensorCount,
        bmwCount,
        energyArchiveCount,
        devicesStripped,
        energyLiveFromDevices,
        deviceHistoryDir: ctx.deviceHistoryDir
      },
      "Migration 001 abgeschlossen"
    );
  }
};
