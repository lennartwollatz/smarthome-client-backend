import type { DatabaseManager } from "./database.js";
import { JsonRepository } from "./jsonRepository.js";
import { logger } from "../../logger.js";
import { isTrackedTelemetryKey } from "../api/modules/bmw/bmwCarDataTelemetryKeys.js";
import {
  buildSeriesFromCarMqttEventLog,
  mergeTelemetrySeries,
  shouldSupplementFromEventLog,
  syncTelemetryHistoryFromEventLog
} from "../api/modules/bmw/bmwCarTelemetryEventLogSync.js";
import {
  BMW_DRIVER_DOOR_KEY,
  BMW_TRIP_METRIC_KEYS,
  BMW_TRIP_TRIGGER_KEYS,
  collectDriverDoorOpenEvents,
  detectTripsFromHistorySeries,
  type BmwCarTrip
} from "../api/modules/bmw/bmwCarTripDetector.js";
import { normalizeBmwVin } from "../api/modules/bmw/bmwVehicleNamesStore.js";
import type { EventLogStore } from "./eventLogStore.js";
import type { BmwTripMonth } from "../api/modules/bmw/bmwTripMonthBounds.js";

export type { BmwCarTrip, BmwCarTripPoint } from "../api/modules/bmw/bmwCarTripDetector.js";
export type { BmwCarTripEntry, BmwCarTripSegment } from "../api/modules/bmw/bmwCarTripGrouper.js";

export type BmwTelemetryHistoryPoint = { time: number; value: unknown };

export type BmwCarTelemetryHistoryData = {
  series: Record<string, BmwTelemetryHistoryPoint[]>;
};

function vinDeviceId(vin: string): string {
  return `bmw-${normalizeBmwVin(vin).toLowerCase()}`;
}

function resolveDeviceIds(deviceId: string, vin?: string): string[] {
  const ids = [deviceId];
  if (vin) {
    const alt = vinDeviceId(vin);
    if (!ids.includes(alt)) ids.push(alt);
  }
  return ids;
}

function loadMergedRow(
  repo: JsonRepository<BmwCarTelemetryHistoryData>,
  deviceIds: string[]
): BmwCarTelemetryHistoryData {
  const merged: Record<string, BmwTelemetryHistoryPoint[]> = {};
  for (const id of deviceIds) {
    try {
      const row = repo.findById(id);
      if (!row?.series) continue;
      for (const [key, points] of Object.entries(row.series)) {
        merged[key] = mergeTelemetrySeries(
          { [key]: merged[key] ?? [] },
          { [key]: points }
        )[key];
      }
    } catch (e) {
      logger.debug({ e, deviceId: id }, "BmwCarTelemetryHistory: loadMergedRow");
    }
  }
  return { series: merged };
}

