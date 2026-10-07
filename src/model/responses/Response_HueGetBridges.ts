import type { Response_HueBridge } from "./Response_HueBridge.js";

/** GET /api/modules/hue/bridges – Antwort ist das Array der gekoppelten Bridges. */
export class Response_HueGetBridges {
  constructor(readonly bridges: Response_HueBridge[]) {}

  toJSON(): Response_HueBridge[] {
    return this.bridges;
  }
}
