import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { HueBridgeDiscovered } from "./hueBridgeDiscovered.js";
import {
  BatteryStatus,
  HueDeviceController,
  LightLevelStatus,
  LightStatus,
  MotionStatus,
  TemperatureStatus,
  mirekToLightTemperaturePercent
} from "./hueDeviceController.js";
import { HueLight } from "./devices/hueLight.js";
import { HueLightDimmer } from "./devices/hueLightDimmer.js";
import { HueLightDimmerTemperature } from "./devices/hueLightDimmerTemperature.js";
import { HueLightDimmerTemperatureColor } from "./devices/hueLightDimmerTemperatureColor.js";
import { HueLightLevelSensor } from "./devices/hueLightLevelSensor.js";
import { HueTemperatureSensor } from "./devices/hueTemperatureSensor.js";
import { HueMotionSensor } from "./devices/hueMotionSensor.js";
import { HueCameraMotionSensor } from "./devices/hueCameraMotionSensor.js";
import { HueSwitchDimmer } from "./devices/hueSwitchDimmer.js";
import { HueLightLevelMotionTemperature } from "./devices/hueLightLevelMotionTemperature.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { HueDeviceDiscovered } from "./hueDeviceDiscovered.js";
import { Device } from "../../../../model/devices/Device.js";
import { HUECONFIG, HUEMODULE } from "./hueModule.js";

type HueResource = Record<string, unknown> & { id?: string; type?: string; rtype?: string };
type HueServiceRef = { rid?: string; rtype?: string };
type DeviceResource = HueResource & { services?: HueServiceRef[]; metadata?: Record<string, unknown> };

