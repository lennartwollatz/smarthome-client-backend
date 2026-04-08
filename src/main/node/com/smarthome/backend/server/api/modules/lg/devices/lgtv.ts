import { DeviceTV, App, Channel } from "../../../../../model/devices/DeviceTV.js";
import { LGDeviceController } from "../lgDeviceController.js";
import { LGMODULE } from "../lgModule.js";

export class LGTV extends DeviceTV {
  address?: string;
  clientKey?: string | null;
  macAddress?: string | null;
  /**
   * Wird vom LGDeviceController bei Verbindungs-Timeout gesetzt (TV aus / nicht erreichbar),
   * damit {@link updateValues} keine weiteren PyWebOSTV-Aufrufe macht.
   */
  lastPollUnreachable = false;
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
    try {
      if (this.clientKey) {
        const selectedApp = await this.lg.getSelectedApp(this);
        this.selectedApp = selectedApp ?? undefined;
        if (selectedApp === null) {
          const selectedChannel = await this.lg.getSelectedChannel(this);
          this.selectedChannel = selectedChannel ?? undefined;
        } 
        if( selectedApp !== undefined ){
          const vol = await this.lg.getVolume(this);
          if (vol) {
            this.volume = vol;
          }
        }
        if( !this.power){
          this.screen = false;
        }
      }
    } catch {
    }
  }

  async updateChannels(): Promise<void> {
    if (!this.lg) return;
    this.channels = (await this.lg.getChannels(this)) as Channel[] | undefined;
    return;
  }

  async updateApps(): Promise<void> {
    if (!this.lg) return;
    this.apps = (await this.lg.getApps(this)) as App[] | undefined;
    return;
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
    return await this.lg.register(this);
  }

  protected async executeSetPowerOn() {
    if (!this.lg) return;
    await this.lg.powerOn(this);
  }

  protected async executeSetPowerOff() {
    if (!this.lg) return;
    await this.lg.powerOff(this);
  }

  protected async executeSetPower(power: boolean) {
    if (!this.lg) return;
    if (power) {
      void await this.lg.powerOn(this);
    } else {
      void await this.lg.powerOff(this);
    }
  }

  protected async executeSetScreenOn(): Promise<void> {
    if (!this.lg) return;
    await this.lg.screenOn(this);
  }

  protected async executeSetScreenOff(): Promise<void> {
    if (!this.lg) return;
    await this.lg.screenOff(this);
  }

  protected async executeSetScreen(screen: boolean): Promise<void> {
    if (!this.lg) return;
    if (screen) {
      await this.lg.screenOn(this);
    } else {
      await this.lg.screenOff(this);
    }
  }

  protected async executeSetChannel(channel: string): Promise<void> {
    if (!this.lg) return;
    await this.lg.setChannel(this, channel);
  }

  protected async executeStartApp(appId: string): Promise<void> {
    if (!this.lg) return;
    await this.lg.startApp(this, appId);
  }

  protected async executeNotify(message: string): Promise<void> {
    if (!this.lg) return;
    await this.lg.notify(this, message);
  }

  protected async executeSetVolume(volume: number): Promise<void> {
    if (!this.lg) return;
    await this.lg.setVolume(this, volume);
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

