import { logger } from "../../../../../logger.js";
import { CLEANING_INTENSITY, CLEANING_MODE, DEVICE_MODE, DeviceVacuumCleaner, VACUUM_INTENSITY, WIPER_INTENSITY, ZoneDefinition } from "../../../../../model/devices/DeviceVacuumCleaner.js";
import { XIAOMICONFIG } from "../xiaomiModule.js";
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

export enum MIO_WIPER_CLEANING_LEVEL {
  COMMAND = "set_water_box_custom_mode",
  GETTER = "get_water_box_custom_mode",
  WIPER_OFF = 200,
  WIPER_LOW = 201,
  WIPER_MIDDLE = 202,
  WIPER_HIGH = 203
}

export enum MIO_VACUUM_CLEANING_LEVEL {
  COMMAND = "set_custom_mode",
  GETTER = "get_custom_mode",
  VACUUM_SILENT = 101,
  VACUUM_BALANCED = 102,
  VACUUM_TURBO = 103,
  VACUUM_MAX = 104,
  VACUUM_MAX_PLUS = 105
}

export enum MIO_CLEANING_INTENSITY {
  COMMAND = "set_mop_mode",
  GETTER = "get_mop_mode",
  STANDARD = 300, //Standard
  DEEP = 301, //Gründlich
  DEEP_PLUS = 303, //Gründlich +
  FAST = 304 //Schnell
}

export enum MIO_REMOTE_CONTROL{
  START = "app_rc_start",
  STOP = "app_rc_stop",
  END = "app_rc_end",
  MOVE = "app_rc_move",
}

export enum MIO_CLEANING_RECORDS {
  GET_RECORDS = "get_clean_summary",
  GET_RECORD = "get_clean_record",
}

export enum MIO_CLEANING_REPEAT_TIMES {
  GET_REPEAT_TIMES = "get_clean_repeat_times",
  SET_REPEAT_TIMES = "set_clean_repeat_times", //{"repeat":1}
}

