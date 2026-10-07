import type { ActionManager } from "../../../actions/ActionManager.js";
import { logger } from "../../../config/logger.js";
import type { LGModuleManager } from "../../../modules/lg/lgModuleManager.js";
import type { Request_LgDiscoverDevices } from "../../../model/requests/Request_LgDiscoverDevices.js";
import type { Request_LgGetApps } from "../../../model/requests/Request_LgGetApps.js";
import type { Request_LgGetChannels } from "../../../model/requests/Request_LgGetChannels.js";
import type { Request_LgGetSelectedApp } from "../../../model/requests/Request_LgGetSelectedApp.js";
import type { Request_LgGetSelectedChannel } from "../../../model/requests/Request_LgGetSelectedChannel.js";
import type { Request_LgNotify } from "../../../model/requests/Request_LgNotify.js";
import type { Request_LgPair } from "../../../model/requests/Request_LgPair.js";
import type { Request_LgScreenOff } from "../../../model/requests/Request_LgScreenOff.js";
import type { Request_LgScreenOn } from "../../../model/requests/Request_LgScreenOn.js";
import type { Request_LgSetChannel } from "../../../model/requests/Request_LgSetChannel.js";
import type { Request_LgSetHomeAppNumber } from "../../../model/requests/Request_LgSetHomeAppNumber.js";
import type { Request_LgSetHomeChannelNumber } from "../../../model/requests/Request_LgSetHomeChannelNumber.js";
import type { Request_LgSetOff } from "../../../model/requests/Request_LgSetOff.js";
import type { Request_LgSetOn } from "../../../model/requests/Request_LgSetOn.js";
import type { Request_LgSetVolume } from "../../../model/requests/Request_LgSetVolume.js";
import type { Request_LgStartApp } from "../../../model/requests/Request_LgStartApp.js";
import { Response_LgDiscoverDevices } from "../../../model/responses/Response_LgDiscoverDevices.js";
import { Response_LgGetApps } from "../../../model/responses/Response_LgGetApps.js";
import { Response_LgGetChannels } from "../../../model/responses/Response_LgGetChannels.js";
import { Response_LgGetSelectedApp } from "../../../model/responses/Response_LgGetSelectedApp.js";
import { Response_LgGetSelectedChannel } from "../../../model/responses/Response_LgGetSelectedChannel.js";
import { Response_LgNotify } from "../../../model/responses/Response_LgNotify.js";
import { Response_LgPair } from "../../../model/responses/Response_LgPair.js";
import { Response_LgScreenOff } from "../../../model/responses/Response_LgScreenOff.js";
import { Response_LgScreenOn } from "../../../model/responses/Response_LgScreenOn.js";
import { Response_LgSetChannel } from "../../../model/responses/Response_LgSetChannel.js";
import { Response_LgSetHomeAppNumber } from "../../../model/responses/Response_LgSetHomeAppNumber.js";
import { Response_LgSetHomeChannelNumber } from "../../../model/responses/Response_LgSetHomeChannelNumber.js";
import { Response_LgSetOff } from "../../../model/responses/Response_LgSetOff.js";
import { Response_LgSetOn } from "../../../model/responses/Response_LgSetOn.js";
import { Response_LgSetVolume } from "../../../model/responses/Response_LgSetVolume.js";
import { Response_LgStartApp } from "../../../model/responses/Response_LgStartApp.js";
import { ApiError } from "../../http/ApiError.js";

const INVALID_REQUEST = "Invalid request";
const DEVICE_NOT_SUPPORTED = "Gerät nicht gefunden oder nicht unterstützt";
const NO_DATA = "Gerät nicht gefunden oder keine Daten";

export class LgService {
  constructor(
    private readonly lgModule: LGModuleManager,
    private readonly actionManager: ActionManager
  ) {}

  async discoverDevices(_request: Request_LgDiscoverDevices): Promise<Response_LgDiscoverDevices> {
    const errorMessage = "Fehler beim Discover von LG-Geraeten";
    try {
      return new Response_LgDiscoverDevices(await this.lgModule.discoverDevices());
    } catch (err) {
      logger.error({ err }, errorMessage);
      throw ApiError.internal(errorMessage);
    }
  }

  async pair(request: Request_LgPair): Promise<Response_LgPair> {
    await this.control("Fehler beim Pairing des LG-Geraets", () => this.lgModule.connectDevice(request.deviceId));
    return new Response_LgPair(this.actionManager.getDevice(request.deviceId) ?? undefined);
  }

  async setOn(request: Request_LgSetOn): Promise<Response_LgSetOn> {
    await this.control("Fehler beim Einschalten des LG-Geraets", () => this.lgModule.powerOn(request.deviceId));
    return new Response_LgSetOn();
  }

  async setOff(request: Request_LgSetOff): Promise<Response_LgSetOff> {
    await this.control("Fehler beim Ausschalten des LG-Geraets", () => this.lgModule.powerOff(request.deviceId));
    return new Response_LgSetOff();
  }

