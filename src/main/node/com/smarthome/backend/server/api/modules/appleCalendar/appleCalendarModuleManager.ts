import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import { APPLECALENDARCONFIG, APPLECALENDARMODULE } from "./appleCalendarModule.js";
import { AppleCalendarEventStreamManager } from "./appleCalendarEventStreamManager.js";
import { AppleCalendarCalendar, AppleCalendarCalendarEntry, AppleCalendarDeviceController } from "./appleCalendarDeviceController.js";
import { AppleCalendarCredentialsInfo, AppleCalendarDeviceDiscover, DEFAULT_CREDENTIALS_ID } from "./appleCalendarDeviceDiscover.js";
import { AppleCalendarDeviceDiscovered } from "./appleCalendarDeviceDiscovered.js";
import type { AppleCalendarEvent } from "./appleCalendarEvent.js";
import { Device } from "../../../../model/devices/Device.js";
import { CalendarConfig, DEFAULT_CALENDAR_DEVICE_ID, DEFAULT_CALENDAR_MODULE_ID, DeviceCalendar, type CalendarSubModule, type DeviceCalendarEntry } from "../../../../model/devices/DeviceCalendar.js";
import { ModuleManager } from "../moduleManager.js";

export class AppleCalendarModuleManager extends ModuleManager<
  AppleCalendarEventStreamManager,
  AppleCalendarDeviceController,
  AppleCalendarDeviceController,
  AppleCalendarEvent,
  DeviceCalendar,
  AppleCalendarDeviceDiscover,
  AppleCalendarDeviceDiscovered
> implements CalendarSubModule {

  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventStreamManager: EventStreamManager
  ) {
    const deviceDiscover = new AppleCalendarDeviceDiscover(databaseManager);
    const deviceController = new AppleCalendarDeviceController(databaseManager, deviceDiscover);
    super(databaseManager, actionManager, eventStreamManager, deviceController, deviceDiscover);
  }


  public getModuleId(): string {
    return APPLECALENDARCONFIG.id;
  }

  protected getManagerId(): string {
    return APPLECALENDARCONFIG.managerId;
  }

  public getDisplayName() {
    return APPLECALENDARMODULE.name;
  }

  protected createEventStreamManager(): AppleCalendarEventStreamManager {
    return new AppleCalendarEventStreamManager(this.getManagerId(), this.getModuleId(), this.deviceController, this.actionManager);
  }

  // Credentials APIs
  public getCredentialsInfo(credentialId:string): AppleCalendarCredentialsInfo {
    return this.deviceDiscover.getCredentialsInfo(credentialId);
  }
  public getCredentialInfos(): AppleCalendarCredentialsInfo[] {
    return this.deviceDiscover.getCredentialInfos();
  }
  public setCredentials(credentialId:string, username: string, password?: string, server?: string) {
    return this.deviceDiscover.setCredentials(credentialId,username, password, server);
  }
  public setPassword(credentialId:string, password: string) {
    return this.deviceDiscover.setPassword(credentialId, password);
  }
  public setServer(credentialId:string, server: string) {
    return this.deviceDiscover.setServer(credentialId, server);
  }
  public testCredentials(credentialId:string): Promise<boolean> {
    return this.deviceDiscover.testCredentials(credentialId);
  }

  public deleteCredentials(credentialId: string) {
    this.deviceDiscover.deleteCredentials(credentialId);
    const calendarDevices = this.actionManager.getDevicesForModule(DEFAULT_CALENDAR_MODULE_ID);
    calendarDevices.forEach(device => {
      if (!(device instanceof DeviceCalendar)) return;
      const filteredCalendars = device.calendars
        .filter(c => String((c?.properties as any)?.credentialId ?? "").trim() !== credentialId || c?.moduleId !== this.getModuleId());
      device.calendars = filteredCalendars;
      this.actionManager.saveDevice(device);
    });
  }

  public async initCalendars(credentialId: string): Promise<CalendarConfig[]> {
    const data = await this.deviceController.getCalendarsWithEntriesForCredentialId(credentialId);
    const withEntries = data.map(i => this.deviceController.toDeviceCalendarCalendarWithEntries(i.calendar, i.credentialId, i.entries.map(e => this.deviceController.toDeviceCalendarEntry(e, i.calendar.id, i.calendar.displayName, i.credentialId))));
    const device = this.actionManager.getDevice(DEFAULT_CALENDAR_DEVICE_ID);
    if( device ) {
      const remaining = (device as DeviceCalendar).calendars.filter(c => {
        const cred = String((c?.properties as any)?.credentialId ?? "").trim();
        return !(c.moduleId === this.getModuleId() && cred === credentialId);
      });
      (device as DeviceCalendar).calendars = [...remaining, ...withEntries];
      this.actionManager.saveDevice(device);
    } else {
      const deviceNew = new DeviceCalendar();
      deviceNew.setCalendars(withEntries);
      this.actionManager.saveDevice(deviceNew);
    }


    return withEntries;
  }

  convertDeviceFromDatabase(device: Device): DeviceCalendar {
    return new DeviceCalendar(device);
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(DEFAULT_CALENDAR_MODULE_ID);
    for( const device of devices ) {
        (device as DeviceCalendar).addModule(this);
    }
  }

  async getCalendarsWithEntries(): Promise<CalendarConfig[]> {
    const data = await this.deviceController.getCalendarsWithEntries();
    return data.map((c: { credentialId: string; calendar: AppleCalendarCalendar; entries: AppleCalendarCalendarEntry[] }) => { return this.deviceController.toDeviceCalendarCalendarWithEntries(c.calendar, c.credentialId, c.entries.map(e => this.deviceController.toDeviceCalendarEntry(e, c.calendar.id, c.calendar.displayName, c.credentialId))); });
  }

  async getCalendarEntries(calendar: CalendarConfig): Promise<DeviceCalendarEntry[]> {
    return (await this.deviceController.getCalendarEntries(calendar)).map(e => this.deviceController.toDeviceCalendarEntry(e, calendar.id, calendar.name, String((calendar.properties as any)?.credentialId ?? DEFAULT_CREDENTIALS_ID).trim()));
  }
  async executeDeleteEntry(entry: DeviceCalendarEntry): Promise<void> {
    await this.deviceController.deleteEntry(entry);
  }
  async executeChangeEntry(entry: DeviceCalendarEntry): Promise<DeviceCalendarEntry> {
    return await this.deviceController.updateEntry(entry);
  }
  async executeChangeEntryCalendar(entry: DeviceCalendarEntry, calendar: CalendarConfig): Promise<DeviceCalendarEntry> {
    return await this.deviceController.updateEntryCalendar(entry, calendar);
  }
  async executeCreateEntry(entry: DeviceCalendarEntry): Promise<DeviceCalendarEntry> {
    return await this.deviceController.createEntry(entry);
  }
  
}
