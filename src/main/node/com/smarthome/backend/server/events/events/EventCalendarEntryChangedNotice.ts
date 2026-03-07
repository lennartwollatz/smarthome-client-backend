import { DeviceCalendarEntry } from "../../../model/devices/DeviceCalendar.js";
import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventCalendarEntryChangedNotice extends Event{
    constructor(deviceId: string, entryBefore: DeviceCalendarEntry, notice: string, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "entry",
            type: "obj",
            value: entryBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "notice",
            type: "str",
            value: notice
        };
        super(eventId, deviceId, Date.now(), EventType.CALENDAR_ENTRY_CHANGED_NOTICE, [eventCondition], [], [resultCondition]);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
