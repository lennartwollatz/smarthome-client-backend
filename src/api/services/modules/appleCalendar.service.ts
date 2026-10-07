import { logger } from "../../../config/logger.js";
import type { Request_AppleCalendarDeleteCredentials } from "../../../model/requests/Request_AppleCalendarDeleteCredentials.js";
import type { Request_AppleCalendarGetCalendars } from "../../../model/requests/Request_AppleCalendarGetCalendars.js";
import type { Request_AppleCalendarGetCredentials } from "../../../model/requests/Request_AppleCalendarGetCredentials.js";
import type { Request_AppleCalendarPairCredentials } from "../../../model/requests/Request_AppleCalendarPairCredentials.js";
import type { Request_AppleCalendarSetCredentials } from "../../../model/requests/Request_AppleCalendarSetCredentials.js";
import type { Request_AppleCalendarSetPassword } from "../../../model/requests/Request_AppleCalendarSetPassword.js";
import type { Request_AppleCalendarSetServer } from "../../../model/requests/Request_AppleCalendarSetServer.js";
import { Response_AppleCalendarCredentials } from "../../../model/responses/Response_AppleCalendarCredentials.js";
import { Response_AppleCalendarDeleteCredentials } from "../../../model/responses/Response_AppleCalendarDeleteCredentials.js";
import { Response_AppleCalendarGetCalendars } from "../../../model/responses/Response_AppleCalendarGetCalendars.js";
import { Response_AppleCalendarGetCredentials } from "../../../model/responses/Response_AppleCalendarGetCredentials.js";
import { Response_AppleCalendarPairCredentials } from "../../../model/responses/Response_AppleCalendarPairCredentials.js";
import { Response_AppleCalendarSetCredentials } from "../../../model/responses/Response_AppleCalendarSetCredentials.js";
import { Response_AppleCalendarSetPassword } from "../../../model/responses/Response_AppleCalendarSetPassword.js";
import { Response_AppleCalendarSetServer } from "../../../model/responses/Response_AppleCalendarSetServer.js";
import { Response_Error } from "../../../model/responses/Response_Error.js";
import type { AppleCalendarModuleManager } from "../../../modules/appleCalendar/appleCalendarModuleManager.js";
import { ApiError } from "../../http/ApiError.js";

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || "Unbekannter Fehler";
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unbekannter Fehler";
  }
}

/** Fehlende Zugangsdaten sind ein Fehler der Anfrage (400), alles andere ein Serverfehler (500). */
function isCredentialsErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("caldav username ist nicht gesetzt") || normalized.includes("caldav password ist nicht gesetzt");
}

export class AppleCalendarService {
  constructor(private readonly appleModule: AppleCalendarModuleManager) {}

  async getCredentials(_request: Request_AppleCalendarGetCredentials): Promise<Response_AppleCalendarGetCredentials> {
    const infos = await this.appleModule.getCredentialInfos();
    return new Response_AppleCalendarGetCredentials(infos.map(info => new Response_AppleCalendarCredentials(info)));
  }

  async setCredentials(request: Request_AppleCalendarSetCredentials): Promise<Response_AppleCalendarSetCredentials> {
    await this.appleModule.setCredentials(
      request.credentialsId,
      request.username,
      request.password ?? undefined,
      request.server ?? undefined
    );
    return new Response_AppleCalendarSetCredentials(await this.appleModule.getCredentialsInfo(request.credentialsId));
  }

  async setPassword(request: Request_AppleCalendarSetPassword): Promise<Response_AppleCalendarSetPassword> {
    await this.appleModule.setPassword(request.credentialsId, request.password);
    return new Response_AppleCalendarSetPassword(await this.appleModule.getCredentialsInfo(request.credentialsId));
  }

  async setServer(request: Request_AppleCalendarSetServer): Promise<Response_AppleCalendarSetServer> {
    await this.appleModule.setServer(request.credentialsId, request.server);
    return new Response_AppleCalendarSetServer(await this.appleModule.getCredentialsInfo(request.credentialsId));
  }

  async deleteCredentials(request: Request_AppleCalendarDeleteCredentials): Promise<Response_AppleCalendarDeleteCredentials> {
    try {
      await this.appleModule.deleteCredentials(request.credentialsId);
    } catch (err) {
      logger.error({ err, credentialsId: request.credentialsId }, "Fehler beim Löschen der Apple-Calendar Credentials");
      throw ApiError.internal(toErrorMessage(err) || "Fehler beim Löschen der Credentials");
    }
    return new Response_AppleCalendarDeleteCredentials();
  }

  async pairCredentials(request: Request_AppleCalendarPairCredentials): Promise<Response_AppleCalendarPairCredentials> {
    let valid: boolean;
    try {
      valid = await this.appleModule.testCredentials(request.credentialsId);
    } catch (err) {
      const message = toErrorMessage(err);
      logger.error({ err, credentialsId: request.credentialsId }, "Fehler beim Pairing des Apple-Calendar Accounts");
      throw new ApiError(isCredentialsErrorMessage(message) ? 400 : 500, new Response_Error(message || "Fehler beim Pairing"));
    }
    if (!valid) throw ApiError.badRequest("CalDAV Credentials ungültig");
    return new Response_AppleCalendarPairCredentials();
  }

  async getCalendars(request: Request_AppleCalendarGetCalendars): Promise<Response_AppleCalendarGetCalendars> {
    try {
      return new Response_AppleCalendarGetCalendars(await this.appleModule.initCalendars(request.credentialsId));
    } catch (err) {
      logger.error({ err, credentialsId: request.credentialsId }, "Fehler beim Laden der Kalender für Apple-Calendar");
      throw ApiError.internal(toErrorMessage(err) || "Fehler beim Laden der Kalender");
    }
  }
}
