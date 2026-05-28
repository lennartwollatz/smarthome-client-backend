import type { Migration } from "./migrationRunner.js";
import { DeviceHistoryDatabase } from "../server/db/deviceHistoryDatabase.js";
import { EnergyHistoryArchiveStore } from "../server/db/energyHistoryArchiveStore.js";
import type { EnergyUsage } from "../model/devices/energyTypes.js";
import { DeviceSwitch } from "../model/devices/DeviceSwitch.js";
import { logger } from "../logger.js";

type LegacyRow = { id: string; data: string };

function extractEnergyUsagesFromDevice(device: Record<string, unknown>): Record<string, EnergyUsage[]> {
  const liveButtons: Record<string, EnergyUsage[]> = {};
  const buttons = device.buttons ?? device.btns;
  if (!buttons || typeof buttons !== "object") return liveButtons;

  for (const [buttonId, rawBtn] of Object.entries(buttons as Record<string, unknown>)) {
    if (!rawBtn || typeof rawBtn !== "object") continue;
    const usages = (rawBtn as { energyUsages?: EnergyUsage[] }).energyUsages;
    if (!Array.isArray(usages) || usages.length === 0) continue;

    const normalized = usages
      .filter(u => u && typeof u.time === "number" && Number.isFinite(u.value))
      .map(u => ({ time: u.time, value: u.value }));
    if (normalized.length > 0) {
      liveButtons[buttonId] = normalized;
    }
  }
  return liveButtons;
}

/**
 * Repariert Energie-Verläufe nach Migration 001:
 * - übersehene energyUsages in Device-JSON (auch unter btns)
 * - fehlendes energy_live, obwohl energy_archive Daten hat
 */
export const migration002RepairSwitchEnergyHistory: Migration = {
  id: "002_repair_switch_energy_history",
  up(ctx) {
    const deviceHistoryDb = new DeviceHistoryDatabase(ctx.deviceHistoryDir);
    const energyStore = new EnergyHistoryArchiveStore(deviceHistoryDb);
    const conn = ctx.mainDb.getConnection();

    const deviceRows = conn.prepare("SELECT id, data FROM objects WHERE type = 'Device'").all() as LegacyRow[];
    let importedFromJson = 0;
    let promotedFromArchive = 0;

    for (const row of deviceRows) {
      try {
        const device = JSON.parse(row.data) as Record<string, unknown>;
        const liveButtons = extractEnergyUsagesFromDevice(device);
        if (Object.keys(liveButtons).length > 0) {
          energyStore.importLegacyLiveFromDevice(row.id, liveButtons);
          importedFromJson += 1;
        }

        const beforeLive = deviceHistoryDb.readCategory<{ buttons: Record<string, EnergyUsage[]> }>(
          row.id,
          "energy_live"
        );
        const hadLive =
          beforeLive?.buttons && Object.values(beforeLive.buttons).some(arr => (arr?.length ?? 0) > 0);

        energyStore.promoteArchiveToLiveWindow(row.id, DeviceSwitch.ENERGY_USAGE_LIVE_WINDOW_MS);

        if (!hadLive) {
          const afterLive = deviceHistoryDb.readCategory<{ buttons: Record<string, EnergyUsage[]> }>(
            row.id,
            "energy_live"
          );
          const hasLiveNow =
            afterLive?.buttons && Object.values(afterLive.buttons).some(arr => (arr?.length ?? 0) > 0);
          if (hasLiveNow) promotedFromArchive += 1;
        }
      } catch (e) {
        logger.warn({ e, deviceId: row.id }, "Migration 002: Gerät übersprungen");
      }
    }

    deviceHistoryDb.closeAll();
    logger.info({ importedFromJson, promotedFromArchive }, "Migration 002 abgeschlossen");
  }
};
