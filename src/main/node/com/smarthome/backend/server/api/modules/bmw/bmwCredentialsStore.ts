import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";

const BMW_CREDENTIALS_ID = "bmw";

export interface BMWCarDataCredentials {
  clientId?: string;
  mqttHost?: string;
  mqttPort?: number;
}

type BMWCredentialsPersisted = BMWCarDataCredentials;

export class BMWCredentialsStore {
  private repository: JsonRepository<BMWCredentialsPersisted>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<BMWCredentialsPersisted>(databaseManager, "BMWCredentials");
  }

  getCredentials(): BMWCredentialsPersisted {
    return this.repository.findById(BMW_CREDENTIALS_ID) ?? {};
  }

  setClientId(clientId: string): void {
    const current = this.getCredentials();
    this.repository.save(BMW_CREDENTIALS_ID, {
      ...current,
      clientId: clientId.trim()
    });
  }

  setMqttEndpoint(host?: string, port?: number): void {
    const current = this.getCredentials();
    const next: BMWCredentialsPersisted = { ...current };
    if (typeof host === "string" && host.trim()) next.mqttHost = host.trim();
    else delete next.mqttHost;
    if (typeof port === "number" && !Number.isNaN(port) && port > 0) next.mqttPort = port;
    else delete next.mqttPort;
    this.repository.save(BMW_CREDENTIALS_ID, next);
  }

  hasClientId(): boolean {
    const c = this.getCredentials().clientId;
    return typeof c === "string" && c.trim().length > 0;
  }

  canDiscover(): boolean {
    return this.hasClientId();
  }
}
