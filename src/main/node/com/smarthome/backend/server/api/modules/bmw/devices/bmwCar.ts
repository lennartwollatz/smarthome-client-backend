import { logger } from "../../../../../logger.js";
import { DeviceCar, type DeviceCarAddress } from "../../../../../model/devices/DeviceCar.js";
import { BMWDeviceController } from "../bmwDeviceController.js";
import type { BMWCredentials } from "../bmwCredentialsStore.js";
import { BMWCONFIG } from "../bmwModule.js";

export class BMWCar extends DeviceCar {
  private bmwController?: BMWDeviceController;
  private credentialsProvider?: () => BMWCredentials | null;

  constructor(
    name?: string,
    id?: string,
    vin?: string,
    bmwController?: BMWDeviceController,
    credentialsProvider?: () => BMWCredentials | null
  ) {
    super();
    this.name = name ?? BMWCONFIG.defaultDeviceName;
    this.id = id ?? "";
    this.vin = vin;
    this.bmwController = bmwController;
    this.credentialsProvider = credentialsProvider;
    this.moduleId = BMWCONFIG.id;
    this.isConnected = true;
  }

  setBMWController(controller: BMWDeviceController) {
    this.bmwController = controller;
  }

  setCredentialsProvider(credentialsProvider: () => BMWCredentials | null) {
    this.credentialsProvider = credentialsProvider;
  }

  override async updateValues(): Promise<void> {
    if (!this.bmwController || !this.credentialsProvider || !this.vin) return;
    const credentials = this.credentialsProvider();
    if (!credentials?.username || !credentials.password) {
      logger.debug({ deviceId: this.id }, "BMW updateValues uebersprungen - Credentials fehlen");
      return;
    }
    const rawStatus = await this.bmwController.getVehicleStatus(credentials, this.vin);
    if (!rawStatus) return;
    const status = this.bmwController.toCarStatus(rawStatus);
    this.fuelLevelPercent = status.fuelLevelPercent;
    this.rangeKm = status.rangeKm;
    this.mileageKm = status.mileageKm;
    this.lockedState = status.lockedState;
    this.inUseState = status.inUseState;
    this.climateControlState = status.climateControlState;
    this.location = status.location;
    this.windows = status.windows;
    this.doors = status.doors;
  }

  protected executeStartClimateControl(): void {
    if (!this.bmwController || !this.credentialsProvider || !this.vin) return;
    const credentials = this.credentialsProvider();
    if (!credentials?.username || !credentials.password) return;
    this.bmwController.startClimateControl(credentials, this.vin).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Starten der BMW Klimatisierung");
    });
  }

  protected executeStopClimateControl(): void {
    if (!this.bmwController || !this.credentialsProvider || !this.vin) return;
    const credentials = this.credentialsProvider();
    if (!credentials?.username || !credentials.password) return;
    this.bmwController.stopClimateControl(credentials, this.vin).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Stoppen der BMW Klimatisierung");
    });
  }

  protected executeSendAddress(subject: string, address: DeviceCarAddress): void {
    if (!this.bmwController || !this.credentialsProvider || !this.vin) return;
    const credentials = this.credentialsProvider();
    if (!credentials?.username || !credentials.password) return;
    this.bmwController.sendAddress(credentials, this.vin, subject, address).catch(err => {
      logger.error({ err, deviceId: this.id }, "Fehler beim Senden einer BMW Zieladresse");
    });
  }
}

