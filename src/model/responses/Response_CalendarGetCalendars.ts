import type { CalendarConfig } from "../devices/DeviceCalendar.js";

/** GET /api/modules/calendar/calendars – Antwort ist das Array aller Kalender inkl. Termine. */
export class Response_CalendarGetCalendars {
  constructor(readonly calendars: CalendarConfig[]) {}

  toJSON(): CalendarConfig[] {
    return this.calendars;
  }
}
