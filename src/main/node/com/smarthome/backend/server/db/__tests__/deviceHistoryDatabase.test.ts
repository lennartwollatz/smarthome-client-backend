import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DeviceHistoryDatabase } from "../deviceHistoryDatabase.js";
import { resolveDeviceHistoryDbPath } from "../deviceHistoryPaths.js";
import { SensorHistoryStore } from "../sensorHistoryStore.js";

describe("DeviceHistoryDatabase", () => {
  let dir: string;
  let historyDb: DeviceHistoryDatabase;
  let sensorStore: SensorHistoryStore;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "device-history-"));
    historyDb = new DeviceHistoryDatabase(dir);
    sensorStore = new SensorHistoryStore(historyDb);
  });

  afterEach(() => {
    historyDb.closeAll();
    rmSync(dir, { recursive: true, force: true });
  });

  it("legt die SQLite-Datei erst beim ersten Zugriff an", () => {
    const filePath = resolveDeviceHistoryDbPath(dir, "sensor-1");
    expect(existsSync(filePath)).toBe(false);
    sensorStore.appendTemperature("sensor-1", 21.5, undefined, Date.now());
    expect(existsSync(filePath)).toBe(true);
  });

  it("speichert und liest Temperaturverlauf pro Gerät", () => {
    const now = Date.now();
    sensorStore.appendTemperature("sensor-1", 20, undefined, now - 60_000);
    sensorStore.appendTemperature("sensor-1", 21, undefined, now);
    const points = sensorStore.getTemperature("sensor-1", "day");
    expect(points.length).toBe(2);
    expect(points[1].value).toBe(21);
  });
});
