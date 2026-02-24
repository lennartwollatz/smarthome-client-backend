import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceSpeaker extends Device {
  static PlayState = {
    PLAY: "play",
    PAUSE: "pause",
    STOP: "stop"
  } as const;

  static TriggerFunctionName = {
    ON_VOLUME_CHANGED: "onVolumeChanged",
    ON_VOLUME_LESS: "onVolumeLess(int)",
    ON_VOLUME_GREATER: "onVolumeGreater(int)",
    ON_VOLUME_REACHES: "onVolumeReaches(int)",
    ON_PLAY: "onPlay",
    ON_STOP: "onStop",
    ON_MUTE: "onMute",
    ON_PAUSE: "onPause",
    ON_NEXT: "onNext",
    ON_PREVIOUS: "onPrevious"
  } as const;

  static ActionFunctionName = {
    SET_VOLUME: "setVolume(int)",
    PLAY: "play",
    PAUSE: "pause",
    STOPP: "stopp",
    SET_MUTE: "setMute",
    PLAY_NEXT: "playNext",
    PLAY_PREVIOUS: "playPrevious",
    PLAY_SOUND: "playSound(string)",
    PLAY_TEXT_AS_SOUND: "playTextAsSound(string)"
  } as const;

  static BoolFunctionName = {
    IS_PLAYING: "isPlaying",
    IS_PAUSING: "isPausing",
    IS_STOPPED: "isStopped",
    IS_VOLUME_GREATER: "isVolumeGreater(int)",
    IS_VOLUME_LESS: "isVolumeLess(int)",
    IS_VOLUME: "isVolume(int)"
  } as const;

  playState?: string;
  volume?: number;
  muted?: boolean;

  constructor(init?: Partial<DeviceSpeaker>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.SPEAKER;
    this.icon = "&#128266;";
    this.typeLabel = "deviceType.speaker";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  static playStateFromString(value?: string | null) {
    if (!value) return null;
    const values = Object.values(DeviceSpeaker.PlayState) as string[];
    return values.includes(value) ? value : null;
  }

  abstract updateValues(): Promise<void>;

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      DeviceFunction.fromString(DeviceSpeaker.BoolFunctionName.IS_PLAYING, 'bool'),
      DeviceFunction.fromString(DeviceSpeaker.BoolFunctionName.IS_PAUSING, 'bool'),
      DeviceFunction.fromString(DeviceSpeaker.BoolFunctionName.IS_STOPPED, 'bool'),
      DeviceFunction.fromString(DeviceSpeaker.BoolFunctionName.IS_VOLUME_GREATER, 'bool'),
      DeviceFunction.fromString(DeviceSpeaker.BoolFunctionName.IS_VOLUME_LESS, 'bool'),
      DeviceFunction.fromString(DeviceSpeaker.BoolFunctionName.IS_VOLUME, 'bool')
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [
      DeviceFunction.fromString(DeviceSpeaker.ActionFunctionName.SET_VOLUME, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.ActionFunctionName.PLAY, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.ActionFunctionName.PAUSE, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.ActionFunctionName.STOPP, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.ActionFunctionName.SET_MUTE, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.ActionFunctionName.PLAY_NEXT, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.ActionFunctionName.PLAY_PREVIOUS, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.ActionFunctionName.PLAY_SOUND, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.ActionFunctionName.PLAY_TEXT_AS_SOUND, 'void')
    ];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      DeviceFunction.fromString(DeviceSpeaker.TriggerFunctionName.ON_VOLUME_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.TriggerFunctionName.ON_VOLUME_LESS, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.TriggerFunctionName.ON_VOLUME_GREATER, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.TriggerFunctionName.ON_PLAY, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.TriggerFunctionName.ON_STOP, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.TriggerFunctionName.ON_MUTE, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.TriggerFunctionName.ON_PAUSE, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.TriggerFunctionName.ON_NEXT, 'void'),
      DeviceFunction.fromString(DeviceSpeaker.TriggerFunctionName.ON_PREVIOUS, 'void')
    ];
  }

  isPlaying() {
    return this.playState === DeviceSpeaker.PlayState.PLAY;
  }

  isPausing() {
    return this.playState === DeviceSpeaker.PlayState.PAUSE;
  }

  isStopped() {
    return this.playState === DeviceSpeaker.PlayState.STOP;
  }

  isVolumeGreater(volume: number) {
    return this.volume != null && this.volume > volume;
  }

  isVolumeLess(volume: number) {
    return this.volume != null && this.volume < volume;
  }

  isVolume(volume: number) {
    return this.volume != null && this.volume === volume;
  }

  setVolume(volume: number, execute: boolean) {
    this.volume = volume;
    this.muted = volume === 0;
    if (execute) {
      this.executeSetVolume(volume);
    }
    this.checkListener(DeviceSpeaker.TriggerFunctionName.ON_VOLUME_CHANGED);
    this.checkListener(DeviceSpeaker.TriggerFunctionName.ON_VOLUME_LESS);
    this.checkListener(DeviceSpeaker.TriggerFunctionName.ON_VOLUME_GREATER);
  }

  protected abstract executeSetVolume(volume: number): void;

  play(execute: boolean) {
    this.playState = DeviceSpeaker.PlayState.PLAY;
    this.muted = false;
    if (execute) {
      this.executePlay();
    }
    this.checkListener(DeviceSpeaker.TriggerFunctionName.ON_PLAY);
  }

  protected abstract executePlay(): void;

  pause(execute: boolean) {
    this.playState = DeviceSpeaker.PlayState.PAUSE;
    if (execute) {
      this.executePause();
    }
    this.checkListener(DeviceSpeaker.TriggerFunctionName.ON_PAUSE);
  }

  protected abstract executePause(): void;

  stopp(execute: boolean) {
    this.playState = DeviceSpeaker.PlayState.STOP;
    if (execute) {
      this.executeStopp();
    }
    this.checkListener(DeviceSpeaker.TriggerFunctionName.ON_STOP);
  }

  protected abstract executeStopp(): void;

  setMute(muted: boolean, execute: boolean) {
    this.muted = muted;
    if (execute) {
      this.executeSetMute(muted);
    }
    this.checkListener(DeviceSpeaker.TriggerFunctionName.ON_MUTE);
  }

  protected abstract executeSetMute(muted: boolean): void;

  playNext() {
    this.play(true);
    this.executePlayNext();
    this.checkListener(DeviceSpeaker.TriggerFunctionName.ON_NEXT);
  }

  protected abstract executePlayNext(): void;

  playPrevious() {
    this.play(true);
    this.executePlayPrevious();
    this.checkListener(DeviceSpeaker.TriggerFunctionName.ON_PREVIOUS);
  }

  protected abstract executePlayPrevious(): void;

  playSound(sound: string) {
    this.play(true);
    this.executePlaySound(sound);
  }

  protected abstract executePlaySound(sound: string): void;

  playTextAsSound(text: string) {
    this.play(true);
    this.executePlayTextAsSound(text);
  }

  protected abstract executePlayTextAsSound(text: string): void;

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceSpeaker.TriggerFunctionName).includes(
      triggerName as (typeof DeviceSpeaker.TriggerFunctionName)[keyof typeof DeviceSpeaker.TriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceSpeaker.TriggerFunctionName.ON_VOLUME_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceSpeaker.TriggerFunctionName.ON_VOLUME_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.isVolumeLess(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceSpeaker.TriggerFunctionName.ON_VOLUME_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.isVolumeGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceSpeaker.TriggerFunctionName.ON_PLAY) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceSpeaker.TriggerFunctionName.ON_STOP) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceSpeaker.TriggerFunctionName.ON_MUTE) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceSpeaker.TriggerFunctionName.ON_PAUSE) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceSpeaker.TriggerFunctionName.ON_NEXT) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceSpeaker.TriggerFunctionName.ON_PREVIOUS) {
      listeners.forEach(listener => listener.run());
    }
  }
}
