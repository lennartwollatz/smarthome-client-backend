import { DeviceTV, App, Channel } from "../../../../../model/devices/DeviceTV.js";
import { LGDeviceController } from "../lgDeviceController.js";
import { LGMODULE } from "../lgModule.js";

export class LGTV extends DeviceTV {
  address?: string;
  clientKey?: string | null;
  macAddress?: string | null;
  private lg?: LGDeviceController;

  constructor();
  constructor(name: string, id: string, address: string, macAddress: string | null, clientKey: string | null, lg: LGDeviceController);
  constructor(
    name?: string,
    id?: string,
    address?: string,
    macAddress?: string | null,
    clientKey?: string | null,
    lg?: LGDeviceController
  ) {
    super();
    this.name = name ?? "LG TV";
    this.id = id ?? "8899388377383a";
    this.address = address;
    this.clientKey = clientKey ?? null;
    this.macAddress = macAddress ?? null;
    this.lg = lg;
    this.isConnected = Boolean(clientKey);
    this.moduleId = LGMODULE.id;
    if (clientKey && lg) {
      this.isConnected = true;
    }
  }

  setLGController(lgController?: LGDeviceController) {
    this.lg = lgController;
  }

  async updateValues(): Promise<void> {
    if (!this.lg) {
      return;
    }
    if (this.clientKey) {
      const selectedApp = await this.lg.getSelectedApp(this);
      this.selectedApp = selectedApp ?? undefined;
      if (selectedApp) {
        const selectedChannel = await this.lg.getSelectedChannel(this);
        this.selectedChannel = selectedChannel ?? undefined;
        const vol = await this.lg.getVolume(this);
        if (typeof vol === "number") {
          this.volume = vol;
        }
      }
      this.power = Boolean(this.selectedChannel || this.selectedApp);
    }
  }

  async updateChannels(): Promise<void> {
    if (!this.lg) return;
    this.channels = (await this.lg.getChannels(this)) as Channel[] | undefined;
  }

  async updateApps(): Promise<void> {
    if (!this.lg) return;
    this.apps = (await this.lg.getApps(this)) as App[] | undefined;
  }

  getClientKey() {
    return this.clientKey ?? null;
  }

  getAddress() {
    return this.address;
  }

  getMacAddress() {
    return this.macAddress ?? null;
  }

  setClientKey(clientKey: string | null) {
    this.clientKey = clientKey;
    this.isConnected = Boolean(clientKey);
  }

  setMacAddress(macAddress: string | null) {
    this.macAddress = macAddress;
  }

  async register(): Promise<boolean> {
    if (!this.lg) return false;
    return this.lg.register(this);
  }

  protected executeSetPower(power: boolean) {
    if (!this.lg) return;
    if (power) {
      void this.lg.powerOn(this);
    } else {
      void this.lg.powerOff(this);
    }
  }

  protected executeSetScreen(screen: boolean) {
    if (!this.lg) return;
    if (screen) {
      void this.lg.screenOn(this);
    } else {
      void this.lg.screenOff(this);
    }
  }

  protected executeSetChannel(channel: string) {
    if (!this.lg) return;
    void this.lg.setChannel(this, channel);
  }

  protected executeStartApp(appId: string) {
    if (!this.lg) return;
    void this.lg.startApp(this, appId);
  }

  protected executeNotify(message: string) {
    if (!this.lg) return;
    void this.lg.notify(this, message);
  }

  protected executeSetVolume(volume: number) {
    if (!this.lg) return;
    void this.lg.setVolume(this, volume);
  }

  setHomeAppNumber(appId: string, newNumber: number) {
    if (!this.apps) return;
    const app = this.apps.find(item => item.id === appId);
    if (app) {
      app.homeAppNumber = newNumber;
    }
  }

  setHomeChannelNumber(channelId: string, newNumber: number) {
    if (!this.channels) return;
    const channel = this.channels.find(item => item.id === channelId);
    if (channel) {
      channel.homeChannelNumber = newNumber;
    }
  }
}

