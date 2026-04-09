import type { DeviceCarAddress } from "../../../model/devices/DeviceCar.js";
import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventCarLocationChanged extends Event{
    constructor(deviceId: string, carBefore: object, location: DeviceCarAddress, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "car",
            type: "obj",
            value: carBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "location",
            type: "obj",
            value: location
        };
        super(eventId, deviceId, Date.now(), EventType.CAR_LOCATION_CHANGED, [eventCondition], [], [resultCondition], true);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
