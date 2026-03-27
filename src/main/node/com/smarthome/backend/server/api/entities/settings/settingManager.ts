import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import os from "node:os";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { AutoUpdateSettings } from "./AutoUpdateSettings.js";
import { GeneralSettings } from "./GeneralSettings.js";
import { NotificationSettings } from "./NotificationSettings.js";
import { PrivacySettings } from "./PrivacySettings.js";
import { Settings } from "./Settings.js";
import { SystemInfo } from "./SystemInfo.js";
import { SystemSettings } from "./SystemSettings.js";
import { VersionInfo } from "./VersionInfo.js";
import { LiveUpdateService } from "../../services/live.service.js";
import { EntityManager } from "../EntityManager.js";

const MAIN_SETTINGS_ID = "main-settings";

export class SettingManager implements EntityManager {
  private settingsRepository: JsonRepository<Settings>;
  private liveUpdateService?: LiveUpdateService;

  constructor(databaseManager: DatabaseManager) {
    this.settingsRepository = new JsonRepository<Settings>(databaseManager, "Settings");
  }

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  loadOrCreateSettings(): Settings {
    const existing = this.settingsRepository.findById(MAIN_SETTINGS_ID);
    const settings = existing ?? this.createDefaultSettings();

    this.initializeSystemSettings(settings);
    this.updateServerIp(settings);
    this.settingsRepository.save(MAIN_SETTINGS_ID, settings);
    return settings;
  }

  saveSettings(settings: Settings): void {
    this.settingsRepository.save(MAIN_SETTINGS_ID, settings);
  }

  /**
   * Vollständiges Settings-Objekt aus dem Client übernehmen, Server-IP u. a. ableiten, persistieren.
   */
  updateFullSettings(settings: Settings): Settings {
    this.updateServerIp(settings);
    this.settingsRepository.save(MAIN_SETTINGS_ID, settings);
    return settings;
  }

  updateNotifications(notifications: Record<string, unknown>): Record<string, unknown> {
    const settings = this.settingsRepository.findById(MAIN_SETTINGS_ID) ?? this.createDefaultSettings();
    settings.notifications = notifications;
    this.updateServerIp(settings);
    this.settingsRepository.save(MAIN_SETTINGS_ID, settings);
    return settings.notifications as Record<string, unknown>;
  }

  updatePrivacy(privacy: Record<string, unknown>): Record<string, unknown> {
    const settings = this.settingsRepository.findById(MAIN_SETTINGS_ID) ?? this.createDefaultSettings();
    settings.privacy = privacy;
    this.updateServerIp(settings);
    this.settingsRepository.save(MAIN_SETTINGS_ID, settings);
    return settings.privacy as Record<string, unknown>;
  }

  /** Werkseinstellungen herstellen und speichern. */
  factoryReset(): Settings {
    const defaults = this.createDefaultSettings();
    this.settingsRepository.save(MAIN_SETTINGS_ID, defaults);
    return defaults;
  }

  /** Aggregiert Frontend-/Backend-Versionen und Server-IP aus den Einstellungen. */
  getSystemInfo(): SystemInfo {
    const settings = this.loadOrCreateSettings();
    const systemSettings = (settings.system ?? {}) as SystemSettings;
    return this.systemInfoFromSystemSettings(systemSettings);
  }

  /**
   * Installiert ein Komponenten-Update (Frontend/Backend): currentVersion = latestVersion, hasUpdate = false, speichert.
   */
  applyInstallUpdate(component: string): SystemInfo {
    const settings = this.loadOrCreateSettings();
    const systemSettings = (settings.system ?? {}) as SystemSettings;

    if (component === "frontend" && systemSettings.frontend) {
      systemSettings.frontend.currentVersion = systemSettings.frontend.latestVersion;
      systemSettings.frontend.hasUpdate = false;
    } else if (component === "backend" && systemSettings.backend) {
      systemSettings.backend.currentVersion = systemSettings.backend.latestVersion;
      systemSettings.backend.hasUpdate = false;
    }

    settings.system = systemSettings;
    this.saveSettings(settings);

    return this.systemInfoFromSystemSettings(systemSettings);
  }

  private systemInfoFromSystemSettings(systemSettings: SystemSettings): SystemInfo {
    return new SystemInfo({
      frontend: systemSettings.frontend,
      backend: systemSettings.backend,
      serverIp: systemSettings.serverIp,
    });
  }

  /** Auto-Update-Optionen im System-Block mergen und speichern. */
  updateAutoUpdateSettings(autoUpdate: AutoUpdateSettings): AutoUpdateSettings {
    const settings = this.loadOrCreateSettings();
    const systemSettings = (settings.system ?? {}) as SystemSettings;

    if (autoUpdate.autoupdate != null) {
      systemSettings.autoupdate = autoUpdate.autoupdate;
    }
    if (autoUpdate.updatetimes != null) {
      systemSettings.updatetimes = autoUpdate.updatetimes;
    }

    settings.system = systemSettings;
    this.saveSettings(settings);
    return autoUpdate;
  }

  private createDefaultSettings(): Settings {
    const settings: Settings = {};
    settings.allgemein = {
      name: "Mein Smart Home",
      sprache: "de",
      temperatur: "celsius",
    } as GeneralSettings;
    settings.notifications = {
      security: true,
      batterystatus: true,
      energyreport: false,
    } as NotificationSettings;
    settings.privacy = {
      ailearning: true,
    } as PrivacySettings;
    settings.system = {
      autoupdate: true,
      updatetimes: {
        from: "02:00",
        to: "05:00",
      },
    } as SystemSettings;
    this.initializeSystemSettings(settings);
    return settings;
  }

  private initializeSystemSettings(settings: Settings): void {
    const config = this.loadConfiguration();
    if (!settings.system) settings.system = {} as SystemSettings;

    const frontendCurrent = this.getProperty(config, "version.frontend.current", "1.0.0");
    const frontendLatest = this.getProperty(config, "version.frontend.latest", "1.0.0");
    const backendCurrent = this.getProperty(config, "version.backend.current", "1.0.0");
    const backendLatest = this.getProperty(config, "version.backend.latest", "1.0.0");

    settings.system.frontend = {
      currentVersion: frontendCurrent,
      latestVersion: frontendLatest,
      hasUpdate: frontendCurrent !== frontendLatest,
    } as VersionInfo;
    settings.system.backend = {
      currentVersion: backendCurrent,
      latestVersion: backendLatest,
      hasUpdate: backendCurrent !== backendLatest,
    } as VersionInfo;
  }

  private updateServerIp(settings: Settings): void {
    if (!settings.system) settings.system = {} as SystemSettings;
    settings.system.serverIp = this.getLocalNetworkIpAddress();
  }

  private getLocalNetworkIpAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const entries = interfaces[name] ?? [];
      for (const entry of entries) {
        if (entry.family === "IPv4" && !entry.internal && entry.address !== "0.0.0.0") {
          return entry.address;
        }
      }
    }
    return "localhost";
  }

  private loadConfiguration(): Record<string, string> {
    const configPath = resolve(process.cwd(), "..", "resources", "application.properties");
    try {
      const content = readFileSync(configPath, "utf8");
      const result: Record<string, string> = {};
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const index = trimmed.indexOf("=");
        if (index === -1) continue;
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim();
        result[key] = value;
      }
      return result;
    } catch {
      return {};
    }
  }

  private getProperty(config: Record<string, string>, key: string, defaultValue: string): string {
    return process.env[key] ?? config[key] ?? defaultValue;
  }
}
