import { Router } from "express";
import { Request_DeleteDevice } from "../../model/requests/Request_DeleteDevice.js";
import { Request_GetDevices } from "../../model/requests/Request_GetDevices.js";
import { Request_UpdateDevice } from "../../model/requests/Request_UpdateDevice.js";
import { endpoint } from "../http/endpoint.js";
import { DeviceService } from "../services/device.service.js";
import { deviceValidation } from "../validation/device.validation.js";
import type { RouterDeps } from "../router.js";

export function createDeviceRouter(deps: RouterDeps) {
  const router = Router();
  const deviceService = new DeviceService(deps.actionManager);

  router.get("/", ...endpoint({
    schema: deviceValidation.getDevices,
    toRequest: () => new Request_GetDevices(),
    serve: request => deviceService.getDevices(request)
  }));

  router.delete("/:deviceId", ...endpoint({
    schema: deviceValidation.deleteDevice,
    toRequest: ({ params }) => new Request_DeleteDevice(params),
    serve: request => deviceService.deleteDevice(request)
  }));

  router.put("/:deviceId", ...endpoint({
    schema: deviceValidation.updateDevice,
    toRequest: ({ params, body }) => new Request_UpdateDevice({ ...body, deviceId: params.deviceId }),
    serve: request => deviceService.updateDevice(request)
  }));

  return router;
}
