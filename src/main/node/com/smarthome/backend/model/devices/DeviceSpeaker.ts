import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventSpeakerStatusChanged } from "../../server/events/events/EventSpeakerStatusChanged.js";
import { EventVolumeChanged } from "../../server/events/events/EventVolumeChanged.js";
import { EventVolumeEquals } from "../../server/events/events/EventVolumeEquals.js";
import { EventVolumeLess } from "../../server/events/events/EventVolumeLess.js";
import { EventVolumeGreater } from "../../server/events/events/EventVolumeGreater.js";
import { EventPlay } from "../../server/events/events/EventPlay.js";
import { EventPause } from "../../server/events/events/EventPause.js";
import { EventStop } from "../../server/events/events/EventStop.js";
import { EventMute } from "../../server/events/events/EventMute.js";
import { EventNext } from "../../server/events/events/EventNext.js";
import { EventPrevious } from "../../server/events/events/EventPrevious.js";

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
  }

  static playStateFromString(value?: string | null) {
    if (!value) return null;
    const values = Object.values(DeviceSpeaker.PlayState) as string[];
    return values.includes(value) ? value : null;
  }

  abstract updateValues(): Promise<void>;



  async setVolume(volume: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.volume = volume;
    this.muted = volume === 0;
    if (execute) {
      await this.executeSetVolume(volume);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventVolumeChanged(this.id, deviceBefore, volume));
      this.eventManager?.triggerEvent(new EventVolumeEquals(this.id, deviceBefore, volume));
      this.eventManager?.triggerEvent(new EventVolumeLess(this.id, deviceBefore, volume));
      this.eventManager?.triggerEvent(new EventVolumeGreater(this.id, deviceBefore, volume));
    }
  }

  protected abstract executeSetVolume(volume: number): Promise<void>;

  async play(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.playState = DeviceSpeaker.PlayState.PLAY;
    this.muted = false;
    if (execute) {
      await this.executePlay();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventPlay(this.id, deviceBefore));
    }
  }

  protected abstract executePlay(): Promise<void>;

  async pause(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.playState = DeviceSpeaker.PlayState.PAUSE;
    if (execute) {
      await this.executePause();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventPause(this.id, deviceBefore));
    }
  }

  protected abstract executePause(): Promise<void>;

  async stopp(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.playState = DeviceSpeaker.PlayState.STOP;
    if (execute) {
      await this.executeStopp();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventStop(this.id, deviceBefore));
    }
  }

  protected abstract executeStopp(): Promise<void>;

  async setMute(muted: boolean, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.muted = muted;
    if (execute) {
      await this.executeSetMute(muted);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventMute(this.id, deviceBefore, muted));
    }
  }

  protected abstract executeSetMute(muted: boolean): Promise<void>;

  async playNext(trigger: boolean = true) {
    const deviceBefore = { ...this };
    await this.play(true, false);
    await this.executePlayNext();
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventNext(this.id, deviceBefore));
    }
  }

  protected abstract executePlayNext(): Promise<void>;

  async playPrevious(trigger: boolean = true) {
    const deviceBefore = { ...this };
    await this.play(true, false);
    await this.executePlayPrevious();
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSpeakerStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventPrevious(this.id, deviceBefore));
    }
  }

  protected abstract executePlayPrevious(): Promise<void>;

  async playSound(sound: string) {
    await this.play(true, false);
    await this.executePlaySound(sound);
  }

  protected abstract executePlaySound(sound: string): Promise<void>;

  async playTextAsSound(text: string) {
    await this.play(true, false);
    await this.executePlayTextAsSound(text);
  }

  protected abstract executePlayTextAsSound(text: string): Promise<void>;
}
