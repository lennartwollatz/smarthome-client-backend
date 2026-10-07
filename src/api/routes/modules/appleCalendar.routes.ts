import { Router } from "express";
import { Request_AppleCalendarDeleteCredentials } from "../../../model/requests/Request_AppleCalendarDeleteCredentials.js";
import { Request_AppleCalendarGetCalendars } from "../../../model/requests/Request_AppleCalendarGetCalendars.js";
import { Request_AppleCalendarGetCredentials } from "../../../model/requests/Request_AppleCalendarGetCredentials.js";
import { Request_AppleCalendarPairCredentials } from "../../../model/requests/Request_AppleCalendarPairCredentials.js";
import { Request_AppleCalendarSetCredentials } from "../../../model/requests/Request_AppleCalendarSetCredentials.js";
import { Request_AppleCalendarSetPassword } from "../../../model/requests/Request_AppleCalendarSetPassword.js";
import { Request_AppleCalendarSetServer } from "../../../model/requests/Request_AppleCalendarSetServer.js";
import { AppleCalendarModuleManager } from "../../../modules/appleCalendar/appleCalendarModuleManager.js";
import { endpoint } from "../../http/endpoint.js";
import { AppleCalendarService } from "../../services/modules/appleCalendar.service.js";
import { appleCalendarValidation } from "../../validation/modules/appleCalendar.validation.js";
import type { RouterDeps } from "../../router.js";

export function createAppleCalendarModuleRouter(deps: RouterDeps) {
  const router = Router();
  const appleModule = new AppleCalendarModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(appleModule);
  const appleCalendarService = new AppleCalendarService(appleModule);

  router.get("/credentials", ...endpoint({
    schema: appleCalendarValidation.getCredentials,
    toRequest: () => new Request_AppleCalendarGetCredentials(),
    serve: request => appleCalendarService.getCredentials(request)
  }));

  router.put("/credentials/:credentialsId", ...endpoint({
    schema: appleCalendarValidation.setCredentials,
    toRequest: ({ params, body }) => new Request_AppleCalendarSetCredentials({ ...body, credentialsId: params.credentialsId }),
    serve: request => appleCalendarService.setCredentials(request)
  }));

  router.put("/credentials/:credentialsId/password", ...endpoint({
    schema: appleCalendarValidation.setPassword,
    toRequest: ({ params, body }) => new Request_AppleCalendarSetPassword({ ...body, credentialsId: params.credentialsId }),
    serve: request => appleCalendarService.setPassword(request)
  }));

  router.put("/credentials/:credentialsId/server", ...endpoint({
    schema: appleCalendarValidation.setServer,
    toRequest: ({ params, body }) => new Request_AppleCalendarSetServer({ ...body, credentialsId: params.credentialsId }),
    serve: request => appleCalendarService.setServer(request)
  }));

  router.delete("/credentials/:credentialsId", ...endpoint({
    schema: appleCalendarValidation.deleteCredentials,
    toRequest: ({ params }) => new Request_AppleCalendarDeleteCredentials(params),
    serve: request => appleCalendarService.deleteCredentials(request)
  }));

  router.post("/pair/:credentialsId", ...endpoint({
    schema: appleCalendarValidation.pairCredentials,
    toRequest: ({ params }) => new Request_AppleCalendarPairCredentials(params),
    serve: request => appleCalendarService.pairCredentials(request)
  }));

  router.get("/calendars/:credentialsId", ...endpoint({
    schema: appleCalendarValidation.getCalendars,
    toRequest: ({ params }) => new Request_AppleCalendarGetCalendars(params),
    serve: request => appleCalendarService.getCalendars(request)
  }));

  return router;
}
