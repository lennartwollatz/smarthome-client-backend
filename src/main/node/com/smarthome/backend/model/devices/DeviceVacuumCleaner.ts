import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventPowerToggled } from "../../server/events/events/EventPowerToggled.js";
import { EventVacuumStatusChanged } from "../../server/events/events/EventVacuumStatusChanged.js";
import { EventVacuumCleaningStarted } from "../../server/events/events/EventVacuumCleaningStarted.js";
import { EventVacuumCleaningStopped } from "../../server/events/events/EventVacuumCleaningStopped.js";
import { EventVacuumCleaningPaused } from "../../server/events/events/EventVacuumCleaningPaused.js";
import { EventVacuumCleaningResumed } from "../../server/events/events/EventVacuumCleaningResumed.js";
import { EventVacuumCleaningRoomStarted } from "../../server/events/events/EventVacuumCleaningRoomStarted.js";
import { EventVacuumCleaningRoomStopped } from "../../server/events/events/EventVacuumCleaningRoomStopped.js";
import { EventVacuumCleaningRoomPaused } from "../../server/events/events/EventVacuumCleaningRoomPaused.js";
import { EventVacuumCleaningRoomResumed } from "../../server/events/events/EventVacuumCleaningRoomResumed.js";
import { EventVacuumCleaningZonedStarted } from "../../server/events/events/EventVacuumCleaningZonedStarted.js";
import { EventVacuumCleaningZonedStopped } from "../../server/events/events/EventVacuumCleaningZonedStopped.js";
import { EventVacuumCleaningZonedPaused } from "../../server/events/events/EventVacuumCleaningZonedPaused.js";
import { EventVacuumCleaningZonedResumed } from "../../server/events/events/EventVacuumCleaningZonedResumed.js";
import { EventVacuumDocked } from "../../server/events/events/EventVacuumDocked.js";
import { EventVacuumRoomEntered } from "../../server/events/events/EventVacuumRoomEntered.js";
import { EventVacuumRoomLeft } from "../../server/events/events/EventVacuumRoomLeft.js";
import { EventVacuumZoneEntered } from "../../server/events/events/EventVacuumZoneEntered.js";
import { EventVacuumZoneLeft } from "../../server/events/events/EventVacuumZoneLeft.js";
import { EventVacuumWaterBoxFull } from "../../server/events/events/EventVacuumWaterBoxFull.js";
import { EventVacuumWaterBoxEmpty } from "../../server/events/events/EventVacuumWaterBoxEmpty.js";
import { EventVacuumWaterBoxLevelChanged } from "../../server/events/events/EventVacuumWaterBoxLevelChanged.js";
import { EventVacuumWaterBoxLevelEquals } from "../../server/events/events/EventVacuumWaterBoxLevelEquals.js";
import { EventVacuumWaterBoxLevelLess } from "../../server/events/events/EventVacuumWaterBoxLevelLess.js";
import { EventVacuumWaterBoxLevelGreater } from "../../server/events/events/EventVacuumWaterBoxLevelGreater.js";
import { EventVacuumDirtyWaterBoxFull } from "../../server/events/events/EventVacuumDirtyWaterBoxFull.js";
import { EventVacuumDirtyWaterBoxEmpty } from "../../server/events/events/EventVacuumDirtyWaterBoxEmpty.js";
import { EventVacuumDirtyWaterBoxLevelChanged } from "../../server/events/events/EventVacuumDirtyWaterBoxLevelChanged.js";
import { EventVacuumDirtyWaterBoxLevelEquals } from "../../server/events/events/EventVacuumDirtyWaterBoxLevelEquals.js";
import { EventVacuumDirtyWaterBoxLevelLess } from "../../server/events/events/EventVacuumDirtyWaterBoxLevelLess.js";
import { EventVacuumDirtyWaterBoxLevelGreater } from "../../server/events/events/EventVacuumDirtyWaterBoxLevelGreater.js";
import { EventVacuumBatteryChanged } from "../../server/events/events/EventVacuumBatteryChanged.js";
import { EventVacuumBatteryEquals } from "../../server/events/events/EventVacuumBatteryEquals.js";
import { EventVacuumBatteryLess } from "../../server/events/events/EventVacuumBatteryLess.js";
import { EventVacuumBatteryGreater } from "../../server/events/events/EventVacuumBatteryGreater.js";
import { EventFanSpeedChanged } from "../../server/events/events/EventFanSpeedChanged.js";
import { EventFanSpeedEquals } from "../../server/events/events/EventFanSpeedEquals.js";
import { EventFanSpeedLess } from "../../server/events/events/EventFanSpeedLess.js";
import { EventFanSpeedGreater } from "../../server/events/events/EventFanSpeedGreater.js";
import { EventVacuumUndocked } from "../../server/events/events/EventVacuumUndocked.js";
import { EventVacuumRepeatTimesChanged } from "../../server/events/events/EventVacuumRepeatTimesChanged.js";
import { EventVacuumRepeatTimesEquals } from "../../server/events/events/EventVacuumRepeatTimesEquals.js";
import { EventVacuumRepeatTimesLess } from "../../server/events/events/EventVacuumRepeatTimesLess.js";
import { EventVacuumRepeatTimesGreater } from "../../server/events/events/EventVacuumRepeatTimesGreater.js";
import { EventVacuumDustCollectionStarted } from "../../server/events/events/EventVacuumDustCollectionStarted.js";
import { EventVacuumDustCollectionStopped } from "../../server/events/events/EventVacuumDustCollectionStopped.js";
import { EventVacuumWashStarted } from "../../server/events/events/EventVacuumWashStarted.js";
import { EventVacuumWashStopped } from "../../server/events/events/EventVacuumWashStopped.js";
import { EventVacuumCleanSequenceChanged } from "../../server/events/events/EventVacuumCleanSequenceChanged.js";
import { EventVacuumCleaningModeChanged } from "../../server/events/events/EventVacuumCleaningModeChanged.js";
import { EventVacuumCleaningModeVacuum } from "../../server/events/events/EventVacuumCleaningModeVacuum.js";
import { EventVacuumCleaningModeWiper } from "../../server/events/events/EventVacuumCleaningModeWiper.js";
import { EventVacuumCleaningModeWiperVacuum } from "../../server/events/events/EventVacuumCleaningModeWiperVacuum.js";
import { EventVacuumWiperLevelChanged } from "../../server/events/events/EventVacuumWiperLevelChanged.js";
import { EventVacuumWiperLevelEquals } from "../../server/events/events/EventVacuumWiperLevelEquals.js";
import { EventVacuumWiperLevelLess } from "../../server/events/events/EventVacuumWiperLevelLess.js";
import { EventVacuumWiperLevelGreater } from "../../server/events/events/EventVacuumWiperLevelGreater.js";
import { EventVacuumCleaningIntensityChanged } from "../../server/events/events/EventVacuumCleaningIntensityChanged.js";
import { EventVacuumCleaningIntensityEquals } from "../../server/events/events/EventVacuumCleaningIntensityEquals.js";
import { EventVacuumCleaningIntensityLess } from "../../server/events/events/EventVacuumCleaningIntensityLess.js";
import { EventVacuumCleaningIntensityGreater } from "../../server/events/events/EventVacuumCleaningIntensityGreater.js";

