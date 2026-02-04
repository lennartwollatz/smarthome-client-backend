import { logger } from "../logger.js";
import { Node } from "./Node.js";

export class Workflow {
  nodes?: Node[];
  startNodeId?: string;

  constructor(init?: Partial<Workflow>) {
    Object.assign(this, init);
  }

  getTriggerNode() {
    if (!this.nodes || this.nodes.length === 0) {
      logger.warn("No trigger node found");
      return null;
    }
    const triggerNode = this.nodes.find(node => node.type === "trigger") ?? null;
    if (!triggerNode) {
      logger.warn("No trigger node found");
    }
    return triggerNode;
  }
}
