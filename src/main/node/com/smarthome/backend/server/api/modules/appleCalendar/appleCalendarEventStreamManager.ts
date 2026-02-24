import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import type { AppleCalendarEvent } from "./appleCalendarEvent.js";
import { AppleCalendarDeviceController } from "./appleCalendarDeviceController.js";
import { DEFAULT_CALENDAR_MODULE_ID, DeviceCalendar } from "../../../../model/devices/DeviceCalendar.js";

/**
 * CalDAV hat i.d.R. kein Push/EventStream in diesem Backend.
 * Wir registrieren trotzdem einen Manager, damit das Modul "vollwertig" wie andere Module ist.
 */
export class AppleCalendarEventStreamManager extends ModuleEventStreamManager<AppleCalendarDeviceController, AppleCalendarEvent> {
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL_MS = 30_000;
  private isTickRunning = false;

  constructor(managerId: string, moduleId: string, controller: AppleCalendarDeviceController, actionManager: ActionManager) {
    super(managerId, moduleId, controller, actionManager);
  }

  protected async handleEvent(event: AppleCalendarEvent): Promise<void> {
    const device = this.actionManager.getDevice(event.deviceId);
    const calendarDevice = device as DeviceCalendar;
    const type = String(event.type ?? "").trim();
    switch(type) {
      case "cal-name-changed":
        if(event.calendarId && event.calendarName) {
          calendarDevice.setCalendarName(event.calendarId, event.calendarName);
          this.actionManager.saveDevice(calendarDevice);
        }
        break;
      case "cal-deleted":
        if(event.calendarId) {
          calendarDevice.removeCalendar(event.calendarId);
          this.actionManager.saveDevice(calendarDevice);
        }
        break;
      case "cal-added":
        if(event.calendar) {
          calendarDevice.setCalendar(event.calendar);
          this.actionManager.saveDevice(calendarDevice);
        }
        break;
      case "update-cal-entries":
        if(event.entries) {
          calendarDevice.setEntries(event.entries, event.calendarId);
          this.actionManager.saveDevice(calendarDevice);
        }
        break;
      default:
        break;
    }
  }

  protected async startEventStream(callback: (event: AppleCalendarEvent) => void): Promise<void> {
    await this.stopEventStream();
    await this.runPollingTick(callback);
    this.pollingInterval = setInterval(async () => {
      await this.runPollingTick(callback);
    }, this.POLLING_INTERVAL_MS);
  }

  protected async stopEventStream(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    const devices = this.actionManager.getDevicesForModule(DEFAULT_CALENDAR_MODULE_ID);
    for (const device of devices) {
      await this.controller.stopEventStream(device as DeviceCalendar);
    }
  }

  private async runPollingTick(callback: (event: AppleCalendarEvent) => void): Promise<void> {
    if (this.isTickRunning) return;
    this.isTickRunning = true;
    try {
      const devices = this.actionManager.getDevicesForModule(DEFAULT_CALENDAR_MODULE_ID);
      for (const device of devices) {
        await this.controller.stopEventStream(device as DeviceCalendar);
        await this.controller.startEventStream(device as DeviceCalendar, callback);
      }
    } finally {
      this.isTickRunning = false;
    }
  }
}
