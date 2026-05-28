import type { DatabaseManager } from "./database.js";
import { JsonRepository } from "./jsonRepository.js";
import type { EventLogEntry, EventLogQuery, EventLogQueryResult } from "../audit/eventLogEntry.js";
import { EventType } from "../events/event-types/EventType.js";

const DEFAULT_RETENTION = 5_000;
const DEFAULT_LIMIT = 100;
const TYPE_NAME = "EventLog";

export type CarMqttEventBounds = {
  fromMs: number;
  toMs: number;
  count: number;
};

export class EventLogStore {
  private repo: JsonRepository<EventLogEntry>;
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.repo = new JsonRepository<EventLogEntry>(db, TYPE_NAME);
  }

  append(entry: EventLogEntry): void {
    this.repo.save(entry.eventId, entry);
    this.enforceRetention(DEFAULT_RETENTION);
  }

  query(query: EventLogQuery = {}): EventLogQueryResult {
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), 500);
    const offset = Math.max(query.offset ?? 0, 0);

    const { where, params } = this.buildQueryFilters(query);
    const conn = this.db.createNewConnection();
    try {
      const countRow = conn
        .prepare(`SELECT COUNT(*) AS count FROM objects WHERE ${where}`)
        .get(...params) as { count: number } | undefined;
      const total = countRow?.count ?? 0;

      const rows = conn
        .prepare(
          `SELECT data FROM objects WHERE ${where}
           ORDER BY json_extract(data, '$.timestamp') DESC
           LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset) as { data: string }[];

      const items = rows.map(row => JSON.parse(row.data) as EventLogEntry);
      return { total, items };
    } finally {
      conn.close();
    }
  }

  /**
   * Zeitspanne aller CAR_MQTT_RECEIVED-Einträge für die Geräte-IDs (ein SQL-Scan).
   */
  findCarMqttBounds(deviceIds: string[]): CarMqttEventBounds | null {
    const ids = deviceIds.filter(Boolean);
    if (ids.length === 0) return null;

    const devicePlaceholders = ids.map(() => "?").join(", ");
    const params: unknown[] = [EventType.CAR_MQTT_RECEIVED, ...ids];
    const conn = this.db.createNewConnection();
    try {
      const row = conn
        .prepare(
          `SELECT
             MIN(json_extract(data, '$.timestamp')) AS fromMs,
             MAX(json_extract(data, '$.timestamp')) AS toMs,
             COUNT(*) AS count
           FROM objects
           WHERE type = ?
             AND json_extract(data, '$.eventType') = ?
             AND json_extract(data, '$.deviceId') IN (${devicePlaceholders})`
        )
        .get(TYPE_NAME, ...params) as { fromMs: number | null; toMs: number | null; count: number } | undefined;

      const count = row?.count ?? 0;
      const fromMs = row?.fromMs;
      const toMs = row?.toMs;
      if (
        count === 0 ||
        fromMs == null ||
        toMs == null ||
        !Number.isFinite(fromMs) ||
        !Number.isFinite(toMs)
      ) {
        return null;
      }
      return { fromMs, toMs, count };
    } finally {
      conn.close();
    }
  }

  clearAll(): void {
    const all = this.repo.findAll();
    for (const entry of all) {
      this.repo.deleteById(entry.eventId);
    }
  }

  private buildQueryFilters(query: EventLogQuery): { where: string; params: unknown[] } {
    const conditions = ["type = ?"];
    const params: unknown[] = [TYPE_NAME];

    if (query.deviceId) {
      conditions.push("json_extract(data, '$.deviceId') = ?");
      params.push(query.deviceId);
    }
    if (query.eventType) {
      conditions.push("json_extract(data, '$.eventType') = ?");
      params.push(query.eventType);
    }
    if (query.from != null) {
      conditions.push("json_extract(data, '$.timestamp') >= ?");
      params.push(query.from);
    }
    if (query.to != null) {
      conditions.push("json_extract(data, '$.timestamp') <= ?");
      params.push(query.to);
    }

    return { where: conditions.join(" AND "), params };
  }

  private enforceRetention(max: number): void {
    const all = this.repo.findAll();
    if (all.length <= max) return;
    const sorted = all.sort((a, b) => a.timestamp - b.timestamp);
    const toDelete = sorted.slice(0, all.length - max);
    for (const entry of toDelete) {
      this.repo.deleteById(entry.eventId);
    }
  }
}
