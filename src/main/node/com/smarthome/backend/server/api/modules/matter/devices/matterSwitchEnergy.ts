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

  protected async executeToggle(buttonId: string): Promise<void> {
    await this.matterController?.toggleSwitch(this, buttonId);
  }

  protected async executeSetOn(buttonId: string): Promise<void> {
    await this.matterController?.setOn(this, buttonId);
  }

  protected async executeSetOff(buttonId: string): Promise<void> {
    await this.matterController?.setOff(this, buttonId);
  }

  protected async executeDoublePress(buttonId: string): Promise<void> {
    logger.debug("executeDoublePress fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected async executeTriplePress(buttonId: string): Promise<void> {
    logger.debug("executeTriplePress fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected async executeSetIntensity(buttonId: string, intensity: number): Promise<void> {
    logger.debug(
      "executeSetIntensity fuer Button {} - wird ueber Event-Stream verarbeitet",
      buttonId,
      intensity
    );
  }

  protected async executeSetEnergyUsage(_energyUsage: Energy): Promise<void> {
    logger.debug("executeSetEnergyUsage - wird ueber Event-Stream verarbeitet");
  }

  getNodeId(): NodeId {
    return NodeId(this.nodeId);
  }

  setNodeId(nodeId: NodeId): void {
    this.nodeId = String(nodeId);
  }
}

