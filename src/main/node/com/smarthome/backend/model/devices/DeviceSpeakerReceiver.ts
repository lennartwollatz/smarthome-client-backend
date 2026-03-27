import { DeviceSpeaker } from "./DeviceSpeaker.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventSpeakerStatusChanged } from "../../server/events/events/EventSpeakerStatusChanged.js";
import { EventSubwooferLevelChanged } from "../../server/events/events/EventSubwooferLevelChanged.js";
import { EventSubwooferLevelEquals } from "../../server/events/events/EventSubwooferLevelEquals.js";
import { EventSubwooferLevelLess } from "../../server/events/events/EventSubwooferLevelLess.js";
import { EventSubwooferLevelGreater } from "../../server/events/events/EventSubwooferLevelGreater.js";
import { EventSubwooferPowerChanged } from "../../server/events/events/EventSubwooferPowerChanged.js";
import { EventSubwooferPowerOn } from "../../server/events/events/EventSubwooferPowerOn.js";
import { EventSubwooferPowerOff } from "../../server/events/events/EventSubwooferPowerOff.js";
import { EventSpeakerZonePowerChanged } from "../../server/events/events/EventSpeakerZonePowerChanged.js";
import { EventSpeakerZonePowerOn } from "../../server/events/events/EventSpeakerZonePowerOn.js";
import { EventSpeakerZonePowerOff } from "../../server/events/events/EventSpeakerZonePowerOff.js";
import { EventSpeakerSourceSet } from "../../server/events/events/EventSpeakerSourceSet.js";

export abstract class DeviceSpeakerReceiver extends DeviceSpeaker {
  zones?: Zone[];
  subwoofers?: Subwoofer[];
  volumeStart?: number;
  volumeMax?: number;
  sources?: Source[];

  constructor(init?: Partial<DeviceSpeakerReceiver>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.SPEAKER_RECEIVER;
  }

  getSubwoofers() {
    return this.subwoofers;
  }

  getSources() {
    return this.sources;
  }

  getZones() {
    return this.zones;
  }

  isSubwooferPowerOn(subwooferId: string) {
    return this.subwoofers?.find(subwoofer => subwoofer.id === subwooferId)?.power ?? false;
  }
  isSubwooferPowerOff(subwooferId: string) {
    const on = this.subwoofers?.find(subwoofer => subwoofer.id === subwooferId)?.power ?? false;
    return !on;
  }
  isAnySubwooferOn() {
    return this.subwoofers?.some(subwoofer => subwoofer.power) ?? false;
  }
  areAllSubwoofersOff() {
    return this.subwoofers?.every(subwoofer => !subwoofer.power) ?? true;
  }
  isSubwooferLevelGreater(subwooferId: string, level: number) {
    const db = this.subwoofers?.find(subwoofer => subwoofer.id === subwooferId)?.db ?? 0;
    return db > level;
  }
  isSubwooferLevelLess(subwooferId: string, level: number) {
    const db = this.subwoofers?.find(subwoofer => subwoofer.id === subwooferId)?.db ?? 0;
    return db < level;
  }
  isSubwooferLevelEquals(subwooferId: string, level: number) {
    const db = this.subwoofers?.find(subwoofer => subwoofer.id === subwooferId)?.db ?? 0;
    return db === level;
  }
  isZonePowerOn(zoneName: string) {
    return this.zones?.find(zone => zone.name === zoneName)?.power ?? false;
  }
  isZonePowerOff(zoneName: string) {
    return this.zones?.find(zone => zone.name === zoneName)?.power ?? false;
  }
  isAnyZoneOn() {
    return this.zones?.some(zone => zone.power) ?? false;
  }
  areAllZonesOff() {
    return this.zones?.every(zone => !zone.power) ?? true;
  }
  isSourceSelected(sourceIndex: string) {
    return this.sources?.find(source => source.index === sourceIndex)?.selected ?? false;
  }

