import { Router } from "express";
import { Request_XiaomiAddDevice } from "../../../model/requests/Request_XiaomiAddDevice.js";
import { Request_XiaomiDiscoverDevices } from "../../../model/requests/Request_XiaomiDiscoverDevices.js";
import { Request_XiaomiDock } from "../../../model/requests/Request_XiaomiDock.js";
import { Request_XiaomiGetRoomMapping } from "../../../model/requests/Request_XiaomiGetRoomMapping.js";
import { Request_XiaomiNavigateToRoom } from "../../../model/requests/Request_XiaomiNavigateToRoom.js";
import { Request_XiaomiStartCleaning } from "../../../model/requests/Request_XiaomiStartCleaning.js";
import { Request_XiaomiStopCleaning } from "../../../model/requests/Request_XiaomiStopCleaning.js";
import { XiaomiModuleManager } from "../../../modules/xiaomi/xiaomiModuleManager.js";
import { endpoint } from "../../http/endpoint.js";
import { XiaomiService } from "../../services/modules/xiaomi.service.js";
import { xiaomiValidation } from "../../validation/modules/xiaomi.validation.js";
import type { RouterDeps } from "../../router.js";

export function createXiaomiModuleRouter(deps: RouterDeps) {
  const router = Router();
  const xiaomiModule = new XiaomiModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(xiaomiModule);
  const xiaomiService = new XiaomiService(xiaomiModule);

  router.get("/devices/discover", ...endpoint({
    schema: xiaomiValidation.discoverDevices,
    toRequest: () => new Request_XiaomiDiscoverDevices(),
    serve: request => xiaomiService.discoverDevices(request)
  }));

  router.post("/devices/add", ...endpoint({
    schema: xiaomiValidation.addDevice,
    toRequest: ({ body }) => new Request_XiaomiAddDevice(body),
    serve: request => xiaomiService.addDevice(request),
    status: 201
  }));

  router.post("/devices/:deviceId/startCleaning", ...endpoint({
    schema: xiaomiValidation.startCleaning,
    toRequest: ({ params }) => new Request_XiaomiStartCleaning(params),
    serve: request => xiaomiService.startCleaning(request)
  }));

  router.post("/devices/:deviceId/stopCleaning", ...endpoint({
    schema: xiaomiValidation.stopCleaning,
    toRequest: ({ params }) => new Request_XiaomiStopCleaning(params),
    serve: request => xiaomiService.stopCleaning(request)
  }));

  router.post("/devices/:deviceId/dock", ...endpoint({
    schema: xiaomiValidation.dock,
    toRequest: ({ params }) => new Request_XiaomiDock(params),
    serve: request => xiaomiService.dock(request)
  }));

  router.get("/devices/:deviceId/roomMapping", ...endpoint({
    schema: xiaomiValidation.getRoomMapping,
    toRequest: ({ params }) => new Request_XiaomiGetRoomMapping(params),
    serve: request => xiaomiService.getRoomMapping(request)
  }));

  router.post("/devices/:deviceId/navigateToRoom", ...endpoint({
    schema: xiaomiValidation.navigateToRoom,
    toRequest: ({ params, body }) => new Request_XiaomiNavigateToRoom({ ...body, deviceId: params.deviceId }),
    serve: request => xiaomiService.navigateToRoom(request)
  }));

  return router;
}
