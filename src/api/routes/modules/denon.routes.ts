import { Router } from "express";
import { DenonModuleManager } from "../../../modules/heos/denon/denonModuleManager.js";
import { Request_DenonDiscoverDevices } from "../../../model/requests/Request_DenonDiscoverDevices.js";
import { Request_DenonPlayNext } from "../../../model/requests/Request_DenonPlayNext.js";
import { Request_DenonPlayPrevious } from "../../../model/requests/Request_DenonPlayPrevious.js";
import { Request_DenonSetMute } from "../../../model/requests/Request_DenonSetMute.js";
import { Request_DenonSetOff } from "../../../model/requests/Request_DenonSetOff.js";
import { Request_DenonSetOn } from "../../../model/requests/Request_DenonSetOn.js";
import { Request_DenonSetPlayState } from "../../../model/requests/Request_DenonSetPlayState.js";
import { Request_DenonSetSource } from "../../../model/requests/Request_DenonSetSource.js";
import { Request_DenonSetVolume } from "../../../model/requests/Request_DenonSetVolume.js";
import { Request_DenonSetVolumeMax } from "../../../model/requests/Request_DenonSetVolumeMax.js";
import { Request_DenonSetVolumeStart } from "../../../model/requests/Request_DenonSetVolumeStart.js";
import { Request_DenonSetZonePower } from "../../../model/requests/Request_DenonSetZonePower.js";
import { endpoint } from "../../http/endpoint.js";
import { DenonService } from "../../services/modules/denon.service.js";
import { denonValidation } from "../../validation/modules/denon.validation.js";
import type { RouterDeps } from "../../router.js";

export function createDenonModuleRouter(deps: RouterDeps) {
  const router = Router();
  const denonModule = new DenonModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(denonModule);
  const denonService = new DenonService(denonModule);

  router.get("/devices/discover", ...endpoint({
    schema: denonValidation.discoverDevices,
    toRequest: () => new Request_DenonDiscoverDevices(),
    serve: request => denonService.discoverDevices(request)
  }));

  router.post("/devices/:deviceId/setVolume", ...endpoint({
    schema: denonValidation.setVolume,
    toRequest: ({ params, body }) => new Request_DenonSetVolume({ ...body, deviceId: params.deviceId }),
    serve: request => denonService.setVolume(request)
  }));

  router.post("/devices/:deviceId/setOn", ...endpoint({
    schema: denonValidation.setOn,
    toRequest: ({ params }) => new Request_DenonSetOn(params),
    serve: request => denonService.setOn(request)
  }));

  router.post("/devices/:deviceId/setOff", ...endpoint({
    schema: denonValidation.setOff,
    toRequest: ({ params }) => new Request_DenonSetOff(params),
    serve: request => denonService.setOff(request)
  }));

  router.post("/devices/:deviceId/setPlayState", ...endpoint({
    schema: denonValidation.setPlayState,
    toRequest: ({ params, body }) => new Request_DenonSetPlayState({ ...body, deviceId: params.deviceId }),
    serve: request => denonService.setPlayState(request)
  }));

  router.post("/devices/:deviceId/setMute", ...endpoint({
    schema: denonValidation.setMute,
    toRequest: ({ params, body }) => new Request_DenonSetMute({ ...body, deviceId: params.deviceId }),
    serve: request => denonService.setMute(request)
  }));

  router.post("/devices/:deviceId/playNext", ...endpoint({
    schema: denonValidation.playNext,
    toRequest: ({ params }) => new Request_DenonPlayNext(params),
    serve: request => denonService.playNext(request)
  }));

  router.post("/devices/:deviceId/playPrevious", ...endpoint({
    schema: denonValidation.playPrevious,
    toRequest: ({ params }) => new Request_DenonPlayPrevious(params),
    serve: request => denonService.playPrevious(request)
  }));

  router.post("/devices/:deviceId/setVolumeStart", ...endpoint({
    schema: denonValidation.setVolumeStart,
    toRequest: ({ params, body }) => new Request_DenonSetVolumeStart({ ...body, deviceId: params.deviceId }),
    serve: request => denonService.setVolumeStart(request)
  }));

  router.post("/devices/:deviceId/setVolumeMax", ...endpoint({
    schema: denonValidation.setVolumeMax,
    toRequest: ({ params, body }) => new Request_DenonSetVolumeMax({ ...body, deviceId: params.deviceId }),
    serve: request => denonService.setVolumeMax(request)
  }));

  router.post("/devices/:deviceId/setSource", ...endpoint({
    schema: denonValidation.setSource,
    toRequest: ({ params, body }) => new Request_DenonSetSource({ ...body, deviceId: params.deviceId }),
    serve: request => denonService.setSource(request)
  }));

  router.post("/devices/:deviceId/setZonePower", ...endpoint({
    schema: denonValidation.setZonePower,
    toRequest: ({ params, body }) => new Request_DenonSetZonePower({ ...body, deviceId: params.deviceId }),
    serve: request => denonService.setZonePower(request)
  }));

  return router;
}
