import type { EventSource } from "../events/EventSource.js";

export interface DeviceChangeField {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface DeviceChangeLogEntry {
  id: string;
  deviceId: string;
  deviceName: string;
  timestamp: number;
  source: EventSource;
  changes: DeviceChangeField[];
}

export interface DeviceChangeLogQuery {
  deviceId?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

export interface DeviceChangeLogQueryResult {
  total: number;
  items: DeviceChangeLogEntry[];
}
