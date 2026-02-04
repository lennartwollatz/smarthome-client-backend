export class XiaomiDiscoveredDevice {
  id?: string;
  name?: string;
  model?: string;
  token?: string;
  ip?: string;
  mac?: string;
  did?: string;
  locale?: string;
  status?: string;

  constructor(
    id?: string,
    name?: string,
    model?: string,
    token?: string,
    ip?: string,
    mac?: string,
    did?: string,
    locale?: string,
    status?: string
  ) {
    this.id = id;
    this.name = name;
    this.model = model;
    this.token = token;
    this.ip = ip;
    this.mac = mac;
    this.did = did;
    this.locale = locale;
    this.status = status;
  }

  getBestConnectionAddress() {
    return this.ip ?? null;
  }
}

