import { MatterEvent } from "./matterEvent.js";
import { Device } from "../../../../model/devices/Device.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";
import { MatterDevice, MatterDeviceButtoned, MatterDeviceTemperture } from "./devices/matterDevice.js";

import { Environment, Logger, LogLevel, StorageService } from "@matter/main";
import { OnOffClient } from "@matter/main/behaviors/on-off";
import { GeneralCommissioning, LevelControl, OnOff, TemperatureMeasurement, Thermostat } from "@matter/main/clusters";
import { ManualPairingCodeCodec, NodeId } from "@matter/main/types";
import { CommissioningController, NodeCommissioningOptions } from "@project-chip/matter.js";
import { PairedNode } from "@project-chip/matter.js/device";
import { DatabaseManager } from "../../../db/database.js";
import { MatterDeviceDiscovered } from "./matterDeviceDiscovered.js";
import { PairingPayload } from "./matterModuleManager.js";
import { MatterSwitch } from "./devices/matterSwitch.js";

import "@matter/nodejs-ble";
import { LevelControlClient } from "@matter/main/behaviors/level-control";
import { CommissionableDevice } from "@matter/main/protocol";
import { TemperatureSchedule, TemperatureScheduleTimeRange } from "../../../../model/devices/DeviceThermostat.js";
import { ThermostatClient } from "@matter/main/behaviors/thermostat";

const logger = Logger.get("MatterDeviceController");
/** Matter.js-Stack (CommissioningController, Protokoll, …): INFO/DEBUG sonst sehr gesprächig */
Logger.level = LogLevel.NOTICE;
const environment = Environment.default;
const storageService = environment.get(StorageService);
const environmentId = "1668012345678";
const adminFabricLabel = "smarthome-backend";
const controllerId = "controller-2";
const MATTER_ID_MAX = 0xfffe;

function sanitizeMatterIdText(value: string | undefined): string {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return "0";
  const intValue = Math.trunc(parsed);
  const clamped = Math.max(0, Math.min(MATTER_ID_MAX, intValue));
  if (clamped !== intValue) {
    logger.warn(
      { raw: value, sanitized: String(clamped), max: MATTER_ID_MAX },
      "Matter Vendor/Product ID außerhalb Bereich 0..0xFFFE; Wert wurde begrenzt"
    );
  }
  return String(clamped);
}

export class MatterDeviceController extends ModuleDeviceControllerEvent<MatterEvent, Device> {
  /**
   * Virtuelle OnOff-Matter-Server (Host/Sprach-Stub): OnOff-Attribut im Stack setzen, sonst bleibt z. B. Apple Home ungueltig.
   */
  private virtualOnOffHandler: ((deviceId: string, isOn: boolean) => Promise<void>) | null = null;

  setVirtualOnOffHandler(handler: (deviceId: string, isOn: boolean) => Promise<void>): void {
    this.virtualOnOffHandler = handler;
  }

  private isVirtualMatterServerDevice(d: Device): boolean {
    return d.type === DeviceType.VIRTUAL || d.type === DeviceType.SPEECH_ASSISTANT;
  }

  private commissioningController: CommissioningController | null = null;
  private commissioningControllerStarted = false;
  /** Mutex: Verhindert Race Conditions bei parallelen Aufrufen von getCommissioningController */
  private initControllerPromise: Promise<CommissioningController | null> | null = null;
  /** Pro Gerät: Abmeldung vom Matter-Observable (verhindert doppelte Callbacks bei erneutem startEventStream) */
  private matterAttributeStreamDisposers = new Map<string, () => void>();
  /** Gemeinsamer Stream-Callback (ModuleEventStreamManager); für lokale Kommandos ohne Device-Report */
  private matterAttributeStreamCallback: ((event: MatterEvent) => void) | null = null;

  constructor(databaseManager: DatabaseManager) {
    super();
  }

