import { logger } from "../../../config/logger.js";
import type { MatterPresenceDeviceManager } from "../../../modules/presence/MatterPresenceDeviceManager.js";
import type { Request_PresenceSetAbsent } from "../../../model/requests/Request_PresenceSetAbsent.js";
import type { Request_PresenceSetPresent } from "../../../model/requests/Request_PresenceSetPresent.js";
import type { Request_PresenceTogglePresence } from "../../../model/requests/Request_PresenceTogglePresence.js";
import { Response_Failure } from "../../../model/responses/Response_Failure.js";
import { Response_PresenceSetAbsent } from "../../../model/responses/Response_PresenceSetAbsent.js";
import { Response_PresenceSetPresent } from "../../../model/responses/Response_PresenceSetPresent.js";
import { Response_PresenceTogglePresence } from "../../../model/responses/Response_PresenceTogglePresence.js";
import { ApiError } from "../../http/ApiError.js";

const PRESENCE_DEVICE_PREFIX = "presence-";

export class PresenceService {
  constructor(private readonly presenceManager: MatterPresenceDeviceManager) {}

  setPresent(request: Request_PresenceSetPresent): Response_PresenceSetPresent {
    const userId = this.requireUserId(request.deviceId);
    this.changePresence(() => this.presenceManager.setPresenceState(userId, true), "Fehler beim Setzen des Presence-Status");
    return new Response_PresenceSetPresent();
  }

  setAbsent(request: Request_PresenceSetAbsent): Response_PresenceSetAbsent {
    const userId = this.requireUserId(request.deviceId);
    this.changePresence(() => this.presenceManager.setPresenceState(userId, false), "Fehler beim Setzen des Presence-Status");
    return new Response_PresenceSetAbsent();
  }

  togglePresence(request: Request_PresenceTogglePresence): Response_PresenceTogglePresence {
    const userId = this.requireUserId(request.deviceId);
    this.changePresence(() => this.presenceManager.togglePresence(userId), "Fehler beim Toggle des Presence-Status");
    return new Response_PresenceTogglePresence();
  }

  /** Anwesenheitsgeräte heißen `presence-<userId>`. */
  private requireUserId(deviceId: string): string {
    const userId = deviceId.startsWith(PRESENCE_DEVICE_PREFIX) ? deviceId.slice(PRESENCE_DEVICE_PREFIX.length) : "";
    if (!userId) throw new ApiError(404, new Response_Failure("Device not found"));
    return userId;
  }

  private changePresence(change: () => boolean, errorLogMessage: string): void {
    try {
      if (change()) return;
    } catch (err) {
      logger.error({ err }, errorLogMessage);
    }
    throw new ApiError(400, new Response_Failure());
  }
}