export enum MIO_COMMANDS {
  CHARGE = "app_charge",
  GET_DRY_SETTINGS = "app_get_dryer_setting",
  GET_WASH_SETTINGS = "get_wash_towel_mode",
  PAUSE_CLEANING = "app_pause",
  RESUME_CLEANING = "app_resume",
  START_DUST_COLLECTION = "app_start_collect_dust",
  STOP_DUST_COLLECTION = "app_stop_collect_dust",
  START_WASCH = "app_start_wash",
  STOP_WASCH = "app_stop_wash",
  START_CLEANING = "app_start",
  STOP_CLEANING = "app_stop",
  GET_CLEAN_SEQUENCE = "get_clean_sequence",
  SET_CLEAN_SEQUENCE = "set_clean_sequence",
  GET_CONSUMABLE = "get_consumable",
  GET_ROOMS = "get_room_mapping",
  GET_STATUS = "get_status",
  START_SEGMENT_CLEAN = "app_segment_clean",
  RESUME_SEGMENT_CLEAN = "resume_segment_clean",
  START_ZONED_CLEAN = "app_zoned_clean",
  RESUME_ZONED_CLEAN = "resume_zoned_clean",
  STOP_ZONED_CLEAN = "stop_zoned_clean",
  STOP_SEGMENT_CLEAN = "stop_segment_clean",
  FIND_ME = "find_me",
  WEAKUP_ROBOT = "app_wakeup_robot",
  CHANGE_VOLUME = "change_sound_volume",
  GET_VOLUME = "get_sound_volume",
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
      logger.debug(
        { id: this.id },
        "updateValues() uebersprungen - kein gueltiger XiaomiDeviceController"
      );
      return;
    }
    if (!this.address || !this.token) {
      logger.debug({ id: this.id }, "updateValues() uebersprungen - address/token fehlen");
      return;
    }
    const status = await this.getStatus();
    if( !status) return;
    this.setUpdatedData(status, false);
  }

  public async setUpdatedData(status: Record<string, unknown>, trigger: boolean = false) {
    const battery = status.battery;
    if (typeof battery === "number") {
      this.setBattery(battery, trigger);
    }
    const state = status.state;
    if (typeof state === "number") {
      const inCleaning = status.in_cleaning;
      const inReturning = status.in_returning;
      if( inCleaning === 1 ) {
        this.deviceState.mode = DEVICE_MODE.CLEANING;
      } else if( inReturning === 1 || state === 6) {
        this.deviceState.mode = DEVICE_MODE.DOCKING;
      } else {
        this.deviceState.mode = this.getMode(state);
      }
    }
    const fanPower = status.fan_power;
    if (typeof fanPower === "number") {
      await this.setFanSpeed(fanPower as unknown as VACUUM_INTENSITY, false, trigger);
    }

    const dustcollectionStatus = status.dust_collection_status;
    if (typeof dustcollectionStatus === "number") {
      this.dockState.dustCollection = dustcollectionStatus === 1;
    }

    const washStatus = status.wash_status;
    if (typeof washStatus === "number") {
      this.dockState.washing = washStatus === 1;
    }

    const dryStatus = status.dry_status;
    if (typeof dryStatus === "number") {
      this.dockState.drying = dryStatus === 1;
    }

    const mob_mode = status.mob_mode;
    if (typeof mob_mode === "number") {
      await this.setCleaningMode(mob_mode as unknown as CLEANING_MODE, false, trigger);
    }

    const waterBoxMode = status.water_box_mode;
    if (typeof waterBoxMode === "number") {
      await this.setCleaningIntensity(waterBoxMode as unknown as CLEANING_INTENSITY, false, trigger);
    }

    const repeat = status.repeat;
    if (typeof repeat === "number") {
      await this.changeRepeatTimes(repeat, false, trigger);
    }

    const waterBoxStatus = status.water_box_status;
    if (typeof waterBoxStatus === "number") {
      await this.setWaterBoxLevel(waterBoxStatus == 1 ? 80 : 0, trigger);
      await this.setDirtyWaterBoxLevel(waterBoxStatus == 1 ? 20 : 100, trigger);
    }

    const errorCode = status.error_code;
    if (typeof errorCode === "number" && errorCode !== 0) {
      this.error = `Fehler ${errorCode}`;
    } else {
      this.error = "";
    }
  }


  private getMode(state: number): DEVICE_MODE {
    if (state === 8) {
      return DEVICE_MODE.DOCKED;
    } else if( state === 18){
      return DEVICE_MODE.UNDOCKING;
    } else if(state === 3){
      return DEVICE_MODE.CLEANING_STOPPED;
    }
    return DEVICE_MODE.CLEANING;
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

  toJSON(): Record<string, unknown> {
    const json = super.toJSON();
    delete json.xiaomi;
    return json;
  }

  protected async executeFindMe(): Promise<void> {
    if (!this.xiaomi || !this.address || !this.token) return;
    await this.xiaomi.callMiioAndGetResult(
      this.address,
      this.token,
      MIO_COMMANDS.FIND_ME,
      []
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
      const volume = await this.getVolume();
      await this.executeSetVolume(0);
      await this.executeStopCleaning();
      await this.executeStartCleaningRoom([String(roomId)]);
      await this.executeSetCleaningMode(CLEANING_MODE.VACUUM_CLEANING);
      await this.executeSetFanSpeed(VACUUM_INTENSITY.SILENT);
      setTimeout(async () => {
        await this.executeSetVolume(volume[0] as number);
      }, 1000);
      
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
        const volume = await this.getVolume();
        await this.executeSetVolume(0);
        await this.executeStopCleaning();
        setTimeout(async () => {
          await this.executeSetVolume(volume[0] as number);
          await this.executeFindMe();
        }, 1000);
        
        return "success";
      }
    }
    await this.executeStopCleaningRoom();
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
      MIO_COMMANDS.GET_ROOMS,
      []
    );
    if (!result || !Array.isArray(result)) {
      return [];
    }
    return result.filter(isRoomMappingEntry) as RoomMappingEntry[];
  }

  async getWashSettings(): Promise<Map<string, unknown> | null> {
    if (!this.xiaomi || !this.address || !this.token) {
      logger.debug({ id: this.id }, "getWashSettings uebersprungen - xiaomi/address/token fehlen");
      return null;
    }
    return await this.xiaomi.callMiioAndGetResult(this.address,this.token,MIO_COMMANDS.GET_WASH_SETTINGS)
  }

  async getDrySettings(): Promise<Map<string, unknown> | null> {
    if (!this.xiaomi || !this.address || !this.token) {
      logger.debug({ id: this.id }, "getDrySettings uebersprungen - xiaomi/address/token fehlen");
      return null;
    }
    return await this.xiaomi.callMiioAndGetResult(this.address,this.token,MIO_COMMANDS.GET_DRY_SETTINGS)
  }

  async getCleanSequence(): Promise<Map<string, unknown> | null> {
    if (!this.xiaomi || !this.address || !this.token) {
      logger.debug({ id: this.id }, "getCleanSequence uebersprungen - xiaomi/address/token fehlen");
      return null;
    }
    return await this.xiaomi.callMiioAndGetResult(this.address,this.token,MIO_COMMANDS.GET_CLEAN_SEQUENCE)
  }

  async getConsumable(): Promise<Map<string, unknown> | null> {
    if (!this.xiaomi || !this.address || !this.token) {
      logger.debug({ id: this.id }, "getConsumable uebersprungen - xiaomi/address/token fehlen");
      return null;
    }
    return await this.xiaomi.callMiioAndGetResult(this.address,this.token,MIO_COMMANDS.GET_CONSUMABLE)
  }

  async getStatus(): Promise<Record<string, unknown> | null> {
    if (!this.xiaomi || !this.address || !this.token) {
      logger.debug({ id: this.id }, "getStatus uebersprungen - xiaomi/address/token fehlen");
      return null;
    }
    const result = await this.xiaomi.callMiioAndGetResult(this.address,this.token,MIO_COMMANDS.GET_STATUS)
    if (!result || !Array.isArray(result) || result.length === 0) return null;
    const status = result[0] as Record<string, unknown>;
    return status;
  }

  async getCleanSummary(): Promise<Map<string, unknown> | null> {
    if (!this.xiaomi || !this.address || !this.token) {
      logger.debug({ id: this.id }, "getCleanSummary uebersprungen - xiaomi/address/token fehlen");
      return null;
    }
    return await this.xiaomi.callMiioAndGetResult(this.address,this.token, MIO_CLEANING_RECORDS.GET_RECORDS)
  }

  async getCleanRecord(recordid:string): Promise<Map<string, unknown> | null> {
    if (!this.xiaomi || !this.address || !this.token) {
      logger.debug({ id: this.id }, "getCleanRecord uebersprungen - xiaomi/address/token fehlen");
      return null;
    }
    return await this.xiaomi.callMiioAndGetResult(this.address,this.token, MIO_CLEANING_RECORDS.GET_RECORD, [recordid])
  }

  async getVolume(): Promise<number[]> {
    if (!this.xiaomi || !this.address || !this.token) {
      logger.debug({ id: this.id }, "getVolume uebersprungen - xiaomi/address/token fehlen");
      return [90];
    }
    return (await this.xiaomi.callMiioAndGetResult(this.address,this.token, MIO_COMMANDS.GET_VOLUME)) as unknown as number[] ?? [90];
  }



  protected async executeSetPower(power: boolean): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeSetPower uebersprungen - address/token fehlen");
      return;
    }
    if (power) {
      await this.xiaomi?.callMethod(this.address, this.token, MIO_COMMANDS.WEAKUP_ROBOT);
    } 
  }

  protected async executeStartCleaning(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStartCleaning uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, MIO_COMMANDS.START_CLEANING);
  }

  protected async executeStopCleaning(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStopCleaning uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, MIO_COMMANDS.STOP_CLEANING);
  }

  protected async executePauseCleaning(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executePauseCleaning uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, MIO_COMMANDS.PAUSE_CLEANING);
  }

  protected async executeResumeCleaning(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeResumeCleaning uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, MIO_COMMANDS.RESUME_CLEANING);
  }

  protected async executeDock(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeDock uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMethod(this.address, this.token, MIO_COMMANDS.CHARGE);
  }

  protected async executeStartCleaningRoom(roomIds: string[]): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeCleanRoom uebersprungen - address/token fehlen");
      return;
    }
    const res = await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.START_SEGMENT_CLEAN, roomIds.map(roomId => parseInt(roomId)));
    console.log(res);
  }

  protected async executeStopCleaningRoom(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStopCleanRoom uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.STOP_SEGMENT_CLEAN);
  }

  protected async executeResumeCleaningRoom(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStopCleanRoom uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.RESUME_SEGMENT_CLEAN);
  }

  /** app_zoned_clean: [[x1,y1,x2,y2,repeat], ...] – Koordinaten in mm */
  protected async executeStartCleaningZones(zones: ZoneDefinition[]): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeCleanZones uebersprungen - address/token fehlen");
      return;
    }
    if (zones.length === 0) return;
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.START_ZONED_CLEAN, zones);
  }

  protected async executeStopCleaningZones(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStopCleanZones uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.STOP_ZONED_CLEAN);
  }

  protected async executeResumeCleaningZones(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeResumeCleanZones uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.RESUME_ZONED_CLEAN);
  }

  protected async executeSetVolume(volume: number): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeSetVolume uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.CHANGE_VOLUME, [volume]);
  }

  //0 = Quiet, 1 = Balanced, 2 = Turbo, 3 = max, 4 = Max+
  protected async executeSetFanSpeed(fanSpeed: VACUUM_INTENSITY): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeSetFanSpeed uebersprungen - address/token fehlen");
      return;
    }
    const fanSpeedCommand = this.getFanSpeed(fanSpeed);
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_VACUUM_CLEANING_LEVEL.COMMAND, [fanSpeedCommand]);
  }

  protected async executeSetWiperLevel(wiperLevel: WIPER_INTENSITY): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeSetWiperLevel uebersprungen - address/token fehlen");
      return;
    }
    const wiperLevelCommand = this.getWiperLevel(wiperLevel);
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_WIPER_CLEANING_LEVEL.COMMAND, [wiperLevelCommand]);
  }

  private getWiperLevel(wiperLevel: WIPER_INTENSITY): MIO_WIPER_CLEANING_LEVEL {
    if( wiperLevel === WIPER_INTENSITY.OFF ) {
      return MIO_WIPER_CLEANING_LEVEL.WIPER_OFF;
    } else if( wiperLevel === WIPER_INTENSITY.LOW ) {
      return MIO_WIPER_CLEANING_LEVEL.WIPER_LOW;
    } else if( wiperLevel === WIPER_INTENSITY.MIDDLE ) {
      return MIO_WIPER_CLEANING_LEVEL.WIPER_MIDDLE;
    } else {
      return MIO_WIPER_CLEANING_LEVEL.WIPER_HIGH;
    }
  }

  //1-3x Durchlauf
  protected async executeChangeRepeatTimes(times: number): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeChangeFanSpeed uebersprungen - address/token fehlen");
      return;
    }
    const timesCorrected = Math.max(1, Math.min(3, times));
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_CLEANING_REPEAT_TIMES.SET_REPEAT_TIMES, {"repeat":timesCorrected});
  }

  protected async executeSetCleaningIntensity(intensity: CLEANING_INTENSITY): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeSetCleaningIntensity uebersprungen - address/token fehlen");
      return;
    }
    const intensityCommand = this.getCleaningIntensity(intensity);
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_CLEANING_INTENSITY.COMMAND, [intensityCommand]);
  }

  private getCleaningIntensity(intensity: CLEANING_INTENSITY): MIO_CLEANING_INTENSITY {
    if( intensity === CLEANING_INTENSITY.STANDARD ) {
      return MIO_CLEANING_INTENSITY.STANDARD;
    } else if( intensity === CLEANING_INTENSITY.DEEP ) {
      return MIO_CLEANING_INTENSITY.DEEP;
    } else if( intensity === CLEANING_INTENSITY.DEEP_PLUS ) {
      return MIO_CLEANING_INTENSITY.DEEP_PLUS;
    } else {
      return MIO_CLEANING_INTENSITY.FAST;
    }
  }

  // 1= mop & vacuum, 2 = vacuum only, 3 = mop only
  protected async executeSetCleaningMode(mode: CLEANING_MODE): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeChangeCleaningMode uebersprungen - address/token fehlen");
      return;
    }
    if( mode === CLEANING_MODE.WIPER_VACUUM_CLEANING){
      const cleaningIntensity = this.deviceState.cleaningIntensity === CLEANING_INTENSITY.FAST || this.deviceState.cleaningIntensity === CLEANING_INTENSITY.STANDARD ? this.deviceState.cleaningIntensity : CLEANING_INTENSITY.STANDARD;
      await this.executeSetCleaningIntensity(cleaningIntensity);
      const wiperIntensity = this.deviceState.wiperIntensity === WIPER_INTENSITY.OFF ? WIPER_INTENSITY.MIDDLE : this.deviceState.wiperIntensity;
      await this.executeSetWiperLevel(wiperIntensity);
      const vacuumIntensity = this.deviceState.vacuumIntensity === VACUUM_INTENSITY.MAX_PLUS ? VACUUM_INTENSITY.TURBO : this.deviceState.vacuumIntensity;
      await this.executeSetFanSpeed(vacuumIntensity);

    } else if( mode === CLEANING_MODE.WIPER_CLEANING){
      await this.executeSetCleaningIntensity(this.deviceState.cleaningIntensity ?? CLEANING_INTENSITY.STANDARD);
      const wiperIntensity = this.deviceState.wiperIntensity === WIPER_INTENSITY.OFF ? WIPER_INTENSITY.MIDDLE : this.deviceState.wiperIntensity;
      await this.executeSetWiperLevel(wiperIntensity);
      await this.executeSetFanSpeed(VACUUM_INTENSITY.MAX_PLUS);

    } else if( mode === CLEANING_MODE.VACUUM_CLEANING){
      await this.executeSetCleaningIntensity(CLEANING_INTENSITY.STANDARD);
      await this.executeSetWiperLevel(WIPER_INTENSITY.OFF);
      await this.executeSetFanSpeed(this.deviceState.vacuumIntensity ?? VACUUM_INTENSITY.SILENT);
    }
  }

  private getFanSpeed(fanSpeed: VACUUM_INTENSITY): MIO_VACUUM_CLEANING_LEVEL {
    if( fanSpeed === VACUUM_INTENSITY.SILENT ) {
      return MIO_VACUUM_CLEANING_LEVEL.VACUUM_SILENT;
    } else if( fanSpeed === VACUUM_INTENSITY.BALANCED ) {
      return MIO_VACUUM_CLEANING_LEVEL.VACUUM_BALANCED;
    } else if( fanSpeed === VACUUM_INTENSITY.TURBO ) {
      return MIO_VACUUM_CLEANING_LEVEL.VACUUM_TURBO;
    } else if( fanSpeed === VACUUM_INTENSITY.MAX ) {
      return MIO_VACUUM_CLEANING_LEVEL.VACUUM_MAX;
    } else {
      return MIO_VACUUM_CLEANING_LEVEL.VACUUM_MAX_PLUS;
    }
  }

  protected async executeStartDustCollection(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStartDustCollection uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.CHARGE);
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.START_DUST_COLLECTION);
  }

  protected async executeStopDustCollection(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStopDustCollection uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.STOP_DUST_COLLECTION);
  }

  protected async executeStartWash(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStartWash uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.START_WASCH);
  }
  
  protected async executeStopWash(): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeStopWash uebersprungen - address/token fehlen");
      return;
    }
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.STOP_WASCH);
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.CHARGE);
  }

  protected async executeSetCleanSequence(sequence: string[]): Promise<void> {
    if (!this.address || !this.token) {
      logger.warn({ id: this.id }, "executeSetCleanSequence uebersprungen - address/token fehlen");
      return;
    }
    const miioOrder = sequence
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n));
    await this.xiaomi?.callMiioAndGetResult(this.address, this.token, MIO_COMMANDS.SET_CLEAN_SEQUENCE, miioOrder);
  }
}

