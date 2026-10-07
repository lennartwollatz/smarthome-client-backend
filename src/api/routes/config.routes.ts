import { Router } from "express";
import { Request_GetPublicConfig } from "../../model/requests/Request_GetPublicConfig.js";
import { endpoint } from "../http/endpoint.js";
import { ConfigService } from "../services/config.service.js";
import { configValidation } from "../validation/config.validation.js";

export function createConfigRouter() {
  const router = Router();
  const configService = new ConfigService();

  router.get("/public", ...endpoint({
    schema: configValidation.getPublicConfig,
    toRequest: () => new Request_GetPublicConfig(),
    serve: request => configService.getPublicConfig(request)
  }));

  return router;
}
