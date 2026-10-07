import { logger } from "../../../config/logger.js";
import type { Request_XiaomiAddDevice } from "../../../model/requests/Request_XiaomiAddDevice.js";
import type { Request_XiaomiDiscoverDevices } from "../../../model/requests/Request_XiaomiDiscoverDevices.js";
import type { Request_XiaomiDock } from "../../../model/requests/Request_XiaomiDock.js";
import type { Request_XiaomiGetRoomMapping } from "../../../model/requests/Request_XiaomiGetRoomMapping.js";
import type { Request_XiaomiNavigateToRoom } from "../../../model/requests/Request_XiaomiNavigateToRoom.js";
import type { Request_XiaomiStartCleaning } from "../../../model/requests/Request_XiaomiStartCleaning.js";
import type { Request_XiaomiStopCleaning } from "../../../model/requests/Request_XiaomiStopCleaning.js";
import { Response_XiaomiAddDevice } from "../../../model/responses/Response_XiaomiAddDevice.js";
import { Response_XiaomiDiscoverDevices } from "../../../model/responses/Response_XiaomiDiscoverDevices.js";
import { Response_XiaomiDock } from "../../../model/responses/Response_XiaomiDock.js";
import { Response_XiaomiGetRoomMapping } from "../../../model/responses/Response_XiaomiGetRoomMapping.js";
import { Response_XiaomiNavigateToRoom } from "../../../model/responses/Response_XiaomiNavigateToRoom.js";
import { Response_XiaomiStartCleaning } from "../../../model/responses/Response_XiaomiStartCleaning.js";
import { Response_XiaomiStopCleaning } from "../../../model/responses/Response_XiaomiStopCleaning.js";
import type { XiaomiModuleManager } from "../../../modules/xiaomi/xiaomiModuleManager.js";
import { ApiError } from "../../http/ApiError.js";

const DEVICE_NOT_FOUND = "Geraet nicht gefunden";

export class XiaomiService {
  constructor(private readonly xiaomiModule: XiaomiModuleManager) {}

  async discoverDevices(_request: Request_XiaomiDiscoverDevices): Promise<Response_XiaomiDiscoverDevices> {
    try {
      return new Response_XiaomiDiscoverDevices(await this.xiaomiModule.discoverDevices());
    } catch (err) {
      logger.error({ err }, "Fehler beim Discover von Xiaomi-Geraeten");
      throw ApiError.internal("Fehler beim Discover von Xiaomi-Geraeten");
    }
  }

  async addDevice(request: Request_XiaomiAddDevice): Promise<Response_XiaomiAddDevice> {
    try {
      return new Response_XiaomiAddDevice(await this.xiaomiModule.addDeviceByIpAndToken(request.ipAddress, request.token));
    } catch (err) {
      logger.error({ err }, "Fehler beim manuellen Hinzufuegen eines Xiaomi-Geraets");
      throw ApiError.badRequest(err instanceof Error ? err.message : "Fehler beim Hinzufuegen des Geraets");
    }
  }

  async startCleaning(request: Request_XiaomiStartCleaning): Promise<Response_XiaomiStartCleaning> {
    await this.runCommand(() => this.xiaomiModule.startCleaning(request.deviceId), request.deviceId, "Fehler beim Starten der Reinigung");
    return new Response_XiaomiStartCleaning();
  }

  async stopCleaning(request: Request_XiaomiStopCleaning): Promise<Response_XiaomiStopCleaning> {
    await this.runCommand(() => this.xiaomiModule.stopCleaning(request.deviceId), request.deviceId, "Fehler beim Stoppen der Reinigung");
    return new Response_XiaomiStopCleaning();
  }

  async dock(request: Request_XiaomiDock): Promise<Response_XiaomiDock> {
    await this.runCommand(() => this.xiaomiModule.dock(request.deviceId), request.deviceId, "Fehler beim Senden zur Docking-Station");
    return new Response_XiaomiDock();
  }

  async getRoomMapping(request: Request_XiaomiGetRoomMapping): Promise<Response_XiaomiGetRoomMapping> {
    try {
      return new Response_XiaomiGetRoomMapping(await this.xiaomiModule.getRoomMapping(request.deviceId));
    } catch (err) {
      logger.error({ err, deviceId: request.deviceId }, "Fehler beim Abrufen des Raum-Mappings");
      throw ApiError.internal("Fehler beim Abrufen des Raum-Mappings");
    }
  }

  async navigateToRoom(request: Request_XiaomiNavigateToRoom): Promise<Response_XiaomiNavigateToRoom> {
    try {
      const result = await this.xiaomiModule.navigateToRoom(request.deviceId, request.roomId);
      return new Response_XiaomiNavigateToRoom(result.status);
    } catch (err) {
      logger.error({ err, deviceId: request.deviceId }, "Fehler beim Navigieren zum Raum");
      throw ApiError.internal("Fehler beim Navigieren zum Raum");
    }
  }

  private async runCommand(command: () => Promise<boolean>, deviceId: string, errorMessage: string): Promise<void> {
    let succeeded: boolean;
    try {
      succeeded = await command();
    } catch (err) {
      logger.error({ err, deviceId }, errorMessage);
      throw ApiError.internal(errorMessage);
    }
    if (!succeeded) throw ApiError.notFound(DEVICE_NOT_FOUND);
  }
}
