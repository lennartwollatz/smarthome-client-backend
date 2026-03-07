import { WACLightingDeviceController } from "../waclightingDeviceController.js";
import { logger } from "../../../../../logger.js";
import { DeviceFanLightDimmer } from "../../../../../model/devices/DeviceFanLightDimmer.js";

export class WACFanLight extends DeviceFanLightDimmer {
  private address?: string;
  private port?: number;
  private wacController?: WACLightingDeviceController;

  constructor(
    name?: string,
    id?: string,
    address?: string,
    port?: number,
    controller?: WACLightingDeviceController
  ) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.address = address;
    this.port = port;
    this.wacController = controller;
    this.moduleId = "waclighting";
    this.isConnected = true;
  }

  setWACController(controller: WACLightingDeviceController) {
    this.wacController = controller;
  }

  getAddress(): string | undefined {
    return this.address;
  }

  async updateValues(): Promise<void> {
    if (!this.address || !this.port || !this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Adresse oder Controller für WAC Fan Light");
      return;
    }

    try {
      const status = await this.wacController.getStatus(this.address, this.port);
      if (!status) return;

      // Fan Status
      if (status.fanOn !== undefined) {
        if (status.fanOn) {
          this.setOn(false, false);
        } else {
          this.setOff(false, false);
        }
      }
      if (status.fanSpeed !== undefined) {
        this.setSpeed(status.fanSpeed, false, false);
      }

      // Light Status
      if (status.lightOn !== undefined) {
        if (status.lightOn) {
          this.setLightOn(false, false);
        } else {
          this.setLightOff(false, false);
        }
      }
      if (status.lightBrightness !== undefined) {
        this.setLightBrightness(status.lightBrightness, false, false);
      }

      logger.debug({ deviceId: this.id }, "WAC Fan Light Werte aktualisiert");
    } catch (err) {
      this.isConnected = false;
      logger.error({ err, deviceId: this.id }, "Fehler beim Aktualisieren der WAC Fan Light Werte");
    }
  }

  protected async executeSetOn(): Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für setOn");
      return;
    }
    await this.wacController.setFanOn(this).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Einschalten des Fans");
    });
  }

  protected async executeSetOff(): Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für setOff");
      return;
    }
    await this.wacController.setFanOff(this).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Ausschalten des Fans");
    });
  }

  protected async executeSetSpeed(speed: number): Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für setSpeed");
      return;
    }
    await this.wacController.setFanSpeed(this, speed).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Setzen der Fan-Geschwindigkeit");
    });
  }

  protected async executeSetLightOn(): Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für executeSetLightOn");
      return;
    }
    await this.wacController.setLightOn(this).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Einschalten des Lichts");
    });
  }

  protected async executeSetLightOff(): Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für executeSetLightOff");
      return;
    }
    await this.wacController.setLightOff(this).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Ausschalten des Lichts");
    });
  }

  protected async executeSetLightBrightness(brightness: number): Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für executeSetLightBrightness");
      return;
    }
    await this.wacController.setLightBrightness(this, brightness).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Setzen der Licht-Helligkeit");
    });
  }
}

