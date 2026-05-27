import { describe, expect, it } from "vitest";
import {
  buildSeriesFromCarMqttEventLog,
  mergeTelemetrySeries,
  shouldSupplementFromEventLog
} from "../bmwCarTelemetryEventLogSync.js";
import { collectDriverDoorOpenEvents } from "../bmwCarTripDetector.js";
import { EventType } from "../../../../events/event-types/EventType.js";

describe("bmwCarTelemetryEventLogSync", () => {
  it("baut Tür-Serie aus Event-Log nach", () => {
    const fromMs = Date.UTC(2026, 4, 26, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 26, 23, 59, 59);
    const tOpen = Date.UTC(2026, 4, 26, 7, 5, 0);

    const eventLogStore = {
      query: () => ({
        total: 1,
        items: [
          {
            eventId: "e1",
            deviceId: "bmw-test",
            timestamp: tOpen,
            eventType: EventType.CAR_MQTT_RECEIVED,
            source: "system",
            mlcollect: false,
            parameters: [],
            results: [
              {
                name: "data",
                value: {
                  "vehicle.cabin.door.row1.driver.isOpen": { timestamp: tOpen, value: true },
                  "vehicle.drivetrain.lastRemainingRange": { timestamp: tOpen, value: 330 }
                }
              }
            ]
          }
        ]
      })
    };

    const series = buildSeriesFromCarMqttEventLog(
      eventLogStore as never,
      ["bmw-test"],
      fromMs,
      toMs
    );
    expect(collectDriverDoorOpenEvents(series).length).toBe(1);
  });

  it("shouldSupplementFromEventLog wenn keine Tür-Auf-Events erkannt werden", () => {
    const series = {
      "vehicle.cabin.door.row1.driver.isOpen": [{ time: 1, value: false }]
    };
    expect(shouldSupplementFromEventLog(series)).toBe(true);
    const merged = mergeTelemetrySeries(series, {
      "vehicle.cabin.door.row1.driver.isOpen": [{ time: 2, value: true }]
    });
    expect(shouldSupplementFromEventLog(merged)).toBe(false);
  });

  it("paginiert alle Event-Log-Seiten", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 31, 23, 59, 59);
    const tEarly = Date.UTC(2026, 4, 26, 7, 5, 0);
    const tLate = Date.UTC(2026, 4, 26, 12, 0, 0);
    const latKey = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
    let queryCalls = 0;

    const filler = Array.from({ length: 499 }, (_, i) => ({
      eventId: `fill-${i}`,
      deviceId: "bmw-test",
      timestamp: tLate - i * 1000,
      eventType: EventType.CAR_MQTT_RECEIVED,
      source: "system",
      mlcollect: false,
      parameters: [],
      results: [
        {
          name: "data",
          value: {
            [latKey]: { timestamp: tLate - i * 1000, value: 53.5 + i * 0.0001 }
          }
        }
      ]
    }));

    const allItems = [
      {
        eventId: "late-door",
        deviceId: "bmw-test",
        timestamp: tLate,
        eventType: EventType.CAR_MQTT_RECEIVED,
        source: "system",
        mlcollect: false,
        parameters: [],
        results: [
          {
            name: "data",
            value: {
              "vehicle.cabin.door.row1.driver.isOpen": { timestamp: tLate, value: true }
            }
          }
        ]
      },
      ...filler,
      {
        eventId: "early-door",
        deviceId: "bmw-test",
        timestamp: tEarly,
        eventType: EventType.CAR_MQTT_RECEIVED,
        source: "system",
        mlcollect: false,
        parameters: [],
        results: [
          {
            name: "data",
            value: {
              "vehicle.cabin.door.row1.driver.isOpen": { timestamp: tEarly, value: true }
            }
          }
        ]
      }
    ];

    const eventLogStore = {
      query: (q: { offset?: number; limit?: number }) => {
        queryCalls += 1;
        const offset = q.offset ?? 0;
        const limit = q.limit ?? 500;
        return {
          total: allItems.length,
          items: allItems.slice(offset, offset + limit)
        };
      }
    };

    const series = buildSeriesFromCarMqttEventLog(
      eventLogStore as never,
      ["bmw-test"],
      fromMs,
      toMs
    );
    expect(queryCalls).toBeGreaterThanOrEqual(2);
    expect((series[latKey] ?? []).length).toBeGreaterThan(400);
    expect((series["vehicle.cabin.door.row1.driver.isOpen"] ?? []).length).toBe(2);
  });
});
