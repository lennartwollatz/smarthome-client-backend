import type { PrivacySettings } from "../PrivacySettings.js";

/** PUT /api/settings/privacy – die gespeicherten Datenschutzeinstellungen. */
export class Response_UpdatePrivacySettings {
  readonly ailearning?: boolean;

  constructor(privacy: PrivacySettings) {
    this.ailearning = privacy.ailearning;
  }
}
