import { logger } from "../../../../logger.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { BMWDeviceController } from "./bmwDeviceController.js";
import { BMWEvent } from "./bmwEvent.js";
import { BMWMODULE } from "./bmwModule.js";
import { BMWCar } from "./devices/bmwCar.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { mapTelemetrySnapshotToCarFields } from "./bmwCarDataPayloadMapper.js";
import { scheduleCarLocationEnrichment } from "./bmwCarLocationEnricher.js";

export class BMWEventStreamManager extends ModuleEventStreamManager<BMWDeviceController, BMWEvent> {
  constructor(
    managerId: string,
    moduleId: string,
    controller: BMWDeviceController,
    deviceManager: DeviceManager
  ) {
    super(managerId, moduleId, controller, deviceManager);
  }

  protected async startEventStream(callback: (event: BMWEvent) => void): Promise<void> {
    this.controller.setStreamVinListener(vin => {
      void this.applyMqttVinToDevices(vin, callback);
    });

    const connected = await this.controller.ensureMqttConnected();
    if (!connected) {
      logger.warn(
        "BMW EventStream: MQTT-Verbindung nicht moeglich (Token/Client-ID) – VIN-Listener aktiv, Reconnect versucht Verbindung"
      );
      return;
    }

    const devices = this.deviceManager.getDevices();
    for (const device of devices) {
      if (device.moduleId !== BMWMODULE.id) continue;
      if (device.type !== DeviceType.CAR) continue;
      if (!(device instanceof BMWCar) || !device.vin) continue;
      void this.applyMqttVinToDevices(device.vin, callback);
    }

    logger.info("BMW EventStream: MQTT Push aktiv");
  }

  private async applyMqttVinToDevices(vin: string, callback: (event: BMWEvent) => void): Promise<void> {
    const snap = this.controller.getTelemetrySnapshot(vin);
    if (!snap) return;

    const devices = this.deviceManager.getDevices();
    for (const device of devices) {
      if (device.moduleId !== BMWMODULE.id) continue;
      if (device.type !== DeviceType.CAR) continue;
      if (!(device instanceof BMWCar) || device.vin !== vin) continue;

      const before = JSON.stringify({
        fuelLevelPercent: device.fuelLevelPercent,
        rangeKm: device.rangeKm,
        mileageKm: device.mileageKm,
        lockedState: device.lockedState,
        inUseState: device.inUseState,
        climateControlState: device.climateControlState,
        location: device.location,
        windows: device.windows,
        doors: device.doors,
        carDataTelemetry: device.carDataTelemetry,
        tirePressureTargetKpa: device.tirePressureTargetKpa,
        tirePressuresKpa: device.tirePressuresKpa,
        headingDegrees: device.headingDegrees,
        climateRemainingTime: device.climateRemainingTime
      });

      const previousLocation = device.location;
      const partial = mapTelemetrySnapshotToCarFields(snap);
      Object.assign(device, partial);
      device.isConnected = true;

      if (partial.location) {
        scheduleCarLocationEnrichment(
          () => device.location,
          loc => {
            device.location = loc;
          },
          partial.location,
          previousLocation,
          () => {
            if (!device.id) return;
            callback({
              deviceid: device.id,
              data: {
                type: "StatusChanged",
                value: {
                  fuelLevelPercent: device.fuelLevelPercent,
                  rangeKm: device.rangeKm,
                  mileageKm: device.mileageKm,
                  lockedState: device.lockedState,
                  inUseState: device.inUseState,
                  climateControlState: device.climateControlState
                }
              }
            });
          }
        );
      }

      const after = JSON.stringify({
        fuelLevelPercent: device.fuelLevelPercent,
        rangeKm: device.rangeKm,
        mileageKm: device.mileageKm,
        lockedState: device.lockedState,
        inUseState: device.inUseState,
        climateControlState: device.climateControlState,
        location: device.location,
        windows: device.windows,
        doors: device.doors,
        carDataTelemetry: device.carDataTelemetry,
        tirePressureTargetKpa: device.tirePressureTargetKpa,
        tirePressuresKpa: device.tirePressuresKpa,
        headingDegrees: device.headingDegrees,
        climateRemainingTime: device.climateRemainingTime
      });

      if (before !== after && device.id) {
        callback({
          deviceid: device.id,
          data: {
            type: "StatusChanged",
            value: {
              fuelLevelPercent: device.fuelLevelPercent,
              rangeKm: device.rangeKm,
              mileageKm: device.mileageKm,
              lockedState: device.lockedState,
              inUseState: device.inUseState,
              climateControlState: device.climateControlState
            }
          }
        });
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    this.controller.clearStreamVinListener();
    this.controller.disconnectMqtt();
    logger.info("BMW EventStream: MQTT getrennt");
  }

  protected async handleEvent(event: BMWEvent): Promise<void> {
    if (!event.deviceid || !event.data) return;
    const device = this.deviceManager.getDevice(event.deviceid);
    if (!device || !(device instanceof BMWCar)) return;
    if (event.data.type === "StatusChanged") {
      this.deviceManager.saveDevice(device);
    }
  }
}
