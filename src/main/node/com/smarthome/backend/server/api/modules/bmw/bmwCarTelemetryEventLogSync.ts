import type { EventLogEntry } from "../../../audit/eventLogEntry.js";
import type { EventLogStore } from "../../../db/eventLogStore.js";
import type { BmwTelemetryHistoryPoint } from "../../../db/bmwCarTelemetryHistoryStore.js";
import { EventType } from "../../../events/event-types/EventType.js";
import { isTrackedTelemetryKey } from "./bmwCarDataTelemetryKeys.js";
import { collectDriverDoorOpenEvents } from "./bmwCarTripDetector.js";

type MqttPayloadEntry = { timestamp?: number; value: unknown };

function mergePointLists(
  a: BmwTelemetryHistoryPoint[],
  b: BmwTelemetryHistoryPoint[]
): BmwTelemetryHistoryPoint[] {
  const seen = new Set<string>();
  const merged = [...a, ...b]
    .filter(p => Number.isFinite(p.time))
    .sort((x, y) => x.time - y.time)
    .filter(p => {
      const key = `${p.time}|${JSON.stringify(p.value)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return merged;
}

export function mergeTelemetrySeries(
  base: Record<string, BmwTelemetryHistoryPoint[]>,
  extra: Record<string, BmwTelemetryHistoryPoint[]>
): Record<string, BmwTelemetryHistoryPoint[]> {
  const keys = new Set([...Object.keys(base), ...Object.keys(extra)]);
  const out: Record<string, BmwTelemetryHistoryPoint[]> = {};
  for (const key of keys) {
    const merged = mergePointLists(base[key] ?? [], extra[key] ?? []);
    if (merged.length > 0) out[key] = merged;
  }
  return out;
}

function extractMqttDataFromEvent(entry: EventLogEntry): Record<string, MqttPayloadEntry> | null {
  const dataResult = entry.results?.find(r => r.name === "data");
  if (!dataResult?.value || typeof dataResult.value !== "object") return null;
  return dataResult.value as Record<string, MqttPayloadEntry>;
}

const EVENT_LOG_PAGE_SIZE = 500;
const EVENT_LOG_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

function ingestMqttEventIntoSeries(
  entry: EventLogEntry,
  idSet: Set<string>,
  fromMs: number,
  toMs: number,
  series: Record<string, BmwTelemetryHistoryPoint[]>
): void {
  if (!idSet.has(entry.deviceId)) return;
  const data = extractMqttDataFromEvent(entry);
  if (!data) return;

  const envelopeTs =
    typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
      ? entry.timestamp
      : Date.now();
  const minTime = fromMs - EVENT_LOG_LOOKBACK_MS;

  for (const [key, meta] of Object.entries(data)) {
    if (!isTrackedTelemetryKey(key)) continue;
    if (!meta || typeof meta !== "object" || !("value" in meta)) continue;
    const timeMs =
      typeof meta.timestamp === "number" && Number.isFinite(meta.timestamp)
        ? meta.timestamp
        : envelopeTs;
    if (timeMs < minTime || timeMs > toMs) continue;

    const list = series[key] ?? [];
    list.push({ time: timeMs, value: meta.value });
    series[key] = list;
  }
}

/**
 * Baut Telemetrie-Zeitreihen aus dem Event-Log (CAR_MQTT_RECEIVED) nach.
 * Paginiert alle Treffer – nicht nur die neuesten 500 – damit ältere Monatsdaten
 * nicht verloren gehen, wenn viele MQTT-Nachrichten eintreffen.
 */
export function buildSeriesFromCarMqttEventLog(
  eventLogStore: EventLogStore,
  deviceIds: string[],
  fromMs: number,
  toMs: number
): Record<string, BmwTelemetryHistoryPoint[]> {
  const idSet = new Set(deviceIds.filter(Boolean));
  if (idSet.size === 0) return {};

  const series: Record<string, BmwTelemetryHistoryPoint[]> = {};
  const queryFrom = fromMs - EVENT_LOG_LOOKBACK_MS;
  let offset = 0;

  while (true) {
    const { items, total } = eventLogStore.query({
      eventType: EventType.CAR_MQTT_RECEIVED,
      from: queryFrom,
      to: toMs,
      limit: EVENT_LOG_PAGE_SIZE,
      offset
    });

    for (const entry of items) {
      ingestMqttEventIntoSeries(entry, idSet, fromMs, toMs, series);
    }

    offset += items.length;
    if (items.length === 0 || offset >= total) break;
  }

  for (const key of Object.keys(series)) {
    series[key] = mergePointLists([], series[key] ?? []);
  }

  return series;
}

/**
 * Schreibt fehlende Telemetrie aus dem Event-Log dauerhaft in die Historie,
 * damit Verlauf-Anzeige und Fahrten-Erkennung dieselbe Datenbasis nutzen.
 */
export function syncTelemetryHistoryFromEventLog(
  append: (deviceId: string, key: string, value: unknown, timeMs: number) => void,
  deviceIds: string[],
  fromMs: number,
  toMs: number,
  eventLogStore: EventLogStore
): void {
  const series = buildSeriesFromCarMqttEventLog(eventLogStore, deviceIds, fromMs, toMs);
  for (const deviceId of deviceIds) {
    if (!deviceId) continue;
    for (const [key, points] of Object.entries(series)) {
      for (const p of points) {
        append(deviceId, key, p.value, p.time);
      }
    }
  }
}

export function shouldSupplementFromEventLog(
  series: Record<string, BmwTelemetryHistoryPoint[]>
): boolean {
  return collectDriverDoorOpenEvents(series).length === 0;
}
