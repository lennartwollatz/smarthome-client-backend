import { logger } from "../../../../../logger.js";
import { DeviceSwitch } from "../../../../../model/devices/DeviceSwitch.js";
import { MatterDeviceController } from "../matterDeviceController.js";
import { MatterDeviceButtoned } from "./matterDevice.js";
import { NodeId } from "@matter/types";

export type MatterSwitchOptions = {
  moduleId?: string;
  quickAccess?: boolean;
  isVoiceAssistantDevice?: boolean;
  /** Virtueller On/Off-Stecker dieses Backends im Modul „matter“ (ServerNode, QR/Code zum Koppeln) */
  isVirtualMatterHost?: boolean;
};

export type VirtualMatterHostExecutor = {
  setState: (buttonId: string, on: boolean) => Promise<boolean>;
};

export class MatterSwitch extends DeviceSwitch implements MatterDeviceButtoned {
  private nodeId: string;
  private matterController?: MatterDeviceController;
  private _isVoiceAssistantDevice = false;
  /** Gesetzt für vom Nutzer angelegte Matter-Host-Schalter (persistiert in Device-JSON). */
  isVirtualMatterHost = false;
  private virtualMatterHostExecutor?: VirtualMatterHostExecutor;

  constructor(name?: string, id?: string, nodeId?: string, buttonIds?: readonly string[], opts?: MatterSwitchOptions) {
    super({
      name,
      id,
      moduleId: opts?.moduleId ?? "matter",
      isConnected: true,
      isPairingMode: false,
      quickAccess: opts?.quickAccess ?? false,
    });
    this.nodeId = nodeId ?? "0";
    this._isVoiceAssistantDevice = opts?.isVoiceAssistantDevice ?? false;
    this.isVirtualMatterHost = opts?.isVirtualMatterHost ?? false;
    (buttonIds ?? []).forEach(buttonId => this.addButton(buttonId));
  }

  setMatterController(matterController?: MatterDeviceController) {
    this.matterController = matterController;
  }

  setVirtualMatterHostExecutor(executor: VirtualMatterHostExecutor | undefined) {
    this.virtualMatterHostExecutor = executor;
  }

  async updateValues(): Promise<void> {
    if (this.isVirtualMatterHost || this._isVoiceAssistantDevice) {
      return;
    }
    logger.info("Update die Werte fuer " + this.id);
    this.matterController?.updateOnOffValues(this);
  }

  async delete(): Promise<void> {
    if (this.isVirtualMatterHost || this._isVoiceAssistantDevice) {
      return;
    }
    await this.matterController?.unpairDevice(this);
  }

  public isVoiceAssistantDevice(): boolean {
    return this._isVoiceAssistantDevice;
  }

  protected async executeToggle(buttonId: string): Promise<void> {
    const desired = this.buttons?.[buttonId]?.isOn() ?? false;
    if (this.virtualMatterHostExecutor) {
      await this.virtualMatterHostExecutor.setState(buttonId, desired);
      return;
    }
    await this.matterController?.toggleSwitch(this, buttonId);
  }

  protected async executeSetOn(buttonId: string): Promise<void> {
    if (this.virtualMatterHostExecutor) {
      await this.virtualMatterHostExecutor.setState(buttonId, true);
      return;
    }
    await this.matterController?.setOn(this, buttonId);
  }

  protected async executeSetOff(buttonId: string): Promise<void> {
    if (this.virtualMatterHostExecutor) {
      await this.virtualMatterHostExecutor.setState(buttonId, false);
      return;
    }
    await this.matterController?.setOff(this, buttonId);
  }

  getNodeId(): NodeId {
    return NodeId(this.nodeId);
  }

  setNodeId(nodeId: NodeId): void {
    this.nodeId = String(nodeId);
  }
}


