import net from "node:net";
import type { DatabaseManager } from "../../../../db/database.js";
import type { ActionManager } from "../../../../actions/ActionManager.js";
import { JsonRepository } from "../../../../db/jsonRepository.js";
import { logger } from "../../../../../logger.js";
import { HeosDeviceController } from "../heosDeviceController.js";
import { HeosDeviceDiscovered } from "../heosDeviceDiscovered.js";
import { DenonHeosSpeakerDeviceDiscover } from "./denonHeosSpeakerDeviceDiscover.js";
import { DeviceSpeaker } from "../../../../../model/devices/DeviceSpeaker.js";
import { DenonSpeaker } from "./devices/denonSpeaker.js";
import { Device } from "../../../../../model/index.js";
import { HeosModuleManager } from "../heosModuleManager.js";
import { EventManager } from "../../../../events/EventManager.js";
import { HeosEventStreamManager } from "../heosEventStreamManager.js";
import { DENONCONFIG } from "./denonModule.js";
import { DeviceType } from "../../../../../model/devices/helper/DeviceType.js";
import { DenonReceiver } from "./devices/denonReceiver.js";

export class DenonModuleManager extends HeosModuleManager {
   
  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventManager: EventManager
  ) {
    const controller = new HeosDeviceController();
    const discoveredDeviceRepository = new JsonRepository<HeosDeviceDiscovered>(databaseManager, "HeosDeviceDiscovered");
    const discover = new DenonHeosSpeakerDeviceDiscover(databaseManager, discoveredDeviceRepository, controller);
    super(databaseManager, actionManager, eventManager, discover);
  }

  public getModuleId(): string {
    return DENONCONFIG.id;
  }
  protected getManagerId(): string {
    return DENONCONFIG.managerId;
  }

  protected createEventStreamManager(): HeosEventStreamManager {
    return new HeosEventStreamManager(this.getManagerId(), this.getModuleId(), this.deviceController, this.actionManager);
  }

  async discoverDevices(): Promise<Device[]> {
    logger.info("Suche nach Denon HEOS-Geraeten");
    try {
      const searchDurationMs = 30;
      const discovered = await this.deviceDiscover.discover(searchDurationMs, []);
      const byUniqueIp = this.mergeDevicesByUniqueIp(discovered);
      if (byUniqueIp.length !== discovered.length) {
        logger.info(
          { total: discovered.length, uniqueByIp: byUniqueIp.length },
          "Geraete mit gleicher IP zusammengefuehrt"
        );
      }
      logger.info({ count: byUniqueIp.length }, "Geraete gefunden");
      const speakers = await this.convertDiscoveredDevicesToDenonSpeakers(byUniqueIp);
      this.actionManager.saveDevices(speakers);
      this.initialiseEventStreamManager();
      return speakers;
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung");
      return [];
    }
  }

  /**
   * Filtert auf Geräte mit gültiger IP und fasst Geräte mit derselben IP zu einem zusammen.
   * Es wird nur ein Gerät pro eindeutiger IP-Adresse zurückgegeben.
   */
  private mergeDevicesByUniqueIp(devices: HeosDeviceDiscovered[]): HeosDeviceDiscovered[] {
    const withValidIp = devices.filter(d => {
      const address = d.getBestConnectionAddress() ?? d.address ?? "";
      return net.isIP(address) !== 0;
    });
    const byIp = new Map<string, HeosDeviceDiscovered>();
    for (const device of withValidIp) {
      const ip = device.getBestConnectionAddress() ?? device.address ?? "";
      const existing = byIp.get(ip);
      if (!existing) {
        byIp.set(ip, device);
        continue;
      }
      // Behalte das Gerät mit gesetzter pid/name (von getPlayerInfo)
      const hasPlayerInfo = (d: HeosDeviceDiscovered) =>
        (d.pid != null && d.pid > 0) || (d.name?.length ?? 0) > 0;
      byIp.set(ip, hasPlayerInfo(existing) ? existing : device);
    }
    return Array.from(byIp.values());
  }

  async setVolume(deviceId: string, volume: number): Promise<boolean> {
    logger.info({ deviceId, volume }, "Setze Lautstaerke fuer Geraet");
    const speaker = await this.getSpeaker(deviceId);
    if (!speaker) return false;
    try {
      speaker.setVolume(volume, true);
      this.actionManager.saveDevice(speaker);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Setzen der Lautstaerke");
      return false;
    }
  }

  async setPlayState(deviceId: string, state: string): Promise<boolean> {
    logger.info({ deviceId, state }, "Setze Wiedergabestatus fuer Geraet");
    const speaker = await this.getSpeaker(deviceId);
    if (!speaker) return false;
    try {
      const playState = DeviceSpeaker.playStateFromString(state);
      if (!playState) return false;
      switch (playState) {
        case DeviceSpeaker.PlayState.PLAY:
          speaker.play(true);
          break;
        case DeviceSpeaker.PlayState.STOP:
          speaker.stopp(true);
          break;
        case DeviceSpeaker.PlayState.PAUSE:
          speaker.pause(true);
          break;
      }
      this.actionManager.saveDevice(speaker);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Setzen des Wiedergabestatus");
      return false;
    }
  }

  async setMute(deviceId: string, mute: boolean): Promise<boolean> {
    logger.info({ deviceId, mute }, "Setze Stummschaltung fuer Geraet");
    const speaker = await this.getSpeaker(deviceId);
    if (!speaker) return false;
    try {
      speaker.setMute(mute, true);
      this.actionManager.saveDevice(speaker);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Setzen der Stummschaltung");
      return false;
    }
  }

  async playNext(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Spiele naechsten Titel");
    const speaker = await this.getSpeaker(deviceId);
    if (!speaker) return false;
    try {
      speaker.playNext();
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Abspielen des naechsten Titels");
      return false;
    }
  }

  async playPrevious(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Spiele vorherigen Titel");
    const speaker = await this.getSpeaker(deviceId);
    if (!speaker) return false;
    try {
      speaker.playPrevious();
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Abspielen des vorherigen Titels");
      return false;
    }
  }

  private async getReceiver(deviceId: string): Promise<DenonReceiver | null> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) {
      logger.warn({ deviceId }, "Geraet nicht gefunden");
      return null;
    }
    if (device instanceof DenonReceiver) {
      return device;
    }
    if (device.type === DeviceType.SPEAKER_RECEIVER) {
      return this.toReceiver(device, deviceId);
    }
    logger.warn({ deviceId }, "Geraet ist kein Receiver");
    return null;
  }

  private async toReceiver(device: Device, deviceId: string): Promise<DenonReceiver | null> {
    const receiver = new DenonReceiver();
    Object.assign(receiver, device);
    receiver.moduleId = this.getModuleId();
    if (typeof (receiver as any).setHeosController === "function") {
      (receiver as any).setHeosController(this.deviceController);
    }
    await receiver.updateValues();
    return receiver;
  }

  async setVolumeStart(deviceId: string, volumeStart: number): Promise<boolean> {
    logger.info({ deviceId, volumeStart }, "Setze Volume-Start fuer Receiver");
    const receiver = await this.getReceiver(deviceId);
    if (!receiver) return false;
    try {
      await (receiver as any).setVolumeStart(volumeStart, true, true);
      this.actionManager.saveDevice(receiver);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Setzen von Volume-Start");
      return false;
    }
  }

  async setVolumeMax(deviceId: string, volumeMax: number): Promise<boolean> {
    logger.info({ deviceId, volumeMax }, "Setze Volume-Max fuer Receiver");
    const receiver = await this.getReceiver(deviceId);
    if (!receiver) return false;
    try {
      await (receiver as any).setVolumeMax(volumeMax, true, true);
      this.actionManager.saveDevice(receiver);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Setzen von Volume-Max");
      return false;
    }
  }

  async setSource(deviceId: string, sourceIndex: string, selected: boolean): Promise<boolean> {
    logger.info({ deviceId, sourceIndex, selected }, "Setze aktive Quelle fuer Receiver");
    const receiver = await this.getReceiver(deviceId);
    if (!receiver) return false;
    try {
      await (receiver as any).setSource(sourceIndex, selected, true, true);
      this.actionManager.saveDevice(receiver);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Setzen der aktiven Quelle");
      return false;
    }
  }

  async setZonePower(deviceId: string, zoneName: string, power: boolean): Promise<boolean> {
    logger.info({ deviceId, zoneName, power }, "Setze Zonen-Power fuer Receiver");
    const receiver = await this.getReceiver(deviceId);
    if (!receiver) return false;
    try {
      await (receiver as any).setZonePower(zoneName, power, true, true);
      this.actionManager.saveDevice(receiver);
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Setzen der Zonen-Power");
      return false;
    }
  }

  private async getSpeaker(deviceId: string): Promise<DeviceSpeaker | null> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) {
      logger.warn({ deviceId }, "Geraet nicht gefunden");
      return null;
    }
    if (device instanceof DeviceSpeaker) {
      return device;
    }
    return this.toSpeaker(device, deviceId);
  }

  private async toSpeaker(device: Device, deviceId: string): Promise<DeviceSpeaker | null> {
    const speaker = new DenonSpeaker();
    Object.assign(speaker, device);
    speaker.moduleId = this.getModuleId();
    if (!((speaker as any).triggerListeners instanceof Map)) {
      (speaker as any).triggerListeners = new Map();
    }
    if (typeof (speaker as any).setHeosController === "function") {
      (speaker as any).setHeosController(this.deviceController);
    }
    if (!(speaker instanceof DeviceSpeaker)) {
      logger.warn({ deviceId }, "Geraet ist kein Speaker");
      return null;
    }
    await speaker.updateValues();
    return speaker;
  }

  private async convertDiscoveredDeviceToDenonSpeaker(device: HeosDeviceDiscovered): Promise<DenonSpeaker | DenonReceiver> {
    const deviceId = device.id;
    const speakerName = device.name ?? DENONCONFIG.defaultDeviceName;
    let address = device.address;
    let pid = device.pid ?? 1;
    if (!address) {
      logger.warn(
        { deviceId },
        "Keine gueltige Adresse fuer Gerät gefunden, verwende Fallback"
      );
    }
    let speaker;
    if( ! await this.deviceController.isDenonReceiver(address) ) {
      speaker = new DenonSpeaker(speakerName, deviceId, address, pid, this.deviceController);
    } else {
      speaker = new DenonReceiver(speakerName, deviceId, address, pid, this.deviceController);
    }
    await speaker.updateValues();
    return speaker;
  }

  private async convertDiscoveredDevicesToDenonSpeakers(devices: HeosDeviceDiscovered[]): Promise<(DenonSpeaker | DenonReceiver)[]> {
    const speakers: (DenonSpeaker | DenonReceiver)[] = [];
    for (const device of devices) {
      try {
        const speaker = await this.convertDiscoveredDeviceToDenonSpeaker(device);
        speakers.push(speaker);
      } catch (err) {
        logger.error(
          { err, deviceId: device.id },
          "Fehler beim Initialisieren von Geraet"
        );
      }
    };
    return speakers;
  }

  async convertDeviceFromDatabase(device: Device): Promise<Device | null> {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.SPEAKER:
        const denonSpeaker = new DenonSpeaker();
        Object.assign(denonSpeaker, device);
        await denonSpeaker.updateValues();
        convertedDevice = denonSpeaker;
        break;
      case DeviceType.SPEAKER_RECEIVER:
        const denonReceiver = new DenonReceiver();
        Object.assign(denonReceiver, device);
        await denonReceiver.updateValues();
        convertedDevice = denonReceiver;
        break;
    }

    return convertedDevice;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(this.getModuleId());
    const updatePromises: Promise<void>[] = [];
    
    devices.forEach(device => {
        if (device instanceof DenonSpeaker || device instanceof DenonReceiver) {
          (device as any).setHeosController(this.deviceController);
          // Rufe updateValues() für jedes Device auf
          updatePromises.push(
            device.updateValues().then(() => {
              this.actionManager.saveDevice(device);
            }).catch(err => {
              logger.error({ err, deviceId: device.id }, "Fehler beim updateValues nach Controller-Initialisierung");
            })
          );
        }
    });
    
    // Warte auf alle updateValues()-Aufrufe
    await Promise.all(updatePromises);
  }
}

