import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { logger } from "../../../../logger.js";
import { ModuleManager } from "../moduleManager.js";
import { BMWDeviceController } from "./bmwDeviceController.js";
import { BMWDeviceDiscovered } from "./bmwDeviceDiscovered.js";
import { BMWDeviceDiscover } from "./bmwDeviceDiscover.js";
import { BMWEvent } from "./bmwEvent.js";
import { BMWEventStreamManager } from "./bmwEventStreamManager.js";
import { EventStreamManager } from "../../../events/eventStreamManager.js";
import { BMWCONFIG } from "./bmwModule.js";
import { BMWCar } from "./devices/bmwCar.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { Device } from "../../../../model/devices/Device.js";
import { DeviceCarAddress } from "../../../../model/devices/DeviceCar.js";
import { BMWCredentialsStore, type BMWCredentials } from "./bmwCredentialsStore.js";
import { BMWTokenStore } from "./bmwTokenStore.js";

export class BMWModuleManager extends ModuleManager<
  BMWEventStreamManager,
  BMWDeviceController,
  BMWDeviceController,
  BMWEvent,
  BMWCar,
  BMWDeviceDiscover,
  BMWDeviceDiscovered
> {
  private credentialsStore: BMWCredentialsStore;
  private tokenStore: BMWTokenStore;

  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventStreamManager: EventStreamManager
  ) {
    const tokenStore = new BMWTokenStore(databaseManager);
    const deviceController = new BMWDeviceController(tokenStore);
    const credentialsStore = new BMWCredentialsStore(databaseManager);
    const deviceDiscover = new BMWDeviceDiscover(databaseManager, deviceController, () => {
      const credentials = credentialsStore.getCredentials();
      if (!credentials.username || !credentials.password) return null;
      return { username: credentials.username, password: credentials.password, captchaToken: credentials.captchaToken };
    });

    super(databaseManager, actionManager, eventStreamManager, deviceController, deviceDiscover);
    this.credentialsStore = credentialsStore;
    this.tokenStore = tokenStore;
  }

  public getModuleId(): string {
    return BMWCONFIG.id;
  }

  protected getManagerId(): string {
    return BMWCONFIG.managerId;
  }

  protected createEventStreamManager(): BMWEventStreamManager {
    return new BMWEventStreamManager(this.getManagerId(), this.getModuleId(), this.deviceController, this.actionManager);
  }

  getCredentialsInfo() {
    const credentials = this.credentialsStore.getCredentials();
    const hasBmwToken = this.tokenStore.hasToken();
    const bmwTokenExpired = hasBmwToken ? this.tokenStore.isTokenExpired() : false;
    const hasValidBmwToken = this.tokenStore.hasValidToken();
    const hasCaptchaToken = this.credentialsStore.hasCaptchaToken();
    return {
      username: credentials.username ?? "",
      hasPassword: this.credentialsStore.hasPassword(),
      hasCaptchaToken,
      hasBmwToken,
      hasValidBmwToken,
      bmwTokenExpired,
      // Captcha nur nötig, wenn kein gueltiger BMW OAuth Token vorhanden ist.
      canDiscover: this.credentialsStore.canDiscover() && (hasValidBmwToken || hasCaptchaToken)
    };
  }

  private clearCaptchaTokenIfOauthTokenPresent() {
    // Captcha-Token soll nur fuer einen Login-Versuch im Store liegen.
    // Sobald ein BMW OAuth Token persistiert wurde, entfernen wir den Captcha-Token.
    if (this.tokenStore.hasToken() && this.credentialsStore.hasCaptchaToken()) {
      this.credentialsStore.clearCaptchaToken();
    }
  }

  setCredentials(username: string, password?: string, captchaToken?: string) {
    this.credentialsStore.setUsername(username);
    if (typeof password === "string" && password.length > 0) {
      this.credentialsStore.setPassword(password);
      this.tokenStore.clear();
    }
    if (typeof captchaToken === "string" && captchaToken.length > 0) {
      this.credentialsStore.setCaptchaToken(captchaToken);
    }
  }

  setPassword(password: string) {
    this.credentialsStore.setPassword(password);
    this.tokenStore.clear();
  }

  setCaptchaToken(captchaToken: string) {
    this.credentialsStore.setCaptchaToken(captchaToken);
    // Wenn ein (abgelaufener) Token existiert, wollen wir bewusst einen frischen Login erzwingen.
    // Damit wird nach Captcha-Token-Setzen ein neuer BMW OAuth Token erzeugt.
    this.tokenStore.clear();
  }

  private getCredentialsForUse(): BMWCredentials | null {
    const credentials = this.credentialsStore.getCredentials();
    if (!credentials.username || !credentials.password) return null;
    // captchaToken optional; TokenStore übernimmt Reuse/Refresh
    return { username: credentials.username, password: credentials.password, captchaToken: credentials.captchaToken };
  }

  async discoverDevices(): Promise<Device[]> {
    logger.info("Suche nach BMW Fahrzeugen im ConnectedDrive Account");
    const info = this.getCredentialsInfo();
    if (!info.canDiscover) {
      logger.warn({ info }, "BMW Discovery nicht moeglich: Credentials/Captcha fehlen");
      return [];
    }
    try {
      const discoveredVehicles = await this.deviceDiscover.discover(0);
      // Wenn der Login erfolgreich war, liegt jetzt ein OAuth Token im TokenStore -> CaptchaToken entfernen.
      this.clearCaptchaTokenIfOauthTokenPresent();
      const cars = await this.convertDiscoveredVehiclesToCars(discoveredVehicles);
      this.actionManager.saveDevices(cars);
      this.initialiseEventStreamManager();
      return cars;
    } catch (err) {
      logger.error({ err }, "Fehler bei der BMW Discovery");
      return [];
    }
  }

  async startClimateControl(deviceId: string): Promise<boolean> {
    const car = await this.getCar(deviceId);
    if (!car) return false;
    car.startClimateControl(true);
    this.actionManager.saveDevice(car);
    return true;
  }

  async stopClimateControl(deviceId: string): Promise<boolean> {
    const car = await this.getCar(deviceId);
    if (!car) return false;
    car.stopClimateControl(true);
    this.actionManager.saveDevice(car);
    return true;
  }

  async sendAddress(deviceId: string, subject: string, address: DeviceCarAddress): Promise<boolean> {
    const car = await this.getCar(deviceId);
    if (!car) return false;
    car.sendAddress(subject, address, true);
    this.actionManager.saveDevice(car);
    return true;
  }

  async refreshDevice(deviceId: string): Promise<boolean> {
    const car = await this.getCar(deviceId);
    if (!car) return false;
    await car.updateValues();
    this.clearCaptchaTokenIfOauthTokenPresent();
    this.actionManager.saveDevice(car);
    return true;
  }

  private async convertDiscoveredVehiclesToCars(devices: BMWDeviceDiscovered[]): Promise<BMWCar[]> {
    const cars: BMWCar[] = [];
    for (const device of devices) {
      try {
        const car = new BMWCar(
          device.name ?? BMWCONFIG.defaultDeviceName,
          device.id,
          device.vin,
          this.deviceController,
          () => this.getCredentialsForUse()
        );
        await car.updateValues();
        cars.push(car);
      } catch (err) {
        logger.error({ err, deviceId: device.id }, "Fehler beim Initialisieren des BMW Fahrzeugs");
      }
    }
    return cars;
  }

  private async getCar(deviceId: string): Promise<BMWCar | null> {
    const device = this.actionManager.getDevice(deviceId);
    if (!device) return null;
    if (device instanceof BMWCar) {
      device.setBMWController(this.deviceController);
      device.setCredentialsProvider(() => this.getCredentialsForUse());
      return device;
    }
    return await this.toBMWCar(device);
  }

  private async toBMWCar(device: Device): Promise<BMWCar | null> {
    const car = new BMWCar();
    Object.assign(car, device);
    car.moduleId = this.getModuleId();
    if (!((car as any).triggerListeners instanceof Map)) {
      (car as any).triggerListeners = new Map();
    }
    car.setBMWController(this.deviceController);
    car.setCredentialsProvider(() => this.getCredentialsForUse());
    if (!car.vin) {
      return null;
    }
    await car.updateValues();
    return car;
  }

  convertDeviceFromDatabase(device: Device): Device | null {
    if (device.moduleId !== this.getModuleId()) {
      return null;
    }
    const deviceType = device.type as DeviceType;
    if (deviceType === DeviceType.CAR) {
      const car = new BMWCar();
      Object.assign(car, device);
      car.setBMWController(this.deviceController);
      car.setCredentialsProvider(() => this.getCredentialsForUse());
      return car;
    }
    return null;
  }

  async initializeDeviceControllers(): Promise<void> {
    const devices = this.actionManager.getDevicesForModule(this.getModuleId());
    for (const device of devices) {
      if (device instanceof BMWCar) {
        device.setBMWController(this.deviceController);
        device.setCredentialsProvider(() => this.getCredentialsForUse());
        await device.updateValues();
        this.actionManager.saveDevice(device);
      }
    }
  }
}

