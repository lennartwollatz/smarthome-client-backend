/** POST /api/scenes/:sceneId/activate */
export class Request_ActivateScene {
  readonly sceneId!: string;

  constructor(fields: Request_ActivateScene) {
    Object.assign(this, fields);
  }
}
