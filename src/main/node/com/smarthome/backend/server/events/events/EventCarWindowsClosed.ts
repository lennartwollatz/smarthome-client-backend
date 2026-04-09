import type { DeviceCarWindows } from "../../../model/devices/DeviceCar.js";
import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventCarWindowsClosed extends Event{
    constructor(deviceId: string, carBefore: object, windows: DeviceCarWindows, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "car",
            type: "obj",
            value: carBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "windows",
            type: "obj",
            value: windows
        };
        super(eventId, deviceId, Date.now(), EventType.CAR_WINDOWS_CLOSED, [eventCondition], [], [resultCondition], true);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
