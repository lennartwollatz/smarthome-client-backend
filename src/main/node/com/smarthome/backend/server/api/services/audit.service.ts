import { Router } from "express";
import { EventType } from "../../events/event-types/EventType.js";
import type { ServerDeps } from "../server.js";

function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function createAuditRouter(deps: ServerDeps) {
  const router = Router();

  router.get("/events", (req, res) => {
    const result = deps.eventManager.queryEventLog({
      deviceId: typeof req.query.deviceId === "string" ? req.query.deviceId : undefined,
      eventType: typeof req.query.eventType === "string" ? req.query.eventType : undefined,
      from: parseOptionalInt(req.query.from),
      to: parseOptionalInt(req.query.to),
      limit: parseOptionalInt(req.query.limit),
      offset: parseOptionalInt(req.query.offset)
    });
    res.status(200).json(result);
  });

  router.get("/event-types", (_req, res) => {
    res.status(200).json({ eventTypes: Object.values(EventType) });
  });

  router.get("/device-changes", (req, res) => {
    const result = deps.deviceManager.queryDeviceChangeLog({
      deviceId: typeof req.query.deviceId === "string" ? req.query.deviceId : undefined,
      from: parseOptionalInt(req.query.from),
      to: parseOptionalInt(req.query.to),
      limit: parseOptionalInt(req.query.limit),
      offset: parseOptionalInt(req.query.offset)
    });
    res.status(200).json(result);
  });

  return router;
}
