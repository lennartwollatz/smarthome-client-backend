import type { Response_HueBridge } from "./Response_HueBridge.js";

/** GET /api/modules/hue/bridges/discover – Antwort ist das Array der gefundenen Bridges. */
export class Response_HueDiscoverBridges {
  constructor(readonly bridges: Response_HueBridge[]) {}

  toJSON(): Response_HueBridge[] {
    return this.bridges;
  }
}
