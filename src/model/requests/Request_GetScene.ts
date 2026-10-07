/** GET /api/scenes/:sceneId */
export class Request_GetScene {
  readonly sceneId!: string;

  constructor(fields: Request_GetScene) {
    Object.assign(this, fields);
  }
}
