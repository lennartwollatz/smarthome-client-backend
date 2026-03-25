import { TriggerType } from "./Action.js";
import { DeviceTrigger } from "./DeviceTrigger.js";
import { TimeTrigger } from "./TimeTrigger.js";
import { VoiceAssistantTrigger } from "./VoiceAssistantTrigger.js";

export class TriggerConfig {
  type!: TriggerType;
  device?: DeviceTrigger;
  time?: TimeTrigger;
  voiceAssistant?: VoiceAssistantTrigger;

  constructor(init?: Partial<TriggerConfig>) {
    Object.assign(this, init);
  }
}