export class HueDeviceDiscover extends ModuleDeviceDiscover<HueDeviceDiscovered> {
  private hueController: HueDeviceController;

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
    this.hueController = new HueDeviceController(databaseManager);
  }

  getModuleName(): string {
    return HUEMODULE.name;
  }

  getDiscoveredDeviceTypeName(): string {
    return HUECONFIG.deviceTypeName;
  }

  getDiscoveredBridgeTypeName(): string {
    return HUECONFIG.bridgeTypeName;
  }

  protected isBridgePaired(bridge: HueBridgeDiscovered): boolean {
    return bridge.isPaired === true && !!bridge.username && !!bridge.clientKey;
  }

  public async startDiscovery(_timeoutSeconds: number): Promise<HueBridgeDiscovered[]> {
    // Diese Klasse ist nur für Device-Discovery, nicht für Bridge-Discovery
    return [];
  }

  public async stopDiscovery(): Promise<void> {
    return;
  }

  public async discoverDevices(bridgeId: string): Promise<Device[]> {
    const resources = await this.hueController.fetchAllResourcesAll(bridgeId);

    const deviceResources = resources.filter(resource => getResourceType(resource) === "device") as DeviceResource[];
    const discoveredDevices: Device[] = [];

    for (const deviceResource of deviceResources) {
      const devices = await this.convertToDevices(deviceResource, bridgeId);
      discoveredDevices.push(...devices);
    }

    return discoveredDevices;
  }

  private async convertToDevices(
    deviceObj: DeviceResource,
    bridgeId: string
  ):Promise<Device[]> {
    const devices: Device[] = [];
    const deviceProps = extractDeviceProperties(deviceObj);
    if (!deviceProps) return devices;
    const services = Array.isArray(deviceObj.services) ? deviceObj.services : [];
    const buttonRids = services
      .filter(service => service?.rtype === "button" && service?.rid)
      .map(service => service.rid as string);

    if (buttonRids.length > 0) {
      const deviceId = deviceProps.deviceId ?? deviceObj.id;
      if (deviceId) {
        const buttonDevice = await this.convertToHueButtonWithMultipleRids(
          deviceProps,
          bridgeId,
          deviceId,
          buttonRids
        );
        if (buttonDevice) {
          devices.push(buttonDevice);
        }
      }
      return devices;
    }

    // Prüfe ob das Gerät alle drei Sensoren hat (motion, light_level, temperature)
    const motionRid = services.find(s => s?.rtype === "motion" && s?.rid)?.rid as string | undefined;
    const lightLevelRid = services.find(s => s?.rtype === "light_level" && s?.rid)?.rid as string | undefined;
    const temperatureRid = services.find(s => s?.rtype === "temperature" && s?.rid)?.rid as string | undefined;

    // Wenn alle drei vorhanden sind, erstelle ein kombiniertes Gerät
    if (motionRid && lightLevelRid && temperatureRid) {
      const deviceId = deviceProps.deviceId ?? deviceObj.id;
      if (deviceId) {
        const combinedDevice = await this.convertToHueLightLevelMotionTemperature(
          deviceProps.deviceName ?? "",
          deviceId,
          bridgeId,
          motionRid,
          lightLevelRid,
          temperatureRid,
          deviceProps.ridBattery
        );
        if (combinedDevice) {
          devices.push(combinedDevice);
          return devices;
        }
      }
    }

    const skipTypes = new Set([
      "zigbee_connectivity",
      "device_software_update",
      "motion_area_candidate",
      "grouped_light",
      "device_power",
      "bridge"
    ]);

    // Ansonsten erstelle separate Geräte wie bisher
    for (const service of services) {
      const rtype = service?.rtype;
      const rid = service?.rid;
      if (!rtype || !rid || skipTypes.has(rtype)) continue;

      // Überspringe motion, light_level und temperature, wenn sie bereits im kombinierten Gerät verwendet wurden
      if ((rtype === "motion" && motionRid && lightLevelRid && temperatureRid) ||
          (rtype === "light_level" && motionRid && lightLevelRid && temperatureRid) ||
          (rtype === "temperature" && motionRid && lightLevelRid && temperatureRid)) {
        continue;
      }

      let device: Device | null = null;
      switch (rtype) {
        case "motion":
          device = await this.convertToHueMotionSensor(deviceProps.deviceName ?? "", deviceProps.deviceId ?? "", bridgeId, rid, deviceProps.ridBattery);
          break;
        case "camera_motion":
          device = await this.convertToHueCameraMotionSensor(deviceProps.deviceName ?? "", deviceProps.deviceId ?? "", bridgeId, rid, deviceProps.ridBattery);
          break;
        case "light_level":
          device = await this.convertToHueLightLevelSensor(deviceProps.deviceName ?? "", deviceProps.deviceId ?? "", bridgeId, rid, deviceProps.ridBattery);
          break;
        case "temperature":
          device = await this.convertToHueTemperatureSensor(deviceProps.deviceName ?? "", deviceProps.deviceId ?? "", bridgeId, rid, deviceProps.ridBattery);
          break;
        case "light":
          device = await this.convertToHueLight(deviceProps.deviceName ?? "", deviceProps.deviceId ?? "", bridgeId, rid, deviceProps.ridBattery);
          break;
        default:
          break;
      }
      if (device) devices.push(device);
    };

    return devices;
  }

  private async convertToHueLight(
    deviceName: string,
    deviceId: string,
    bridgeId: string,
    lightRid: string,
    batteryRid?: string,
  ):Promise<HueLight | HueLightDimmer | HueLightDimmerTemperature | HueLightDimmerTemperatureColor | null> {
    
    const hueDeviceId = `hue-${bridgeId}-${deviceId}`;
   
    // Lade Light-Daten
    const lightStatus: LightStatus | null = await this.hueController.getLight(bridgeId, lightRid);
    if (!lightStatus) return null;
    const on = lightStatus.on;
    const brightness = lightStatus.brightness;
    const colorX = lightStatus.colorX;
    const colorY = lightStatus.colorY;
    const colorTemperature = lightStatus.colorTemperature;

    let device: HueLight | HueLightDimmer | HueLightDimmerTemperature | HueLightDimmerTemperatureColor;

    if (brightness !== undefined && colorTemperature === undefined && (colorX === undefined || colorY === undefined)) {
      device = new HueLightDimmer(
        deviceName,
        hueDeviceId,
        bridgeId,
        lightRid,
        batteryRid,
        this.hueController
      );
      device.setBrightness(brightness, false, false);
    } else if (brightness !== undefined && colorTemperature !== undefined && (colorX === undefined || colorY === undefined)) {
      device = new HueLightDimmerTemperature(
        deviceName,
        hueDeviceId,
        bridgeId,
        lightRid,
        batteryRid,
        this.hueController
      );
      device.setBrightness(brightness, false, false);
      device.setTemperature(mirekToLightTemperaturePercent(colorTemperature), false, false);
    } else if (brightness !== undefined && colorX !== undefined && colorY !== undefined) {
      device = new HueLightDimmerTemperatureColor(
        deviceName,
        hueDeviceId,
        bridgeId,
        lightRid,
        batteryRid,
        this.hueController
      );
      device.setBrightness(brightness, false, false);
      if (colorTemperature) {
        device.setTemperature(mirekToLightTemperaturePercent(colorTemperature), false, false);
      }
      device.setColor(colorX, colorY, false, false);
    } else {
      device = new HueLight(
        deviceName,
        hueDeviceId,
        bridgeId,
        lightRid,
        batteryRid,
        this.hueController
      );
    }

    if(on) device.setOn(false, false); else device.setOff(false, false);


    if( batteryRid ) {
      const batteryStatus: BatteryStatus | null = await this.hueController.getBattery(bridgeId, batteryRid);
      if ( batteryStatus ) {
        const batteryLevel = batteryStatus.batteryLevel;
        if (batteryLevel) {
          device.hasBattery = true;
          device.batteryLevel = batteryLevel;
        } else {
          device.hasBattery = false;
        }
      }
    }
    return device;
  }

  private async convertToHueMotionSensor(
    deviceName: string,
    deviceId: string,
    bridgeId: string,
    motionRid: string,
    batteryRid?: string,
  ):Promise<HueMotionSensor | null> {
    const hueDeviceId = `hue-${bridgeId}-${deviceId}`;
    const sensor = new HueMotionSensor(
      deviceName,
      hueDeviceId,
      bridgeId,
      motionRid,
      batteryRid,
      this.hueController
    );

    // Lade Motion-Daten
    const motionStatus: MotionStatus | null = await this.hueController.getMotion(bridgeId, motionRid);
    if (motionStatus) {
      const motion = motionStatus.motion;
      const changed = motionStatus.lastChanged;
      if (motion && changed) {
        sensor.setMotion(motion, changed, false);
      }
      const sensitivity = motionStatus.sensitivity;
      if (sensitivity) {
        sensor.setSensibility(sensitivity, false);
      }
    } else {
      return null;
    }

    if( batteryRid ) {
      const batteryStatus: BatteryStatus | null = await this.hueController.getBattery(bridgeId, batteryRid);
      if ( batteryStatus ) {
        const batteryLevel = batteryStatus.batteryLevel;
        if (batteryLevel) {
          sensor.hasBattery = true;
          sensor.batteryLevel = batteryLevel;
        } else {
          sensor.hasBattery = false;
        }
      }
    }
    
    return sensor;
  }

  private async convertToHueCameraMotionSensor(
    deviceName: string,
    deviceId: string,
    bridgeId: string,
    motionRid: string,
    batteryRid?: string,
  ):Promise<HueCameraMotionSensor | null> {
    const hueDeviceId = `hue-${bridgeId}-${deviceId}`;
    const sensor = new HueCameraMotionSensor(
      deviceName,
      hueDeviceId,
      bridgeId,
      motionRid,
      batteryRid,
      this.hueController
    );

    // Lade Motion-Daten
    const motionStatus: MotionStatus | null = await this.hueController.getMotion(bridgeId, motionRid);
    if (motionStatus) {
      const motion = motionStatus.motion;
      const changed = motionStatus.lastChanged;
      if (motion && changed) {
        sensor.setMotion(motion, changed, false);
      }
      const sensitivity = motionStatus.sensitivity;
      if (sensitivity) {
        sensor.setSensibility(sensitivity, false);
      }
    } else {
      return null;
    }

    if( batteryRid ) {
      const batteryStatus: BatteryStatus | null = await this.hueController.getBattery(bridgeId, batteryRid);
      if ( batteryStatus ) {
        const batteryLevel = batteryStatus.batteryLevel;
        if (batteryLevel) {
          sensor.hasBattery = true;
          sensor.batteryLevel = batteryLevel;
        } else {
          sensor.hasBattery = false;
        }
      }
    }
    
    return sensor;
  }

  private async convertToHueLightLevelSensor(
    deviceName: string,
    deviceId: string,
    bridgeId: string,
    lightLevelRid: string,
    batteryRid?: string,
  ):Promise<HueLightLevelSensor | null> {
    const hueDeviceId = `hue-${bridgeId}-${deviceId}`;
    const sensor = new HueLightLevelSensor(
      deviceName,
      hueDeviceId,
      bridgeId,
      lightLevelRid,
      batteryRid,
      this.hueController
    );

    // Lade Light Level-Daten
    const lightLevelStatus: LightLevelStatus | null = await this.hueController.getLightLevel(bridgeId, lightLevelRid);
    if (lightLevelStatus) {
      const lightLevel = lightLevelStatus.lightLevel;
      if (lightLevel) {
        sensor.setLightLevel(lightLevel, false);
      }
    } else {
      return null;
    }

    if( batteryRid ) {
      const batteryStatus: BatteryStatus | null = await this.hueController.getBattery(bridgeId, batteryRid);
      if ( batteryStatus ) {
        const batteryLevel = batteryStatus.batteryLevel;
        if (batteryLevel) {
          sensor.hasBattery = true;
          sensor.batteryLevel = batteryLevel;
        } else {
          sensor.hasBattery = false;
        }
      }
    }
    
    return sensor;
  }

  private async convertToHueTemperatureSensor(
    deviceName: string,
    deviceId: string,
    bridgeId: string,
    temperatureRid: string,
    batteryRid?: string,
  ):Promise<HueTemperatureSensor | null> {
    const hueDeviceId = `hue-${bridgeId}-${deviceId}`;
    const sensor = new HueTemperatureSensor(
      deviceName,
      hueDeviceId,
      bridgeId,
      temperatureRid,
      batteryRid,
      this.hueController
    );

    // Lade Temperature-Daten
    const temperatureStatus: TemperatureStatus | null = await this.hueController.getTemperature(bridgeId, temperatureRid);
    if (temperatureStatus) {
      const temperature = temperatureStatus.temperature;
      if (temperature) {
        sensor.setTemperature(temperature, false);
      }
    } else {
      return null;
    }

    if( batteryRid ) {
      const batteryStatus: BatteryStatus | null = await this.hueController.getBattery(bridgeId, batteryRid);
      if ( batteryStatus ) {
        const batteryLevel = batteryStatus.batteryLevel;
        if (batteryLevel) {
          sensor.hasBattery = true;
          sensor.batteryLevel = batteryLevel;
        } else {
          sensor.hasBattery = false;
        }
      }
    }
    return sensor;
  }

  private async convertToHueLightLevelMotionTemperature(
    deviceName: string,
    deviceId: string,
    bridgeId: string,
    motionRid: string,
    lightLevelRid: string,
    temperatureRid: string,
    batteryRid?: string,
  ):Promise<HueLightLevelMotionTemperature | null> {
    const hueDeviceId = `hue-${bridgeId}-${deviceId}`;
    const sensor = new HueLightLevelMotionTemperature(
      deviceName,
      hueDeviceId,
      bridgeId,
      motionRid,
      lightLevelRid,
      temperatureRid,
      batteryRid,
      this.hueController
    );

    // Lade Motion-Daten
    const motionStatus: MotionStatus | null = await this.hueController.getMotion(bridgeId, motionRid);
    if (motionStatus) {
      const motion = motionStatus.motion;
      const changed = motionStatus.lastChanged;
      if (motion !== undefined && changed !== undefined) {
        sensor.setMotion(motion, changed, false);
      }
      const sensitivity = motionStatus.sensitivity;
      if (sensitivity !== undefined) {
        sensor.setSensibility(sensitivity, false);
      }
    } else {
      return null;
    }

    // Lade Light Level-Daten
    const lightLevelStatus: LightLevelStatus | null = await this.hueController.getLightLevel(bridgeId, lightLevelRid);
    if (lightLevelStatus) {
      const lightLevel = lightLevelStatus.lightLevel;
      if (lightLevel !== undefined) {
        sensor.setLightLevel(lightLevel, false);
      }
    } 

    // Lade Temperature-Daten
    const temperatureStatus: TemperatureStatus | null = await this.hueController.getTemperature(bridgeId, temperatureRid);
    if (temperatureStatus) {
      const temperature = temperatureStatus.temperature;
      if (temperature !== undefined) {
        sensor.setTemperature(temperature, false);
      }
    } 

    if( batteryRid ) {
      const batteryStatus: BatteryStatus | null = await this.hueController.getBattery(bridgeId, batteryRid);
      if ( batteryStatus ) {
        const batteryLevel = batteryStatus.batteryLevel;
        if (batteryLevel !== undefined) {
          sensor.hasBattery = true;
          sensor.batteryLevel = batteryLevel;
        } else {
          sensor.hasBattery = false;
        }
      }
    }
    
    return sensor;
  }

  private async convertToHueButtonWithMultipleRids(
    deviceProps: DeviceProperties,
    bridgeId: string,
    deviceId: string,
    buttonRids: string[],
    batteryRid?: string,
  ):Promise<HueSwitchDimmer | null> {
    const hueDeviceId = `hue-${bridgeId}-${deviceId}`;
    const device = new HueSwitchDimmer(
      deviceProps.deviceName,
      hueDeviceId,
      bridgeId,
      buttonRids,
      batteryRid,
      this.hueController
    );

    if( batteryRid ) {
      const batteryStatus: BatteryStatus | null = await this.hueController.getBattery(bridgeId, batteryRid);
      if ( batteryStatus ) {
        const batteryLevel = batteryStatus.batteryLevel;
        if (batteryLevel) {
          device.hasBattery = true;
          device.batteryLevel = batteryLevel;
        } else {
          device.hasBattery = false;
        }
      }
    }
    return device;
  }
}

