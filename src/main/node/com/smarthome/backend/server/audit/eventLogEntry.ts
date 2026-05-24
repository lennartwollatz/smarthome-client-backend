import type { EventSource } from "../events/EventSource.js";

export interface EventLogParameter {
  name: string;
  value: unknown;
}

export interface EventLogResult {
  name: string;
  value: unknown;
}

export interface EventLogEntry {
  eventId: string;
  deviceId: string;
  timestamp: number;
  eventType: string;
  source: EventSource;
  mlcollect: boolean;
  parameters: EventLogParameter[];
  results: EventLogResult[];
}

export interface EventLogQuery {
  deviceId?: string;
  eventType?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

export interface EventLogQueryResult {
  total: number;
  items: EventLogEntry[];
}
