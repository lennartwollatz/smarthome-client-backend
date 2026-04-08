import type { DatabaseManager } from "../../../db/database.js";
import { logger } from "../../../../logger.js";
import { LGDeviceDiscover } from "./lgDeviceDiscover.js";
import { LGDeviceDiscovered } from "./lgDeviceDiscovered.js";
import { LGDeviceController } from "./lgDeviceController.js";
import { LGTV } from "./devices/lgtv.js";
import { Device } from "../../../../model/devices/Device.js";
import { Channel, DeviceTV } from "../../../../model/devices/DeviceTV.js";
import { LGEvent } from "./lgEvent.js";
import { LGEventStreamManager } from "./lgEventStreamManager.js";
import { ModuleManager } from "../moduleManager.js";
import { LGCONFIG, LGMODULE } from "./lgModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { EventManager } from "../../../events/EventManager.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";


export class LGModuleManager extends ModuleManager<LGEventStreamManager, LGDeviceController, LGDeviceController, LGEvent, DeviceTV, LGDeviceDiscover, LGDeviceDiscovered> {
  constructor(
    databaseManager: DatabaseManager,
    deviceManager: DeviceManager,
    eventManager: EventManager
  ) {
    super(
      databaseManager,
      deviceManager,
      eventManager,
      new LGDeviceController(),
      new LGDeviceDiscover(databaseManager)
    );
  }

  protected createEventStreamManager(): LGEventStreamManager {
    return new LGEventStreamManager(this.getManagerId(), this.deviceController, this.deviceManager);
  }
  public getModuleId(): string {
    return LGCONFIG.id;
  }
  protected getManagerId(): string {
    return LGCONFIG.managerId;
  }

  async discoverDevices(): Promise<Device[]> {
    logger.info("Suche nach LG Fernsehern (mDNS / AirPlay)");
    try {
      const discoveredDevices = await this.deviceDiscover.startDiscovery(5);
      await this.deviceDiscover.stopDiscovery();
      logger.info({ count: discoveredDevices.length }, "Geraete gefunden");

      const tvs: LGTV[] = [];
      for (const discovered of discoveredDevices) {
        const nip = LGModuleManager.normalizeConnectionIp(discovered.address);
        const nmac = LGModuleManager.normalizeMacAddress(discovered.macAddress);
        const matched = this.findExistingLgTvForDiscovery(nmac, nip);

        if (matched) {
          const fromStore = this.deviceManager.getDevice(matched.id);
          const tv =
            fromStore && fromStore.moduleId === this.getModuleId()
              ? (this.rehydrateDeviceSync(fromStore) ?? matched)
              : matched;
          this.mergeDiscoveryIntoExistingLgTv(tv, discovered);
          tvs.push(tv);
          this.deviceDiscover.upsertStored(tv.id, {
            id: tv.id,
            name: discovered.name,
            address: discovered.address,
            port: discovered.port,
            serviceType: discovered.serviceType,
            manufacturer: discovered.manufacturer,
            integrator: discovered.integrator,
            macAddress: discovered.macAddress
          });
        } else {
          const tv = new LGTV(
            discovered.name,
            discovered.id,
            discovered.address,
            discovered.macAddress ?? null,
            null,
            this.deviceController
          );
          tvs.push(tv);
          this.deviceDiscover.upsertStored(discovered.id, discovered);
        }
      }

      const uniqueById = [...new Map(tvs.map(tv => [tv.id, tv])).values()];
      this.deviceManager.saveDevices(uniqueById);
      return uniqueById;
    } catch (err) {
      logger.error({ err }, "Fehler bei der Geraeteerkennung");
      return [];
    }
  }

  private static normalizeConnectionIp(address: string | undefined | null): string {
    if (address == null || address === "") {
      return "";
    }
    return address.replace(/^\[|\]$/g, "").trim().toLowerCase();
  }

  private static normalizeMacAddress(mac: string | null | undefined): string {
    if (mac == null || mac === "") {
      return "";
    }
    let s = mac.trim().replace(/-/g, ":").toUpperCase();
    if (!s.includes(":") && /^[0-9A-F]{12}$/i.test(s)) {
      s = s.match(/.{1,2}/g)!.join(":");
    }
    return s;
  }

