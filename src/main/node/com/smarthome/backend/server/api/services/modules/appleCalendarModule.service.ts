import { Router } from "express";
import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { logger } from "../../../../logger.js";
import { AppleCalendarModuleManager } from "../../modules/appleCalendar/appleCalendarModuleManager.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || "Unbekannter Fehler";
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unbekannter Fehler";
  }
}

function isCredentialsErrorMessage(message: string): boolean {
  const m = (message ?? "").toLowerCase();
  return m.includes("caldav username ist nicht gesetzt") || m.includes("caldav password ist nicht gesetzt");
}

export function createAppleCalendarModuleRouter(deps: Deps) {
  const router = Router();
  const appleModule = new AppleCalendarModuleManager(deps.databaseManager, deps.actionManager, deps.eventStreamManager);
  deps.actionManager.registerModuleManager(appleModule);

  router.get("/credentials", (_req, res) => {
    // Passwort ist absichtlich write-only und wird nie zurueckgegeben.
    res.status(200).json(appleModule.getCredentialInfos());
  });

  router.put("/credentials/:credentialsId", (req, res) => {
    const credentialsId = req.params.credentialsId ?? "default";
    const usernameRaw = (req.body ?? {}).username;
    const passwordRaw = (req.body ?? {}).password;
    const serverRaw = (req.body ?? {}).server;

    const username = typeof usernameRaw === "string" ? usernameRaw.trim() : "";
    const password = typeof passwordRaw === "string" ? passwordRaw : undefined;
    const server = typeof serverRaw === "string" ? serverRaw.trim() : undefined;

    if (!username) {
      res.status(400).json({ error: "username ist erforderlich" });
      return;
    }

    appleModule.setCredentials(credentialsId, username, password, server);
    
    res.status(200).json(appleModule.getCredentialsInfo(credentialsId));
  });

  router.put("/credentials/:credentialsId/password", (req, res) => {
    const credentialsId = req.params.credentialsId ?? "default";
    const passwordRaw = (req.body ?? {}).password;
    const password = typeof passwordRaw === "string" ? passwordRaw : "";
    if (!password) {
      res.status(400).json({ error: "password ist erforderlich" });
      return;
    }
    appleModule.setPassword(credentialsId, password);

    res.status(200).json(appleModule.getCredentialsInfo(credentialsId));
  });

  router.put("/credentials/:credentialsId/server", (req, res) => {
    const credentialsId = req.params.credentialsId ?? "default";
    const serverRaw = (req.body ?? {}).server;
    const server = typeof serverRaw === "string" ? serverRaw.trim() : "";
    if (!server) {
      res.status(400).json({ error: "server ist erforderlich" });
      return;
    }
    appleModule.setServer(credentialsId, server);

    res.status(200).json(appleModule.getCredentialsInfo(credentialsId));
  });

  router.delete("/credentials/:credentialsId", (req, res) => {
    const credentialsId = req.params.credentialsId ?? "default";
    try {
      appleModule.deleteCredentials(credentialsId);
      res.status(200).json({ success: true });
    } catch (error) {
      const message = toErrorMessage(error);
      logger.error({ err: error, credentialsId }, "Fehler beim Löschen der Apple-Calendar Credentials");
      res.status(500).json({ error: message || "Fehler beim Löschen der Credentials" });
    }
  });

  router.post("/pair/:credentialsId", async (req, res) => {
    const credentialsId = req.params.credentialsId ?? "default";
    try {
      const ok = await appleModule.testCredentials(credentialsId);
      if (!ok) {
        res.status(400).json({ error: "CalDAV Credentials ungültig" });
        return;
      }
      res.status(200).json({ success: true });
    } catch (error) {
      const message = toErrorMessage(error);
      logger.error({ err: error, credentialsId }, "Fehler beim Pairing des Apple-Calendar Accounts");
      res.status(isCredentialsErrorMessage(message) ? 400 : 500).json({ error: message || "Fehler beim Pairing" });
    }
  });

  router.get("/calendars/:credentialsId", async (req, res) => {
    const credentialsId = req.params.credentialsId ?? "default";
    try {
      const calendars = await appleModule.initCalendars(credentialsId);
      res.status(200).json(calendars);
    } catch (error) {
      const message = toErrorMessage(error);
      logger.error({ err: error, credentialsId }, "Fehler beim Laden der Kalender für Apple-Calendar");
      res.status(500).json({ error: message || "Fehler beim Laden der Kalender" });
    }
  });

  return router;
}


