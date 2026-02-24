import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";
import { FunctionParameter } from "../DeviceFunction.js";

export const DEFAULT_CALENDAR_MODULE_ID = "calendar";
export const DEFAULT_CALENDAR_DEVICE_ID = "calendar-device";

export type DeviceCalendarEntryAttendee = {
  name?: string;
  email?: string;
  role?: string;
  status?: string;
};

export type DeviceCalendarEntryOrganizer = {
  name?: string;
  email?: string;
};

/**
 * Generisches Kalender-Device.
 * Enthält eine Liste von Terminen (Entries) als Device-State, ohne harte Abhängigkeit zu einem Provider.
 */
export type DeviceCalendarEntry = {
  /* ID des Termins */
  id: string;

  /* Parent Informationen zur Anzeige */
  calendarId: string;
  calendarName: string;
  moduleId: string;

  /* Attribute des Termins */
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  url?: string;
  allDay?: boolean;
  notificationEnabled: boolean;
  attendees?: DeviceCalendarEntryAttendee[];
  organizer?: DeviceCalendarEntryOrganizer;
  status?: string;
  recurrenceRule?: string;
  
  /** ISO string */
  updatedAt: string;
  properties?: Record<string, any>;
};

export type CalendarConfig = {
  /** Kategorie-ID (in diesem Projekt: Kalender-ID, z.B. system-calendar oder CalDAV Kalender-ID) */
  id: string;
  /** Anzeigename (optional) */
  name: string;
  /** true = sichtbar, false = ausgeblendet */
  show: boolean;
  /** Hex-Farbe (z.B. #60A5FA) */
  color: string;

  moduleId: string;
  
  entries: DeviceCalendarEntry[];

  properties?: Record<string, unknown>;
};

/**
 * Typ fuer Kalender-Sub-Module (z.B. AppleCalendar), die sich im CalendarCore registrieren.
 * Jedes Sub-Modul liefert Eintraege und synchronisiert Aenderungen in die Cloud.
 */
export type CalendarSubModule = {
  getModuleId(): string;

  getCalendarsWithEntries(): Promise<CalendarConfig[]>;
  getCalendarEntries(calendar: CalendarConfig): Promise<DeviceCalendarEntry[]>;
  /** Loescht einen Eintrag in der Cloud (z.B. CalDAV DELETE) */
  executeDeleteEntry(entry: DeviceCalendarEntry): Promise<void>;
  /** Aktualisiert einen Eintrag in der Cloud (z.B. CalDAV PUT) */
  executeChangeEntry(entry: DeviceCalendarEntry): Promise<DeviceCalendarEntry>;
  /** Aktualisiert einen Eintrag in der Cloud (z.B. CalDAV PUT) */
  executeChangeEntryCalendar(entry: DeviceCalendarEntry, calendar: CalendarConfig): Promise<DeviceCalendarEntry>;
  /** Erstellt einen Eintrag in der Cloud (z.B. CalDAV POST) */
  executeCreateEntry(entry: DeviceCalendarEntry): Promise<DeviceCalendarEntry>;
};

export class DeviceCalendar extends Device {
  static TriggerFunctionName = {
    ENTRY_CHANGED: "entryChanged",
    ENTRY_ADDED: "entryAdded",
    ENTRY_DELETED: "entryDeleted",
    ENTRY_RESCHEDULED: "entryResheduled",
    ENTRY_ADDRESS_CHANGED: "entryAddressChanged",
    ENTRY_STARTED: "entryStarted",
    ENTRY_STARTS_IN_MINUTES_20: "entryStartsInMinutes20",
    ENTRY_STARTS_IN_MINUTES_15: "entryStartsInMinutes15",
    ENTRY_STARTS_IN_MINUTES_10: "entryStartsInMinutes10",
    ENTRY_STARTS_IN_MINUTES_5: "entryStartsInMinutes5",
    ENTRY_HEADOFF_STARTS_IN_MINUTES_20: "entryHeadoffStartsInMinutes20",
    ENTRY_HEADOFF_STARTS_IN_MINUTES_15: "entryHeadoffStartsInMinutes15",
    ENTRY_HEADOFF_STARTS_IN_MINUTES_10: "entryHeadoffStartsInMinutes10",
    ENTRY_HEADOFF_STARTS_IN_MINUTES_5: "entryHeadoffStartsInMinutes5",
    ENTRY_HEADOFF_STARTS: "entryHeadoffStarts",
    CALENDAR_ADDED: "calendarAdded",
    CALENDAR_SHOW: "calendarShow",
    CALENDAR_HIDE: "calendarHide"
  } as const;

