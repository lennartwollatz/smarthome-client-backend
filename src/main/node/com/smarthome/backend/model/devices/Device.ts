import { DeviceType } from "./helper/DeviceType.js";
import { EventManager } from "../../server/events/EventManager.js";

export class Device {
  protected eventManager?: EventManager;

  id!: string;
  name?: string;
  room?: string;
  type?: DeviceType;
  moduleId?: string;
  isConnected: boolean = false;
  isConnecting: boolean = false;
  isPairingMode: boolean = false;
  hasBattery: boolean = false;
  batteryLevel: number = 0;
  quickAccess: boolean = false;

  /** LAN-IPv4 (z. B. bekannt nach Matter-Pairing), optional fuer Duplikat-Hinweise mit anderen Modulen. */
  lanIpv4?: string;

  constructor(init?: Partial<Device>) {
    if (init) {
      this.assignInit(init);
    }
  }

  protected assignInit(init?: Partial<Device>) {
    if (init) {
      Object.keys(init).forEach(key => {
        if (key in this) {
          // @ts-ignore
          this[key] = init[key as keyof Device];
        }
      });
    }
  }

  public setEventManager(eventManager: EventManager) {
    this.eventManager = eventManager;
  }

  public async updateValues(): Promise<void> {}


  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const excludeKeys = new Set(['eventManager', 'modules']);
    for (const key in this) {
      if (excludeKeys.has(key)) continue;
      const value = (this as Record<string, unknown>)[key];
      if (typeof value === 'function') continue;
      result[key] = value;
    }
    return result;
  }

  /** Millisekunden des Zeitpunkts oder `null` wenn nicht gesetzt/nicht parsebar. */
  protected timeStringToMiliseconds(time: string): number | null {
    if (time == null || time === "") return null;
    const ms = Date.parse(time);
    return Number.isNaN(ms) ? null : ms;
  }

  async delete(): Promise<void> {};
}
