import { EventEmitter } from "node:events";
//import { logger } from "../../../../logger.js";
import { NodeNetwork } from "./matterNodeNetwork.js";
import { MatterEvent } from "./matterEvent.js";
import { Device } from "../../../../model/devices/Device.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";
import { MatterDevice } from "./devices/matterDevice.js";

import { Diagnostic, Environment, Logger, serialize, StorageService, Time } from "@matter/main";
import { DescriptorClient } from "@matter/main/behaviors/descriptor";
import { OnOffClient } from "@matter/main/behaviors/on-off";
import { BasicInformationCluster, Descriptor, GeneralCommissioning } from "@matter/main/clusters";
import { ManualPairingCodeCodec, NodeId } from "@matter/main/types";
import { CommissioningController, NodeCommissioningOptions } from "@project-chip/matter.js";
import { NodeStates, PairedNode } from "@project-chip/matter.js/device";
// This installs BLE support if configuration variable "ble.enable" is true
import { DatabaseManager } from "../../../db/database.js";
import { MatterDeviceDiscovered } from "./matterDeviceDiscovered.js";
import { PairingPayload } from "./matterModuleManager.js";

import "@matter/nodejs-ble";

const logger = Logger.get("MatterDeviceController");
const environment = Environment.default;
const storageService = environment.get(StorageService);
const environmentId = "1668012345678";
const adminFabricLabel = "smarthome-backend";

export class MatterDeviceController extends ModuleDeviceControllerEvent<MatterEvent, Device> {
  private eventEmitter = new EventEmitter();
  private eventSubscriptionStop?: Function;
  private eventStreamRunning = false;
  private commissioningController: CommissioningController | null = null;
  private commissioningControllerStarted = false;
  private databaseManager: DatabaseManager;
  
  constructor(databaseManager: DatabaseManager) {
    super();
    this.databaseManager = databaseManager;
  }

  async pairDevice(device: MatterDeviceDiscovered, payload: PairingPayload): Promise<MatterDeviceDiscovered | null> {
    const storageManager = await storageService.open("controller");
    const controllerStorage = storageManager.createContext("data");
    const ip = device.address;
    const port = device.port ?? 5540;
    const uniqueId = environmentId;
    await controllerStorage.set("uniqueid", uniqueId);
    await controllerStorage.set("fabriclabel", adminFabricLabel);

    const pairingCode = payload.pairingCode;
    let longDiscriminator, setupPin, shortDiscriminator;
    if (pairingCode !== undefined) {
        const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
        shortDiscriminator = pairingCodeCodec.shortDiscriminator;
        longDiscriminator = undefined;
        setupPin = pairingCodeCodec.passcode;
        logger.debug(`Data extracted from pairing code: ${Diagnostic.json(pairingCodeCodec)}`);
    } else {
        longDiscriminator =
            environment.vars.number("longDiscriminator") ??
            (await controllerStorage.get("longDiscriminator", 3840));
        if (longDiscriminator > 4095) throw new Error("Discriminator value must be less than 4096");
        setupPin = environment.vars.number("passcode") ?? (await controllerStorage.get("passcode", 20202021));
    }

    await storageManager.close(); // Close storage

    if ((shortDiscriminator === undefined && longDiscriminator === undefined) || setupPin === undefined) {
        throw new Error(
            "Please specify the longDiscriminator of the device to commission with -longDiscriminator or provide a valid passcode with --passcode=xxxxxx",
        );
    }

    // Collect commissioning options from commandline parameters
    const commissioningOptions: NodeCommissioningOptions["commissioning"] = {
        regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
        regulatoryCountryCode: "XX",
    };

    let ble = true;

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
    await commissioningController.start();

    // When we do not have a commissioned node, we need to commission the device provided by CLI parameters
    if (!commissioningController.isCommissioned()) {
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
                    ble,
                },
            },
            passcode: setupPin,
        };
        logger.info(`Commissioning ... ${Diagnostic.json(options)}`);
        const nodeId = await commissioningController.commissionNode(options);

        console.log(`Commissioning successfully done with nodeId ${nodeId}`);

        // After commissioning or if we have a commissioned node we can connect to it
        try {
          const nodes = commissioningController.getCommissionedNodes();
          console.log("Found commissioned nodes:", Diagnostic.json(nodes));

          const nodeId = NodeId(environment.vars.number("nodeid") ?? nodes[0]);
          if (!nodes.includes(nodeId)) {
              throw new Error(`Node ${nodeId} not found in commissioned nodes`);
          }

          const nodeDetails = commissioningController.getCommissionedNodesDetails();
          console.log(
              "Commissioned nodes details:",
              Diagnostic.json(nodeDetails.find(node => node.nodeId === nodeId)),
          );

          // Get the node instance
          const node = await commissioningController.getNode(nodeId);
          console.log("Node found:", node);
          node.logStructure();

          return device

        } catch (err) {
          console.error("Error getting node:", err);
          return null;
        }
    }
    return null;
  }

  async unpairDevice(device: MatterDevice): Promise<boolean> {
    return true;
  }

  /**
   * Commissioniert ein Matter-Gerät ausschließlich über den Pairing-Code (ohne bekannte IP/Port).
   * Nutzt Discovery (mDNS/BLE je nach Plattform) basierend auf shortDiscriminator + passcode.
   *
   * Beispiel:
   *   const result = await controller.pairDeviceByCode("1234-5678");
   */
  async pairDeviceByCode(pairingCode: string): Promise<{ nodeId: NodeId } | null> {
    
      return { nodeId: NodeId(0) };

  }

  async getButtonsForDevice(device: MatterDeviceDiscovered): Promise<string[]> {
    console.log("getButtonsForDevice", device);
    if( !device.nodeId) return [];
    const node = await this.getNode(NodeId(device.nodeId));
    if( !node) return [];
    const buttons = node.getDevices();
    if (buttons.length === 0) {
      logger.warn({ nodeId: device.nodeId }, "Keine Endpoints gefunden (leer nach Connect)");
    }
    console.log("buttons", buttons);
    return buttons.map((b: any) => String(b.getNumber()));
  }

  /**
   * Liefert einen PairedNode aus dem CommissioningController.
   * Vorgehen analog zu `SonoffPlatform.ts`: NodeId parsen -> controller.getNode(nodeId) -> optional connect().
   */
  async getNode(nodeId: NodeId): Promise<PairedNode | null> {
   return null;
  }

  async toggleSwitch(device: MatterDevice, buttonId: string) {
    
  }

  public async startEventStream(device: Device, callback: (event: MatterEvent) => void): Promise<void> {
    
  }

  public async stopEventStream(device: Device): Promise<void> {
    
  }

  async shutdown() {
    const controller = this.commissioningController;
    if (controller && controller.isCommissioned()){
      controller?.close();
    }
    
    this.commissioningController = null;
    this.commissioningControllerStarted = false;
  }


}


