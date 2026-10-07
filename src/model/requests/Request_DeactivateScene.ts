/** POST /api/scenes/:sceneId/deactivate */
export class Request_DeactivateScene {
  readonly sceneId!: string;

  constructor(fields: Request_DeactivateScene) {
    Object.assign(this, fields);
  }
}
