import { logger } from "../../../../../logger.js";
import { DeviceSpeakerReceiver } from "../../../../../model/devices/DeviceSpeakerReceiver.js";
import { HeosController } from "../heosController.js";
import { HeosSpeaker } from "../heosSpeaker.js";
import { DenonSpeaker } from "./denonSpeaker.js";

export class DenonReceiver extends DeviceSpeakerReceiver {
  address?: string;
  pid?: number;
  private heos?: HeosController;

  constructor(name?: string, id?: string, address?: string, pid?: number, heos?: HeosController) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.address = address;
    this.pid = pid;
    this.heos = heos;
    this.moduleId = "denon";
  }

  getAddress() {
    return this.address;
  }

  setAddress(address: string) {
    this.address = address;
  }

  getPid() {
    return this.pid ?? 0;
  }

  setPid(pid: number) {
    this.pid = pid;
  }

  setHeosController(heosController: HeosController) {
    this.heos = heosController;
  }

  updateValues() {
    if (!this.heos) {
      logger.debug(
        { id: this.id },
        "updateValues() uebersprungen - heos ist noch null"
      );
      return;
    }

    const proxy = this.toHeosSpeaker();
    logger.debug({ id: this.id, heosSet: Boolean(this.heos) }, "Initialisiere Werte");

    this.heos
      .getVolume(proxy)
      .then(currentVolume => {
        this.volume = currentVolume;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Lautstaerke");
      });

    this.heos
      .getMute(proxy)
      .then(isMuted => {
        this.muted = isMuted;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des Muted Attributs");
      });

    this.heos
      .getPlayState(proxy)
      .then(currentPlayState => {
        this.playState = currentPlayState;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des PlayState");
      });

    this.heos
      .getDenonZones(this)
      .then(zones => {
        this.zones = zones;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Zonen");
      });

    this.heos
      .getDenonSourcesList(this)
      .then(sources => {
        this.sources = sources;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Quellen");
      });

    this.heos
      .getDenonSubwoofers(this)
      .then(subwoofers => {
        this.subwoofers = subwoofers;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Subwoofer");
      });

    this.heos
      .getDenonVolumeConfig(this)
      .then(([volumeStart, volumeMax]) => {
        this.volumeStart = volumeStart;
        this.volumeMax = volumeMax;
      })
      .catch(err => {
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Lautstaerke-Konfiguration");
      });
  }

  protected executeSetVolume(volume: number) {
    this.heos?.setVolume(this.toHeosSpeaker(), volume);
  }

  protected executePlay() {
    this.heos?.setPlayState(this.toHeosSpeaker(), "play");
  }

  protected executePause() {
    this.heos?.setPlayState(this.toHeosSpeaker(), "pause");
  }

  protected executeStopp() {
    this.heos?.setPlayState(this.toHeosSpeaker(), "stop");
  }

  protected executeSetMute(muted: boolean) {
    this.heos?.setMute(this.toHeosSpeaker(), muted);
  }

  protected executePlayNext() {
    this.heos?.playNext(this.toHeosSpeaker());
  }

  protected executePlayPrevious() {
    this.heos?.playPrevious(this.toHeosSpeaker());
  }

  protected executePlaySound(sound: string) {
    this.heos?.playSong(this.toHeosSpeaker(), sound);
  }

  protected executePlayTextAsSound(text: string) {
    this.heos?.playTextAsSpeech(this.toHeosSpeaker(), text);
  }

  protected executeSetSubwooferPower(_subwooferName: string, power: boolean) {
    this.heos?.setDenonSubwooferPower(this, power);
  }

  protected executeSetSubwooferLevel(subwooferName: string, level: number) {
    this.heos?.setDenonSubwooferLevel(this, subwooferName, level);
  }

  protected executeSetVolumeStart(volumeStart: number) {
    this.heos?.setDenonVolumeStart(this, volumeStart);
  }

  protected executeSetVolumeMax(volumeMax: number) {
    this.heos?.setDenonVolumeMax(this, volumeMax);
  }

  protected executeSetZonePower(zoneName: string, power: boolean) {
    this.heos?.setDenonZonePower(this, zoneName, power);
  }

  protected executeSetSource(sourceIndex: string, selected: boolean) {
    if (selected) {
      this.heos?.setDenonSource(this, sourceIndex, true);
    }
  }

  private toHeosSpeaker() {
    return new HeosSpeaker(this.name ?? "", this.id ?? "", this.address ?? "", this.pid ?? 0, this.heos ?? new HeosController());
  }
}

