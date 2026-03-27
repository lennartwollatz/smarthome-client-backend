import { logger } from "../../../../../logger.js";
import { Event } from "../../../../events/events/Event.js";
import { DeviceTrigger } from "../action/DeviceTrigger.js";
import { ActionRunnable } from "./ActionRunnable.js";
import { ActionRunnableEnvironment } from "./ActionRunnableEnvironment.js";
import { ActionRunnableResponse } from "./ActionRunnableResponse.js";

export type ActionRunnableEventBasedRunnable = (environment:ActionRunnableEnvironment) => Promise<ActionRunnableResponse>;

export class ActionRunnableEventBased extends ActionRunnable {
  event: DeviceTrigger | null;
  private runnable: ActionRunnableEventBasedRunnable;

  constructor(id: string, actionId: string, runnable: ActionRunnableEventBasedRunnable, event: DeviceTrigger | null) {
    super(id, actionId, "event");
    this.event = event;
    this.runnable = runnable;
  }

  public async run(environment:ActionRunnableEnvironment): Promise<ActionRunnableResponse> {
    const response = await this.runnable(environment);
    if (!response.success) {
      logger.warn({ actionId: this.actionId, error: response.error }, "Workflow-Fehler");
    }
    return response;
  }
}

