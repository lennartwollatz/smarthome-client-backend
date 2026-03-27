import { Router } from "express";
import type { AutoUpdateSettings } from "../entities/settings/AutoUpdateSettings.js";
import type { Settings } from "../entities/settings/Settings.js";
import type { ServerDeps } from "../server.js";

export function createSettingsRouter(deps: ServerDeps) {
  const router = Router();
  const sm = deps.settingManager;

  router.get("/", (_req, res) => {
    const settings = sm.loadOrCreateSettings();
    res.status(200).json(settings);
  });

  router.put("/", (req, res) => {
    const settings = sm.updateFullSettings(req.body as Settings);
    res.status(200).json(settings);
  });

  router.put("/notifications", (req, res) => {
    const notifications = sm.updateNotifications(req.body as Record<string, unknown>);
    res.status(200).json(notifications);
  });

  router.put("/privacy", (req, res) => {
    const privacy = sm.updatePrivacy(req.body as Record<string, unknown>);
    res.status(200).json(privacy);
  });

  router.delete("/data", (_req, res) => {
    res.status(204).json("");
  });

  router.delete("/factory-reset", (_req, res) => {
    const defaults = sm.factoryReset();
    res.status(200).json(defaults);
  });

  /** Unterpfade: /api/settings/system/… (gleiche URLs wie zuvor eigenes System-Router-Mount) */
  router.get("/system/info", (_req, res) => {
    res.status(200).json(sm.getSystemInfo());
  });

  router.post("/system/install-update", (req, res) => {
    const component = (req.body as { component?: string }).component ?? "";
    const response = sm.applyInstallUpdate(component);
    res.status(200).json(response);
  });

  router.put("/system/auto-update", (req, res) => {
    const body = sm.updateAutoUpdateSettings(req.body as AutoUpdateSettings);
    res.status(200).json(body);
  });

  return router;
}
