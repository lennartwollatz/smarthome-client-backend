/** Zeile der Tabelle `device_calendar_entries`. */
export class DbDeviceCalendarEntry {
  readonly calendarId!: string;
  readonly id!: string;
  readonly sortIndex!: number;
  readonly title!: string;
  readonly description!: string | null;
  readonly location!: string | null;
  readonly eventUrl!: string | null;
  readonly startsAt!: string;
  readonly endsAt!: string;
  readonly isAllDay!: boolean | null;
  readonly isNotificationEnabled!: boolean;
  readonly status!: string | null;
  readonly recurrenceRule!: string | null;
  readonly remoteUpdatedAt!: string;
  readonly remoteUrl!: string | null;
  readonly etag!: string | null;
  readonly icalUid!: string | null;

  constructor(fields: DbDeviceCalendarEntry) {
    Object.assign(this, fields);
  }
}
