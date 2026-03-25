import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { Action } from "../../actions/action/Action.js";
import type { RouterDeps } from "../router.js";

export function createActionRouter(deps: RouterDeps) {
  const router = Router();

  router.post("/:actionId/voice-assistant", async (req, res) => {
    const { keyword } = req.body as { keyword: string };
    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0 || keyword.trim().includes(" ")) {
      res.status(400).json({ error: "Keyword muss ein einzelnes Wort sein" });
      return;
    }
    try {
      const result = await deps.voiceAssistantManager.createVoiceAssistantDevice(
        req.params.actionId,
        keyword.trim()
      );
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: "Fehler beim Erstellen des Voice-Assistant-Device" });
    }
  });

  router.delete("/:actionId/voice-assistant", async (req, res) => {
    try {
      await deps.voiceAssistantManager.removeVoiceAssistantDevice(req.params.actionId);
      res.status(200).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Fehler beim Loeschen des Voice-Assistant-Device" });
    }
  });

  router.get("/", (_req, res) => {
    const actions = deps.actionManager.getActions();
    res.status(200).json(actions);
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

