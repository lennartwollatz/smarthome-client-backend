import type { Scene } from "../../actions/scene/Scene.js";

/** POST /api/scenes/:sceneId/activate – Kurzform `{ id, name, active: true }`. */
export class Response_ActivateScene {
  readonly id?: string;
  readonly name?: string;
  readonly active = true;

  constructor(scene: Scene) {
    this.id = scene.id;
    this.name = scene.name;
  }
}
