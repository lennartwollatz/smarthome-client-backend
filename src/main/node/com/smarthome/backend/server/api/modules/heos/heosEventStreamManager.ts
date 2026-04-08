import { logger } from "../../../../logger.js";
import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { HeosDeviceController } from "./heosDeviceController.js";
import { HeosEvent } from "./heosEvent.js";
import { DeviceSpeaker } from "../../../../model/devices/DeviceSpeaker.js";
import { HeosSpeaker } from "./devices/heosSpeaker.js";
import { DeviceType } from "../../../../model/devices/helper/DeviceType.js";
import { DeviceManager } from "../../entities/devices/deviceManager.js";
import { DenonReceiver } from "./denon/devices/denonReceiver.js";
import { DENONCONFIG } from "./denon/denonModule.js";
import { DenonSpeaker } from "./denon/devices/denonSpeaker.js";

export class HeosEventStreamManager extends ModuleEventStreamManager<HeosDeviceController, HeosEvent> {

  constructor(managerId: string, moduleId:string, controller: HeosDeviceController, deviceManager: DeviceManager) {
    super(managerId, moduleId, controller, deviceManager);
  }

  protected async startEventStream(callback: (event: HeosEvent) => void): Promise<void> {
    let devices = this.deviceManager.getDevicesForModule(DENONCONFIG.id);
    for (const device of devices) {
      if (device.moduleId === DENONCONFIG.id && device.type === DeviceType.SPEAKER) {
        await this.controller.startEventStream(device as HeosSpeaker, callback);
      }
      if (device.moduleId === DENONCONFIG.id && device.type === DeviceType.SPEAKER_RECEIVER) {
        await this.controller.startEventStream(device as DenonReceiver, callback);
      }
    }
  }

  protected async stopEventStream(): Promise<void> {
    let devices = this.deviceManager.getDevicesForModule(DENONCONFIG.id);
    for (const device of devices) {
      if (device.moduleId === DENONCONFIG.id && device.type === DeviceType.SPEAKER) {
        await this.controller.stopEventStream(device as HeosSpeaker);
      }
      if (device.moduleId === DENONCONFIG.id && device.type === DeviceType.SPEAKER_RECEIVER) {
        await this.controller.stopEventStream(device as DenonReceiver);
      }
    }
  }

  protected async handleEvent(event: HeosEvent): Promise<void> {
    if (!event.deviceid || !event.data) {
      return;
    }

    const heos = event.data.heos;
    if (!heos?.command) {
      return;
    }

    const device = this.deviceManager.getDevice(event.deviceid);
    if (!device || !(device instanceof HeosSpeaker || device instanceof DenonReceiver|| device instanceof DenonSpeaker)) {
      return;
    }

    const data = this.parseHeosEventMessage(heos.message as string);

    if( data.pid && data.pid !== device.pid ){
      return;
    }

    switch (heos.command) {
      case "event/player_volume_changed":
        await this.handleVolumeChange(device, data);
        break;
      case "event/player_state_changed":
        await this.handlePlayStateChange(device, data);
        break;
      case "event/player_mute_changed":
        await this.handleMuteChange(device, data);
        break;
      case "event/player_now_playing_progress":
        //TODO: später hinzufügen.
        break;
      case "event/player_now_playing_changed":
        //TODO: später hinzufügen.
        break;
      default:
        logger.debug({ deviceId: event.deviceid, command: heos.command }, "Unbehandeltes HEOS-Event");
    }
  }

  /** HEOS liefert `message` als `key=value&…` (ähnlich wie Query-String). */
  private parseHeosEventMessage(message: string | undefined): Record<string, unknown> {
    if (!message) {
      return {};
    }
    const out: Record<string, unknown> = {};
    for (const part of message.split("&")) {
      if (!part) {
        continue;
      }
      const eq = part.indexOf("=");
      if (eq === -1) {
        continue;
      }
      const key = part.slice(0, eq);
      const rawVal = part.slice(eq + 1);
      const decoded = decodeURIComponent(rawVal.replace(/\+/g, " "));
      const asNum = Number(decoded);
      const isIntLike = /^-?\d+$/.test(decoded);
      out[key] = isIntLike && Number.isFinite(asNum) ? asNum : decoded;
    }
    return out;
  }

  private async handleVolumeChange(device: HeosSpeaker | DenonReceiver | DenonSpeaker, data: Record<string, unknown>) {
    try {
      if( data.level && Number(data.level) !== device.volume ){
        device.setVolume(Number(data.level), false);
        this.deviceManager.saveDevice(device);
      }
      if( data.mute && (data.mute === "on") !== device.muted ){
        device.setMute(data.mute === "on", false);
        this.deviceManager.saveDevice(device);
      }
    } catch (err) {
      logger.error({ err, device }, "Fehler beim Verarbeiten von Volume-Aenderung");
    }
  }

  private async handlePlayStateChange(device: HeosSpeaker | DenonReceiver | DenonSpeaker, data: Record<string, unknown>) {
    try {

      if( data.state ){
        switch(data.state){
          case "play":
            if( device.playState !== DeviceSpeaker.PlayState.PLAY ){
              device.play(false);
              this.deviceManager.saveDevice(device);
            }
            break;
          case "pause":
            if( device.playState !== DeviceSpeaker.PlayState.PAUSE ){
              device.pause(false);
              this.deviceManager.saveDevice(device);
            }
            break;
          case "stop":
            if( device.playState !== DeviceSpeaker.PlayState.STOP ){
              device.stop(false);
              this.deviceManager.saveDevice(device);
            }
            break;
        }
      }
    } catch (err) {
      logger.error({ err, device }, "Fehler beim Verarbeiten von PlayState-Aenderung");
    }
  }

  private async handleMuteChange(device: HeosSpeaker | DenonReceiver | DenonSpeaker, data: Record<string, unknown>) {
    try {

      if( data.level && Number(data.level) !== device.volume ){
        device.setVolume(Number(data.level), false);
        this.deviceManager.saveDevice(device);
      }
      if( data.mute && (data.mute === "on") !== device.muted ){
        device.setMute(data.mute === "on", false);
        this.deviceManager.saveDevice(device);
      }
    } catch (err) {
      logger.error({ err, device }, "Fehler beim Verarbeiten von Mute-Aenderung");
    }
  }
}

