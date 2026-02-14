import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { logger } from "../../../../logger.js";
import { LGDeviceDiscover } from "./lgDeviceDiscover.js";
import { LGDeviceDiscovered } from "./lgDeviceDiscovered.js";
import { LGDeviceController } from "./lgDeviceController.js";
import { LGTV } from "./devices/lgtv.js";
import { Channel, Device, DeviceTV } from "../../../../model/index.js";
import { LGEvent } from "./lgEvent.js";
import { LGEventStreamManager } from "./lgEventStreamManager.js";
import { ModuleManager } from "../moduleManager.js";
import { LGCONFIG, LGMODULE } from "./lgModule.js";
import { EventStreamManager } from "../../../events/eventStreamManager.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

export class LGModuleManager extends ModuleManager<LGEventStreamManager, LGDeviceController, LGDeviceController, LGEvent, DeviceTV, LGDeviceDiscover, LGDeviceDiscovered> {
  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventStreamManager: EventStreamManager
  ) {
    super(
      databaseManager,
      actionManager,
      eventStreamManager,
      new LGDeviceController(),
      new LGDeviceDiscover(databaseManager)
    );
  }

  protected createEventStreamManager(): LGEventStreamManager {
    return new LGEventStreamManager(this.getManagerId(), this.deviceController, this.actionManager);
  }
  public getModuleId(): string {
    return LGCONFIG.id;
  }
  protected getManagerId(): string {
    return LGCONFIG.managerId;
  }

  async discoverDevices(): Promise<Device[]> {
    logger.info("Suche nach LG Fernsehern über SSDP (LGDiscover)");
    try {
      const discoveredDevices = await this.deviceDiscover.discover(5);
      logger.info({ count: discoveredDevices.length }, "Geraete gefunden");
      
      const tvs = discoveredDevices.map(device =>
        new LGTV(device.name, device.id, device.address, device.macAddress ?? null, null, this.deviceController)
      );

      this.actionManager.saveDevices(tvs);
      return tvs;
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung");
      return [];
    }
  }

  async connectDevice(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Verbinde mit LG TV");
    const discoveredDevices = await this.deviceDiscover.discover(5);
    const device = discoveredDevices.find((d: LGDeviceDiscovered) => d.id === deviceId);
    if (!device) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = new LGTV(device.name, device.id, device.address, device.macAddress ?? null, null, this.deviceController);
    const connected = await tv.register();
    if (!connected) {
      logger.warn({ deviceId }, "Verbindung zu LG TV nicht erfolgreich");
      return false;
    }
    await tv.updateValues();
    await tv.updateChannels();
    await tv.updateApps();
    this.actionManager.saveDevice(tv);
    this.initialiseEventStreamManager();
    return true;
  }

  async powerOn(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Schalte LG TV ein");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = await this.toLGTV(device);
    tv.setPower(true, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  async powerOff(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Schalte LG TV aus");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = await this.toLGTV(device);
    tv.setPower(false, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  async screenOn(deviceId: string) {
    logger.info({ deviceId }, "Schalte Bildschirm ein fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = await this.toLGTV(device);
    tv.setScreen(true, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  async screenOff(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Schalte Bildschirm aus fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = await this.toLGTV(device);
    tv.setScreen(false, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  async setChannel(deviceId: string, channelId: string): Promise<boolean> {
    logger.info({ deviceId, channelId }, "Setze Kanal fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
    tv.setChannel(channelId, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  async startApp(deviceId: string, appId: string) {
    logger.info({ deviceId, appId }, "Starte App auf LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
    tv.startApp(appId, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  async notify(deviceId: string, message: string): Promise<boolean> {
    logger.info({ deviceId, message }, "Sende Notification an LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
    tv.notify(message, true);
    return true;
  }

  async setVolume(deviceId: string, volume: number): Promise<boolean> {
    logger.info({ deviceId, volume }, "Setze Lautstaerke fuer LG TV");
    if (volume < 1 || volume > 100) return false;
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
    tv.setVolume(volume, true);
    this.actionManager.saveDevice(tv);
    return true;
  }

  async getChannels(deviceId: string): Promise<Channel[]> {
    logger.info({ deviceId }, "Lade Kanaele fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return [];
    }
    const tv = await this.toLGTV(device);
    await tv.updateChannels();
    this.actionManager.saveDevice(tv);
    return tv.getChannels() ?? [];
  }

  async getApps(deviceId: string) {
    logger.info({ deviceId }, "Lade Apps fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return null;
    }
    const tv = await this.toLGTV(device);
    await tv.updateApps();
    this.actionManager.saveDevice(tv);
    return tv.getApps() ?? null;
  }

  async getSelectedApp(deviceId: string) {
    logger.info({ deviceId }, "Lade aktuelle App fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return null;
    }
    const tv = await this.toLGTV(device);
    const selectedApp = await this.deviceController.getSelectedApp(tv);
    if (selectedApp) {
      tv.selectedApp = selectedApp;
      this.actionManager.saveDevice(tv);
    }
    return selectedApp ?? null;
  }

  async getSelectedChannel(deviceId: string) {
    logger.info({ deviceId }, "Lade aktuellen Kanal fuer LG TV");
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return null;
    }
    const tv = await this.toLGTV(device);
    const selectedChannel = await this.deviceController.getSelectedChannel(tv);
    if (selectedChannel) {
      tv.selectedChannel = selectedChannel;
      this.actionManager.saveDevice(tv);
    }
    return selectedChannel ?? null;
  }

  async setHomeAppNumber(deviceId: string, appId: string, newNumber: number) {
    logger.info({ deviceId, appId, newNumber }, "Setze HomeAppNumber fuer LG TV");
    if (newNumber < 1) return false;
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
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

  async setHomeChannelNumber(deviceId: string, channelId: string, newNumber: number) {
    logger.info({ deviceId, channelId, newNumber }, "Setze HomeChannelNumber fuer LG TV");
    if (newNumber < 1) return false;
    const device = this.actionManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
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

  private async toLGTV(device: Device): Promise<LGTV> {
    if (device instanceof LGTV) {
      if (typeof (device as any).setLGController === "function") {
        (device as any).setLGController(this.deviceController);
      }
      return device;
    }
    const tv = new LGTV();
    Object.assign(tv, device);
    tv.moduleId = LGMODULE.id;
    if (!((tv as any).triggerListeners instanceof Map)) {
      (tv as any).triggerListeners = new Map();
    }
    if (typeof (tv as any).setLGController === "function") {
      (tv as any).setLGController(this.deviceController);
    }
    if (!(tv instanceof DeviceTV)) {
      logger.warn({ deviceId: device.id }, "Geraet ist kein TV");
      return tv;
    }
    await tv.updateValues();
    return tv;
  }

  convertDeviceFromDatabase(device: Device): Device | null {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.TV:
        const lgTV = new LGTV();
        Object.assign(lgTV, device);
        convertedDevice = lgTV;
        break;
    }

    return convertedDevice;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(this.getModuleId());
    const updatePromises: Promise<void>[] = [];
    
    devices.forEach(device => {
      if (device instanceof LGTV) {
        device.setLGController(this.deviceController);
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

