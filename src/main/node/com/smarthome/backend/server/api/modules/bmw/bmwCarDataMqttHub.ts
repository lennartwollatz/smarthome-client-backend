import { randomUUID } from "node:crypto";
import mqtt, { type MqttClient } from "mqtt";
import { logger } from "../../../../logger.js";
import { BMW_CARDATA_MQTT_KEEPALIVE } from "./bmwCarDataDefaults.js";

export type BmwCarDataMqttEnvelope = {
  vin: string;
  timestamp?: number;
  data: Record<string, { timestamp?: number; value: unknown } | unknown>;
};

export class BmwCarDataMqttHub {
  private client: MqttClient | null = null;
  private readonly snapshots = new Map<string, Record<string, unknown>>();
  private readonly seenVins = new Set<string>();
  private readonly vinListeners = new Set<(vin: string) => void>();
  private readonly messageListeners = new Set<(envelope: BmwCarDataMqttEnvelope) => void>();
  private connectedUser?: string;
  private readonly disconnectListeners = new Set<(reason: string) => void>();
  private manualDisconnect = false;
  private lastMessageAtMs?: number;
  private lastMessageVin?: string;

  onDisconnect(listener: (reason: string) => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  private emitDisconnect(reason: string): void {
    for (const l of this.disconnectListeners) {
      try {
        l(reason);
      } catch (err) {
        logger.error({ err }, "BMW MQTT Disconnect-Listener Fehler");
      }
    }
  }

  onVin(listener: (vin: string) => void): () => void {
    this.vinListeners.add(listener);
    return () => this.vinListeners.delete(listener);
  }

  onMessage(listener: (envelope: BmwCarDataMqttEnvelope) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  private emitMessage(envelope: BmwCarDataMqttEnvelope): void {
    for (const l of this.messageListeners) {
      try {
        l(envelope);
      } catch (err) {
        logger.error({ err }, "BMW MQTT Message-Listener Fehler");
      }
    }
  }

  private emitVin(vin: string): void {
    for (const l of this.vinListeners) {
      try {
        l(vin);
      } catch (err) {
        logger.error({ err }, "BMW MQTT Vin-Listener Fehler");
      }
    }
  }

  ingestEnvelope(envelope: BmwCarDataMqttEnvelope): void {
    const { vin, data } = envelope;
    if (!vin || !data || typeof data !== "object") return;
    const snap = this.snapshots.get(vin) ?? {};
    for (const [key, meta] of Object.entries(data)) {
      if (meta && typeof meta === "object" && "value" in meta) {
        snap[key] = (meta as { value: unknown }).value;
      }
    }
    this.snapshots.set(vin, snap);
    this.seenVins.add(vin);
    this.emitMessage(envelope);
    this.emitVin(vin);
  }

  ingestPayload(vin: string, data: Record<string, unknown> | undefined): void {
    if (!vin || !data || typeof data !== "object") return;
    this.ingestEnvelope({ vin, data: data as BmwCarDataMqttEnvelope["data"] });
  }

  getSnapshot(vin: string): Record<string, unknown> | undefined {
    const s = this.snapshots.get(vin);
    return s ? { ...s } : undefined;
  }

  getSeenVins(): string[] {
    return [...this.seenVins];
  }

  clearSeenVins(): void {
    this.seenVins.clear();
  }

  isConnected(): boolean {
    return Boolean(this.client?.connected);
  }

  getConnectedUsername(): string | undefined {
    return this.connectedUser;
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.connectedUser = undefined;
    const c = this.client;
    this.client = null;
    if (c) {
      this.destroyClient(c);
    }
    this.manualDisconnect = false;
  }

  /**
   * TLS-MQTT laut Id-Streaming 4.4–4.5: mqtts, Username = GCID, Password = ID-Token,
   * Subscribe `{gcid}/+` (nicht OAuth-Client-ID).
   * @see https://bmw-cardata.bmwgroup.com/customer/public/api-documentation/Id-Streaming
   */
  private destroyClient(c: MqttClient): void {
    try {
      c.removeAllListeners();
      c.end(true);
    } catch (err) {
      logger.debug({ err }, "BMW MQTT Client-Ende");
    }
  }

  async connectTls(options: { host: string; port: number; username: string; password: string }): Promise<void> {
    const { host, port, username, password } = options;
    if (this.client?.connected && this.connectedUser === username) {
      return;
    }
    this.disconnect();
    const url = `mqtts://${host}:${port}`;
    await new Promise<void>((resolve, reject) => {
      this.lastMessageAtMs = undefined;
      this.lastMessageVin = undefined;

      let connectSettled = false;
      const settleFail = (err: Error) => {
        if (connectSettled) return;
        connectSettled = true;
        this.destroyClient(c);
        if (this.client === c) this.client = null;
        if (!this.manualDisconnect) this.emitDisconnect("connect_failed");
        reject(err);
      };

      const c = mqtt.connect(url, {
        clientId: `smarthome-bmw-${randomUUID()}`,
        username,
        password,
        protocolVersion: 5,
        keepalive: BMW_CARDATA_MQTT_KEEPALIVE,
        reconnectPeriod: 0,
        rejectUnauthorized: true,
        connectTimeout: 60_000
      });
      this.client = c;

      // Immer registriert: mqtt.js kann „connack timeout“ mehrfach emittieren;
      // nach removeAllListeners() wuerde ein zweites 'error' den Node-Prozess beenden.
      c.on("error", (err: Error) => {
        const message = err?.message ?? String(err);
        if (!connectSettled) {
          logger.warn({ err: message, host, port }, "BMW MQTT Verbindungsfehler");
          settleFail(err instanceof Error ? err : new Error(message));
          return;
        }
        logger.error({ err: message }, "BMW MQTT Laufzeitfehler");
        if (!this.manualDisconnect) {
          this.connectedUser = undefined;
          this.emitDisconnect(message.includes("connack") ? "connack_timeout" : "error");
        }
      });

      c.once("connect", () => {
        const topic = `${username}/+`;
        c.subscribe(topic, { qos: 1 }, err => {
          if (err) {
            settleFail(err instanceof Error ? err : new Error(String(err)));
            return;
          }
          connectSettled = true;
          logger.info({ topic, host, port }, "BMW CarData MQTT verbunden");
          this.connectedUser = username;
          resolve();
        });
      });

      c.on("message", (receivedTopic, payload) => {
        try {
          const text = payload.toString();
          const json = JSON.parse(text) as BmwCarDataMqttEnvelope;
          if (json.vin && json.data) {
            this.lastMessageAtMs = Date.now();
            this.lastMessageVin = json.vin;
            this.ingestEnvelope(json);
          }
        } catch (err) {
          logger.warn({ err, receivedTopic }, "BMW MQTT Nachricht nicht lesbar");
        }
      });

      const notifyIfAllowed = (reason: string) => {
        if (this.manualDisconnect) return;
        if (this.connectedUser) this.connectedUser = undefined;
        this.emitDisconnect(reason);
      };
      c.on("offline", () => notifyIfAllowed("offline"));
      c.on("close", () => notifyIfAllowed("close"));
      c.on("end", () => notifyIfAllowed("end"));
    });
  }

  getLastMessageAt(): number | undefined {
    return this.lastMessageAtMs;
  }

  getLastMessageVin(): string | undefined {
    return this.lastMessageVin;
  }
}