  static ActionFunctionName = {
    DELETE_ENTRY: "deleteEntry(string)",
    CHANGE_ENTRY_ADDRESS: "changeEntryAddress(string,string)",
    CHANGE_ENTRY_TIME_START: "changeEntryTimeStart(string,string)",
    CHANGE_ENTRY_TIME_END: "changeEntryTimeEnd(string,string)",
    CHANGE_ENTRY_NAME: "changeEntryName(string,string)",
    CHANGE_ENTRY_KATEGORIE: "changeEntryKategorie(getEntryCategories,string)",
    CHANGE_ENTRY_NOTIFICATION: "changeEntryNotification(string,bool)",
    GET_ENTRY_CATEGORIES: "getEntryCategories"
  } as const;

  static BoolFunctionName = {
    CALENDAR_VISIBLE: "calendarVisible(string)",
    CALENDAR_HIDDEN: "calendarHidden(string)",
    ENTRY_STARTED: "entryStarted(string)",
    ENTRY_ENDED: "entryEnded(string)",
    HAS_ENTRIES_TODAY: "hasEntriesToday(string)",
    HAS_ENTRIES_TOMORROW: "hasEntriesTomorrow(string)",
    HAS_ENTRIES_THIS_WEEK: "hasEntriesThisWeek(string)"
  } as const;


  calendars: CalendarConfig[] = [];
  modules: CalendarSubModule[] = [];

