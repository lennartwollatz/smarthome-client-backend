import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { logger } from "../../../../logger.js";
import { ModuleManager } from "../moduleManager.js";
import { SonosDeviceController } from "./sonosDeviceController.js";
import { SonosDeviceDiscovered } from "./sonosDeviceDiscovered.js";
import { SonosDeviceDiscover } from "./sonosDeviceDiscover.js";
import { DeviceSpeaker } from "../../../../model/devices/DeviceSpeaker.js";
import { SonosSpeaker } from "./devices/sonosSpeaker.js";
import { SonosEvent } from "./sonosEvent.js";
import { Device } from "../../../../model/index.js";
import { SonosEventStreamManager } from "./sonosEventStreamManager.js";
import { EventStreamManager } from "../../../events/eventStreamManager.js";
import { SONOSCONFIG } from "./sonosModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

export class SonosModuleManager extends ModuleManager<SonosEventStreamManager, SonosDeviceController, SonosDeviceController, SonosEvent, DeviceSpeaker, SonosDeviceDiscover, SonosDeviceDiscovered> {

  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventStreamManager: EventStreamManager
  ) {
    const controller = new SonosDeviceController();
    super(
      databaseManager, 
      actionManager, 
      eventStreamManager, 
      controller, 
      new SonosDeviceDiscover(databaseManager));
  }

  async discoverDevices(): Promise<Device[]> {
    logger.info("Suche nach Sonos-Geraeten");
    try {
      const discoveredDevices = await this.deviceDiscover.discover(5, []);
      logger.info({ count: discoveredDevices.length }, "Geraete gefunden");
      
      // TODO: eventuell sollte die Konvertierung zu einem SonosSpeaker und Speicherung
      // erst dann geschehen, wenn das Device übernommen wird.
      const speakers = await this.convertDiscoveredDevicesToSonosSpeakers(discoveredDevices);
      this.actionManager.saveDevices(speakers);
      return speakers;
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung");
      return [];
    }
  }

  public getModuleId(): string {
    return SONOSCONFIG.id;
  }
  protected getManagerId(): string {
    return SONOSCONFIG.managerId;
  }

  protected createEventStreamManager(): SonosEventStreamManager {
    return new SonosEventStreamManager(this.getManagerId(), this.deviceController, this.actionManager);
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

  async setPlayState(deviceId: string, state: string): Promise<{ success: boolean; error?: string }> {
    logger.info({ deviceId, state }, "Setze Wiedergabestatus fuer Geraet");
    const speaker = await this.getSpeaker(deviceId);
    if (!speaker) {
      return { success: false, error: "Gerät nicht gefunden" };
    }
    
    const playState = DeviceSpeaker.playStateFromString(state);
    if (!playState) {
      return { success: false, error: "Ungültiger Wiedergabestatus" };
    }
    
    // Speichere den alten Status für den Fall eines Fehlers
    const oldPlayState = speaker.playState;
    
    try {
      // Setze den neuen Status im Device (ohne execute, damit wir erst prüfen können)
      switch (playState) {
        case DeviceSpeaker.PlayState.PLAY:
          speaker.play(false);
          break;
        case DeviceSpeaker.PlayState.STOP:
          speaker.stopp(false);
          break;
        case DeviceSpeaker.PlayState.PAUSE:
          speaker.pause(false);
          break;
      }
      
      // Versuche den Status auf dem Gerät zu setzen
      const sonosSpeaker = speaker instanceof SonosSpeaker ? speaker : null;
      if (!sonosSpeaker) {
        return { success: false, error: "Gerät ist kein Sonos-Speaker" };
      }
      const success = await this.deviceController.setPlayState(sonosSpeaker, state);
      
      if (!success) {
        // Fehler beim Setzen auf dem Gerät - stelle den alten Status wieder her
        if (oldPlayState === DeviceSpeaker.PlayState.PLAY) {
          speaker.play(false);
        } else if (oldPlayState === DeviceSpeaker.PlayState.PAUSE) {
          speaker.pause(false);
        } else {
          speaker.stopp(false);
        }
        this.actionManager.saveDevice(speaker);
        return { success: false, error: "Fehler beim Setzen des Wiedergabestatus auf dem Gerät" };
      }
      
      // Erfolgreich - speichere das Device mit dem neuen Status
      this.actionManager.saveDevice(speaker);
      return { success: true };
    } catch (err) {
      // Unerwarteter Fehler - stelle den alten Status wieder her
      logger.error({ err, deviceId }, "Unerwarteter Fehler beim Setzen des Wiedergabestatus");
      if (oldPlayState === DeviceSpeaker.PlayState.PLAY) {
        speaker.play(false);
      } else if (oldPlayState === DeviceSpeaker.PlayState.PAUSE) {
        speaker.pause(false);
      } else {
        speaker.stopp(false);
      }
      this.actionManager.saveDevice(speaker);
      return { success: false, error: err instanceof Error ? err.message : "Unerwarteter Fehler" };
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

  private async getSpeaker(deviceId: string): Promise<DeviceSpeaker | null> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) {
      logger.warn({ deviceId }, "Geraet nicht gefunden");
      return null;
    }
    if (device instanceof DeviceSpeaker) {
      return device;
    }
    return await this.toSpeaker(device, deviceId);
  }

  private async toSpeaker(device: Device, deviceId: string): Promise<DeviceSpeaker | null> {
    const speaker = new SonosSpeaker();
    Object.assign(speaker, device);
    speaker.moduleId = this.getModuleId();
    if (!((speaker as any).triggerListeners instanceof Map)) {
      (speaker as any).triggerListeners = new Map();
    }
    if (typeof (speaker as any).setSonosController === "function") {
      (speaker as any).setSonosController(this.deviceController);
    }
    if (!(speaker instanceof DeviceSpeaker)) {
      logger.warn({ deviceId }, "Geraet ist kein Speaker");
      return null;
    }
    await speaker.updateValues();
    return speaker;
  }


  private async convertDiscoveredDeviceToSonosSpeaker(device: SonosDeviceDiscovered): Promise<SonosSpeaker> {
    const deviceId = device.id;
    const speakerName = device.name ?? SONOSCONFIG.defaultDeviceName;
    let address = device.address;
    if (!address) {
      logger.warn(
        { deviceId },
        "Keine gueltige Adresse fuer Gerät gefunden, verwende Fallback"
      );
      address = device.address ?? "unknown";
    }
    let speaker = new SonosSpeaker(speakerName, deviceId, address, this.deviceController);
    await speaker.updateValues();
    return speaker;
  }

  private async convertDiscoveredDevicesToSonosSpeakers(devices: SonosDeviceDiscovered[]): Promise<SonosSpeaker[]> {
    const speakers: SonosSpeaker[] = [];
    for (const device of devices) {
      try {
        const speaker = await this.convertDiscoveredDeviceToSonosSpeaker(device);
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

  convertDeviceFromDatabase(device: Device): Device | null {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.SPEAKER:
        const sonosSpeaker = new SonosSpeaker();
        Object.assign(sonosSpeaker, device);
        convertedDevice = sonosSpeaker;
        break;
    }

    return convertedDevice;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(this.getModuleId());
    const updatePromises: Promise<void>[] = [];
    
    devices.forEach(device => {
      if (device instanceof SonosSpeaker) {
        device.setSonosController(this.deviceController);
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

