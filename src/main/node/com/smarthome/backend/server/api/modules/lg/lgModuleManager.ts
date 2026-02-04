import type { DatabaseManager } from "../../../db/database.js";
import type { EventStreamManager } from "../../../events/eventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { logger } from "../../../../logger.js";
import { LGDiscover } from "./lgDiscover.js";
import { LGDiscoveredDevice } from "./lgDiscoveredDevice.js";
import { LGController } from "./lgController.js";
import { LGTV } from "./lgtv.js";
import { Device, DeviceTV } from "../../../../model/index.js";

export class LGModuleManager {
  private lgDiscoveredDeviceRepository: JsonRepository<LGDiscoveredDevice>;
  private lgDiscover: LGDiscover;
  private actionManager: ActionManager;

  constructor(
    databaseManager: DatabaseManager,
    _eventStreamManager: EventStreamManager,
    actionManager: ActionManager
  ) {
    this.lgDiscoveredDeviceRepository = new JsonRepository<LGDiscoveredDevice>(databaseManager, "LGDiscoveredDevice");
    this.lgDiscover = new LGDiscover(databaseManager);
    this.actionManager = actionManager;
  }

  async discoverDevices() {
    logger.info("Suche nach LG Fernsehern über SSDP (LGDiscover)");
    const discovered = await this.lgDiscover.discover(5);
    return discovered.map(device =>
      new LGTV(device.name, device.id, device.address, device.macAddress ?? null, null)
    );
  }

  async connectDevice(deviceId: string) {
    logger.info({ deviceId }, "Verbinde mit LG TV");
    const device = this.lgDiscoveredDeviceRepository.findById(deviceId);
    if (!device) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = new LGTV(device.name, device.id, device.address, device.macAddress ?? null, null);
    const connected = await tv.register();
    if (!connected) {
      logger.warn({ deviceId }, "Verbindung zu LG TV nicht erfolgreich");
      return false;
    }
    await tv.updateValues();
    await tv.updateChannels();
    await tv.updateApps();
    this.actionManager.saveDevice(tv);
    return true;
  }

  powerOn(deviceId: string) {
    logger.info({ deviceId }, "Schalte LG TV ein");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = this.toLGTV(device);
    tv.setPower(true, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  powerOff(deviceId: string) {
    logger.info({ deviceId }, "Schalte LG TV aus");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = this.toLGTV(device);
    tv.setPower(false, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  screenOn(deviceId: string) {
    logger.info({ deviceId }, "Schalte Bildschirm ein fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = this.toLGTV(device);
    tv.setScreen(true, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  screenOff(deviceId: string) {
    logger.info({ deviceId }, "Schalte Bildschirm aus fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = this.toLGTV(device);
    tv.setScreen(false, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  setChannel(deviceId: string, channelId: string) {
    logger.info({ deviceId, channelId }, "Setze Kanal fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = this.toLGTV(device);
    tv.setChannel(channelId, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  startApp(deviceId: string, appId: string) {
    logger.info({ deviceId, appId }, "Starte App auf LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = this.toLGTV(device);
    tv.startApp(appId, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  notify(deviceId: string, message: string) {
    logger.info({ deviceId, message }, "Sende Notification an LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = this.toLGTV(device);
    tv.notify(message, true);
    return true;
  }

  setVolume(deviceId: string, volume: number) {
    logger.info({ deviceId, volume }, "Setze Lautstaerke fuer LG TV");
    if (volume < 1 || volume > 100) return false;
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = this.toLGTV(device);
    tv.setVolume(volume, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  async getChannels(deviceId: string) {
    logger.info({ deviceId }, "Lade Kanaele fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return null;
    }
    const tv = this.toLGTV(device);
    await tv.updateChannels();
    this.actionManager.saveDevice(tv);
    return tv.getChannels() ?? null;
  }

  async getApps(deviceId: string) {
    logger.info({ deviceId }, "Lade Apps fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return null;
    }
    const tv = this.toLGTV(device);
    await tv.updateApps();
    this.actionManager.saveDevice(tv);
    return tv.getApps() ?? null;
  }

  async getSelectedApp(deviceId: string) {
    logger.info({ deviceId }, "Lade aktuelle App fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return null;
    }
    const tv = this.toLGTV(device);
    const selectedApp = await LGController.getSelectedApp(tv);
    if (selectedApp) {
      tv.selectedApp = selectedApp;
      this.actionManager.saveDevice(tv);
    }
    return selectedApp ?? null;
  }

  async getSelectedChannel(deviceId: string) {
    logger.info({ deviceId }, "Lade aktuellen Kanal fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return null;
    }
    const tv = this.toLGTV(device);
    const selectedChannel = await LGController.getSelectedChannel(tv);
    if (selectedChannel) {
      tv.selectedChannel = selectedChannel;
      this.actionManager.saveDevice(tv);
    }
    return selectedChannel ?? null;
  }

  setHomeAppNumber(deviceId: string, appId: string, newNumber: number) {
    logger.info({ deviceId, appId, newNumber }, "Setze HomeAppNumber fuer LG TV");
    if (newNumber < 1) return false;
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = this.toLGTV(device);
    const apps = tv.getApps();
    if (!apps || apps.length === 0) return false;
    const target = apps.find(app => appId && appId === app.getId());
    if (!target) return false;

    const oldNumber = target.getHomeAppNumber();
    if (oldNumber != null && oldNumber === newNumber) {
      return this.actionManager.saveDevice(tv);
    }

    apps.forEach(app => {
      if (app === target) return;
      const number = app.getHomeAppNumber();
      if (number == null) return;
      if (oldNumber == null) {
        if (number >= newNumber) app.setHomeAppNumber(number + 1);
      } else if (newNumber < oldNumber) {
        if (number >= newNumber && number < oldNumber) app.setHomeAppNumber(number + 1);
      } else if (newNumber > oldNumber) {
        if (number <= newNumber && number > oldNumber) app.setHomeAppNumber(number - 1);
      }
    });
    target.setHomeAppNumber(newNumber);
    return this.actionManager.saveDevice(tv);
  }

  setHomeChannelNumber(deviceId: string, channelId: string, newNumber: number) {
    logger.info({ deviceId, channelId, newNumber }, "Setze HomeChannelNumber fuer LG TV");
    if (newNumber < 1) return false;
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== "lg") {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = this.toLGTV(device);
    const channels = tv.getChannels();
    if (!channels || channels.length === 0) return false;
    const target = channels.find(channel => channelId && channelId === channel.getId());
    if (!target) return false;

    const oldNumber = target.getHomeChannelNumber();
    if (oldNumber != null && oldNumber === newNumber) {
      return this.actionManager.saveDevice(tv);
    }

    channels.forEach(channel => {
      if (channel === target) return;
      const number = channel.getHomeChannelNumber();
      if (number == null) return;
      if (oldNumber == null) {
        if (number >= newNumber) channel.setHomeChannelNumber(number + 1);
      } else if (newNumber < oldNumber) {
        if (number >= newNumber && number < oldNumber) channel.setHomeChannelNumber(number + 1);
      } else if (newNumber > oldNumber) {
        if (number <= newNumber && number > oldNumber) channel.setHomeChannelNumber(number - 1);
      }
    });
    target.setHomeChannelNumber(newNumber);
    return this.actionManager.saveDevice(tv);
  }

  private toLGTV(device: Device) {
    if (device instanceof LGTV) return device;
    const tv = new LGTV();
    Object.assign(tv, device);
    tv.moduleId = "lg";
    return tv;
  }
}