  /**
   * Scannt gezielt nach kommissionierbaren Matter-Geräten.
   * Hinweis: Der Methodenname bleibt bewusst wie angefordert (`Commssionable`).
   */
  async scanForCommssionableDevices(payload: PairingPayload): Promise<MatterDeviceDiscovered[]> {
    this.commissioningController = await this.getCommissioningController();
    if( !this.commissioningController) return [];

    const pairingCode = payload.pairingCode;
    let longDiscriminator, setupPin, shortDiscriminator;
    if (pairingCode !== undefined) {
        const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
        shortDiscriminator = pairingCodeCodec.shortDiscriminator;
        longDiscriminator = undefined;
        setupPin = pairingCodeCodec.passcode;
    } else {
        return [];
    }

    const devices: MatterDeviceDiscovered[] = [];

    this.commissioningController.discoverCommissionableDevices({
      shortDiscriminator: shortDiscriminator,
      passcode: setupPin,
    }, {
      ble: true,
    }, (d:CommissionableDevice) => {

      const deviceinfo = this.getDeviceInfo(d.VP ?? "");
      devices.push(new MatterDeviceDiscovered({
        id: d.deviceIdentifier,
        name: d.DN ?? "Thread Gerät",
        address: (d.addresses?.[0] as any)?.ip ?? "",
        port: (d.addresses?.[0] as any)?.port ?? 5540,
        vendorId: deviceinfo.vendorId,
        productId: deviceinfo.productId,
        discriminator: d.D,
        rotatingId: d.RI,
        isCommissionable: true,
        isOperational: false
      }));
    });	

    // 5 Sekunden aktiv suchen und den Ablauf bis dahin blockieren
    await new Promise(resolve => setTimeout(resolve, 5000));
    this.commissioningController.cancelCommissionableDeviceDiscovery({
      shortDiscriminator: shortDiscriminator,
      passcode: setupPin,
    }, {
      ble: true,
    });

    return devices;
  }

  private getDeviceInfo(vendorProduct: string): { vendorId: string, productId: string } {
    const [vendorId, productId] = vendorProduct.split("+");
    return {
      vendorId: sanitizeMatterIdText(vendorId),
      productId: sanitizeMatterIdText(productId),
    };
  }

  async pairDevice(device: MatterDeviceDiscovered, payload: PairingPayload): Promise<MatterDeviceDiscovered | null> {
    const ip = device.address;
    const port = device.port ?? 5540;

    this.commissioningController = await this.getCommissioningController();
    if( !this.commissioningController) return null;

    const pairingCode = payload.pairingCode;
    let longDiscriminator, setupPin, shortDiscriminator;
    if (pairingCode !== undefined) {
        const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
        shortDiscriminator = pairingCodeCodec.shortDiscriminator;
        longDiscriminator = undefined;
        setupPin = pairingCodeCodec.passcode;
    } else {
        return null;
    }

    // Collect commissioning options from commandline parameters
    const commissioningOptions: NodeCommissioningOptions["commissioning"] = {
        regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
        regulatoryCountryCode: "XX",
    };

    // When we do not have a commissioned node, we need to commission the device provided by CLI parameters
    if (this.commissioningControllerStarted) {
        const options: NodeCommissioningOptions = {
            commissioning: commissioningOptions,
            discovery: {
                knownAddress: ip !== undefined && port !== undefined ? { ip, port, type: "udp" } : undefined,
                identifierData:
                    longDiscriminator !== undefined
                        ? { longDiscriminator }
                        : shortDiscriminator !== undefined
                          ? { shortDiscriminator }
                          : {},
                discoveryCapabilities: {
                    ble: false,
                },
            },
            passcode: setupPin,
        };
        const nodeId = await this.commissioningController.commissionNode(options);
        // After commissioning or if we have a commissioned node we can connect to it
        try {
          const node = await this.getNode(nodeId);

          if (!node) {
              return null;
          }

          device.nodeId = String(nodeId);
          device.isPaired = true;
          device.isCommissionable = false;
          device.isOperational = true;
          device.pairedAt = Date.now();
          return device

        } catch (err) {
          console.error("Error getting node:", err);
          return null;
        }
    }
    return null;
  }

