import type { DatabaseManager } from "./database.js";
import { JsonRepository } from "./jsonRepository.js";
import { logger } from "../../logger.js";
import { isTrackedTelemetryKey } from "../api/modules/bmw/bmwCarDataTelemetryKeys.js";
import {
  detectTripsFromHistorySeries,
  type BmwCarTrip
} from "../api/modules/bmw/bmwCarTripDetector.js";

export type { BmwCarTrip, BmwCarTripPoint } from "../api/modules/bmw/bmwCarTripDetector.js";

export type BmwTelemetryHistoryPoint = { time: number; value: unknown };

export type BmwCarTelemetryHistoryData = {
  series: Record<string, BmwTelemetryHistoryPoint[]>;
};

export class BmwCarTelemetryHistoryStore {
  private repo: JsonRepository<BmwCarTelemetryHistoryData>;

  constructor(db: DatabaseManager) {
    this.repo = new JsonRepository<BmwCarTelemetryHistoryData>(db, "BmwCarTelemetryHistory");
  }

  append(deviceId: string, key: string, value: unknown, timeMs: number): void {
    if (!deviceId || !isTrackedTelemetryKey(key)) return;
    if (!Number.isFinite(timeMs)) return;

    let row: BmwCarTelemetryHistoryData;
    try {
      row = this.repo.findById(deviceId) ?? { series: {} };
    } catch (e) {
      logger.warn({ e, deviceId }, "BmwCarTelemetryHistory: findById fehlgeschlagen");
      return;
    }

    const series = row.series[key] ?? [];
    const last = series[series.length - 1];
    if (last && last.value === value) return;

    series.push({ time: timeMs, value });
    row.series[key] = series;

    try {
      this.repo.save(deviceId, row);
    } catch (e) {
      logger.error({ e, deviceId, key }, "BmwCarTelemetryHistory: save fehlgeschlagen");
    }
  }

  getSeries(
    deviceId: string,
    keys: string[],
    fromMs: number,
    toMs: number
  ): Record<string, BmwTelemetryHistoryPoint[]> {
    const out: Record<string, BmwTelemetryHistoryPoint[]> = {};
    const allowed = keys.filter(k => isTrackedTelemetryKey(k));
    if (allowed.length === 0) return out;

    let row: BmwCarTelemetryHistoryData | undefined;
    try {
      row = this.repo.findById(deviceId) ?? undefined;
    } catch (e) {
      logger.debug({ e, deviceId }, "BmwCarTelemetryHistory: getSeries findById");
      return out;
    }
    if (!row?.series) return out;

    for (const key of allowed) {
      const points = (row.series[key] ?? []).filter(p => p.time >= fromMs && p.time <= toMs);
      if (points.length > 0) {
        out[key] = points;
      }
    }
    return out;
  }

  getTrips(deviceId: string, fromMs: number, toMs: number): BmwCarTrip[] {
    const latKey = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
    const lngKey = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";
    const series = this.getSeries(deviceId, [latKey, lngKey], fromMs, toMs);
    return detectTripsFromHistorySeries(series);
  }

  deleteByDeviceId(deviceId: string): void {
    try {
      this.repo.deleteById(deviceId);
    } catch (e) {
      logger.debug({ e, deviceId }, "BmwCarTelemetryHistory: deleteByDeviceId");
    }
  }
}
