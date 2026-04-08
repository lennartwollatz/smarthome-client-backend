import { Button } from "../../../../../model/devices/DeviceSwitch.js";
import type { NodeId } from "@matter/types";

export interface MatterDevice {
    getNodeId(): NodeId;
    setNodeId(nodeId: NodeId): void;
}

export interface MatterDeviceTemperture extends MatterDevice {
    temperature?: number;
    temperatureGoal?: number;
}

export interface MatterDeviceButtoned {
    getNodeId(): NodeId;
    setNodeId(nodeId: NodeId): void;
    getButton(buttonId: string): Button | undefined;
    buttons: Record<string, Button>;
}