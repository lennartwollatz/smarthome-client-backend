import { logger } from "../../../config/logger.js";
import type { DenonModuleManager } from "../../../modules/heos/denon/denonModuleManager.js";
import type { Request_DenonDiscoverDevices } from "../../../model/requests/Request_DenonDiscoverDevices.js";
import type { Request_DenonPlayNext } from "../../../model/requests/Request_DenonPlayNext.js";
import type { Request_DenonPlayPrevious } from "../../../model/requests/Request_DenonPlayPrevious.js";
import type { Request_DenonSetMute } from "../../../model/requests/Request_DenonSetMute.js";
import type { Request_DenonSetOff } from "../../../model/requests/Request_DenonSetOff.js";
import type { Request_DenonSetOn } from "../../../model/requests/Request_DenonSetOn.js";
import type { Request_DenonSetPlayState } from "../../../model/requests/Request_DenonSetPlayState.js";
import type { Request_DenonSetSource } from "../../../model/requests/Request_DenonSetSource.js";
import type { Request_DenonSetVolume } from "../../../model/requests/Request_DenonSetVolume.js";
import type { Request_DenonSetVolumeMax } from "../../../model/requests/Request_DenonSetVolumeMax.js";
import type { Request_DenonSetVolumeStart } from "../../../model/requests/Request_DenonSetVolumeStart.js";
import type { Request_DenonSetZonePower } from "../../../model/requests/Request_DenonSetZonePower.js";
import { Response_DenonDiscoverDevices } from "../../../model/responses/Response_DenonDiscoverDevices.js";
import { Response_DenonPlayNext } from "../../../model/responses/Response_DenonPlayNext.js";
import { Response_DenonPlayPrevious } from "../../../model/responses/Response_DenonPlayPrevious.js";
import { Response_DenonSetMute } from "../../../model/responses/Response_DenonSetMute.js";
import { Response_DenonSetOff } from "../../../model/responses/Response_DenonSetOff.js";
import { Response_DenonSetOn } from "../../../model/responses/Response_DenonSetOn.js";
import { Response_DenonSetPlayState } from "../../../model/responses/Response_DenonSetPlayState.js";
import { Response_DenonSetSource } from "../../../model/responses/Response_DenonSetSource.js";
import { Response_DenonSetVolume } from "../../../model/responses/Response_DenonSetVolume.js";
import { Response_DenonSetVolumeMax } from "../../../model/responses/Response_DenonSetVolumeMax.js";
import { Response_DenonSetVolumeStart } from "../../../model/responses/Response_DenonSetVolumeStart.js";
import { Response_DenonSetZonePower } from "../../../model/responses/Response_DenonSetZonePower.js";
import { ApiError } from "../../http/ApiError.js";

const DEVICE_NOT_FOUND = "Gerät nicht gefunden";
const PLAY_STATES = ["play", "pause", "stop"];

export class DenonService {
  constructor(private readonly denonModule: DenonModuleManager) {}

  async discoverDevices(_request: Request_DenonDiscoverDevices): Promise<Response_DenonDiscoverDevices> {
    const devices = await this.execute("Fehler beim Discover von Denon-Geräten", () =>
      this.denonModule.discoverDevices()
    );
    return new Response_DenonDiscoverDevices(devices);
  }

  async setVolume(request: Request_DenonSetVolume): Promise<Response_DenonSetVolume> {
    const { deviceId, volume } = request;
    if (volume == null) throw ApiError.badRequest("Volume-Parameter fehlt");
    await this.control("Fehler beim Setzen der Lautstärke", () => this.denonModule.setVolume(deviceId, volume));
    return new Response_DenonSetVolume();
  }

  async setOn(request: Request_DenonSetOn): Promise<Response_DenonSetOn> {
    await this.control("Fehler beim Einschalten des Geräts", () =>
      this.denonModule.setPlayState(request.deviceId, "play")
    );
    return new Response_DenonSetOn();
  }

  async setOff(request: Request_DenonSetOff): Promise<Response_DenonSetOff> {
    await this.control("Fehler beim Ausschalten des Geräts", () =>
      this.denonModule.setPlayState(request.deviceId, "stop")
    );
    return new Response_DenonSetOff();
  }

  async setPlayState(request: Request_DenonSetPlayState): Promise<Response_DenonSetPlayState> {
    const { deviceId, state } = request;
    if (!state || !PLAY_STATES.includes(state)) {
      throw ApiError.badRequest("Ungültiger State-Wert (muss 'play', 'pause' oder 'stop' sein)");
    }
    await this.control("Fehler beim Setzen des Wiedergabestatus", () =>
      this.denonModule.setPlayState(deviceId, state)
    );
    return new Response_DenonSetPlayState();
  }

  async setMute(request: Request_DenonSetMute): Promise<Response_DenonSetMute> {
    const { deviceId, mute } = request;
    if (mute == null) throw ApiError.badRequest("Mute-Parameter fehlt");
    await this.control("Fehler beim Setzen der Stummschaltung", () => this.denonModule.setMute(deviceId, mute));
    return new Response_DenonSetMute();
  }

  async playNext(request: Request_DenonPlayNext): Promise<Response_DenonPlayNext> {
    await this.control("Fehler beim Abspielen des naechsten Titels", () =>
      this.denonModule.playNext(request.deviceId)
    );
    return new Response_DenonPlayNext();
  }

  async playPrevious(request: Request_DenonPlayPrevious): Promise<Response_DenonPlayPrevious> {
    await this.control("Fehler beim Abspielen des vorherigen Titels", () =>
      this.denonModule.playPrevious(request.deviceId)
    );
    return new Response_DenonPlayPrevious();
  }

  async setVolumeStart(request: Request_DenonSetVolumeStart): Promise<Response_DenonSetVolumeStart> {
    const { deviceId, volumeStart } = request;
    if (volumeStart == null || volumeStart < 0 || volumeStart > 100) {
      throw ApiError.badRequest("Parameter volumeStart fehlt oder ungültig (0–100)");
    }
    await this.control("Fehler beim Setzen von Volume-Start", () =>
      this.denonModule.setVolumeStart(deviceId, volumeStart)
    );
    return new Response_DenonSetVolumeStart();
  }

  async setVolumeMax(request: Request_DenonSetVolumeMax): Promise<Response_DenonSetVolumeMax> {
    const { deviceId, volumeMax } = request;
    if (volumeMax == null || volumeMax < 0 || volumeMax > 100) {
      throw ApiError.badRequest("Parameter volumeMax fehlt oder ungültig (0–100)");
    }
    await this.control("Fehler beim Setzen von Volume-Max", () => this.denonModule.setVolumeMax(deviceId, volumeMax));
    return new Response_DenonSetVolumeMax();
  }

  async setSource(request: Request_DenonSetSource): Promise<Response_DenonSetSource> {
    const { deviceId, sourceIndex, selected } = request;
    if (!sourceIndex) throw ApiError.badRequest("Parameter sourceIndex fehlt");
    await this.control("Fehler beim Setzen der aktiven Quelle", () =>
      this.denonModule.setSource(deviceId, sourceIndex, selected ?? false)
    );
    return new Response_DenonSetSource();
  }

  async setZonePower(request: Request_DenonSetZonePower): Promise<Response_DenonSetZonePower> {
    const { deviceId, zoneName, power } = request;
    if (!zoneName) throw ApiError.badRequest("Parameter zoneName fehlt");
    await this.control("Fehler beim Setzen der Zonen-Power", () =>
      this.denonModule.setZonePower(deviceId, zoneName, power ?? false)
    );
    return new Response_DenonSetZonePower();
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
