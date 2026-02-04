import { DeviceTV, App, Channel } from "../../../../model/devices/DeviceTV.js";
import { LGController } from "./lgController.js";

export class LGTV extends DeviceTV {
  address?: string;
  clientKey?: string | null;
  macAddress?: string | null;

  constructor(
    name?: string,
    id?: string,
    address?: string,
    macAddress?: string | null,
    clientKey?: string | null
  ) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.address = address;
    this.clientKey = clientKey ?? null;
    this.macAddress = macAddress ?? null;
    this.isConnected = Boolean(clientKey);
    this.moduleId = "lg";
    if (clientKey) {
      void this.updateValues();
    }
  }

  async updateValues() {
    if (this.clientKey) {
      const selectedApp = await LGController.getSelectedApp(this);
      this.selectedApp = selectedApp ?? undefined;
      if (selectedApp) {
        const selectedChannel = await LGController.getSelectedChannel(this);
        this.selectedChannel = selectedChannel ?? undefined;
        const vol = await LGController.getVolume(this);
        if (typeof vol === "number") {
          this.volume = vol;
        }
      }
      this.power = Boolean(this.selectedChannel || this.selectedApp);
    }
  }

  async updateChannels() {
    this.channels = (await LGController.getChannels(this)) as Channel[] | undefined;
  }

  async updateApps() {
    this.apps = (await LGController.getApps(this)) as App[] | undefined;
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

  async register() {
    return LGController.register(this);
  }

  protected executeSetPower(power: boolean) {
    if (power) {
      void LGController.powerOn(this);
    } else {
      void LGController.powerOff(this);
    }
  }

  protected executeSetScreen(screen: boolean) {
    if (screen) {
      void LGController.screenOn(this);
    } else {
      void LGController.screenOff(this);
    }
  }

  protected executeSetChannel(channel: string) {
    void LGController.setChannel(this, channel);
  }

  protected executeStartApp(appId: string) {
    void LGController.startApp(this, appId);
  }

  protected executeNotify(message: string) {
    void LGController.notify(this, message);
  }

  protected executeSetVolume(volume: number) {
    void LGController.setVolume(this, volume);
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

