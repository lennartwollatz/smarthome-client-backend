import type { DeviceCalendarEntry } from "../devices/DeviceCalendar.js";

/** GET /api/modules/calendar/events – Antwort ist das Array aller Termine. */
export class Response_CalendarGetEvents {
  constructor(readonly entries: DeviceCalendarEntry[]) {}

  toJSON(): DeviceCalendarEntry[] {
    return this.entries;
  }
}
