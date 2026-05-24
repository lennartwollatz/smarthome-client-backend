import { logger } from "../../../../logger.js";
import { ModuleDeviceControllerEvent } from "../moduleDeviceControllerEvent.js";
import { BMWEvent } from "./bmwEvent.js";
import type { BMWCar } from "./devices/bmwCar.js";
import { BMWDeviceDiscovered } from "./bmwDeviceDiscovered.js";
import type { BMWTokenStore } from "./bmwTokenStore.js";
import type { BMWCredentialsStore } from "./bmwCredentialsStore.js";
import {
  BMW_CARDATA_DEFAULT_MQTT_HOST,
  BMW_CARDATA_DEFAULT_MQTT_PORT,
  BMW_CARDATA_DISCOVERY_TIMEOUT_MS,
  BMW_CARDATA_MQTT_FAST_RECONNECT_MAX_ATTEMPTS,
  BMW_CARDATA_MQTT_RECONNECT_INTERVAL_MS
} from "./bmwCarDataDefaults.js";
import {
  generatePkcePair,
  pollDeviceToken,
  requestDeviceCode,
  type DeviceCodeStartResponse
} from "./bmwCarDataOAuth.js";
import { BmwCarDataMqttHub, type BmwCarDataMqttEnvelope } from "./bmwCarDataMqttHub.js";
import type { BmwCarTelemetryHistoryStore } from "../../../db/bmwCarTelemetryHistoryStore.js";
import { isTrackedTelemetryKey } from "./bmwCarDataTelemetryKeys.js";

export type DeviceCodePollApiResult =
  | { status: "success" }
  | { status: "pending"; slowDownExtraSec?: number }
  | { status: "denied" | "error"; message: string };

export class BMWDeviceController extends ModuleDeviceControllerEvent<BMWEvent, BMWCar> {
  private readonly hub = new BmwCarDataMqttHub();
  private pendingAuth: {
    device_code: string;
    code_verifier: string;
    intervalMs: number;
    expires_at_ms: number;
  } | null = null;

  private streamVinUnsub: (() => void) | null = null;
  private streamMessageUnsub: (() => void) | null = null;
  private hubDisconnectUnsub: (() => void) | null = null;
  private resolveDeviceIdsForVin: ((vin: string) => string[]) | null = null;
  private onVinObserved: ((vin: string) => void) | null = null;

  private idTokenRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private periodicReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private reconnecting = false;
  /** false nach disconnectMqtt – kein automatischer Reconnect. */
  private mqttAutoReconnectEnabled = true;

  private static readonly ID_TOKEN_REFRESH_AHEAD_MS = 5 * 60 * 1000; // ~5 Minuten vor Ablauf

  constructor(
    private readonly tokenStore: BMWTokenStore,
    private readonly credentialsStore: BMWCredentialsStore,
    private readonly telemetryHistory?: BmwCarTelemetryHistoryStore
  ) {
    super();
  }

  setVinDeviceResolver(resolver: (vin: string) => string[]): void {
    this.resolveDeviceIdsForVin = resolver;
  }

  /** Wird bei jeder MQTT-Nachricht mit VIN aufgerufen (idempotent registrieren). */
  setOnVinObserved(handler: (vin: string) => void): void {
    this.onVinObserved = handler;
  }

  getHub(): BmwCarDataMqttHub {
    return this.hub;
  }

  private getClientId(): string | null {
    const id = this.credentialsStore.getCredentials().clientId?.trim();
    return id && id.length > 0 ? id : null;
  }

  private getMqttHostPort(): { host: string; port: number } {
    const c = this.credentialsStore.getCredentials();
    return {
      host: (c.mqttHost && c.mqttHost.trim()) || BMW_CARDATA_DEFAULT_MQTT_HOST,
      port: typeof c.mqttPort === "number" && c.mqttPort > 0 ? c.mqttPort : BMW_CARDATA_DEFAULT_MQTT_PORT
    };
  }

  /**
   * Aktualisiert ID-/Access-Token bei Bedarf (MQTT nutzt ID-Token als Passwort).
   */
  async ensureFreshTokens(): Promise<boolean> {
    const clientId = this.getClientId();
    if (!clientId) return false;
    if (!this.tokenStore.hasRefreshToken()) return false;
    if (this.tokenStore.isRefreshExpired()) {
      logger.warn("BMW Refresh-Token abgelaufen – erneute Anmeldung erforderlich");
      return false;
    }
    if (!this.tokenStore.needsTokenRefresh(120_000)) {
      return true;
    }
    logger.info("BMW Token abgelaufen – Refresh per refresh_token");
    return await this.tokenStore.refreshWithStoredToken(clientId);
  }

