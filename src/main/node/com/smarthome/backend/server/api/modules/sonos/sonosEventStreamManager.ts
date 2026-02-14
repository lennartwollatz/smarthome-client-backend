import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../../actions/actionManager.js";;
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { SonosSpeaker } from "./devices/sonosSpeaker.js";
import { DeviceSpeaker } from "../../../../model/devices/DeviceSpeaker.js";
import { SonosDeviceController } from "./sonosDeviceController.js";
import { SonosEvent } from "./sonosEvent.js";
import { SONOSMODULE } from "./sonosModule.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";

export class SonosEventStreamManager extends ModuleEventStreamManager<SonosDeviceController, SonosEvent> {

  constructor(managerId: string, controller: SonosDeviceController, actionManager: ActionManager) {
    super(managerId, SONOSMODULE.id, controller, actionManager);
  }

  protected async startEventStream(callback: (event: SonosEvent) => void): Promise<void> {
    let devices = this.actionManager.getDevices();
    for (const device of devices) {
      if (device.moduleId === SONOSMODULE.id && device.type === DeviceType.SPEAKER) {
        this.controller.startEventStream(device as SonosSpeaker, callback);
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    let devices = this.actionManager.getDevices();
    for (const device of devices) {
      if (device.moduleId === SONOSMODULE.id && device.type === DeviceType.SPEAKER) {
        this.controller.stopEventStream(device as SonosSpeaker);
      }
    }
  }

  protected async handleEvent(event: SonosEvent): Promise<void> {
    if (!event.deviceid || !event.data) {
      return;
    }

    logger.debug("handleEvent: " + JSON.stringify(event.data));
    
    // Parse the event data structure
    const eventData = event.data;
    switch (eventData.type) {
      case 'Volume':
        if (typeof eventData.value === 'number') {
          await this.handleVolumeChange(event.deviceid, eventData.value);
        }
        break;
      case 'Muted':
        if (typeof eventData.value === 'boolean') {
          await this.handleMuteChange(event.deviceid, eventData.value);
        }
        break;
      case 'PlayState':
        if (typeof eventData.value === 'string') {
          await this.handlePlayStateChange(event.deviceid, eventData.value);
        }
        break;
      default:
        logger.debug({ deviceId: event.deviceid, eventType: eventData.type }, "Unbehandeltes Event");
    }
  }

  private async handlePlayStateChange(deviceId: string, playState: string) {
    try {
      const device = this.actionManager.getDevice(deviceId);
      if (!device || !(device instanceof SonosSpeaker)) {
        return;
      }

      // Map Sonos state values to our format
      // Sonos returns: 'stopped', 'playing', 'paused', 'transitioning', 'no_media'
      // We need: 'play', 'pause', 'stop'
      let mappedState: string;
      if (playState === 'playing' || playState === 'transitioning') {
        mappedState = DeviceSpeaker.PlayState.PLAY;
      } else if (playState === 'paused') {
        mappedState = DeviceSpeaker.PlayState.PAUSE;
      } else {
        mappedState = DeviceSpeaker.PlayState.STOP;
      }

      const currentPlayState = device.playState;
      if (mappedState !== currentPlayState) {
        // Update the device state without triggering actions (false parameter)
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
        logger.debug({ speakerId: deviceId, playState: mappedState, originalState: playState }, "PlayState aktualisiert");
      }
    } catch (err) {
      logger.error({ err, speakerId: deviceId }, "Fehler beim Verarbeiten von PlayState-Aenderung");
    }
  }

  private async handleVolumeChange(deviceId: string, volume: number) {
    try {
      const device = this.actionManager.getDevice(deviceId);
      if (!device || !(device instanceof SonosSpeaker)) {
        return;
      }

      const deviceVolume = device.volume ?? 0;
      if (volume !== deviceVolume) {
        device.setVolume(volume, false);
        this.actionManager.saveDevice(device);
        logger.debug({ speakerId: deviceId, volume }, "Volume aktualisiert");
      }
    } catch (err) {
      logger.error({ err, speakerId: deviceId }, "Fehler beim Verarbeiten von Volume-Aenderung");
    }
  }

  private async handleMuteChange(deviceId: string, muted: boolean) {
    try {
      const device = this.actionManager.getDevice(deviceId);
      if (!device || !(device instanceof SonosSpeaker)) {
        return;
      }

      const deviceMuted = device.muted ?? false;
      if (muted !== deviceMuted) {
        device.setMute(muted, false);
        this.actionManager.saveDevice(device);
        logger.debug({ speakerId: deviceId, muted }, "Mute aktualisiert");
      }
    } catch (err) {
      logger.error({ err, speakerId: deviceId }, "Fehler beim Verarbeiten von Mute-Aenderung");
    }
  }
}

