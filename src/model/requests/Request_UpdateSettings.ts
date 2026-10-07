import {
  Request_GeneralSettings,
  Request_NotificationSettings,
  Request_PrivacySettings,
  Request_SystemSettings
} from "./Request_Settings.js";

/** PUT /api/settings – ersetzt alle gespeicherten Einstellungen. */
export class Request_UpdateSettings {
  readonly allgemein?: Request_GeneralSettings | null;
  readonly notifications?: Request_NotificationSettings | null;
  readonly privacy?: Request_PrivacySettings | null;
  readonly system?: Request_SystemSettings | null;

  constructor(fields: Request_UpdateSettings) {
    this.allgemein = fields.allgemein && new Request_GeneralSettings(fields.allgemein);
    this.notifications = fields.notifications && new Request_NotificationSettings(fields.notifications);
    this.privacy = fields.privacy && new Request_PrivacySettings(fields.privacy);
    this.system = fields.system && new Request_SystemSettings(fields.system);
  }
}
