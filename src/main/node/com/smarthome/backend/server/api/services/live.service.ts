import { Server as SocketIOServer, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "../../../logger.js";

export type LiveUpdateEvent =
  | "device:updated"
  | "device:removed"
  | "scene:updated"
  | "scene:removed"
  | "action:updated"
  | "action:removed"
  | "actionExecution:updated"
  | "user:updated"
  | "sensorHistory:updated"
  | "toast";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastPayload {
  message: string;
  type: ToastType;
  duration?: number;
}

/**
 * Wird emittiert, sobald ein neuer Datenpunkt in einer Geräte-History
 * (Sensor- oder Energie-Historie) persistiert wurde. Das Frontend lädt
 * daraufhin die zugehörigen Charts neu.
 */
export type SensorHistoryMetric = "motion" | "temperature" | "lightLevel" | "energy";

export interface SensorHistoryUpdatedPayload {
  deviceId: string;
  metric: SensorHistoryMetric;
}

export class LiveUpdateService {
  private io: SocketIOServer;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      path: "/ws",
    });

    this.io.on("connection", (socket: Socket) => {
      logger.info({ socketId: socket.id }, "WebSocket-Client verbunden");

      socket.on("disconnect", (reason: string) => {
        logger.info({ socketId: socket.id, reason }, "WebSocket-Client getrennt");
      });
    });
  }

  emit(event: LiveUpdateEvent, payload: unknown): void {
    this.io.emit(event, payload);
  }

  toast(message: string, type: ToastType = "info", duration?: number): void {
    this.emit("toast", { message, type, duration } satisfies ToastPayload);
  }
}
