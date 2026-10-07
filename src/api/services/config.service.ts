import { getAppConfig } from "../../config/appConfig.js";
import type { Request_GetPublicConfig } from "../../model/requests/Request_GetPublicConfig.js";
import { Response_GetPublicConfig } from "../../model/responses/Response_GetPublicConfig.js";

export class ConfigService {
  getPublicConfig(_request: Request_GetPublicConfig): Response_GetPublicConfig {
    return new Response_GetPublicConfig(getAppConfig().hcaptchaSiteKey);
  }
}
