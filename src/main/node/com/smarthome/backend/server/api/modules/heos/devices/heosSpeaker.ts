import { DeviceSpeakerReceiver } from "com/smarthome/backend/model/devices/DeviceSpeakerReceiver.js";
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

    try {
      const players = await this.heos.getPlayers(this);
      const groups = await this.heos.getGroups(this);
      if( groups.some(group => group.includes(String(this.pid) ?? ""))){
        const pids = groups.find(group => group.includes(String(this.pid) ?? "")) ?? [];
        //TODO:speakerIds zu den pids ermitteln.
      } else {
        this.groupedWith = [];
      }
      this.volume = await this.heos.getVolume(this);
      this.muted = await this.heos.getMute(this);
      this.playState = await this.heos.getPlayState(this);
    } catch (err) {
      this.isConnected = false;
      logger.error({ err, id: this.id }, "Fehler beim Aktualisieren der Werte - Geraet nicht erreichbar");
    }
  }

  setHeosController(heosController?: HeosDeviceController) {
    if (heosController) {
      this.heos = heosController;
      this.isConnected = true;
    }
  }

  protected async executeSetVolume(volume: number): Promise<void> {
    await this.heos?.setVolume(this, volume);
  }

  protected async executePlay(): Promise<void> {
    await this.heos?.setPlayState(this, "play");
  }

  protected async executePause(): Promise<void> {
    await this.heos?.setPlayState(this, "pause");
  }

  protected async executeStop(): Promise<void> {
    await this.heos?.setPlayState(this, "stop");
  }

  protected async executeSetMute(muted: boolean): Promise<void> {
    await this.heos?.setMute(this, muted);
  }

  protected async executePlayNext(): Promise<void>   {
    await this.heos?.playNext(this);
  }

  protected async executePlayPrevious(): Promise<void> {
    await this.heos?.playPrevious(this);
  }

  protected async executePlaySound(sound: string): Promise<void>   {
    await this.heos?.playSong(this, sound);
  }

  protected async executePlayTextAsSound(text: string): Promise<void> {
    await this.heos?.playTextAsSpeech(this, text);
  }

  protected async executeGroupWith(devices: (DeviceSpeaker | DeviceSpeakerReceiver)[]): Promise<void> {
    await this.heos?.groupSpeakers(this, devices);
  }
}

