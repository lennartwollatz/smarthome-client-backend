import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import { EventListener } from "../EventListener.js";
import crypto from "crypto";

export class EventManual extends Event{
    constructor(actionId: string, eventId: string = crypto.randomUUID()) {
        super(eventId, actionId, Date.now(), EventType.MANUAL, [], [], []);
    }

    public matchesListener(listener: EventListener): boolean {
        return true;
    }
}