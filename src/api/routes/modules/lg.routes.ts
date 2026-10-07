import { Router } from "express";
import { LGModuleManager } from "../../../modules/lg/lgModuleManager.js";
import { Request_LgDiscoverDevices } from "../../../model/requests/Request_LgDiscoverDevices.js";
import { Request_LgGetApps } from "../../../model/requests/Request_LgGetApps.js";
import { Request_LgGetChannels } from "../../../model/requests/Request_LgGetChannels.js";
import { Request_LgGetSelectedApp } from "../../../model/requests/Request_LgGetSelectedApp.js";
import { Request_LgGetSelectedChannel } from "../../../model/requests/Request_LgGetSelectedChannel.js";
import { Request_LgNotify } from "../../../model/requests/Request_LgNotify.js";
import { Request_LgPair } from "../../../model/requests/Request_LgPair.js";
import { Request_LgScreenOff } from "../../../model/requests/Request_LgScreenOff.js";
import { Request_LgScreenOn } from "../../../model/requests/Request_LgScreenOn.js";
import { Request_LgSetChannel } from "../../../model/requests/Request_LgSetChannel.js";
import { Request_LgSetHomeAppNumber } from "../../../model/requests/Request_LgSetHomeAppNumber.js";
import { Request_LgSetHomeChannelNumber } from "../../../model/requests/Request_LgSetHomeChannelNumber.js";
import { Request_LgSetOff } from "../../../model/requests/Request_LgSetOff.js";
import { Request_LgSetOn } from "../../../model/requests/Request_LgSetOn.js";
import { Request_LgSetVolume } from "../../../model/requests/Request_LgSetVolume.js";
import { Request_LgStartApp } from "../../../model/requests/Request_LgStartApp.js";
import { endpoint } from "../../http/endpoint.js";
import { LgService } from "../../services/modules/lg.service.js";
import { lgValidation } from "../../validation/modules/lg.validation.js";
import type { RouterDeps } from "../../router.js";

export function createLGModuleRouter(deps: RouterDeps) {
  const router = Router();
  const lgModule = new LGModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(lgModule);
  const lgService = new LgService(lgModule, deps.actionManager);

  router.get("/devices/discover", ...endpoint({
    schema: lgValidation.discoverDevices,
    toRequest: () => new Request_LgDiscoverDevices(),
    serve: request => lgService.discoverDevices(request)
  }));

  router.post("/devices/:deviceId/pair", ...endpoint({
    schema: lgValidation.pair,
    toRequest: ({ params }) => new Request_LgPair(params),
    serve: request => lgService.pair(request)
  }));

  router.post("/devices/:deviceId/setOn", ...endpoint({
    schema: lgValidation.setOn,
    toRequest: ({ params }) => new Request_LgSetOn(params),
    serve: request => lgService.setOn(request)
  }));

  router.post("/devices/:deviceId/setOff", ...endpoint({
    schema: lgValidation.setOff,
    toRequest: ({ params }) => new Request_LgSetOff(params),
    serve: request => lgService.setOff(request)
  }));

  router.post("/devices/:deviceId/setVolume", ...endpoint({
    schema: lgValidation.setVolume,
    toRequest: ({ params, body }) => new Request_LgSetVolume({ ...body, deviceId: params.deviceId }),
    serve: request => lgService.setVolume(request)
  }));

  router.post("/devices/:deviceId/screenOn", ...endpoint({
    schema: lgValidation.screenOn,
    toRequest: ({ params }) => new Request_LgScreenOn(params),
    serve: request => lgService.screenOn(request)
  }));

  router.post("/devices/:deviceId/screenOff", ...endpoint({
    schema: lgValidation.screenOff,
    toRequest: ({ params }) => new Request_LgScreenOff(params),
    serve: request => lgService.screenOff(request)
  }));

  router.post("/devices/:deviceId/setChannel", ...endpoint({
    schema: lgValidation.setChannel,
    toRequest: ({ params, body }) => new Request_LgSetChannel({ ...body, deviceId: params.deviceId }),
    serve: request => lgService.setChannel(request)
  }));

  router.post("/devices/:deviceId/startApp", ...endpoint({
    schema: lgValidation.startApp,
    toRequest: ({ params, body }) => new Request_LgStartApp({ ...body, deviceId: params.deviceId }),
    serve: request => lgService.startApp(request)
  }));

  router.post("/devices/:deviceId/notify", ...endpoint({
    schema: lgValidation.notify,
    toRequest: ({ params, body }) => new Request_LgNotify({ ...body, deviceId: params.deviceId }),
    serve: request => lgService.notify(request)
  }));

  router.get("/devices/:deviceId/channels", ...endpoint({
    schema: lgValidation.getChannels,
    toRequest: ({ params }) => new Request_LgGetChannels(params),
    serve: request => lgService.getChannels(request)
  }));

  router.get("/devices/:deviceId/apps", ...endpoint({
    schema: lgValidation.getApps,
    toRequest: ({ params }) => new Request_LgGetApps(params),
    serve: request => lgService.getApps(request)
  }));

  router.get("/devices/:deviceId/selectedApp", ...endpoint({
    schema: lgValidation.getSelectedApp,
    toRequest: ({ params }) => new Request_LgGetSelectedApp(params),
    serve: request => lgService.getSelectedApp(request)
  }));

  router.get("/devices/:deviceId/selectedChannel", ...endpoint({
    schema: lgValidation.getSelectedChannel,
    toRequest: ({ params }) => new Request_LgGetSelectedChannel(params),
    serve: request => lgService.getSelectedChannel(request)
  }));

  router.post("/devices/:deviceId/setHomeAppNumber", ...endpoint({
    schema: lgValidation.setHomeAppNumber,
    toRequest: ({ params, body }) => new Request_LgSetHomeAppNumber({ ...body, deviceId: params.deviceId }),
    serve: request => lgService.setHomeAppNumber(request)
  }));

  router.post("/devices/:deviceId/setHomeChannelNumber", ...endpoint({
    schema: lgValidation.setHomeChannelNumber,
    toRequest: ({ params, body }) => new Request_LgSetHomeChannelNumber({ ...body, deviceId: params.deviceId }),
    serve: request => lgService.setHomeChannelNumber(request)
  }));

  return router;
}
