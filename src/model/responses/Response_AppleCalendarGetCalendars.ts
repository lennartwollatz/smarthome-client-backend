import type { CalendarConfig } from "../devices/DeviceCalendar.js";

/** GET /api/modules/calendar-apple/calendars/:credentialsId – Antwort ist das Array der neu geladenen Kalender inkl. Termine. */
export class Response_AppleCalendarGetCalendars {
  constructor(readonly calendars: CalendarConfig[]) {}

  toJSON(): CalendarConfig[] {
    return this.calendars;
  }
}
