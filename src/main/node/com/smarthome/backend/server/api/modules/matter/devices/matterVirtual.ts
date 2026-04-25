import { DeviceActive } from "../../../../../model/devices/DeviceActive.js";
import { MatterDeviceController } from "../matterDeviceController.js";
import { NodeId } from "@matter/types";
import { MatterDevice } from "./matterDevice.js";
import { DeviceVirtual } from "../../../../../model/devices/DeviceVirtual.js";


export class MatterVirtual extends DeviceVirtual implements MatterDevice{
  nodeId: string;
  pairingCode:string;
  qrPairingCode:string;
  port:number;
  passcode:number;
  discriminator:number;
  private matterController?: MatterDeviceController;

  constructor(init?: Partial<DeviceActive>, nodeId?: string, pairingCode?: string, qrPairingCode?: string, port?: number, passcode?: number, discriminator?: number) {
    super({ ...init });
    this.moduleId = "matter";
    this.nodeId = nodeId ?? "0";
    this.pairingCode = pairingCode ?? "";
    this.qrPairingCode = qrPairingCode ?? "";
    this.port = port ?? 0;
    this.passcode = passcode ?? 0;
    this.discriminator = discriminator ?? 0;
  }

  setMatterController(matterController?: MatterDeviceController) {
    this.matterController = matterController;
  }

  async updateValues(): Promise<void> {
  }

  async delete(): Promise<void> {}

  protected async executeSetActive(): Promise<void> {
    await this.matterController?.setActive(this);
  }

  protected async executeSetInactive(): Promise<void> {
    await this.matterController?.setInactive(this);
  }

  getNodeId(): NodeId {
    return NodeId(this.nodeId);
  }

  setNodeId(nodeId: NodeId): void {
    this.nodeId = String(nodeId);
  }
}