type DeviceProperties = {
  deviceId?: string;
  deviceName?: string;
  archetype?: string;
  productName?: string;
  manufacturerName?: string;
  modelId?: string;
  ridBattery?: string;
};

function extractDeviceProperties(deviceObj: DeviceResource): DeviceProperties | null {
  try {
    const deviceId = typeof deviceObj.id === "string" ? deviceObj.id : undefined;
    const metadata = (deviceObj.metadata ?? {}) as Record<string, unknown>;
    const deviceName = typeof metadata.name === "string" ? metadata.name : undefined;
    const archetype = typeof metadata.archetype === "string" ? metadata.archetype : undefined;
    const productData = (deviceObj.product_data ?? {}) as Record<string, unknown>;
    const productName = typeof productData.product_name === "string" ? productData.product_name : undefined;
    const manufacturerName =
      typeof productData.manufacturer_name === "string" ? productData.manufacturer_name : undefined;
    const modelId = typeof productData.model_id === "string" ? productData.model_id : undefined;

    let ridBattery: string | undefined;
    const services = Array.isArray(deviceObj.services) ? deviceObj.services : [];
    services.forEach(service => {
      if (service?.rtype === "device_power" && service?.rid) {
        ridBattery = service.rid;
      }
    });

    return {
      deviceId,
      deviceName: deviceName ?? deviceId ?? "Hue Device",
      archetype,
      productName,
      manufacturerName,
      modelId,
      ridBattery
    };
  } catch (err) {
    logger.warn({ err }, "Fehler beim Extrahieren der Device-Eigenschaften");
    return null;
  }
}

function getResourceType(resource: HueResource) {
  return (resource.type ?? resource.rtype) as string | undefined;
}

