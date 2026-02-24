import type { DatabaseManager } from "../../../db/database.js";
import { DEFAULT_CALENDAR_DEVICE_ID, type CalendarConfig, type DeviceCalendar, type DeviceCalendarEntry } from "../../../../model/devices/DeviceCalendar.js";
import { ModuleDeviceController } from "../moduleDeviceController.js";
import type { AppleCalendarEvent } from "./appleCalendarEvent.js";
import { buildVCalendarFromEntry, ParsedVEvent, parseVEventFromIcs } from "./icalParser.js";
import { DEFAULT_CREDENTIALS_ID, type AppleCalendarDeviceDiscover } from "./appleCalendarDeviceDiscover.js";
import dav from "dav";
import crypto from "node:crypto";
import { APPLECALENDARMODULE } from "./appleCalendarModule.js";

export type AppleCalendarCalendar = {
  id: string;
  ctag: string;
  description: string | undefined;
  displayName: string;
  reports: string[];
  syncToken: string;
  url: string;
  timezone: string | undefined;
  data: {
    href: string;
    props: {
      displayname: string;
      getctag: string;
      resourcetype: string[];
      supportedCalendarComponentSet: string[];
      syncToken: string;
    };
  };
};

export type AppleCalendarCalendarEntry = {
  id:string, 
  data: {
    href:string,
    props:{
      getetag:string,
      calendarData:string,
    },
  },
  etag:string,
  url:string,
  calendarDataParsed:ParsedVEvent,
}

export class AppleCalendarDeviceController extends ModuleDeviceController<AppleCalendarEvent, DeviceCalendar> {
  private discover: AppleCalendarDeviceDiscover;

  constructor(_databaseManager: DatabaseManager, discover: AppleCalendarDeviceDiscover) {
    super();
    this.discover = discover;
  }

  async getCalendarsWithEntries(): Promise<Array<{ credentialId: string; calendar: AppleCalendarCalendar; entries: AppleCalendarCalendarEntry[] }>> {
    let calendars: Array<{ credentialId: string; calendar: AppleCalendarCalendar; entries: AppleCalendarCalendarEntry[] }> = [];
    for( const credentialId of this.discover.getCredentialInfos().map(c => c.id) ) {
      const data = await this.getCalendarsWithEntriesForCredentialId(credentialId);
      calendars.push(...data);
    }
    return calendars;
  } 

  async getCalendarsWithEntriesForCredentialId(credentialId: string): Promise<Array<{ credentialId: string; calendar: AppleCalendarCalendar; entries: AppleCalendarCalendarEntry[] }>> {
    const account = await this.discover.buildAccount(credentialId);
    const calendarsRaw = Array.isArray(account?.calendars) ? account.calendars : [];
    const results: Array<{ credentialId: string; calendar: AppleCalendarCalendar; entries: AppleCalendarCalendarEntry[] }> = [];

    for (const calRaw of calendarsRaw) {
      const calendar = this.toAppleCalendarCalendar(calRaw);
      const entries = this.toAppleCalendarCalendarEntries(calRaw.objects);
    
      results.push({ credentialId, calendar, entries });
    }

    return results;
  }
 
  async getCalendarEntries(calendar: CalendarConfig, range?: { from: Date; to: Date }): Promise<AppleCalendarCalendarEntry[]> {
    const credentialId = String((calendar?.properties as any)?.credentialId ?? DEFAULT_CREDENTIALS_ID).trim();
    const calendarId = calendar.id;
    const { cal, xhr } = await this.resolveCalendar(calendarId, credentialId);
    const filters = range ? buildTimeRangeFilter(range.from, range.to) : undefined;
    const objects = await dav.listCalendarObjects(cal, { xhr, filters });
    const list = Array.isArray(objects) ? objects : [];

    return list.map(obj => this.toAppleCalendarCalendarEntry(obj));
  }

  // ── CRUD für DeviceCalendarEntry ───────────────────────────────────────────
  async createEntry(entry: DeviceCalendarEntry): Promise<DeviceCalendarEntry> {
    const credentialId = String(entry.properties?.credentialId ?? DEFAULT_CREDENTIALS_ID);
    const calendarId = entry.calendarId;
    const { cal, xhr } = await this.resolveCalendar(calendarId, credentialId);

    const uid = crypto.randomUUID();
    const filename = `${uid}.ics`;
    const targetEntry = buildVCalendarFromEntry(entry);

    const newEntry = await dav.createCalendarObject(cal, { xhr, data: targetEntry, filename });
    const newEntryParsed = this.toAppleCalendarCalendarEntry(newEntry);
    return this.toDeviceCalendarEntry(newEntryParsed, calendarId, entry.calendarName, credentialId);
  }

