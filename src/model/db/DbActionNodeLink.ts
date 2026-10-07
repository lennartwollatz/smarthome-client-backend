export type DbActionNodeLinkType = "next" | "true" | "false" | "loop";

/** Zeile der Tabelle `action_node_links`. */
export class DbActionNodeLink {
  readonly actionId!: string;
  readonly nodeId!: string;
  readonly linkType!: DbActionNodeLinkType;
  readonly sortIndex!: number;
  readonly targetNodeId!: string;

  constructor(fields: DbActionNodeLink) {
    Object.assign(this, fields);
  }
}
