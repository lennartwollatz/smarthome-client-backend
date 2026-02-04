import { logger } from "../../../../logger.js";
import { DeviceVacuumCleaner } from "../../../../model/devices/DeviceVacuumCleaner.js";
import { XiaomiController } from "./xiaomiController.js";

export class XiaomiVacuumCleaner extends DeviceVacuumCleaner {
  private address?: string;
  private token?: string;
  private model?: string;
  private did?: string;

  constructor(
    name?: string,
    id?: string,
    address?: string,
    token?: string,
    model?: string,
    did?: string
  ) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.address = address;
    this.token = token;
    this.model = model;
    this.did = did;
    this.isConnected = Boolean(token);
    this.moduleId = "xiaomi";
    this.updateValues();
  }

  updateValues() {
    if (!this.address || !this.token) {
      logger.debug("updateValues() uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    logger.debug("updateValues() nicht implementiert fuer {}", this.id);
  }

  getAddress() {
    return this.address;
  }

  setAddress(address: string) {
    this.address = address;
  }

  getToken() {
    return this.token;
  }

  setToken(token: string) {
    this.token = token;
    this.isConnected = Boolean(token);
  }

  getModel() {
    return this.model;
  }

  setModel(model: string) {
    this.model = model;
  }

  getDid() {
    return this.did;
  }

  setDid(did: string) {
    this.did = did;
  }

  protected executeSetPower(power: boolean) {
    if (!this.address || !this.token) {
      logger.warn("executeSetPower uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "setPower", power);
  }

  protected executeStartCleaning() {
    if (!this.address || !this.token) {
      logger.warn("executeStartCleaning uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "start");
  }

  protected executeStopCleaning() {
    if (!this.address || !this.token) {
      logger.warn("executeStopCleaning uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "stop");
  }

  protected executePauseCleaning() {
    if (!this.address || !this.token) {
      logger.warn("executePauseCleaning uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "pause");
  }

  protected executeResumeCleaning() {
    if (!this.address || !this.token) {
      logger.warn("executeResumeCleaning uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "resume");
  }

  protected executeDock() {
    if (!this.address || !this.token) {
      logger.warn("executeDock uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "home");
  }

  protected executeSetMode(mode: string) {
    if (!this.address || !this.token) {
      logger.warn("executeSetMode uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "setMode", mode);
  }

  protected executeCleanRoom(roomId: string) {
    if (!this.address || !this.token) {
      logger.warn("executeCleanRoom uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "cleanRoom", roomId);
  }

  protected executeCleanZone(zoneId: string) {
    if (!this.address || !this.token) {
      logger.warn("executeCleanZone uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "cleanZone", zoneId);
  }

  protected executeChangeFanSpeed(fanSpeed: number) {
    if (!this.address || !this.token) {
      logger.warn("executeChangeFanSpeed uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "setFanSpeed", fanSpeed);
  }

  protected executeChangeMode(mode: string) {
    if (!this.address || !this.token) {
      logger.warn("executeChangeMode uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "setMode", mode);
  }

  protected executeClearError() {
    if (!this.address || !this.token) {
      logger.warn("executeClearError uebersprungen fuer {} - address/token fehlen", this.id);
      return;
    }
    void XiaomiController.callMethod(this.address, this.token, "reset");
  }
}

