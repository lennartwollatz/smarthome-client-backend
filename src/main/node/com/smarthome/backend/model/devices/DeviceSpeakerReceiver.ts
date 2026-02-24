import { DeviceSpeaker } from "./DeviceSpeaker.js";
import { DeviceType } from "./helper/DeviceType.js";

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
    this.icon = "&#128266;";
    this.typeLabel = "deviceType.speaker-receiver";
  }

  getSubwoofers() {
    return this.subwoofers;
  }

  getSources() {
    return this.sources;
  }

  setSubwooferLevel(subwooferName: string, level: number, execute: boolean) {
    this.subwoofers
      ?.find(subwoofer => subwoofer.name === subwooferName)
      ?.setDb(level);
    if (execute) {
      this.executeSetSubwooferLevel(subwooferName, level);
    }
  }

  protected abstract executeSetSubwooferLevel(subwooferName: string, level: number): void;

  setSubwooferPower(subwooferName: string, power: boolean, execute: boolean) {
    this.subwoofers
      ?.find(subwoofer => subwoofer.name === subwooferName)
      ?.setPower(power);
    if (execute) {
      this.executeSetSubwooferPower(subwooferName, power);
    }
  }

  protected abstract executeSetSubwooferPower(subwooferName: string, power: boolean): void;

  setVolumeStart(volumeStart: number, execute: boolean) {
    this.volumeStart = volumeStart;
    if (execute) {
      this.executeSetVolumeStart(volumeStart);
    }
  }

  protected abstract executeSetVolumeStart(volumeStart: number): void;

  setVolumeMax(volumeMax: number, execute: boolean) {
    this.volumeMax = volumeMax;
    if (execute) {
      this.executeSetVolumeMax(volumeMax);
    }
  }

  protected abstract executeSetVolumeMax(volumeMax: number): void;

  setZonePower(zoneName: string, power: boolean, execute: boolean) {
    this.zones?.find(zone => zone.name === zoneName)?.setPower(power);
    this.zones
      ?.filter(zone => zone.name !== zoneName)
      .forEach(zone => zone.setPower(false));
    if (execute) {
      this.executeSetZonePower(zoneName, power);
    }
  }

  protected abstract executeSetZonePower(zoneName: string, power: boolean): void;

  setSource(sourceIndex: string, selected: boolean, execute: boolean) {
    this.sources
      ?.find(source => source.index === sourceIndex)
      ?.setSelected(selected);
    this.sources
      ?.filter(source => source.index !== sourceIndex)
      .forEach(source => source.setSelected(false));
    if (execute) {
      this.executeSetSource(sourceIndex, selected);
    }
  }

  protected abstract executeSetSource(sourceIndex: string, selected: boolean): void;

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
