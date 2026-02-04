import { logger } from "../../../../logger.js";
import { DeviceSpeaker } from "../../../../model/devices/DeviceSpeaker.js";
import { HeosController } from "./heosController.js";

export class HeosSpeaker extends DeviceSpeaker {
  address?: string;
  pid?: number;
  private heos?: HeosController;

  constructor();
  constructor(name: string, id: string, address: string, pid: number, heos: HeosController);
  constructor(
    name?: string,
    id?: string,
    address?: string,
    pid?: number,
    heos?: HeosController
  ) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.address = address;
    this.pid = pid ?? 0;
    if (heos === undefined && name) {
      logger.error({ name, id }, "HeosController ist null beim Erstellen von HeosSpeaker");
      throw new Error("HeosController darf nicht null sein");
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

  override updateValues() {
    if (!this.heos) {
      logger.debug(
        { id: this.id },
        "updateValues() uebersprungen - heos ist noch null"
      );
      return;
    }

    logger.debug({ id: this.id, heosSet: Boolean(this.heos) }, "Initialisiere Werte");

    this.heos
      .getVolume(this)
      .then(volume => {
        this.volume = volume;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Lautstaerke");
      });

    this.heos
      .getMute(this)
      .then(mute => {
        this.muted = mute;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des Muted Attributs");
      });

    this.heos
      .getPlayState(this)
      .then(playState => {
        this.playState = playState;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des PlayState");
      });
  }

  setHeosController(heosController?: HeosController) {
    this.heos = heosController;
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