/** [x1, y1, x2, y2, repeat_count] – Koordinaten in mm, repeat_count = Durchläufe */
export type ZoneDefinition = [number, number, number, number, number];
export interface Coordinate {
  x: number;
  y: number;
}


export enum DEVICE_MODE {
  SLEEPING = "sleeping",
  DOCKED = "docked",
  CLEANING = "cleaning",
  CLEANING_STOPPED = "cleaning_stopped",
  CLEANING_PAUSED = "cleaning_paused",
  CLEANING_ZONED = "cleaning_zoned",
  CLEANING_ZONED_STOPPED = "cleaning_zoned_stopped",
  CLEANING_ZONED_PAUSED = "cleaning_zoned_paused",
  CLEANING_ROOM = "cleaning_room",
  CLEANING_ROOM_STOPPED = "cleaning_room_stopped",
  CLEANING_ROOM_PAUSED = "cleaning_room_paused",
  DOCKING = "docking",
  UNDOCKING = "undocking",
}
export enum CLEANING_MODE {
  VACUUM_CLEANING = 1,
  WIPER_CLEANING = 2,
  WIPER_VACUUM_CLEANING = 3,
}

export enum CLEANING_INTENSITY {
  STANDARD = "standard",
  DEEP = "deep",
  DEEP_PLUS = "deep_plus",
  FAST = "fast",
}

export enum WIPER_INTENSITY {
  OFF = "off",
  LOW = "low",
  MIDDLE = "middle",
  HIGH = "high",
}