  constructor(init?: Partial<DeviceCalendar>) {
    super();
    this.assignInit(init as any);
    this.modules = [];
    this.id = DEFAULT_CALENDAR_DEVICE_ID;
    this.type = DeviceType.CALENDAR;
    this.icon = "&#128197;";
    this.typeLabel = "deviceType.calendar";
    this.moduleId = DEFAULT_CALENDAR_MODULE_ID;
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  updateValues(): Promise<void> {
    return Promise.resolve();
  }

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      DeviceFunction.fromString(DeviceCalendar.BoolFunctionName.CALENDAR_VISIBLE, "bool"),
      DeviceFunction.fromString(DeviceCalendar.BoolFunctionName.CALENDAR_HIDDEN, "bool"),
      DeviceFunction.fromString(DeviceCalendar.BoolFunctionName.ENTRY_STARTED, "bool"),
      DeviceFunction.fromString(DeviceCalendar.BoolFunctionName.ENTRY_ENDED, "bool"),
      DeviceFunction.fromString(DeviceCalendar.BoolFunctionName.HAS_ENTRIES_TODAY, "bool"),
      DeviceFunction.fromString(DeviceCalendar.BoolFunctionName.HAS_ENTRIES_TOMORROW, "bool"),
      DeviceFunction.fromString(DeviceCalendar.BoolFunctionName.HAS_ENTRIES_THIS_WEEK, "bool")
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [
      DeviceFunction.fromString(DeviceCalendar.ActionFunctionName.DELETE_ENTRY, "void"),
      DeviceFunction.fromString(DeviceCalendar.ActionFunctionName.CHANGE_ENTRY_ADDRESS, "void"),
      DeviceFunction.fromString(DeviceCalendar.ActionFunctionName.CHANGE_ENTRY_TIME_START, "void"),
      DeviceFunction.fromString(DeviceCalendar.ActionFunctionName.CHANGE_ENTRY_TIME_END, "void"),
      DeviceFunction.fromString(DeviceCalendar.ActionFunctionName.CHANGE_ENTRY_NAME, "void"),
      DeviceFunction.create(
        DeviceCalendar.ActionFunctionName.CHANGE_ENTRY_KATEGORIE,
        [
          FunctionParameter.fromString("string", DeviceCalendar.ActionFunctionName.GET_ENTRY_CATEGORIES),
          FunctionParameter.fromString("string")
        ],
        "void"
      ),
      DeviceFunction.fromString(DeviceCalendar.ActionFunctionName.CHANGE_ENTRY_NOTIFICATION, "void"),
      DeviceFunction.fromString(DeviceCalendar.ActionFunctionName.GET_ENTRY_CATEGORIES, "string[]")
    ];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_CHANGED, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_ADDED, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_DELETED, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_RESCHEDULED, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_ADDRESS_CHANGED, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_STARTED, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_STARTS_IN_MINUTES_20, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_STARTS_IN_MINUTES_15, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_STARTS_IN_MINUTES_10, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_STARTS_IN_MINUTES_5, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_HEADOFF_STARTS_IN_MINUTES_20, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_HEADOFF_STARTS_IN_MINUTES_15, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_HEADOFF_STARTS_IN_MINUTES_10, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_HEADOFF_STARTS_IN_MINUTES_5, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.ENTRY_HEADOFF_STARTS, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.CALENDAR_ADDED, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.CALENDAR_SHOW, "void"),
      DeviceFunction.fromString(DeviceCalendar.TriggerFunctionName.CALENDAR_HIDE, "void")
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceCalendar.TriggerFunctionName).includes(
      triggerName as (typeof DeviceCalendar.TriggerFunctionName)[keyof typeof DeviceCalendar.TriggerFunctionName]
    );
    if (!isValid) return;

    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;
    listeners.forEach(listener => listener.run());
  }

  private getEntry(entryId: string): DeviceCalendarEntry | undefined {
    return this.calendars.flatMap(c => c.entries).find(e => e.id === entryId);
  }

  private getCalendar(calendarId: string): CalendarConfig | undefined {
    return this.calendars.find(c => c.id === calendarId);
  }

  private getModule(moduleId: string): CalendarSubModule | undefined{
    const target = String(moduleId ?? "").trim();
    if (!target) return undefined;
    console.log("getModule", target, this.modules);
    return this.modules.find(module => module.getModuleId() === target);
  }

  entryStarted(entryId: string, now: Date = new Date()) {
    const ev = this.getEntry(entryId);
    if (!ev) return false;
    const nowMs = now.getTime();
    const s = new Date(ev.start).getTime();
    const e = new Date(ev.end).getTime();
    if (Number.isNaN(nowMs) || Number.isNaN(s) || Number.isNaN(e)) return false;
    return s <= nowMs && nowMs < e;
  }

  entryEnded(entryId: string, now: Date = new Date()) {
    const ev = this.getEntry(entryId);
    if (!ev) return false;
    const nowMs = now.getTime();
    const e = new Date(ev.end).getTime();
    if (Number.isNaN(nowMs) || Number.isNaN(e)) return false;
    return nowMs >= e;
  }

  hasEntriesToday(now: Date = new Date()) {
    const { from, to } = dayRange(now, 0);
    return this.hasEntriesInRange(from, to);
  }

  hasEntriesTomorrow(now: Date = new Date()) {
    const { from, to } = dayRange(now, 1);
    return this.hasEntriesInRange(from, to);
  }

  hasEntriesThisWeek(now: Date = new Date()) {
    const { from, to } = weekRange(now);
    return this.hasEntriesInRange(from, to);
  }

  getCurrentEntry(now: Date = new Date()): DeviceCalendarEntry | null {
    const nowMs = now.getTime();
    if (Number.isNaN(nowMs)) return null;
    const entries = this.calendars.flatMap(c => c.entries);
    for (const ev of entries) {
      const s = new Date(ev.start).getTime();
      const e = new Date(ev.end).getTime();
      if (Number.isNaN(s) || Number.isNaN(e)) continue;
      if (s <= nowMs && nowMs < e) return ev;
    }
    return null;
  }

  getCalendars(): CalendarConfig[] {
    return this.calendars;
  }

  setCalendarName(calendarId: string, name: string) {
    const calendar = this.getCalendar(calendarId);
    if (!calendar) return;
    calendar.name = name;
  }

  getCalendarsForModule(moduleId: string): CalendarConfig[] {
    return this.calendars.filter(c => c.moduleId === moduleId);
  }

  getEntries(): DeviceCalendarEntry[] {
    return this.calendars.flatMap(c => c.entries);
  }

  async addEntry(entry: DeviceCalendarEntry, execute: boolean = true) {
    let module = this.getModule(entry.moduleId);
    if (!module) return;
    if( execute ){
      const newEntry = await module.executeCreateEntry(entry);
      entry = newEntry;
    }
    this.calendars = this.calendars.map(c => {
      if (c.id !== entry.calendarId) return c;
      return { ...c, entries: [...c.entries, entry] };
    });
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_DELETED);
  }

  async deleteEntry(entryId: string, execute: boolean = true) {
    let entry = this.getEntry(entryId);
    if (!entry) return;
    let module = this.getModule(entry.moduleId);
    if (!module) return;
    this.calendars = this.calendars.map(c => ({...c, entries: c.entries.filter(e => e.id !== entryId)}));
    if( execute ){
      await module.executeDeleteEntry(entry);	
    }
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_DELETED);
  }

  async changeEntryAddress(entryId: string, newAddress: string, execute: boolean = true) {
    let entry = this.getEntry(entryId);
    if (!entry) return;
    let module = this.getModule(entry.moduleId);
    if (!module) return;
    entry.location = newAddress;
    entry.updatedAt = new Date().toISOString();
    if( execute ){
      const newEntry = await module.executeChangeEntry(entry);
      entry.properties = newEntry.properties ?? {};
    }
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_DELETED);
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_ADDRESS_CHANGED);
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_CHANGED);
  }

  async changeEntryTimeStart(entryId: string, newStartIso: string, execute: boolean = true) {
    let entry = this.getEntry(entryId);
    if (!entry) return;
    let module = this.getModule(entry.moduleId);
    if (!module) return;
    entry.start = newStartIso;
    entry.updatedAt = new Date().toISOString();
    if( execute ){
      const newEntry = await module.executeChangeEntry(entry);
      entry.properties = newEntry.properties ?? {};
    }
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_RESCHEDULED);
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_CHANGED);
  }

  async changeEntryTimeEnd(entryId: string, newEndIso: string, execute: boolean = true) {
    let entry = this.getEntry(entryId);
    if (!entry) return;
    let module = this.getModule(entry.moduleId);
    if (!module) return;
    entry.end = newEndIso;
    entry.updatedAt = new Date().toISOString();
    if( execute ){
      const newEntry = await module.executeChangeEntry(entry);
      entry.properties = newEntry.properties ?? {};
    }
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_RESCHEDULED);
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_CHANGED);
  }

  async changeEntryName(entryId: string, newName: string, execute: boolean = true) {
    let entry = this.getEntry(entryId);
    if (!entry) return;
    let module = this.getModule(entry.moduleId);
    if (!module) return;
    entry.title = newName;
    entry.updatedAt = new Date().toISOString();
    if( execute ){
      const newEntry = await module.executeChangeEntry(entry);
      entry.properties = newEntry.properties ?? {};
    }
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_CHANGED);
  }

  async changeEntryCalendar(entryId: string, calendarId: string, execute: boolean = true) {
    const sourceEntry = this.getEntry(entryId);
    if (!sourceEntry) return;
    const oldCalendarId = sourceEntry.calendarId;
    const module_old = this.getModule(sourceEntry.moduleId);
    if (!module_old) return;
    const calendar = this.getCalendar(calendarId);
    if (!calendar) return;
    const module_new = this.getModule(calendar.moduleId);
    if (!module_new) return;

    if (oldCalendarId === calendarId && sourceEntry.moduleId === module_new.getModuleId()) {
      return;
    }

    const candidate: DeviceCalendarEntry = {
      ...sourceEntry,
      calendarId,
      calendarName: calendar.name,
      moduleId: module_new.getModuleId(),
      updatedAt: new Date().toISOString()
    };

    let movedEntry = candidate;
    if (execute) {
      if (module_old.getModuleId() === module_new.getModuleId()) {
        movedEntry = await module_old.executeChangeEntryCalendar(candidate, calendar);
      } else {
        await module_old.executeDeleteEntry(sourceEntry);
        movedEntry = await module_new.executeCreateEntry(candidate);
      }
    }

    const movedEntryId = String(movedEntry.id ?? "");
    const movedEntryUrl = String(movedEntry.properties?.url ?? "");
    this.calendars = this.calendars.map(c => {
      if (c.id === oldCalendarId) {
        return { ...c, entries: c.entries.filter(e => e.id !== entryId) };
      }
      if (c.id === calendarId) {
        const without = c.entries.filter(e => {
          if (e.id === entryId) return false;
          if (movedEntryId && e.id === movedEntryId) return false;
          if (movedEntryUrl && String(e.properties?.url ?? "") === movedEntryUrl) return false;
          return true;
        });
        return { ...c, entries: [...without, movedEntry] };
      }
      return c;
    });
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_CHANGED);
  }

  async changeEntryNotification(entryId: string, enabled: boolean, execute: boolean = true) {
    let entry = this.getEntry(entryId);
    if (!entry) return;
    let module = this.getModule(entry.moduleId);
    if (!module) return;
    entry.notificationEnabled = enabled;
    entry.updatedAt = new Date().toISOString();
    if( execute ){
      const result = await module.executeChangeEntry(entry);
      entry.properties = result.properties ?? {};
    }
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_CHANGED);
  }

  async changeEntryNotice(entryId: string, notice: string, execute: boolean = true) {
    let entry = this.getEntry(entryId);
    if (!entry) return;
    let module = this.getModule(entry.moduleId);
    if (!module) return;
    entry.description = notice;
    entry.updatedAt = new Date().toISOString();
    if( execute ){
      const result = await module.executeChangeEntry(entry);
      entry.properties = result.properties ?? {};
    }
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_CHANGED);
  }

  async changeEntryAllDay(entryId: string, allDay: boolean, execute: boolean = true) {
    let entry = this.getEntry(entryId);
    if (!entry) return;
    let module = this.getModule(entry.moduleId);
    if (!module) return;
    entry.allDay = allDay;
    entry.updatedAt = new Date().toISOString();
    if( execute ){
      const newEntry = await module.executeChangeEntry(entry);
      entry.properties = newEntry.properties ?? {};
    }
    this.checkListener(DeviceCalendar.TriggerFunctionName.ENTRY_CHANGED);
  }

  async changeCalendarConfig(calendarId: string, data: { show?: any; color?: any; name?: any; }) {
    const calendar = this.getCalendar(calendarId);
    if (!calendar) return;
    if (data.show !== undefined) {
      calendar.show = data.show;
    }
    if (typeof data.color === "string" && data.color) {
      calendar.color = data.color;
    }
    if (typeof data.name === "string" && data.name) {
      calendar.name = data.name;
    }
  }

  hasEntryNow(now: Date = new Date()) {
    return this.getCurrentEntry(now) != null;
  }

  hasEntryInNextMinutes(minutes: number, now: Date = new Date()) {
    const next = this.getNextEntry(now);
    if (!next) return false;
    const nowMs = now.getTime();
    const startMs = new Date(next.start).getTime();
    if (Number.isNaN(nowMs) || Number.isNaN(startMs)) return false;
    return startMs >= nowMs && startMs <= nowMs + Math.max(0, minutes) * 60_000;
  }

  private hasEntriesInRange(from: Date, to: Date): boolean {
    const fromMs = from.getTime();
    const toMs = to.getTime();
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return false;

    const entries = this.calendars.flatMap(c => c.entries);
    return entries.some(ev => {
      const s = new Date(ev.start).getTime();
      const e = new Date(ev.end).getTime();
      if (Number.isNaN(s) || Number.isNaN(e)) return false;
      return s <= toMs && e >= fromMs;
    });
  }

  getNextEntry(now: Date = new Date()): DeviceCalendarEntry | undefined {
    const nowMs = now.getTime();
    if (Number.isNaN(nowMs)) return undefined;
    const entries = this.calendars.flatMap(c => c.entries);
    let best: DeviceCalendarEntry | undefined = undefined;
    let bestStart = Number.POSITIVE_INFINITY;
    for (const ev of entries) {
      const s = new Date(ev.start).getTime();
      if (Number.isNaN(s)) continue;
      if (s <= nowMs) continue;
      if (s < bestStart) {
        bestStart = s;
        best = ev;
      }
    }
    return best;
  }

  nextEntryTitleContains(needle: string, now: Date = new Date()) {
    const n = (needle ?? "").trim().toLowerCase();
    if (!n) return false;
    const next = this.getNextEntry(now);
    const title = (next?.title ?? "").toLowerCase();
    return title.includes(n);
  }

  setEntries(entries: DeviceCalendarEntry[], calendarId: string) {
    const calendar = this.getCalendar(calendarId);
    if (!calendar) return;
    calendar.entries = entries;
  }

  addEntries(entries: DeviceCalendarEntry[], calendarId: string) {
    const calendar = this.getCalendar(calendarId);
    if (!calendar) return;
    calendar.entries = [...calendar.entries, ...entries];
  }

  removeCalendar(calendarId: string) {
    this.calendars = this.calendars.filter(c => c.id !== calendarId);
  }

  setCalendar(calendar: CalendarConfig) {
    const existing = this.getCalendar(calendar.id);
    if (existing?.color) {
      calendar.color = existing.color;
    }
    this.removeCalendar(calendar.id);
    this.calendars.push(calendar);
  }

  setCalendars(calendars: CalendarConfig[]) {
    for( const calendar of calendars ) {
      this.setCalendar(calendar);
    }
  }

  async addModule(module: CalendarSubModule) {
    this.modules.push(module);
    const calendars = await module.getCalendarsWithEntries();
    this.setCalendars(calendars);
  }
}

function dayRange(now: Date, offsetDays: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const from = new Date(d);
  const to = new Date(d);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function weekRange(now: Date) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // Montag als Wochenstart (ISO)
  const day = d.getDay(); // 0 So, 1 Mo, ...
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  const from = new Date(d);
  const to = new Date(d);
  to.setDate(to.getDate() + 6);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

