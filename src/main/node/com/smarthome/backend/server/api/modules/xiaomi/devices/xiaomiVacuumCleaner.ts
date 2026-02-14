import { logger } from "../../../../../logger.js";
import { DeviceVacuumCleaner } from "../../../../../model/devices/DeviceVacuumCleaner.js";
import { XIAOMICONFIG, XIAOMIMODULE } from "../xiaomiModule.js";
import { XiaomiDeviceController } from "../xiaomiDeviceController.js";

export class XiaomiVacuumCleaner extends DeviceVacuumCleaner {
  private address?: string;
  private token?: string;
  private model?: string;
  private did?: string;
  private xiaomi?: XiaomiDeviceController;

  constructor();
  constructor(name: string, id: string, address: string, token: string, model?: string, did?: string, xiaomi?: XiaomiDeviceController);
  constructor(
    name?: string,
    id?: string,
    address?: string,
    token?: string,
    model?: string,
    did?: string,
    xiaomi?: XiaomiDeviceController
  ) {
    super();
    this.name = name ?? XIAOMICONFIG.defaultDeviceName;
    this.id = id ?? "889898893939399393b";
    this.address = address;
    this.token = token;
    this.model = model;
    this.did = did;
    this.xiaomi = xiaomi;
    this.isConnected = Boolean(token);
    this.moduleId = XIAOMICONFIG.id;
  }

  async updateValues(): Promise<void> {
    if (!this.xiaomi) {
      logger.debug(
        { id: this.id },
        "updateValues() uebersprungen - xiaomi ist noch null"
      );
      return;
    }
    if (!this.address || !this.token) {
      logger.debug({ id: this.id }, "updateValues() uebersprungen - address/token fehlen");
      return;
    }
    logger.debug({ id: this.id }, "updateValues() nicht implementiert");
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

  setXiaomiController(xiaomiController?: XiaomiDeviceController) {
    this.xiaomi = xiaomiController;
  }

  protected executeSetPower(power: boolean) {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeSetPower uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "setPower", power);
  }

  protected executeStartCleaning() {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStartCleaning uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "start");
  }

  protected executeStopCleaning() {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStopCleaning uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "stop");
  }

  protected executePauseCleaning() {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executePauseCleaning uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "pause");
  }

  protected executeResumeCleaning() {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeResumeCleaning uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "resume");
  }

  protected executeDock() {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeDock uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "home");
  }

  protected executeSetMode(mode: string) {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeSetMode uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "setMode", mode);
  }

  protected executeCleanRoom(roomId: string) {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeCleanRoom uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "cleanRoom", roomId);
  }

  protected executeCleanZone(zoneId: string) {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeCleanZone uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "cleanZone", zoneId);
  }

  protected executeChangeFanSpeed(fanSpeed: number) {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeChangeFanSpeed uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "setFanSpeed", fanSpeed);
  }

  protected executeChangeMode(mode: string) {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeChangeMode uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "setMode", mode);
  }

  protected executeClearError() {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeClearError uebersprungen - address/token fehlen");
      return;
    }
    void this.xiaomi?.callMethod(this.address, this.token, "reset");
  }
}

