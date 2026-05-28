import { describe, expect, it } from "vitest";
import { findCarMqttEventBounds } from "../bmwCarTelemetryEventLogSync.js";
import { EventType } from "../../../../events/event-types/EventType.js";

describe("findCarMqttEventBounds", () => {
  it("ermittelt min/max über paginierte Abfragen", () => {
    const t1 = 1_700_000_000_000;
    const t2 = 1_700_086_400_000;
    let calls = 0;

    const store = {
      query: (q: { offset?: number; limit?: number }) => {
        calls += 1;
        const offset = q.offset ?? 0;
        if (offset === 0) {
          return {
            total: 2,
            items: [
              {
                deviceId: "bmw-test",
                timestamp: t2,
                eventType: EventType.CAR_MQTT_RECEIVED
              }
            ]
          };
        }
        return {
          total: 2,
          items: [
            {
              deviceId: "bmw-test",
              timestamp: t1,
              eventType: EventType.CAR_MQTT_RECEIVED
            }
          ]
        };
      }
    };

    const bounds = findCarMqttEventBounds(store as never, ["bmw-test"]);
    expect(calls).toBe(2);
    expect(bounds).toEqual({ fromMs: t1, toMs: t2, count: 2 });
  });
});
