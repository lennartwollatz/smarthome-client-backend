import { logger } from "../../../../logger.js";
import { DeviceSwitchEnergy } from "../../../../model/devices/DeviceSwitchEnergy.js";

export class MatterSwitchEnergy extends DeviceSwitchEnergy {
  private nodeId?: string | number;

  constructor(
    name?: string,
    id?: string,
    nodeId?: string | number,
    buttonIds?: string[]
  ) {
    super();
    if (name) this.name = name;
    if (id) this.id = id;
    this.nodeId = nodeId;
    (buttonIds ?? []).forEach(buttonId => this.addButton(buttonId));
    this.moduleId = "matter";
    this.isConnected = true;
  }

  updateValues() {
    logger.info("Update die Werte fuer {}", this.id);
    // Matter Device Controller in Node ist aktuell stubbed.
  }

  protected executeToggle(buttonId: string) {
    logger.debug("executeToggle fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected executeDoublePress(buttonId: string) {
    logger.debug("executeDoublePress fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected executeTriplePress(buttonId: string) {
    logger.debug("executeTriplePress fuer Button {} - wird ueber Event-Stream verarbeitet", buttonId);
  }

  protected executeSetBrightness(buttonId: string, brightness: number) {
    logger.debug(
      "executeSetBrightness fuer Button {} - wird ueber Event-Stream verarbeitet",
      buttonId,
      brightness
    );
  }

  protected executeSetEnergyUsage(_energyUsage: import("../../../../model/devices/DeviceSwitchEnergy.js").Energy) {
    logger.debug("executeSetEnergyUsage - wird ueber Event-Stream verarbeitet");
  }

  getNodeId() {
    return this.nodeId;
  }

  setNodeId(nodeId: string | number) {
    this.nodeId = nodeId;
  }
}

