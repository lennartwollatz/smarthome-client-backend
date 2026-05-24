import type { Event } from "../events/events/Event.js";
import type { EventLogEntry } from "./eventLogEntry.js";

export function serializeEventForLog(event: Event): EventLogEntry {
  return {
    eventId: event.eventId,
    deviceId: event.deviceId,
    timestamp: event.timestamp,
    eventType: event.eventType,
    source: event.source,
    mlcollect: event.mlcollect,
    parameters: event.eventParameters.map(p => ({ name: p.name, value: p.value })),
    results: event.eventResults.map(r => ({ name: r.name, value: r.value }))
  };
}
