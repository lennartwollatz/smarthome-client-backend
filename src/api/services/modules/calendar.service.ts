import { randomUUID } from "node:crypto";
import type { ActionManager } from "../../../actions/ActionManager.js";
import { logger } from "../../../config/logger.js";
import { DEFAULT_CALENDAR_DEVICE_ID, DeviceCalendar, type DeviceCalendarEntry } from "../../../model/devices/DeviceCalendar.js";
import type { Request_CalendarCreateCalendar } from "../../../model/requests/Request_CalendarCreateCalendar.js";
import type { Request_CalendarCreateEvent } from "../../../model/requests/Request_CalendarCreateEvent.js";
import type { Request_CalendarDeleteEvent } from "../../../model/requests/Request_CalendarDeleteEvent.js";
import type { Request_CalendarGetCalendars } from "../../../model/requests/Request_CalendarGetCalendars.js";
import type { Request_CalendarGetEvents } from "../../../model/requests/Request_CalendarGetEvents.js";
import type { Request_CalendarGetModuleCalendars } from "../../../model/requests/Request_CalendarGetModuleCalendars.js";
import type { Request_CalendarUpdateCalendar } from "../../../model/requests/Request_CalendarUpdateCalendar.js";
import type { Request_CalendarUpdateEvent } from "../../../model/requests/Request_CalendarUpdateEvent.js";
import { Response_CalendarCreateCalendar } from "../../../model/responses/Response_CalendarCreateCalendar.js";
import { Response_CalendarCreateEvent } from "../../../model/responses/Response_CalendarCreateEvent.js";
import { Response_CalendarDeleteEvent } from "../../../model/responses/Response_CalendarDeleteEvent.js";
import { Response_CalendarGetCalendars } from "../../../model/responses/Response_CalendarGetCalendars.js";
import { Response_CalendarGetEvents } from "../../../model/responses/Response_CalendarGetEvents.js";
import { Response_CalendarGetModuleCalendars } from "../../../model/responses/Response_CalendarGetModuleCalendars.js";
import { Response_CalendarUpdateCalendar } from "../../../model/responses/Response_CalendarUpdateCalendar.js";
import { Response_CalendarUpdateEvent } from "../../../model/responses/Response_CalendarUpdateEvent.js";
import { DEFAULT_CREDENTIALS_ID } from "../../../modules/appleCalendar/appleCalendarDeviceDiscover.js";
import type { CalendarModuleManager } from "../../../modules/calendar/calendarModuleManager.js";
import { ApiError } from "../../http/ApiError.js";

const CALENDAR_NOT_FOUND = "Kalender nicht gefunden";
const UNTITLED_EVENT = "(ohne Titel)";

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || "Unbekannter Fehler";
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unbekannter Fehler";
  }
}

/** Legt beim Erzeugen das zentrale Kalender-Gerät an bzw. hält es verbunden und im Schnellzugriff. */
export class CalendarService {
  constructor(
    private readonly calendarModule: CalendarModuleManager,
    private readonly actionManager: ActionManager
  ) {
    this.ensureCalendarDevice();
  }

  getCalendars(_request: Request_CalendarGetCalendars): Response_CalendarGetCalendars {
    try {
      return new Response_CalendarGetCalendars(this.getCalendarDevice()?.getCalendars() ?? []);
    } catch (err) {
      logger.error({ err }, "Fehler beim Laden der Kalender-Liste");
      throw ApiError.internal(toErrorMessage(err) || "Fehler beim Laden der Kalender");
    }
  }

  getEvents(_request: Request_CalendarGetEvents): Response_CalendarGetEvents {
    try {
      return new Response_CalendarGetEvents(this.getCalendarDevice()?.getEntries() ?? []);
    } catch (err) {
      logger.error({ err }, "Fehler beim Laden der Kalender-Termine");
      throw ApiError.internal(toErrorMessage(err) || "Fehler beim Laden der Kalender");
    }
  }

  createCalendar(request: Request_CalendarCreateCalendar): Response_CalendarCreateCalendar {
    const device = this.requireCalendarDevice();
    try {
      const calendar = this.calendarModule.createManualCalendar(device, {
        id: request.id || undefined,
        name: request.name,
        color: request.color,
        show: request.show
      });
      this.actionManager.saveDevice(device);
      return new Response_CalendarCreateCalendar(calendar);
    } catch (err) {
      const message = toErrorMessage(err);
      if (message.includes("existiert bereits")) throw ApiError.conflict(message);
      throw ApiError.badRequest(message || "Fehler beim Erstellen des Kalenders");
    }
  }

