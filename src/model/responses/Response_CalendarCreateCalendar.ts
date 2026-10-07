import type { CalendarConfig } from "../devices/DeviceCalendar.js";

/** POST /api/modules/calendar/calendars – Antwort ist der angelegte Kalender. */
export class Response_CalendarCreateCalendar {
  constructor(readonly calendar: CalendarConfig) {}

  toJSON(): CalendarConfig {
    return this.calendar;
  }
}
