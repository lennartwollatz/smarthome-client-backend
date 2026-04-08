import { NodeId } from "@matter/main";
import { ModuleEvent } from "../moduleEvent.js";

export interface MatterEvent extends ModuleEvent {
    nodeId: NodeId,
    deviceId: string,
    event: number,
    payload: any,
    buttonId?: number,
  }