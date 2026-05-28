import type { DeviceHistoryDatabase } from "./deviceHistoryDatabase.js";
import { logger } from "../../logger.js";
import { isTrackedTelemetryKey } from "../api/modules/bmw/bmwCarDataTelemetryKeys.js";
import {
  BMW_DRIVER_DOOR_KEY,
  BMW_TRIP_METRIC_KEYS,
  BMW_TRIP_TRIGGER_KEYS,
  detectTripsFromHistorySeries,
  type BmwCarTrip
} from "../api/modules/bmw/bmwCarTripDetector.js";
import type { BmwTripMonth } from "../api/modules/bmw/bmwTripMonthBounds.js";

export type { BmwCarTrip, BmwCarTripPoint } from "../api/modules/bmw/bmwCarTripDetector.js";
export type { BmwCarTripEntry, BmwCarTripSegment } from "../api/modules/bmw/bmwCarTripGrouper.js";

export type BmwTelemetryHistoryPoint = { time: number; value: unknown };

export type BmwCarTelemetryHistoryData = {
  series: Record<string, BmwTelemetryHistoryPoint[]>;
};

export class BmwCarTelemetryHistoryStore {
  constructor(private readonly deviceHistoryDb: DeviceHistoryDatabase) {}

  private load(deviceId: string): BmwCarTelemetryHistoryData {
    try {
      return this.deviceHistoryDb.readCategory<BmwCarTelemetryHistoryData>(deviceId, "bmw_telemetry") ?? { series: {} };
    } catch (e) {
      logger.warn({ e, deviceId }, "BmwCarTelemetryHistory: load fehlgeschlagen");
      return { series: {} };
    }
  }

  private save(deviceId: string, row: BmwCarTelemetryHistoryData): void {
    try {
      this.deviceHistoryDb.writeCategory(deviceId, "bmw_telemetry", row);
    } catch (e) {
      logger.error({ e, deviceId, key: "bmw_telemetry" }, "BmwCarTelemetryHistory: save fehlgeschlagen");
    }
  }

  append(deviceId: string, key: string, value: unknown, timeMs: number): void {
    if (!deviceId || !isTrackedTelemetryKey(key)) return;
    if (!Number.isFinite(timeMs)) return;

    const row = this.load(deviceId);
    const series = row.series[key] ?? [];
    const last = series[series.length - 1];
    if (last && last.value === value) return;

    series.push({ time: timeMs, value });
    row.series[key] = series;
    this.save(deviceId, row);
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

    let row: BmwCarTelemetryHistoryData;
    try {
      row = this.load(deviceId);
    } catch (e) {
      logger.debug({ e, deviceId }, "BmwCarTelemetryHistory: getSeries load");
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

  getAvailableTripMonths(deviceId: string): BmwTripMonth[] {
    const latKey = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
    const lngKey = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";
    const keysToScan = [...BMW_TRIP_TRIGGER_KEYS, latKey, lngKey, ...BMW_TRIP_METRIC_KEYS];

    let row: BmwCarTelemetryHistoryData;
    try {
      row = this.load(deviceId);
    } catch (e) {
      logger.debug({ e, deviceId }, "BmwCarTelemetryHistory: getAvailableTripMonths");
      return [];
    }
    if (!row?.series) return [];

    const monthSet = new Set<string>();
    for (const key of keysToScan) {
      for (const p of row.series[key] ?? []) {
        if (!Number.isFinite(p.time)) continue;
        const d = new Date(p.time);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        monthSet.add(`${y}-${m}`);
      }
    }

    const months: BmwTripMonth[] = [...monthSet].map(s => {
      const [yearStr, monthStr] = s.split("-");
      return { year: Number(yearStr), month: Number(monthStr) };
    });

    months.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
    return months;
  }

  getTrips(
    deviceId: string,
    fromMs: number,
    toMs: number,
    options: { tankCapacityLiters?: number } = {}
  ): BmwCarTrip[] {
    const latKey = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
    const lngKey = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";

    let row: BmwCarTelemetryHistoryData;
    try {
      row = this.load(deviceId);
    } catch (e) {
      logger.debug({ e, deviceId }, "BmwCarTelemetryHistory: getTrips load");
      return [];
    }
    if (!row?.series) return [];

    const series: Record<string, BmwTelemetryHistoryPoint[]> = {};
    for (const key of [latKey, lngKey]) {
      const points = (row.series[key] ?? []).filter(p => p.time >= fromMs && p.time <= toMs);
      if (points.length > 0) series[key] = points;
    }
    const carriedKeys = [BMW_DRIVER_DOOR_KEY, ...BMW_TRIP_METRIC_KEYS] as const;
    for (const key of carriedKeys) {
      const points = (row.series[key] ?? []).filter(p => p.time <= toMs);
      if (points.length > 0) series[key] = points;
    }

    void BMW_TRIP_TRIGGER_KEYS;

    return detectTripsFromHistorySeries(series, fromMs, toMs, {
      tankCapacityLiters: options.tankCapacityLiters
    });
  }

  deleteByDeviceId(deviceId: string): void {
    try {
      this.deviceHistoryDb.deleteCategory(deviceId, "bmw_telemetry");
      this.deviceHistoryDb.closeDevice(deviceId);
    } catch (e) {
      logger.debug({ e, deviceId }, "BmwCarTelemetryHistory: deleteByDeviceId");
    }
  }

  importLegacyRow(deviceId: string, data: BmwCarTelemetryHistoryData): void {
    this.save(deviceId, data);
  }
}
