import { ConditionConfig } from "./ConditionConfig.js";

export class LoopConfig {
  type?: string;
  count?: number;
  condition?: ConditionConfig;
  maxIterations?: number;

  constructor(init?: Partial<LoopConfig>) {
    Object.assign(this, init);
  }
}
