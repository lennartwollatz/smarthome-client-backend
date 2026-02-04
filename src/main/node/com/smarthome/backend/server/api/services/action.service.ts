import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { ActionManager } from "../../actions/actionManager.js";
import type { Action } from "../../../model/index.js";

type Deps = {
  actionManager: ActionManager;
};

export function createActionRouter(deps: Deps) {
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

  return router;
}

