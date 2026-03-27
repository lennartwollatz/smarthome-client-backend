import type { ActionRunnable } from "../../api/entities/actions/runnable/ActionRunnable.js";
import { ActionRunnableEventBased } from "../../api/entities/actions/runnable/ActionRunnableEventBased.js";
import { EventParameter } from "../event-types/EventParameter.js";
import { EventType } from "../event-types/EventType.js";
import { EventResult } from "../event-types/EventResult.js";
import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";

/** Minimale Listener-Form ohne Zirkelbezug zu EventListener.ts */
export type TriggerListenerShape = { runnable: ActionRunnable };

function isEventParameter(x: unknown): x is EventParameter {
  return typeof x === "object" && x !== null && "value" in x;
}

/**
 * Erwartete Button-ID aus dem DeviceTrigger des Event-Runnables (z.B. Matter-Taste "1").
 * Fehlt triggerValues oder keine sinnvolle Angabe, wird nicht gefiltert (Rueckwaertskompatibel).
 */
export function getExpectedButtonIdFromListener(listener: TriggerListenerShape): string | undefined {
  if (listener.runnable.type !== "event") return undefined;
  const evt = (listener.runnable as ActionRunnableEventBased).event;
  const raw = evt?.triggerValues;
  if (!raw?.length) return undefined;

  const named = (raw as unknown[]).find(
    (p): p is EventParameter => isEventParameter(p) && p.name === "buttonId"
  );
  if (named != null && named.value !== "" && named.value !== undefined) {
    return String(named.value);
  }

  const first = raw[0];
  if (isEventParameter(first) && first.value !== "" && first.value !== undefined) {
    return String(first.value);
  }
  if (typeof first === "string" || typeof first === "number" || typeof first === "boolean") {
    return String(first);
  }
  return undefined;
}

export abstract class Event {
  eventId: string;
  deviceId: string;
  timestamp: number;
  eventType: EventType;
  eventConditions: EventCondition[];
  eventParameters: EventParameter[];
  eventResults: EventResult[];

  constructor(
    eventId: string,
    deviceId: string,
    timestamp: number,
    eventType: EventType,
    eventConditions: EventCondition[],
    eventParameters: EventParameter[],
    eventResults: EventResult[]
  ) {
    this.eventId = eventId;
    this.deviceId = deviceId;
    this.timestamp = timestamp;
    this.eventType = eventType;
    this.eventConditions = eventConditions;
    this.eventParameters = eventParameters;
    this.eventResults = eventResults;
  }

  public abstract matchesListener(listener: EventListener): boolean;
}

export function eventButtonIdMatchesListener(event: Event, listener: TriggerListenerShape): boolean {
  const expected = getExpectedButtonIdFromListener(listener);
  if (expected === undefined) return true;
  const actual = event.eventResults.find((r) => r.name === "buttonId")?.value;
  if (actual === undefined || actual === null) return false;
  return String(actual) === expected;
}