  async deleteEntry(entry: DeviceCalendarEntry): Promise<void> {
    const credentialId = String(entry.properties?.credentialId ?? DEFAULT_CREDENTIALS_ID);
    const url = String(entry.properties?.url ?? "");
    const etag = String(entry.properties?.etag ?? "");
    const xhr = this.discover.buildXhr(credentialId);

    if (!url) {
      throw new Error("Loeschen fehlgeschlagen: entry.properties.url fehlt");
    }
    await dav.deleteCalendarObject({ url, etag }, { xhr });
  }

  async updateEntry(entry: DeviceCalendarEntry): Promise<DeviceCalendarEntry> {
    const credentialId = String(entry.properties?.credentialId ?? DEFAULT_CREDENTIALS_ID);
    const url = String(entry.properties?.url ?? "");
    const etag = String(entry.properties?.etag ?? "");
    const calendarData = buildVCalendarFromEntry(entry);

    const xhr = this.discover.buildXhr(credentialId);

    if (!url) {
      throw new Error("Update fehlgeschlagen: entry.properties.url fehlt");
    }
    const updateResult = await dav.updateCalendarObject({ url, calendarData, etag }, { xhr });
    let newEtag = this.extractEtagFromDavResponse(updateResult);
    if (!newEtag) {
      newEtag = await this.readCurrentEtag(entry.calendarId, credentialId, url, xhr);
    }

    return {
      ...entry,
      properties: {
        ...(entry.properties ?? {}),
        etag: newEtag ?? etag
      }
    };
  }

