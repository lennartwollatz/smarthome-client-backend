import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { HeosDeviceController } from "./heosDeviceController.js";
import { HeosEvent } from "./heosEvent.js";
import { DeviceSpeaker } from "../../../../model/devices/DeviceSpeaker.js";
import { HeosSpeaker } from "./devices/heosSpeaker.js";
import { HEOSMODULE } from "./heosModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

export class HeosEventStreamManager extends ModuleEventStreamManager<HeosDeviceController, HeosEvent> {

  constructor(managerId: string, moduleId:string, controller: HeosDeviceController, actionManager: ActionManager) {
    super(managerId, moduleId, controller, actionManager);
  }

  protected async startEventStream(callback: (event: HeosEvent) => void): Promise<void> {
    let devices = this.actionManager.getDevices();
    for (const device of devices) {
      if (device.moduleId === HEOSMODULE.id && device.type === DeviceType.SPEAKER) {
        await this.controller.startEventStream(device as HeosSpeaker, callback);
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    let devices = this.actionManager.getDevices();
    for (const device of devices) {
      if (device.moduleId === HEOSMODULE.id && device.type === DeviceType.SPEAKER) {
        await this.controller.stopEventStream(device as HeosSpeaker);
      }
    }
  }

  protected async handleEvent(event: HeosEvent): Promise<void> {
    if (!event.deviceid || !event.data) {
      return;
    }

    logger.debug("handleEvent: " + JSON.stringify(event.data));
    
    // Parse the event data structure
    const eventData = event.data;
    switch (eventData.type) {
      case 'player/volume_changed':
        if (typeof eventData.value === 'object') {
          await this.handleVolumeChange(event.deviceid, eventData.value as Record<string, unknown>);
        }
        break;
      case 'player/state_changed':
        if (typeof eventData.value === 'object') {
          await this.handlePlayStateChange(event.deviceid, eventData.value as Record<string, unknown>);
        }
        break;
      case 'player/mute_changed':
        if (typeof eventData.value === 'object') {
          await this.handleMuteChange(event.deviceid, eventData.value as Record<string, unknown>);
        }
        break;
      default:
        logger.debug({ deviceId: event.deviceid, eventType: eventData.type }, "Unbehandeltes Event");
    }
  }

  private async handleVolumeChange(deviceId: string, eventData: Record<string, unknown>) {
    try {
      const device = this.actionManager.getDevice(deviceId);
      if (!device || !(device instanceof HeosSpeaker)) {
        return;
      }

      const pid = eventData.pid;
      if (typeof pid === "number" && device.pid === pid) {
        const level = eventData.level;
        if (typeof level === "number") {
          device.setVolume(level, false);
          this.actionManager.saveDevice(device);
          logger.debug({ deviceId, volume: level }, "Volume aktualisiert");
        }
      }
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Verarbeiten von Volume-Aenderung");
    }
  }

  private async handlePlayStateChange(deviceId: string, eventData: Record<string, unknown>) {
    try {
      const device = this.actionManager.getDevice(deviceId);
      if (!device || !(device instanceof HeosSpeaker)) {
        return;
      }

      const pid = eventData.pid;
      if (typeof pid === "number" && device.pid === pid) {
        const state = eventData.state;
        if (typeof state === "string") {
          const mappedState = this.mapPlayState(state);
          const currentPlayState = device.playState;
          if (mappedState !== currentPlayState) {
            switch(mappedState) {
              case DeviceSpeaker.PlayState.PLAY:
                device.play(false);
                break;
              case DeviceSpeaker.PlayState.PAUSE:
                device.pause(false);
                break;
              default:
                device.stopp(false);
                break;
            }
            this.actionManager.saveDevice(device);
            logger.debug({ deviceId, playState: mappedState, originalState: state }, "PlayState aktualisiert");
          }
        }
      }
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Verarbeiten von PlayState-Aenderung");
    }
  }

  private async handleMuteChange(deviceId: string, eventData: Record<string, unknown>) {
    try {
      const device = this.actionManager.getDevice(deviceId);
      if (!device || !(device instanceof HeosSpeaker)) {
        return;
      }

      const pid = eventData.pid;
      if (typeof pid === "number" && device.pid === pid) {
        const mute = eventData.mute;
        if (typeof mute === "string") {
          const isMuted = mute === "on";
          device.setMute(isMuted, false);
          this.actionManager.saveDevice(device);
          logger.debug({ deviceId, muted: isMuted }, "Mute aktualisiert");
        }
      }
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Verarbeiten von Mute-Aenderung");
    }
  }

  private mapPlayState(state: string): string {
    if (state === "play") {
      return DeviceSpeaker.PlayState.PLAY;
    } else if (state === "pause") {
      return DeviceSpeaker.PlayState.PAUSE;
    } else {
      return DeviceSpeaker.PlayState.STOP;
    }
  }
}

