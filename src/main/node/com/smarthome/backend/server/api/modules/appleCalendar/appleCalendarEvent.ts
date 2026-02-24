import { CalendarConfig, DeviceCalendarEntry } from "../../../../model/index.js";
import type { ModuleEvent } from "../moduleEvent.js";

export interface AppleCalendarEvent extends ModuleEvent {
  deviceId: string;
  type: "update-cal-entries" | "cal-name-changed" | "cal-added" | "cal-deleted";
  entries?: DeviceCalendarEntry[];
  calendarId: string;
  calendarName?: string;
  calendar?: CalendarConfig;
}


