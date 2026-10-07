import { GeneralSettings } from "./GeneralSettings.js";
import { NotificationSettings } from "./NotificationSettings.js";
import { PrivacySettings } from "./PrivacySettings.js";
import { SystemSettings } from "./SystemSettings.js";

export class Settings {
  allgemein?: GeneralSettings;
  notifications?: NotificationSettings;
  privacy?: PrivacySettings;
  system?: SystemSettings;

  constructor(init?: Partial<Settings>) {
    Object.assign(this, init);
  }
}
