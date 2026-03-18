import { logger } from "../../../../../logger.js";
import { DeviceVacuumCleaner, ZoneDefinition } from "../../../../../model/devices/DeviceVacuumCleaner.js";
import { XIAOMICONFIG, XIAOMIMODULE } from "../xiaomiModule.js";
import { XiaomiDeviceController } from "../xiaomiDeviceController.js";

/** [roomId, segmentId, attribute] */
export type RoomMappingEntry = [number, string, number];

function isRoomMappingEntry(arr: unknown): arr is RoomMappingEntry {
  return (
    Array.isArray(arr) &&
    arr.length === 3 &&
    typeof arr[0] === "number" &&
    typeof arr[1] === "string" &&
    typeof arr[2] === "number"
  );
}

function mapStateToMode(state: number): string {
  const modes: Record<number, string> = {
    1: "initiating",
    2: "idle",
    3: "waiting",
    5: "cleaning",
    6: "returning",
    8: "charging",
    9: "charging-error",
    10: "paused",
    11: "spot-cleaning",
    12: "error",
    13: "shutting-down",
    14: "updating",
    15: "docking",
    17: "zone-cleaning",
    100: "full",
  };
  return modes[state] ?? `unknown(${state})`;
}

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
      logger.debug({ id: this.id }, "updateValues() uebersprungen - xiaomi ist noch null");
      return;
    }
    if (!this.address || !this.token) {
      logger.debug({ id: this.id }, "updateValues() uebersprungen - address/token fehlen");
      return;
    }
    const result = await this.xiaomi.callMiioAndGetResult(
      this.address,
      this.token,
      "get_status",
      []
    );
    if (!result || !Array.isArray(result) || result.length === 0) {
      logger.debug({ id: this.id }, "updateValues() - get_status lieferte keine Daten");
      return;
    }
    const status = result[0] as Record<string, unknown>;
    const battery = status.battery;
    if (typeof battery === "number") {
      this.battery = battery;
      this.batteryLevel = battery;
    }
    const inCleaning = status.in_cleaning;
    this.cleaningState = inCleaning === 1;
    const state = status.state;
    if (typeof state === "number") {
      this.dockedState = state === 8 || state === 15;
      this.mode = mapStateToMode(state);
    }
    const fanPower = status.fan_power;
    if (typeof fanPower === "number") {
      this.fanSpeed = fanPower;
    }
    const errorCode = status.error_code;
    if (typeof errorCode === "number" && errorCode !== 0) {
      this.error = `Fehler ${errorCode}`;
    } else {
      this.error = undefined;
    }
    const waterBoxMode = status.water_box_mode;
    if (typeof waterBoxMode === "number") {
      this.waterBoxLevel = waterBoxMode;
    }
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

  /**
   * Reinigungsmodus auf „nur saugen“ (ohne Wischen) stellen.
   * water_box_mode 200 = vacuum only bei Roborock S7/S8.
   */
  private async setVacuumOnlyMode(): Promise<void> {
    if (!this.xiaomi || !this.address || !this.token) return;
    await this.xiaomi.callMiioAndGetResult(
      this.address,
      this.token,
      "set_mop_mode",
      [0]
    );
  }

  /**
   * Staubsauger zu Raum navigieren: startet Raumreinigung via cleanRoom, wartet bis clean_area > 1, stoppt sofort.
   * @returns "success" bei Erfolg, sonst Fehlermeldung
   */
  async navigateToRoom(roomId: number): Promise<"success" | string> {
    if (!this.xiaomi || !this.address || !this.token) {
      return "Verbindung fehlt";
    }
    try {
      await this.executeStopCleaning();
      await this.setVacuumOnlyMode();
      await this.cleanRoom(String(roomId), true, false);
    } catch (err) {
      logger.warn({ err, roomId }, "cleanRoom fehlgeschlagen");
      return "Raumreinigung konnte nicht gestartet werden";
    }
    const minDelayBeforeStopMs = 3000;
    const pollIntervalMs = 2500;
    const maxWaitMs = 90000;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const elapsed = Date.now() - start;
      if (elapsed < minDelayBeforeStopMs) {
        await new Promise((r) => setTimeout(r, minDelayBeforeStopMs - elapsed));
      } else {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      const result = await this.xiaomi.callMiioAndGetResult(
        this.address,
        this.token,
        "get_status",
        [],
        { retries: 10 }
      );
      if (!result || !Array.isArray(result) || result.length === 0) continue;
      const status = result[0] as Record<string, unknown>;
      const cleanArea = typeof status.clean_area === "number" ? status.clean_area : 0;
      if (cleanArea > 1) {
        await this.executeStopCleaning();
        return "success";
      }
    }
    await this.executeStopCleaning();
    return "Timeout – Staubsauger wurde gestoppt";
  }

  /**
   * Räume vom Gerät abfragen. Rückgabe: [roomId, segmentId, attribute][]
   */
  async getRoomMapping(): Promise<RoomMappingEntry[]> {
    if (!this.xiaomi || !this.address || !this.token) {
      logger.debug({ id: this.id }, "getRoomMapping uebersprungen - xiaomi/address/token fehlen");
      return [];
    }
    const result = await this.xiaomi.callMiioAndGetResult(
      this.address,
      this.token,
      "get_room_mapping",
      []
    );
    if (!result || !Array.isArray(result)) {
      return [];
    }
    return result.filter(isRoomMappingEntry) as RoomMappingEntry[];
  }

  protected async executeSetPower(power: boolean): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeSetPower uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, "setPower", [power]);
  }

  protected async executeStartCleaning(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStartCleaning uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, "app_start");
  }

  protected async executeStopCleaning(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStopCleaning uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, "app_stop");
  }

  protected async executePauseCleaning(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executePauseCleaning uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, "app_pause");
  }

  protected async executeResumeCleaning(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeResumeCleaning uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, "app_resume");
  }

  protected async executeDock(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeDock uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, "app_charge");
  }

  protected async executeCleanRoom(roomId: string): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeCleanRoom uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, "app_segment_clean", [Number(roomId)]);
  }

  /** app_zoned_clean: [[x1,y1,x2,y2,repeat], ...] – Koordinaten in mm */
  protected async executeCleanZones(zones: ZoneDefinition[]): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeCleanZones uebersprungen - address/token fehlen");
      return;
    }
    if (zones.length === 0) return;
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, "app_zoned_clean", zones);
  }

  //0 = Quiet, 1 = Balanced, 2 = Turbo, 3 = max, 4 = Max+
  protected async executeChangeFanSpeed(fanSpeed: number): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeChangeFanSpeed uebersprungen - address/token fehlen");
      return;
    }
    const fanSpeedCorrected = Math.max(0, Math.min(4, fanSpeed));
    await this.xiaomi?.callMethod(this.address, this.token, "set_custom_mode", [fanSpeedCorrected]);
  }

  // 200–500 = Wassermenge (ml oder ähnlich)
  protected async executeChangeWaterBoxLevel(waterBoxLevel: number): Promise<void> {
    if (!this.address || !this.token) { 
      logger.warn({ id: this.id }, "executeChangeWaterBoxLevel uebersprungen - address/token fehlen");
      return;
    }
    const waterBoxLevelCorrected = Math.max(200, Math.min(500, waterBoxLevel));
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, "set_water_box_mode", [waterBoxLevelCorrected]);
  }

  protected async executeClearError(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeClearError uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, "reset");
  }
}

