import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventPowerToggled } from "../../events/events/EventPowerToggled.js";
import { EventVacuumStatusChanged } from "../../events/events/EventVacuumStatusChanged.js";
import { EventVacuumCleaningStarted } from "../../events/events/EventVacuumCleaningStarted.js";
import { EventVacuumCleaningStopped } from "../../events/events/EventVacuumCleaningStopped.js";
import { EventVacuumCleaningPaused } from "../../events/events/EventVacuumCleaningPaused.js";
import { EventVacuumCleaningResumed } from "../../events/events/EventVacuumCleaningResumed.js";
import { EventVacuumDocked } from "../../events/events/EventVacuumDocked.js";
import { EventVacuumUndocked } from "../../events/events/EventVacuumUndocked.js";
import { EventVacuumRoomEntered } from "../../events/events/EventVacuumRoomEntered.js";
import { EventVacuumRoomLeft } from "../../events/events/EventVacuumRoomLeft.js";
import { EventVacuumRoomCleaned } from "../../events/events/EventVacuumRoomCleaned.js";
import { EventVacuumZoneEntered } from "../../events/events/EventVacuumZoneEntered.js";
import { EventVacuumZoneLeft } from "../../events/events/EventVacuumZoneLeft.js";
import { EventVacuumZoneCleaned } from "../../events/events/EventVacuumZoneCleaned.js";
import { EventVacuumWaterBoxFull } from "../../events/events/EventVacuumWaterBoxFull.js";
import { EventVacuumWaterBoxEmpty } from "../../events/events/EventVacuumWaterBoxEmpty.js";
import { EventVacuumWaterBoxLevelChanged } from "../../events/events/EventVacuumWaterBoxLevelChanged.js";
import { EventVacuumWaterBoxLevelEquals } from "../../events/events/EventVacuumWaterBoxLevelEquals.js";
import { EventVacuumWaterBoxLevelLess } from "../../events/events/EventVacuumWaterBoxLevelLess.js";
import { EventVacuumWaterBoxLevelGreater } from "../../events/events/EventVacuumWaterBoxLevelGreater.js";
import { EventVacuumDirtyWaterBoxFull } from "../../events/events/EventVacuumDirtyWaterBoxFull.js";
import { EventVacuumDirtyWaterBoxEmpty } from "../../events/events/EventVacuumDirtyWaterBoxEmpty.js";
import { EventVacuumDirtyWaterBoxLevelChanged } from "../../events/events/EventVacuumDirtyWaterBoxLevelChanged.js";
import { EventVacuumDirtyWaterBoxLevelEquals } from "../../events/events/EventVacuumDirtyWaterBoxLevelEquals.js";
import { EventVacuumDirtyWaterBoxLevelLess } from "../../events/events/EventVacuumDirtyWaterBoxLevelLess.js";
import { EventVacuumDirtyWaterBoxLevelGreater } from "../../events/events/EventVacuumDirtyWaterBoxLevelGreater.js";
import { EventVacuumBatteryChanged } from "../../events/events/EventVacuumBatteryChanged.js";
import { EventVacuumBatteryEquals } from "../../events/events/EventVacuumBatteryEquals.js";
import { EventVacuumBatteryLess } from "../../events/events/EventVacuumBatteryLess.js";
import { EventVacuumBatteryGreater } from "../../events/events/EventVacuumBatteryGreater.js";
import { EventVacuumModeChanged } from "../../events/events/EventVacuumModeChanged.js";
import { EventVacuumModeEquals } from "../../events/events/EventVacuumModeEquals.js";
import { EventFanSpeedChanged } from "../../events/events/EventFanSpeedChanged.js";
import { EventFanSpeedEquals } from "../../events/events/EventFanSpeedEquals.js";
import { EventFanSpeedLess } from "../../events/events/EventFanSpeedLess.js";
import { EventFanSpeedGreater } from "../../events/events/EventFanSpeedGreater.js";
import { EventError } from "../../events/events/EventError.js";

/** [x1, y1, x2, y2, repeat_count] – Koordinaten in mm, repeat_count = Durchläufe */
export type ZoneDefinition = [number, number, number, number, number];

