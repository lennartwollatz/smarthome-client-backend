import type { Scene } from "../../actions/scene/Scene.js";

/** Szene, wie sie die Szenen-Endpunkte zurückgeben. */
export class Response_Scene {
  constructor(readonly scene: Scene) {}

  toJSON(): Scene {
    return this.scene;
  }
}
