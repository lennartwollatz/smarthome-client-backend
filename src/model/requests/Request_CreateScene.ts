/** POST /api/scenes */
export class Request_CreateScene {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly icon?: string | null;
  readonly active?: boolean | null;
  readonly description?: string | null;
  readonly actionIds?: string[] | null;
  readonly showOnHome?: boolean | null;
  readonly isCustom?: boolean | null;

  constructor(fields: Request_CreateScene) {
    Object.assign(this, fields);
  }
}
