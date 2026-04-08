import { logger } from "../../../../logger.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { MatterDeviceController } from "./matterDeviceController.js";
import { MatterEvent } from "./matterEvent.js";
import { MATTERMODULE } from "./matterModule.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { LevelControl, OnOff, Thermostat } from "@matter/main/clusters";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { DeviceSwitch } from "../../../../model/devices/DeviceSwitch.js";
import { DeviceSwitchEnergy } from "../../../../model/devices/DeviceSwitchEnergy.js";
import { DeviceSwitchDimmer } from "../../../../model/devices/DeviceSwitchDimmer.js";
import { DeviceThermostat } from "com/smarthome/backend/model/devices/DeviceThermostat.js";

export class MatterEventStreamManager extends ModuleEventStreamManager<MatterDeviceController, MatterEvent> {

  constructor(managerId: string, controller: MatterDeviceController, deviceManager: DeviceManager) {
    super(managerId, MATTERMODULE.id, controller, deviceManager);
  }

  protected async startEventStream(callback: (event: MatterEvent) => void): Promise<void> {
    let devices = this.deviceManager.getDevicesForModule(MATTERMODULE.id);
    for (const device of devices) {
      try {
        await this.controller.startEventStream(device, callback);
      } catch (err) {
        logger.error({ err, deviceId: device.id }, "Fehler beim Starten des EventStreams für Matter-Gerät");
        // Weiter mit dem nächsten Gerät, Server soll nicht abstürzen
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    let devices = this.deviceManager.getDevicesForModule(MATTERMODULE.id);
    for (const device of devices) {
      try {
        await this.controller.stopEventStream(device);
      } catch (err) {
        logger.error({ err, deviceId: device.id }, "Fehler beim Stoppen des EventStreams für Matter-Gerät");
        // Weiter mit dem nächsten Gerät, Server soll nicht abstürzen
      }
    }
  }

  protected async handleEvent(event: MatterEvent): Promise<void> {
    const device = this.deviceManager.getDevice(event.deviceId);
    if (!device) return;

    const path = event.payload.path as { attributeName?: string } | undefined;
    const attrName = path?.attributeName;

    if (event.event === OnOff.Complete.id && attrName === "onOff") {
      const on = Boolean(event.payload.value);

      if (device.type === DeviceType.SWITCH) {
        const switchDevice = device as DeviceSwitch;
        const trigger = switchDevice.buttons?.[event.buttonId!.toString()]?.on !== on;
        if( !trigger) return;
        if (on) await switchDevice.on(event.buttonId!.toString(), false, true);
        else await switchDevice.off(event.buttonId!.toString(), false, true);
      } else if (device.type === DeviceType.SWITCH_DIMMER) {
        const switchDevice = device as DeviceSwitchDimmer;
        const trigger = switchDevice.buttons?.[event.buttonId!.toString()]?.on !== on;
        if( !trigger) return;
        if (on) await switchDevice.on(event.buttonId!.toString(), false, true);
        else await switchDevice.off(event.buttonId!.toString(), false, true);
      } else if (device.type === DeviceType.SWITCH_ENERGY) {
        const switchDevice = device as DeviceSwitchEnergy;
        const trigger = switchDevice.buttons?.[event.buttonId!.toString()]?.on !== on;
        if( !trigger) return;
        if (on) await switchDevice.on(event.buttonId!.toString(), false, true);
        else await switchDevice.off(event.buttonId!.toString(), false, true);
      }
    } else if (event.event === LevelControl.Complete.id && attrName === "currentLevel") {
      if (device.type === DeviceType.SWITCH_DIMMER) {
        const switchDevice = device as DeviceSwitchDimmer;
        const matterLevel = event.payload.value;
        if (typeof matterLevel === "number" && !Number.isNaN(matterLevel)) {
          const percent = this.controller.mapIntensityMatterLevelToPercent(matterLevel, {});
          const bid = event.buttonId!.toString();
          const trigger = switchDevice.buttons?.[bid]?.brightness !== percent;
          if( !trigger) return;
          await switchDevice.setBrightness(bid, percent, false, true);
        }
      }
    } else if (event.event === Thermostat.Complete.id) {
      if (device.type === DeviceType.THERMOSTAT) {
        const thermostatDevice = device as DeviceThermostat;
        if( attrName === "localTemperature" || attrName === "measuredValue") {
          const temperature = event.payload.value / 100;
          const trigger = thermostatDevice.temperature !== temperature;
          await thermostatDevice.setTemperature(temperature, false, trigger);
        }
        else if( attrName === "occupiedHeatingSetpoint") {
          const temperature = event.payload.value / 100;
          const trigger = thermostatDevice.temperatureGoal !== temperature;
          if( !trigger) return;
          await thermostatDevice.setTemperatureGoal(temperature, false, true);
        }
      }
    }

    this.deviceManager.saveDevice(device);
  }
}

