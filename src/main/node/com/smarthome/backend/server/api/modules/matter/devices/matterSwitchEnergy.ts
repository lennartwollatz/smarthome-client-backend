import { logger } from "../../../../../logger.js";
import { DeviceSwitchEnergy, Energy } from "../../../../../model/devices/DeviceSwitchEnergy.js";
import { MatterDeviceController } from "../matterDeviceController.js";
import { MatterDevice } from "./matterDevice.js";
import { NodeId } from "@matter/types";

export class MatterSwitchEnergy extends DeviceSwitchEnergy implements MatterDevice {
  private nodeId: string;
  private matterController?: MatterDeviceController;
  
  constructor(
    name?: string,
    id?: string,
    nodeId?: string,
    buttonIds?: string[]
  ) {
    super({ name, id, moduleId: "matter", isConnected: true });
    this.nodeId = nodeId ?? "0";
    (buttonIds ?? []).forEach(buttonId => this.addButton(buttonId));
  }

  setMatterController(matterController?: MatterDeviceController) {
    this.matterController = matterController;
  }

  async updateValues(): Promise<void> {
    logger.info("Update die Werte fuer {}", this.id);
    // Matter Device Controller in Node ist aktuell stubbed.
  }

  protected executeToggle(buttonId: string) {
    logger.debug("executeToggle fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected executeDoublePress(buttonId: string) {
    logger.debug("executeDoublePress fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected executeTriplePress(buttonId: string) {
    logger.debug("executeTriplePress fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected executeSetBrightness(buttonId: string, brightness: number) {
    logger.debug(
      "executeSetBrightness fuer Button {} - wird ueber Event-Stream verarbeitet",
      buttonId,
      brightness
    );
  }

  protected executeSetEnergyUsage(_energyUsage: Energy) {
    logger.debug("executeSetEnergyUsage - wird ueber Event-Stream verarbeitet");
  }

  getNodeId(): NodeId {
    return NodeId(this.nodeId);
  }

  setNodeId(nodeId: NodeId): void {
    this.nodeId = String(nodeId);
  }
}

