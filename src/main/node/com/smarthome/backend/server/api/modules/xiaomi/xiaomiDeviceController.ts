import miio = require("miio");
import { logger } from "../../../../logger.js";
import { DEVICE_MODE } from "../../../../model/devices/DeviceVacuumCleaner.js";
import { XiaomiEvent } from "./xiaomiEvent.js";
import { XiaomiVacuumCleaner } from "./devices/xiaomiVacuumCleaner.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";

const POLL_INTERVAL_IDLE_MS = 10_000;
const POLL_INTERVAL_CLEANING_MS = 2_000;

/** Schnelleres Polling bei laufender / pausierter Reinigung (alle Varianten). */
function isCleaningPollMode(mode: string): boolean {
  return (
    mode === DEVICE_MODE.CLEANING ||
    mode === DEVICE_MODE.CLEANING_PAUSED ||
    mode === DEVICE_MODE.CLEANING_ROOM ||
    mode === DEVICE_MODE.CLEANING_ROOM_PAUSED ||
    mode === DEVICE_MODE.CLEANING_ZONED ||
    mode === DEVICE_MODE.CLEANING_ZONED_PAUSED ||
    mode === DEVICE_MODE.CLEANING_STOPPED ||
    mode === DEVICE_MODE.CLEANING_ROOM_STOPPED ||
    mode === DEVICE_MODE.CLEANING_ZONED_STOPPED ||
    mode === DEVICE_MODE.DOCKING ||
    mode === DEVICE_MODE.UNDOCKING
  );
}

type PollHandle = {
  stopped: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

type MiioDevice = {
  model?: string;
  name?: string;
  id?: string | number;
  address?: string;
  // Many devices expose methods dynamically.
  [key: string]: unknown;
};

export class XiaomiDeviceController extends ModuleDeviceControllerEvent<XiaomiEvent, XiaomiVacuumCleaner> {
  private deviceCache = new Map<string, MiioDevice>();
  private eventHandlers = new Map<string, Map<string, (...args: any[]) => void>>();
  private pollHandlesByDeviceId = new Map<string, PollHandle>();

  async connect(address: string, token?: string): Promise<any | null> {
    const cacheKey = `${address}:${token ?? ""}`;
    if (this.deviceCache.has(cacheKey)) {
      return this.deviceCache.get(cacheKey)!;
    }
    try {
      const device = await miio.device({ address, token });
      this.deviceCache.set(cacheKey, device as MiioDevice);
      return device;
    } catch (err) {
      logger.warn({ err, address }, "Miio Verbindung fehlgeschlagen");
      return null;
    }
  }

  async destroy(address: string, token?: string): Promise<void> {
    const cacheKey = `${address}:${token ?? ""}`;
    const device = this.deviceCache.get(cacheKey);
    if (device && typeof device.destroy === "function") {
      try {
        await (device.destroy as () => Promise<void>)();
      } catch (err) {
        logger.debug({ err }, "Miio destroy fehlgeschlagen");
      }
    }
    this.deviceCache.delete(cacheKey);
  }

  async callMethod(address: string, token: string | undefined, method: string, args: unknown[] = [], options: { retries?: number } = {}): Promise<boolean> {
    const device = await this.connect(address, token);
    if (!device) return false;
    const callFn = (device as any).call;
    if (typeof callFn !== "function") {
      logger.warn({ method, address }, "Miio call nicht verfügbar");
      return false;
    }
    try {
      return await callFn.call(device, method, args, options);
    } catch (err) {
      logger.warn({ err, method, address }, "Miio call fehlgeschlagen");
      return false;
    }
  }

  /**
   * Ruft eine MiIO-Methode auf und gibt das Ergebnis zurück (z.B. für get_status).
   * @param options z.B. { retries: 10 } für längere Timeouts bei beschäftigten Geräten
   */
  async callMiioAndGetResult(
    address: string,
    token: string | undefined,
    method: string,
    args: unknown[] | object = [],
    options: { retries?: number } = {}
  ): Promise<Map<string, unknown> | null> {
    const device = await this.connect(address, token);
    if (!device) return null;
    const callFn = (device as any).call;
    if (typeof callFn !== "function") {
      logger.warn({ method, address }, "Miio call nicht verfügbar");
      return null;
    }
    try {
      return await callFn.call(device, method, args, options);
    } catch (err) {
      logger.warn({ err, method, address }, "Miio call fehlgeschlagen");
      return null;
    }
  }

  public async startEventStream(device: XiaomiVacuumCleaner, callback: (event: XiaomiEvent) => void): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      throw new Error("Device ID ist erforderlich für EventStreamListener");
    }

    const address = device.getAddress();
    const token = device.getToken();

    if (!address || !token) {
      logger.warn({ deviceId }, "Address oder Token fehlen für EventStream");
      return;
    }

    try {
      const miioDevice = await this.connect(address, token);
      if (!miioDevice) {
        logger.warn({ deviceId, address }, "Konnte keine Verbindung zum Gerät herstellen");
        return;
      }

      await this.stopEventStream(device);

      const handle: PollHandle = { stopped: false, timeoutId: null };
      this.pollHandlesByDeviceId.set(deviceId, handle);

      const scheduleNext = (delayMs: number) => {
        const h = this.pollHandlesByDeviceId.get(deviceId);
        if (!h || h.stopped) {
          return;
        }
        if (h.timeoutId !== null) {
          clearTimeout(h.timeoutId);
        }
        h.timeoutId = setTimeout(() => void runPollTick(), delayMs);
      };

      const runPollTick = async () => {
        const h = this.pollHandlesByDeviceId.get(deviceId);
        if (!h || h.stopped) {
          return;
        }
        h.timeoutId = null;
        try {
          const status = await device.getStatus();
          if (status) {
            await device.setUpdatedData(status, false);
            callback({
              deviceid: deviceId,
              data: { type: "get_status", value: status },
            });
          }
        } catch (err) {
          logger.warn({ err, deviceId }, "Xiaomi Polling getStatus fehlgeschlagen");
        }
        const h2 = this.pollHandlesByDeviceId.get(deviceId);
        if (!h2 || h2.stopped) {
          return;
        }
        const nextMs = isCleaningPollMode(device.deviceState.mode)
          ? POLL_INTERVAL_CLEANING_MS
          : POLL_INTERVAL_IDLE_MS;
        scheduleNext(nextMs);
      };

      logger.debug({ deviceId }, "EventStream für Xiaomi-Gerät gestartet (Polling get_status)");
      void runPollTick();
    } catch (err) {
      logger.error({ err, deviceId }, "Fehler beim Starten des EventStreamListeners");
      throw err;
    }
  }

  public async stopEventStream(device: XiaomiVacuumCleaner): Promise<void> {
    const deviceId = device.id ?? "";
    if (!deviceId) {
      return;
    }

    const poll = this.pollHandlesByDeviceId.get(deviceId);
    if (poll) {
      poll.stopped = true;
      if (poll.timeoutId !== null) {
        clearTimeout(poll.timeoutId);
        poll.timeoutId = null;
      }
      this.pollHandlesByDeviceId.delete(deviceId);
      logger.debug({ deviceId }, "Xiaomi Polling (get_status) beendet");
    }

    const handlers = this.eventHandlers.get(deviceId);
    if (handlers) {
      handlers.clear();
      this.eventHandlers.delete(deviceId);
      logger.debug({ deviceId }, "EventStreamListener entfernt");
    }
  }
}

