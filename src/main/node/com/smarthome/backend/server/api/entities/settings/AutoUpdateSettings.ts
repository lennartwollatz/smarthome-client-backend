import { UpdateTimes } from "./UpdateTimes.js";

export class AutoUpdateSettings {
  autoupdate?: boolean;
  updatetimes?: UpdateTimes;

  constructor(init?: Partial<AutoUpdateSettings>) {
    Object.assign(this, init);
  }
}
