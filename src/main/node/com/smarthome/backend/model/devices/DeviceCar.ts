import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

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
  static TriggerFunctionName = {
    STATUS_CHANGED: "statusChanged",
    LOCKED: "locked",
    UNLOCKED: "unlocked",
    CLIMATE_CONTROL_STARTED: "climateControlStarted",
    CLIMATE_CONTROL_STOPPED: "climateControlStopped",
    LOCATION_CHANGED: "locationChanged",
    FUEL_LEVEL_CHANGED: "fuelLevelChanged"
  } as const;

  static ActionFunctionName = {
    START_CLIMATE_CONTROL: "startClimateControl",
    STOP_CLIMATE_CONTROL: "stopClimateControl",
    SEND_ADDRESS: "sendAddress(string,string,double,double)"
  } as const;

  static BoolFunctionName = {
    LOCKED: "locked",
    UNLOCKED: "unlocked",
    CLIMATE_CONTROL_ACTIVE: "climateControlActive",
    CLIMATE_CONTROL_INACTIVE: "climateControlInactive",
    IN_USE: "inUse",
    PARKED: "parked",
    DOORS_SECURED: "doorsSecured",
    WINDOWS_CLOSED: "windowsClosed",
    FUEL_LEVEL_GREATER: "fuelLevelGreater(int)",
    FUEL_LEVEL_LESS: "fuelLevelLess(int)",
    RANGE_GREATER: "rangeGreater(int)",
    RANGE_LESS: "rangeLess(int)"
  } as const;

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
    Object.assign(this, init);
    this.type = DeviceType.CAR;
    this.icon = "&#128663;";
    this.typeLabel = "deviceType.car";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  abstract updateValues(): Promise<void>;

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.LOCKED, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.UNLOCKED, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.CLIMATE_CONTROL_ACTIVE, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.CLIMATE_CONTROL_INACTIVE, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.IN_USE, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.PARKED, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.DOORS_SECURED, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.WINDOWS_CLOSED, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.FUEL_LEVEL_GREATER, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.FUEL_LEVEL_LESS, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.RANGE_GREATER, "bool"),
      DeviceFunction.fromString(DeviceCar.BoolFunctionName.RANGE_LESS, "bool")
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [
      DeviceFunction.fromString(DeviceCar.ActionFunctionName.START_CLIMATE_CONTROL, "void"),
      DeviceFunction.fromString(DeviceCar.ActionFunctionName.STOP_CLIMATE_CONTROL, "void"),
      DeviceFunction.fromString(DeviceCar.ActionFunctionName.SEND_ADDRESS, "void")
    ];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      DeviceFunction.fromString(DeviceCar.TriggerFunctionName.STATUS_CHANGED, "void"),
      DeviceFunction.fromString(DeviceCar.TriggerFunctionName.LOCKED, "void"),
      DeviceFunction.fromString(DeviceCar.TriggerFunctionName.UNLOCKED, "void"),
      DeviceFunction.fromString(DeviceCar.TriggerFunctionName.CLIMATE_CONTROL_STARTED, "void"),
      DeviceFunction.fromString(DeviceCar.TriggerFunctionName.CLIMATE_CONTROL_STOPPED, "void"),
      DeviceFunction.fromString(DeviceCar.TriggerFunctionName.LOCATION_CHANGED, "void"),
      DeviceFunction.fromString(DeviceCar.TriggerFunctionName.FUEL_LEVEL_CHANGED, "void")
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceCar.TriggerFunctionName).includes(
      triggerName as (typeof DeviceCar.TriggerFunctionName)[keyof typeof DeviceCar.TriggerFunctionName]
    );
    if (!isValid) return;

    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceCar.TriggerFunctionName.STATUS_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceCar.TriggerFunctionName.LOCKED && this.locked()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceCar.TriggerFunctionName.UNLOCKED && this.unlocked()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceCar.TriggerFunctionName.CLIMATE_CONTROL_STARTED && this.climateControlActive()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceCar.TriggerFunctionName.CLIMATE_CONTROL_STOPPED && this.climateControlInactive()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceCar.TriggerFunctionName.LOCATION_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceCar.TriggerFunctionName.FUEL_LEVEL_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
  }

  locked() {
    return this.lockedState === true;
  }

  unlocked() {
    return this.lockedState === false;
  }

  climateControlActive() {
    return this.climateControlState === true;
  }

  climateControlInactive() {
    return this.climateControlState === false;
  }

  inUse() {
    return this.inUseState === true;
  }

  parked() {
    return this.inUseState === false;
  }

  doorsSecured() {
    return this.doors?.combinedSecurityState === true;
  }

  windowsClosed() {
    return this.windows?.combinedState === true;
  }

  fuelLevelGreater(threshold: number) {
    return this.fuelLevelPercent != null && this.fuelLevelPercent > threshold;
  }

  fuelLevelLess(threshold: number) {
    return this.fuelLevelPercent != null && this.fuelLevelPercent < threshold;
  }

  rangeGreater(threshold: number) {
    return this.rangeKm != null && this.rangeKm > threshold;
  }

  rangeLess(threshold: number) {
    return this.rangeKm != null && this.rangeKm < threshold;
  }

  startClimateControl(execute: boolean) {
    this.climateControlState = true;
    if (execute) {
      this.executeStartClimateControl();
    }
    this.checkListener(DeviceCar.TriggerFunctionName.STATUS_CHANGED);
    this.checkListener(DeviceCar.TriggerFunctionName.CLIMATE_CONTROL_STARTED);
  }

  protected abstract executeStartClimateControl(): void;

  stopClimateControl(execute: boolean) {
    this.climateControlState = false;
    if (execute) {
      this.executeStopClimateControl();
    }
    this.checkListener(DeviceCar.TriggerFunctionName.STATUS_CHANGED);
    this.checkListener(DeviceCar.TriggerFunctionName.CLIMATE_CONTROL_STOPPED);
  }

  protected abstract executeStopClimateControl(): void;

  sendAddress(subject: string, address: DeviceCarAddress, execute: boolean) {
    if (execute) {
      this.executeSendAddress(subject, address);
    }
  }

  protected abstract executeSendAddress(subject: string, address: DeviceCarAddress): void;

  setLockedState(locked: boolean) {
    this.lockedState = locked;
    this.checkListener(DeviceCar.TriggerFunctionName.STATUS_CHANGED);
    this.checkListener(locked ? DeviceCar.TriggerFunctionName.LOCKED : DeviceCar.TriggerFunctionName.UNLOCKED);
  }

  setFuelLevelPercent(fuelLevelPercent: number) {
    this.fuelLevelPercent = fuelLevelPercent;
    this.checkListener(DeviceCar.TriggerFunctionName.STATUS_CHANGED);
    this.checkListener(DeviceCar.TriggerFunctionName.FUEL_LEVEL_CHANGED);
  }

  setLocation(location: DeviceCarAddress) {
    this.location = location;
    this.checkListener(DeviceCar.TriggerFunctionName.STATUS_CHANGED);
    this.checkListener(DeviceCar.TriggerFunctionName.LOCATION_CHANGED);
  }

  setWindows(windows: DeviceCarWindows) {
    this.windows = windows;
    this.checkListener(DeviceCar.TriggerFunctionName.STATUS_CHANGED);
  }

  setDoors(doors: DeviceCarDoors) {
    this.doors = doors;
    this.checkListener(DeviceCar.TriggerFunctionName.STATUS_CHANGED);
  }
}

