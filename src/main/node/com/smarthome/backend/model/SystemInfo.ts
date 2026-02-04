import { VersionInfo } from "./VersionInfo.js";

export class SystemInfo {
  frontend?: VersionInfo;
  backend?: VersionInfo;
  serverIp?: string;

  constructor(init?: Partial<SystemInfo>) {
    Object.assign(this, init);
  }
}
