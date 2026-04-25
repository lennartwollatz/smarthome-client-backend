import { DeviceSwitchEnergy } from "../../../../../model/devices/DeviceSwitchEnergy.js";
import { MatterDeviceController } from "../matterDeviceController.js";
import { MATTERMODULE } from "../matterModule.js";
import { MatterDeviceButtoned } from "./matterDevice.js";
import { NodeId } from "@matter/types";

export class MatterSwitchEnergy extends DeviceSwitchEnergy implements MatterDeviceButtoned {
  private nodeId: string;
  private matterController?: MatterDeviceController;
  
  constructor(
    name?: string,
    id?: string,
    nodeId?: string,
    buttonIds?: string[]
  ) {
    super({ name, id, moduleId: MATTERMODULE.id, isConnected: true });
    this.nodeId = nodeId ?? "0";
    (buttonIds ?? []).forEach(buttonId => this.addButton(buttonId));
  }

  setMatterController(matterController?: MatterDeviceController) {
    this.matterController = matterController;
  }

  async updateValues(): Promise<void> {
    this.matterController?.updateOnOffValues(this);
  }

  async delete(): Promise<void> {
    await this.matterController?.unpairDevice(this);
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

  getNodeId(): NodeId {
    return NodeId(this.nodeId);
  }

  setNodeId(nodeId: NodeId): void {
    this.nodeId = String(nodeId);
  }
}

