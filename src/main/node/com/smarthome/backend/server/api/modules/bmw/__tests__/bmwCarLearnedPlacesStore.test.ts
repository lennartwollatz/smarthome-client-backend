import { describe, expect, it, beforeEach } from "vitest";
import { BMWCarLearnedPlacesStore } from "../bmwCarLearnedPlacesStore.js";

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

  all(...params: unknown[]): unknown[] {
    const [type] = params as [string];
    return Array.from(this.rows.values()).filter(r => r.type === type);
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

describe("BMWCarLearnedPlacesStore", () => {
  let store: BMWCarLearnedPlacesStore;
  const deviceId = "bmw-test";

  beforeEach(() => {
    store = new BMWCarLearnedPlacesStore(new FakeDatabaseManager() as never);
  });

  it("legt einen neuen Ort an, wenn keiner in Reichweite ist", () => {
    const place = store.registerObservation(deviceId, 48.2, 11.6, "business", "Büro");
    expect(place?.category).toBe("business");
    expect(place?.samples.business).toBe(1);
    expect(store.getAll(deviceId).length).toBe(1);
  });

  it("aggregiert weitere Beobachtungen im gleichen Cluster", () => {
    store.registerObservation(deviceId, 48.2, 11.6, "business");
    const second = store.registerObservation(deviceId, 48.2001, 11.6001, "business");
    expect(store.getAll(deviceId).length).toBe(1);
    expect(second?.samples.business).toBe(2);
  });

  it("Mehrheitsvotum entscheidet bei widersprüchlichen Kategorien", () => {
    store.registerObservation(deviceId, 48.2, 11.6, "business");
    store.registerObservation(deviceId, 48.2, 11.6, "business");
    const third = store.registerObservation(deviceId, 48.2, 11.6, "private");
    expect(third?.category).toBe("business");
    expect(third?.samples).toEqual({ business: 2, private: 1 });
  });

  it("findNearest liefert Treffer im Radius", () => {
    store.registerObservation(deviceId, 48.2, 11.6, "business");
    const hit = store.findNearest(deviceId, 48.2002, 11.6002);
    expect(hit?.category).toBe("business");
  });

  it("findNearest liefert keinen Treffer ausserhalb des Radius", () => {
    store.registerObservation(deviceId, 48.2, 11.6, "business");
    const miss = store.findNearest(deviceId, 48.3, 11.7);
    expect(miss).toBeUndefined();
  });

  it("retractObservation entfernt einen Cluster vollständig, wenn der letzte Sample weg ist", () => {
    store.registerObservation(deviceId, 48.2, 11.6, "business");
    store.retractObservation(deviceId, 48.2, 11.6, "business");
    expect(store.getAll(deviceId).length).toBe(0);
  });

  it("retractObservation dekrementiert nur, wenn weitere Samples vorhanden", () => {
    store.registerObservation(deviceId, 48.2, 11.6, "business");
    store.registerObservation(deviceId, 48.2, 11.6, "business");
    store.retractObservation(deviceId, 48.2, 11.6, "business");
    const remaining = store.getAll(deviceId);
    expect(remaining.length).toBe(1);
    expect(remaining[0].samples.business).toBe(1);
  });

  it("ignoriert ungültige Koordinaten", () => {
    const result = store.registerObservation(deviceId, 0, 0, "business");
    expect(result).toBeNull();
    expect(store.getAll(deviceId).length).toBe(0);
  });
});
