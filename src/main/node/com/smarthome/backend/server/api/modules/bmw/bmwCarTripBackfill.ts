import type { EventLogStore } from "../../../db/eventLogStore.js";
import type { BmwCarTelemetryHistoryStore } from "../../../db/bmwCarTelemetryHistoryStore.js";
import { BMW_DRIVER_DOOR_KEY } from "./bmwCarTripDetector.js";
import { buildGroupedTripEntriesFast } from "./bmwCarTripEnricher.js";
import { monthBoundsMs } from "./bmwTripMonthBounds.js";

const MILEAGE_KEY = "vehicle.vehicle.travelledDistance";

export type BmwTripBackfillMonthSummary = {
  year: number;
  month: number;
  tripCount: number;
  totalKm: number;
};

export type BmwTripBackfillResult = {
  deviceId: string;
  vin?: string;
  mqttEventsSynced: number;
  syncFromMs?: number;
  syncToMs?: number;
  doorPointsBefore: number;
  doorPointsAfter: number;
  mileagePointsAfter: number;
  months: BmwTripBackfillMonthSummary[];
  totalTrips: number;
  totalKm: number;
};

function sumEntryKm(
  entries: ReturnType<typeof buildGroupedTripEntriesFast>
): number {
  return entries.reduce((sum, e) => sum + (e.mileageDrivenKm ?? e.distanceKm ?? 0), 0);
}

/**
 * Liest Telemetrie aus der DB (inkl. Event-Log-Backfill) und ermittelt alle Fahrten.
 * Die Fahrten werden bei jedem API-Abruf aus der Historie berechnet – dieses
 * Backfill persistiert die Roh-Telemetrie, damit die Erkennung funktioniert.
 */
export function backfillBmwTripsFromDatabase(
  telemetryStore: BmwCarTelemetryHistoryStore,
  eventLogStore: EventLogStore,
  deviceId: string,
  opts: { vin?: string; tankCapacityLiters?: number } = {}
): BmwTripBackfillResult {
  const countsBefore = telemetryStore.countSeriesPoints(deviceId, opts.vin);
  const doorBefore = countsBefore[BMW_DRIVER_DOOR_KEY] ?? 0;

  const sync = telemetryStore.backfillFromEventLog(deviceId, eventLogStore, opts.vin);

  const countsAfter = telemetryStore.countSeriesPoints(deviceId, opts.vin);
  const doorAfter = countsAfter[BMW_DRIVER_DOOR_KEY] ?? 0;
  const mileageAfter = countsAfter[MILEAGE_KEY] ?? 0;

  const months = telemetryStore.getAvailableTripMonths(deviceId, opts.vin);
  const monthSummaries: BmwTripBackfillMonthSummary[] = [];
  let totalTrips = 0;
  let totalKm = 0;

  for (const { year, month } of months) {
    const { fromMs, toMs } = monthBoundsMs(year, month);
    const trips = telemetryStore.getTrips(deviceId, fromMs, toMs, {
      vin: opts.vin,
      tankCapacityLiters: opts.tankCapacityLiters
    });
    const entries = buildGroupedTripEntriesFast(trips);
    const km = sumEntryKm(entries);
    monthSummaries.push({
      year,
      month,
      tripCount: entries.length,
      totalKm: Math.round(km * 10) / 10
    });
    totalTrips += entries.length;
    totalKm += km;
  }

  return {
    deviceId,
    vin: opts.vin,
    mqttEventsSynced: sync.mqttEvents,
    syncFromMs: sync.fromMs,
    syncToMs: sync.toMs,
    doorPointsBefore: doorBefore,
    doorPointsAfter: doorAfter,
    mileagePointsAfter: mileageAfter,
    months: monthSummaries,
    totalTrips,
    totalKm: Math.round(totalKm * 10) / 10
  };
}
