import { DeviceType } from "./helper/DeviceType.js";
import { DeviceActive } from "./DeviceActive.js";
import { EventParameter } from "../../server/events/event-types/EventParameter.js";

export interface DeviceVirtualBinding {
  deviceId: string;
  actionActive:string;
  triggerActive:string;
  triggerValuesActive:EventParameter[];
  actionInactive:string;
  triggerInactive:string;
  triggerValuesInactive:EventParameter[];
}

export abstract class DeviceVirtual extends DeviceActive {
  attachment: DeviceVirtualBinding | undefined;

  constructor(init?: Partial<DeviceVirtual>) {
    super(init);
    this.type = DeviceType.VIRTUAL;
    this.attachment = init?.attachment ?? undefined;
  }
}
