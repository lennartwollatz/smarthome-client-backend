import type { DatabaseManager } from "../../../../db/database.js";
import type { EventStreamManager } from "../../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../../actions/actionManager.js";
import { JsonRepository } from "../../../../db/jsonRepository.js";
import { logger } from "../../../../../logger.js";
import { ModuleManager } from "../../moduleManager.js";
import { HeosController } from "../heosController.js";
import { HeosDiscoveredDevice } from "../heosDiscoveredDevice.js";
import { DenonHeosSpeakerDiscover } from "./denonHeosSpeakerDiscover.js";
import { DeviceSpeaker } from "../../../../../model/devices/DeviceSpeaker.js";
import { DenonSpeaker } from "./denonSpeaker.js";
import { Device } from "../../../../../model/index.js";

export class DenonModuleManager extends ModuleManager {
  private discoveredDeviceRepository: JsonRepository<HeosDiscoveredDevice>;
  private discover: DenonHeosSpeakerDiscover;
  private heosController: HeosController;

  constructor(
    databaseManager: DatabaseManager,
    eventStreamManager: EventStreamManager,
    actionManager: ActionManager
  ) {
    super(databaseManager, eventStreamManager, actionManager);
    this.discoveredDeviceRepository = new JsonRepository<HeosDiscoveredDevice>(
      databaseManager,
      "HeosDiscoveredDevice"
    );
    this.heosController = new HeosController();
    this.discover = new DenonHeosSpeakerDiscover(this.discoveredDeviceRepository, this.heosController);
  }

  async discoverDevices() {
    logger.info("Suche nach Denon HEOS-Geraeten");
    try {
      const searchDurationMs = 30000;
      const denonSpeakers = await this.discover.discoverDenonSpeakers(searchDurationMs);
      logger.info({ count: denonSpeakers.length }, "Geraete gefunden");

      const success = this.actionManager.saveDevices(
        denonSpeakers
      );
      if (!success) {
        logger.error("Fehler beim Speichern der Geraete");
      }
      return denonSpeakers;
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung");
      return [];
    }
  }

  setVolume(deviceId: string, volume: number): boolean {
    logger.info({ deviceId, volume }, "Setze Lautstaerke fuer Geraet");
    const speaker = this.getSpeaker(deviceId);
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

  setPlayState(deviceId: string, state: string): boolean {
    logger.info({ deviceId, state }, "Setze Wiedergabestatus fuer Geraet");
    const speaker = this.getSpeaker(deviceId);
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

  setMute(deviceId: string, mute: boolean): boolean {
    logger.info({ deviceId, mute }, "Setze Stummschaltung fuer Geraet");
    const speaker = this.getSpeaker(deviceId);
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

  playNext(deviceId: string): boolean {
    logger.info({ deviceId }, "Spiele naechsten Titel");
    const speaker = this.getSpeaker(deviceId);
    if (!speaker) return false;
    try {
      speaker.playNext();
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Abspielen des naechsten Titels");
      return false;
    }
  }

  playPrevious(deviceId: string): boolean {
    logger.info({ deviceId }, "Spiele vorherigen Titel");
    const speaker = this.getSpeaker(deviceId);
    if (!speaker) return false;
    try {
      speaker.playPrevious();
      return true;
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Abspielen des vorherigen Titels");
      return false;
    }
  }

  private getSpeaker(deviceId: string) {
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

  private toSpeaker(device: Device, deviceId: string) {
    const speaker = new DenonSpeaker();
    Object.assign(speaker, device);
    speaker.moduleId = "denon";
    if (!((speaker as any).triggerListeners instanceof Map)) {
      (speaker as any).triggerListeners = new Map();
    }
    if (typeof (speaker as any).setHeosController === "function") {
      (speaker as any).setHeosController(this.heosController);
    }
    if (!(speaker instanceof DeviceSpeaker)) {
      logger.warn({ deviceId }, "Geraet ist kein Speaker");
      return null;
    }
    return speaker;
  }
}

