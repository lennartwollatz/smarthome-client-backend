import type { Scene } from "../../actions/scene/Scene.js";

/** POST /api/scenes/:sceneId/deactivate – Kurzform `{ id, name, active: false }`. */
export class Response_DeactivateScene {
  readonly id?: string;
  readonly name?: string;
  readonly active = false;

  constructor(scene: Scene) {
    this.id = scene.id;
    this.name = scene.name;
  }
}