  async createEvent(request: Request_CalendarCreateEvent): Promise<Response_CalendarCreateEvent> {
    const device = this.requireCalendarDevice();
    const calendar = device.getCalendars().find(c => String(c.id ?? "").trim() === request.calendarId);
    if (!calendar) throw ApiError.notFound(`Kalender '${request.calendarId}' nicht gefunden`);

    const entry: DeviceCalendarEntry = {
      id: randomUUID(),
      calendarId: calendar.id,
      calendarName: calendar.name,
      moduleId: calendar.moduleId,
      title: request.title || UNTITLED_EVENT,
      description: request.description ?? "",
      location: request.location ?? "",
      start: request.start,
      end: request.end,
      allDay: request.allDay ?? false,
      notificationEnabled: request.notificationEnabled ?? true,
      attendees: [],
      organizer: { name: "", email: "" },
      status: "",
      recurrenceRule: "",
      updatedAt: new Date().toISOString(),
      properties: {
        credentialId: calendar.properties?.credentialId ?? DEFAULT_CREDENTIALS_ID
      }
    };

    try {
      await device.addEntry(entry, true);
      this.actionManager.saveDevice(device);
    } catch (err) {
      logger.error({ err, calendarId: request.calendarId }, "Fehler beim Erstellen eines Kalender-Termins");
      throw ApiError.internal(toErrorMessage(err) || "Fehler beim Erstellen des Termins");
    }
    return new Response_CalendarCreateEvent(entry.id);
  }

  async updateEvent(request: Request_CalendarUpdateEvent): Promise<Response_CalendarUpdateEvent> {
    const device = this.requireCalendarDevice();
    const { eventId } = request;
    try {
      if (request.start != null) await device.changeEntryTimeStart(eventId, request.start);
      if (request.end != null) await device.changeEntryTimeEnd(eventId, request.end);
      const calendarId = request.calendarId?.trim();
      if (calendarId) await device.changeEntryCalendar(eventId, calendarId);
      if (request.title != null) await device.changeEntryName(eventId, request.title);
      if (request.description != null) await device.changeEntryNotice(eventId, request.description);
      if (request.location != null) await device.changeEntryAddress(eventId, request.location);
      if (request.notificationEnabled != null) await device.changeEntryNotification(eventId, request.notificationEnabled);
      if (request.allDay != null) await device.changeEntryAllDay(eventId, request.allDay);
      this.actionManager.saveDevice(device);
    } catch (err) {
      logger.error({ err, eventId }, "Fehler beim Aktualisieren eines Kalender-Termins");
      throw ApiError.internal(toErrorMessage(err) || "Fehler beim Aktualisieren des Termins");
    }
    return new Response_CalendarUpdateEvent({
      id: eventId,
      start: request.start,
      end: request.end,
      calendarId: request.calendarId,
      title: request.title,
      description: request.description,
      location: request.location,
      notificationEnabled: request.notificationEnabled,
      allDay: request.allDay
    });
  }

  async deleteEvent(request: Request_CalendarDeleteEvent): Promise<Response_CalendarDeleteEvent> {
    const device = this.requireCalendarDevice();
    try {
      await device.deleteEntry(request.eventId);
      this.actionManager.saveDevice(device);
    } catch (err) {
      logger.error({ err, eventId: request.eventId }, "Fehler beim Loeschen eines Kalender-Termins");
      throw ApiError.internal(toErrorMessage(err) || "Fehler beim Loeschen des Termins");
    }
    return new Response_CalendarDeleteEvent(request.eventId);
  }

  async updateCalendar(request: Request_CalendarUpdateCalendar): Promise<Response_CalendarUpdateCalendar> {
    const device = this.requireCalendarDevice();
    const calendar = device.getCalendars().find(entry => String(entry.id ?? "").trim() === request.calendarId);
    if (!calendar) throw ApiError.notFound(CALENDAR_NOT_FOUND);
    if (request.name !== undefined && calendar.properties?.createdManually !== true) {
      throw ApiError.forbidden("Name kann nur bei manuell erstellten Kalendern geaendert werden");
    }

    await device.changeCalendarConfig(request.calendarId, {
      show: request.show,
      color: request.color,
      name: request.name,
      assignedUserIds: request.assignedUserIds
    });
    this.actionManager.saveDevice(device);
    return new Response_CalendarUpdateCalendar({
      id: request.calendarId,
      show: request.show,
      color: request.color,
      name: request.name,
      assignedUserIds: request.assignedUserIds
    });
  }

  getModuleCalendars(request: Request_CalendarGetModuleCalendars): Response_CalendarGetModuleCalendars {
    return new Response_CalendarGetModuleCalendars(this.getCalendarDevice()?.getCalendarsForModule(request.moduleId) ?? []);
  }

  private getCalendarDevice(): DeviceCalendar | null {
    return this.actionManager.getDevice(DEFAULT_CALENDAR_DEVICE_ID) as DeviceCalendar | null;
  }

  private requireCalendarDevice(): DeviceCalendar {
    const device = this.getCalendarDevice();
    if (!device) throw ApiError.notFound(CALENDAR_NOT_FOUND);
    return device;
  }

  private ensureCalendarDevice(): void {
    const existing = this.getCalendarDevice();
    if (existing) {
      if (!existing.isConnected || !existing.quickAccess) {
        existing.isConnected = true;
        existing.quickAccess = true;
        this.actionManager.saveDevice(existing);
      }
      return;
    }
    const device = new DeviceCalendar({ isConnected: true, quickAccess: true });
    device.addModule(this.calendarModule);
    this.actionManager.saveDevice(device);
  }
}
