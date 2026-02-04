export class DeviceListenerParams {
  key?: string;
  name?: string;
  param1?: unknown;
  param2?: unknown;

  constructor(init?: Partial<DeviceListenerParams>) {
    Object.assign(this, init);
  }

  getParam1AsInt() {
    if (typeof this.param1 === "number") return Math.trunc(this.param1);
    if (typeof this.param1 === "string" && this.param1.trim()) {
      const parsed = Number(this.param1);
      return Number.isNaN(parsed) ? null : Math.trunc(parsed);
    }
    return null;
  }

  getParam1AsString() {
    return this.param1 != null ? String(this.param1) : null;
  }

  getParam1AsBoolean() {
    if (typeof this.param1 === "boolean") return this.param1;
    return null;
  }

  getParam2AsInt() {
    if (typeof this.param2 === "number") return Math.trunc(this.param2);
    if (typeof this.param2 === "string" && this.param2.trim()) {
      const parsed = Number(this.param2);
      return Number.isNaN(parsed) ? null : Math.trunc(parsed);
    }
    return null;
  }

  getParam2AsString() {
    return this.param2 != null ? String(this.param2) : null;
  }

  getParam2AsBoolean() {
    if (typeof this.param2 === "boolean") return this.param2;
    return null;
  }
}

