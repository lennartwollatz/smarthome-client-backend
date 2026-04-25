import { ActionRunnable } from "./ActionRunnable.js";
import { ActionRunnableEnvironment } from "./ActionRunnableEnvironment.js";
import { ActionRunnableResponse } from "./ActionRunnableResponse.js";

export type ActionRunnableManualBasedRunnable = (environment:ActionRunnableEnvironment) => Promise<ActionRunnableResponse>;

export class ActionRunnableManualBased extends ActionRunnable {
  private runnable: ActionRunnableManualBasedRunnable;
  constructor(id: string, runnable: ActionRunnableManualBasedRunnable) {
    super(id, id, "manual");
    this.runnable = runnable;
  }

  public async run(environment:ActionRunnableEnvironment): Promise<ActionRunnableResponse> {
    const response = await this.runnable(environment);
    return response;
  }
}