  async setSubwooferLevel(subwooferId: string, level: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.subwoofers
      ?.find(subwoofer => subwoofer.id === subwooferId)
      ?.setDb(level);
    if (execute) {
      await this.executeSetSubwooferLevel(subwooferId, level);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSubwooferLevelChanged(this.id, deviceBefore, subwooferId, level));
      this.eventManager?.triggerEvent(new EventSubwooferLevelEquals(this.id, deviceBefore, subwooferId, level));
      this.eventManager?.triggerEvent(new EventSubwooferLevelLess(this.id, deviceBefore, subwooferId, level));
      this.eventManager?.triggerEvent(new EventSubwooferLevelGreater(this.id, deviceBefore, subwooferId, level));
    }
  }

  async setSubwooferLevelAll(level: number, execute: boolean, trigger: boolean = true) {
    for (const subwoofer of this.subwoofers ?? []) {
      await this.setSubwooferLevel(subwoofer.id ?? '', level, execute, trigger);
    }
  }

  protected abstract executeSetSubwooferLevel(subwooferId: string, level: number): Promise<void>;

  async setSubwooferPower(subwooferId: string, power: boolean, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.subwoofers
      ?.find(subwoofer => subwoofer.id === subwooferId)
      ?.setPower(power);
    if (execute) {
      await this.executeSetSubwooferPower(subwooferId, power);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSubwooferPowerChanged(this.id, deviceBefore, subwooferId, power));
      if (power) {
        this.eventManager?.triggerEvent(new EventSubwooferPowerOn(this.id, deviceBefore, subwooferId));
      } else {
        this.eventManager?.triggerEvent(new EventSubwooferPowerOff(this.id, deviceBefore, subwooferId));
      }
    }
  }

  async setSubwooferPowerOn(subwooferId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.subwoofers
      ?.find(subwoofer => subwoofer.id === subwooferId)
      ?.setPower(true);
    if (execute) {
      await this.executeSetSubwooferPower(subwooferId, true);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSubwooferPowerChanged(this.id, deviceBefore, subwooferId, true));
      this.eventManager?.triggerEvent(new EventSubwooferPowerOn(this.id, deviceBefore, subwooferId));
    }
  }

  async setSubwooferPowerOff(subwooferId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.subwoofers
      ?.find(subwoofer => subwoofer.id === subwooferId)
      ?.setPower(false);
    if (execute) {
      await this.executeSetSubwooferPower(subwooferId, false);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSubwooferPowerChanged(this.id, deviceBefore, subwooferId, false));
      this.eventManager?.triggerEvent(new EventSubwooferPowerOff(this.id, deviceBefore, subwooferId));
    }
  }

  async setSubwooferPowerAllOn(execute: boolean, trigger: boolean = true) {
    for (const subwoofer of this.subwoofers ?? []) {
      await this.setSubwooferPowerOn(subwoofer.id ?? '', execute, trigger);
    }
  }

  async setSubwooferPowerAllOff(execute: boolean, trigger: boolean = true) {
    for (const subwoofer of this.subwoofers ?? []) {
      await this.setSubwooferPowerOff(subwoofer.id ?? '', execute, trigger);
    }
  }

  protected abstract executeSetSubwooferPower(subwooferId: string, power: boolean): Promise<void>;

  async setVolumeStart(volumeStart: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.volumeStart = volumeStart;
    if (execute) {
      await this.executeSetVolumeStart(volumeStart);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetVolumeStart(volumeStart: number): Promise<void>;

  async setVolumeMax(volumeMax: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.volumeMax = volumeMax;
    if (execute) {
      await this.executeSetVolumeMax(volumeMax);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetVolumeMax(volumeMax: number): Promise<void>;

  async setZonePower(zoneName: string, power: boolean, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.zones?.find(zone => zone.name === zoneName)?.setPower(power);
    this.zones
      ?.filter(zone => zone.name !== zoneName)
      .forEach(zone => zone.setPower(false));
    if (execute) {
      await this.executeSetZonePower(zoneName, power);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSpeakerZonePowerChanged(this.id, deviceBefore, zoneName, power));
      if (power) {
        this.eventManager?.triggerEvent(new EventSpeakerZonePowerOn(this.id, deviceBefore, zoneName));
      } else {
        this.eventManager?.triggerEvent(new EventSpeakerZonePowerOff(this.id, deviceBefore, zoneName));
      }
    }
  }

  async setZonePowerOn(zoneName: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.zones?.find(zone => zone.name === zoneName)?.setPower(true);
    this.zones
      ?.filter(zone => zone.name !== zoneName)
      .forEach(zone => zone.setPower(false));
    if (execute) {
      await this.executeSetZonePower(zoneName, true);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSpeakerZonePowerChanged(this.id, deviceBefore, zoneName, true));
      this.eventManager?.triggerEvent(new EventSpeakerZonePowerOn(this.id, deviceBefore, zoneName));
    }
  }

  async setZonePowerOff(zoneName: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.zones?.find(zone => zone.name === zoneName)?.setPower(false);
    this.zones
      ?.filter(zone => zone.name !== zoneName)
      .forEach(zone => zone.setPower(false));
    if (execute) {
      await this.executeSetZonePower(zoneName, false);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSpeakerZonePowerChanged(this.id, deviceBefore, zoneName, false));
      this.eventManager?.triggerEvent(new EventSpeakerZonePowerOff(this.id, deviceBefore, zoneName));
    }
  }

  protected abstract executeSetZonePower(zoneName: string, power: boolean): Promise<void>;

  async setSource(sourceIndex: string, selected: boolean, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.sources
      ?.find(source => source.index === sourceIndex)
      ?.setSelected(selected);
    this.sources
      ?.filter(source => source.index !== sourceIndex)
      .forEach(source => source.setSelected(false));
    if (execute) {
      await this.executeSetSource(sourceIndex, selected);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSpeakerSourceSet(this.id, deviceBefore, sourceIndex));
    }
  }

  protected abstract executeSetSource(sourceIndex: string, selected: boolean): Promise<void>;
}

