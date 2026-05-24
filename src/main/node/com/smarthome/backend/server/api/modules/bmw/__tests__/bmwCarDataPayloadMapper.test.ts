import { describe, expect, it } from "vitest";
import {
  BMW_DEFAULT_DOORS_CLOSED,
  BMW_DEFAULT_WINDOWS_CLOSED,
  mapTelemetrySnapshotToCarFields,
  pickTrackedTelemetry
} from "../bmwCarDataPayloadMapper.js";

function flatData(data: Record<string, { value: unknown }>): Record<string, unknown> {
  const snap: Record<string, unknown> = {};
  for (const [key, meta] of Object.entries(data)) {
    snap[key] = meta.value;
  }
  return snap;
}

describe("bmwCarDataPayloadMapper", () => {
  it("mappt Stream-Pfade aus Beispiel-MQTT-JSON", () => {
    const snap = flatData({
      "vehicle.cabin.door.status": { value: "SECURED" },
      "vehicle.drivetrain.fuelSystem.level": { value: 72 },
      "vehicle.vehicle.travelledDistance": { value: 42150 },
      "vehicle.drivetrain.lastRemainingRange": { value: 380 },
      "vehicle.cabin.window.row1.driver.status": { value: "CLOSED" },
      "vehicle.cabin.door.row1.driver.isOpen": { value: false },
      "vehicle.chassis.axle.row1.wheel.left.tire.pressure": { value: 240 },
      "vehicle.chassis.axle.row1.wheel.right.tire.pressure": { value: 242 },
      "vehicle.chassis.axle.row2.wheel.left.tire.pressure": { value: 238 },
      "vehicle.chassis.axle.row2.wheel.right.tire.pressure": { value: 239 },
      "vehicle.chassis.axle.row1.wheel.left.tire.pressureTarget": { value: 250 },
      "vehicle.vehicle.preConditioning.activity": { value: "ACTIVE" },
      "vehicle.cabin.infotainment.navigation.currentLocation.latitude": { value: 48.1351 },
      "vehicle.cabin.infotainment.navigation.currentLocation.longitude": { value: 11.582 }
    });

    const mapped = mapTelemetrySnapshotToCarFields(snap);

    expect(mapped.lockedState).toBe(true);
    expect(mapped.fuelLevelPercent).toBe(72);
    expect(mapped.mileageKm).toBe(42150);
    expect(mapped.rangeKm).toBe(380);
    expect(mapped.climateControlState).toBe(true);
    expect(mapped.windows?.leftFront).toBe(true);
    expect(mapped.doors?.leftFront).toBe(true);
    expect(mapped.tirePressuresKpa?.frontLeft).toBe(240);
    expect(mapped.tirePressureTargetKpa?.frontLeft).toBe(250);
    expect(mapped.location?.coordinates.latitude).toBe(48.1351);
    expect(mapped.location?.coordinates.longitude).toBe(11.582);

    const tracked = pickTrackedTelemetry(snap);
    expect(tracked["vehicle.cabin.door.status"]).toBe("SECURED");
    expect(tracked["vehicle.drivetrain.fuelSystem.level"]).toBe(72);
  });

  it("liefert bei leerem Snapshot geschlossene Standard-Türen und Fenster", () => {
    const mapped = mapTelemetrySnapshotToCarFields({});
    expect(mapped.doors).toEqual(BMW_DEFAULT_DOORS_CLOSED);
    expect(mapped.windows).toEqual(BMW_DEFAULT_WINDOWS_CLOSED);
  });

  it("behandelt fehlende Einzeltüren als geschlossen (nicht offen)", () => {
    const snap = flatData({
      "vehicle.cabin.door.row1.driver.isOpen": { value: false },
      "vehicle.cabin.door.row1.passenger.isOpen": { value: false }
    });
    const mapped = mapTelemetrySnapshotToCarFields(snap);

    expect(mapped.doors?.leftFront).toBe(true);
    expect(mapped.doors?.rightFront).toBe(true);
    expect(mapped.doors?.rightRear).toBe(true);
    expect(mapped.doors?.hood).toBe(true);
    expect(mapped.doors?.combinedState).toBe(true);
  });

  it("markiert nur explizit geöffnete Türen als offen", () => {
    const snap = flatData({
      "vehicle.cabin.door.row1.passenger.isOpen": { value: true }
    });
    const mapped = mapTelemetrySnapshotToCarFields(snap);

    expect(mapped.doors?.rightFront).toBe(false);
    expect(mapped.doors?.leftFront).toBe(true);
    expect(mapped.doors?.combinedState).toBe(false);
  });
});
