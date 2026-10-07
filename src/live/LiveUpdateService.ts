import { Server as SocketIOServer, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "../config/logger.js";
import { isValidApiToken } from "../api/middleware/authenticate.js";

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

    this.io.use((socket, next) => {
      if (isValidApiToken(socket.handshake.auth?.token)) {
        next();
        return;
      }
      logger.warn({ socketId: socket.id }, "WebSocket-Verbindung ohne gültigen API-Token abgelehnt");
      next(new Error("Nicht authentifiziert"));
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
