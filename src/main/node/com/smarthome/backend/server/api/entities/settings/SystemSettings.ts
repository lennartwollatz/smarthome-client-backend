import { VersionInfo } from "./VersionInfo.js";
import { UpdateTimes } from "./UpdateTimes.js";

export class SystemSettings {
  frontend?: VersionInfo;
  backend?: VersionInfo;
  autoupdate?: boolean;
  updatetimes?: UpdateTimes;
  serverIp?: string;

  constructor(init?: Partial<SystemSettings>) {
    Object.assign(this, init);
  }
}
