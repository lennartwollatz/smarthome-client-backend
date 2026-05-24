import { logger } from "../../../../../logger.js";
import { Device } from "../../../../../model/devices/Device.js";
import { DeviceCar, type DeviceCarAddress } from "../../../../../model/devices/DeviceCar.js";
import { BMWDeviceController } from "../bmwDeviceController.js";
import { BMWCONFIG, BMWMODULE } from "../bmwModule.js";
import { DeviceType } from "../../../../../model/devices/helper/DeviceType.js";
import {
  BMW_DEFAULT_DOORS_CLOSED,
  BMW_DEFAULT_WINDOWS_CLOSED,
  mapTelemetrySnapshotToCarFields,
  type TirePressureQuad
} from "../bmwCarDataPayloadMapper.js";
import { scheduleCarLocationEnrichment } from "../bmwCarLocationEnricher.js";

export class BMWCar extends DeviceCar {
  carDataTelemetry?: Record<string, unknown>;
  tirePressuresKpa?: TirePressureQuad;
  tirePressureTargetKpa?: TirePressureQuad;
  headingDegrees?: number;
  climateRemainingTime?: number;

  private bmwController?: BMWDeviceController;

  constructor(name?: string, id?: string, vin?: string, bmwController?: BMWDeviceController) {
    super();
    this.name = name ?? BMWCONFIG.defaultDeviceName;
    this.id = id ?? "";
    this.vin = vin;
    this.bmwController = bmwController;
    this.moduleId = BMWCONFIG.id;
    this.type = DeviceType.CAR;
    (this as Device & { icon?: string }).icon = BMWMODULE.icon;
    this.isConnected = true;
    this.quickAccess = true;
    this.windows = { ...BMW_DEFAULT_WINDOWS_CLOSED };
    this.doors = { ...BMW_DEFAULT_DOORS_CLOSED };
    this.lockedState = true;
  }

  setBMWController(controller: BMWDeviceController) {
    this.bmwController = controller;
  }

  override async updateValues(): Promise<void> {
    if (!this.bmwController || !this.vin) return;
    try {
      const snap = this.bmwController.getTelemetrySnapshot(this.vin);
      if (!snap || Object.keys(snap).length === 0) {
        this.isConnected = this.bmwController.getHub().isConnected();
        return;
      }
      const previousLocation = this.location;
      const status = mapTelemetrySnapshotToCarFields(snap);
      this.fuelLevelPercent = status.fuelLevelPercent;
      this.rangeKm = status.rangeKm;
      this.mileageKm = status.mileageKm;
      this.lockedState = status.lockedState;
      this.inUseState = status.inUseState;
      this.climateControlState = status.climateControlState;
      this.location = status.location;
      if (status.location) {
        scheduleCarLocationEnrichment(
          () => this.location,
          loc => {
            this.location = loc;
          },
          status.location,
          previousLocation,
          () => undefined
        );
      }
      this.windows = status.windows;
      this.doors = status.doors;
      this.tirePressuresKpa = status.tirePressuresKpa;
      this.tirePressureTargetKpa = status.tirePressureTargetKpa;
      this.headingDegrees = status.headingDegrees;
      this.climateRemainingTime = status.climateRemainingTime;
      this.carDataTelemetry = status.carDataTelemetry;
      this.isConnected = true;
    } catch (err) {
      this.isConnected = false;
      logger.error({ err, deviceId: this.id }, "Fehler beim Aktualisieren der BMW Werte");
    }
  }

  protected async executeStartClimateControl(): Promise<void> {
    logger.info({ deviceId: this.id }, "BMW Klimasteuerung: CarData-Streaming unterstuetzt keine Remote-Befehle");
  }

  protected async executeStopClimateControl(): Promise<void> {
    logger.info({ deviceId: this.id }, "BMW Klimasteuerung: CarData-Streaming unterstuetzt keine Remote-Befehle");
  }

  protected async executeSendAddress(_subject: string, _address: DeviceCarAddress): Promise<void> {
    logger.info({ deviceId: this.id }, "BMW Ziel senden: CarData-Streaming unterstuetzt keine Remote-Befehle");
  }
}
