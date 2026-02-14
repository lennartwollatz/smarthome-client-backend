import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { HueBridgeDiscovered } from "./hueBridgeDiscovered.js";
import { HueDeviceController } from "./hueDeviceController.js";
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
    return "Hue";
  }

  getDiscoveredDeviceTypeName(): string {
    return "HueBridgeDiscovered";
  }

  getDiscoveredBridgeTypeName(): string {
    return "HueBridgeDiscovered";
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

  public async discoverDevices(bridgeId: string): Promise<Array<Record<string, unknown> & { id?: string }>> {
    const resources = await this.hueController.fetchAllResourcesAll(bridgeId);
    const resourceMap = new Map<string, HueResource>();
    resources.forEach(resource => {
      if (resource.id) {
        resourceMap.set(resource.id, resource);
      }
    });

    const deviceResources = resources.filter(resource => getResourceType(resource) === "device") as DeviceResource[];
    const discoveredDevices: Array<Record<string, unknown> & { id?: string }> = [];
    const deviceIds: string[] = [];

    deviceResources.forEach(deviceResource => {
      const devices = this.convertToDevices(deviceResource, bridgeId, resourceMap);
      devices.forEach(device => {
        if (device.id) deviceIds.push(device.id);
        discoveredDevices.push(device);
      });
    });

    return discoveredDevices;
  }

  private convertToDevices(
    deviceObj: DeviceResource,
    bridgeId: string,
    resourceMap: Map<string, HueResource>
  ) {
    const devices: Array<Record<string, unknown> & { id?: string }> = [];
    const deviceProps = extractDeviceProperties(deviceObj);
    if (!deviceProps) return devices;
    const services = Array.isArray(deviceObj.services) ? deviceObj.services : [];
    const buttonRids = services
      .filter(service => service?.rtype === "button" && service?.rid)
      .map(service => service.rid as string);

    if (buttonRids.length > 0) {
      const deviceId = deviceProps.deviceId ?? deviceObj.id;
      if (deviceId) {
        const buttonDevice = this.convertToHueButtonWithMultipleRids(
          deviceProps,
          bridgeId,
          deviceId,
          buttonRids
        );
        if (buttonDevice) devices.push(buttonDevice);
      }
      return devices;
    }

    const skipTypes = new Set([
      "zigbee_connectivity",
      "device_software_update",
      "motion_area_candidate",
      "grouped_light",
      "device_power",
      "bridge"
    ]);

    // Prüfe ob das Gerät alle drei Sensoren hat (motion, light_level, temperature)
    const motionRid = services.find(s => s?.rtype === "motion" && s?.rid)?.rid as string | undefined;
    const lightLevelRid = services.find(s => s?.rtype === "light_level" && s?.rid)?.rid as string | undefined;
    const temperatureRid = services.find(s => s?.rtype === "temperature" && s?.rid)?.rid as string | undefined;

    // Wenn alle drei vorhanden sind, erstelle ein kombiniertes Gerät
    if (motionRid && lightLevelRid && temperatureRid) {
      const deviceId = deviceProps.deviceId ?? deviceObj.id;
      if (deviceId) {
        const combinedDevice = this.convertToHueLightLevelMotionTemperature(
          deviceObj,
          deviceProps,
          bridgeId,
          deviceId,
          motionRid,
          lightLevelRid,
          temperatureRid,
          resourceMap
        );
        if (combinedDevice) {
          devices.push(combinedDevice);
          return devices;
        }
      }
    }

    // Ansonsten erstelle separate Geräte wie bisher
    services.forEach(service => {
      const rtype = service?.rtype;
      const rid = service?.rid;
      if (!rtype || !rid || skipTypes.has(rtype)) return;

      // Überspringe motion, light_level und temperature, wenn sie bereits im kombinierten Gerät verwendet wurden
      if ((rtype === "motion" && motionRid && lightLevelRid && temperatureRid) ||
          (rtype === "light_level" && motionRid && lightLevelRid && temperatureRid) ||
          (rtype === "temperature" && motionRid && lightLevelRid && temperatureRid)) {
        return;
      }

      let device: Record<string, unknown> & { id?: string } | null = null;
      switch (rtype) {
        case "motion":
          device = this.convertToHueMotionSensor(deviceObj, deviceProps, bridgeId, rid, resourceMap);
          break;
        case "camera_motion":
          device = this.convertToHueCameraMotionSensor(deviceObj, deviceProps, bridgeId, rid, resourceMap);
          break;
        case "light_level":
          device = this.convertToHueLightLevelSensor(deviceObj, deviceProps, bridgeId, rid, resourceMap);
          break;
        case "temperature":
          device = this.convertToHueTemperatureSensor(deviceObj, deviceProps, bridgeId, rid, resourceMap);
          break;
        case "light":
          device = this.convertToHueLight(deviceObj, deviceProps, bridgeId, rid, resourceMap);
          break;
        default:
          break;
      }
      if (device) devices.push(device);
    });

    return devices;
  }

  private applyBattery(device: Record<string, unknown>, batteryLevel: number | null | undefined) {
    if (batteryLevel == null) {
      device.hasBattery = false;
      return;
    }
    device.hasBattery = true;
    device.batteryLevel = batteryLevel;
  }

  private getBatteryLevel(ridBattery: string | undefined, resourceMap: Map<string, HueResource>) {
    if (!ridBattery) return null;
    const resource = resourceMap.get(ridBattery);
    if (!resource) return null;
    const powerState = (resource.power_state as Record<string, unknown> | undefined) ?? {};
    const batteryLevel =
      (powerState.battery_level as number | undefined) ??
      (resource.battery_level as number | undefined);
    return typeof batteryLevel === "number" ? batteryLevel : null;
  }

  private convertToHueLight(
    lightObj: HueResource,
    deviceProps: DeviceProperties,
    bridgeId: string,
    rid: string,
    resourceMap: Map<string, HueResource>
  ) {
    const on = Boolean((lightObj.on as Record<string, unknown> | undefined)?.on);
    const brightness = (lightObj.dimming as Record<string, unknown> | undefined)?.brightness as
      | number
      | undefined;
    const colorTemperature = (lightObj.color_temperature as Record<string, unknown> | undefined)
      ?.mirek as number | undefined;
    const xy = (lightObj.color as Record<string, unknown> | undefined)?.xy as
      | Record<string, unknown>
      | undefined;
    const colorX = typeof xy?.x === "number" ? Math.round((xy.x as number) * 1000) / 1000 : null;
    const colorY = typeof xy?.y === "number" ? Math.round((xy.y as number) * 1000) / 1000 : null;

    const deviceId = `hue-light-${rid}`;
    let device:
      | HueLight
      | HueLightDimmer
      | HueLightDimmerTemperature
      | HueLightDimmerTemperatureColor;

    if (brightness == null && colorTemperature == null && (colorX == null || colorY == null)) {
      device = new HueLight(deviceProps.deviceName, deviceId, bridgeId, rid, deviceProps.ridBattery);
    } else if (brightness != null && colorTemperature == null && (colorX == null || colorY == null)) {
      device = new HueLightDimmer(deviceProps.deviceName, deviceId, bridgeId, rid, deviceProps.ridBattery);
      device.setBrightness(brightness, false);
    } else if (brightness != null && colorTemperature != null && (colorX == null || colorY == null)) {
      device = new HueLightDimmerTemperature(
        deviceProps.deviceName,
        deviceId,
        bridgeId,
        rid,
        deviceProps.ridBattery
      );
      device.setBrightness(brightness, false);
      device.setTemperature(colorTemperature, false);
    } else if (brightness != null && colorX != null && colorY != null) {
      device = new HueLightDimmerTemperatureColor(
        deviceProps.deviceName,
        deviceId,
        bridgeId,
        rid,
        deviceProps.ridBattery
      );
      device.setBrightness(brightness, false);
      if (colorTemperature != null) {
        device.setTemperature(colorTemperature, false);
      }
      device.setColor(colorX, colorY, false);
    } else {
      device = new HueLightDimmer(deviceProps.deviceName, deviceId, bridgeId, rid, deviceProps.ridBattery);
      if (brightness != null) {
        device.setBrightness(brightness, false);
      }
    }

    if (on) {
      device.setOn(false);
    } else {
      device.setOff(false);
    }
    device.setHueDeviceController(this.hueController);
    this.applyBattery(device as unknown as Record<string, unknown>, this.getBatteryLevel(deviceProps.ridBattery, resourceMap));
    return device as unknown as Record<string, unknown> & { id?: string };
  }

  private convertToHueMotionSensor(
    motionObj: HueResource,
    deviceProps: DeviceProperties,
    bridgeId: string,
    rid: string,
    resourceMap: Map<string, HueResource>
  ) {
    const deviceId = `hue-motion-${rid}`;
    const sensor = new HueMotionSensor(
      deviceProps.deviceName,
      deviceId,
      bridgeId,
      rid,
      deviceProps.ridBattery,
      this.hueController
    );

    const motionReport = (motionObj.motion as Record<string, unknown> | undefined)
      ?.motion_report as Record<string, unknown> | undefined;
    const motion = motionReport?.motion as boolean | undefined;
    const changed = motionReport?.changed as string | undefined;
    if (typeof motion === "boolean" && changed) {
      sensor.setMotion(motion, changed, false);
    }
    const sensitivity = (motionObj.sensitivity as Record<string, unknown> | undefined)?.sensitivity as
      | number
      | undefined;
    if (typeof sensitivity === "number") {
      sensor.setSensibility(sensitivity, false);
    }
    this.applyBattery(sensor as unknown as Record<string, unknown>, this.getBatteryLevel(deviceProps.ridBattery, resourceMap));
    return sensor as unknown as Record<string, unknown> & { id?: string };
  }

  private convertToHueCameraMotionSensor(
    motionObj: HueResource,
    deviceProps: DeviceProperties,
    bridgeId: string,
    rid: string,
    resourceMap: Map<string, HueResource>
  ) {
    const deviceId = `hue-camera-motion-${rid}`;
    const sensor = new HueCameraMotionSensor(
      deviceProps.deviceName,
      deviceId,
      bridgeId,
      rid,
      deviceProps.ridBattery,
      this.hueController
    );

    const motionReport = (motionObj.motion as Record<string, unknown> | undefined)
      ?.motion_report as Record<string, unknown> | undefined;
    const motion = motionReport?.motion as boolean | undefined;
    const changed = motionReport?.changed as string | undefined;
    if (typeof motion === "boolean" && changed) {
      sensor.setMotion(motion, changed, false);
    }
    const sensitivity = (motionObj.sensitivity as Record<string, unknown> | undefined)?.sensitivity as
      | number
      | undefined;
    if (typeof sensitivity === "number") {
      sensor.setSensibility(sensitivity, false);
    }
    this.applyBattery(sensor as unknown as Record<string, unknown>, this.getBatteryLevel(deviceProps.ridBattery, resourceMap));
    return sensor as unknown as Record<string, unknown> & { id?: string };
  }

  private convertToHueLightLevelSensor(
    lightLevelObj: HueResource,
    deviceProps: DeviceProperties,
    bridgeId: string,
    rid: string,
    resourceMap: Map<string, HueResource>
  ) {
    const deviceId = `hue-light-level-${rid}`;
    const sensor = new HueLightLevelSensor(
      deviceProps.deviceName,
      deviceId,
      bridgeId,
      rid,
      deviceProps.ridBattery,
      this.hueController
    );
    const level = (lightLevelObj.light as Record<string, unknown> | undefined)
      ?.light_level_report as Record<string, unknown> | undefined;
    const lightValue = level?.light_level as number | undefined;
    if (typeof lightValue === "number") {
      sensor.setLightLevel(lightValue, false);
    }
    this.applyBattery(sensor as unknown as Record<string, unknown>, this.getBatteryLevel(deviceProps.ridBattery, resourceMap));
    return sensor as unknown as Record<string, unknown> & { id?: string };
  }

  private convertToHueTemperatureSensor(
    temperatureObj: HueResource,
    deviceProps: DeviceProperties,
    bridgeId: string,
    rid: string,
    resourceMap: Map<string, HueResource>
  ) {
    const deviceId = `hue-temperature-${rid}`;
    const sensor = new HueTemperatureSensor(
      deviceProps.deviceName,
      deviceId,
      bridgeId,
      rid,
      deviceProps.ridBattery,
      this.hueController
    );
    const report = (temperatureObj.temperature as Record<string, unknown> | undefined)
      ?.temperature_report as Record<string, unknown> | undefined;
    const temperature = report?.temperature as number | undefined;
    if (typeof temperature === "number") {
      sensor.setTemperature(temperature, false);
    }
    this.applyBattery(sensor as unknown as Record<string, unknown>, this.getBatteryLevel(deviceProps.ridBattery, resourceMap));
    return sensor as unknown as Record<string, unknown> & { id?: string };
  }

  private convertToHueLightLevelMotionTemperature(
    deviceObj: DeviceResource,
    deviceProps: DeviceProperties,
    bridgeId: string,
    deviceId: string,
    motionRid: string,
    lightLevelRid: string,
    temperatureRid: string,
    resourceMap: Map<string, HueResource>
  ) {
    const hueDeviceId = `hue-light-level-motion-temperature-${deviceId}`;
    const sensor = new HueLightLevelMotionTemperature(
      deviceProps.deviceName,
      hueDeviceId,
      bridgeId,
      motionRid,
      lightLevelRid,
      temperatureRid,
      deviceProps.ridBattery,
      this.hueController
    );

    // Lade Motion-Daten
    const motionResource = resourceMap.get(motionRid);
    if (motionResource) {
      const motionReport = (motionResource.motion as Record<string, unknown> | undefined)
        ?.motion_report as Record<string, unknown> | undefined;
      const motion = motionReport?.motion as boolean | undefined;
      const changed = motionReport?.changed as string | undefined;
      if (typeof motion === "boolean" && changed) {
        sensor.setMotion(motion, changed, false);
      }
      const sensitivity = (motionResource.sensitivity as Record<string, unknown> | undefined)?.sensitivity as
        | number
        | undefined;
      if (typeof sensitivity === "number") {
        sensor.setSensibility(sensitivity, false);
      }
    }

    // Lade Light Level-Daten
    const lightLevelResource = resourceMap.get(lightLevelRid);
    if (lightLevelResource) {
      const level = (lightLevelResource.light as Record<string, unknown> | undefined)
        ?.light_level_report as Record<string, unknown> | undefined;
      const lightValue = level?.light_level as number | undefined;
      if (typeof lightValue === "number") {
        sensor.setLightLevel(lightValue, false);
      }
    }

    // Lade Temperature-Daten
    const temperatureResource = resourceMap.get(temperatureRid);
    if (temperatureResource) {
      const report = (temperatureResource.temperature as Record<string, unknown> | undefined)
        ?.temperature_report as Record<string, unknown> | undefined;
      const temperature = report?.temperature as number | undefined;
      if (typeof temperature === "number") {
        sensor.setTemperature(temperature, false);
      }
    }

    this.applyBattery(sensor as unknown as Record<string, unknown>, this.getBatteryLevel(deviceProps.ridBattery, resourceMap));
    sensor.setHueDeviceController(this.hueController);
    
    // Stelle sicher, dass die Resource IDs im Device-Objekt gespeichert werden
    const deviceRecord = sensor as unknown as Record<string, unknown> & { id?: string };
    deviceRecord.bridgeId = bridgeId;
    deviceRecord.motionRid = motionRid;
    deviceRecord.lightLevelRid = lightLevelRid;
    deviceRecord.temperatureRid = temperatureRid;
    deviceRecord.batteryRid = deviceProps.ridBattery;
    
    return deviceRecord;
  }

  private convertToHueButtonWithMultipleRids(
    deviceProps: DeviceProperties,
    bridgeId: string,
    deviceId: string,
    buttonRids: string[]
  ) {
    const hueDeviceId = `hue-button-${deviceId}`;
    const device = new HueSwitchDimmer(
      deviceProps.deviceName,
      hueDeviceId,
      bridgeId,
      buttonRids,
      deviceProps.ridBattery,
      this.hueController
    );
    this.applyBattery(device as unknown as Record<string, unknown>, null);
    return device as unknown as Record<string, unknown> & { id?: string };
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

