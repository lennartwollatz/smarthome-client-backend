import { logger } from "../../../../../logger.js";
import { DeviceSwitch } from "../../../../../model/devices/DeviceSwitch.js";
import { MatterDeviceController } from "../matterDeviceController.js";
import { MatterDevice } from "./matterDevice.js";
import { NodeId } from "@matter/types";

export class MatterSwitch extends DeviceSwitch implements MatterDevice {
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

  protected async executeSetIntensity(buttonId: string, intensity: number): Promise<void> {
    logger.debug(
      "executeSetBrightness fuer Button {} - wird ueber Event-Stream verarbeitet",
      buttonId,
      intensity
    );
  }

  getNodeId(): NodeId {
    return NodeId(this.nodeId);
  }

  setNodeId(nodeId: NodeId): void {
    this.nodeId = String(nodeId);
  }
}