  async setVolume(request: Request_LgSetVolume): Promise<Response_LgSetVolume> {
    const { deviceId, volume } = request;
    if (volume == null) throw ApiError.badRequest("volume parameter is required");
    await this.control("Fehler beim Setzen der Lautstaerke", () => this.lgModule.setVolume(deviceId, volume));
    return new Response_LgSetVolume();
  }

  async screenOn(request: Request_LgScreenOn): Promise<Response_LgScreenOn> {
    await this.control("Fehler beim Einschalten des LG-Screens", () => this.lgModule.screenOn(request.deviceId));
    return new Response_LgScreenOn();
  }

  async screenOff(request: Request_LgScreenOff): Promise<Response_LgScreenOff> {
    await this.control("Fehler beim Ausschalten des LG-Screens", () => this.lgModule.screenOff(request.deviceId));
    return new Response_LgScreenOff();
  }

  async setChannel(request: Request_LgSetChannel): Promise<Response_LgSetChannel> {
    const { deviceId, channelId } = request;
    if (!channelId) throw ApiError.badRequest("channelId parameter is required");
    await this.control("Fehler beim Setzen des Channels", () => this.lgModule.setChannel(deviceId, channelId));
    return new Response_LgSetChannel();
  }

  async startApp(request: Request_LgStartApp): Promise<Response_LgStartApp> {
    const { deviceId, appId } = request;
    if (!appId) throw ApiError.badRequest("appId parameter is required");
    await this.control("Fehler beim Starten der App", () => this.lgModule.startApp(deviceId, appId));
    return new Response_LgStartApp();
  }

  async notify(request: Request_LgNotify): Promise<Response_LgNotify> {
    const { deviceId, message } = request;
    if (!message) throw ApiError.badRequest("message parameter is required");
    await this.control("Fehler beim Senden der Benachrichtigung", () => this.lgModule.notify(deviceId, message));
    return new Response_LgNotify();
  }

  async getChannels(request: Request_LgGetChannels): Promise<Response_LgGetChannels> {
    const channels = await this.execute("Fehler beim Laden der Channels", () =>
      this.lgModule.getChannels(request.deviceId)
    );
    return new Response_LgGetChannels(channels);
  }

  async getApps(request: Request_LgGetApps): Promise<Response_LgGetApps> {
    const apps = await this.execute("Fehler beim Laden der Apps", () => this.lgModule.getApps(request.deviceId));
    if (!apps) throw ApiError.notFound(NO_DATA);
    return new Response_LgGetApps(apps);
  }

  async getSelectedApp(request: Request_LgGetSelectedApp): Promise<Response_LgGetSelectedApp> {
    const appId = await this.execute("Fehler beim Laden der ausgewaehlten App", () =>
      this.lgModule.getSelectedApp(request.deviceId)
    );
    if (!appId) throw ApiError.notFound(NO_DATA);
    return new Response_LgGetSelectedApp(appId);
  }

  async getSelectedChannel(request: Request_LgGetSelectedChannel): Promise<Response_LgGetSelectedChannel> {
    const channelId = await this.execute("Fehler beim Laden des ausgewaehlten Channels", () =>
      this.lgModule.getSelectedChannel(request.deviceId)
    );
    if (!channelId) throw ApiError.notFound(NO_DATA);
    return new Response_LgGetSelectedChannel(channelId);
  }

  async setHomeAppNumber(request: Request_LgSetHomeAppNumber): Promise<Response_LgSetHomeAppNumber> {
    const { deviceId, appId, homeAppNumber } = request;
    if (!appId || homeAppNumber == null) throw ApiError.badRequest("appId und homeAppNumber sind erforderlich");
    await this.control(
      "Fehler beim Setzen der Home-App-Nummer",
      () => this.lgModule.setHomeAppNumber(deviceId, appId, homeAppNumber),
      "Gerät/App nicht gefunden oder ungültige Nummer"
    );
    return new Response_LgSetHomeAppNumber();
  }

  async setHomeChannelNumber(request: Request_LgSetHomeChannelNumber): Promise<Response_LgSetHomeChannelNumber> {
    const { deviceId, channelId, homeChannelNumber } = request;
    if (!channelId || homeChannelNumber == null) {
      throw ApiError.badRequest("channelId und homeChannelNumber sind erforderlich");
    }
    await this.control(
      "Fehler beim Setzen der Home-Channel-Nummer",
      () => this.lgModule.setHomeChannelNumber(deviceId, channelId, homeChannelNumber),
      "Gerät/Channel nicht gefunden oder ungültige Nummer"
    );
    return new Response_LgSetHomeChannelNumber();
  }

  /** Ausnahmen des Moduls werden protokolliert und als 400 „Invalid request“ gemeldet. */
  private async execute<T>(logMessage: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (err) {
      logger.error({ err }, logMessage);
      throw ApiError.badRequest(INVALID_REQUEST);
    }
  }

  /** Gerätesteuerung: `false` vom Modul → 404 mit `notFoundMessage`, Ausnahme → 400. */
  private async control(
    logMessage: string,
    action: () => Promise<boolean>,
    notFoundMessage = DEVICE_NOT_SUPPORTED
  ): Promise<void> {
    if (!(await this.execute(logMessage, action))) throw ApiError.notFound(notFoundMessage);
  }
}
