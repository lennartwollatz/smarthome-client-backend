import type { NotificationSettings } from "../NotificationSettings.js";

/** PUT /api/settings/notifications – die gespeicherten Benachrichtigungseinstellungen. */
export class Response_UpdateNotificationSettings {
  readonly security?: boolean;
  readonly batterystatus?: boolean;
  readonly energyreport?: boolean;

  constructor(notifications: NotificationSettings) {
    this.security = notifications.security;
    this.batterystatus = notifications.batterystatus;
    this.energyreport = notifications.energyreport;
  }
}