  async updateEntryCalendar(entry: DeviceCalendarEntry, targetCalendar: CalendarConfig): Promise<DeviceCalendarEntry> {
    const sourceCredentialId = String(entry.properties?.credentialId ?? DEFAULT_CREDENTIALS_ID);
    const targetCredentialId = String(targetCalendar.properties?.credentialId ?? DEFAULT_CREDENTIALS_ID);
    const targetCalendarId = targetCalendar.id;
    const { cal, xhr } = await this.resolveCalendar(targetCalendarId, targetCredentialId);
    
    const filename = `${crypto.randomUUID()}.ics`;
    const targetEntryUid = crypto.randomUUID();
    const targetEntry = buildVCalendarFromEntry({
      ...entry,
      properties: {
        ...(entry.properties ?? {}),
        calendarDataParsed: {
          ...(entry.properties?.calendarDataParsed ?? {}),
          uid: targetEntryUid
        }
      }
    });
    const targetUrl = this.buildCalendarObjectUrl(String(cal?.url ?? ""), filename);

    let writeResult: any;
    try {
      writeResult = await dav.createCalendarObject(cal, { xhr, data: targetEntry, filename });
    } catch (error) {
      throw new Error(
        `Kalenderwechsel fehlgeschlagen (create target): sourceCredential=${sourceCredentialId}, targetCredential=${targetCredentialId}, targetCalendar=${targetCalendarId}, url=${targetUrl}, err=${this.toErrorMessage(error)}`
      );
    }

    let newEtag = this.extractEtagFromDavResponse(writeResult);
    if (!newEtag) {
      newEtag = await this.readCurrentEtag(targetCalendarId, targetCredentialId, targetUrl, xhr);
    }

    const newEntryParsed = this.toAppleCalendarCalendarEntry({
      url: targetUrl,
      etag: newEtag,
      calendarData: targetEntry,
      data: {
        href: targetUrl,
        props: {
          getetag: newEtag,
          calendarData: targetEntry
        }
      }
    });

    // altes Objekt nach erfolgreichem Anlegen löschen (best effort)
    const url = String(entry.properties?.url ?? "");
    const etag = String(entry.properties?.etag ?? "");
    if (url) {
      const sourceXhr = this.discover.buildXhr(sourceCredentialId);
      try {
        await dav.deleteCalendarObject({ url, etag }, { xhr: sourceXhr });
      } catch (error) {
        console.warn(
          `Kalenderwechsel: Loeschen im Quellkalender fehlgeschlagen (best effort): sourceCredential=${sourceCredentialId}, url=${url}, err=${this.toErrorMessage(error)}`
        );
        // Best effort: Das Zielobjekt wurde bereits geschrieben.
      }
    }

    return this.toDeviceCalendarEntry(newEntryParsed, targetCalendarId, targetCalendar.name, targetCredentialId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private toAppleCalendarCalendar(cal: any): AppleCalendarCalendar {
    //href: '/430551058/calendars/21B93EDB-26F3-4BA9-85AD-3A38D66D4F6A/'
    //-> 21B93EDB-26F3-4BA9-85AD-3A38D66D4F6A
    let href = String(cal.data.href ?? "").trim();
    if(href.endsWith('/')) {
      href = href.slice(0, -1);
    }
    const id = href.split('/').pop() ?? crypto.randomUUID();
    return {
      id: id,
      ctag: cal.ctag,
      description: cal.description,
      displayName: cal.displayName,
      reports: cal.reports,
      syncToken: cal.syncToken,
      url: cal.url,
      timezone: cal.timezone,
      data: cal.data
    };
  }

  private toAppleCalendarCalendarEntries(ojects: any[]): AppleCalendarCalendarEntry[] {
    return ojects.map(obj => this.toAppleCalendarCalendarEntry(obj));
  }

  private toAppleCalendarCalendarEntry(obj: any): AppleCalendarCalendarEntry {
    const id = (obj.url?? "123/" + crypto.randomUUID()).split('/').pop().replace('.ics', '');
    return {
      id: id,
      data: obj.data,
      etag: obj.etag,
      url: obj.url,
      calendarDataParsed: parseVEventFromIcs(obj.calendarData),
    };
  }

  public toDeviceCalendarEntry(entry: AppleCalendarCalendarEntry, calendarId: string, calendarName:string, credentialsId: string): DeviceCalendarEntry {
    return {
      id: entry.id,
      calendarId: calendarId,
      calendarName: calendarName,
      moduleId: APPLECALENDARMODULE.id,
      title: entry.calendarDataParsed.summary ?? "(ohne Titel)",
      description: entry.calendarDataParsed.description,
      location: entry.calendarDataParsed.location,
      start: entry.calendarDataParsed.start?.toISOString() ?? "",
      end: entry.calendarDataParsed.end?.toISOString() ?? "",
      allDay: entry.calendarDataParsed.allDay,
      notificationEnabled: true,
      attendees: entry.calendarDataParsed.attendees ?? [],
      organizer: entry.calendarDataParsed.organizer ?? { name: "", email: "" },
      status: "",
      recurrenceRule: entry.calendarDataParsed.recurrenceRule ?? "",
      updatedAt: entry.calendarDataParsed.lastModified?.toISOString() ?? new Date().toISOString(),
      properties: {
        ...entry,
        credentialId: credentialsId
      }
    };
  }

  public toDeviceCalendarCalendar(calendar: AppleCalendarCalendar, credentialsId: string, existingCalendar:CalendarConfig | undefined = undefined): CalendarConfig {
    const color = existingCalendar?.color ?? "#000000";
    const show = existingCalendar?.show ?? true;
    const entries = existingCalendar?.entries ?? [];
    return {
      id: calendar.id,
      name: calendar.displayName,
      show: show,
      color: color,
      moduleId: APPLECALENDARMODULE.id,
      entries: entries,
      properties: {
        ...calendar,
        credentialId: credentialsId
      }
    }
  }

  public toDeviceCalendarCalendarWithEntries(calendar: AppleCalendarCalendar, credentialsId: string, entries: DeviceCalendarEntry[], existingCalendar:CalendarConfig | undefined = undefined): CalendarConfig {
    const cal = this.toDeviceCalendarCalendar(calendar, credentialsId, existingCalendar);
    const es = entries ?? [];
    cal.entries = es;
    return cal;
  }

  private async resolveCalendar(calendarId: string, credentialId: string): Promise<{ cal: any, xhr: any }> {
    const account = await this.discover.buildAccount(credentialId);
    const xhr = this.discover.buildXhr(credentialId);
    const calendars = Array.isArray(account?.calendars) ? account.calendars : [];
    const cal = calendars.find((c: any) => String(this.toAppleCalendarCalendar(c)?.id ?? "") === calendarId);
    if (!cal) throw new Error(`CalDAV Kalender '${calendarId}' wurde nicht gefunden`);
    return { cal, xhr };
  }

  private extractEtagFromDavResponse(updateResult: any): string | undefined {
    if (!updateResult || typeof updateResult.getResponseHeader !== "function") {
      return undefined;
    }

    const etag = String(updateResult.getResponseHeader("etag") ?? "").trim();
    return etag || undefined;
  }

  private async readCurrentEtag(calendarId: string, credentialId: string, url: string, xhr: any): Promise<string | undefined> {
    try {
      const { cal } = await this.resolveCalendar(calendarId, credentialId);
      const objects = await dav.listCalendarObjects(cal, { xhr });
      const urlNormalized = this.normalizeUrl(url);
      const target = (Array.isArray(objects) ? objects : []).find((obj: any) => this.normalizeUrl(String(obj?.url ?? "")) === urlNormalized);
      const etag = String(target?.etag ?? "").trim();
      return etag || undefined;
    } catch {
      return undefined;
    }
  }

  private normalizeUrl(url: string): string {
    return String(url ?? "").trim().replace(/\/+$/, "");
  }

  private buildCalendarObjectUrl(calendarUrl: string, filename: string): string {
    const base = this.normalizeUrl(calendarUrl);
    const file = String(filename ?? "").trim().replace(/^\/+/, "");
    return `${base}/${file}`;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message || "Unbekannter Fehler";
    }
    return String(error ?? "Unbekannter Fehler");
  }

  public async startEventStream(_device: DeviceCalendar, _callback: (event: AppleCalendarEvent) => void): Promise<void> {
    const previousNames = new Map<string, string>();
    const localCalendars = Array.isArray(_device.calendars)
      ? _device.calendars.filter(cal => cal?.moduleId === APPLECALENDARMODULE.id)
      : [];

    for (const localCalendar of localCalendars) {
      previousNames.set(String(localCalendar.id), String(localCalendar.name ?? ""));
    }

    const calendars = await this.getCalendarsWithEntries();
    const currentCalendarIds = new Set<string>();
    for (const calendarWithEntries of calendars) {
      const calendarId = String(calendarWithEntries.calendar.id ?? "");
      currentCalendarIds.add(calendarId);
      const newName = String(calendarWithEntries.calendar.data.props.displayname ?? "");
      const oldName = previousNames.get(calendarId);

      if (oldName !== undefined && oldName !== newName) {
        _callback({
          deviceId: _device.id ?? DEFAULT_CALENDAR_DEVICE_ID,
          type: "cal-name-changed",
          calendarId,
          calendarName: newName
        });
      }

      if(!previousNames.has(calendarId)) {
        _callback({
          deviceId: _device.id ?? DEFAULT_CALENDAR_DEVICE_ID,
          type: "cal-added",
          calendarId,
          calendar: this.toDeviceCalendarCalendar(calendarWithEntries.calendar, calendarWithEntries.credentialId)
        });
      }

      _callback({
        deviceId: _device.id ?? DEFAULT_CALENDAR_DEVICE_ID,
        type: "update-cal-entries",
        entries: calendarWithEntries.entries.map(e => this.toDeviceCalendarEntry(e, calendarId, calendarWithEntries.calendar.displayName, calendarWithEntries.credentialId)),
        calendarId
      });
    }

    for (const previousCalendarId of previousNames.keys()) {
      if (currentCalendarIds.has(previousCalendarId)) {
        continue;
      }
      _callback({
        deviceId: _device.id ?? DEFAULT_CALENDAR_DEVICE_ID,
        type: "cal-deleted",
        calendarId: previousCalendarId
      });
    }
  }

  public async stopEventStream(_device: DeviceCalendar): Promise<void> {
    // AppleCalendar nutzt im Modulmanager Polling fuer alle Kalender.
  }
}

function buildTimeRangeFilter(from: Date, to: Date) {
  const start = toCaldavUtc(from);
  const end = toCaldavUtc(to);
  return [
    {
      type: "comp-filter",
      attrs: { name: "VCALENDAR" },
      children: [
        {
          type: "comp-filter",
          attrs: { name: "VEVENT" },
          children: [{ type: "time-range", attrs: { start, end } }]
        }
      ]
    }
  ];
}

function toCaldavUtc(d: Date) {
  const iso = d.toISOString();
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

