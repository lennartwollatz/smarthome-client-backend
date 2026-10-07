import type { SystemSettings } from "../SystemSettings.js";
import type { VersionInfo } from "../VersionInfo.js";

/** Versionsstand einer Komponente (Frontend oder Backend). */
export class Response_VersionInfo {
  readonly currentVersion?: string;
  readonly latestVersion?: string;
  readonly hasUpdate?: boolean;

  constructor(version: VersionInfo) {
    this.currentVersion = version.currentVersion;
    this.latestVersion = version.latestVersion;
    this.hasUpdate = version.hasUpdate;
  }
}

/** Versionen und Server-IP, wie sie die System-Endpunkte zurückgeben. */
export class Response_SystemInfo {
  readonly frontend?: Response_VersionInfo;
  readonly backend?: Response_VersionInfo;
  readonly serverIp?: string;

  constructor(system: SystemSettings) {
    this.frontend = system.frontend && new Response_VersionInfo(system.frontend);
    this.backend = system.backend && new Response_VersionInfo(system.backend);
    this.serverIp = system.serverIp;
  }
}
