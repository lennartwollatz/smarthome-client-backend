import type { DeviceHistoryDatabase } from "./deviceHistoryDatabase.js";
import { logger } from "../../logger.js";

/** Rohdaten älter als 400 Tage werden verworfen (Jahresansicht benötigt mindestens 365 Tage). */
const RAW_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;
const MOTION_MAX_ENTRIES = 30;

export type MotionHistoryEntry = { time: number; motion: boolean };
export type TemperatureHistoryPoint = { time: number; value: number; goal?: number };
export type LightLevelHistoryPoint = { time: number; value: number };

export type DeviceSensorHistoryData = {
  motion: MotionHistoryEntry[];
  temperature: TemperatureHistoryPoint[];
  lightLevel: LightLevelHistoryPoint[];
};

export type SensorHistoryMetric = "motion" | "temperature" | "lightLevel";
export type SensorHistoryRange = "day" | "week" | "month" | "year";

export function parseSensorHistoryRange(raw: string): SensorHistoryRange {
  if (raw === "week" || raw === "month" || raw === "year") return raw;
  return "day";
}

export function rangeBounds(range: SensorHistoryRange, now = Date.now()): { fromMs: number; toMs: number } {
  const toMs = now;
  const start = new Date(now);
  if (range === "day") {
    start.setHours(0, 0, 0, 0);
    return { fromMs: start.getTime(), toMs };
  }
  if (range === "week") {
    return { fromMs: now - 7 * 24 * 60 * 60 * 1000, toMs };
  }
  if (range === "month") {
    return { fromMs: now - 30 * 24 * 60 * 60 * 1000, toMs };
  }
  return { fromMs: now - 365 * 24 * 60 * 60 * 1000, toMs };
}

function bucketMsForLightLevel(range: SensorHistoryRange): number {
  if (range === "day") return 5 * 60 * 1000;
  if (range === "week") return 60 * 60 * 1000;
  if (range === "month") return 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function dayStartMs(timeMs: number): number {
  const d = new Date(timeMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function aggregateTemperatureDailyAverages(
  points: TemperatureHistoryPoint[],
  fromMs: number,
  toMs: number
): TemperatureHistoryPoint[] {
  const buckets = new Map<
    number,
    { valueSum: number; valueCount: number; goalSum: number; goalCount: number }
  >();
  for (const p of points) {
    if (p.time < fromMs || p.time > toMs || !Number.isFinite(p.value)) continue;
    const bucket = dayStartMs(p.time);
    const cur = buckets.get(bucket) ?? { valueSum: 0, valueCount: 0, goalSum: 0, goalCount: 0 };
    cur.valueSum += p.value;
    cur.valueCount += 1;
    if (p.goal !== undefined && Number.isFinite(p.goal)) {
      cur.goalSum += p.goal;
      cur.goalCount += 1;
    }
    buckets.set(bucket, cur);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, { valueSum, valueCount, goalSum, goalCount }]) => {
      const point: TemperatureHistoryPoint = { time, value: valueSum / valueCount };
      if (goalCount > 0) {
        point.goal = goalSum / goalCount;
      }
      return point;
    });
}

function aggregateAverages(
  points: LightLevelHistoryPoint[],
  fromMs: number,
  toMs: number,
  bucketMs: number
): LightLevelHistoryPoint[] {
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const p of points) {
    if (p.time < fromMs || p.time > toMs || !Number.isFinite(p.value)) continue;
    const bucket = Math.floor((p.time - fromMs) / bucketMs) * bucketMs + fromMs;
    const cur = buckets.get(bucket) ?? { sum: 0, count: 0 };
    cur.sum += p.value;
    cur.count += 1;
    buckets.set(bucket, cur);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, { sum, count }]) => ({ time, value: sum / count }));
}

export class SensorHistoryStore {
  constructor(private readonly deviceHistoryDb: DeviceHistoryDatabase) {}

  private empty(): DeviceSensorHistoryData {
    return { motion: [], temperature: [], lightLevel: [] };
  }

