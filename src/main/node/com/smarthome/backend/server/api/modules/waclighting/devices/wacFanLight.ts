import { DeviceFanLight } from "../../../../../model/devices/DeviceFanLight.js";
import { WACLightingDeviceController } from "../waclightingDeviceController.js";
import { logger } from "../../../../../logger.js";

export class WACFanLight extends DeviceFanLight {
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
          this.setOn(true);
        } else {
          this.setOff(true);
        }
      }
      if (status.fanSpeed !== undefined) {
        this.setSpeed(status.fanSpeed, false);
      }

      // Light Status
      if (status.lightOn !== undefined) {
        if (status.lightOn) {
          this.setLightOn(false);
        } else {
          this.setLightOff(false);
        }
      }
      if (status.lightBrightness !== undefined) {
        this.setLightBrightness(status.lightBrightness, false);
      }

      logger.debug({ deviceId: this.id }, "WAC Fan Light Werte aktualisiert");
    } catch (err) {
      logger.error({ err, deviceId: this.id }, "Fehler beim Aktualisieren der WAC Fan Light Werte");
    }
  }

  protected executeSetOn(): void | Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für setOn");
      return;
    }
    this.wacController.setFanOn(this).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Einschalten des Fans");
    });
  }

  protected executeSetOff(): void | Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für setOff");
      return;
    }
    this.wacController.setFanOff(this).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Ausschalten des Fans");
    });
  }

  protected executeSetSpeed(speed: number): void {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für setSpeed");
      return;
    }
    this.wacController.setFanSpeed(this, speed).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Setzen der Fan-Geschwindigkeit");
    });
  }

  protected executeSetLightOn(): void | Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für executeSetLightOn");
      return;
    }
    this.wacController.setLightOn(this).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Einschalten des Lichts");
    });
  }

  protected executeSetLightOff(): void | Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für executeSetLightOff");
      return;
    }
    this.wacController.setLightOff(this).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Ausschalten des Lichts");
    });
  }

  protected executeSetLightBrightness(brightness: number): void | Promise<void> {
    if (!this.wacController) {
      logger.warn({ deviceId: this.id }, "Keine Controller für executeSetLightBrightness");
      return;
    }
    this.wacController.setLightBrightness(this, brightness).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Setzen der Licht-Helligkeit");
    });
  }
}

