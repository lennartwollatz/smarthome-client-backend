import { logger } from "../../../../logger.js";
import https from "node:https";
import type { ClientRequest } from "node:http";
import type { DatabaseManager } from "../../../db/database.js";
import type { HueBridgeDiscovered } from "./hueBridgeDiscovered.js";
import { v3 } from "node-hue-api";
import { HUECONFIG, HUEMODULE } from "./hueModule.js";
import { HueEvent } from "./hueEvent.js";
import { ModuleBridgeControllerEvent } from "../moduleBridgeControllerEvent.js";

/**
 * Initiale Wartezeit (ms) vor einem Reconnect-Versuch nach Verbindungsabbruch.
 */
const INITIAL_RECONNECT_DELAY_MS = 2_000;
/**
 * Maximale Wartezeit (ms) zwischen Reconnect-Versuchen (exponentielles Backoff).
 */
const MAX_RECONNECT_DELAY_MS = 60_000;
/**
 * Falls über diese Zeitspanne (ms) keinerlei Daten/Keepalive von der Bridge
 * empfangen wurden, wird die Verbindung als tot betrachtet und neu aufgebaut.
 * Die Hue Bridge sendet im Eventstream regelmäßig Daten (typ. alle ~10 s),
 * daher ist 90 s ein konservativer Wert.
 */
const STREAM_INACTIVITY_TIMEOUT_MS = 90_000;

interface ActiveEventStream {
  request: ClientRequest;
  inactivityTimer?: NodeJS.Timeout;
  reconnectTimer?: NodeJS.Timeout;
  reconnectAttempts: number;
  stopped: boolean;
  callback: (event: HueEvent) => void;
  bridgeIp: string;
  port: number;
  username: string;
}

export class HueBridgeController extends ModuleBridgeControllerEvent<HueBridgeDiscovered, HueEvent> {

  private activeStreams: Map<string, ActiveEventStream> = new Map();

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  protected getDiscoveredBridgeTypeName(): string {
    return HUECONFIG.bridgeTypeName;
  }
  protected getModuleName(): string {
    return HUEMODULE.id;
  }

