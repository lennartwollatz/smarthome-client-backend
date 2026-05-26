import { describe, expect, it, beforeEach } from "vitest";
import {
  BMWCarFuelSettingsStore,
  BMW_TANK_CAPACITY_MIN_LITERS,
  BMW_TANK_CAPACITY_MAX_LITERS
} from "../bmwCarFuelSettingsStore.js";
import { BMW_DEFAULT_TANK_CAPACITY_LITERS } from "../bmwCarTripDetector.js";

type Row = { id: string; type: string; data: string };

class FakeStatement {
  constructor(
    private readonly sql: string,
    private readonly rows: Map<string, Row>
  ) {}

  run(...params: unknown[]): { changes: number } {
    const upper = this.sql.toUpperCase();
    if (upper.includes("INSERT INTO OBJECTS")) {
      const [id, type, data] = params as [string, string, string];
      const key = `${type}::${id}`;
      this.rows.set(key, { id, type, data });
      return { changes: 1 };
    }
    if (upper.includes("DELETE FROM OBJECTS")) {
      const [id, type] = params as [string, string];
      const key = `${type}::${id}`;
      const existed = this.rows.delete(key);
      return { changes: existed ? 1 : 0 };
    }
    return { changes: 0 };
  }

  get(...params: unknown[]): unknown {
    const [id, type] = params as [string, string];
    const upper = this.sql.toUpperCase();
    if (upper.includes("SELECT DATA FROM OBJECTS")) {
      return this.rows.get(`${type}::${id}`) ?? undefined;
    }
    if (upper.includes("SELECT COUNT(")) {
      return { count: this.rows.has(`${type}::${id}`) ? 1 : 0 };
    }
    return undefined;
  }

  all(): unknown[] {
    return [...this.rows.values()];
  }
}

class FakeConnection {
  constructor(private readonly rows: Map<string, Row>) {}
  prepare(sql: string): FakeStatement {
    return new FakeStatement(sql, this.rows);
  }
  close(): void {
    /* no-op */
  }
}

class FakeDatabaseManager {
  private readonly rows = new Map<string, Row>();
  createNewConnection(): FakeConnection {
    return new FakeConnection(this.rows);
  }
}

describe("BMWCarFuelSettingsStore", () => {
  let dbManager: FakeDatabaseManager;
  let store: BMWCarFuelSettingsStore;

  beforeEach(() => {
    dbManager = new FakeDatabaseManager();
    store = new BMWCarFuelSettingsStore(dbManager as never);
  });

  it("liefert Default 60 Liter, wenn nichts gespeichert ist", () => {
    expect(store.getCapacityLiters("bmw-test")).toBe(BMW_DEFAULT_TANK_CAPACITY_LITERS);
    expect(store.getSettings("bmw-test").tankCapacityLiters).toBe(
      BMW_DEFAULT_TANK_CAPACITY_LITERS
    );
  });

  it("speichert und persistiert benutzerdefiniertes Tankvolumen", () => {
    const result = store.setCapacity("bmw-test", 72);
    expect(result?.tankCapacityLiters).toBe(72);
    expect(store.getCapacityLiters("bmw-test")).toBe(72);
  });

  it("rundet Liter auf eine Nachkommastelle", () => {
    const result = store.setCapacity("bmw-test", 65.123);
    expect(result?.tankCapacityLiters).toBe(65.1);
  });

  it("lehnt Werte ausserhalb des Limits ab", () => {
    expect(store.setCapacity("bmw-test", BMW_TANK_CAPACITY_MIN_LITERS - 1)).toBeNull();
    expect(store.setCapacity("bmw-test", BMW_TANK_CAPACITY_MAX_LITERS + 1)).toBeNull();
    expect(store.setCapacity("bmw-test", Number.NaN)).toBeNull();
  });

  it("akzeptiert Limits exakt", () => {
    expect(store.setCapacity("bmw-test", BMW_TANK_CAPACITY_MIN_LITERS)).not.toBeNull();
    expect(store.setCapacity("bmw-test", BMW_TANK_CAPACITY_MAX_LITERS)).not.toBeNull();
  });

  it("reset setzt auf Default zurück", () => {
    store.setCapacity("bmw-test", 72);
    expect(store.getCapacityLiters("bmw-test")).toBe(72);
    const after = store.reset("bmw-test");
    expect(after.tankCapacityLiters).toBe(BMW_DEFAULT_TANK_CAPACITY_LITERS);
    expect(store.getCapacityLiters("bmw-test")).toBe(BMW_DEFAULT_TANK_CAPACITY_LITERS);
  });

  it("ist deviceId-spezifisch", () => {
    store.setCapacity("bmw-a", 50);
    store.setCapacity("bmw-b", 80);
    expect(store.getCapacityLiters("bmw-a")).toBe(50);
    expect(store.getCapacityLiters("bmw-b")).toBe(80);
  });
});
