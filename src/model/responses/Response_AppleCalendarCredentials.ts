import type { AppleCalendarCredentialsInfo } from "../../modules/appleCalendar/appleCalendarDeviceDiscover.js";

/** CalDAV-Zugang ohne Passwort, wie ihn die Apple-Calendar-Endpunkte zurückgeben. */
export class Response_AppleCalendarCredentials {
  readonly id: string;
  readonly username: string;
  readonly server?: string;
  readonly hasPassword: boolean;

  constructor(info: AppleCalendarCredentialsInfo) {
    this.id = info.id;
    this.username = info.username;
    this.server = info.server;
    this.hasPassword = info.hasPassword;
  }
}
