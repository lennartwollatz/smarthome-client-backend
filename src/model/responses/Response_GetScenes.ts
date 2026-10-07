import type { Scene } from "../../actions/scene/Scene.js";

/** GET /api/scenes – Antwort ist das Szenen-Array. */
export class Response_GetScenes {
  constructor(readonly scenes: Scene[]) {}

  toJSON(): Scene[] {
    return this.scenes;
  }
}
