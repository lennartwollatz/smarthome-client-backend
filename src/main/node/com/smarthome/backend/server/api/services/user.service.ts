import { Router } from "express";
import type { User } from "../entities/users/User.js";
import type { ServerDeps } from "../server.js";

export function createUserRouter(deps: ServerDeps) {
  const router = Router();
  const userManager = deps.userManager;

  router.get("/", (_req, res) => {
    res.status(200).json(userManager.findAll());
  });

  router.post("/", async (req, res) => {
    const created = await userManager.createUser(req.body as User);
    if (created == null) {
      res.status(500).json({ success: false, error: "User could not be created" });
      return;
    }
    res.status(201).json({ success: true, user: created });
  });

  router.get("/:userId/regenerate-token", (req, res) => {
    const user = userManager.regenerateTrackingToken(req.params.userId);
    if (user == null) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.status(200).json({ success: true, user });
  });

  router.post("/:userId/setPresent", (req, res) => {
    const user = userManager.setUserPresent(req.params.userId);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.status(200).json({ success: true, user });
  });

  router.post("/:userId/setAbsent", (req, res) => {
    const user = userManager.setUserAbsent(req.params.userId);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.status(200).json({ success: true, user });
  });

  router.get("/:userId", (req, res) => {
    const user = userManager.findById(req.params.userId);
    if (user) {
      res.status(200).json({ success: true, user });
    } else {
      res.status(404).json({ success: false, error: "User not found" });
    }
  });

  router.put("/:userId", (req, res) => {
    const user = userManager.updateUser(req.params.userId, req.body as User);
    if (user) {
      res.status(200).json({ success: true, user });
    } else {
      res.status(404).json({ success: false, error: "User not found" });
    }
  });

  router.delete("/:userId", async (req, res) => {
    const deleted = await userManager.deleteUser(req.params.userId);
    if (deleted) {
      res.status(204).json({ success: true });
    } else {
      res.status(404).json({ success: false, error: "User not found" });
    }
  });

  return router;
}
