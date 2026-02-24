import { logger } from "../../../../../logger.js";
import { DeviceSpeaker } from "../../../../../model/devices/DeviceSpeaker.js";
import { HeosDeviceController } from "../heosDeviceController.js";

export class HeosSpeaker extends DeviceSpeaker {
  address?: string;
  pid?: number;
  private heos?: HeosDeviceController;

  constructor();
  constructor(name: string, id: string, address: string, pid: number, heos: HeosDeviceController);
  constructor(
    name?: string,
    id?: string,
    address?: string,
    pid?: number,
    heos?: HeosDeviceController
  ) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.address = address;
    this.pid = pid ?? 0;
    if (heos === undefined && name) {
      logger.error({ name, id }, "HeosDeviceController ist null beim Erstellen von HeosSpeaker");
      throw new Error("HeosDeviceController darf nicht null sein");
    }
    this.heos = heos;
    if (heos) {
      this.isConnected = true;
    }
  }

  getAddress() {
    return this.address;
  }

  getPid() {
    return this.pid ?? 0;
  }

  override async updateValues(): Promise<void> {
    if (!this.heos) {
      logger.debug(
        { id: this.id },
        "updateValues() uebersprungen - heos ist noch null"
      );
      return;
    }

    // Prüfe, ob die benötigten Methoden existieren
    if (typeof this.heos.getVolume !== "function" || 
        typeof this.heos.getMute !== "function" || 
        typeof this.heos.getPlayState !== "function") {
      logger.warn(
        { id: this.id, hasGetVolume: typeof this.heos.getVolume === "function" },
        "updateValues() uebersprungen - heos Controller Methoden fehlen"
      );
      return;
    }

    logger.debug({ id: this.id, heosSet: Boolean(this.heos) }, "Initialisiere Werte");

    await this.heos
      .getVolume(this)
      .then(volume => {
        this.volume = volume;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Lautstaerke");
      });

    await this.heos
      .getMute(this)
      .then(mute => {
        this.muted = mute;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des Muted Attributs");
      });

    await this.heos
      .getPlayState(this)
      .then(playState => {
        this.playState = playState;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des PlayState");
      });
  }

  setHeosController(heosController?: HeosDeviceController) {
    if (heosController) {
      this.heos = heosController;
      this.isConnected = true;
    }
  }

  protected executeSetVolume(volume: number) {
    this.heos?.setVolume(this, volume);
  }

  protected executePlay() {
    logger.info("player play");
    this.heos?.setPlayState(this, "play");
  }

  protected executePause() {
    this.heos?.setPlayState(this, "pause");
  }

  protected executeStopp() {
    this.heos?.setPlayState(this, "stop");
  }

  protected executeSetMute(muted: boolean) {
    this.heos?.setMute(this, muted);
  }

  protected executePlayNext() {
    this.heos?.playNext(this);
  }

  protected executePlayPrevious() {
    this.heos?.playPrevious(this);
  }

  protected executePlaySound(sound: string) {
    this.heos?.playSong(this, sound);
  }

  protected executePlayTextAsSound(text: string) {
    this.heos?.playTextAsSpeech(this, text);
  }
}

