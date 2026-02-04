import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { DatabaseManager } from "../../db/database.js";
import type { EventStreamManager } from "../../events/eventStreamManager.js";
import type { ActionManager } from "../../actions/actionManager.js";
import type { Scene, SceneActivationResponse } from "../../../model/index.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createSceneRouter(deps: Deps) {
  const router = Router();

  router.get("/", (_req, res) => {
    const scenes = deps.actionManager.getScenes();
    res.status(200).json(scenes);
  });

  router.post("/", (req, res) => {
    const scene = req.body as Scene;
    if (!scene.id) {
      scene.id = `scene-${randomUUID()}`;
    }
    if (scene.active == null) scene.active = false;

    const success = deps.actionManager.addScene(scene);
    if (success) {
      res.status(200).json(scene);
    } else {
      res.status(400).json({ error: `Invalid scene data: ${scene.id}` });
    }
  });

  router.get("/:sceneId", (req, res) => {
    const scene = deps.actionManager.getScene(req.params.sceneId);
    if (scene) {
      res.status(200).json(scene);
    } else {
      res.status(404).json({ error: "Scene not found" });
    }
  });

  router.put("/:sceneId", (req, res) => {
    const scene = req.body as Scene;
    scene.id = req.params.sceneId;
    const success = deps.actionManager.updateScene(scene);
    if (success) {
      res.status(200).json(scene);
    } else {
      res.status(400).json({ error: `Invalid scene data: ${scene.id}` });
    }
  });

  router.delete("/:sceneId", (req, res) => {
    const deleted = deps.actionManager.deleteScene(req.params.sceneId);
    if (deleted) {
      res.status(204).json("");
    } else {
      res.status(404).json({ error: "Scene not found" });
    }
  });

  router.post("/:sceneId/activate", (req, res) => {
    const scene = deps.actionManager.getScene(req.params.sceneId);
    if (!scene) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }
    scene.active = true;
    deps.actionManager.saveScene(scene);
    res.status(200).json({ id: scene.id, name: scene.name, active: true });
  });

  router.post("/:sceneId/deactivate", (req, res) => {
    const scene = deps.actionManager.getScene(req.params.sceneId);
    if (!scene) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }
    scene.active = false;
    deps.actionManager.saveScene(scene);
    res.status(200).json({ id: scene.id, name: scene.name, active: false });
  });

  return router;
}

