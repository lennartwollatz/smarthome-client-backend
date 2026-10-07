import type { Request_GetSystemInfo } from "../../model/requests/Request_GetSystemInfo.js";
import type { Request_InstallUpdate } from "../../model/requests/Request_InstallUpdate.js";
import type { Request_UpdateAutoUpdateSettings } from "../../model/requests/Request_UpdateAutoUpdateSettings.js";
import { Response_GetSystemInfo } from "../../model/responses/Response_GetSystemInfo.js";
import { Response_InstallUpdate } from "../../model/responses/Response_InstallUpdate.js";
import { Response_UpdateAutoUpdateSettings } from "../../model/responses/Response_UpdateAutoUpdateSettings.js";
import type { SettingsService } from "./settings.service.js";

export class SystemService {
  constructor(private readonly settingsService: SettingsService) {}

  async getSystemInfo(_request: Request_GetSystemInfo): Promise<Response_GetSystemInfo> {
    const { system } = await this.settingsService.loadOrCreateSettings();
    return new Response_GetSystemInfo(system);
  }

  async installUpdate(request: Request_InstallUpdate): Promise<Response_InstallUpdate> {
    const { system } = await this.settingsService.loadOrCreateSettings();
    const version = system[request.component];
    if (version) {
      version.currentVersion = version.latestVersion;
      version.hasUpdate = false;
    }
    return new Response_InstallUpdate(system);
  }

  async updateAutoUpdateSettings(
    request: Request_UpdateAutoUpdateSettings
  ): Promise<Response_UpdateAutoUpdateSettings> {
    await this.settingsService.saveAutoUpdateSettings(request);
    return new Response_UpdateAutoUpdateSettings(request);
  }
}
