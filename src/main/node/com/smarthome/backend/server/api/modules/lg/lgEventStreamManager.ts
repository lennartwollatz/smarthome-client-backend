import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { LGDeviceController } from "./lgDeviceController.js";
import { LGEvent } from "./lgEvent.js";
import { DeviceTV } from "../../../../model/devices/DeviceTV.js";
import { LGTV } from "./devices/lgtv.js";
import { LGMODULE } from "./lgModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

export class LGEventStreamManager extends ModuleEventStreamManager<LGDeviceController, LGEvent> {
  constructor(managerId: string, controller: LGDeviceController, actionManager: ActionManager) {
    super(managerId, LGMODULE.id, controller, actionManager);
  }

  protected async startEventStream(callback: (event: LGEvent) => void): Promise<void> {
    let devices = this.actionManager.getDevicesForModule(LGMODULE.id);
    for (const device of devices) {
      if (device.type === DeviceType.TV) {
        if (device instanceof LGTV) {
          await this.controller.startEventStream(device as DeviceTV, callback);
        }
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    let devices = this.actionManager.getDevicesForModule(LGMODULE.id);
    for (const device of devices) {
      if (device.type === DeviceType.TV) {
        if (device instanceof LGTV) {
          await this.controller.stopEventStream(device as DeviceTV);
        }
      }
    }
  }

  protected async handleEvent(event: LGEvent): Promise<void> {
    if (!event.deviceid || !event.data) {
      return;
    }

    logger.debug("handleEvent: " + JSON.stringify(event.data));
    
    const device = this.actionManager.getDevice(event.deviceid);
    if (!device || !(device instanceof LGTV) || device.moduleId !== LGMODULE.id) return;

    const eventData = event.data;
    const eventName = eventData.type as string | undefined;
    const payload = eventData.value as Record<string, unknown> | string | undefined;
    
    if (!eventName || payload == null) return;

    if (eventName === "app.current") {
      const appId = this.extractAppId(payload);
      if (appId) {
        device.startApp(appId, false);
        this.actionManager.saveDevice(device);
      }
    }
    if (eventName === "channel.current") {
      const channelId = this.extractChannelId(payload);
      if (channelId) {
        device.setChannel(channelId, false);
        this.actionManager.saveDevice(device);
      }
    }
  }

  private extractAppId(payload: Record<string, unknown> | string) {
    if (typeof payload === "string") return payload;
    if (payload.id && typeof payload.id === "string") return payload.id;
    if (payload.appId && typeof payload.appId === "string") return payload.appId;
    return null;
  }

  private extractChannelId(payload: Record<string, unknown> | string) {
    if (typeof payload === "string") return payload;
    if (payload.channelId && typeof payload.channelId === "string") return payload.channelId;
    if (payload.id && typeof payload.id === "string") return payload.id;
    return null;
  }
}

