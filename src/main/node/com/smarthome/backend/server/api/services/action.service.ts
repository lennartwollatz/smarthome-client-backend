import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { Action } from "../../actions/action/Action.js";
import type { RouterDeps } from "../router.js";

export function createActionRouter(deps: RouterDeps) {
  const router = Router();

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

