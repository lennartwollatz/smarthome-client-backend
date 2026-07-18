import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DeviceHistoryDatabase } from "../deviceHistoryDatabase.js";
import { resolveDeviceHistoryDbPath } from "../deviceHistoryPaths.js";
import { SensorHistoryStore, rangeBounds } from "../sensorHistoryStore.js";

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

  it("aggregiert Temperaturverlauf im Jahresbereich auf Tagesdurchschnitte", () => {
    const day1Start = new Date("2026-07-16T00:00:00").getTime();
    const day2Start = new Date("2026-07-17T00:00:00").getTime();

    sensorStore.appendTemperature("sensor-1", 18, 20, day1Start + 10 * 60 * 60 * 1000);
    sensorStore.appendTemperature("sensor-1", 22, 20, day1Start + 18 * 60 * 60 * 1000);
    sensorStore.appendTemperature("sensor-1", 16, 21, day2Start + 12 * 60 * 60 * 1000);
    sensorStore.appendTemperature("sensor-1", 24, 21, day2Start + 20 * 60 * 60 * 1000);

    const points = sensorStore.getTemperature("sensor-1", "year");
    expect(points).toHaveLength(2);
    expect(points[0].time).toBe(day1Start);
    expect(points[0].value).toBe(20);
    expect(points[0].goal).toBe(20);
    expect(points[1].time).toBe(day2Start);
    expect(points[1].value).toBe(20);
    expect(points[1].goal).toBe(21);
  });

  it("Jahresbereich umfasst die letzten 365 Tage", () => {
    const now = new Date("2026-07-18T12:00:00").getTime();
    const { fromMs, toMs } = rangeBounds("year", now);
    expect(toMs).toBe(now);
    expect(toMs - fromMs).toBe(365 * 24 * 60 * 60 * 1000);
  });
});
