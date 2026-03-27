import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventPresenceStatusChanged } from "../../server/events/events/EventPresenceStatusChanged.js";
import { EventPresenceHome } from "../../server/events/events/EventPresenceHome.js";
import { EventPresenceHomeSince } from "../../server/events/events/EventPresenceHomeSince.js";
import { EventPresenceAway } from "../../server/events/events/EventPresenceAway.js";
import { EventPresenceAwaySince } from "../../server/events/events/EventPresenceAwaySince.js";

/**
 * Anzeige/Sensor-Gerät analog zu {@link DeviceLight}: `on` bedeutet anwesend (zuhause),
 * `off` abwesend. Es wird kein Aktuator aus der App heraus angesprochen – der Parameter
 * `execute` entspricht der Licht-API, hat hier aber keine Wirkung.
 */
export class DevicePresence extends Device {
  present: boolean;
  lastDetect: string;

  constructor(init?: Partial<DevicePresence>) {
    super(init);
    this.present = init?.present ?? false;
    this.lastDetect = init?.lastDetect ?? new Date().toISOString();
    this.type = DeviceType.PRESENCE;
  }

  isPresent(): boolean {
    return this.present;
  }

  isAbsent(): boolean {
    return !this.present;
  }

  isAbsentSince(minutes:number): boolean {
    if (this.present) {
      return false;
    }
    const t = this.timeStringToMiliseconds(this.lastDetect ?? '');
    if (t === null) return false;
    return Date.now() - t >= minutes * 60 * 1000;
  }

  isPresentSince(minutes:number): boolean {
    if (!this.present) {
      return false;
    }
    const t = this.timeStringToMiliseconds(this.lastDetect ?? '');
    if (t === null) return false;
    return Date.now() - t >= minutes * 60 * 1000;
  }

  async setPresent(_execute: boolean, trigger: boolean = true): Promise<void> {
    const deviceBefore = { ...this };
    this.present = true;
    this.lastDetect = new Date().toISOString();
    if (trigger && this.eventManager) {
      this.eventManager.triggerEvent(new EventPresenceStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager.triggerEvent(new EventPresenceHomeSince(this.id, deviceBefore, this.lastDetect));
      this.eventManager.triggerEvent(new EventPresenceHome(this.id, deviceBefore));
    }
  }

  async setAbsent(_execute: boolean, trigger: boolean = true): Promise<void> {
    const deviceBefore = { ...this };
    this.present = false;
    this.lastDetect = new Date().toISOString();
    if (trigger && this.eventManager) {
      this.eventManager.triggerEvent(new EventPresenceStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager.triggerEvent(new EventPresenceAwaySince(this.id, deviceBefore, this.lastDetect));
      this.eventManager.triggerEvent(new EventPresenceAway(this.id, deviceBefore));
    }
  }


}