export class Source {
  index?: string;
  displayName?: string;
  selected?: boolean;

  constructor(index?: string, displayName?: string, selected?: boolean) {
    this.index = index;
    this.displayName = displayName;
    this.selected = selected;
  }

  getIndex() {
    return this.index;
  }

  setIndex(index: string) {
    this.index = index;
  }

  getDisplayName() {
    return this.displayName;
  }

  setDisplayName(displayName: string) {
    this.displayName = displayName;
  }

  getSelected() {
    return this.selected;
  }

  setSelected(selected: boolean) {
    this.selected = selected;
  }
}

export class Subwoofer {
  id?: string;
  name?: string;
  power?: boolean;
  db?: number;

  constructor(id?: string, name?: string, power?: boolean, db?: number) {
    this.id = id;
    this.name = name;
    this.power = power;
    this.db = db;
  }

  getId() {
    return this.id;
  }

  setId(id: string) {
    this.id = id;
  }

  getName() {
    return this.name;
  }

  setName(name: string) {
    this.name = name;
  }

  getPower() {
    return this.power;
  }

  setPower(power: boolean) {
    this.power = power;
  }

  getDb() {
    return this.db;
  }

  setDb(db: number) {
    this.db = db;
  }
}

export class Zone {
  name?: string;
  displayName?: string;
  power?: boolean;

  constructor(name?: string, displayName?: string, power?: boolean) {
    this.name = name;
    this.displayName = displayName;
    this.power = power;
  }

  getName() {
    return this.name;
  }

  setName(name: string) {
    this.name = name;
  }

  getDisplayName() {
    return this.displayName;
  }

  setDisplayName(displayName: string) {
    this.displayName = displayName;
  }

  getPower() {
    return this.power;
  }

  setPower(power: boolean) {
    this.power = power;
  }
}
