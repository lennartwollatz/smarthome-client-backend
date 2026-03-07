import { logger } from "../../../../../../logger.js";
import { DeviceSpeakerReceiver } from "../../../../../../model/devices/DeviceSpeakerReceiver.js";
import { HeosDeviceController } from "../../heosDeviceController.js";
import { HeosSpeaker } from "../../devices/heosSpeaker.js";

export class DenonReceiver extends DeviceSpeakerReceiver {
  address?: string;
  pid?: number;
  private heos?: HeosDeviceController;

  constructor(name?: string, id?: string, address?: string, pid?: number, heos?: HeosDeviceController) {
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

  setHeosController(heosController: HeosDeviceController) {
    this.heos = heosController;
  }

  async updateValues(): Promise<void> {
    if (!this.heos) {
      logger.debug(
        { id: this.id },
        "updateValues() uebersprungen - heos ist noch null"
      );
      return;
    }

    const proxy = this.toHeosSpeaker();
    logger.debug({ id: this.id, heosSet: Boolean(this.heos) }, "Initialisiere Werte");

    await this.heos
      .getVolume(proxy)
      .then(currentVolume => {
        this.volume = currentVolume;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Lautstaerke");
      });

    await this.heos
      .getMute(proxy)
      .then(isMuted => {
        this.muted = isMuted;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des Muted Attributs");
      });

    await this.heos
      .getPlayState(proxy)
      .then(currentPlayState => {
        this.playState = currentPlayState;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren des PlayState");
      });

    await this.heos
      .getDenonZones(this)
      .then(zones => {
        this.zones = zones;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Zonen");
      });

    await this.heos
      .getDenonSourcesList(this)
      .then(sources => {
        this.sources = sources;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Quellen");
      });

    await this.heos
      .getDenonSubwoofers(this)
      .then(subwoofers => {
        this.subwoofers = subwoofers;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Subwoofer");
      });

    await this.heos
      .getDenonVolumeConfig(this)
      .then(([volumeStart, volumeMax]) => {
        this.volumeStart = volumeStart;
        this.volumeMax = volumeMax;
      })
      .catch(err => {
        this.isConnected = false;
        logger.error({ err, id: this.id }, "Fehler beim Initialisieren der Lautstaerke-Konfiguration");
      });
  }

  protected async executeSetVolume(volume: number): Promise<void> {
    await this.heos?.setVolume(this.toHeosSpeaker(), volume);
  }

  protected async executePlay(): Promise<void> {
    await this.heos?.setPlayState(this.toHeosSpeaker(), "play");
  }

  protected async executePause(): Promise<void> {
    await this.heos?.setPlayState(this.toHeosSpeaker(), "pause");
  }

  protected async executeStopp(): Promise<void> {
    await this.heos?.setPlayState(this.toHeosSpeaker(), "stop");
  }

  protected async executeSetMute(muted: boolean): Promise<void> {
    await this.heos?.setMute(this.toHeosSpeaker(), muted);
  }

  protected async executePlayNext(): Promise<void> {
    await this.heos?.playNext(this.toHeosSpeaker());
  }

  protected async executePlayPrevious(): Promise<void> {
    await this.heos?.playPrevious(this.toHeosSpeaker());
  }

  protected async executePlaySound(sound: string): Promise<void> {
    await this.heos?.playSong(this.toHeosSpeaker(), sound);
  }

  protected async executePlayTextAsSound(text: string): Promise<void> {
    await this.heos?.playTextAsSpeech(this.toHeosSpeaker(), text);
  }

  protected async executeSetSubwooferPower(_subwooferName: string, power: boolean): Promise<void> {
    await this.heos?.setDenonSubwooferPower(this, power);
  }

  protected async executeSetSubwooferLevel(subwooferName: string, level: number): Promise<void> {
    await this.heos?.setDenonSubwooferLevel(this, subwooferName, level);
  }

  protected async executeSetVolumeStart(volumeStart: number): Promise<void> {
    await this.heos?.setDenonVolumeStart(this, volumeStart);
  }

  protected async executeSetVolumeMax(volumeMax: number): Promise<void> {
    await this.heos?.setDenonVolumeMax(this, volumeMax);
  }

  protected async executeSetZonePower(zoneName: string, power: boolean): Promise<void> {
    await this.heos?.setDenonZonePower(this, zoneName, power);
  }

  protected async executeSetSource(sourceIndex: string, selected: boolean): Promise<void> {
    if (selected) {
      await this.heos?.setDenonSource(this, sourceIndex, true);
    }
  }

  private toHeosSpeaker() {
    return new HeosSpeaker(this.name ?? "", this.id ?? "", this.address ?? "", this.pid ?? 0, this.heos ?? new HeosDeviceController());
  }
}

