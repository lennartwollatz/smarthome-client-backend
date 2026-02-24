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

  protected executeToggle(buttonId: string) {
    this.matterController?.toggleSwitch(this, buttonId);
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

  getNodeId(): NodeId {
    return NodeId(this.nodeId);
  }

  setNodeId(nodeId: NodeId): void {
    this.nodeId = String(nodeId);
  }
}


