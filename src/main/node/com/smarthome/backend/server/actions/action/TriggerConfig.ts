import { TriggerType } from "./Action.js";
import { DeviceTrigger } from "./DeviceTrigger.js";
import { TimeTrigger } from "./TimeTrigger.js";

export class TriggerConfig {
  type!: TriggerType;
  device?: DeviceTrigger;
  time?: TimeTrigger;

  constructor(init?: Partial<TriggerConfig>) {
    Object.assign(this, init);
  }
}
