import { describe, expect, it, beforeEach } from "vitest";
import { BMWDeviceController } from "../bmwDeviceController.js";
import type { EventLogStore } from "../../../../db/eventLogStore.js";
import type { EventLogEntry, EventLogQuery, EventLogQueryResult } from "../../../../audit/eventLogEntry.js";
import type { BmwCarDataMqttEnvelope } from "../bmwCarDataMqttHub.js";
import type { BMWTokenStore } from "../bmwTokenStore.js";
import type { BMWCredentialsStore } from "../bmwCredentialsStore.js";
import type { BmwCarTelemetryHistoryStore } from "../../../../db/bmwCarTelemetryHistoryStore.js";
import { EventType } from "../../../../events/event-types/EventType.js";

class InMemoryEventLogStore implements Pick<EventLogStore, "append" | "query" | "clearAll"> {
  public entries: EventLogEntry[] = [];

  append(entry: EventLogEntry): void {
    this.entries.push(entry);
  }

  query(_query: EventLogQuery = {}): EventLogQueryResult {
    return { total: this.entries.length, items: [...this.entries] };
  }

  clearAll(): void {
    this.entries = [];
  }
}

class StubTelemetryHistoryStore {
  public appends: { deviceId: string; key: string; value: unknown; timeMs: number }[] = [];

  append(deviceId: string, key: string, value: unknown, timeMs: number): void {
    this.appends.push({ deviceId, key, value, timeMs });
  }
}

function makeController(opts: {
  eventLogStore?: EventLogStore;
  telemetryHistory?: BmwCarTelemetryHistoryStore;
  resolveDeviceIds?: (vin: string) => string[];
}): BMWDeviceController {
  const ctrl = new BMWDeviceController(
    {} as BMWTokenStore,
    {} as BMWCredentialsStore,
    opts.telemetryHistory,
    opts.eventLogStore
  );
  if (opts.resolveDeviceIds) {
    ctrl.setVinDeviceResolver(opts.resolveDeviceIds);
  }
  return ctrl;
}

describe("BMWDeviceController – MQTT EventLog", () => {
  let store: InMemoryEventLogStore;

  beforeEach(() => {
    store = new InMemoryEventLogStore();
  });

  it("speichert jede MQTT-Nachricht als EventLogEntry pro aufgeloester deviceId", () => {
    const ctrl = makeController({
      eventLogStore: store as unknown as EventLogStore,
      resolveDeviceIds: vin => (vin === "WBA123" ? ["bmw-wba123"] : [])
    });

    const env: BmwCarDataMqttEnvelope = {
      vin: "WBA123",
      timestamp: 1_700_000_000_000,
      data: {
        "vehicle.drivetrain.fuelSystem.level": { timestamp: 1_700_000_000_500, value: 72 },
        "vehicle.cabin.door.row1.driver.isOpen": { value: false }
      }
    };

    ctrl.handleMqttTelemetryMessage(env);

    expect(store.entries).toHaveLength(1);
    const entry = store.entries[0];
    expect(entry.deviceId).toBe("bmw-wba123");
    expect(entry.eventType).toBe(EventType.CAR_MQTT_RECEIVED);
    expect(entry.timestamp).toBe(1_700_000_000_000);

    const vinParam = entry.parameters.find(p => p.name === "vin");
    expect(vinParam?.value).toBe("WBA123");

    const keysParam = entry.parameters.find(p => p.name === "keys")?.value as string[];
    expect(keysParam).toEqual(
      expect.arrayContaining([
        "vehicle.drivetrain.fuelSystem.level",
        "vehicle.cabin.door.row1.driver.isOpen"
      ])
    );

    const dataResult = entry.results.find(r => r.name === "data")?.value as Record<
      string,
      { timestamp?: number; value: unknown }
    >;
    expect(dataResult["vehicle.drivetrain.fuelSystem.level"]).toEqual({
      timestamp: 1_700_000_000_500,
      value: 72
    });
    expect(dataResult["vehicle.cabin.door.row1.driver.isOpen"]).toEqual({
      timestamp: undefined,
      value: false
    });
  });

  it("schreibt fuer jede aufgeloeste deviceId einen separaten Eintrag", () => {
    const ctrl = makeController({
      eventLogStore: store as unknown as EventLogStore,
      resolveDeviceIds: () => ["bmw-a", "bmw-b"]
    });

    ctrl.handleMqttTelemetryMessage({
      vin: "WBA123",
      data: { "vehicle.drivetrain.fuelSystem.level": { value: 50 } }
    });

    expect(store.entries.map(e => e.deviceId).sort()).toEqual(["bmw-a", "bmw-b", "bmw-wba123"]);
  });

  it("nutzt deterministische Fallback-deviceId, wenn das Geraet noch nicht registriert ist", () => {
    const ctrl = makeController({
      eventLogStore: store as unknown as EventLogStore,
      resolveDeviceIds: () => []
    });

    ctrl.handleMqttTelemetryMessage({
      vin: "WBA999",
      data: { "vehicle.drivetrain.fuelSystem.level": { value: 50 } }
    });

    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].deviceId).toBe("bmw-wba999");
  });

  it("ignoriert leere oder ungueltige Envelopes", () => {
    const ctrl = makeController({
      eventLogStore: store as unknown as EventLogStore,
      resolveDeviceIds: () => ["bmw-a"]
    });

    ctrl.handleMqttTelemetryMessage({ vin: "", data: { foo: { value: 1 } } });
    ctrl.handleMqttTelemetryMessage({
      vin: "WBA1",
      data: {} as BmwCarDataMqttEnvelope["data"]
    });

    expect(store.entries).toHaveLength(0);
  });

  it("laesst Telemetrie-History-Schreibvorgaenge fuer tracked Keys unangetastet", () => {
    const history = new StubTelemetryHistoryStore();
    const ctrl = makeController({
      eventLogStore: store as unknown as EventLogStore,
      telemetryHistory: history as unknown as BmwCarTelemetryHistoryStore,
      resolveDeviceIds: () => ["bmw-a"]
    });

    ctrl.handleMqttTelemetryMessage({
      vin: "WBA1",
      timestamp: 100,
      data: {
        "vehicle.drivetrain.fuelSystem.level": { timestamp: 101, value: 60 },
        "vehicle.cabin.door.row1.driver.isOpen": { value: true }
      }
    });

    expect(store.entries).toHaveLength(2);
    expect(history.appends.length).toBeGreaterThan(0);
    expect(new Set(history.appends.map(a => a.deviceId))).toEqual(new Set(["bmw-a", "bmw-wba1"]));
    const keys = history.appends.map(a => a.key);
    expect(keys).toContain("vehicle.drivetrain.fuelSystem.level");
    expect(keys).toContain("vehicle.cabin.door.row1.driver.isOpen");
  });

  it("schreibt nichts, wenn kein EventLogStore konfiguriert ist", () => {
    const ctrl = makeController({
      resolveDeviceIds: () => ["bmw-a"]
    });

    expect(() =>
      ctrl.handleMqttTelemetryMessage({
        vin: "WBA1",
        data: { "vehicle.drivetrain.fuelSystem.level": { value: 60 } }
      })
    ).not.toThrow();
  });
});
