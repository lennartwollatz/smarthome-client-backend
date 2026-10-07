/** DELETE /api/scenes/:sceneId */
export class Request_DeleteScene {
  readonly sceneId!: string;

  constructor(fields: Request_DeleteScene) {
    Object.assign(this, fields);
  }
}
