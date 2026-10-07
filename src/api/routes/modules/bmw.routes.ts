import { Router } from "express";
import { Request_BmwDiscoverDevices } from "../../../model/requests/Request_BmwDiscoverDevices.js";
import { Request_BmwGetCredentials } from "../../../model/requests/Request_BmwGetCredentials.js";
import { Request_BmwRefreshDevice } from "../../../model/requests/Request_BmwRefreshDevice.js";
import { Request_BmwSendAddress } from "../../../model/requests/Request_BmwSendAddress.js";
import { Request_BmwSetCaptchaToken } from "../../../model/requests/Request_BmwSetCaptchaToken.js";
import { Request_BmwSetCredentials } from "../../../model/requests/Request_BmwSetCredentials.js";
import { Request_BmwSetPassword } from "../../../model/requests/Request_BmwSetPassword.js";
import { Request_BmwStartClimateControl } from "../../../model/requests/Request_BmwStartClimateControl.js";
import { Request_BmwStopClimateControl } from "../../../model/requests/Request_BmwStopClimateControl.js";
import { BMWModuleManager } from "../../../modules/bmw/bmwModuleManager.js";
import { endpoint } from "../../http/endpoint.js";
import { BmwService } from "../../services/modules/bmw.service.js";
import { bmwValidation } from "../../validation/modules/bmw.validation.js";
import type { RouterDeps } from "../../router.js";

export function createBMWModuleRouter(deps: RouterDeps) {
  const router = Router();
  const bmwModule = new BMWModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(bmwModule);
  const bmwService = new BmwService(bmwModule);

  router.get("/credentials", ...endpoint({
    schema: bmwValidation.getCredentials,
    toRequest: () => new Request_BmwGetCredentials(),
    serve: request => bmwService.getCredentials(request)
  }));

  router.put("/credentials", ...endpoint({
    schema: bmwValidation.setCredentials,
    toRequest: ({ body }) => new Request_BmwSetCredentials(body),
    serve: request => bmwService.setCredentials(request)
  }));

  router.put("/credentials/password", ...endpoint({
    schema: bmwValidation.setPassword,
    toRequest: ({ body }) => new Request_BmwSetPassword(body),
    serve: request => bmwService.setPassword(request)
  }));

  router.put("/credentials/captchaToken", ...endpoint({
    schema: bmwValidation.setCaptchaToken,
    toRequest: ({ body }) => new Request_BmwSetCaptchaToken(body),
    serve: request => bmwService.setCaptchaToken(request)
  }));

  router.get("/devices/discover", ...endpoint({
    schema: bmwValidation.discoverDevices,
    toRequest: () => new Request_BmwDiscoverDevices(),
    serve: request => bmwService.discoverDevices(request)
  }));

  router.post("/devices/:deviceId/climate/start", ...endpoint({
    schema: bmwValidation.startClimateControl,
    toRequest: ({ params }) => new Request_BmwStartClimateControl(params),
    serve: request => bmwService.startClimateControl(request)
  }));

  router.post("/devices/:deviceId/climate/stop", ...endpoint({
    schema: bmwValidation.stopClimateControl,
    toRequest: ({ params }) => new Request_BmwStopClimateControl(params),
    serve: request => bmwService.stopClimateControl(request)
  }));

  router.post("/devices/:deviceId/sendAddress", ...endpoint({
    schema: bmwValidation.sendAddress,
    toRequest: ({ params, body }) => new Request_BmwSendAddress({ ...body, deviceId: params.deviceId }),
    serve: request => bmwService.sendAddress(request)
  }));

  router.post("/devices/:deviceId/refresh", ...endpoint({
    schema: bmwValidation.refreshDevice,
    toRequest: ({ params }) => new Request_BmwRefreshDevice(params),
    serve: request => bmwService.refreshDevice(request)
  }));

  return router;
}
