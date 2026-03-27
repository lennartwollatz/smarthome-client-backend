import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { LGDeviceController } from "./lgDeviceController.js";
import { LGEvent } from "./lgEvent.js";
import { DeviceTV } from "../../../../model/devices/DeviceTV.js";
import { LGTV } from "./devices/lgtv.js";
import { LGMODULE } from "./lgModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";

export class LGEventStreamManager extends ModuleEventStreamManager<LGDeviceController, LGEvent> {
  constructor(managerId: string, controller: LGDeviceController, deviceManager: DeviceManager) {
    super(managerId, LGMODULE.id, controller, deviceManager);
  }

  protected async startEventStream(callback: (event: LGEvent) => void): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(LGMODULE.id);
    for (const device of devices) {
      if (device.type === DeviceType.TV) {
        const tv = device as DeviceTV;
        setImmediate(() => this.controller.startEventStream(tv, callback));
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    const devices = this.deviceManager.getDevicesForModule(LGMODULE.id);
    const stops = devices
      .filter(d => d.type === DeviceType.TV)
      .map(d => this.controller.stopEventStream(d as DeviceTV));
    await Promise.all(stops);
  }

  protected async handleEvent(event: LGEvent): Promise<void> {
    if (!event.deviceid || !event.data) {
      return;
    }

    const eventData = event.data;
    const eventName = eventData.type as string | undefined;
    const payload = eventData.value as Record<string, unknown> | string | undefined;

    if (!eventName || payload == null) return;
    if (eventName !== "app.current" && eventName !== "channel.current") {
      return;
    }

    const device = this.deviceManager.getDevice(event.deviceid);
    if (!device || !(device instanceof LGTV) || device.moduleId !== LGMODULE.id) return;

    if (eventName === "app.current") {
      const appId = this.extractAppId(payload);
      if (appId) {
        await device.startApp(appId, false, false);
        this.deviceManager.saveDevice(device);
      }
    }
    if (eventName === "channel.current") {
      const channelId = this.extractChannelId(payload);
      if (channelId) {
        await device.setChannel(channelId, false, false);
        this.deviceManager.saveDevice(device);
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

