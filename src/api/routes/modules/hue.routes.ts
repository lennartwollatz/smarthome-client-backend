import { Router } from "express";
import { HueModuleManager } from "../../../modules/hue/hueModuleManager.js";
import { Request_HueDiscoverBridgeDevices } from "../../../model/requests/Request_HueDiscoverBridgeDevices.js";
import { Request_HueDiscoverBridges } from "../../../model/requests/Request_HueDiscoverBridges.js";
import { Request_HueGetBridges } from "../../../model/requests/Request_HueGetBridges.js";
import { Request_HuePairBridge } from "../../../model/requests/Request_HuePairBridge.js";
import { Request_HueSetBrightness } from "../../../model/requests/Request_HueSetBrightness.js";
import { Request_HueSetColor } from "../../../model/requests/Request_HueSetColor.js";
import { Request_HueSetOff } from "../../../model/requests/Request_HueSetOff.js";
import { Request_HueSetOn } from "../../../model/requests/Request_HueSetOn.js";
import { Request_HueSetSensitivity } from "../../../model/requests/Request_HueSetSensitivity.js";
import { Request_HueSetTemperature } from "../../../model/requests/Request_HueSetTemperature.js";
import { endpoint } from "../../http/endpoint.js";
import { HueService } from "../../services/modules/hue.service.js";
import { hueValidation } from "../../validation/modules/hue.validation.js";
import type { RouterDeps } from "../../router.js";

export function createHueModuleRouter(deps: RouterDeps) {
  const router = Router();
  const hueModule = new HueModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(hueModule);
  const hueService = new HueService(hueModule);

  router.get("/bridges", ...endpoint({
    schema: hueValidation.getBridges,
    toRequest: () => new Request_HueGetBridges(),
    serve: request => hueService.getBridges(request)
  }));

  router.get("/bridges/discover", ...endpoint({
    schema: hueValidation.discoverBridges,
    toRequest: () => new Request_HueDiscoverBridges(),
    serve: request => hueService.discoverBridges(request)
  }));

  router.post("/bridges/:bridgeId/pair", ...endpoint({
    schema: hueValidation.pairBridge,
    toRequest: ({ params }) => new Request_HuePairBridge(params),
    serve: request => hueService.pairBridge(request)
  }));

  router.get("/discover/devices/:bridgeId", ...endpoint({
    schema: hueValidation.discoverBridgeDevices,
    toRequest: ({ params }) => new Request_HueDiscoverBridgeDevices(params),
    serve: request => hueService.discoverBridgeDevices(request)
  }));

  const setSensitivity = endpoint({
    schema: hueValidation.setSensitivity,
    toRequest: ({ params, body }) => new Request_HueSetSensitivity({ ...body, deviceId: params.deviceId }),
    serve: request => hueService.setSensitivity(request)
  });
  router.post("/devices/:deviceId/setSensitivity", ...setSensitivity);
  router.put("/devices/:deviceId/setSensitivity", ...setSensitivity);

  const setOn = endpoint({
    schema: hueValidation.setOn,
    toRequest: ({ params }) => new Request_HueSetOn(params),
    serve: request => hueService.setOn(request)
  });
  router.post("/devices/:deviceId/setOn", ...setOn);
  router.put("/devices/:deviceId/setOn", ...setOn);

  const setOff = endpoint({
    schema: hueValidation.setOff,
    toRequest: ({ params }) => new Request_HueSetOff(params),
    serve: request => hueService.setOff(request)
  });
  router.post("/devices/:deviceId/setOff", ...setOff);
  router.put("/devices/:deviceId/setOff", ...setOff);

  const setBrightness = endpoint({
    schema: hueValidation.setBrightness,
    toRequest: ({ params, body }) => new Request_HueSetBrightness({ ...body, deviceId: params.deviceId }),
    serve: request => hueService.setBrightness(request)
  });
  router.post("/devices/:deviceId/setBrightness", ...setBrightness);
  router.put("/devices/:deviceId/setBrightness", ...setBrightness);

  const setTemperature = endpoint({
    schema: hueValidation.setTemperature,
    toRequest: ({ params, body }) => new Request_HueSetTemperature({ ...body, deviceId: params.deviceId }),
    serve: request => hueService.setTemperature(request)
  });
  router.post("/devices/:deviceId/setTemperature", ...setTemperature);
  router.put("/devices/:deviceId/setTemperature", ...setTemperature);

  const setColor = endpoint({
    schema: hueValidation.setColor,
    toRequest: ({ params, body }) => new Request_HueSetColor({ ...body, deviceId: params.deviceId }),
    serve: request => hueService.setColor(request)
  });
  router.post("/devices/:deviceId/setColor", ...setColor);
  router.put("/devices/:deviceId/setColor", ...setColor);

  return router;
}
