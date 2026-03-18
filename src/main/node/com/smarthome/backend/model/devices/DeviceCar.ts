import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventCarStatusChanged } from "../../server/events/events/EventCarStatusChanged.js";
import { EventCarClimateControlStarted } from "../../server/events/events/EventCarClimateControlStarted.js";
import { EventCarClimateControlChanged } from "../../server/events/events/EventCarClimateControlChanged.js";
import { EventCarClimateControlStopped } from "../../server/events/events/EventCarClimateControlStopped.js";
import { EventCarLockedStateLocked } from "../../server/events/events/EventCarLockedStateLocked.js";
import { EventCarLockedStateUnlocked } from "../../server/events/events/EventCarLockedStateUnlocked.js";
import { EventCarLockedStateChanged } from "../../server/events/events/EventCarLockedStateChanged.js";
import { EventCarFuelLevelChanged } from "../../server/events/events/EventCarFuelLevelChanged.js";
import { EventCarLocationChanged } from "../../server/events/events/EventCarLocationChanged.js";
import { EventCarWindowsChanged } from "../../server/events/events/EventCarWindowsChanged.js";
import { EventCarWindowsOpened } from "../../server/events/events/EventCarWindowsOpened.js";
import { EventCarWindowsClosed } from "../../server/events/events/EventCarWindowsClosed.js";
import { EventCarDoorsChanged } from "../../server/events/events/EventCarDoorsChanged.js";
import { EventCarDoorsOpened } from "../../server/events/events/EventCarDoorsOpened.js";
import { EventCarDoorsClosed } from "../../server/events/events/EventCarDoorsClosed.js";

export interface DeviceCarCoordinates {
  latitude: number;
  longitude: number;
}

export interface DeviceCarAddress {
  coordinates: DeviceCarCoordinates;
  name: string;
}

export interface DeviceCarWindows {
  leftFront: boolean;
  leftRear: boolean;
  rightFront: boolean;
  rightRear: boolean;
  combinedState: boolean;
}

export interface DeviceCarDoors {
  combinedSecurityState: boolean;
  leftFront: boolean;
  leftRear: boolean;
  rightFront: boolean;
  rightRear: boolean;
  combinedState: boolean;
  hood: boolean;
  trunk: boolean;
}

export abstract class DeviceCar extends Device {
  vin?: string;
  fuelLevelPercent?: number;
  rangeKm?: number;
  mileageKm?: number;
  lockedState?: boolean;
  inUseState?: boolean;
  climateControlState?: boolean;
  location?: DeviceCarAddress;
  windows?: DeviceCarWindows;
  doors?: DeviceCarDoors;

  constructor(init?: Partial<DeviceCar>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.CAR;
  }

  abstract updateValues(): Promise<void>;


  async startClimateControl(execute: boolean, trigger: boolean = true) {
    let carBefore = { ...this };
    this.climateControlState = true;
    if (execute) {
      await this.executeStartClimateControl();
    }
    if( trigger ){
      this.eventManager?.triggerEvent(new EventCarStatusChanged(this.id, carBefore, {...this}));
      this.eventManager?.triggerEvent(new EventCarClimateControlStarted(this.id, carBefore));
      this.eventManager?.triggerEvent(new EventCarClimateControlChanged(this.id, carBefore, true));
    }
  }

  protected abstract executeStartClimateControl(): Promise<void>;

  async stopClimateControl(execute: boolean, trigger: boolean = true) {
    let carBefore = { ...this };
    this.climateControlState = false;
    if (execute) {
      await this.executeStopClimateControl();
    }
    if( trigger ){
      this.eventManager?.triggerEvent(new EventCarStatusChanged(this.id, carBefore, {...this}));
      this.eventManager?.triggerEvent(new EventCarClimateControlStopped(this.id, carBefore));
      this.eventManager?.triggerEvent(new EventCarClimateControlChanged(this.id, carBefore, false));
    }
  }

  protected abstract executeStopClimateControl(): Promise<void>;

  async sendAddress(subject: string, address: DeviceCarAddress, execute: boolean) {
    if (execute) {
      await this.executeSendAddress(subject, address);
    }
  }

  protected abstract executeSendAddress(subject: string, address: DeviceCarAddress): Promise<void>;

  async setLockedState(locked: boolean, trigger: boolean = true) {
    let carBefore = { ...this };
    this.lockedState = locked;
    if( trigger ){
      this.eventManager?.triggerEvent(new EventCarStatusChanged(this.id, carBefore, {...this}));
      this.eventManager?.triggerEvent(locked ? new EventCarLockedStateLocked(this.id, carBefore) : new EventCarLockedStateUnlocked(this.id, carBefore));
      this.eventManager?.triggerEvent(new EventCarLockedStateChanged(this.id, carBefore, locked));
    }
  }

  async setFuelLevelPercent(fuelLevelPercent: number, trigger: boolean = true) {
    let carBefore = { ...this };
    this.fuelLevelPercent = fuelLevelPercent;
    if( trigger ){
      this.eventManager?.triggerEvent(new EventCarStatusChanged(this.id, carBefore, {...this}));
      this.eventManager?.triggerEvent(new EventCarFuelLevelChanged(this.id, carBefore, fuelLevelPercent));
    }
  }

  async setLocation(location: DeviceCarAddress, trigger: boolean = true) {
    let carBefore = { ...this };
    this.location = location;
    if( trigger ){
      this.eventManager?.triggerEvent(new EventCarStatusChanged(this.id, carBefore, {...this}));
      this.eventManager?.triggerEvent(new EventCarLocationChanged(this.id, carBefore, location));
    }
  }

  async setWindows(windows: DeviceCarWindows, trigger: boolean = true) {
    let carBefore = { ...this };
    this.windows = windows;
    if( trigger ){
      this.eventManager?.triggerEvent(new EventCarStatusChanged(this.id, carBefore, {...this}));
      this.eventManager?.triggerEvent(new EventCarWindowsChanged(this.id, carBefore, windows));
      this.eventManager?.triggerEvent(windows.combinedState ? new EventCarWindowsOpened(this.id, carBefore, windows) : new EventCarWindowsClosed(this.id, carBefore, windows));
    }
  }

  async setDoors(doors: DeviceCarDoors, trigger: boolean = true) {
    let carBefore = { ...this };
    this.doors = doors;
    if( trigger ){
      this.eventManager?.triggerEvent(new EventCarStatusChanged(this.id, carBefore, {...this}));
      this.eventManager?.triggerEvent(new EventCarDoorsChanged(this.id, carBefore, doors));
      this.eventManager?.triggerEvent(doors.combinedState ? new EventCarDoorsOpened(this.id, carBefore, doors) : new EventCarDoorsClosed(this.id, carBefore, doors));
    }
  }
}

