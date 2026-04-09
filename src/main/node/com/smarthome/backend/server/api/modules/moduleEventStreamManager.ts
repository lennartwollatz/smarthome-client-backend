import { logger } from "../../../logger.js";
import { runWithSource, EventSource } from "../../events/EventSource.js";
import { ModuleEvent } from "./moduleEvent.js";
import { ModuleEventController } from "./moduleEventController.js";
import { DeviceManager } from "../entities/devices/deviceManager.js";

export abstract class ModuleEventStreamManager<C extends ModuleEventController, E extends ModuleEvent> {
  protected managerId: string;
  protected moduleId: string;
  protected controller: C;
  protected deviceManager: DeviceManager;
  private running = false;

  constructor(managerId: string, moduleId:string, controller: C, deviceManager: DeviceManager) {
    this.managerId = managerId;
    this.moduleId = moduleId;
    this.controller = controller;
    this.deviceManager = deviceManager;
  }

  protected abstract handleEvent(event: E): void;
  protected abstract startEventStream(callback: (event: E) => void): Promise<void>;
  protected abstract stopEventStream(): Promise<void>;

  public async start(): Promise<void> {
    if (this.running) {
      logger.warn(this.managerId + " EventStream laeuft bereits");
      return;
    }
    this.running = true;
    const callback: (event: E) => void = (event: E) => runWithSource(EventSource.SENSOR, () => this.handleEvent(event));
    // Start asynchronously, damit die Event-Loop nicht blockiert und z. B. HTTP-Anfragen weiter bedient werden
    void this.startEventStream(callback)
      .then(() => logger.info(this.managerId + " EventStream gestartet"))
      .catch(err => {
        this.running = false;
        logger.error({ err, managerId: this.managerId }, "Fehler beim Starten des EventStreams");
      });
  }

  public async stop():Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.stopEventStream();
    logger.info(this.managerId+" EventStream gestoppt");
  }

  public getManagerId(): string {
    return this.managerId;
  }

  public getModuleId(): string {
    return this.moduleId;
  }

  public getDescription():string {
    return `${this.moduleId} EventStream fuer Manager ${this.managerId}`;
  }

  public isRunning(): boolean {
    return this.running;
  }
}

