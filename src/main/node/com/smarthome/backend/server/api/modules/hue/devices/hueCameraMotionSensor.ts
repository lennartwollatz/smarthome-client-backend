import { HueMotionSensor } from "./hueMotionSensor.js";
import { HueDeviceController } from "../hueDeviceController.js";

export class HueCameraMotionSensor extends HueMotionSensor {
  icon = "&#128249;";

  constructor(
    name?: string,
    id?: string,
    bridgeId?: string,
    hueResourceId?: string,
    batteryRid?: string,
    hueDeviceController?: HueDeviceController
  ) {
    super(name, id, bridgeId, hueResourceId, batteryRid, hueDeviceController);
    this.icon = "&#128249;";
  }
}

