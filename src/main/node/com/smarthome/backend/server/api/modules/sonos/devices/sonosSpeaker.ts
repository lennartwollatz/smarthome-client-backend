import { DeviceSpeakerReceiver } from "com/smarthome/backend/model/devices/DeviceSpeakerReceiver.js";
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
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Lautstaerke");
      });

    await this.sonos
      .getMute(this)
      .then(mute => {
        this.muted = mute;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des Muted Attributs");
      });

    await this.sonos
      .getPlayState(this)
      .then(playState => {
        this.playState = playState;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des PlayState");
      });
  }

  setSonosController(sonosController?: SonosDeviceController) {
    this.sonos = sonosController;
  }

  protected async executeSetVolume(volume: number): Promise<void> {
    if (this.sonos) {
      await this.sonos.setVolume(this, volume).catch(err => {
        logger.error({ err, deviceId: this.id, volume }, "Fehler beim Setzen der Lautstärke");
      });
    }
  }

  protected async executePlay(): Promise<void> {
    if (this.sonos) {
      await this.sonos.setPlayState(this, "play").catch(err => {
        logger.error({ err, deviceId: this.id }, "Fehler beim Abspielen");
      });
    }
  }

  protected async executePause(): Promise<void> {
    if (this.sonos) {
      await this.sonos.setPlayState(this, "pause").catch(err => {
        logger.error({ err, deviceId: this.id }, "Fehler beim Pausieren");
      });
    }
  }

  protected async executeStop(): Promise<void> {
    if (this.sonos) {
      await this.sonos.setPlayState(this, "stop").catch(err => {
        logger.error({ err, deviceId: this.id }, "Fehler beim Stoppen");
      });
    }
  }

  protected async executeSetMute(muted: boolean): Promise<void> {
    if (this.sonos) {
      await this.sonos.setMute(this, muted).catch(err => {
        logger.error({ err, deviceId: this.id, muted }, "Fehler beim Setzen der Stummschaltung");
      });
    }
  }

  protected async executePlayNext(): Promise<void> {
    if (this.sonos) {
      await this.sonos.playNext(this).catch(err => {
        logger.error({ err, deviceId: this.id }, "Fehler beim Abspielen des nächsten Titels");
      });
    }
  }

  protected async executePlayPrevious(): Promise<void> {
    if (this.sonos) {
      await this.sonos.playPrevious(this).catch(err => {
        logger.error({ err, deviceId: this.id }, "Fehler beim Abspielen des vorherigen Titels");
      });
    }
  }

  protected async executePlaySound(sound: string): Promise<void> {
    if (this.sonos) {
      await this.sonos.playSong(this, sound).catch(err => {
        logger.error({ err, deviceId: this.id, sound }, "Fehler beim Abspielen eines Sounds");
      });
    }
  }

  protected async executePlayTextAsSound(text: string): Promise<void> {
    if (this.sonos) {
      await this.sonos.playTextAsSpeech(this, text).catch(err => {
        logger.error({ err, deviceId: this.id, text }, "Fehler beim Abspielen von Text als Sprache");
      });
    }
  }

  protected async executeGroupWith(devices: (DeviceSpeaker | DeviceSpeakerReceiver)[]): Promise<void> {
    if (this.sonos) {
      await this.sonos.groupSpeakers(this, devices).catch(err => {
        logger.error({ err, deviceId: this.id, devices }, "Fehler beim Gruppieren");
      });
    }
  }

  protected async executeLeaveSpeakerGroup(): Promise<void> {
    if (this.sonos) {
      await this.sonos.leaveSpeakerGroup(this);
    }
  }
}

