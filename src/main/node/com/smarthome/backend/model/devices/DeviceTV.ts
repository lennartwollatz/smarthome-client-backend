import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventPowerToggled } from "../../server/events/events/EventPowerToggled.js";
import { EventPowerOn } from "../../server/events/events/EventPowerOn.js";
import { EventPowerOff } from "../../server/events/events/EventPowerOff.js";
import { EventTVStatusChanged } from "../../server/events/events/EventTVStatusChanged.js";
import { EventTVScreenChanged } from "../../server/events/events/EventTVScreenChanged.js";
import { EventTVScreenOn } from "../../server/events/events/EventTVScreenOn.js";
import { EventTVScreenOff } from "../../server/events/events/EventTVScreenOff.js";
import { EventTVChannelChanged } from "../../server/events/events/EventTVChannelChanged.js";
import { EventTVChannelSelected } from "../../server/events/events/EventTVChannelSelected.js";
import { EventTVAppChanged } from "../../server/events/events/EventTVAppChanged.js";
import { EventTVAppSelected } from "../../server/events/events/EventTVAppSelected.js";
import { EventVolumeChanged } from "../../server/events/events/EventVolumeChanged.js";
import { EventVolumeEquals } from "../../server/events/events/EventVolumeEquals.js";
import { EventVolumeLess } from "../../server/events/events/EventVolumeLess.js";
import { EventVolumeGreater } from "../../server/events/events/EventVolumeGreater.js";

export abstract class DeviceTV extends Device {
  power?: boolean;
  screen?: boolean;
  volume = 0;
  channels?: Channel[];
  selectedChannel?: string;
  apps?: App[];
  selectedApp?: string;

  constructor(init?: Partial<DeviceTV>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.TV;
  }


  async setPowerOn(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.power = true;
    if (execute) {
      await this.executeSetPowerOn();
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventPowerOn(this.id, (deviceBefore as { power?: boolean }).power ?? false));
      await this.eventManager?.triggerEvent(new EventTVStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetPowerOn(): Promise<void>;

  async setPowerOff(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.power = false;
    if (execute) {
      await this.executeSetPowerOff();
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventPowerOff(this.id, (deviceBefore as { power?: boolean }).power ?? false));
      await this.eventManager?.triggerEvent(new EventTVStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetPowerOff(): Promise<void>;

  async setPower(power: boolean, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.power = power;
    if (execute) {
      await this.executeSetPower(power);
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventPowerToggled(this.id, power));
      await this.eventManager?.triggerEvent(new EventTVStatusChanged(this.id, deviceBefore, { ...this }));
      if(power){
        await this.eventManager?.triggerEvent(new EventPowerOn(this.id, (deviceBefore as { power?: boolean }).power ?? false));
      } else {
        await this.eventManager?.triggerEvent(new EventPowerOff(this.id, (deviceBefore as { power?: boolean }).power ?? false));
      }
    }
  }

  protected abstract executeSetPower(power: boolean): Promise<void>;

  async setScreen(screen: boolean, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.screen = screen;
    if (execute) {
      this.executeSetScreen(screen);
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventTVScreenChanged(this.id, deviceBefore, screen));
      await this.eventManager?.triggerEvent(new EventTVStatusChanged(this.id, deviceBefore, { ...this }));
      if(screen){
        await this.eventManager?.triggerEvent(new EventTVScreenOn(this.id, deviceBefore, screen));
      } else {
        await this.eventManager?.triggerEvent(new EventTVScreenOff(this.id, deviceBefore, screen));
      }
    }
  }

  protected abstract executeSetScreen(screen: boolean): Promise<void>;

  async setChannel(channel: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.selectedChannel = channel;
    this.power = true;
    if (execute) {
      this.executeSetChannel(channel);
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventTVChannelChanged(this.id, deviceBefore, channel));
      await this.eventManager?.triggerEvent(new EventTVChannelSelected(this.id, deviceBefore, channel));
      await this.eventManager?.triggerEvent(new EventTVStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetChannel(channel: string): Promise<void>;

  async startApp(appId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.selectedApp = appId;
    this.power = true;
    if (execute) {
      this.executeStartApp(appId);
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventTVAppChanged(this.id, deviceBefore, appId));
      await this.eventManager?.triggerEvent(new EventTVAppSelected(this.id, deviceBefore, appId));
      await this.eventManager?.triggerEvent(new EventTVStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeStartApp(appId: string): Promise<void>;

  notify(message: string, execute: boolean) {
    if (execute) {
      this.executeNotify(message);
    }
  }

  protected abstract executeNotify(message: string): Promise<void>;

  async setVolume(volume: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.volume = volume;
    if (execute) {
      this.executeSetVolume(volume);
    }
    if (trigger) {
      await this.eventManager?.triggerEvent(new EventVolumeChanged(this.id, deviceBefore, volume));
      await this.eventManager?.triggerEvent(new EventVolumeEquals(this.id, deviceBefore, volume));
      await this.eventManager?.triggerEvent(new EventVolumeLess(this.id, deviceBefore, volume));
      await this.eventManager?.triggerEvent(new EventVolumeGreater(this.id, deviceBefore, volume));
      await this.eventManager?.triggerEvent(new EventTVStatusChanged(this.id, deviceBefore, { ...this }));
    }
  }

  protected abstract executeSetVolume(volume: number): Promise<void>;
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