function buildTripDetectionSeries(
  row: BmwCarTelemetryHistoryData,
  fromMs: number,
  toMs: number
): Record<string, BmwTelemetryHistoryPoint[]> {
  const latKey = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
  const lngKey = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";
  const series: Record<string, BmwTelemetryHistoryPoint[]> = {};

  // GPS vor Monatsbeginn mitführen (letzter Stand vor der ersten Fahrt im Fenster).
  for (const key of [latKey, lngKey]) {
    const points = (row.series[key] ?? []).filter(p => p.time <= toMs);
    if (points.length > 0) series[key] = points;
  }

  const carriedKeys = [BMW_DRIVER_DOOR_KEY, ...BMW_TRIP_METRIC_KEYS] as const;
  for (const key of carriedKeys) {
    const points = (row.series[key] ?? []).filter(p => p.time <= toMs);
    if (points.length > 0) series[key] = points;
  }

  void BMW_TRIP_TRIGGER_KEYS;
  return series;
}

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
    toMs: number,
    options: { vin?: string; eventLogStore?: EventLogStore; syncEventLog?: boolean } = {}
  ): Record<string, BmwTelemetryHistoryPoint[]> {
    const out: Record<string, BmwTelemetryHistoryPoint[]> = {};
    const allowed = keys.filter(k => isTrackedTelemetryKey(k));
    if (allowed.length === 0) return out;

    const deviceIds = resolveDeviceIds(deviceId, options.vin);
    if (options.eventLogStore && options.syncEventLog !== false) {
      this.syncFromEventLog(deviceIds, fromMs, toMs, options.eventLogStore);
    }

    const row = loadMergedRow(this.repo, deviceIds);
    if (!row?.series) return out;

    for (const key of allowed) {
      const points = (row.series[key] ?? []).filter(p => p.time >= fromMs && p.time <= toMs);
      if (points.length > 0) {
        out[key] = points;
      }
    }
    return out;
  }

  private syncFromEventLog(
    deviceIds: string[],
    fromMs: number,
    toMs: number,
    eventLogStore: EventLogStore
  ): void {
    try {
      syncTelemetryHistoryFromEventLog(
        (id, key, value, timeMs) => this.append(id, key, value, timeMs),
        deviceIds,
        fromMs,
        toMs,
        eventLogStore
      );
    } catch (e) {
      logger.warn({ e, deviceIds }, "BmwCarTelemetryHistory: EventLog-Sync fehlgeschlagen");
    }
  }

  /**
   * Kalendermonate (1–12), in denen Telemetrie für Fahrten vorliegt.
   */
  getAvailableTripMonths(deviceId: string, vin?: string): BmwTripMonth[] {
    const latKey = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
    const lngKey = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";
    const keysToScan = [...BMW_TRIP_TRIGGER_KEYS, latKey, lngKey, ...BMW_TRIP_METRIC_KEYS];

    const row = loadMergedRow(this.repo, resolveDeviceIds(deviceId, vin));
    if (!row.series || Object.keys(row.series).length === 0) return [];

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
    options: {
      tankCapacityLiters?: number;
      vin?: string;
      eventLogStore?: EventLogStore;
    } = {}
  ): BmwCarTrip[] {
    const deviceIds = resolveDeviceIds(deviceId, options.vin);

    if (options.eventLogStore) {
      this.syncFromEventLog(deviceIds, fromMs, toMs, options.eventLogStore);
    }

    let row = loadMergedRow(this.repo, deviceIds);
    if (!row.series) row = { series: {} };

    let series = buildTripDetectionSeries(row, fromMs, toMs);

    if (options.eventLogStore && shouldSupplementFromEventLog(series)) {
      const fromEventLog = buildSeriesFromCarMqttEventLog(
        options.eventLogStore,
        deviceIds,
        fromMs,
        toMs
      );
      series = mergeTelemetrySeries(
        series,
        buildTripDetectionSeries({ series: fromEventLog }, fromMs, toMs)
      );
    }

    const trips = detectTripsFromHistorySeries(series, fromMs, toMs, {
      tankCapacityLiters: options.tankCapacityLiters
    });

    if (trips.length === 0) {
      const doorEvents = collectDriverDoorOpenEvents(series);
      logger.info(
        {
          deviceId,
          deviceIds,
          fromMs,
          toMs,
          doorPoints: (series[BMW_DRIVER_DOOR_KEY] ?? []).length,
          doorOpenEvents: doorEvents.length,
          latPoints:
            (series["vehicle.cabin.infotainment.navigation.currentLocation.latitude"] ?? []).length,
          lngPoints:
            (series["vehicle.cabin.infotainment.navigation.currentLocation.longitude"] ?? []).length
        },
        "BmwCarTelemetryHistory: keine Fahrten erkannt"
      );
    }

    return trips;
  }

  deleteByDeviceId(deviceId: string): void {
    try {
      this.repo.deleteById(deviceId);
    } catch (e) {
      logger.debug({ e, deviceId }, "BmwCarTelemetryHistory: deleteByDeviceId");
    }
  }
}
