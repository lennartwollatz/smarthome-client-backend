import { logger } from "../../../../../logger.js";
import { DeviceSwitchDimmer } from "../../../../../model/devices/DeviceSwitchDimmer.js";
import { MatterDeviceController } from "../matterDeviceController.js";
import { MatterDeviceButtoned } from "./matterDevice.js";
import { NodeId } from "@matter/types";

export class MatterSwitchDimmer extends DeviceSwitchDimmer implements MatterDeviceButtoned {
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
    // TODO: Matter Device Controller Anbindung für Status/Subscribe
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

  protected async executeSetBrightness(buttonId: string, brightness: number): Promise<void> {
    await this.matterController?.setIntensity(this, buttonId, brightness);
  }


  getNodeId(): NodeId {
    return NodeId(this.nodeId);
  }

  setNodeId(nodeId: NodeId): void {
    this.nodeId = String(nodeId);
  }
}


