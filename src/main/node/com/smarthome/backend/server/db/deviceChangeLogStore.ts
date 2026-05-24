import { randomUUID } from "node:crypto";
import type { DatabaseManager } from "./database.js";
import { JsonRepository } from "./jsonRepository.js";
import type {
  DeviceChangeField,
  DeviceChangeLogEntry,
  DeviceChangeLogQuery,
  DeviceChangeLogQueryResult
} from "../audit/deviceChangeLog.js";
import { EventSource } from "../events/EventSource.js";

const DEFAULT_RETENTION = 5_000;
const DEFAULT_LIMIT = 100;

export class DeviceChangeLogStore {
  private repo: JsonRepository<DeviceChangeLogEntry>;

  constructor(db: DatabaseManager) {
    this.repo = new JsonRepository<DeviceChangeLogEntry>(db, "DeviceChangeLog");
  }

  append(
    deviceId: string,
    deviceName: string,
    changes: DeviceChangeField[],
    source: EventSource = EventSource.SYSTEM,
    timestamp = Date.now()
  ): DeviceChangeLogEntry | null {
    if (!changes.length) return null;

    const entry: DeviceChangeLogEntry = {
      id: randomUUID(),
      deviceId,
      deviceName,
      timestamp,
      source,
      changes
    };
    this.repo.save(entry.id, entry);
    this.enforceRetention(DEFAULT_RETENTION);
    return entry;
  }

  query(query: DeviceChangeLogQuery = {}): DeviceChangeLogQueryResult {
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), 500);
    const offset = Math.max(query.offset ?? 0, 0);

    let items = this.repo.findAll();

    if (query.deviceId) {
      items = items.filter(e => e.deviceId === query.deviceId);
    }
    if (query.from != null) {
      items = items.filter(e => e.timestamp >= query.from!);
    }
    if (query.to != null) {
      items = items.filter(e => e.timestamp <= query.to!);
    }

    items.sort((a, b) => b.timestamp - a.timestamp);
    const total = items.length;
    const page = items.slice(offset, offset + limit);

    return { total, items: page };
  }

  clearAll(): void {
    const all = this.repo.findAll();
    for (const entry of all) {
      this.repo.deleteById(entry.id);
    }
  }

  private enforceRetention(max: number): void {
    const all = this.repo.findAll();
    if (all.length <= max) return;
    const sorted = all.sort((a, b) => a.timestamp - b.timestamp);
    const toDelete = sorted.slice(0, all.length - max);
    for (const entry of toDelete) {
      this.repo.deleteById(entry.id);
    }
  }
}
