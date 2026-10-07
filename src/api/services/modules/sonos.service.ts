import { logger } from "../../../config/logger.js";
import type { SonosModuleManager } from "../../../modules/sonos/sonosModuleManager.js";
import type { Request_SonosDiscoverDevices } from "../../../model/requests/Request_SonosDiscoverDevices.js";
import type { Request_SonosPlayNext } from "../../../model/requests/Request_SonosPlayNext.js";
import type { Request_SonosPlayPrevious } from "../../../model/requests/Request_SonosPlayPrevious.js";
import type { Request_SonosSetMute } from "../../../model/requests/Request_SonosSetMute.js";
import type { Request_SonosSetOff } from "../../../model/requests/Request_SonosSetOff.js";
import type { Request_SonosSetOn } from "../../../model/requests/Request_SonosSetOn.js";
import type { Request_SonosSetPlayState } from "../../../model/requests/Request_SonosSetPlayState.js";
import type { Request_SonosSetVolume } from "../../../model/requests/Request_SonosSetVolume.js";
import { Response_SonosDiscoverDevices } from "../../../model/responses/Response_SonosDiscoverDevices.js";
import { Response_SonosPlayNext } from "../../../model/responses/Response_SonosPlayNext.js";
import { Response_SonosPlayPrevious } from "../../../model/responses/Response_SonosPlayPrevious.js";
import { Response_SonosSetMute } from "../../../model/responses/Response_SonosSetMute.js";
import { Response_SonosSetOff } from "../../../model/responses/Response_SonosSetOff.js";
import { Response_SonosSetOn } from "../../../model/responses/Response_SonosSetOn.js";
import { Response_SonosSetPlayState } from "../../../model/responses/Response_SonosSetPlayState.js";
import { Response_SonosSetVolume } from "../../../model/responses/Response_SonosSetVolume.js";
import { ApiError } from "../../http/ApiError.js";

const DEVICE_NOT_FOUND = "Gerät nicht gefunden";
const PLAY_STATES = ["play", "pause", "stop"];

export class SonosService {
  constructor(private readonly sonosModule: SonosModuleManager) {}

  async discoverDevices(_request: Request_SonosDiscoverDevices): Promise<Response_SonosDiscoverDevices> {
    const devices = await this.execute("Fehler beim Discover von Sonos-Geräten", () =>
      this.sonosModule.discoverDevices()
    );
    return new Response_SonosDiscoverDevices(devices);
  }

  async setVolume(request: Request_SonosSetVolume): Promise<Response_SonosSetVolume> {
    const { deviceId, volume } = request;
    if (volume == null) throw ApiError.badRequest("Volume-Parameter fehlt");
    await this.control("Fehler beim Setzen der Lautstärke", () => this.sonosModule.setVolume(deviceId, volume));
    return new Response_SonosSetVolume();
  }

  async setOn(request: Request_SonosSetOn): Promise<Response_SonosSetOn> {
    await this.changePlayState(request.deviceId, "play", "Fehler beim Einschalten des Geräts");
    return new Response_SonosSetOn();
  }

  async setOff(request: Request_SonosSetOff): Promise<Response_SonosSetOff> {
    await this.changePlayState(request.deviceId, "stop", "Fehler beim Ausschalten des Geräts");
    return new Response_SonosSetOff();
  }

  async setPlayState(request: Request_SonosSetPlayState): Promise<Response_SonosSetPlayState> {
    const { deviceId, state } = request;
    if (!state || !PLAY_STATES.includes(state)) {
      throw ApiError.badRequest("Ungültiger State-Wert (muss 'play', 'pause' oder 'stop' sein)");
    }
    await this.changePlayState(deviceId, state, "Fehler beim Setzen des Wiedergabestatus");
    return new Response_SonosSetPlayState();
  }

  async setMute(request: Request_SonosSetMute): Promise<Response_SonosSetMute> {
    const { deviceId, mute } = request;
    if (mute == null) throw ApiError.badRequest("Mute-Parameter fehlt");
    await this.control("Fehler beim Setzen der Stummschaltung", () => this.sonosModule.setMute(deviceId, mute));
    return new Response_SonosSetMute();
  }

  async playNext(request: Request_SonosPlayNext): Promise<Response_SonosPlayNext> {
    await this.control("Fehler beim Abspielen des naechsten Titels", () =>
      this.sonosModule.playNext(request.deviceId)
    );
    return new Response_SonosPlayNext();
  }

  async playPrevious(request: Request_SonosPlayPrevious): Promise<Response_SonosPlayPrevious> {
    await this.control("Fehler beim Abspielen des vorherigen Titels", () =>
      this.sonosModule.playPrevious(request.deviceId)
    );
    return new Response_SonosPlayPrevious();
  }

  /** Jeder Fehlschlag des Moduls (auch ein unbekanntes Gerät) wird als 500 gemeldet. */
  private async changePlayState(deviceId: string, state: string, errorMessage: string): Promise<void> {
    const result = await this.execute(errorMessage, () => this.sonosModule.setPlayState(deviceId, state));
    if (!result.success) throw ApiError.internal(result.error || errorMessage);
  }

  /** Ausnahmen des Moduls werden protokolliert und als 500 mit `errorMessage` gemeldet. */
  private async execute<T>(errorMessage: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (err) {
      logger.error({ err }, errorMessage);
      throw ApiError.internal(errorMessage);
    }
  }

  /** Gerätesteuerung: `false` vom Modul → 404, Ausnahme → 500. */
  private async control(errorMessage: string, action: () => Promise<boolean>): Promise<void> {
    if (!(await this.execute(errorMessage, action))) throw ApiError.notFound(DEVICE_NOT_FOUND);
  }
}
