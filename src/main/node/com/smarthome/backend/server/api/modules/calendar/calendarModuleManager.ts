import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import crypto from "node:crypto";
import { CALENDARCONFIG } from "./calendarModule.js";
import { CalendarDeviceController } from "./calendarDeviceController.js";
import { CalendarDeviceDiscover } from "./calendarDeviceDiscover.js";
import { CalendarEventStreamManager } from "./calendarEventStreamManager.js";
import { CalendarDeviceDiscovered } from "./calendarDeviceDiscovered.js";
import { CalendarConfig, CalendarSubModule, DEFAULT_CALENDAR_MODULE_ID, Device, DeviceCalendar, DeviceCalendarEntry } from "../../../../model/index.js";
import type { CalendarEvent } from "./calendarEvent.js";
import { ModuleManager } from "../moduleManager.js";

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

  constructor(databaseManager: DatabaseManager, actionManager: ActionManager, eventStreamManager: EventStreamManager) {
    const deviceController = new CalendarDeviceController();
    const deviceDiscover = new CalendarDeviceDiscover(databaseManager);
    super(databaseManager, actionManager, eventStreamManager, deviceController, deviceDiscover);
  }

  public getModuleId(): string {
    return CALENDARCONFIG.id;
  }

  protected getManagerId(): string {
    return CALENDARCONFIG.managerId;
  }

  protected createEventStreamManager(): CalendarEventStreamManager {
    return new CalendarEventStreamManager(this.getManagerId(), this.deviceController, this.actionManager, this.databaseManager);
  }

  convertDeviceFromDatabase(device: Device): DeviceCalendar {
    return new DeviceCalendar(device);
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(DEFAULT_CALENDAR_MODULE_ID);
    for( const device of devices ){
      (device as DeviceCalendar).addModule(this);
    };
  }
  
  async getCalendarsWithEntries(): Promise<CalendarConfig[]> {
    const devices = this.actionManager.getDevicesForModule(DEFAULT_CALENDAR_MODULE_ID);
    let calendars: CalendarConfig[] = [];
    if( devices ){
      for( const device of devices ){
          calendars.push(...(device as DeviceCalendar).calendars.filter(c => c.moduleId === this.getModuleId()));
      }
    }
    return calendars;
  }
  async getCalendarEntries(calendar: CalendarConfig): Promise<DeviceCalendarEntry[]> {
    const devices = this.actionManager.getDevicesForModule(DEFAULT_CALENDAR_MODULE_ID);
    let entries: DeviceCalendarEntry[] = [];
    if( devices ){
      for( const device of devices ){
          entries.push(...(device as DeviceCalendar).calendars.filter(c => c.id === calendar.id).flatMap(c => c.entries));
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
    const existingIds = new Set(device.getCalendars().map(calendar => String(calendar.id ?? "").trim()));

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
      entries: [],
      properties: {
        createdManually: true
      }
    };

    device.setCalendar(calendar);
    return calendar;
  }


}


