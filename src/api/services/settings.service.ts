import os from "node:os";
import { getAppConfig, type VersionConfig } from "../../config/appConfig.js";
import type { SettingsRepository } from "../../db/repositories/SettingsRepository.js";
import { GeneralSettings } from "../../model/GeneralSettings.js";
import { NotificationSettings } from "../../model/NotificationSettings.js";
import { PrivacySettings } from "../../model/PrivacySettings.js";
import { Settings } from "../../model/Settings.js";
import { SystemSettings } from "../../model/SystemSettings.js";
import { UpdateTimes } from "../../model/UpdateTimes.js";
import { VersionInfo } from "../../model/VersionInfo.js";
import type { Request_DeleteAllData } from "../../model/requests/Request_DeleteAllData.js";
import type { Request_FactoryReset } from "../../model/requests/Request_FactoryReset.js";
import type { Request_GetSettings } from "../../model/requests/Request_GetSettings.js";
import type {
  Request_GeneralSettings,
  Request_NotificationSettings,
  Request_PrivacySettings,
  Request_SystemSettings,
  Request_UpdateTimes
} from "../../model/requests/Request_Settings.js";
import type { Request_UpdateNotificationSettings } from "../../model/requests/Request_UpdateNotificationSettings.js";
import type { Request_UpdatePrivacySettings } from "../../model/requests/Request_UpdatePrivacySettings.js";
import type { Request_UpdateSettings } from "../../model/requests/Request_UpdateSettings.js";
import { Response_DeleteAllData } from "../../model/responses/Response_DeleteAllData.js";
import { Response_FactoryReset } from "../../model/responses/Response_FactoryReset.js";
import { Response_GetSettings } from "../../model/responses/Response_GetSettings.js";
import { Response_UpdateNotificationSettings } from "../../model/responses/Response_UpdateNotificationSettings.js";
import { Response_UpdatePrivacySettings } from "../../model/responses/Response_UpdatePrivacySettings.js";
import { Response_UpdateSettings } from "../../model/responses/Response_UpdateSettings.js";

/** Einstellungen inkl. der bei jedem Laden neu berechneten Systemwerte. */
type LoadedSettings = Settings & { system: SystemSettings };

export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getSettings(_request: Request_GetSettings): Promise<Response_GetSettings> {
    return new Response_GetSettings(await this.loadOrCreateSettings());
  }

  async updateSettings(request: Request_UpdateSettings): Promise<Response_UpdateSettings> {
    const settings = new Settings({
      allgemein: request.allgemein ? toGeneralSettings(request.allgemein) : undefined,
      notifications: request.notifications ? toNotificationSettings(request.notifications) : undefined,
      privacy: request.privacy ? toPrivacySettings(request.privacy) : undefined,
      system: request.system ? toSystemSettings(request.system) : undefined
    });
    await this.settingsRepository.save(settings);
    return new Response_UpdateSettings(withDerivedSystemValues(settings));
  }

  async updateNotificationSettings(
    request: Request_UpdateNotificationSettings
  ): Promise<Response_UpdateNotificationSettings> {
    const settings = await this.loadOrCreateSettings();
    const notifications = toNotificationSettings(request);
    settings.notifications = notifications;
    await this.settingsRepository.save(settings);
    return new Response_UpdateNotificationSettings(notifications);
  }

  async updatePrivacySettings(request: Request_UpdatePrivacySettings): Promise<Response_UpdatePrivacySettings> {
    const settings = await this.loadOrCreateSettings();
    const privacy = toPrivacySettings(request);
    settings.privacy = privacy;
    await this.settingsRepository.save(settings);
    return new Response_UpdatePrivacySettings(privacy);
  }

  deleteAllData(_request: Request_DeleteAllData): Response_DeleteAllData {
    return new Response_DeleteAllData();
  }

  async factoryReset(_request: Request_FactoryReset): Promise<Response_FactoryReset> {
    const settings = createDefaultSettings();
    await this.settingsRepository.save(settings);
    return new Response_FactoryReset(withDerivedSystemValues(settings));
  }

  /** Lädt die gespeicherten Einstellungen (beim ersten Aufruf die Standardwerte) inkl. der abgeleiteten Systemwerte. */
  async loadOrCreateSettings(): Promise<LoadedSettings> {
    let settings = await this.settingsRepository.load();
    if (!settings) {
      settings = createDefaultSettings();
      await this.settingsRepository.save(settings);
    }
    return withDerivedSystemValues(settings);
  }

  /** Übernimmt die gesetzten Auto-Update-Werte in die gespeicherten Systemeinstellungen. */
  async saveAutoUpdateSettings(autoUpdate: Request_SystemSettings): Promise<void> {
    const settings = await this.loadOrCreateSettings();
    if (autoUpdate.autoupdate != null) settings.system.autoupdate = autoUpdate.autoupdate;
    if (autoUpdate.updatetimes != null) settings.system.updatetimes = toUpdateTimes(autoUpdate.updatetimes);
    await this.settingsRepository.save(settings);
  }
}

function createDefaultSettings(): Settings {
  return new Settings({
    allgemein: new GeneralSettings({ name: "Mein Smart Home", sprache: "de", temperatur: "celsius" }),
    notifications: new NotificationSettings({ security: true, batterystatus: true, energyreport: false }),
    privacy: new PrivacySettings({ ailearning: true }),
    system: new SystemSettings({
      autoupdate: true,
      updatetimes: new UpdateTimes({ from: "02:00", to: "05:00" })
    })
  });
}

/** Setzt Versionen (aus der Konfiguration) und Server-IP; beide werden nie gespeichert. */
function withDerivedSystemValues(settings: Settings): LoadedSettings {
  const { frontendVersion, backendVersion } = getAppConfig();
  const system = settings.system ?? new SystemSettings();
  system.frontend = toVersionInfo(frontendVersion);
  system.backend = toVersionInfo(backendVersion);
  system.serverIp = getLocalNetworkIpAddress();
  return Object.assign(settings, { system });
}

function toVersionInfo(version: VersionConfig): VersionInfo {
  return new VersionInfo({
    currentVersion: version.current,
    latestVersion: version.latest,
    hasUpdate: version.current !== version.latest
  });
}

function getLocalNetworkIpAddress(): string {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal && entry.address !== "0.0.0.0") {
        return entry.address;
      }
    }
  }
  return "localhost";
}

function toGeneralSettings(fields: Request_GeneralSettings): GeneralSettings {
  return new GeneralSettings({
    name: fields.name ?? undefined,
    sprache: fields.sprache ?? undefined,
    temperatur: fields.temperatur ?? undefined
  });
}

function toNotificationSettings(fields: Request_NotificationSettings): NotificationSettings {
  return new NotificationSettings({
    security: fields.security ?? undefined,
    batterystatus: fields.batterystatus ?? undefined,
    energyreport: fields.energyreport ?? undefined
  });
}

function toPrivacySettings(fields: Request_PrivacySettings): PrivacySettings {
  return new PrivacySettings({ ailearning: fields.ailearning ?? undefined });
}

function toSystemSettings(fields: Request_SystemSettings): SystemSettings {
  return new SystemSettings({
    autoupdate: fields.autoupdate ?? undefined,
    updatetimes: fields.updatetimes ? toUpdateTimes(fields.updatetimes) : undefined
  });
}

function toUpdateTimes(fields: Request_UpdateTimes): UpdateTimes {
  return new UpdateTimes({ from: fields.from ?? undefined, to: fields.to ?? undefined });
}
