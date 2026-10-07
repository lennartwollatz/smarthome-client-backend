/** Zeile der Tabelle `scene_actions`. */
export class DbSceneAction {
  readonly sceneId!: string;
  readonly actionId!: string;
  readonly sortIndex!: number;

  constructor(fields: DbSceneAction) {
    Object.assign(this, fields);
  }
}
