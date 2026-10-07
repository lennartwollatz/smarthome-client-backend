import { Router } from "express";
import { Request_PresenceSetAbsent } from "../../../model/requests/Request_PresenceSetAbsent.js";
import { Request_PresenceSetPresent } from "../../../model/requests/Request_PresenceSetPresent.js";
import { Request_PresenceTogglePresence } from "../../../model/requests/Request_PresenceTogglePresence.js";
import { endpoint } from "../../http/endpoint.js";
import { PresenceService } from "../../services/modules/presence.service.js";
import { presenceValidation } from "../../validation/modules/presence.validation.js";
import type { RouterDeps } from "../../router.js";

export function createPresenceModuleRouter(deps: RouterDeps) {
  const router = Router();
  const presenceService = new PresenceService(deps.presenceManager);

  router.post("/devices/:deviceId/setPresent", ...endpoint({
    schema: presenceValidation.setPresent,
    toRequest: ({ params }) => new Request_PresenceSetPresent(params),
    serve: request => presenceService.setPresent(request)
  }));

  router.post("/devices/:deviceId/setAbsent", ...endpoint({
    schema: presenceValidation.setAbsent,
    toRequest: ({ params }) => new Request_PresenceSetAbsent(params),
    serve: request => presenceService.setAbsent(request)
  }));

  router.post("/devices/:deviceId/togglePresence", ...endpoint({
    schema: presenceValidation.togglePresence,
    toRequest: ({ params }) => new Request_PresenceTogglePresence(params),
    serve: request => presenceService.togglePresence(request)
  }));

  return router;
}
