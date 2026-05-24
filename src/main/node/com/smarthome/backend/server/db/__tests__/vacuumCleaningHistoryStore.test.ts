import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseManager } from "../database.js";
import { VacuumCleaningHistoryStore, todayBounds } from "../vacuumCleaningHistoryStore.js";

describe("VacuumCleaningHistoryStore", () => {
  let dir: string;
  let db: DatabaseManager;
  let store: VacuumCleaningHistoryStore;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vacuum-history-"));
    db = new DatabaseManager(path.join(dir, "test.sqlite"));
    db.connect();
    store = new VacuumCleaningHistoryStore(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("hasCleaningToday ist false ohne Einträge", () => {
    expect(store.hasCleaningToday("vac-1")).toBe(false);
  });

  it("hasCleaningToday erkennt Eintrag am heutigen Tag", () => {
    const now = new Date("2026-05-24T14:00:00");
    store.recordCleaning("vac-1", { mode: "docked", rooms: [], time: now.getTime() });
    expect(store.hasCleaningToday("vac-1", now)).toBe(true);
  });

  it("hasCleaningToday ignoriert Einträge von gestern", () => {
    const now = new Date("2026-05-24T10:00:00");
    const yesterday = new Date("2026-05-23T18:00:00");
    store.recordCleaning("vac-1", { mode: "docked", rooms: [], time: yesterday.getTime() });
    expect(store.hasCleaningToday("vac-1", now)).toBe(false);
  });

  it("todayBounds deckt den lokalen Kalendertag ab", () => {
    const now = new Date("2026-05-24T15:30:00");
    const { fromMs, toMs } = todayBounds(now);
    expect(fromMs).toBe(new Date("2026-05-24T00:00:00").getTime());
    expect(toMs).toBe(new Date("2026-05-24T23:59:59.999").getTime());
  });
});
