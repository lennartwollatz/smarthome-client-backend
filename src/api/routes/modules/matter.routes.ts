import { Router } from "express";
import { MatterModuleManager } from "../../../modules/matter/matterModuleManager.js";
import { Request_MatterDiscoverDevices } from "../../../model/requests/Request_MatterDiscoverDevices.js";
import { Request_MatterPairDevice } from "../../../model/requests/Request_MatterPairDevice.js";
import { Request_MatterPairDeviceByCode } from "../../../model/requests/Request_MatterPairDeviceByCode.js";
import { Request_MatterSetIntensity } from "../../../model/requests/Request_MatterSetIntensity.js";
import { Request_MatterSetOff } from "../../../model/requests/Request_MatterSetOff.js";
import { Request_MatterSetOn } from "../../../model/requests/Request_MatterSetOn.js";
import { Request_MatterSetTemperature } from "../../../model/requests/Request_MatterSetTemperature.js";
import { Request_MatterSetTemperatureSchedules } from "../../../model/requests/Request_MatterSetTemperatureSchedules.js";
import { Request_MatterToggle } from "../../../model/requests/Request_MatterToggle.js";
import { endpoint } from "../../http/endpoint.js";
import { MatterService } from "../../services/modules/matter.service.js";
import { matterValidation } from "../../validation/modules/matter.validation.js";
import type { RouterDeps } from "../../router.js";

export function createMatterModuleRouter(deps: RouterDeps) {
  const router = Router();
  const matterModule = new MatterModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(matterModule);
  const matterService = new MatterService(matterModule);

  router.get("/devices/discover", ...endpoint({
    schema: matterValidation.discoverDevices,
    toRequest: () => new Request_MatterDiscoverDevices(),
    serve: request => matterService.discoverDevices(request)
  }));

  router.post("/devices/:deviceId/pair", ...endpoint({
    schema: matterValidation.pairDevice,
    toRequest: ({ params, body }) => new Request_MatterPairDevice({ ...body, deviceId: params.deviceId }),
    serve: request => matterService.pairDevice(request)
  }));

  router.post("/devices/pair-by-code", ...endpoint({
    schema: matterValidation.pairDeviceByCode,
    toRequest: ({ body }) => new Request_MatterPairDeviceByCode(body),
    serve: request => matterService.pairDeviceByCode(request)
  }));

  router.post("/devices/:deviceId/:buttonId/toggle", ...endpoint({
    schema: matterValidation.toggle,
    toRequest: ({ params }) => new Request_MatterToggle(params),
    serve: request => matterService.toggle(request)
  }));

  router.post("/devices/:deviceId/:buttonId/setOn", ...endpoint({
    schema: matterValidation.setOn,
    toRequest: ({ params }) => new Request_MatterSetOn(params),
    serve: request => matterService.setOn(request)
  }));

  router.post("/devices/:deviceId/:buttonId/setOff", ...endpoint({
    schema: matterValidation.setOff,
    toRequest: ({ params }) => new Request_MatterSetOff(params),
    serve: request => matterService.setOff(request)
  }));

  router.post("/devices/:deviceId/:buttonId/setIntensity", ...endpoint({
    schema: matterValidation.setIntensity,
    toRequest: ({ params, body }) => new Request_MatterSetIntensity({ ...body, ...params }),
    serve: request => matterService.setIntensity(request)
  }));

  router.post("/devices/:deviceId/setTemperature", ...endpoint({
    schema: matterValidation.setTemperature,
    toRequest: ({ params, body }) => new Request_MatterSetTemperature({ ...body, deviceId: params.deviceId }),
    serve: request => matterService.setTemperature(request)
  }));

  router.post("/devices/:deviceId/setTemperatureSchedules", ...endpoint({
    schema: matterValidation.setTemperatureSchedules,
    toRequest: ({ params, body }) => new Request_MatterSetTemperatureSchedules({ ...body, deviceId: params.deviceId }),
    serve: request => matterService.setTemperatureSchedules(request)
  }));

  return router;
}