export enum VACUUM_INTENSITY {
  SILENT = 0,
  BALANCED = 1,
  TURBO = 2,
  MAX = 3,
  MAX_PLUS = 4,
}

export interface DockState {
  washing: boolean, 
  dustCollection: boolean,
  drying: boolean,
  waterBoxLevel: number;
  dirtyWaterBoxLevel: number;
}

export interface DeviceState {
  mode: DEVICE_MODE;
  cleaningMode: CLEANING_MODE;
  cleaningIntensity: CLEANING_INTENSITY;
  wiperIntensity: WIPER_INTENSITY;
  vacuumIntensity: VACUUM_INTENSITY;
  repeatTimes: number;
  currentRooms: string[];
  currentZones: ZoneDefinition[];
  currentRoom: string;
  currentLocation: Coordinate;
}

export interface Cleaning {
  startTime: Date;
  endTime: Date;
  duration: number;
  area: number;
  rooms: string[];
  zones: ZoneDefinition[];
  cleaningMode: CLEANING_MODE;
  cleaningIntensity: CLEANING_INTENSITY;
  wiperIntensity: WIPER_INTENSITY;
  vacuumIntensity: VACUUM_INTENSITY;
}

export type Cleanings =  Cleaning[];

export abstract class DeviceVacuumCleaner extends Device {
  deviceState: DeviceState = {
    mode: DEVICE_MODE.SLEEPING,
    cleaningMode: CLEANING_MODE.VACUUM_CLEANING,
    cleaningIntensity: CLEANING_INTENSITY.STANDARD,
    wiperIntensity: WIPER_INTENSITY.OFF,
    vacuumIntensity: VACUUM_INTENSITY.SILENT,
    repeatTimes: 1,
    currentRooms: [],
    currentZones: [],
    currentRoom: "",
    currentLocation: {x: 0, y: 0}
  };
  dockState: DockState = {
    washing: false,
    dustCollection: false,
    drying: false,
    waterBoxLevel: 0,
    dirtyWaterBoxLevel: 0,
  };
  cleanSequence: string[] = [];
  cleanings: Cleanings = [];
  error: string = "";
  /**
   * Schlüssel = Staubsauger-Raum-ID (z. B. aus get_room_mapping).
   * Wert.id = Grundriss-/Smarthome-Raum-ID (nicht an MiIO senden).
   * Wert.segmentId = die an MiIO zu sendende Segment-ID (immer gesetzt; i. d. R. identisch zum Schlüssel).
   */
  roomMapping: Record<string, { name: string; id: string; segmentId: string }> = {};

  constructor(init?: Partial<DeviceVacuumCleaner>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.VACUUM;
  }

  abstract updateValues(): Promise<void>;

  override toDatabaseJson(): Record<string, unknown> {
    return {
      ...super.toDatabaseJson(),
      mo: this.deviceState?.mode ?? 'sleeping',
      cm: this.deviceState?.cleaningMode ?? 0,
      ci: this.deviceState?.cleaningIntensity ?? 'standard',
      wi: this.deviceState?.wiperIntensity ?? 'off',
      vi: this.deviceState?.vacuumIntensity ?? 0,
      rt: this.deviceState?.repeatTimes ?? 1,
      cr: this.deviceState?.currentRooms ?? [],
      cz: this.deviceState?.currentZones ?? [],
      crm: this.deviceState?.currentRoom ?? '',
      cl: this.deviceState?.currentLocation ?? { x: 0, y: 0 },
      bl: this.batteryLevel ?? 0,
      ds: {
        w: this.dockState?.washing ? 1 : 0,
        dc: this.dockState?.dustCollection ? 1 : 0,
        dr: this.dockState?.drying ? 1 : 0,
        wl: this.dockState?.waterBoxLevel ?? 0,
        dwl: this.dockState?.dirtyWaterBoxLevel ?? 0,
      },
      cs: this.cleanSequence ?? [],
    };
  }

