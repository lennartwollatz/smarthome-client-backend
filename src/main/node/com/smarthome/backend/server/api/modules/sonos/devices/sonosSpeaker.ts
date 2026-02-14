import { logger } from "../../../../../logger.js";
import { DeviceSpeaker } from "../../../../../model/devices/DeviceSpeaker.js";
import { SonosDeviceController } from "../sonosDeviceController.js";
import { SONOSMODULE } from "../sonosModule.js";

export class SonosSpeaker extends DeviceSpeaker {
  address?: string;
  roomName?: string;
  private sonos?: SonosDeviceController;

  constructor();
  constructor(name: string, id: string, address: string, sonos: SonosDeviceController);
  constructor(
    name?: string,
    id?: string,
    address?: string,
    sonos?: SonosDeviceController
  ) {
    super();
    this.name = name;
    this.id = id ?? "889898893939399393a";
    this.address = address;
    this.sonos = sonos;
    this.moduleId = SONOSMODULE.id;
    this.isConnected = true;
  }

  getAddress() {
    return this.address;
  }

  override async updateValues(): Promise<void> {
    if (!this.sonos) {
      logger.debug(
        { id: this.id },
        "updateValues() uebersprungen - sonos ist noch null"
      );
      return;
    }

    logger.debug({ id: this.id, sonosSet: Boolean(this.sonos) }, "Initialisiere Werte");

    await this.sonos
      .getVolume(this)
      .then(volume => {
        this.volume = volume;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Lautstaerke");
      });

    await this.sonos
      .getMute(this)
      .then(mute => {
        this.muted = mute;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des Muted Attributs");
      });

    await this.sonos
      .getPlayState(this)
      .then(playState => {
        this.playState = playState;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des PlayState");
      });
  }

  setSonosController(sonosController?: SonosDeviceController) {
    this.sonos = sonosController;
  }

  protected executeSetVolume(volume: number) {
    if (this.sonos) {
      this.sonos.setVolume(this, volume).catch(err => {
        logger.error({ err, deviceId: this.id, volume }, "Fehler beim Setzen der Lautstärke");
      });
    }
  }

  protected executePlay() {
    if (this.sonos) {
      this.sonos.setPlayState(this, "play").catch(err => {
        logger.error({ err, deviceId: this.id }, "Fehler beim Abspielen");
      });
    }
  }

  protected executePause() {
    if (this.sonos) {
      this.sonos.setPlayState(this, "pause").catch(err => {
        logger.error({ err, deviceId: this.id }, "Fehler beim Pausieren");
      });
    }
  }

  protected executeStopp() {
    if (this.sonos) {
      this.sonos.setPlayState(this, "stop").catch(err => {
        logger.error({ err, deviceId: this.id }, "Fehler beim Stoppen");
      });
    }
  }

  protected executeSetMute(muted: boolean) {
    if (this.sonos) {
      this.sonos.setMute(this, muted).catch(err => {
        logger.error({ err, deviceId: this.id, muted }, "Fehler beim Setzen der Stummschaltung");
      });
    }
  }

  protected executePlayNext() {
    if (this.sonos) {
      this.sonos.playNext(this).catch(err => {
        logger.error({ err, deviceId: this.id }, "Fehler beim Abspielen des nächsten Titels");
      });
    }
  }

  protected executePlayPrevious() {
    if (this.sonos) {
      this.sonos.playPrevious(this).catch(err => {
        logger.error({ err, deviceId: this.id }, "Fehler beim Abspielen des vorherigen Titels");
      });
    }
  }

  protected executePlaySound(sound: string) {
    if (this.sonos) {
      this.sonos.playSong(this, sound).catch(err => {
        logger.error({ err, deviceId: this.id, sound }, "Fehler beim Abspielen eines Sounds");
      });
    }
  }

  protected executePlayTextAsSound(text: string) {
    if (this.sonos) {
      this.sonos.playTextAsSpeech(this, text).catch(err => {
        logger.error({ err, deviceId: this.id, text }, "Fehler beim Abspielen von Text als Sprache");
      });
    }
  }
}