  async unpairDevice(device: MatterDevice): Promise<boolean> {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if( !node) return false;
    await node.decommission();
    return true;
  }

  /**
   * Commissioniert ein Matter-Gerät ausschließlich über den Pairing-Code (ohne bekannte IP/Port).
   * Nutzt Discovery (mDNS/BLE je nach Plattform) basierend auf shortDiscriminator + passcode.
   *
   * Beispiel:
   *   const result = await controller.pairDeviceByCode("1234-5678");
   */
  async pairDeviceByCode(payload: PairingPayload): Promise<MatterDeviceDiscovered | null> {
    const devices = await this.scanForCommssionableDevices(payload);
    if( devices.length === 0) return null;
    const device = devices[0];
    return this.pairDevice(device, payload);
  }

  async getButtonsForDevice(device: MatterDeviceDiscovered): Promise<string[]> {
    if( !device.nodeId) return [];
    const node = await this.getNode(NodeId(device.nodeId));
    if( !node) return [];
    const buttons = node.getDevices();
    if (buttons.length === 0) {
      logger.warn({ nodeId: device.nodeId }, "Keine Endpoints gefunden (leer nach Connect)");
    }
    return buttons.map((b: any) => String(b.getNumber()));
  }

  /**
   * Liefert einen PairedNode aus dem CommissioningController.
   * Vorgehen analog zu `SonoffPlatform.ts`: NodeId parsen -> controller.getNode(nodeId) -> optional connect().
   */
  async getNode(nodeId: NodeId): Promise<PairedNode | null> {
    this.commissioningController = await this.getCommissioningController();
    if( !this.commissioningController) return null;
    try {
      const nodes = this.commissioningController.getCommissionedNodes();

      if (!nodes.includes(nodeId)) {
          return null;
      }

      // Get the node instance
      const node = await this.commissioningController.getNode(nodeId);
      if( !node) return null;
      return node

    } catch (err) {
      console.error("Error getting node:", err);
      return null;
    }
  }

