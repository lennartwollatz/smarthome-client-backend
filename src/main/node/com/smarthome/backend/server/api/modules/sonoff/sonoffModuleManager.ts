import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { Device } from "../../../../model/devices/Device.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import {
  SonoffDeviceDiscover,
  COOLKIT_V2_API_HOST,
  type EwelinkCloudCredentials,
  type EwelinkTokenPersistHint,
} from "./sonoffDeviceDiscover.js";
import { SonoffDeviceDiscovered } from "./sonoffDeviceDiscovered.js";
import { SonoffDeviceController } from "./sonoffDeviceController.js";
import { SonoffEventStreamManager } from "./sonoffEventStreamManager.js";
import { SonoffEvent } from "./sonoffEvent.js";
import { ModuleManager } from "../moduleManager.js";
import { SONOFFCONFIG } from "./sonoffModule.js";
import { SonoffSwitchEnergy } from "./devices/sonoffSwitchEnergy.js";
import { SonoffSwitch } from "./devices/sonoffSwitch.js";
import { SonoffSwitchDimmer } from "./devices/sonoffSwitchDimmer.js";
import { EventManager } from "../../../events/EventManager.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { ModuleModel } from "../modules.js";
import { matterVendors } from "../matter/matterVendors.js";

/** Aus dem HTTP-Body ermittelte eWeLink-Zugangsdaten; fehlende Felder ergänzt das Modul aus `moduleData`. */
export type SonoffEwelinkDiscoverInput = {
  /** E-Mail oder Benutzername (aus `email` bzw. `username` im Request). */
  user?: string;
  password?: string;
  countryCode?: string;
};

export type SonoffDiscoverResult = {
  devices: SonoffDeviceDiscovered[];
  /** eWeLink/CoolKit Bearer `at` (Login oder gueltiger Cache). */
  authorizationKey: string | null;
};

export class SonoffModuleManager extends ModuleManager<
  SonoffEventStreamManager,
  SonoffDeviceController,
  SonoffDeviceController,
  SonoffEvent,
  Device,
  SonoffDeviceDiscover,
  SonoffDeviceDiscovered