  isCleaning(): boolean {
    return this.deviceState.mode === DEVICE_MODE.CLEANING;
  }
  isDocked(): boolean {
    return this.deviceState.mode === DEVICE_MODE.DOCKED;
  }
  isUndocking(): boolean {
    return this.deviceState.mode === DEVICE_MODE.UNDOCKING;
  }
  isUndocked(): boolean {
    return ! this.isDocked();
  }
  isDocking(): boolean {
    return this.deviceState.mode === DEVICE_MODE.DOCKING;
  }
  isWaterBoxFull(): boolean {
    return this.dockState.waterBoxLevel === 100;
  }
  isDirtyWaterBoxFull(): boolean {
    return this.dockState.dirtyWaterBoxLevel === 100;
  }
  isWaterBoxEmpty(): boolean {
    return (this.dockState.waterBoxLevel ?? 0) === 0;
  }
  isDirtyWaterBoxEmpty(): boolean {
    return (this.dockState.dirtyWaterBoxLevel ?? 0) === 0;
  }
  isWaterBoxLevelGreater(waterBoxLevel: number): boolean {
    return (this.dockState.waterBoxLevel ?? 0) > waterBoxLevel;
  }
  isWaterBoxLevelLess(waterBoxLevel: number): boolean {
    return (this.dockState.waterBoxLevel ?? 0) < waterBoxLevel;
  }
  isWaterBoxLevelEquals(waterBoxLevel: number): boolean {
    return (this.dockState.waterBoxLevel ?? 0) === waterBoxLevel;
  }
  isDirtyWaterBoxLevelGreater(dirtyWaterBoxLevel: number): boolean {
    return (this.dockState.dirtyWaterBoxLevel ?? 0) > dirtyWaterBoxLevel;
  }
  isDirtyWaterBoxLevelLess(dirtyWaterBoxLevel: number): boolean {
    return (this.dockState.dirtyWaterBoxLevel ?? 0) < dirtyWaterBoxLevel;
  }
  isDirtyWaterBoxLevelEquals(dirtyWaterBoxLevel: number): boolean {
    return (this.dockState.dirtyWaterBoxLevel ?? 0) === dirtyWaterBoxLevel;
  }
  isBatteryLess(battery: number): boolean {
    return (this.batteryLevel ?? 0) < battery;
  }
  isBatteryGreater(battery: number): boolean {
    return (this.batteryLevel ?? 0) > battery;
  }
  isBatteryEquals(battery: number): boolean {
    return (this.batteryLevel ?? 0) === battery;
  }
  isFanSpeedGreater(fanSpeed: number): boolean {
    const fanSpeedCorrected = Math.max(0, Math.min(4, fanSpeed));
    return (this.deviceState.vacuumIntensity ?? VACUUM_INTENSITY.SILENT) > fanSpeedCorrected;
  }
  isFanSpeedLess(fanSpeed: number): boolean {
    const fanSpeedCorrected = Math.max(0, Math.min(4, fanSpeed));
    return (this.deviceState.vacuumIntensity ?? VACUUM_INTENSITY.SILENT) < fanSpeedCorrected;
  }
  isFanSpeedEquals(fanSpeed: number): boolean {
    const fanSpeedCorrected = Math.max(0, Math.min(4, fanSpeed));
    return (this.deviceState.vacuumIntensity ?? VACUUM_INTENSITY.SILENT) === fanSpeedCorrected;
  }

  isCleaningStopped(): boolean {
    return this.deviceState.mode === DEVICE_MODE.CLEANING_STOPPED || this.deviceState.mode === DEVICE_MODE.CLEANING_ZONED_STOPPED || this.deviceState.mode === DEVICE_MODE.CLEANING_ROOM_STOPPED;
  }
  isCleaningPaused(): boolean {
    return this.deviceState.mode === DEVICE_MODE.CLEANING_PAUSED || this.deviceState.mode === DEVICE_MODE.CLEANING_ZONED_PAUSED || this.deviceState.mode === DEVICE_MODE.CLEANING_ROOM_PAUSED;
  }