  async updateOnOffValues(device: MatterDeviceButtoned) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if( !node) return;
    for( const buttonId of Object.keys(device.buttons)) {
      const button = node.parts.get(Number(buttonId));
      if( !button) return;
      const onOffState = button.stateOf(OnOffClient);
      if (onOffState !== undefined) {
          device.buttons[buttonId].on = onOffState.onOff;
      }
    }
  }

  async updateLevelValues(device: MatterDeviceButtoned) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if( !node) return;
    for( const buttonId of Object.keys(device.buttons)) {
      const button = node.parts.get(Number(buttonId));
      if( !button) return;
      const levelState = button.stateOf(LevelControlClient);
      if (levelState !== undefined) {
          const matterLevel = this.mapIntensityMatterLevelToPercent(levelState.currentLevel ?? 0, levelState);
          device.buttons[buttonId].brightness = matterLevel;
      } 
    }
  }

  async updateTemperatureValues(device: MatterDeviceTemperture) {
    const state = await this.getThermostatState(device);
    device.temperature = (state.localTemperature ?? 0) / 100;
  }

  async updateTemperatureGoalValues(device: MatterDeviceTemperture) {
    const state = await this.getThermostatState(device);
    device.temperatureGoal = (state.occupiedHeatingSetpoint ?? 0) / 100;
  }

  async toggleSwitch(device: MatterDevice, buttonId: string) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if( !node) return;
    const button = node.parts.get(Number(buttonId));
    if( !button) return;
    const onOffState = button.stateOf(OnOffClient);
    if (onOffState !== undefined) {
        const onOffCommands = button.commandsOf(OnOffClient);
        if (onOffState.onOff) {
          onOffCommands.off();
        } else {
          onOffCommands.on();
        }
    }
  }

  async setOn(device: MatterDevice, buttonId: string) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if( !node) return;
    const button = node.parts.get(Number(buttonId));
    if( !button) return;
    const onOffState = button.stateOf(OnOffClient);
    if (onOffState !== undefined) {
        const onOffCommands = button.commandsOf(OnOffClient);
        onOffCommands.on();
    }
  }

  async setOff(device: MatterDevice, buttonId: string) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if( !node) return;
    const button = node.parts.get(Number(buttonId));
    if( !button) return;
    const onOffState = button.stateOf(OnOffClient);
    if (onOffState !== undefined) {
        const onOffCommands = button.commandsOf(OnOffClient);
        onOffCommands.off();
    } 
  }

  async setActive(device: MatterDevice) {
    const d = device as unknown as Device;
    if (this.virtualOnOffHandler && d?.id && this.isVirtualMatterServerDevice(d)) {
      try {
        await this.virtualOnOffHandler(d.id, true);
      } catch (err) {
        logger.error({ err, deviceId: d.id }, "setActive: virtual OnOff-Update fehlgeschlagen");
      }
    }
  }

  async setInactive(device: MatterDevice) {
    const d = device as unknown as Device;
    if (this.virtualOnOffHandler && d?.id && this.isVirtualMatterServerDevice(d)) {
      try {
        await this.virtualOnOffHandler(d.id, false);
      } catch (err) {
        logger.error({ err, deviceId: d.id }, "setInactive: virtual OnOff-Update fehlgeschlagen");
      }
    }
  }

  async setIntensity(device: MatterDevice, buttonId: string, intensity: number) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if( !node) return;
    const button = node.parts.get(Number(buttonId));
    if( !button) return;
    const levelState = button.stateOf(LevelControlClient);
    if (levelState !== undefined) {
        const levelCommands = button.commandsOf(LevelControlClient);
        const matterLevel = this.mapIntensityPercentToMatterLevel(intensity, levelState);
        const result = levelCommands.moveToLevelWithOnOff({
          level: matterLevel,
          transitionTime: 0,
          optionsMask: { executeIfOff: true, coupleColorTempToLevel: false },
          optionsOverride: { executeIfOff: true, coupleColorTempToLevel: false },
        });
        await Promise.resolve(result);
        /** Viele Geräte/Matter-Stacks melden nach einem lokalen Invoke kein Subscription-Update → Stream trotzdem feuern */
        this.emitLocalCurrentLevelAttribute(device, buttonId, matterLevel);
    }
  }

  /**
   * Löst denselben Stream-Pfad aus wie ein echter currentLevel-Report (nach lokalem setIntensity).
   */
  private emitLocalCurrentLevelAttribute(device: MatterDevice, buttonId: string, matterLevel: number): void {
    const cb = this.matterAttributeStreamCallback;
    if (!cb) return;
    const deviceId = (device as unknown as Device).id;
    try {
      cb({
        nodeId: device.getNodeId(),
        deviceId,
        event: LevelControl.Complete.id,
        payload: {
          path: {
            endpointId: Number(buttonId),
            clusterId: LevelControl.Complete.id,
            attributeId: LevelControl.Complete.attributes.currentLevel.id,
            attributeName: "currentLevel",
          },
          value: matterLevel,
          version: 0,
        } as MatterEvent["payload"],
        buttonId: Number(buttonId),
      });
    } catch (err) {
      logger.warn({ err, deviceId }, "Lokaler Matter currentLevel-Stream-Callback fehlgeschlagen");
    }
  }

  /**
   * Matter Level-Control: minLevel/maxLevel aus dem State, sonst typische Lampen-Defaults (1…254).
   */
  private resolveLevelControlMinMax(levelState: object): { minLevel: number; maxLevel: number } {
    const s = levelState as { minLevel?: number | null; maxLevel?: number | null };
    const minLevel =
      typeof s.minLevel === "number" && s.minLevel >= 0 ? s.minLevel : 1;
    const maxLevel =
      typeof s.maxLevel === "number" && s.maxLevel >= minLevel ? s.maxLevel : 0xfe;
    return { minLevel, maxLevel };
  }

  /**
   * Mappt Helligkeit 0–100 (Gerätemodell) auf Matter Level-Control ({@link LevelControlClient} minLevel…maxLevel).
   */
  private mapIntensityPercentToMatterLevel(percent: number, levelState: object): number {
    const { minLevel, maxLevel } = this.resolveLevelControlMinMax(levelState);
    const p = Math.max(0, Math.min(100, percent));
    if (maxLevel <= minLevel) {
      return minLevel;
    }
    const mapped = minLevel + (p / 100) * (maxLevel - minLevel);
    return Math.round(Math.max(minLevel, Math.min(maxLevel, mapped)));
  }

  /**
   * Inverse Abbildung: Matter-currentLevel → 0–100 anhand derselben minLevel/maxLevel-Spanne.
   */
  mapIntensityMatterLevelToPercent(level: number, levelState: object): number {
    const { minLevel, maxLevel } = this.resolveLevelControlMinMax(levelState);
    if (maxLevel <= minLevel) {
      return 0;
    }
    const clamped = Math.max(minLevel, Math.min(maxLevel, level));
    const percent = ((clamped - minLevel) / (maxLevel - minLevel)) * 100;
    return Math.round(Math.max(0, Math.min(100, percent)));
  }

  /**
   * Clampt einen Temperatur-Sollwert (in °C) auf den vom Thermostat erlaubten Bereich.
   * @param thermostatState State des Thermostats (mit min/max Limits)
   * @param temperatureCelsius Solltemperatur in °C
   * @returns Geklemmter Wert in Matter-Einheiten (0.01°C, z.B. 21.5°C => 2150)
   */
  private clampHeatSetpoint(thermostatState: unknown, temperatureCelsius: number): number {
    const heatSetpoint = Math.round(temperatureCelsius * 100);
    const state = thermostatState as unknown as Record<string, number | undefined>;
    const minLimit = (state.absMinHeatSetpointLimit && state.absMinHeatSetpointLimit > 0) ? state.absMinHeatSetpointLimit ?? 1000 : 1000;  // 10°C
    const maxLimit = (state.absMaxHeatSetpointLimit && state.absMaxHeatSetpointLimit > 0) ? state.absMaxHeatSetpointLimit ?? 3000 : 3000;  // 30°C
    return Math.max(minLimit, Math.min(maxLimit, heatSetpoint));
  }

  async setTemperatureGoal(device: MatterDevice, temperatureGoal: number) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if (!node) return;
    const devices = node.getDevices();
    const thermostatEndpoint = devices.length > 0 ? devices[0] : node.getDeviceById(0);
    if (!thermostatEndpoint) return;
    const thermostatState = thermostatEndpoint.stateOf(ThermostatClient);
    if (thermostatState === undefined) return;

    const heatSetpoint = this.clampHeatSetpoint(thermostatState, temperatureGoal);
    await thermostatEndpoint.endpoint.setStateOf(ThermostatClient, {
      ...thermostatState,
      occupiedHeatingSetpoint: heatSetpoint,
    });
  }

  async getTemperatureGoal(device: MatterDevice): Promise<number> {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if (!node) return 0;
    const devices = node.getDevices();
    const thermostatEndpoint = devices.length > 0 ? devices[0] : node.getDeviceById(0);
    if (!thermostatEndpoint) return 0;
    const thermostatState = thermostatEndpoint.stateOf(ThermostatClient);
    return thermostatState?.occupiedHeatingSetpoint ?? 0;
  }

  async getTemperature(device: MatterDevice): Promise<number> {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if (!node) return 0;
    const devices = node.getDevices();
    const thermostatEndpoint = devices.length > 0 ? devices[0] : node.getDeviceById(0);
    if (!thermostatEndpoint) return 0;
    const thermostatState = thermostatEndpoint.stateOf(ThermostatClient);
    return thermostatState?.localTemperature ?? 0;
  }

  async getThermostatState(device: MatterDevice): Promise<any> {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if (!node) return null;
    const devices = node.getDevices();
    const thermostatEndpoint = devices.length > 0 ? devices[0] : node.getDeviceById(0);
    if (!thermostatEndpoint) return null;
    const thermostatState = thermostatEndpoint.stateOf(ThermostatClient);
    return thermostatState;
  }

  async setTemperatureSchedules(device: MatterDevice, temperatureSchedules: TemperatureSchedule[]) {
    await this.removeTemperatureSchedules(device);
    for(const schedule of temperatureSchedules) {
      for(const rulevalue of schedule.rulevalue) {
        await this.setTemperatureSchedule(device, rulevalue);
      }
    }
  }

  async removeTemperatureSchedules(device: MatterDevice) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if (!node) return;
    const devices = node.getDevices();
    const thermostat = devices.length > 0 ? devices[0] : node;
    const thermostatState = thermostat.stateOf(ThermostatClient);
    if (thermostatState === undefined) return;

    const thermostatCommands = thermostat.commandsOf(ThermostatClient) as any;
    await thermostatCommands.clearWeeklySchedule();
  }

  async setTemperatureSchedule(device: MatterDevice, shedule: TemperatureScheduleTimeRange) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if (!node) return;
    const devices = node.getDevices();
    const thermostat = devices.length > 0 ? devices[0] : node;
    const thermostatState = thermostat.stateOf(ThermostatClient);
    if (thermostatState === undefined) return;

    const transitionTime = this.parseTimeToMinutes(shedule.time);
    if (transitionTime == null) {
      logger.warn({ time: shedule.time }, "Ungueltige Zeit fuer Thermostat-Schedule");
      return;
    }

    const dayOfWeekForSequence = this.toDayOfWeekBitmap(shedule.weekday);
    if (!dayOfWeekForSequence) {
      logger.warn({ weekday: shedule.weekday }, "Ungueltiger Wochentag fuer Thermostat-Schedule");
      return;
    }

    const thermostatCommands = thermostat.commandsOf(ThermostatClient) as any;

    const heatSetpointCentidegrees = this.clampHeatSetpoint(thermostatState, Number(shedule.temperature));
    const heatSetpointDegrees = heatSetpointCentidegrees / 100;

    await thermostatCommands.setWeeklySchedule({
      numberOfTransitionsForSequence: 1,
      dayOfWeekForSequence,
      modeForSequence: { heatSetpointPresent: true, coolSetpointPresent: false },
      transitions: [
        {
          transitionTime,
          heatSetpoint: heatSetpointDegrees,
          coolSetpoint: null
        }
      ]
    });
  }


  private parseTimeToMinutes(time: string): number | null {
    const match = String(time ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  private toDayOfWeekBitmap(weekday: number):
    | { sunday: true }
    | { monday: true }
    | { tuesday: true }
    | { wednesday: true }
    | { thursday: true }
    | { friday: true }
    | { saturday: true }
    | null {
    switch (weekday) {
      case 0: return { sunday: true };
      case 1: return { monday: true };
      case 2: return { tuesday: true };
      case 3: return { wednesday: true };
      case 4: return { thursday: true };
      case 5: return { friday: true };
      case 6: return { saturday: true };
      default: return null;
    }
  }

  private matterStreamPayload(
    endpointId: number,
    clusterId: number,
    attributeName: string,
    value: unknown
  ): MatterEvent["payload"] {
    return {
      path: { endpointId, clusterId, attributeName },
      value,
    } as MatterEvent["payload"];
  }

  public async startEventStream(device: Device, callback: (event: MatterEvent) => void): Promise<void> {
    const matterDevice = device as unknown as MatterDevice;
    if (typeof matterDevice.getNodeId !== "function") {
      logger.debug(
        { deviceId: device.id },
        "Matter EventStream uebersprungen: Geraet ist noch kein MatterDevice (z. B. vor DB-Konvertierung)"
      );
      return;
    }
    const node = await this.getNode(NodeId(matterDevice.getNodeId()));
    if (!node) return;

    this.matterAttributeStreamCallback = callback;

    try {
      await node.reconnect();
    } catch (err) {
      logger.warn({ err, deviceId: device.id }, "Matter reconnect fuer EventStream fehlgeschlagen");
      return;
    }

    const devices = node.getDevices();
    for (const d of devices) {
      const onoffClient = d.getClusterClient(OnOff.Complete);
      if (onoffClient) {
        const ep = onoffClient.endpointId;
        try {
          await Promise.resolve(
            onoffClient.subscribeOnOffAttribute((value: unknown) => {
              callback({
                nodeId: matterDevice.getNodeId(),
                deviceId: device.id,
                event: OnOff.Complete.id,
                buttonId: ep,
                payload: this.matterStreamPayload(ep, OnOff.Complete.id, "onOff", value),
              });
            }, 0, 2)
          );
        } catch (err) {
          logger.warn(
            { err, context: `OnOff/onOff device=${device.id} ep=${ep}` },
            "Matter Subscribe abgelehnt (Attribut evtl. nicht unterstuetzt oder Geraet lehnt Anfrage ab)"
          );
        }
      }

      const levelControlClient = d.getClusterClient(LevelControl.Complete);
      if (levelControlClient) {
        const ep = levelControlClient.endpointId;
        try {
          await Promise.resolve(
            levelControlClient.subscribeCurrentLevelAttribute((value: unknown) => {
              callback({
                nodeId: matterDevice.getNodeId(),
                deviceId: device.id,
                event: LevelControl.Complete.id,
                buttonId: ep,
                payload: this.matterStreamPayload(ep, LevelControl.Complete.id, "currentLevel", value),
              });
            }, 0, 2)
          );
        } catch (err) {
          logger.warn(
            { err, context: `LevelControl/currentLevel device=${device.id} ep=${ep}` },
            "Matter Subscribe abgelehnt (Attribut evtl. nicht unterstuetzt oder Geraet lehnt Anfrage ab)"
          );
        }
      }

      const thermostatClient = d.getClusterClient(Thermostat.Complete);
      if (thermostatClient) {
        const ep = thermostatClient.endpointId;
        const cid = Thermostat.Complete.id;
        try {
          await Promise.resolve(
            thermostatClient.subscribeLocalTemperatureAttribute((value: unknown) => {
              callback({
                nodeId: matterDevice.getNodeId(),
                deviceId: device.id,
                event: cid,
                buttonId: 0,
                payload: this.matterStreamPayload(ep, cid, "localTemperature", value),
              });
            }, 0, 2)
          );
        } catch (err) {
          logger.warn(
            { err, context: `Thermostat/localTemperature device=${device.id}` },
            "Matter Subscribe abgelehnt (Attribut evtl. nicht unterstuetzt oder Geraet lehnt Anfrage ab)"
          );
        }
        try {
          await Promise.resolve(
            thermostatClient.subscribeOccupiedHeatingSetpointAttribute((value: unknown) => {
              callback({
                nodeId: matterDevice.getNodeId(),
                deviceId: device.id,
                event: cid,
                buttonId: 6,
                payload: this.matterStreamPayload(ep, cid, "occupiedHeatingSetpoint", value),
              });
            }, 0, 2)
          );
        } catch (err) {
          logger.warn(
            { err, context: `Thermostat/occupiedHeatingSetpoint device=${device.id}` },
            "Matter Subscribe abgelehnt (Attribut evtl. nicht unterstuetzt oder Geraet lehnt Anfrage ab)"
          );
        }
      }

      const temperatureMeasurement = d.getClusterClient(TemperatureMeasurement.Complete);
      if (temperatureMeasurement) {
        const ep = temperatureMeasurement.endpointId;
        const cid = TemperatureMeasurement.Complete.id;
        try {
          await Promise.resolve(
            temperatureMeasurement.subscribeMeasuredValueAttribute((value: unknown) => {
              callback({
                nodeId: matterDevice.getNodeId(),
                deviceId: device.id,
                event: cid,
                buttonId: 0,
                payload: this.matterStreamPayload(ep, cid, "measuredValue", value),
              });
            }, 0, 2)
          );
        } catch (err) {
          logger.warn(
            { err, context: `TemperatureMeasurement/measuredValue device=${device.id}` },
            "Matter Subscribe abgelehnt (Attribut evtl. nicht unterstuetzt oder Geraet lehnt Anfrage ab)"
          );
        }
      }
    }
  }

  private clearMatterAttributeStreamForDevice(deviceId: string): void {
    const dispose = this.matterAttributeStreamDisposers.get(deviceId);
    if (dispose) {
      dispose();
      this.matterAttributeStreamDisposers.delete(deviceId);
    }
  }

  public async stopEventStream(device: Device): Promise<void> {
    this.clearMatterAttributeStreamForDevice(device.id);
  }

  async shutdown() {
    this.matterAttributeStreamCallback = null;
    for (const dispose of this.matterAttributeStreamDisposers.values()) {
      dispose();
    }
    this.matterAttributeStreamDisposers.clear();
    const controller = this.commissioningController;
    if (controller && controller.isCommissioned()) {
      controller?.close();
    }
    this.commissioningController = null;
    this.commissioningControllerStarted = false;
    this.initControllerPromise = null;
  }

  private async getCommissioningController(): Promise<CommissioningController | null> {
    if (this.commissioningController && this.commissioningControllerStarted) return this.commissioningController;
    if (!this.initControllerPromise) {
      this.initControllerPromise = this._doInitCommissioningController();
    }
    const controller = await this.initControllerPromise;
    this.commissioningController = controller;
    return controller;
  }

  private async _doInitCommissioningController(): Promise<CommissioningController | null> {
    const uniqueId = environmentId;
    try {
      const storageManager = await storageService.open(controllerId);
      const controllerStorage = storageManager.createContext("data");
      await controllerStorage.set("uniqueid", uniqueId);
      await controllerStorage.set("fabriclabel", adminFabricLabel);
      await storageManager.close();
    } catch (err) {
      logger.error(err, "Fehler beim Initialisieren des Matter-Storage");
      this.initControllerPromise = null;
      return null;
    }

    

    let ble = false;
    /*
    const wifiSsid = "Wollatz";
    const wifiCredentials = "LgdDwPn0dDf!";
    const threadNetworkName = environment.vars.string("ble.thread.networkname");
    const threadOperationalDataset = environment.vars.string("ble.thread.operationaldataset");
    if (wifiSsid !== undefined && wifiCredentials !== undefined) {
        logger.info(`Registering Commissioning over BLE with WiFi: ${wifiSsid}`);
        commissioningOptions.wifiNetwork = {
            wifiSsid: wifiSsid,
            wifiCredentials: wifiCredentials,
        };
    }
    if (threadOperationalDataset !== undefined) {
        logger.info(
            `Registering Commissioning over BLE with Thread: ${threadNetworkName ?? "via operational dataset"}`,
        );
        commissioningOptions.threadNetwork = {
            networkName: threadNetworkName,
            operationalDataset: threadOperationalDataset,
        };
    }
        */
    
     /** Create Matter Controller Node and bind it to the Environment. */
     const commissioningController = new CommissioningController({
        environment: {
            environment,
            id: uniqueId,
        },
        autoConnect: false, // Do not auto connect to the commissioned nodes
        adminFabricLabel,
    });

    /** Start the Matter Controller Node */
    try {
      await commissioningController.start();
    } catch (err) {
      logger.error({ err }, "CommissioningController konnte nicht gestartet werden");
      this.initControllerPromise = null; // Ermöglicht erneuten Versuch
      return null;
    }

    this.commissioningControllerStarted = true;

    return commissioningController;
  }


}


