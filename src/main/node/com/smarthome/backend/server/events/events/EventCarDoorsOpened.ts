import type { DeviceCarDoors } from "../../../model/devices/DeviceCar.js";
import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventCarDoorsOpened extends Event{
    constructor(deviceId: string, carBefore: object, doors: DeviceCarDoors, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "car",
            type: "obj",
            value: carBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "doors",
            type: "obj",
            value: doors
        };
        super(eventId, deviceId, Date.now(), EventType.CAR_DOORS_OPENED, [eventCondition], [], [resultCondition]);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
