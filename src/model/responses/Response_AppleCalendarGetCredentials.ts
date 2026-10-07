import type { Response_AppleCalendarCredentials } from "./Response_AppleCalendarCredentials.js";

/** GET /api/modules/calendar-apple/credentials – Antwort ist das Array aller Zugänge. */
export class Response_AppleCalendarGetCredentials {
  constructor(readonly credentials: Response_AppleCalendarCredentials[]) {}

  toJSON(): Response_AppleCalendarCredentials[] {
    return this.credentials;
  }
}
