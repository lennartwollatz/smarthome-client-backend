import { MatterEvent } from "./matterEvent.js";
import { Device } from "../../../../model/devices/Device.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";
import { MatterDevice } from "./devices/matterDevice.js";

import { Environment, Logger, StorageService, serialize } from "@matter/main";
import { OnOffClient } from "@matter/main/behaviors/on-off";
import { GeneralCommissioning } from "@matter/main/clusters";
import { ManualPairingCodeCodec, NodeId } from "@matter/main/types";
import { CommissioningController, NodeCommissioningOptions } from "@project-chip/matter.js";
import { PairedNode } from "@project-chip/matter.js/device";
import { DatabaseManager } from "../../../db/database.js";
import { MatterDeviceDiscovered } from "./matterDeviceDiscovered.js";
import { PairingPayload } from "./matterModuleManager.js";

import "@matter/nodejs-ble";
import { LevelControlClient } from "@matter/main/behaviors/level-control";
import { CommissionableDevice } from "@matter/main/protocol";
import { TemperatureSchedule, TemperatureScheduleTimeRange } from "../../../../model/devices/DeviceThermostat.js";
import { ThermostatClient } from "@matter/main/behaviors/thermostat";

const logger = Logger.get("MatterDeviceController");
const environment = Environment.default;
const storageService = environment.get(StorageService);
const environmentId = "1668012345678";
const adminFabricLabel = "smarthome-backend";
const controllerId = "controller-2";

export class MatterDeviceController extends ModuleDeviceControllerEvent<MatterEvent, Device> {
  private commissioningController: CommissioningController | null = null;
  private commissioningControllerStarted = false;
  /** Mutex: Verhindert Race Conditions bei parallelen Aufrufen von getCommissioningController */
  private initControllerPromise: Promise<CommissioningController | null> | null = null;

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

  private getDeviceInfo(vendorProduct: string): { vendorId: number, productId: number } {
    const [vendorId, productId] = vendorProduct.split("+");
    return { vendorId: parseInt(vendorId), productId: parseInt(productId) };
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

  async toggleSwitch(device: MatterDevice, buttonId: string) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if( !node) return;
    const button = node.parts.get(Number(buttonId));
    if( !button) return;
    const onOffState = button.stateOf(OnOffClient);
    if (onOffState !== undefined) {
        const onOffCommands = button.commandsOf(OnOffClient);
        onOffCommands.toggle();
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

  async setIntensity(device: MatterDevice, buttonId: string, intensity: number) {
    const node = await this.getNode(NodeId(device.getNodeId()));
    if( !node) return;
    const button = node.parts.get(Number(buttonId));
    if( !button) return;
    const levelState = button.stateOf(LevelControlClient);
    if (levelState !== undefined) {
        const levelCommands = button.commandsOf(LevelControlClient);
        levelCommands.moveToLevelWithOnOff({level: intensity, transitionTime: 0, optionsMask: { executeIfOff: false, coupleColorTempToLevel: false }, optionsOverride: { executeIfOff: false, coupleColorTempToLevel: false }});
    } 
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
    console.log(state);
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
    if( !node) return;
    node.events.eventTriggered.on(({ path: { nodeId, clusterId, endpointId, eventName }, events }) => {
      console.log(
          `eventTriggeredCallback ${nodeId}: Event ${eventName} triggered with ${serialize(
              events,
          )}`
      );
      for(const event of events) {
        callback({ nodeId: String(nodeId), deviceId: device.id, event: eventName, name: eventName, payload: event })
      }
    });
  }

  public async stopEventStream(device: Device): Promise<void> {
    
  }

  async shutdown() {
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
      console.error("Error starting commissioning controller:", err);
      this.initControllerPromise = null; // Ermöglicht erneuten Versuch
      return null;
    }

    /** Alle Geräte aus der Fabric entfernen (decommissionieren) */
    /*
    try {
      const commissionedNodes = commissioningController.getCommissionedNodes();
      for (const nodeId of commissionedNodes) {
        try {
          const node = await commissioningController.getNode(nodeId);
          if (node) {
            await node.decommission();
            logger.info({ nodeId: String(nodeId) }, "Gerät aus Fabric entfernt");
          }
        } catch (nodeErr) {
          logger.warn({ nodeId: String(nodeId), err: nodeErr }, "Gerät konnte nicht aus Fabric entfernt werden");
        }
      }
    } catch (err) {
      logger.warn(err, "Fehler beim Entfernen der Fabric-Geräte");
    }
      */

    this.commissioningControllerStarted = true;

    return commissioningController;
  }


}


