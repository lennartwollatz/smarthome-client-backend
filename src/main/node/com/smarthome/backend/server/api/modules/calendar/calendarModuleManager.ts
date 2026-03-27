import type { DatabaseManager } from "../../../db/database.js";
import type { EventManager } from "../../../events/EventManager.js";
import crypto from "node:crypto";
import { CALENDARCONFIG } from "./calendarModule.js";
import { CalendarDeviceController } from "./calendarDeviceController.js";
import { CalendarDeviceDiscover } from "./calendarDeviceDiscover.js";
import { CalendarEventStreamManager } from "./calendarEventStreamManager.js";
import { CalendarDeviceDiscovered } from "./calendarDeviceDiscovered.js";
import {
  type CalendarConfig,
  type CalendarSubModule,
  DEFAULT_CALENDAR_MODULE_ID,
  DeviceCalendar,
  type DeviceCalendarEntry,
} from "../../../../model/devices/DeviceCalendar.js";
import { Device } from "../../../../model/devices/Device.js";
import type { CalendarEvent } from "./calendarEvent.js";
import { ModuleManager } from "../moduleManager.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";

export const DEFAULT_CALENDAR_ID = "system-calendar";
export const DEFAULT_CALENDAR_NAME = "Systemkalender";

export class CalendarModuleManager extends ModuleManager<
  CalendarEventStreamManager,
  CalendarDeviceController,
  CalendarDeviceController,
  CalendarEvent,
  DeviceCalendar,
  CalendarDeviceDiscover,
  CalendarDeviceDiscovered
> implements CalendarSubModule {

  constructor(databaseManager: DatabaseManager, deviceManager: DeviceManager, eventManager: EventManager) {
    const deviceController = new CalendarDeviceController();
    const deviceDiscover = new CalendarDeviceDiscover(databaseManager);
    super(databaseManager, deviceManager, eventManager, deviceController, deviceDiscover);
  }

  public getModuleId(): string {
    return CALENDARCONFIG.id;
  }

  protected getManagerId(): string {
    return CALENDARCONFIG.managerId;
  }

  protected createEventStreamManager(): CalendarEventStreamManager {
    return new CalendarEventStreamManager(this.getManagerId(), this.deviceController, this.deviceManager, this.databaseManager);
  }

  async convertDeviceFromDatabase(device: Device): Promise<Device | null> {
    const calendar = new DeviceCalendar(device);
    await calendar.updateValues();
    return calendar;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(DEFAULT_CALENDAR_MODULE_ID);
    for (const device of devices) {
      if (device instanceof DeviceCalendar) {
        device.addModule(this);
      }
    }
  }
  
  async getCalendarsWithEntries(): Promise<CalendarConfig[]> {
    const devices = this.deviceManager.getDevicesForModule(DEFAULT_CALENDAR_MODULE_ID);
    let calendars: CalendarConfig[] = [];
    if( devices ){
      for( const device of devices ){
          calendars.push(...(device as DeviceCalendar).calendars.filter((c: CalendarConfig) => c.moduleId === this.getModuleId()));
      }
    }
    return calendars;
  }
  async getCalendarEntries(calendar: CalendarConfig): Promise<DeviceCalendarEntry[]> {
    const devices = this.deviceManager.getDevicesForModule(DEFAULT_CALENDAR_MODULE_ID);
    let entries: DeviceCalendarEntry[] = [];
    if( devices ){
      for( const device of devices ){
          entries.push(...(device as DeviceCalendar).calendars.filter((c: CalendarConfig) => c.id === calendar.id).flatMap((c: CalendarConfig) => c.entries));
      }
    }
    return entries;
  }
  async executeDeleteEntry(entry: DeviceCalendarEntry): Promise<void> {
    return;
  }
  async executeChangeEntry(entry: DeviceCalendarEntry): Promise<DeviceCalendarEntry> {
    return entry;
  }
  async executeChangeEntryCalendar(entry: DeviceCalendarEntry, calendar: CalendarConfig): Promise<DeviceCalendarEntry> {
    return entry;
  }
  async executeCreateEntry(entry: DeviceCalendarEntry): Promise<DeviceCalendarEntry> {
    return entry;
  }

  public createManualCalendar(device: DeviceCalendar, data: { id?: string; name: string; color: string; show: boolean; }): CalendarConfig {
    const name = String(data?.name ?? "").trim();
    const color = String(data?.color ?? "").trim();
    if (!name) {
      throw new Error("name ist erforderlich");
    }
    if (!color) {
      throw new Error("color ist erforderlich");
    }

    const requestedId = String(data?.id ?? "").trim();
    let calendarId = requestedId || `calendar-${crypto.randomUUID()}`;
    const existingIds = new Set(device.getCalendars().map((calendar: CalendarConfig) => String(calendar.id ?? "").trim()));

    if (requestedId && existingIds.has(calendarId)) {
      throw new Error(`Kalender '${calendarId}' existiert bereits`);
    }
    while (!requestedId && existingIds.has(calendarId)) {
      calendarId = `calendar-${crypto.randomUUID()}`;
    }

    const calendar: CalendarConfig = {
      id: calendarId,
      name,
      color,
      show: data.show === true,
      moduleId: this.getModuleId(),
      assignedUserIds: [],
      entries: [],
      properties: {
        createdManually: true
      }
    };

    device.setCalendar(calendar);
    return calendar;
  }


}


