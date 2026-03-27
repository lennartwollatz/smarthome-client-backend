import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { Scene } from "../entities/scenes/Scene.js";
import type { ServerDeps } from "../server.js";

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

  router.post("/:sceneId/activate", (req, res) => {
    const scene = deps.sceneManager.getScene(req.params.sceneId);
    if (!scene) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }
    scene.active = true;
    deps.sceneManager.updateScene(scene);
    res.status(200).json({ id: scene.id, name: scene.name, active: true });
  });

  router.post("/:sceneId/deactivate", (req, res) => {
    const scene = deps.sceneManager.getScene(req.params.sceneId);
    if (!scene) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }
    scene.active = false;
    deps.sceneManager.updateScene(scene);
    res.status(200).json({ id: scene.id, name: scene.name, active: false });
  });

  return router;
}

