export type ActionRunnableType = "event" | "time" | "manual";

export abstract class ActionRunnable {
    id: string;
    actionId: string;
    type: ActionRunnableType;
    isSubActionRunnable: boolean = false;

    constructor(id: string, actionId: string, type: ActionRunnableType) {
        this.id = id;
        this.actionId = actionId;
        this.type = type;
        this.isSubActionRunnable = id !== actionId;
    }

}