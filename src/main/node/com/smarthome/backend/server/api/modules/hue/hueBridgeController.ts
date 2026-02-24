import { logger } from "../../../../logger.js";
import https from "node:https";
import type { DatabaseManager } from "../../../db/database.js";
import type { HueBridgeDiscovered } from "./hueBridgeDiscovered.js";
import { v3 } from "node-hue-api";
import { HUECONFIG, HUEMODULE } from "./hueModule.js";
import { HueEvent } from "./hueEvent.js";
import { ModuleBridgeControllerEvent } from "../moduleBridgeControllerEvent.js";

export class HueBridgeController extends ModuleBridgeControllerEvent<HueBridgeDiscovered, HueEvent> {

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
      this.startEventStreamConnection(bridge.id, bridge.address, port, bridge.username, callback);
    } else {
      logger.error({ bridgeId: bridge.id }, "Hue EventStream kann nicht gestartet werden: Bridge ist nicht gepaart oder hat keine IP-Adresse");
      throw new Error("Hue EventStream kann nicht gestartet werden: Bridge ist nicht gepaart oder hat keine IP-Adresse");
    }
  }

  public async stopEventStream(bridge: HueBridgeDiscovered): Promise<void> {
    logger.debug({ bridgeId: bridge.id }, "Hue EventStream wird über HueEventStreamManager verwaltet");
  }

  private startEventStreamConnection(bridgeId: string, bridgeIp: string, port: number, username: string, callback: (event: HueEvent) => void) {
    const eventStreamUrl = `https://${bridgeIp}:${port}/eventstream/clip/v2`;
    const agent = new https.Agent({ rejectUnauthorized: false });
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
        if (response.statusCode !== 200) {
          logger.error(
            { bridgeIp: bridgeIp, statusCode: response.statusCode },
            "Eventstream-Verbindung fehlgeschlagen"
          );
          // Event stream wird automatisch gestoppt bei Fehler
          response.resume();
          return;
        }

        response.setEncoding("utf8");
        let eventData = "";
        let buffer = "";

        response.on("data", (chunk: string) => {
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
          logger.info({ bridgeIp: bridgeIp }, "EventStream-Verbindung beendet");
        });
      }
    );

    request.on("error", err => {
      logger.error({ err, bridgeIp: bridgeIp }, "Fehler im Eventstream fuer Bridge");
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
