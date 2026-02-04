import { DeviceTrigger } from "./DeviceTrigger.js";
import { TimeTrigger } from "./TimeTrigger.js";

export class TriggerConfig {
  type?: string;
  device?: DeviceTrigger;
  time?: TimeTrigger;

  constructor(init?: Partial<TriggerConfig>) {
    Object.assign(this, init);
  }
}