  /**
   * Sucht ein bereits bekanntes LG-TV fuer erneute Discovery.
   * Zuerst exakter Abgleich MAC + IP; bei geaenderter IP dasselbe Geraet ueber die MAC,
   * damit clientKey, Verbindungs- und Laufzeitfelder erhalten bleiben.
   */
  private findExistingLgTvForDiscovery(normalizedMac: string, normalizedIp: string): LGTV | null {
    const moduleDevices = this.deviceManager.getDevicesForModule(this.getModuleId());

    if (normalizedMac && normalizedIp) {
      for (const device of moduleDevices) {
        const tv = device as LGTV;
        if (
          LGModuleManager.normalizeMacAddress(tv.macAddress) === normalizedMac &&
          LGModuleManager.normalizeConnectionIp(tv.address) === normalizedIp
        ) {
          return this.rehydrateDeviceSync(device);
        }
      }
    }

    if (!normalizedMac) {
      return null;
    }

    const macMatches: Device[] = [];
    for (const device of moduleDevices) {
      const tv = device as LGTV;
      if (LGModuleManager.normalizeMacAddress(tv.macAddress) === normalizedMac) {
        macMatches.push(device);
      }
    }
    if (macMatches.length === 0) {
      return null;
    }
    if (macMatches.length > 1) {
      logger.warn(
        { count: macMatches.length, mac: normalizedMac },
        "Mehrere LG-TVs mit gleicher MAC in der DB; waehle nach Verbindung/IP-Prioritaet"
      );
    }
    const ranked = [...macMatches].sort((a, b) => {
      const da = a as LGTV;
      const db = b as LGTV;
      const score = (d: LGTV) =>
        (d.clientKey ? 4 : 0) +
        (d.isConnected ? 2 : 0) +
        (normalizedIp && LGModuleManager.normalizeConnectionIp(d.address) === normalizedIp ? 1 : 0);
      return score(db) - score(da);
    });
    return this.rehydrateDeviceSync(ranked[0]);
  }

  /**
   * Nur Discovery-Felder (Adresse/MAC). Ungeraehrt bleiben u.a. clientKey, isConnected,
   * power, screen, volume, selectedChannel/selectedApp, lastPollUnreachable, Kanaele/Apps inkl. Sortierung,
   * Name und Raum.
   */
  private mergeDiscoveryIntoExistingLgTv(existing: LGTV, discovered: LGDeviceDiscovered): void {
    existing.setLGController(this.deviceController);
    if (discovered.address) {
      existing.address = discovered.address;
    }
    if (discovered.macAddress != null && discovered.macAddress !== "") {
      existing.macAddress = discovered.macAddress;
    }
  }

