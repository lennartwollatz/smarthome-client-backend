import { logger } from "../../../config/logger.js";
import type { Request_BmwDiscoverDevices } from "../../../model/requests/Request_BmwDiscoverDevices.js";
import type { Request_BmwGetCredentials } from "../../../model/requests/Request_BmwGetCredentials.js";
import type { Request_BmwRefreshDevice } from "../../../model/requests/Request_BmwRefreshDevice.js";
import type { Request_BmwSendAddress } from "../../../model/requests/Request_BmwSendAddress.js";
import type { Request_BmwSetCaptchaToken } from "../../../model/requests/Request_BmwSetCaptchaToken.js";
import type { Request_BmwSetCredentials } from "../../../model/requests/Request_BmwSetCredentials.js";
import type { Request_BmwSetPassword } from "../../../model/requests/Request_BmwSetPassword.js";
import type { Request_BmwStartClimateControl } from "../../../model/requests/Request_BmwStartClimateControl.js";
import type { Request_BmwStopClimateControl } from "../../../model/requests/Request_BmwStopClimateControl.js";
import { Response_BmwCredentials } from "../../../model/responses/Response_BmwCredentials.js";
import { Response_BmwDiscoverDevices } from "../../../model/responses/Response_BmwDiscoverDevices.js";
import { Response_BmwDiscoverDevicesError } from "../../../model/responses/Response_BmwDiscoverDevicesError.js";
import { Response_BmwGetCredentials } from "../../../model/responses/Response_BmwGetCredentials.js";
import { Response_BmwRefreshDevice } from "../../../model/responses/Response_BmwRefreshDevice.js";
import { Response_BmwSendAddress } from "../../../model/responses/Response_BmwSendAddress.js";
import { Response_BmwSetCaptchaToken } from "../../../model/responses/Response_BmwSetCaptchaToken.js";
import { Response_BmwSetCredentials } from "../../../model/responses/Response_BmwSetCredentials.js";
import { Response_BmwSetPassword } from "../../../model/responses/Response_BmwSetPassword.js";
import { Response_BmwStartClimateControl } from "../../../model/responses/Response_BmwStartClimateControl.js";
import { Response_BmwStopClimateControl } from "../../../model/responses/Response_BmwStopClimateControl.js";
import type { BMWModuleManager } from "../../../modules/bmw/bmwModuleManager.js";
import { ApiError } from "../../http/ApiError.js";

const CAR_NOT_FOUND = "Fahrzeug nicht gefunden";
const DISCOVERY_REQUIRES_CREDENTIALS = "Discovery ist erst nach Setzen von Username und Passwort moeglich";
const DEFAULT_ADDRESS_SUBJECT = "Ziel";

export class BmwService {
  constructor(private readonly bmwModule: BMWModuleManager) {}

  getCredentials(_request: Request_BmwGetCredentials): Response_BmwGetCredentials {
    return new Response_BmwGetCredentials(this.bmwModule.getCredentialsInfo());
  }

  setCredentials(request: Request_BmwSetCredentials): Response_BmwSetCredentials {
    this.bmwModule.setCredentials(request.username, request.password ?? undefined, request.captchaToken ?? undefined);
    return new Response_BmwSetCredentials(this.bmwModule.getCredentialsInfo());
  }

  setPassword(request: Request_BmwSetPassword): Response_BmwSetPassword {
    this.bmwModule.setPassword(request.password);
    return new Response_BmwSetPassword(this.bmwModule.getCredentialsInfo());
  }

  setCaptchaToken(request: Request_BmwSetCaptchaToken): Response_BmwSetCaptchaToken {
    this.bmwModule.setCaptchaToken(request.captchaToken);
    return new Response_BmwSetCaptchaToken(this.bmwModule.getCredentialsInfo());
  }

  async discoverDevices(_request: Request_BmwDiscoverDevices): Promise<Response_BmwDiscoverDevices> {
    const credentials = this.bmwModule.getCredentialsInfo();
    if (!credentials.canDiscover) {
      const error = credentials.hasBmwToken
        ? DISCOVERY_REQUIRES_CREDENTIALS
        : `${DISCOVERY_REQUIRES_CREDENTIALS} (Captcha nur beim ersten Login noetig)`;
      throw new ApiError(400, new Response_BmwDiscoverDevicesError(error, new Response_BmwCredentials(credentials)));
    }
    try {
      return new Response_BmwDiscoverDevices(await this.bmwModule.discoverDevices());
    } catch (err) {
      logger.error({ err }, "Fehler beim Discover von BMW Fahrzeugen");
      throw ApiError.internal("Fehler beim Discover von BMW Fahrzeugen");
    }
  }

  async startClimateControl(request: Request_BmwStartClimateControl): Promise<Response_BmwStartClimateControl> {
    if (!(await this.bmwModule.startClimateControl(request.deviceId))) throw ApiError.notFound(CAR_NOT_FOUND);
    return new Response_BmwStartClimateControl();
  }

  async stopClimateControl(request: Request_BmwStopClimateControl): Promise<Response_BmwStopClimateControl> {
    if (!(await this.bmwModule.stopClimateControl(request.deviceId))) throw ApiError.notFound(CAR_NOT_FOUND);
    return new Response_BmwStopClimateControl();
  }

  async sendAddress(request: Request_BmwSendAddress): Promise<Response_BmwSendAddress> {
    const sent = await this.bmwModule.sendAddress(request.deviceId, request.subject || DEFAULT_ADDRESS_SUBJECT, {
      name: request.name,
      coordinates: { latitude: request.latitude, longitude: request.longitude }
    });
    if (!sent) throw ApiError.notFound(CAR_NOT_FOUND);
    return new Response_BmwSendAddress();
  }

  async refreshDevice(request: Request_BmwRefreshDevice): Promise<Response_BmwRefreshDevice> {
    if (!(await this.bmwModule.refreshDevice(request.deviceId))) throw ApiError.notFound(CAR_NOT_FOUND);
    return new Response_BmwRefreshDevice();
  }
}
