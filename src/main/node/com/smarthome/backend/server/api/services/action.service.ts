import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { Action } from "../entities/actions/action/Action.js";
import type { ServerDeps } from "../server.js";
import { VoiceAssistantCommandAction } from "../modules/matter/voiceAssistantCommandMapping.js";

export function createActionRouter(deps: ServerDeps) {
  const router = Router();

  router.post("/:actionId/voice-assistant", async (req, res) => {
    const { keyword, actionType } = req.body as { keyword: string; actionType?: VoiceAssistantCommandAction };
    const actionId = req.params.actionId;
    if (!actionId) {
      res.status(400).json({ error: "Action ID is required" });
      return;
    }
    const trimmed = typeof keyword === "string" ? keyword.trim() : "";
    if (!trimmed || trimmed.includes(" ")) {
      res.status(400).json({ error: "Keyword muss ein einzelnes Wort sein" });
      return;
    }
    try {
      const result = await deps.actionManager.createVoiceAssistantForActionId(actionId, trimmed, actionType, undefined);
      if(!result) {
        res.status(400).json({ error: "Fehler beim Erstellen des Voice-Assistant-Device" });
      } else {
        res.status(200).json(result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "Action not found") {
        res.status(404).json({ error: msg });
        return;
      }
      if (msg === "Workflow hat keinen Trigger-Knoten") {
        res.status(400).json({ error: msg });
        return;
      }
      res.status(500).json({ error: "Fehler beim Erstellen des Voice-Assistant-Device" });
    }
  });

  router.get("/", (_req, res) => {
    res.status(200).json(deps.actionManager.getActions());
  });

  router.post("/", (req, res) => {
    const action = req.body as Action;
    if (!action.actionId) {
      action.actionId = `action-${randomUUID()}`;
    }
    const now = new Date().toISOString();
    if (!action.createdAt) {
      action.createdAt = now;
    }
    action.updatedAt = now;

    const success = deps.actionManager.addAction(action);
    if (success) {
      res.status(200).json(action);
    } else {
      res.status(400).json({ error: `Action not created: ${action.actionId}` });
    }
  });

  router.get("/:actionId", (req, res) => {
    const action = deps.actionManager.getAction(req.params.actionId);
    if (action) {
      res.status(200).json(action);
    } else {
      res.status(404).json({ error: "Action not found" });
    }
  });

  router.put("/:actionId", (req, res) => {
    const action = req.body as Action;
    action.actionId = req.params.actionId;
    action.updatedAt = new Date().toISOString();

    const success = deps.actionManager.updateAction(action);
    if (success) {
      res.status(200).json(action);
    } else {
      res.status(400).json({ error: `Action not created: ${action.actionId}` });
    }
  });

  router.delete("/:actionId", (req, res) => {
    const deleted = deps.actionManager.deleteAction(req.params.actionId);
    if (deleted) {
      res.status(200).json(true);
    } else {
      res.status(404).json({ error: "Action not found" });
    }
  });

  router.post("/:actionId/activate", (req, res) => {
    const action = deps.actionManager.activateAction(req.params.actionId);
    if (action) {
      res.status(200).json(action);
    } else {
      res.status(404).json({ error: "Action not found" });
    }
  });

  router.post("/:actionId/deactivate", (req, res) => {
    const action = deps.actionManager.deactivateAction(req.params.actionId);
    if (action) {
      res.status(200).json(action);
    } else {
      res.status(404).json({ error: "Action not found" });
    }
  });

  router.post("/:actionId/reject", (req, res) => {
    const rejected = deps.actionManager.rejectAiSuggestion(req.params.actionId);
    if (rejected) {
      res.status(200).json(true);
    } else {
      res.status(400).json({ error: "Action not found or not an AI suggestion" });
    }
  });

  return router;
}

