import { Router } from "express";
import { randomUUID } from "node:crypto";
import { JsonRepository } from "../../db/jsonRepository.js";
import { User } from "../../../model/User.js";
import { logger } from "../../../logger.js";
import type { RouterDeps } from "../router.js";

export function createUserRouter(deps: RouterDeps) {
  const router = Router();
  const userRepository = new JsonRepository<User>(deps.databaseManager, "User");
  const presenceManager = deps.presenceManager;

  router.get("/", (_req, res) => {
    const users = userRepository.findAll();
    res.status(200).json(users);
  });

  router.post("/", async (req, res) => {
    const user = req.body as User;
    if (!user.id) {
      user.id = `user-${randomUUID()}`;
    }
    if (user.locationTrackingEnabled == null) user.locationTrackingEnabled = false;
    if (user.pushNotificationsEnabled == null) user.pushNotificationsEnabled = false;
    if (user.emailNotificationsEnabled == null) user.emailNotificationsEnabled = false;
    if (user.smsNotificationsEnabled == null) user.smsNotificationsEnabled = false;

    try {
      const presenceInfo = await presenceManager.createPresenceDevice(user);
      user.presencePairingCode = presenceInfo.manualPairingCode;
      user.presencePasscode = presenceInfo.passcode;
      user.presenceDiscriminator = presenceInfo.discriminator;
      user.presenceDevicePort = presenceInfo.port;
    } catch (err) {
      logger.error({ err, userId: user.id }, "Fehler beim Erstellen des Presence-Device");
    }

    userRepository.save(user.id, user);
    res.status(201).json(user);
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
    const existingUser = userRepository.findById(req.params.userId);
    const user = req.body as User;
    user.id = req.params.userId;

    if (existingUser) {
      user.presenceDevicePort = existingUser.presenceDevicePort;
      user.presencePairingCode = existingUser.presencePairingCode;
      user.presencePasscode = existingUser.presencePasscode;
      user.presenceDiscriminator = existingUser.presenceDiscriminator;
    }

    userRepository.save(user.id, user);
    res.status(200).json("");
  });

  router.delete("/:userId", async (req, res) => {
    const userId = req.params.userId;

    try {
      await presenceManager.removePresenceDevice(userId);
    } catch (err) {
      logger.error({ err, userId }, "Fehler beim Entfernen des Presence-Device");
    }

    const deleted = userRepository.deleteById(userId);
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

