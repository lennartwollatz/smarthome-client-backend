import { logger } from "../../logger.js";
import { EventListener } from "./EventListener.js";
import { Event } from "./events/Event.js";
import { EventType } from "./event-types/EventType.js";
import { EventLogger } from "./EventLogger.js";
import type { EventLogStore } from "../db/eventLogStore.js";
import { serializeEventForLog } from "../audit/eventSerializer.js";
import type { EventLogQuery, EventLogQueryResult } from "../audit/eventLogEntry.js";
import { ActionRunnable } from "../api/entities/actions/runnable/ActionRunnable.js";
import { ActionRunnableEventBased } from "../api/entities/actions/runnable/ActionRunnableEventBased.js";
import { ActionRunnableTimeBased } from "../api/entities/actions/runnable/ActionRunnableTimeBased.js";
import { getCurrentSource } from "./EventSource.js";

export class EventManager {
    private eventLogger: EventLogger;
    private eventLogStore?: EventLogStore;
    private listeners: Map<string, Map<EventType, EventListener[]>> = new Map();
    private onEventCallbacks: ((event: Event) => void)[] = [];

    constructor(eventLogStore?: EventLogStore) {
        this.eventLogger = new EventLogger();
        this.eventLogStore = eventLogStore;
    }

    public queryEventLog(query: EventLogQuery = {}): EventLogQueryResult {
        if (this.eventLogStore) {
            return this.eventLogStore.query(query);
        }
        const recent = this.eventLogger.getEventsLast10Minutes().map(serializeEventForLog);
        let items = recent;
        if (query.deviceId) items = items.filter(e => e.deviceId === query.deviceId);
        if (query.eventType) items = items.filter(e => e.eventType === query.eventType);
        if (query.from != null) items = items.filter(e => e.timestamp >= query.from!);
        if (query.to != null) items = items.filter(e => e.timestamp <= query.to!);
        items.sort((a, b) => b.timestamp - a.timestamp);
        const offset = Math.max(query.offset ?? 0, 0);
        const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
        return { total: items.length, items: items.slice(offset, offset + limit) };
    }

    public addOnEventCallback(callback: (event: Event) => void): void {
        this.onEventCallbacks.push(callback);
    }

    public addRunnable(runnable: ActionRunnable) {
        const deviceId = runnable.type === "manual" ? runnable.actionId : runnable.type === "time" ? runnable.actionId : (runnable as ActionRunnableEventBased).event?.triggerDeviceId ?? "";
        const eventType = runnable.type === "manual" ? EventType.MANUAL : runnable.type === "time" ? EventType.TIME : (runnable as ActionRunnableEventBased).event?.triggerEvent ?? EventType.MANUAL;
        const listener = new EventListener(runnable.id, deviceId, runnable);

        if(this.listeners.has(deviceId)){
            if(this.listeners.get(deviceId)?.has(eventType)){
                this.listeners.get(deviceId)?.get(eventType)?.push(listener);
            } else {
                this.listeners.get(deviceId)?.set(eventType, [listener]);
            }
        } else {
            this.listeners.set(deviceId, new Map());
            this.listeners.get(deviceId)?.set(eventType, [listener]);
        }
    }

    public removeRunnable(runnable: ActionRunnable) {
        if (runnable.type === "time") {
            (runnable as ActionRunnableTimeBased).stop();
        }
        const deviceId = runnable.type === "manual" ? runnable.actionId : runnable.type === "time" ? runnable.actionId : (runnable as ActionRunnableEventBased).event?.triggerDeviceId ?? "";
        const eventType = runnable.type === "manual" ? EventType.MANUAL : runnable.type === "time" ? EventType.TIME : (runnable as ActionRunnableEventBased).event?.triggerEvent ?? EventType.MANUAL;

        if (!this.listeners.has(deviceId)) {
            return;
        }
        if (!this.listeners.get(deviceId)?.has(eventType)) {
            return;
        }
        const index = this.listeners.get(deviceId)?.get(eventType)?.findIndex(l => l.listenerId === runnable.id) ?? -1;
        if (index !== -1) {
            this.listeners.get(deviceId)?.get(eventType)?.splice(index, 1);
        }
    }

    public getRunnable(actionId: string):ActionRunnable | undefined {
        return this.listeners.get(actionId)?.get(EventType.MANUAL)?.find(l => l.listenerId === actionId)?.runnable;
    }

    public hasRunnable(actionId: string):boolean {
        return (this.listeners.get(actionId)?.get(EventType.MANUAL)?.findIndex(l => l.listenerId === actionId) ?? -1) !== -1;
    }

    public removeAllRunnables() {
        for (const eventMap of this.listeners.values()) {
            for (const listenersArr of eventMap.values()) {
                for (const l of listenersArr) {
                    if (l.runnable.type === "time") {
                        (l.runnable as ActionRunnableTimeBased).stop();
                    }
                }
            }
        }
        this.listeners.clear();
    }

    public removeListenerForAction(actionId: string) {
        for (const eventMap of this.listeners.values()) {
            for (const listenersArr of eventMap.values()) {
                for (const l of listenersArr) {
                    if (l.runnable.actionId === actionId && l.runnable.type === "time") {
                        (l.runnable as ActionRunnableTimeBased).stop();
                    }
                }
            }
        }
        this.listeners.delete(actionId);
        // Entferne alle EventListener aus der Klassenvariable listeners, deren runnable.actionId === actionId
        for (const eventMap of this.listeners.values()) {
            for (const [eventType, listenersArr] of eventMap.entries()) {
                eventMap.set(
                    eventType,
                    listenersArr.filter(listener => listener.runnable.actionId !== actionId)
                );
            }
        }
    }

    public removeListenerForDevice(deviceId: string) {
        this.listeners.delete(deviceId);
    }

    removeListenerForScene(actionIds: string[]) {
        for (const actionId of actionIds) {
            this.removeListenerForAction(actionId);
        }
    }

    public removeListenerForDeviceAndEventType(deviceId: string, eventType: EventType) {
        this.listeners.get(deviceId)?.delete(eventType);
    }

    public async triggerEvent(event: Event) {
        event.source = getCurrentSource();
        this.eventLogger.log(event);
        try {
            this.eventLogStore?.append(serializeEventForLog(event));
        } catch {
            /* Persistenz-Fehler dürfen Events nicht blockieren */
        }
        for (const cb of this.onEventCallbacks) {
            try { cb(event); } catch { /* DataCollector-Fehler dürfen Events nicht blockieren */ }
        }
        const { deviceId, eventType } = event;

        if (!this.listeners.has(deviceId)) {
            logger.warn({ deviceId, eventType }, "EventManager: Kein Listener fuer deviceId");
            return;
        }
        const byDevice = this.listeners.get(deviceId)!;
        if (!byDevice.has(eventType)) {
            logger.warn({ deviceId, eventType }, "EventManager: Kein Listener fuer diesen Event-Typ");
            return;
        }
        const listeners = byDevice.get(eventType)!;
        for (const l of listeners) {
            l.checkedRun(event);
        }
    }
}