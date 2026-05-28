import type { DatabaseManager } from "./database.js";
import { JsonRepository } from "./jsonRepository.js";
import { logger } from "../../logger.js";
import { isTrackedTelemetryKey } from "../api/modules/bmw/bmwCarDataTelemetryKeys.js";
import {
  findCarMqttEventBounds,
  mergeTelemetrySeries,
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
  const gpsLookbackMs = 31 * 24 * 60 * 60 * 1000;
  const gpsFromMs = fromMs - gpsLookbackMs;

  for (const key of [latKey, lngKey]) {
    const points = (row.series[key] ?? []).filter(p => p.time >= gpsFromMs && p.time <= toMs);
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

function dedupeConsecutiveValues(points: BmwTelemetryHistoryPoint[]): BmwTelemetryHistoryPoint[] {
  const out: BmwTelemetryHistoryPoint[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.value === p.value) continue;
    out.push(p);
  }
  return out;
}

const LAT_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
const LNG_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";
const GPS_TRIM_KEYS = new Set([LAT_KEY, LNG_KEY]);
const TELEMETRY_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;
const MAX_GPS_POINTS = 4000;

function downsamplePoints(points: BmwTelemetryHistoryPoint[], maxPoints: number): BmwTelemetryHistoryPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out: BmwTelemetryHistoryPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    out.push(points[i]!);
  }
  const last = points[points.length - 1];
  if (last && out[out.length - 1]?.time !== last.time) {
    out.push(last);
  }
  return out;
}

function trimSeriesForStorage(
  series: Record<string, BmwTelemetryHistoryPoint[]>
): Record<string, BmwTelemetryHistoryPoint[]> {
  const minTime = Date.now() - TELEMETRY_RETENTION_MS;
  const out: Record<string, BmwTelemetryHistoryPoint[]> = {};

  for (const [key, points] of Object.entries(series)) {
    let trimmed = points.filter(p => Number.isFinite(p.time) && p.time >= minTime);
    if (GPS_TRIM_KEYS.has(key)) {
      trimmed = downsamplePoints(trimmed, MAX_GPS_POINTS);
    }
    trimmed = dedupeConsecutiveValues(trimmed);
    if (trimmed.length > 0) out[key] = trimmed;
  }

  return out;
}

export class BmwCarTelemetryHistoryStore {
  private repo: JsonRepository<BmwCarTelemetryHistoryData>;

  constructor(db: DatabaseManager) {
    this.repo = new JsonRepository<BmwCarTelemetryHistoryData>(db, "BmwCarTelemetryHistory");
  }

  mergeBulkSeries(deviceId: string, incoming: Record<string, BmwTelemetryHistoryPoint[]>): void {
    if (!deviceId) return;

    let row: BmwCarTelemetryHistoryData;
    try {
      row = this.repo.findById(deviceId) ?? { series: {} };
    } catch (e) {
      logger.warn({ e, deviceId }, "BmwCarTelemetryHistory: mergeBulkSeries findById fehlgeschlagen");
      return;
    }

    const merged = mergeTelemetrySeries(row.series ?? {}, incoming);
    row.series = trimSeriesForStorage(merged);

    try {
      this.repo.save(deviceId, row);
    } catch (e) {
      logger.error({ e, deviceId }, "BmwCarTelemetryHistory: mergeBulkSeries save fehlgeschlagen");
    }
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
    if (options.eventLogStore && options.syncEventLog === true) {
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
  ): number {
    try {
      return syncTelemetryHistoryFromEventLog(
        (id, series) => this.mergeBulkSeries(id, series),
        deviceIds,
        fromMs,
        toMs,
        eventLogStore
      );
    } catch (e) {
      logger.warn({ e, deviceIds }, "BmwCarTelemetryHistory: EventLog-Sync fehlgeschlagen");
      return 0;
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
    } = {}
  ): BmwCarTrip[] {
    const deviceIds = resolveDeviceIds(deviceId, options.vin);

    let row = loadMergedRow(this.repo, deviceIds);
    if (!row.series) row = { series: {} };

    const series = buildTripDetectionSeries(row, fromMs, toMs);

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

  /**
   * Einmaliges Backfill: schreibt alle CAR_MQTT_RECEIVED-Events aus dem Event-Log
   * dauerhaft in die Telemetrie-Historie (Tür, GPS, Tachostand, …).
   */
  backfillFromEventLog(
    deviceId: string,
    eventLogStore: EventLogStore,
    vin?: string
  ): { mqttEvents: number; fromMs?: number; toMs?: number } {
    const deviceIds = resolveDeviceIds(deviceId, vin);
    const bounds = findCarMqttEventBounds(eventLogStore, deviceIds);
    if (!bounds) {
      return { mqttEvents: 0 };
    }

    let syncedPoints = 0;
    let cursor = new Date(bounds.fromMs);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(bounds.toMs);

    while (cursor.getTime() <= end.getTime()) {
      const monthFrom = cursor.getTime();
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      const chunkTo = Math.min(bounds.toMs, monthEnd.getTime());
      syncedPoints += this.syncFromEventLog(deviceIds, monthFrom, chunkTo, eventLogStore);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    logger.info(
      { deviceId, deviceIds, syncedPoints, mqttEvents: bounds.count },
      "BmwCarTelemetryHistory: Event-Log-Backfill abgeschlossen"
    );

    return {
      mqttEvents: bounds.count,
      fromMs: bounds.fromMs,
      toMs: bounds.toMs
    };
  }

  countSeriesPoints(deviceId: string, vin?: string): Record<string, number> {
    const row = loadMergedRow(this.repo, resolveDeviceIds(deviceId, vin));
    const counts: Record<string, number> = {};
    for (const [key, points] of Object.entries(row.series ?? {})) {
      counts[key] = points.length;
    }
    return counts;
  }
}