  private load(deviceId: string): DeviceSensorHistoryData {
    try {
      return this.deviceHistoryDb.readCategory<DeviceSensorHistoryData>(deviceId, "sensor") ?? this.empty();
    } catch (e) {
      logger.warn({ e, deviceId }, "SensorHistory: load fehlgeschlagen");
      return this.empty();
    }
  }

  private save(deviceId: string, row: DeviceSensorHistoryData): void {
    try {
      this.deviceHistoryDb.writeCategory(deviceId, "sensor", row);
    } catch (e) {
      logger.error({ e, deviceId }, "SensorHistory: save fehlgeschlagen");
    }
  }

  private trimRaw<T extends { time: number }>(entries: T[]): T[] {
    const minTime = Date.now() - RAW_MAX_AGE_MS;
    return entries.filter(e => e.time >= minTime);
  }

  appendMotion(deviceId: string, motion: boolean, timeMs: number): void {
    if (!deviceId || !Number.isFinite(timeMs)) return;
    const row = this.load(deviceId);
    const last = row.motion[row.motion.length - 1];
    if (last && last.motion === motion) return;

    row.motion.push({ time: timeMs, motion });
    if (row.motion.length > MOTION_MAX_ENTRIES) {
      row.motion = row.motion.slice(-MOTION_MAX_ENTRIES);
    }
    this.save(deviceId, row);
  }

  appendTemperature(deviceId: string, value: number, goal: number | undefined, timeMs: number): void {
    if (!deviceId || !Number.isFinite(timeMs) || !Number.isFinite(value)) return;
    const row = this.load(deviceId);
    const last = row.temperature[row.temperature.length - 1];
    const goalNorm = goal !== undefined && Number.isFinite(goal) && goal !== -999 ? goal : undefined;
    if (last && last.value === value && last.goal === goalNorm) return;

    const point: TemperatureHistoryPoint = { time: timeMs, value };
    if (goalNorm !== undefined) {
      point.goal = goalNorm;
    }
    row.temperature.push(point);
    row.temperature = this.trimRaw(row.temperature);
    this.save(deviceId, row);
  }

  appendLightLevel(deviceId: string, value: number, timeMs: number): void {
    if (!deviceId || !Number.isFinite(timeMs) || !Number.isFinite(value)) return;
    const row = this.load(deviceId);
    const last = row.lightLevel[row.lightLevel.length - 1];
    if (last && last.value === value) return;

    row.lightLevel.push({ time: timeMs, value });
    row.lightLevel = this.trimRaw(row.lightLevel);
    this.save(deviceId, row);
  }

  getMotion(deviceId: string): MotionHistoryEntry[] {
    return [...(this.load(deviceId).motion ?? [])].sort((a, b) => b.time - a.time);
  }

  getTemperature(deviceId: string, range: SensorHistoryRange): TemperatureHistoryPoint[] {
    const { fromMs, toMs } = rangeBounds(range);
    const raw = (this.load(deviceId).temperature ?? [])
      .filter(p => p.time >= fromMs && p.time <= toMs)
      .sort((a, b) => a.time - b.time);
    if (range === "year") {
      return aggregateTemperatureDailyAverages(raw, fromMs, toMs);
    }
    return raw;
  }

  getLightLevel(deviceId: string, range: SensorHistoryRange): LightLevelHistoryPoint[] {
    const { fromMs, toMs } = rangeBounds(range);
    const raw = (this.load(deviceId).lightLevel ?? []).filter(p => p.time >= fromMs && p.time <= toMs);
    return aggregateAverages(raw, fromMs, toMs, bucketMsForLightLevel(range));
  }

  deleteByDeviceId(deviceId: string): void {
    try {
      this.deviceHistoryDb.deleteCategory(deviceId, "sensor");
      this.deviceHistoryDb.closeDevice(deviceId);
    } catch (e) {
      logger.debug({ e, deviceId }, "SensorHistory: deleteByDeviceId");
    }
  }

  /** Migration: Daten aus der Haupt-DB in die Geräte-History-DB übernehmen. */
  importLegacyRow(deviceId: string, data: DeviceSensorHistoryData): void {
    this.save(deviceId, data);
  }
}
