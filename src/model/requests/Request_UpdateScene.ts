/** PUT /api/scenes/:sceneId */
export class Request_UpdateScene {
  readonly sceneId!: string;
  readonly name?: string | null;
  readonly icon?: string | null;
  readonly active?: boolean | null;
  readonly description?: string | null;
  readonly actionIds?: string[] | null;
  readonly showOnHome?: boolean | null;
  readonly isCustom?: boolean | null;

  constructor(fields: Request_UpdateScene) {
    Object.assign(this, fields);
  }
}
