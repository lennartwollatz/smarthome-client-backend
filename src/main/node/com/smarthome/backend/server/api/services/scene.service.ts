import { Router } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../../../logger.js";
import { Scene } from "../entities/scenes/Scene.js";
import type { ServerDeps } from "../server.js";

async function runActionsForScene(deps: ServerDeps, actionIds: string[], sceneId: string, phase: "activate" | "deactivate"): Promise<void> {
  const unique = [...new Set(actionIds.filter((id) => typeof id === "string" && id.trim() !== ""))];
  for (const actionId of unique) {
    try {
      await deps.actionManager.runActionIgnoringTrigger(actionId);
    } catch (err) {
      logger.warn({ err, actionId, sceneId, phase }, "Szene: Aktion konnte nicht ausgefuehrt werden");
    }
  }
}

export function createSceneRouter(deps: ServerDeps) {
  const router = Router();

  router.get("/", (_req, res) => {
    const scenes = deps.sceneManager.getScenes();
    res.status(200).json(scenes);
  });

  router.post("/", (req, res) => {
    const scene = req.body as Scene;
    if (!scene.id) {
      scene.id = `scene-${randomUUID()}`;
    }
    if (scene.active == null) scene.active = false;
    if (scene.deactivateActionIds == null) scene.deactivateActionIds = [];

    const success = deps.sceneManager.addScene(scene);
    if (success) {
      res.status(200).json(scene);
    } else {
      res.status(400).json({ error: `Invalid scene data: ${scene.id}` });
    }
  });

  router.get("/:sceneId", (req, res) => {
    const scene = deps.sceneManager.getScene(req.params.sceneId);
    if (scene) {
      res.status(200).json(scene);
    } else {
      res.status(404).json({ error: "Scene not found" });
    }
  });

  router.put("/:sceneId", (req, res) => {
    const scene = req.body as Scene;
    scene.id = req.params.sceneId;
    const success = deps.sceneManager.updateScene(scene);
    if (success) {
      res.status(200).json(scene);
    } else {
      res.status(400).json({ error: `Invalid scene data: ${scene.id}` });
    }
  });

  router.delete("/:sceneId", (req, res) => {
    const deleted = deps.sceneManager.deleteScene(req.params.sceneId);
    if (deleted) {
      res.status(204).json("");
    } else {
      res.status(404).json({ error: "Scene not found" });
    }
  });

  router.post("/:sceneId/activate", async (req, res) => {
    const scene = deps.sceneManager.getScene(req.params.sceneId);
    if (!scene) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }
    scene.active = true;
    deps.sceneManager.updateScene(scene);
    const activateIds = scene.actionIds ?? [];
    await runActionsForScene(deps, activateIds, req.params.sceneId, "activate");
    res.status(200).json({ id: scene.id, name: scene.name, active: true });
  });

  router.post("/:sceneId/deactivate", async (req, res) => {
    const scene = deps.sceneManager.getScene(req.params.sceneId);
    if (!scene) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }
    scene.active = false;
    deps.sceneManager.updateScene(scene);
    const deactivateIds = scene.deactivateActionIds ?? [];
    await runActionsForScene(deps, deactivateIds, req.params.sceneId, "deactivate");
    res.status(200).json({ id: scene.id, name: scene.name, active: false });
  });

  return router;
}

