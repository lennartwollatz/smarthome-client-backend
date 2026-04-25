import { DeviceType } from "./helper/DeviceType.js";
import { DeviceActive } from "./DeviceActive.js";


export abstract class DeviceSpeechAssistant extends DeviceActive {
  constructor(init?: Partial<DeviceSpeechAssistant>) {
    super(init);
    this.type = DeviceType.SPEECH_ASSISTANT;
  }

  override toDatabaseJson(): Record<string, unknown> {
    return { ...super.toDatabaseJson() };
  }

  async setActive(execute: boolean, trigger: boolean = true): Promise<void> {
    await super.setActive(execute, trigger);
    if( execute) {
      await this.executeSetInactive();
    }
  }

  async setInactive(execute: boolean, trigger: boolean = true): Promise<void> {
    await super.setInactive(execute, trigger);
    if( execute) {
      await this.executeSetActive();
    }
  }
}

