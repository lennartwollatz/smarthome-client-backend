import type { CalendarConfig } from "../devices/DeviceCalendar.js";

/** GET /api/modules/calendar/calendars/:moduleId – Antwort ist das Array der Kalender des Moduls. */
export class Response_CalendarGetModuleCalendars {
  constructor(readonly calendars: CalendarConfig[]) {}

  toJSON(): CalendarConfig[] {
    return this.calendars;
  }
}
