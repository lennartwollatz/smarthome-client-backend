import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { DatabaseManager } from "../../db/database.js";
import type { EventStreamManager } from "../../events/eventStreamManager.js";
import type { ActionManager } from "../../actions/actionManager.js";
import { JsonRepository } from "../../db/jsonRepository.js";
import type { User } from "../../../model/index.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createUserRouter(deps: Deps) {
  const router = Router();
  const userRepository = new JsonRepository<User>(deps.databaseManager, "User");

  router.get("/", (_req, res) => {
    const users = userRepository.findAll();
    res.status(200).json(users);
  });

  router.post("/", (req, res) => {
    const user = req.body as User;
    if (!user.id) {
      user.id = `user-${randomUUID()}`;
    }
    if (user.locationTrackingEnabled == null) user.locationTrackingEnabled = false;
    if (user.pushNotificationsEnabled == null) user.pushNotificationsEnabled = false;
    if (user.emailNotificationsEnabled == null) user.emailNotificationsEnabled = false;
    if (user.smsNotificationsEnabled == null) user.smsNotificationsEnabled = false;

    userRepository.save(user.id, user);
    res.status(201).json("");
  });

  router.get("/:userId", (req, res) => {
    const user = userRepository.findById(req.params.userId);
    if (user) {
      res.status(200).json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  router.put("/:userId", (req, res) => {
    const user = req.body as User;
    user.id = req.params.userId;
    userRepository.save(user.id, user);
    res.status(200).json("");
  });

  router.delete("/:userId", (req, res) => {
    const deleted = userRepository.deleteById(req.params.userId);
    if (deleted) {
      res.status(204).json("");
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  router.get("/:userId/regenerate-token", (req, res) => {
    const user = userRepository.findById(req.params.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const newToken = randomUUID().replace(/-/g, "");
    user.trackingToken = newToken;
    userRepository.save(req.params.userId, user);
    res.status(200).json(newToken);
  });

  return router;
}

