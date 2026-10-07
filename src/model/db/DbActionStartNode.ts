/** Zeile der Tabelle `action_start_nodes`. */
export class DbActionStartNode {
  readonly actionId!: string;
  readonly nodeId!: string;

  constructor(fields: DbActionStartNode) {
    Object.assign(this, fields);
  }
}