export abstract class DeviceVacuumCleaner extends Device {
  power?: boolean;
  cleaningState?: boolean;
  dockedState?: boolean;
  battery?: number;
  fanSpeed?: number;
  waterBoxLevel?: number;
  dirtyWaterBoxLevel?: number;
  currentRoom?: string;
  currentZone?: string;
  waterBoxFullState?: boolean;
  dirtyWaterBoxFullState?: boolean;
  mode?: string;
  error?: string;

  constructor(init?: Partial<DeviceVacuumCleaner>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.VACUUM;
  }

  abstract updateValues(): Promise<void>;


  async setPower(power: boolean, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.power = power;
    if (execute) {
      await this.executeSetPower(power);
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventPowerToggled(this.id, power));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetPower(power: boolean): Promise<void>;

  async startCleaning(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.cleaningState = true;
    this.power = true;
    if (execute) {
      await this.executeStartCleaning();
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVacuumCleaningStarted(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStartCleaning(): Promise<void>;

  async stopCleaning(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.cleaningState = false;
    if (execute) {
      await this.executeStopCleaning();
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVacuumCleaningStopped(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStopCleaning(): Promise<void>;

  async pauseCleaning(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.cleaningState = false;
    if (execute) {
      await this.executePauseCleaning();
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVacuumCleaningPaused(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executePauseCleaning(): Promise<void>;

  async resumeCleaning(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.cleaningState = true;
    this.dockedState = false;
    if (execute) {
      await this.executeResumeCleaning();
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVacuumCleaningResumed(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeResumeCleaning(): Promise<void>;

  async dock(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    if (execute) {
      await this.executeDock();
    }
    if (trigger && execute) {
      await this.eventManager?.triggerEvent(new EventVacuumDocked(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }
  protected abstract executeDock(): Promise<void>;

  async cleanRoom(roomId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.power = true;
    if (execute) {
      await this.executeCleanRoom(roomId);
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeCleanRoom(roomId: string): Promise<void>;

  /** Zone: [x1, y1, x2, y2, repeat_count] in mm */
  async cleanZones(zones: ZoneDefinition[], execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.power = true;
    if (execute) {
      await this.executeCleanZones(zones);
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeCleanZones(zones: ZoneDefinition[]): Promise<void>;

  async changeFanSpeed(fanSpeed: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.fanSpeed = fanSpeed;
    if (execute) {
      await this.executeChangeFanSpeed(fanSpeed);
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventFanSpeedChanged(this.id, deviceBefore, fanSpeed));
      await this.eventManager?.triggerEvent(new EventFanSpeedEquals(this.id, deviceBefore, fanSpeed));
      await this.eventManager?.triggerEvent(new EventFanSpeedLess(this.id, deviceBefore, fanSpeed));
      await this.eventManager?.triggerEvent(new EventFanSpeedGreater(this.id, deviceBefore, fanSpeed));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeChangeFanSpeed(fanSpeed: number): Promise<void>;

  async changeWaterBoxLevel(waterBoxLevel: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.waterBoxLevel = waterBoxLevel;
    if (execute) {
      await this.executeChangeWaterBoxLevel(waterBoxLevel);
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelChanged(this.id, deviceBefore, waterBoxLevel));
      await this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelEquals(this.id, deviceBefore, waterBoxLevel));
      await this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelLess(this.id, deviceBefore, waterBoxLevel));
      await this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelGreater(this.id, deviceBefore, waterBoxLevel));
      if (waterBoxLevel >= 100) await this.eventManager?.triggerEvent(new EventVacuumWaterBoxFull(this.id, deviceBefore));
      if (waterBoxLevel <= 0) await this.eventManager?.triggerEvent(new EventVacuumWaterBoxEmpty(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeChangeWaterBoxLevel(waterBoxLevel: number): Promise<void>;

  async setBattery(battery: number, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.battery = battery;
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVacuumBatteryChanged(this.id, deviceBefore, battery));
      await this.eventManager?.triggerEvent(new EventVacuumBatteryEquals(this.id, deviceBefore, battery));
      await this.eventManager?.triggerEvent(new EventVacuumBatteryLess(this.id, deviceBefore, battery));
      await this.eventManager?.triggerEvent(new EventVacuumBatteryGreater(this.id, deviceBefore, battery));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setFanSpeed(fanSpeed: number, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.fanSpeed = fanSpeed;
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventFanSpeedChanged(this.id, deviceBefore, fanSpeed));
      await this.eventManager?.triggerEvent(new EventFanSpeedEquals(this.id, deviceBefore, fanSpeed));
      await this.eventManager?.triggerEvent(new EventFanSpeedLess(this.id, deviceBefore, fanSpeed));
      await this.eventManager?.triggerEvent(new EventFanSpeedGreater(this.id, deviceBefore, fanSpeed));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setWaterBoxLevel(waterBoxLevel: number, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.waterBoxLevel = waterBoxLevel;
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelChanged(this.id, deviceBefore, waterBoxLevel));
      await this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelEquals(this.id, deviceBefore, waterBoxLevel));
      await this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelLess(this.id, deviceBefore, waterBoxLevel));
      await this.eventManager?.triggerEvent(new EventVacuumWaterBoxLevelGreater(this.id, deviceBefore, waterBoxLevel));
      if (waterBoxLevel >= 100) await this.eventManager?.triggerEvent(new EventVacuumWaterBoxFull(this.id, deviceBefore));
      if (waterBoxLevel <= 0) await this.eventManager?.triggerEvent(new EventVacuumWaterBoxEmpty(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setDirtyWaterBoxLevel(dirtyWaterBoxLevel: number, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.dirtyWaterBoxLevel = dirtyWaterBoxLevel;
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxLevelChanged(this.id, deviceBefore, dirtyWaterBoxLevel));
      await this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxLevelEquals(this.id, deviceBefore, dirtyWaterBoxLevel));
      await this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxLevelLess(this.id, deviceBefore, dirtyWaterBoxLevel));
      await this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxLevelGreater(this.id, deviceBefore, dirtyWaterBoxLevel));
      if (dirtyWaterBoxLevel >= 100) await this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxFull(this.id, deviceBefore));
      if (dirtyWaterBoxLevel <= 0) await this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxEmpty(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setCurrentRoom(currentRoom: string, trigger: boolean = true) {
    const deviceBefore = { ...this };
    const previousRoom = this.currentRoom;
    this.currentRoom = currentRoom;
    if (trigger) {
      if (previousRoom) await this.eventManager?.triggerEvent(new EventVacuumRoomLeft(this.id, deviceBefore, previousRoom));
      if (currentRoom) await this.eventManager?.triggerEvent(new EventVacuumRoomEntered(this.id, deviceBefore, currentRoom));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setCurrentZone(currentZone: string, trigger: boolean = true) {
    const deviceBefore = { ...this };
    const previousZone = this.currentZone;
    this.currentZone = currentZone;
    if (trigger) {
      if (previousZone) await this.eventManager?.triggerEvent(new EventVacuumZoneLeft(this.id, deviceBefore, previousZone));
      if (currentZone) await this.eventManager?.triggerEvent(new EventVacuumZoneEntered(this.id, deviceBefore, currentZone));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setWaterBoxFull(waterBoxFull: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.waterBoxFullState = waterBoxFull;
    if (trigger) {
      if (waterBoxFull) await this.eventManager?.triggerEvent(new EventVacuumWaterBoxFull(this.id, deviceBefore));
      else await this.eventManager?.triggerEvent(new EventVacuumWaterBoxEmpty(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setDirtyWaterBoxFull(dirtyWaterBoxFull: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.dirtyWaterBoxFullState = dirtyWaterBoxFull;
    if (trigger) {
      if (dirtyWaterBoxFull) await this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxFull(this.id, deviceBefore));
      else await this.eventManager?.triggerEvent(new EventVacuumDirtyWaterBoxEmpty(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setDocked(docked: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.dockedState = docked;
    if (trigger) {
      if (docked) await this.eventManager?.triggerEvent(new EventVacuumDocked(this.id, deviceBefore));
      else await this.eventManager?.triggerEvent(new EventVacuumUndocked(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setCleaning(cleaning: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.cleaningState = cleaning;
    if (trigger) {
      if (cleaning) await this.eventManager?.triggerEvent(new EventVacuumCleaningStarted(this.id, deviceBefore));
      else await this.eventManager?.triggerEvent(new EventVacuumCleaningStopped(this.id, deviceBefore));
      await this.eventManager?.triggerEvent(new EventVacuumStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  async setError(error: string, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.error = error;
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventError(this.id, deviceBefore, error));
    }
  }

  async clearError(execute: boolean) {
    this.error = undefined;
    if (execute) {
      await this.executeClearError();
    }
  }

  protected abstract executeClearError(): Promise<void>;
}