  private warnStreamingScopeHint(): void {
    const streamingScope = "cardata:streaming:read";
    if (this.tokenStore.hasIdTokenScope(streamingScope)) return;
    logger.warn(
      "BMW MQTT: ID-Token enthaelt `cardata:streaming:read` nicht in scope/scp-Claims – Verbindung wird trotzdem versucht (BMW-Broker entscheidet)"
    );
    if (process.env.BMW_CAR_DATA_DEBUG_SCOPES === "1") {
      logger.info("BMW MQTT: Scope-Diagnose aktiv (BMW_CAR_DATA_DEBUG_SCOPES=1)");
    }
  }

  async ensureMqttConnected(): Promise<boolean> {
    if (!(await this.ensureFreshTokens())) return false;
    this.warnStreamingScopeHint();
    const tokens = this.tokenStore.getCarDataTokens();
    if (!tokens) return false;
    const { host, port } = this.getMqttHostPort();
    try {
      await this.hub.connectTls({
        host,
        port,
        username: tokens.gcid,
        password: tokens.idToken
      });
      this.reconnectAttempt = 0;
      this.clearPeriodicReconnect();
      this.mqttAutoReconnectEnabled = true;
      if (!this.hubDisconnectUnsub) {
        this.hubDisconnectUnsub = this.hub.onDisconnect(reason => {
          void this.onHubMqttDisconnected(reason);
        });
      }
      this.scheduleIdTokenRefreshTimer();
      return true;
    } catch (err) {
      logger.error({ err }, "BMW MQTT connect fehlgeschlagen");
      if (this.mqttAutoReconnectEnabled) {
        this.schedulePeriodicReconnect("connect_failed");
      }
      return false;
    }
  }

  private getIdTokenExpiresAtMs(): number | undefined {
    const raw = this.tokenStore.getPersisted().idExpiresAt;
    if (!raw) return undefined;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : undefined;
  }

  private async refreshTokensNow(): Promise<boolean> {
    const clientId = this.getClientId();
    if (!clientId) return false;
    logger.info("BMW Token: proaktiver Refresh vor MQTT-Reconnect");
    return await this.tokenStore.refreshWithStoredToken(clientId);
  }