  async setPower(power: boolean, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState!.mode = power ? DEVICE_MODE.DOCKED : DEVICE_MODE.SLEEPING;
    if (execute) {
      await this.executeSetPower(power);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventPowerToggled(this.id, power));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetPower(power: boolean): Promise<void>;

  async startCleaning(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.CLEANING;
    if (execute) {
      await this.executeStartCleaning();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningStarted(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStartCleaning(): Promise<void>;

  async stopCleaning(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.CLEANING_STOPPED;
    if (execute) {
      await this.executeStopCleaning();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningStopped(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStopCleaning(): Promise<void>;

  async pauseCleaning(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    switch(this.deviceState.mode){
      case DEVICE_MODE.CLEANING_ZONED:
      case DEVICE_MODE.CLEANING_ZONED_STOPPED:
      case DEVICE_MODE.CLEANING_ZONED_PAUSED:
        this.deviceState.mode = DEVICE_MODE.CLEANING_ZONED_PAUSED;
        break;
      case DEVICE_MODE.CLEANING_ROOM:
      case DEVICE_MODE.CLEANING_ROOM_STOPPED:
      case DEVICE_MODE.CLEANING_ROOM_PAUSED:
        this.deviceState.mode = DEVICE_MODE.CLEANING_ROOM_PAUSED;
        break;
      default:
        this.deviceState.mode = DEVICE_MODE.CLEANING_PAUSED;
        break;
    }
    if (execute) {
      await this.executePauseCleaning();
    }
    if (trigger) {
      if( deviceBefore.deviceState.mode === DEVICE_MODE.CLEANING_ZONED ) {
        this.eventManager?.triggerEvent(new EventVacuumCleaningZonedPaused(this.id, deviceBefore));
        this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
      } else if( deviceBefore.deviceState.mode === DEVICE_MODE.CLEANING_ROOM ) {
        this.eventManager?.triggerEvent(new EventVacuumCleaningRoomPaused(this.id, deviceBefore));
        this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
      } else if( deviceBefore.deviceState.mode === DEVICE_MODE.CLEANING ) {
        this.eventManager?.triggerEvent(new EventVacuumCleaningPaused(this.id, deviceBefore));
        this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
      }
      
    }
  }

  protected abstract executePauseCleaning(): Promise<void>;

  async resumeCleaning(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.CLEANING;
    if (execute) {
      await this.executeResumeCleaning();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningResumed(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeResumeCleaning(): Promise<void>;

  async dock(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.DOCKING;
    if (execute) {
      await this.executeDock();
    }
    if (trigger && execute) {
      this.eventManager?.triggerEvent(new EventVacuumDocked(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeDock(): Promise<void>;


  protected resolveSegmentIdsForRoomCleaning(incomingRoomIds: string[]): string[] {
    const mapping = this.roomMapping;
    if( mapping == undefined || mapping == null ){
      return this.cleanSequence;
    }
    return incomingRoomIds.map((roomId) => {
      for(const [key, entry] of Object.entries(mapping)){
        if( entry.id === roomId || String(entry.segmentId) === String(roomId) || String(key) === String(roomId) ){
          return key;
        }
      }
      return undefined;
    }).filter((id)=> id !== undefined);
  }

  async startCleaningRoom(roomIds: string[], execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.CLEANING_ROOM;
    this.deviceState.currentRooms = roomIds;
    if (execute) {
      await this.executeStartCleaningRoom(roomIds);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningStarted(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumCleaningRoomStarted(this.id, deviceBefore, roomIds));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStartCleaningRoom(roomIds: string[]): Promise<void>;

  async stopCleaningRoom(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.CLEANING_ROOM_STOPPED;
    if (execute) {
      await this.executeStopCleaningRoom();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningStopped(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumCleaningRoomStopped(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStopCleaningRoom(): Promise<void>;

  async resumeCleaningRoom(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.CLEANING_ROOM;
    if (execute) {
      await this.executeResumeCleaningRoom();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningResumed(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumCleaningRoomResumed(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeResumeCleaningRoom(): Promise<void>;

  /** Zone: [x1, y1, x2, y2, repeat_count] in mm */
  async startCleaningZones(zones: ZoneDefinition[], execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.CLEANING_ZONED;
    this.deviceState.currentZones = zones;
    if (execute) {
      await this.executeStartCleaningZones(zones);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningStarted(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumCleaningZonedStarted(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStartCleaningZones(zones: ZoneDefinition[]): Promise<void>;
  
  async stopCleaningZones(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.CLEANING_ZONED_STOPPED;
    if (execute) {
      await this.executeStopCleaningZones();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningStopped(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumCleaningZonedStopped(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStopCleaningZones(): Promise<void>;

  async resumeCleaningZones(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.CLEANING_ZONED;
    if (execute) {
      await this.executeResumeCleaningZones();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningResumed(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumCleaningZonedResumed(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeResumeCleaningZones(): Promise<void>;

  /** 0 = Quiet, 1 = Balanced, 2 = Turbo, 3 = max, 4 = Max+ */
  async setFanSpeed(fanSpeed: number, execute: boolean, trigger: boolean = true) {
    const fanSpeedCorrected = Math.max(0, Math.min(4, fanSpeed));
    const deviceBefore = { ...this };
    this.deviceState.vacuumIntensity = fanSpeedCorrected;
    if (execute) {
      await this.executeSetFanSpeed(fanSpeedCorrected);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventFanSpeedChanged(this.id, deviceBefore, fanSpeedCorrected));
      this.eventManager?.triggerEvent(new EventFanSpeedEquals(this.id, deviceBefore, fanSpeedCorrected));
      this.eventManager?.triggerEvent(new EventFanSpeedLess(this.id, deviceBefore, fanSpeedCorrected));
      this.eventManager?.triggerEvent(new EventFanSpeedGreater(this.id, deviceBefore, fanSpeedCorrected));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetFanSpeed(fanSpeed: VACUUM_INTENSITY): Promise<void>;

  async setWiperLevel(wiperLevel: WIPER_INTENSITY, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.wiperIntensity = wiperLevel;
    if (execute) {
      await this.executeSetWiperLevel(wiperLevel);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumWiperLevelChanged(this.id, deviceBefore, wiperLevel));
      this.eventManager?.triggerEvent(new EventVacuumWiperLevelEquals(this.id, deviceBefore, wiperLevel));
      this.eventManager?.triggerEvent(new EventVacuumWiperLevelLess(this.id, deviceBefore, wiperLevel));
      this.eventManager?.triggerEvent(new EventVacuumWiperLevelGreater(this.id, deviceBefore, wiperLevel));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetWiperLevel(wiperLevel: WIPER_INTENSITY): Promise<void>;

  async setCleaningIntensity(cleaningIntensity: CLEANING_INTENSITY, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.cleaningIntensity = cleaningIntensity;
    if (execute) {
      await this.executeSetCleaningIntensity(cleaningIntensity);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningIntensityChanged(this.id, deviceBefore, cleaningIntensity));
      this.eventManager?.triggerEvent(new EventVacuumCleaningIntensityEquals(this.id, deviceBefore, cleaningIntensity));
      this.eventManager?.triggerEvent(new EventVacuumCleaningIntensityLess(this.id, deviceBefore, cleaningIntensity));
      this.eventManager?.triggerEvent(new EventVacuumCleaningIntensityGreater(this.id, deviceBefore, cleaningIntensity));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetCleaningIntensity(cleaningIntensity: CLEANING_INTENSITY): Promise<void>;

  async changeRepeatTimes(repeatTimes: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.repeatTimes = repeatTimes;
    if (execute) {
      await this.executeChangeRepeatTimes(repeatTimes);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumRepeatTimesChanged(this.id, deviceBefore, repeatTimes));
      this.eventManager?.triggerEvent(new EventVacuumRepeatTimesEquals(this.id, deviceBefore, repeatTimes));
      this.eventManager?.triggerEvent(new EventVacuumRepeatTimesLess(this.id, deviceBefore, repeatTimes));
      this.eventManager?.triggerEvent(new EventVacuumRepeatTimesGreater(this.id, deviceBefore, repeatTimes));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeChangeRepeatTimes(repeatTimes: number): Promise<void>;

  async startDustCollection(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.dockState.dustCollection = true;
    if (execute) {
      await this.executeStartDustCollection();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumDustCollectionStarted(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStartDustCollection(): Promise<void>;

  async stopDustCollection(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.dockState.dustCollection = false;
    if (execute) {
      await this.executeStopDustCollection();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumDustCollectionStopped(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStopDustCollection(): Promise<void>;

  async startWash(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.dockState.washing = true;
    if (execute) {
      await this.executeStartWash();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumWashStarted(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStartWash(): Promise<void>;
  
  async stopWash(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.dockState.washing = false;
    if (execute) {
      await this.executeStopWash();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumWashStopped(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStopWash(): Promise<void>;

  async setCleanSequence(cleanSequence: string[], execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.cleanSequence = cleanSequence;
    if (execute) {
      await this.executeSetCleanSequence(cleanSequence);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleanSequenceChanged(this.id, deviceBefore, cleanSequence));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetCleanSequence(cleanSequence: string[]): Promise<void>;

  /** 1= mop & vacuum, 2 = vacuum only, 3 = mop only */
  async setCleaningMode(cleaningMode: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.deviceState.cleaningMode = cleaningMode;
    if (execute) {
      await this.executeSetCleaningMode(cleaningMode);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumCleaningModeChanged(this.id, deviceBefore, cleaningMode));
      if(cleaningMode === CLEANING_MODE.VACUUM_CLEANING) {
        this.eventManager?.triggerEvent(new EventVacuumCleaningModeVacuum(this.id, deviceBefore, cleaningMode));
      } else if(cleaningMode === CLEANING_MODE.WIPER_CLEANING) {
        this.eventManager?.triggerEvent(new EventVacuumCleaningModeWiper(this.id, deviceBefore, cleaningMode));
      } else if(cleaningMode === CLEANING_MODE.WIPER_VACUUM_CLEANING) {
        this.eventManager?.triggerEvent(new EventVacuumCleaningModeWiperVacuum(this.id, deviceBefore, cleaningMode));
      }
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetCleaningMode(cleaningMode: number): Promise<void>;


  async setBattery(battery: number, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.batteryLevel = battery;
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumBatteryChanged(this.id, deviceBefore, battery));
      this.eventManager?.triggerEvent(new EventVacuumBatteryEquals(this.id, deviceBefore, battery));
      this.eventManager?.triggerEvent(new EventVacuumBatteryLess(this.id, deviceBefore, battery));
      this.eventManager?.triggerEvent(new EventVacuumBatteryGreater(this.id, deviceBefore, battery));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setWaterBoxLevel(waterBoxLevel: number, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.dockState.waterBoxLevel = waterBoxLevel;
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelChanged(this.id, deviceBefore, waterBoxLevel));
      this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelEquals(this.id, deviceBefore, waterBoxLevel));
      this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelLess(this.id, deviceBefore, waterBoxLevel));
      this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelGreater(this.id, deviceBefore, waterBoxLevel));
      if (waterBoxLevel >= 100) this.eventManager?.triggerEvent(new EventVacuumWaterBoxFull(this.id, deviceBefore));
      if (waterBoxLevel <= 0) this.eventManager?.triggerEvent(new EventVacuumWaterBoxEmpty(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setDirtyWaterBoxLevel(dirtyWaterBoxLevel: number, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.dockState.dirtyWaterBoxLevel = dirtyWaterBoxLevel;
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxLevelChanged(this.id, deviceBefore, dirtyWaterBoxLevel));
      this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxLevelEquals(this.id, deviceBefore, dirtyWaterBoxLevel));
      this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxLevelLess(this.id, deviceBefore, dirtyWaterBoxLevel));
      this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxLevelGreater(this.id, deviceBefore, dirtyWaterBoxLevel));
      if (dirtyWaterBoxLevel >= 100) this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxFull(this.id, deviceBefore));
      if (dirtyWaterBoxLevel <= 0) this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxEmpty(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setCurrentRoom(currentRoom: string, trigger: boolean = true) {
    const deviceBefore = { ...this };
    const previousRoom = this.deviceState.currentRoom;
    this.deviceState.currentRoom = currentRoom;
    if (trigger) {
      if (previousRoom) this.eventManager?.triggerEvent(new EventVacuumRoomLeft(this.id, deviceBefore, previousRoom));
      if (currentRoom) this.eventManager?.triggerEvent(new EventVacuumRoomEntered(this.id, deviceBefore, currentRoom));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setCurrentZone(currentZone: Coordinate, trigger: boolean = true) {
    const deviceBefore = { ...this };
    const previousZone = this.deviceState.currentLocation;
    this.deviceState.currentLocation = currentZone;
    if (trigger) {
      const hasLocation = (c: Coordinate) => c.x !== 0 || c.y !== 0;
      if (hasLocation(previousZone)) this.eventManager?.triggerEvent(new EventVacuumZoneLeft(this.id, deviceBefore, previousZone));
      if (hasLocation(currentZone)) this.eventManager?.triggerEvent(new EventVacuumZoneEntered(this.id, deviceBefore, currentZone));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setDocked(trigger: boolean = true){
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.DOCKED;
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumDocked(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setUndocking(trigger: boolean = true){
    const deviceBefore = { ...this };
    this.deviceState.mode = DEVICE_MODE.UNDOCKING;
    if (trigger) {
      this.eventManager?.triggerEvent(new EventVacuumUndocked(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async findMe(execute: boolean) {
    if (execute) {
      await this.executeFindMe();
    }
  }

  protected abstract executeFindMe(): Promise<void>;
}
