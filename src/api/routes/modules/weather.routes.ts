import { Router } from "express";
import { Request_WeatherRefreshDevice } from "../../../model/requests/Request_WeatherRefreshDevice.js";
import { Request_WeatherUpdateCoordinates } from "../../../model/requests/Request_WeatherUpdateCoordinates.js";
import { WeatherModuleManager } from "../../../modules/weather/weatherModuleManager.js";
import { endpoint } from "../../http/endpoint.js";
import { WeatherService } from "../../services/modules/weather.service.js";
import { weatherValidation } from "../../validation/modules/weather.validation.js";
import type { RouterDeps } from "../../router.js";

export function createWeatherModuleRouter(deps: RouterDeps) {
  const router = Router();
  const weatherModule = new WeatherModuleManager(deps.databaseManager, deps.actionManager, deps.eventManager);
  deps.actionManager.registerModuleManager(weatherModule);
  const weatherService = new WeatherService(weatherModule, deps.actionManager);

  router.post("/devices/:deviceId/refresh", ...endpoint({
    schema: weatherValidation.refreshDevice,
    toRequest: ({ params }) => new Request_WeatherRefreshDevice(params),
    serve: request => weatherService.refreshDevice(request)
  }));

  router.put("/devices/:deviceId/coordinates", ...endpoint({
    schema: weatherValidation.updateCoordinates,
    toRequest: ({ params, body }) => new Request_WeatherUpdateCoordinates({ ...body, deviceId: params.deviceId }),
    serve: request => weatherService.updateCoordinates(request)
  }));

  return router;
}