  private clearReconnectTimers(): void {
    if (this.idTokenRefreshTimeout) {
      clearTimeout(this.idTokenRefreshTimeout);
      this.idTokenRefreshTimeout = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.clearPeriodicReconnect();
  }

  private clearPeriodicReconnect(): void {
    if (this.periodicReconnectTimeout) {
      clearTimeout(this.periodicReconnectTimeout);
      this.periodicReconnectTimeout = null;
    }
  }

  /**
   * Alle 5 Minuten erneut verbinden, wenn MQTT getrennt ist (z. B. langes Parken am gleichen Standort).
   */
  private schedulePeriodicReconnect(trigger: string): void {
    if (!this.mqttAutoReconnectEnabled) return;
    if (this.hub.isConnected()) return;
    if (this.periodicReconnectTimeout) return;

    this.periodicReconnectTimeout = setTimeout(() => {
      this.periodicReconnectTimeout = null;
      void this.runPeriodicReconnectAttempt(trigger);
    }, BMW_CARDATA_MQTT_RECONNECT_INTERVAL_MS);

    logger.info(
      { trigger, intervalMin: BMW_CARDATA_MQTT_RECONNECT_INTERVAL_MS / 60_000 },
      "BMW MQTT: periodischer Reconnect geplant"
    );
  }

  private async runPeriodicReconnectAttempt(trigger: string): Promise<void> {
    if (!this.mqttAutoReconnectEnabled) return;
    if (this.hub.isConnected()) return;
    if (this.reconnecting) {
      this.schedulePeriodicReconnect("already_reconnecting");
      return;
    }

    this.reconnecting = true;
    try {
      logger.info({ trigger }, "BMW MQTT: periodischer Reconnect-Versuch");
      const ok = await this.ensureMqttConnected();
      if (!ok && this.mqttAutoReconnectEnabled && !this.hub.isConnected()) {
        this.schedulePeriodicReconnect("periodic_failed");
      }
    } finally {
      this.reconnecting = false;
    }
  }

  private scheduleIdTokenRefreshTimer(): void {
    if (this.idTokenRefreshTimeout) {
      clearTimeout(this.idTokenRefreshTimeout);
      this.idTokenRefreshTimeout = null;
    }
    const expiresMs = this.getIdTokenExpiresAtMs();
    if (!expiresMs) return;

    const refreshAt = expiresMs - BMWDeviceController.ID_TOKEN_REFRESH_AHEAD_MS;
    const delayMs = Math.max(0, refreshAt - Date.now());

    this.idTokenRefreshTimeout = setTimeout(() => {
      void this.onIdTokenAboutToExpire();
    }, delayMs);
  }

  private async onIdTokenAboutToExpire(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;
    try {
      logger.info("BMW MQTT: ID-Token Ablauf nahe – Refresh + Reconnect wird vorbereitet");
      await this.refreshTokensNow();
      this.hub.disconnect();
      await this.ensureMqttConnected();
    } finally {
      this.reconnecting = false;
    }
  }

  private async onHubMqttDisconnected(reason: string): Promise<void> {
    if (!this.mqttAutoReconnectEnabled) return;
    if (this.reconnecting) return;

    if (this.reconnectAttempt >= BMW_CARDATA_MQTT_FAST_RECONNECT_MAX_ATTEMPTS) {
      logger.warn(
        { reason, attempts: this.reconnectAttempt },
        "BMW MQTT: Schnelle Reconnect-Versuche ausgeschoepft – alle 5 Minuten erneut"
      );
      this.schedulePeriodicReconnect(reason);
      return;
    }

    this.reconnectAttempt += 1;
    const delayMs = Math.min(30_000, 1000 * this.reconnectAttempt);
    logger.warn({ reason, delayMs, attempts: this.reconnectAttempt }, "BMW MQTT: Disconnect – Reconnect geplant");

    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(async () => {
      try {
        this.reconnecting = true;
        this.reconnectTimeout = null;
        const ok = await this.ensureMqttConnected();
        if (!ok && this.mqttAutoReconnectEnabled && !this.hub.isConnected()) {
          if (this.reconnectAttempt >= BMW_CARDATA_MQTT_FAST_RECONNECT_MAX_ATTEMPTS) {
            this.schedulePeriodicReconnect("fast_reconnect_failed");
          }
        }
      } finally {
        this.reconnecting = false;
      }
    }, delayMs);
  }

  /**
   * Startet OAuth2 Device Code Flow (PKCE). pendingAuth liegt im Speicher bis erfolgreich/abgelaufen.
   */
  async startDeviceCodeFlow(): Promise<DeviceCodeStartResponse> {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error("BMW CarData Client-ID fehlt – bitte in den Einstellungen speichern.");
    }
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const start = await requestDeviceCode(clientId, codeChallenge);
    this.pendingAuth = {
      device_code: start.device_code,
      code_verifier: codeVerifier,
      intervalMs: Math.max(start.interval, 5) * 1000,
      expires_at_ms: Date.now() + start.expires_in * 1000
    };
    return start;
  }

  /**
   * Ein Poll-Schritt gegen den BMW-Token-Endpunkt.
   */
  async pollDeviceTokenOnce(): Promise<DeviceCodePollApiResult> {
    const clientId = this.getClientId();
    if (!clientId) {
      return { status: "error", message: "Client-ID fehlt" };
    }
    if (!this.pendingAuth) {
      return { status: "error", message: "Kein aktiver Device-Code – Flow zuerst starten." };
    }
    if (Date.now() > this.pendingAuth.expires_at_ms) {
      this.pendingAuth = null;
      return { status: "denied", message: "Device-Code abgelaufen" };
    }
    const p = this.pendingAuth;
    const result = await pollDeviceToken(clientId, p.device_code, p.code_verifier);
    if (result.ok) {
      this.tokenStore.storeFromOAuthBody(result.body);
      this.pendingAuth = null;
      void this.ensureMqttConnected().catch(err => {
        logger.warn({ err }, "BMW MQTT: Verbindung nach Anmeldung fehlgeschlagen");
      });
      return { status: "success" };
    }
    if ("pending" in result && result.pending) {
      return { status: "pending", slowDownExtraSec: result.slowDownExtraSec };
    }
    const denied = result as { denied: true; error: string; error_description?: string };
    this.pendingAuth = null;
    return { status: "denied", message: denied.error_description ?? denied.error };
  }