  async connectDevice(deviceId: string): Promise<LGTV | null> {
    logger.info({ deviceId }, "Verbinde mit LG TV");
    let device = this.deviceDiscover.getStored(deviceId);
    if( !device ) {
      const discoveredDevices = await this.deviceDiscover.discover(5, []);
      device = discoveredDevices.find((d: LGDeviceDiscovered) => d.id === deviceId) ?? null;
      if( device ) {
        this.deviceDiscover.setStored(deviceId, device);
      }
    }
    
    if (!device) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return null;
    }
    const tv = new LGTV(device.name, device.id, device.address, device.macAddress ?? null, null, this.deviceController);
    const connected = await tv.register();
    if (!connected) {
      logger.warn({ deviceId }, "Verbindung zu LG TV nicht erfolgreich");
      return null;
    }
    await tv.updateValues();
    await this.loadTvChannelAndAppListsWithRetry(tv);
    this.deviceManager.saveDevice(tv);
    this.initialiseEventStreamManager();
    return tv;
  }

  /** Mehrfach Versuch mit Pause, bis Sender oder Apps geliefert werden (oder Versuche erschöpft). */
  private async loadTvChannelAndAppListsWithRetry(tv: LGTV): Promise<void> {
    const maxAttempts = 2;
    const pauseMs = 1500;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, pauseMs));
        logger.info({ attempt, id: tv.id }, "LG TV: erneuter Versuch Sender/Apps zu laden");
      }
      await tv.updateChannels();
      await tv.updateApps();
      const ch = tv.channels?.length ?? 0;
      const ap = tv.apps?.length ?? 0;
      if (ch > 0 || ap > 0) {
        logger.info({ id: tv.id, channels: ch, apps: ap }, "LG TV: Sender/Apps geladen");
        return;
      }
    }
    logger.warn({ id: tv.id }, "LG TV: Sender und Apps nach Pairing weiterhin leer");
  }

  async powerOn(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Schalte LG TV ein");
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = await this.toLGTV(device);
    await tv.setPower(true, true);
    this.deviceManager.saveDevice(tv);
    return true;
  }

  async powerOff(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Schalte LG TV aus");
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = await this.toLGTV(device);
    await tv.setPower(false, true);
    this.deviceManager.saveDevice(tv);
    return true;
  }

  async screenOn(deviceId: string) {
    logger.info({ deviceId }, "Schalte Bildschirm ein fuer LG TV");
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = await this.toLGTV(device);
    tv.setScreen(true, true);
    this.deviceManager.saveDevice(tv);
    return true;
  }

  async screenOff(deviceId: string): Promise<boolean> {
    logger.info({ deviceId }, "Schalte Bildschirm aus fuer LG TV");
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden");
      return false;
    }
    const tv = await this.toLGTV(device);
    await tv.setScreen(false, true);
    this.deviceManager.saveDevice(tv);
    return true;
  }

  async setChannel(deviceId: string, channelId: string): Promise<boolean> {
    logger.info({ deviceId, channelId }, "Setze Kanal fuer LG TV");
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
    await tv.setChannel(channelId, true);
    this.deviceManager.saveDevice(tv);
    return true;
  }

  async startApp(deviceId: string, appId: string) {
    logger.info({ deviceId, appId }, "Starte App auf LG TV");
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
    await tv.startApp(appId, true);
    this.deviceManager.saveDevice(tv);
    return true;
  }

  async notify(deviceId: string, message: string): Promise<boolean> {
    logger.info({ deviceId, message }, "Sende Notification an LG TV");
    const device = this.deviceManager.getDevice(deviceId);
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
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
    await tv.setVolume(volume, true);
    this.deviceManager.saveDevice(tv);
    return true;
  }

  async getChannels(deviceId: string): Promise<Channel[]> {
    logger.info({ deviceId }, "Lade Kanaele fuer LG TV");
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return [];
    }
    const tv = await this.toLGTV(device);
    await tv.updateChannels();
    this.deviceManager.saveDevice(tv);
    return tv.channels ?? [];
  }

  async getApps(deviceId: string) {
    logger.info({ deviceId }, "Lade Apps fuer LG TV");
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return [];
    }
    const tv = await this.toLGTV(device);
    await tv.updateApps();
    this.deviceManager.saveDevice(tv);
    return tv.apps ?? [];
  }

  async getSelectedApp(deviceId: string) {
    logger.info({ deviceId }, "Lade aktuelle App fuer LG TV");
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return null;
    }
    const tv = await this.toLGTV(device);
    const selectedApp = await this.deviceController.getSelectedApp(tv);
    if (selectedApp) {
      tv.selectedApp = selectedApp;
      this.deviceManager.saveDevice(tv);
    }
    return selectedApp ?? null;
  }

  async getSelectedChannel(deviceId: string) {
    logger.info({ deviceId }, "Lade aktuellen Kanal fuer LG TV");
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return null;
    }
    const tv = await this.toLGTV(device);
    const selectedChannel = await this.deviceController.getSelectedChannel(tv);
    if (selectedChannel) {
      tv.selectedChannel = selectedChannel;
      this.deviceManager.saveDevice(tv);
    }
    return selectedChannel ?? null;
  }

  async setHomeAppNumber(deviceId: string, appId: string, newNumber: number) {
    logger.info({ deviceId, appId, newNumber }, "Setze HomeAppNumber fuer LG TV");
    if (newNumber < 1) return false;
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
    const apps = tv.apps;
    if (!apps || apps.length === 0) return false;
    const target = apps.find(app => appId && appId === app.getId());
    if (!target) return false;

    const oldNumber = target.getHomeAppNumber();
    if (oldNumber != null && oldNumber === newNumber) {
      return this.deviceManager.saveDevice(tv);
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
    return this.deviceManager.saveDevice(tv);
  }

  async setHomeChannelNumber(deviceId: string, channelId: string, newNumber: number) {
    logger.info({ deviceId, channelId, newNumber }, "Setze HomeChannelNumber fuer LG TV");
    if (newNumber < 1) return false;
    const device = this.deviceManager.getDevice(deviceId);
    if (!device || device.moduleId !== LGMODULE.id) {
      logger.warn({ deviceId }, "LG TV nicht gefunden oder kein LGTV");
      return false;
    }
    const tv = await this.toLGTV(device);
    const channels = tv.channels;
    if (!channels || channels.length === 0) return false;
    const target = channels.find(channel => channelId && channelId === channel.getId());
    if (!target) return false;

    const oldNumber = target.getHomeChannelNumber();
    if (oldNumber != null && oldNumber === newNumber) {
      return this.deviceManager.saveDevice(tv);
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
    return this.deviceManager.saveDevice(tv);
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

  async convertDeviceFromDatabase(device: Device): Promise<Device | null> {
    const sync = this.rehydrateDeviceSync(device);
    if (!sync) {
      return null;
    }
    await sync.updateValues();
    return sync;
  }

  /**
   * Synchrone Rehydrierung (ohne Netzwerk): gleiche Klasseninstanz wie nach DB-Laden,
   * damit Workflow-Aufrufe sofort Prototyp-Methoden wie {@link LGTV.setPowerOn} nutzen können.
   */
  rehydrateDeviceSync(device: Device): LGTV | null {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    if (deviceType !== DeviceType.TV) {
      return null;
    }

    const lgTV = new LGTV();
    Object.assign(lgTV, device);
    if (!((lgTV as any).triggerListeners instanceof Map)) {
      (lgTV as any).triggerListeners = new Map();
    }
    lgTV.setLGController(this.deviceController);
    return lgTV;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(this.getModuleId());
    const updatePromises: Promise<void>[] = [];
    
    devices.forEach(device => {
      if (device instanceof LGTV) {
        device.setLGController(this.deviceController);
        // Rufe updateValues() für jedes Device auf
        updatePromises.push(
          device.updateValues().then(() => {
            this.deviceManager.saveDevice(device);
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

