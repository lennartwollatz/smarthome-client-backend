import { Router } from "express";
import { SonosModuleManager } from "../../../modules/sonos/sonosModuleManager.js";
import { Request_SonosDiscoverDevices } from "../../../model/requests/Request_SonosDiscoverDevices.js";
import { Request_SonosPlayNext } from "../../../model/requests/Request_SonosPlayNext.js";
import { Request_SonosPlayPrevious } from "../../../model/requests/Request_SonosPlayPrevious.js";
import { Request_SonosSetMute } from "../../../model/requests/Request_SonosSetMute.js";
import { Request_SonosSetOff } from "../../../model/requests/Request_SonosSetOff.js";
import { Request_SonosSetOn } from "../../../model/requests/Request_SonosSetOn.js";
import { Request_SonosSetPlayState } from "../../../model/requests/Request_SonosSetPlayState.js";
import { Request_SonosSetVolume } from "../../../model/requests/Request_SonosSetVolume.js";
import { endpoint } from "../../http/endpoint.js";
import { SonosService } from "../../services/modules/sonos.service.js";
import { sonosValidation } from "../../validation/modules/sonos.validation.js";
import type { RouterDeps } from "../../router.js";

export function createSonosModuleRouter(deps: RouterDeps) {
  const router = Router();
  const sonosModule = new SonosModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(sonosModule);
  const sonosService = new SonosService(sonosModule);

  router.get("/devices/discover", ...endpoint({
    schema: sonosValidation.discoverDevices,
    toRequest: () => new Request_SonosDiscoverDevices(),
    serve: request => sonosService.discoverDevices(request)
  }));

  router.post("/devices/:deviceId/setVolume", ...endpoint({
    schema: sonosValidation.setVolume,
    toRequest: ({ params, body }) => new Request_SonosSetVolume({ ...body, deviceId: params.deviceId }),
    serve: request => sonosService.setVolume(request)
  }));

  router.post("/devices/:deviceId/setOn", ...endpoint({
    schema: sonosValidation.setOn,
    toRequest: ({ params }) => new Request_SonosSetOn(params),
    serve: request => sonosService.setOn(request)
  }));

  router.post("/devices/:deviceId/setOff", ...endpoint({
    schema: sonosValidation.setOff,
    toRequest: ({ params }) => new Request_SonosSetOff(params),
    serve: request => sonosService.setOff(request)
  }));

  router.post("/devices/:deviceId/setPlayState", ...endpoint({
    schema: sonosValidation.setPlayState,
    toRequest: ({ params, body }) => new Request_SonosSetPlayState({ ...body, deviceId: params.deviceId }),
    serve: request => sonosService.setPlayState(request)
  }));

  router.post("/devices/:deviceId/setMute", ...endpoint({
    schema: sonosValidation.setMute,
    toRequest: ({ params, body }) => new Request_SonosSetMute({ ...body, deviceId: params.deviceId }),
    serve: request => sonosService.setMute(request)
  }));

  router.post("/devices/:deviceId/playNext", ...endpoint({
    schema: sonosValidation.playNext,
    toRequest: ({ params }) => new Request_SonosPlayNext(params),
    serve: request => sonosService.playNext(request)
  }));

  router.post("/devices/:deviceId/playPrevious", ...endpoint({
    schema: sonosValidation.playPrevious,
    toRequest: ({ params }) => new Request_SonosPlayPrevious(params),
    serve: request => sonosService.playPrevious(request)
  }));

  return router;
}