  clearPendingAuth(): void {
    this.pendingAuth = null;
  }

  hasPendingDeviceAuth(): boolean {
    return this.pendingAuth != null;
  }

  /**
   * Discovery: MQTT `gcid/+`, VINs aus Nachrichten sammeln (bis Timeout).
   */
  async discoverVehiclesViaMqtt(timeoutMs = BMW_CARDATA_DISCOVERY_TIMEOUT_MS): Promise<BMWDeviceDiscovered[]> {
    this.hub.clearSeenVins();
    const ok = await this.ensureMqttConnected();
    if (!ok) {
      logger.warn("BMW Discovery: MQTT nicht verbunden (Token/Client-ID pruefen)");
      return [];
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const vins = this.hub.getSeenVins();
      if (vins.length > 0) {
        await new Promise(r => setTimeout(r, 2500));
        break;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    const vins = [...new Set(this.hub.getSeenVins())];
    return vins.map(vin => {
      const id = `bmw-${vin.toLowerCase()}`;
      return new BMWDeviceDiscovered(id, `BMW ${vin.slice(-6)}`, vin, "BMW", undefined);
    });
  }

  getTelemetrySnapshot(vin: string): Record<string, unknown> | undefined {
    return this.hub.getSnapshot(vin);
  }

  handleMqttTelemetryMessage(envelope: BmwCarDataMqttEnvelope): void {
    const { vin, data, timestamp: envelopeTs } = envelope;
    if (!vin || !data) return;
    this.onVinObserved?.(vin);

    const deviceIds = this.resolveDeviceIdsForVin?.(vin) ?? [];
    if (!this.telemetryHistory || deviceIds.length === 0) return;

    const fallbackMs =
      typeof envelopeTs === "number" && Number.isFinite(envelopeTs) ? envelopeTs : Date.now();

    for (const [key, meta] of Object.entries(data)) {
      if (!isTrackedTelemetryKey(key)) continue;
      if (!meta || typeof meta !== "object" || !("value" in meta)) continue;
      const entry = meta as { timestamp?: number; value: unknown };
      const timeMs =
        typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
          ? entry.timestamp
          : fallbackMs;
      for (const deviceId of deviceIds) {
        this.telemetryHistory.append(deviceId, key, entry.value, timeMs);
      }
    }
  }

  /**
   * Registriert Listener fuer alle VIN-Updates (MQTT).
   */
  setStreamVinListener(cb: (vin: string) => void): void {
    this.clearStreamVinListener();
    this.streamMessageUnsub = this.hub.onMessage(env => this.handleMqttTelemetryMessage(env));
    this.streamVinUnsub = this.hub.onVin(cb);
  }

  clearStreamVinListener(): void {
    if (this.streamMessageUnsub) {
      this.streamMessageUnsub();
      this.streamMessageUnsub = null;
    }
    if (this.streamVinUnsub) {
      this.streamVinUnsub();
      this.streamVinUnsub = null;
    }
  }

  disconnectMqtt(): void {
    this.mqttAutoReconnectEnabled = false;
    this.clearStreamVinListener();
    this.clearReconnectTimers();
    this.hub.disconnect();
  }

  /** Stream soll aktiv bleiben – periodischer Reconnect, falls MQTT fehlt. */
  enableMqttAutoReconnect(): void {
    this.mqttAutoReconnectEnabled = true;
    if (!this.hub.isConnected()) {
      this.schedulePeriodicReconnect("stream_start");
    }
  }

  getMqttConnected(): boolean {
    return this.hub.isConnected();
  }

  getLastMessageAt(): number | undefined {
    return this.hub.getLastMessageAt();
  }

  async startEventStream(_device: BMWCar, _callback: (event: BMWEvent) => void): Promise<void> {
    // Pro-Device-Streams nutzt BMWEventStreamManager den Hub zentral.
  }

  async stopEventStream(_device: BMWCar): Promise<void> {
    // siehe disconnectMqtt / EventStreamManager
  }
}
