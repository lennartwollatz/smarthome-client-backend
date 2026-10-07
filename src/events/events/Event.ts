import { EventParameter } from "../event-types/EventParameter.js";
import { EventType } from "../event-types/EventType.js";
import { EventResult } from "../event-types/EventResult.js";
import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";

export abstract class Event {
    eventId: string;
    deviceId: string;
    timestamp: number;
    eventType: EventType;
    eventConditions: EventCondition[];
    eventParameters: EventParameter[];
    eventResults: EventResult[];

    constructor(eventId: string, deviceId: string, timestamp: number, eventType: EventType, eventConditions: EventCondition[], eventParameters: EventParameter[], eventResults:EventResult[]) {
        this.eventId = eventId;
        this.deviceId = deviceId;
        this.timestamp = timestamp;
        this.eventType = eventType;
        this.eventConditions = eventConditions;
        this.eventParameters = eventParameters;
        this.eventResults = eventResults;
    }

    public abstract matchesListener(listener: EventListener): boolean ;
}