import { Position } from "./Position.js";
import { TriggerConfig } from "./TriggerConfig.js";
import { ActionConfig } from "./ActionConfig.js";
import { ConditionConfig } from "./ConditionConfig.js";
import { WaitConfig } from "./WaitConfig.js";
import { LoopConfig } from "./LoopConfig.js";
import { VariableConfig } from "./VariableConfig.js";

export class Node {
  nodeId!: string;
  type!: string;
  order?: number;
  name?: string;
  position?: Position;
  triggerConfig?: TriggerConfig;
  actionConfig?: ActionConfig;
  conditionConfig?: ConditionConfig;
  waitConfig?: WaitConfig;
  loopConfig?: LoopConfig;
  variableConfig?: VariableConfig;
  loopNodes?: string[];
  nextNodes?: string[];
  trueNodes?: string[];
  falseNodes?: string[];

  constructor(init?: Partial<Node>) {
    Object.assign(this, init);
    if (init?.actionConfig) {
      this.actionConfig = new ActionConfig(init.actionConfig);
    }
    if (init?.conditionConfig) {
      this.conditionConfig = new ConditionConfig(init.conditionConfig);
    }
    if (init?.variableConfig) {
      this.variableConfig = new VariableConfig(init.variableConfig);
    }
  }
}
