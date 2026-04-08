import { NodeId } from "@matter/types";
import { DeviceThermostat, TemperatureSchedule } from "../../../../../model/devices/DeviceThermostat.js";
import { MatterDeviceController } from "../matterDeviceController.js";
import { MatterDevice } from "./matterDevice.js";

export class MatterThermostat extends DeviceThermostat implements MatterDevice {
  private nodeId: string;
  private matterController?: MatterDeviceController;

  constructor(
    name?: string,
    id?: string,
    nodeId?: string
  ) {
    super({ name, id, moduleId: "matter", isConnected: true });
    this.nodeId = nodeId ?? "0";
  }

  setMatterController(matterController?: MatterDeviceController) {
    this.matterController = matterController;
  }

  async updateValues(): Promise<void> {
    this.matterController?.updateTemperatureValues(this);
    this.matterController?.updateTemperatureGoalValues(this);
  }

  async delete(): Promise<void> {
    await this.matterController?.unpairDevice(this);
  }

  protected async executeSetTemperatureGoal(temperatureGoal: number): Promise<void> {
    await this.matterController?.setTemperatureGoal(this, temperatureGoal);
  }

  protected async executeSetTemperatureSchedules(temperatureSchedules: TemperatureSchedule[]): Promise<void> {
    await this.matterController?.setTemperatureSchedules(this, temperatureSchedules);
  }

  getNodeId(): NodeId {
    return NodeId(this.nodeId);
  }

  setNodeId(nodeId: NodeId): void {
    this.nodeId = String(nodeId);
  }

}

