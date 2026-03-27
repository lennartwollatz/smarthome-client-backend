import { EventParameter } from "../../../../events/event-types/EventParameter.js";
import { EventType } from "../../../../events/event-types/EventType.js";

export class DeviceTrigger {
  triggerDeviceId?: string;
  triggerModuleId?: string;
  triggerEvent?: EventType;
  triggerValues?: EventParameter[];

  constructor(init?: Partial<DeviceTrigger>) {
    Object.assign(this, init);
  }
}
