import { logger } from "../../../../../logger.js";
import { DeviceSwitch } from "../../../../../model/devices/DeviceSwitch.js";
import { MatterDeviceController } from "../matterDeviceController.js";
import { MatterDeviceButtoned } from "./matterDevice.js";
import { NodeId } from "@matter/types";

export type MatterSwitchOptions = {
  moduleId?: string;
  quickAccess?: boolean;
  isVoiceAssistantDevice?: boolean;
};

export class MatterSwitch extends DeviceSwitch implements MatterDeviceButtoned {
  private nodeId: string;
  private matterController?: MatterDeviceController;
  private _isVoiceAssistantDevice = false;

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
    (buttonIds ?? []).forEach(buttonId => this.addButton(buttonId));
  }

  setMatterController(matterController?: MatterDeviceController) {
    this.matterController = matterController;
  }

  async updateValues(): Promise<void> {
    if (!this._isVoiceAssistantDevice) {
      logger.info("Update die Werte fuer " +this.id);
    }
    // TODO: Matter Device Controller Anbindung für Status/Subscribe
  }

  public isVoiceAssistantDevice(): boolean {
    return this._isVoiceAssistantDevice;
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


