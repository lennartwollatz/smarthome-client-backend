import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "../../logger.js";

export type LiveUpdateEvent =
  | "device:updated"
  | "device:removed"
  | "scene:updated"
  | "scene:removed"
  | "action:updated"
  | "action:removed"
  | "user:updated"
  | "toast";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastPayload {
  message: string;
  type: ToastType;
  duration?: number;
}

export class LiveUpdateService {
  private io: SocketIOServer;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      path: "/ws",
    });

    this.io.on("connection", (socket) => {
      logger.info({ socketId: socket.id }, "WebSocket-Client verbunden");

      socket.on("disconnect", (reason) => {
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