> {
  constructor(databaseManager: DatabaseManager, deviceManager: DeviceManager, eventManager: EventManager) {
    super(
      databaseManager,
      deviceManager,
      eventManager,
      new SonoffDeviceController(),
      new SonoffDeviceDiscover(databaseManager)
    );
  }

  protected createEventStreamManager(): SonoffEventStreamManager {
    return new SonoffEventStreamManager(this.getManagerId(), this.deviceController, this.deviceManager);
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(this.getModuleId());
    for (const device of devices) {
      if (device instanceof SonoffSwitchEnergy) {
        device.setSonoffController(this.deviceController);
      }
      if (device instanceof SonoffSwitch) {
        device.setSonoffController(this.deviceController);
      }
      if (device instanceof SonoffSwitchDimmer) {
        device.setSonoffController(this.deviceController);
      }
    }
  }

  public getModuleId(): string {
    return SONOFFCONFIG.id;
  }

  protected getManagerId(): string {
    return SONOFFCONFIG.managerId;
  }

  /**
   * Discover mit vom Aufrufer gelieferten eWeLink-Feldern (z. B. aus HTTP-Body extrahiert).
   * Fehlende Werte werden aus dem gespeicherten Modul-Eintrag `sonoff` (`moduleData`) ergänzt.
   */
  async discoverDevicesWithEwelinkInput(input: SonoffEwelinkDiscoverInput): Promise<SonoffDiscoverResult> {
    const fromUser = input.user?.trim() ?? "";
    const password = input.password ?? "";
    let countryCode =
      typeof input.countryCode === "string" && input.countryCode.trim().length > 0
        ? input.countryCode.trim()
        : undefined;

    const moduleRepo = new JsonRepository<ModuleModel>(this.databaseManager, "Module");
    const sonoffMod = moduleRepo.findById("sonoff");
    const md = sonoffMod?.moduleData as Record<string, unknown> | undefined;
    const storedEmail = typeof md?.ewelinkEmail === "string" ? md.ewelinkEmail.trim() : "";
    const storedPassword = typeof md?.ewelinkPassword === "string" ? md.ewelinkPassword : "";
    let storedCc =
      typeof md?.ewelinkCountryCode === "string" && md.ewelinkCountryCode.trim().length > 0
        ? md.ewelinkCountryCode.trim()
        : "+49";
    if (!storedCc.startsWith("+")) storedCc = `+${storedCc}`;

    const email = fromUser || storedEmail;
    const effectivePassword = password.length > 0 ? password : storedPassword;
    if (countryCode == null) {
      countryCode = storedCc;
    } else if (!countryCode.startsWith("+")) {
      countryCode = `+${countryCode}`;
    }

    const override =
      email && effectivePassword
        ? {
            email,
            password: effectivePassword,
            countryCode: countryCode ?? "+49",
          }
        : undefined;
    return this.discoverDevices(override);
  }

  /**
   * @param overrideCloud Wenn gesetzt (E-Mail + Passwort), werden diese statt der in den Modul-Einstellungen gespeicherten eWeLink-Daten verwendet (z. B. vom Frontend bei der Gerätesuche).
   */
  async discoverDevices(
    overrideCloud?: {
      email: string;
      password: string;
      countryCode?: string;
    } | null
  ): Promise<SonoffDiscoverResult> {
    try {
      const moduleRepo = new JsonRepository<ModuleModel>(this.databaseManager, "Module");
      const sonoffMod = moduleRepo.findById("sonoff");
      const md = sonoffMod?.moduleData as Record<string, unknown> | undefined;

      let cloudCreds: EwelinkCloudCredentials | null = null;

      if (overrideCloud?.email?.trim() && overrideCloud.password) {
        cloudCreds = this.attachEwelinkTokenCacheFromModule(
          {
            email: overrideCloud.email.trim(),
            password: overrideCloud.password,
            countryCode:
              typeof overrideCloud.countryCode === "string" && overrideCloud.countryCode.trim().length > 0
                ? overrideCloud.countryCode.trim().startsWith("+")
                  ? overrideCloud.countryCode.trim()
                  : `+${overrideCloud.countryCode.trim()}`
                : "+49",
          },
          md
        );
      } else {
        const email = typeof md?.ewelinkEmail === "string" ? md.ewelinkEmail.trim() : "";
        const password = typeof md?.ewelinkPassword === "string" ? md.ewelinkPassword : "";
        let countryCode =
          typeof md?.ewelinkCountryCode === "string" && md.ewelinkCountryCode.trim().length > 0
            ? md.ewelinkCountryCode.trim()
            : "+49";
        if (!countryCode.startsWith("+")) countryCode = `+${countryCode}`;
        if (email && password) {
          cloudCreds = this.attachEwelinkTokenCacheFromModule({ email, password, countryCode }, md);
        }
      }

      this.deviceDiscover.setEwelinkCloudCredentials(cloudCreds);

      const existingDevices = this.deviceManager.getDevicesForModule(this.getModuleId());
      const devices = await this.deviceDiscover.discover(5, existingDevices.map(d => d.id));

      const persistHint = this.deviceDiscover.takeLastEwelinkPersistHint();
      if (persistHint) {
        this.persistEwelinkCloudToken(persistHint);
      }

      const authorizationKey = this.deviceDiscover.takeLastEwelinkAccessTokenForResponse();
      return { devices, authorizationKey };
    } catch (err) {
      logger.error({ err }, "Fehler bei der Sonoff-Geraeteerkennung");
      return { devices: [], authorizationKey: null };
    }
  }

  private attachEwelinkTokenCacheFromModule(
    creds: { email: string; password: string; countryCode: string },
    md: Record<string, unknown> | undefined
  ): EwelinkCloudCredentials {
    const base: EwelinkCloudCredentials = {
      email: creds.email,
      password: creds.password,
      countryCode: creds.countryCode,
    };
    if (!md) return base;
    const tok = typeof md.ewelinkAuthToken === "string" ? md.ewelinkAuthToken.trim() : "";
    const reg = typeof md.ewelinkApiRegion === "string" ? md.ewelinkApiRegion : "";
    const exp = typeof md.ewelinkTokenExpiresAt === "number" ? md.ewelinkTokenExpiresAt : undefined;
    const fp = typeof md.ewelinkTokenPasswordFingerprint === "string" ? md.ewelinkTokenPasswordFingerprint : "";
    if (tok && reg && reg in COOLKIT_V2_API_HOST && fp) {
      return {
        ...base,
        cachedAccessToken: tok,
        cachedApiRegion: reg as keyof typeof COOLKIT_V2_API_HOST,
        cachedTokenExpiresAtMs: exp,
        cachedTokenPasswordFingerprint: fp,
      };
    }
    return base;
  }

  private persistEwelinkCloudToken(hint: EwelinkTokenPersistHint): void {
    try {
      const repo = new JsonRepository<ModuleModel>(this.databaseManager, "Module");
      const mod = repo.findById("sonoff");
      if (!mod) return;
      const md = { ...((mod.moduleData as Record<string, unknown> | undefined) ?? {}) };
      md.ewelinkAuthToken = hint.accessToken;
      md.ewelinkApiRegion = hint.region;
      if (hint.expiresAtMs != null) {
        md.ewelinkTokenExpiresAt = hint.expiresAtMs;
      } else {
        delete md.ewelinkTokenExpiresAt;
      }
      md.ewelinkTokenPasswordFingerprint = hint.passwordFingerprint;
      repo.save("sonoff", { ...mod, moduleData: md });
    } catch (e) {
      logger.error({ e }, "Sonoff: eWeLink-Autorisierungsschluessel konnte nicht gespeichert werden");
    }
  }

  async pairDevice(deviceId: string): Promise<{ success: boolean; device?: Device; error?: string }> {
    logger.info({ deviceId }, "Starte Sonoff LAN-Pairing");

    let discovered = this.deviceDiscover.getStored(deviceId);

    if (!discovered) {
      return { success: false, error: "Gerät nicht gefunden; zuerst Discovery ausführen." };
    }

    if (!discovered.isPaired) {
      const effectiveKey = discovered.apiKey?.trim() ?? "";
      if (!effectiveKey) {
        return {
          success: false,
          error: "API-Schlüssel fehlt — bitte „Geräte suchen“ mit gültigem eWeLink-Konto (Cloud-Discovery).",
        };
      }

      discovered = await this.deviceController.pairDevice(discovered);
      if (!discovered) {
        return { success: false, error: "Pairing fehlgeschlagen (API-Key / eWeLink-ID / Netzwerk prüfen)" };
      }

      this.deviceDiscover.setStored(discovered.id, discovered);
    }


    const sonoffDevice = await this.toSonoffDevice(discovered);
    this.deviceManager.saveDevice(sonoffDevice);
    this.restartEventStream();

    return { success: true, device: sonoffDevice };
  }

  private async toSonoffDevice(discovered: SonoffDeviceDiscovered): Promise<Device> {
    const id = discovered.id;
    const ewelinkId = discovered.ewelinkDeviceId;
    const name = discovered.name ?? SONOFFCONFIG.defaultDeviceName;
    const resolvedType = matterVendors.getVendorAndProductName(discovered.vendorId ?? "", String(discovered.productId ?? ""));

    if (resolvedType?.deviceType === "device.switch-dimmer") {
      const buttons = this.getButtonsForDevice(discovered);
      const dimmer = new SonoffSwitchDimmer(name, id, ewelinkId, buttons);
      dimmer.lanAddress = discovered.address;
      dimmer.lanPort = discovered.port;
      dimmer.lanApiKey = discovered.apiKey!;
      dimmer.ewelinkDeviceId = discovered.ewelinkDeviceId!;
      return dimmer;
    }
    if (resolvedType?.deviceType === "device.switch") {
      const buttons = await this.getButtonsForDevice(discovered);
      const sw = new SonoffSwitch(name, id, ewelinkId, buttons);
      sw.lanAddress = discovered.address;
      sw.lanPort = discovered.port;
      sw.lanApiKey = discovered.apiKey!;
      sw.ewelinkDeviceId = discovered.ewelinkDeviceId!;
      return sw;
    }
    if (resolvedType?.deviceType === "device.switch-energy") {
      const buttons = await this.getButtonsForDevice(discovered);
      const energy = new SonoffSwitchEnergy(name, id, ewelinkId, buttons);
      energy.lanAddress = discovered.address;
      energy.lanPort = discovered.port;
      energy.lanApiKey = discovered.apiKey!;
      energy.ewelinkDeviceId = discovered.ewelinkDeviceId!;
      return energy;
    }
    const buttons = await this.getButtonsForDevice(discovered);
    const fallback = new SonoffSwitch(name, id, ewelinkId, buttons);
    fallback.lanAddress = discovered.address;
    fallback.lanPort = discovered.port;
    fallback.lanApiKey = discovered.apiKey!;
    fallback.ewelinkDeviceId = discovered.ewelinkDeviceId!;
    return fallback;
  }

  private getButtonsForDevice(device: SonoffDeviceDiscovered): string[] {
    if (device.outletIds && device.outletIds.length > 0) {
      return device.outletIds.map(n => String(n));
    }
    return ["0"];
  }

  async convertDeviceFromDatabase(device: Device): Promise<Device | null> {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }

    const deviceType = device.type as DeviceType;
    let convertedDevice: Device | null = null;

    switch (deviceType) {
      case DeviceType.SWITCH_ENERGY: {
        const sw = new SonoffSwitchEnergy();
        Object.assign(sw, device);
        sw.rehydrateButtons();
        sw.setSonoffController(this.deviceController);
        await sw.updateValues();
        convertedDevice = sw;
        break;
      }
      case DeviceType.SWITCH: {
        const sw = new SonoffSwitch();
        Object.assign(sw, device);
        sw.rehydrateButtons();
        sw.setSonoffController(this.deviceController);
        await sw.updateValues();
        convertedDevice = sw;
        break;
      }
      case DeviceType.SWITCH_DIMMER: {
        const sw = new SonoffSwitchDimmer();
        Object.assign(sw, device);
        sw.rehydrateButtons();
        sw.setSonoffController(this.deviceController);
        await sw.updateValues();
        convertedDevice = sw;
        break;
      }
      case DeviceType.THERMOSTAT: {
        const sw = new SonoffSwitch();
        Object.assign(sw, device);
        sw.type = DeviceType.SWITCH;
        sw.rehydrateButtons();
        sw.setSonoffController(this.deviceController);
        await sw.updateValues();
        this.deviceManager.saveDevice(sw);
        convertedDevice = sw;
        break;
      }
    }

    return convertedDevice;
  }

  async toggle(deviceId: string, buttonId: string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await (device as SonoffSwitchEnergy | SonoffSwitch | SonoffSwitchDimmer).toggle(buttonId, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setOn(deviceId: string, buttonId: string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await (device as SonoffSwitchEnergy | SonoffSwitch | SonoffSwitchDimmer).on(buttonId, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setOff(deviceId: string, buttonId: string): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await (device as SonoffSwitchEnergy | SonoffSwitch | SonoffSwitchDimmer).off(buttonId, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }

  async setIntensity(deviceId: string, buttonId: string, intensity: number): Promise<boolean> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) return false;
    await (device as SonoffSwitchDimmer).setBrightness(buttonId, intensity, true, true);
    this.deviceManager.saveDevice(device);
    return true;
  }
}
