import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceTV extends Device {
  static TriggerFunctionName = {
    POWER_ON: "powerOn",
    POWER_OFF: "powerOff",
    SCREEN_ON: "screenOn",
    SCREEN_OFF: "screenOff",
    CHANNEL_CHANGED: "channelChanged",
    APP_CHANGED: "appChanged",
    CHANNEL_SELECTED: "channelSelected(string)",
    APP_SELECTED: "appSelected(string)",
    VOLUME_CHANGED: "volumeChanged",
    VOLUME_GREATER: "volumeGreater(int)",
    VOLUME_LESS: "volumeLess(int)"
  } as const;

  static ActionFunctionName = {
    POWER_ON: "powerOn",
    POWER_OFF: "powerOff",
    SCREEN_ON: "screenOn",
    SCREEN_OFF: "screenOff",
    SELECT_APP: "selectApp(string)",
    SELECT_CHANNEL: "selectChannel(string)",
    SET_VOLUME: "setVolume(int)"
  } as const;

  static BoolFunctionName = {
    POWER_ON: "powerOn",
    POWER_OFF: "powerOff",
    SCREEN_ON: "screenOn",
    SCREEN_OFF: "screenOff",
    VOLUME_GREATER: "volumeGreater(int)",
    VOLUME_LESS: "volumeLess(int)",
    APP_SELECTED: "appSelected(string)",
    CHANNEL_SELECTED: "channelSelected(string)"
  } as const;

  power?: boolean;
  screen?: boolean;
  volume = 0;
  channels?: Channel[];
  selectedChannel?: string;
  apps?: App[];
  selectedApp?: string;

  constructor(init?: Partial<DeviceTV>) {
    super();
    Object.assign(this, init);
    this.type = DeviceType.TV;
    this.icon = "&#128250;";
    this.typeLabel = "deviceType.tv";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      DeviceFunction.fromString(DeviceTV.BoolFunctionName.POWER_ON, 'bool'),
      DeviceFunction.fromString(DeviceTV.BoolFunctionName.POWER_OFF, 'bool'),
      DeviceFunction.fromString(DeviceTV.BoolFunctionName.SCREEN_ON, 'bool'),
      DeviceFunction.fromString(DeviceTV.BoolFunctionName.SCREEN_OFF, 'bool'),
      DeviceFunction.fromString(DeviceTV.BoolFunctionName.VOLUME_GREATER, 'bool'),
      DeviceFunction.fromString(DeviceTV.BoolFunctionName.VOLUME_LESS, 'bool'),
      DeviceFunction.fromString(DeviceTV.BoolFunctionName.APP_SELECTED, 'bool'),
      DeviceFunction.fromString(DeviceTV.BoolFunctionName.CHANNEL_SELECTED, 'bool')
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [
      DeviceFunction.fromString(DeviceTV.ActionFunctionName.POWER_ON, 'void'),
      DeviceFunction.fromString(DeviceTV.ActionFunctionName.POWER_OFF, 'void'),
      DeviceFunction.fromString(DeviceTV.ActionFunctionName.SCREEN_ON, 'void'),
      DeviceFunction.fromString(DeviceTV.ActionFunctionName.SCREEN_OFF, 'void'),
      DeviceFunction.fromString(DeviceTV.ActionFunctionName.SELECT_APP, 'void'),
      DeviceFunction.fromString(DeviceTV.ActionFunctionName.SELECT_CHANNEL, 'void'),
      DeviceFunction.fromString(DeviceTV.ActionFunctionName.SET_VOLUME, 'void')
    ];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.POWER_ON, 'void'),
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.POWER_OFF, 'void'),
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.SCREEN_ON, 'void'),
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.SCREEN_OFF, 'void'),
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.CHANNEL_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.APP_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.CHANNEL_SELECTED, 'void'),
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.APP_SELECTED, 'void'),
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.VOLUME_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.VOLUME_GREATER, 'void'),
      DeviceFunction.fromString(DeviceTV.TriggerFunctionName.VOLUME_LESS, 'void')
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceTV.TriggerFunctionName).includes(
      triggerName as (typeof DeviceTV.TriggerFunctionName)[keyof typeof DeviceTV.TriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceTV.TriggerFunctionName.POWER_ON && this.powerOn()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceTV.TriggerFunctionName.POWER_OFF && this.powerOff()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceTV.TriggerFunctionName.SCREEN_ON && this.screenOn()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceTV.TriggerFunctionName.SCREEN_OFF && this.screenOff()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceTV.TriggerFunctionName.CHANNEL_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceTV.TriggerFunctionName.APP_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceTV.TriggerFunctionName.CHANNEL_SELECTED) {
      listeners
        .filter(pair => {
          const channelId = pair.getParams()?.getParam1AsString();
          return channelId != null && this.channelSelected(channelId);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceTV.TriggerFunctionName.APP_SELECTED) {
      listeners
        .filter(pair => {
          const appId = pair.getParams()?.getParam1AsString();
          return appId != null && this.appSelected(appId);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceTV.TriggerFunctionName.VOLUME_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceTV.TriggerFunctionName.VOLUME_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.volumeGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceTV.TriggerFunctionName.VOLUME_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.volumeLess(threshold);
        })
        .forEach(pair => pair.run());
    }
  }

  setPower(power: boolean, execute: boolean) {
    this.power = power;
    if (execute) {
      this.executeSetPower(power);
    }
  }

  protected abstract executeSetPower(power: boolean): void;

  setScreen(screen: boolean, execute: boolean) {
    this.screen = screen;
    if (execute) {
      this.executeSetScreen(screen);
    }
  }

  protected abstract executeSetScreen(screen: boolean): void;

  setChannel(channel: string, execute: boolean) {
    this.selectedChannel = channel;
    this.power = true;
    if (execute) {
      this.executeSetChannel(channel);
    }
  }

  protected abstract executeSetChannel(channel: string): void;

  startApp(appId: string, execute: boolean) {
    this.selectedApp = appId;
    this.power = true;
    if (execute) {
      this.executeStartApp(appId);
    }
  }

  protected abstract executeStartApp(appId: string): void;

  notify(message: string, execute: boolean) {
    if (execute) {
      this.executeNotify(message);
    }
  }

  protected abstract executeNotify(message: string): void;

  setVolume(volume: number, execute: boolean) {
    this.volume = volume;
    if (execute) {
      this.executeSetVolume(volume);
    }
  }

  protected abstract executeSetVolume(volume: number): void;

  getChannels() {
    return this.channels;
  }

  getApps() {
    return this.apps;
  }

  powerOn() {
    return this.power === true;
  }

  powerOff() {
    return this.power === false;
  }

  screenOn() {
    return this.screen === true;
  }

  screenOff() {
    return this.screen === false;
  }

  volumeGreater(threshold: number) {
    return this.volume > threshold;
  }

  volumeLess(threshold: number) {
    return this.volume < threshold;
  }

  appSelected(appId: string) {
    return appId != null && appId === this.selectedApp;
  }

  channelSelected(channelId: string) {
    return channelId != null && channelId === this.selectedChannel;
  }
}

export class Channel {
  id?: string;
  name?: string;
  channelNumber?: number;
  homeChannelNumber?: number;
  channelType?: string;
  hd?: boolean;
  imgUrl?: string;

  constructor(
    id?: string,
    name?: string,
    channelNumber?: number,
    homeChannelNumber?: number,
    channelType?: string,
    hd?: boolean,
    imgUrl?: string
  ) {
    this.id = id;
    this.name = name;
    this.channelNumber = channelNumber;
    this.homeChannelNumber = homeChannelNumber;
    this.channelType = channelType;
    this.hd = hd;
    this.imgUrl = imgUrl;
  }

  getId() {
    return this.id;
  }

  setId(id: string) {
    this.id = id;
  }

  getName() {
    return this.name;
  }

  setName(name: string) {
    this.name = name;
  }

  getChannelNumber() {
    return this.channelNumber;
  }

  setChannelNumber(channelNumber: number) {
    this.channelNumber = channelNumber;
  }

  getChannelType() {
    return this.channelType;
  }

  setChannelType(channelType: string) {
    this.channelType = channelType;
  }

  getHd() {
    return this.hd;
  }

  setHd(hd: boolean) {
    this.hd = hd;
  }

  getImgUrl() {
    return this.imgUrl;
  }

  setImgUrl(imgUrl: string) {
    this.imgUrl = imgUrl;
  }

  getHomeChannelNumber() {
    return this.homeChannelNumber;
  }

  setHomeChannelNumber(homeChannelNumber: number) {
    this.homeChannelNumber = homeChannelNumber;
  }
}

export class App {
  id?: string;
  name?: string;
  imgUrl?: string;
  homeAppNumber?: number;

  constructor(id?: string, name?: string, imgUrl?: string, homeAppNumber?: number) {
    this.id = id;
    this.name = name;
    this.imgUrl = imgUrl;
    this.homeAppNumber = homeAppNumber;
  }

  getId() {
    return this.id;
  }

  setId(id: string) {
    this.id = id;
  }

  getName() {
    return this.name;
  }

  setName(name: string) {
    this.name = name;
  }

  getImgUrl() {
    return this.imgUrl;
  }

  setImgUrl(imgUrl: string) {
    this.imgUrl = imgUrl;
  }

  getHomeAppNumber() {
    return this.homeAppNumber;
  }

  setHomeAppNumber(homeAppNumber: number) {
    this.homeAppNumber = homeAppNumber;
  }
}
