import { Router } from "express";
import { WACLightingModuleManager } from "../../../modules/waclighting/waclightingModuleManager.js";
import { Request_WaclightingDiscoverDevices } from "../../../model/requests/Request_WaclightingDiscoverDevices.js";
import { Request_WaclightingFanSetOff } from "../../../model/requests/Request_WaclightingFanSetOff.js";
import { Request_WaclightingFanSetOn } from "../../../model/requests/Request_WaclightingFanSetOn.js";
import { Request_WaclightingFanSetSpeed } from "../../../model/requests/Request_WaclightingFanSetSpeed.js";
import { Request_WaclightingLightSetBrightness } from "../../../model/requests/Request_WaclightingLightSetBrightness.js";
import { Request_WaclightingLightSetOff } from "../../../model/requests/Request_WaclightingLightSetOff.js";
import { Request_WaclightingLightSetOn } from "../../../model/requests/Request_WaclightingLightSetOn.js";
import { endpoint } from "../../http/endpoint.js";
import { WaclightingService } from "../../services/modules/waclighting.service.js";
import { waclightingValidation } from "../../validation/modules/waclighting.validation.js";
import type { RouterDeps } from "../../router.js";

export function createWACLightingModuleRouter(deps: RouterDeps) {
  const router = Router();
  const wacLightingModule = new WACLightingModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(wacLightingModule);
  const waclightingService = new WaclightingService(wacLightingModule);

  router.get("/devices/discover", ...endpoint({
    schema: waclightingValidation.discoverDevices,
    toRequest: () => new Request_WaclightingDiscoverDevices(),
    serve: request => waclightingService.discoverDevices(request)
  }));

  router.post("/devices/:deviceId/fan/setOn", ...endpoint({
    schema: waclightingValidation.fanSetOn,
    toRequest: ({ params }) => new Request_WaclightingFanSetOn(params),
    serve: request => waclightingService.fanSetOn(request)
  }));

  router.post("/devices/:deviceId/fan/setOff", ...endpoint({
    schema: waclightingValidation.fanSetOff,
    toRequest: ({ params }) => new Request_WaclightingFanSetOff(params),
    serve: request => waclightingService.fanSetOff(request)
  }));

  router.post("/devices/:deviceId/fan/setSpeed", ...endpoint({
    schema: waclightingValidation.fanSetSpeed,
    toRequest: ({ params, body }) => new Request_WaclightingFanSetSpeed({ ...body, deviceId: params.deviceId }),
    serve: request => waclightingService.fanSetSpeed(request)
  }));

  router.post("/devices/:deviceId/light/setOn", ...endpoint({
    schema: waclightingValidation.lightSetOn,
    toRequest: ({ params }) => new Request_WaclightingLightSetOn(params),
    serve: request => waclightingService.lightSetOn(request)
  }));

  router.post("/devices/:deviceId/light/setOff", ...endpoint({
    schema: waclightingValidation.lightSetOff,
    toRequest: ({ params }) => new Request_WaclightingLightSetOff(params),
    serve: request => waclightingService.lightSetOff(request)
  }));

  router.post("/devices/:deviceId/light/setBrightness", ...endpoint({
    schema: waclightingValidation.lightSetBrightness,
    toRequest: ({ params, body }) => new Request_WaclightingLightSetBrightness({ ...body, deviceId: params.deviceId }),
    serve: request => waclightingService.lightSetBrightness(request)
  }));

  return router;
}
