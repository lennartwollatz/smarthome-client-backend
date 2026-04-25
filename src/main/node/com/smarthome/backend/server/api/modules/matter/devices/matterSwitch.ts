import { DeviceSwitch } from "../../../../../model/devices/DeviceSwitch.js";
import { MatterDeviceController } from "../matterDeviceController.js";
import { MATTERMODULE } from "../matterModule.js";
import { MatterDeviceButtoned } from "./matterDevice.js";
import { NodeId } from "@matter/types";

export type MatterSwitchOptions = {
  moduleId?: string;
  quickAccess?: boolean;
  _isVoiceAssistantDevice?: boolean;
  _isVirtualMatterHost?: boolean;
};

export class MatterSwitch extends DeviceSwitch implements MatterDeviceButtoned {
  private nodeId: string;
  private matterController?: MatterDeviceController;
  _isVoiceAssistantDevice = false;
  _isVirtualMatterHost = false;

  constructor(name?: string, id?: string, nodeId?: string, buttonIds?: readonly string[], opts?: MatterSwitchOptions) {
    super({
      name,
      id,
      moduleId: opts?.moduleId ?? MATTERMODULE.id,
      isConnected: true,
      isPairingMode: false,
      quickAccess: opts?.quickAccess ?? false,
    });
    this.nodeId = nodeId ?? "0";
    this._isVoiceAssistantDevice = opts?._isVoiceAssistantDevice ?? false;
    this._isVirtualMatterHost = opts?._isVirtualMatterHost ?? false;
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

  public isVoiceAssistantDevice(): boolean {
    return this._isVoiceAssistantDevice;
  }

  public isVirtualMatterHost(): boolean {
    return this._isVirtualMatterHost;
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


