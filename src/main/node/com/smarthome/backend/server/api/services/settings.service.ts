import { Router } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import os from "node:os";
import type { DatabaseManager } from "../../db/database.js";
import { JsonRepository } from "../../db/jsonRepository.js";
import type {
  Settings,
  GeneralSettings,
  NotificationSettings,
  PrivacySettings,
  SystemSettings,
  UpdateTimes,
  VersionInfo
} from "../../../model/index.js";

type Deps = {
  databaseManager: DatabaseManager;
};

export function createSettingsRouter(deps: Deps) {
  const router = Router();
  const settingsRepository = new JsonRepository<Settings>(deps.databaseManager, "Settings");

  router.get("/", (_req, res) => {
    const settings = loadOrCreateSettings(settingsRepository);
    res.status(200).json(settings);
  });

  router.put("/", (req, res) => {
    const settings = req.body as Settings;
    updateServerIp(settings);
    settingsRepository.save("main-settings", settings);
    res.status(200).json(settings);
  });

  router.put("/notifications", (req, res) => {
    const settings = settingsRepository.findById("main-settings") ?? createDefaultSettings();
    settings.notifications = req.body as Record<string, unknown>;
    updateServerIp(settings);
    settingsRepository.save("main-settings", settings);
    res.status(200).json(settings.notifications);
  });

  router.put("/privacy", (req, res) => {
    const settings = settingsRepository.findById("main-settings") ?? createDefaultSettings();
    settings.privacy = req.body as Record<string, unknown>;
    updateServerIp(settings);
    settingsRepository.save("main-settings", settings);
    res.status(200).json(settings.privacy);
  });

  router.delete("/data", (_req, res) => {
    res.status(204).json("");
  });

  router.delete("/factory-reset", (_req, res) => {
    const defaults = createDefaultSettings();
    settingsRepository.save("main-settings", defaults);
    res.status(200).json(defaults);
  });

  return router;
}

export function loadOrCreateSettings(
  settingsRepository: JsonRepository<Settings>
): Settings {
  const existing = settingsRepository.findById("main-settings");
  const settings = existing ?? createDefaultSettings();

  initializeSystemSettings(settings);
  updateServerIp(settings);
  settingsRepository.save("main-settings", settings);
  return settings;
}

export function saveSettings(
  settingsRepository: JsonRepository<Settings>,
  settings: Settings
) {
  settingsRepository.save("main-settings", settings);
}

function createDefaultSettings(): Settings {
  const settings: Settings = {};
  settings.allgemein = {
    name: "Mein Smart Home",
    sprache: "de",
    temperatur: "celsius"
  } as GeneralSettings;
  settings.notifications = {
    security: true,
    batterystatus: true,
    energyreport: false
  } as NotificationSettings;
  settings.privacy = {
    ailearning: true
  } as PrivacySettings;
  settings.system = {
    autoupdate: true,
    updatetimes: {
      from: "02:00",
      to: "05:00"
    }
  } as SystemSettings;
  initializeSystemSettings(settings);
  return settings;
}

function initializeSystemSettings(settings: Settings) {
  const config = loadConfiguration();
  if (!settings.system) settings.system = {} as SystemSettings;

  const frontendCurrent = getProperty(config, "version.frontend.current", "1.0.0");
  const frontendLatest = getProperty(config, "version.frontend.latest", "1.0.0");
  const backendCurrent = getProperty(config, "version.backend.current", "1.0.0");
  const backendLatest = getProperty(config, "version.backend.latest", "1.0.0");

  settings.system.frontend = {
    currentVersion: frontendCurrent,
    latestVersion: frontendLatest,
    hasUpdate: frontendCurrent !== frontendLatest
  } as VersionInfo;
  settings.system.backend = {
    currentVersion: backendCurrent,
    latestVersion: backendLatest,
    hasUpdate: backendCurrent !== backendLatest
  } as VersionInfo;
}

function updateServerIp(settings: Settings) {
  if (!settings.system) settings.system = {} as SystemSettings;
  settings.system.serverIp = getLocalNetworkIpAddress();
}

function getLocalNetworkIpAddress(): string {
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

function loadConfiguration(): Record<string, string> {
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

function getProperty(
  config: Record<string, string>,
  key: string,
  defaultValue: string
) {
  return process.env[key] ?? config[key] ?? defaultValue;
}

