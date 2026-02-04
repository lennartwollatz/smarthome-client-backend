import { logger } from "../../../../logger.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import type { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { MatterController } from "./matterController.js";

type MatterEvent = {
  nodeId?: string | number;
  deviceId?: string;
  event?: string;
  name?: string;
  online?: boolean;
  isOnline?: boolean;
  reachable?: boolean;
  payload?: Record<string, unknown>;
};

export class MatterEventStreamManager implements ModuleEventStreamManager {
  private managerId: string;
  private actionManager: ActionManager;
  private controller: MatterController;
  private running = false;
  private eventListener?: (event: unknown) => void;

  constructor(managerId: string, controller: MatterController, actionManager: ActionManager) {
    this.managerId = managerId;
    this.controller = controller;
    this.actionManager = actionManager;
  }

  async start() {
    if (this.running) {
      logger.warn({ managerId: this.managerId }, "Matter EventStream laeuft bereits");
      return;
    }
    this.running = true;
    await this.controller.startEventStream();
    this.eventListener = event => this.handleEvent(event);
    this.controller.onEvent(this.eventListener);
    logger.info({ managerId: this.managerId }, "Matter EventStream gestartet");
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    if (this.eventListener) {
      this.controller.offEvent(this.eventListener);
      this.eventListener = undefined;
    }
    this.controller.stopEventStream();
    logger.info({ managerId: this.managerId }, "Matter EventStream gestoppt");
  }

  isRunning() {
    return this.running;
  }

  getModuleId() {
    return "matter";
  }

  getManagerId() {
    return this.managerId;
  }

  getDescription() {
    return `Matter EventStream fuer Manager ${this.managerId}`;
  }

  private handleEvent(event: unknown) {
    const mapped = mapEvent(event);
    if (!mapped) {
      logger.debug("Matter EventStream ignoriert ungueltiges Event");
      return;
    }
    const nodeId = mapped.nodeId ?? mapped.deviceId;
    const eventName = mapped.event ?? mapped.name ?? "unknown";

    if (nodeId != null) {
      const deviceId = `matter-${nodeId}`;
      const device = this.actionManager.getDevice(deviceId);
      if (device) {
        const payload = mapped.payload ?? {};
        const onlineValue = resolveOnlineValue(mapped);
        if (onlineValue != null) {
          (device as any).isConnected = onlineValue;
        }
        (device as any).lastEvent = {
          name: eventName,
          payload,
          timestamp: new Date().toISOString()
        };
        this.actionManager.saveDevice(device);
      }
    }

    logger.debug({ eventName, nodeId }, "Matter Event verarbeitet");
  }
}

function mapEvent(event: unknown): MatterEvent | null {
  if (!event) return null;
  if (typeof event !== "object") {
    return { name: String(event) };
  }
  const record = event as Record<string, unknown>;
  const payload = record.payload && typeof record.payload === "object" ? (record.payload as Record<string, unknown>) : {};
  return {
    nodeId: record.nodeId as string | number | undefined,
    deviceId: record.deviceId as string | undefined,
    event: record.event as string | undefined,
    name: record.name as string | undefined,
    online: record.online as boolean | undefined,
    isOnline: record.isOnline as boolean | undefined,
    reachable: record.reachable as boolean | undefined,
    payload
  };
}

function resolveOnlineValue(event: MatterEvent) {
  if (typeof event.online === "boolean") return event.online;
  if (typeof event.isOnline === "boolean") return event.isOnline;
  if (typeof event.reachable === "boolean") return event.reachable;
  return null;
}

