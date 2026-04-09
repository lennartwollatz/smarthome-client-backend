import { logger } from "../../../../../../logger.js";
import { DeviceSpeakerReceiver } from "../../../../../../model/devices/DeviceSpeakerReceiver.js";
import { HeosDeviceController } from "../../heosDeviceController.js";
import { HeosSpeaker } from "../../devices/heosSpeaker.js";
import { DeviceSpeaker } from "com/smarthome/backend/model/devices/DeviceSpeaker.js";
import type { DeviceManager } from "../../../../entities/devices/deviceManager.js";
import { resolveHeosGroupPeerDeviceIds } from "../../heosPlayerGroupPeers.js";
import { getHeosDeviceGroupingContext, setHeosDeviceGroupingContext } from "../../heosDeviceGroupingContext.js";

export class DenonReceiver extends DeviceSpeakerReceiver {
  address?: string;
  pid?: number;
  private heos?: HeosDeviceController;
  private groupingDeviceManager?: DeviceManager;

  constructor(name?: string, id?: string, address?: string, pid?: number, heos?: HeosDeviceController) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.isConnected = true;
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

  setHeosController(heosController: HeosDeviceController, groupingContext?: DeviceManager) {
    this.heos = heosController;
    if (groupingContext !== undefined) {
      setHeosDeviceGroupingContext(this, groupingContext);
    }
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

    try {
      if (typeof this.heos.getGroups === "function") {
        const groups = await this.heos.getGroups(proxy);
        if (groups.some((group) => group.includes(String(this.pid) ?? ""))) {
          const pids = groups.find((group) => group.includes(String(this.pid) ?? "")) ?? [];
          this.groupedWith = resolveHeosGroupPeerDeviceIds(
            getHeosDeviceGroupingContext(this),
            this.moduleId ?? "",
            this.id ?? "",
            this.address,
            this.pid ?? 0,
            pids
          );
        } else {
          this.groupedWith = [];
        }
      } else {
        this.groupedWith = [];
      }

      this.volume = await this.heos.getVolume(proxy);
      this.muted = await this.heos.getMute(proxy);
      this.playState = await this.heos.getPlayState(proxy);
      this.zones = await this.heos.getDenonZones(this);
      this.sources = await this.heos.getDenonSourcesList(this);
      this.subwoofers = await this.heos.getDenonSubwoofers(this);
      const {limit, powerOn} = await this.heos.getDenonVolumeConfig(this);
      this.volumeStart = powerOn;
      this.volumeMax = limit;
      this.isConnected = true;
    } catch (err) {
      this.isConnected = false;
      logger.error({ err, id: this.id }, "Fehler beim Aktualisieren der Werte - Geraet nicht erreichbar");
    }
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

  protected async executeStop(): Promise<void> {
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

  protected async executeSetSubwooferPower(_subwooferId: string, power: boolean): Promise<void> {
    await this.heos?.setDenonSubwooferPower(this, power);
  }

  protected async executeSetSubwooferLevel(subwooferId: string, level: number): Promise<void> {
    await this.heos?.setDenonSubwooferLevel(this, subwooferId, level);
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

  protected async executeGroupWith(devices: (DeviceSpeaker | DeviceSpeakerReceiver)[]): Promise<void> {
    await this.heos?.groupSpeakers(this.toHeosSpeaker(), devices);
  }

  private toHeosSpeaker() {
    return new HeosSpeaker(this.name ?? "", this.id ?? "", this.address ?? "", this.pid ?? 0, this.heos ?? new HeosDeviceController());
  }
}