  public async pairBridge(bridge: HueBridgeDiscovered): Promise<HueBridgeDiscovered | null> {
    if (!bridge) return null;
    const bridgeId = bridge.id;
    if ( !bridgeId ) return null;
    const ipAddress = bridge.address;
    if (!ipAddress) return null;

    try {
      const unauthenticatedApi = await v3.api.createLocal(ipAddress).connect();
      const createdUser = await unauthenticatedApi.users.createUser("smarthome-backend", "server");
      bridge.isPaired = true;
      bridge.username = createdUser.username;
      bridge.clientKey = createdUser.clientkey;
      super.saveBridge(bridgeId, bridge);
      return bridge;
    } catch (err: unknown) {
      logger.warn({ err, bridgeId }, "Hue Pairing fehlgeschlagen für {} ({})", bridgeId, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  public async startEventStream(bridge: HueBridgeDiscovered, callback: (event: HueEvent) => void): Promise<void> {
    if( bridge.isPaired && bridge.username && bridge.address ) {
      const port = this.resolveEventStreamPort(bridge.port);

      const existing = this.activeStreams.get(bridge.id);
      if (existing) {
        if (!existing.stopped) {
          logger.warn({ bridgeId: bridge.id }, "Hue EventStream laeuft bereits, starte nicht erneut");
          return;
        }
        this.cleanupStream(bridge.id);
      }

      const stream: ActiveEventStream = {
        request: undefined as unknown as ClientRequest,
        reconnectAttempts: 0,
        stopped: false,
        callback,
        bridgeIp: bridge.address,
        port,
        username: bridge.username
      };
      this.activeStreams.set(bridge.id, stream);
      this.openEventStreamConnection(bridge.id);
    } else {
      logger.error({ bridgeId: bridge.id }, "Hue EventStream kann nicht gestartet werden: Bridge ist nicht gepaart oder hat keine IP-Adresse");
      throw new Error("Hue EventStream kann nicht gestartet werden: Bridge ist nicht gepaart oder hat keine IP-Adresse");
    }
  }

  public async stopEventStream(bridge: HueBridgeDiscovered): Promise<void> {
    const stream = this.activeStreams.get(bridge.id);
    if (!stream) {
      logger.debug({ bridgeId: bridge.id }, "Hue EventStream stop: keine aktive Verbindung");
      return;
    }
    stream.stopped = true;
    this.cleanupStream(bridge.id);
    logger.info({ bridgeId: bridge.id }, "Hue EventStream gestoppt");
  }

  private cleanupStream(bridgeId: string) {
    const stream = this.activeStreams.get(bridgeId);
    if (!stream) return;
    if (stream.inactivityTimer) {
      clearTimeout(stream.inactivityTimer);
      stream.inactivityTimer = undefined;
    }
    if (stream.reconnectTimer) {
      clearTimeout(stream.reconnectTimer);
      stream.reconnectTimer = undefined;
    }
    try {
      stream.request?.destroy();
    } catch (err) {
      logger.debug({ err, bridgeId }, "Fehler beim Beenden des Hue Eventstream-Requests");
    }
    if (stream.stopped) {
      this.activeStreams.delete(bridgeId);
    }
  }

  /**
   * Plant einen Reconnect-Versuch mit exponentiellem Backoff.
   * Wird kein Reconnect-Versuch geplant, falls der Stream als gestoppt markiert ist.
   */
  private scheduleReconnect(bridgeId: string, reason: string): void {
    const stream = this.activeStreams.get(bridgeId);
    if (!stream || stream.stopped) return;
    if (stream.reconnectTimer) return; // bereits geplant

    const attempt = stream.reconnectAttempts;
    const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt), MAX_RECONNECT_DELAY_MS);
    stream.reconnectAttempts = attempt + 1;

    logger.warn(
      { bridgeId, bridgeIp: stream.bridgeIp, reason, delayMs: delay, attempt: stream.reconnectAttempts },
      "Hue EventStream Reconnect geplant"
    );

    stream.reconnectTimer = setTimeout(() => {
      const current = this.activeStreams.get(bridgeId);
      if (!current || current.stopped) return;
      current.reconnectTimer = undefined;
      this.openEventStreamConnection(bridgeId);
    }, delay);
  }

  private armInactivityTimer(bridgeId: string): void {
    const stream = this.activeStreams.get(bridgeId);
    if (!stream || stream.stopped) return;
    if (stream.inactivityTimer) clearTimeout(stream.inactivityTimer);
    stream.inactivityTimer = setTimeout(() => {
      logger.warn(
        { bridgeId, bridgeIp: stream.bridgeIp, timeoutMs: STREAM_INACTIVITY_TIMEOUT_MS },
        "Hue EventStream Inaktivitaets-Timeout, erzwinge Reconnect"
      );
      try {
        stream.request?.destroy();
      } catch (err) {
        logger.debug({ err, bridgeId }, "Fehler beim Schliessen des inaktiven Hue Eventstream-Requests");
      }
      // 'close' bzw. 'error' loest dann scheduleReconnect aus
    }, STREAM_INACTIVITY_TIMEOUT_MS);
  }

  private openEventStreamConnection(bridgeId: string): void {
    const stream = this.activeStreams.get(bridgeId);
    if (!stream || stream.stopped) return;

    const { bridgeIp, port, username, callback } = stream;
    const eventStreamUrl = `https://${bridgeIp}:${port}/eventstream/clip/v2`;
    const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

    const request = https.request(
      eventStreamUrl,
      {
        method: "GET",
        headers: {
          "hue-application-key": username,
          Accept: "text/event-stream"
        },
        agent
      },
      response => {
        const current = this.activeStreams.get(bridgeId);
        if (!current || current.stopped) {
          response.resume();
          return;
        }

        if (response.statusCode !== 200) {
          logger.error(
            { bridgeId, bridgeIp, statusCode: response.statusCode },
            "Hue Eventstream-Verbindung fehlgeschlagen"
          );
          response.resume();
          this.scheduleReconnect(bridgeId, `statusCode=${response.statusCode}`);
          return;
        }

        logger.info({ bridgeId, bridgeIp }, "Hue EventStream verbunden");
        current.reconnectAttempts = 0;
        this.armInactivityTimer(bridgeId);

        response.setEncoding("utf8");
        let eventData = "";
        let buffer = "";

        response.on("data", (chunk: string) => {
          this.armInactivityTimer(bridgeId);

          buffer += chunk;
          let index = buffer.indexOf("\n");
          while (index !== -1) {
            const line = buffer.slice(0, index).replace(/\r$/, "");
            buffer = buffer.slice(index + 1);
            if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              eventData += data;
              if (data.endsWith("]")) {
                this.processEventData(bridgeId, eventData, callback);
                eventData = "";
              }
            } else if (line.length === 0) {
              if (eventData.length > 0) {
                this.processEventData(bridgeId, eventData, callback);
                eventData = "";
              }
            }
            index = buffer.indexOf("\n");
          }
        });

        response.on("end", () => {
          logger.info({ bridgeId, bridgeIp }, "Hue EventStream-Verbindung beendet");
          this.scheduleReconnect(bridgeId, "response-end");
        });

        response.on("error", err => {
          logger.warn({ err, bridgeId, bridgeIp }, "Hue EventStream Response-Fehler");
          this.scheduleReconnect(bridgeId, "response-error");
        });
      }
    );

    stream.request = request;

    // TCP keep-alive aktivieren, damit das Betriebssystem tote Verbindungen
    // (z. B. nach NAT-Timeouts oder Bridge-Reboot) erkennen kann.
    request.on("socket", socket => {
      socket.setKeepAlive(true, 30_000);
    });

    request.on("error", err => {
      logger.warn({ err, bridgeId, bridgeIp }, "Fehler im Hue Eventstream-Request");
      this.scheduleReconnect(bridgeId, "request-error");
    });

    request.on("close", () => {
      const current = this.activeStreams.get(bridgeId);
      if (!current || current.stopped) return;
      logger.debug({ bridgeId, bridgeIp }, "Hue EventStream-Request geschlossen");
      this.scheduleReconnect(bridgeId, "request-close");
    });

    request.end();
  }

  private processEventData(bridgeId: string, eventDataJson: string, callback: (event: HueEvent) => void) {
    try {
      const events = JSON.parse(eventDataJson) as Array<Record<string, unknown>>;
      for (const event of events ?? []) {
        const dataArray = (event as any).data as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(dataArray)) continue;
        for (const data of dataArray) {
          callback({
            bridgeId: bridgeId,
            data: data
          });
        }
      }
    } catch (err) {
      logger.warn({ err, bridgeId: bridgeId }, "Fehler beim Parsen von Event-Daten");
    }
  }

  private resolveEventStreamPort(port?: number) {
    if (!port || port === 80) return 443;
    return port;
  }
}
