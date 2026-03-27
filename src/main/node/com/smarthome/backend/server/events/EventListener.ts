import { Event } from "./events/Event.js";
import { ActionRunnable } from "../api/entities/actions/runnable/ActionRunnable.js";
import { ActionRunnableManualBased } from "../api/entities/actions/runnable/ActionRunnableManualBased.js";
import { ActionRunnableEventBased } from "../api/entities/actions/runnable/ActionRunnableEventBased.js";
import { ActionRunnableTimeBased } from "../api/entities/actions/runnable/ActionRunnableTimeBased.js";

export class EventListener {
    listenerId: string;
    deviceId:string;
    runnable: ActionRunnable;

    constructor(listenerId: string, deviceId:string, runnable: ActionRunnable) {
        this.listenerId = listenerId;
        this.deviceId = deviceId;
        this.runnable = runnable;
    }

    public run(){
        if( this.runnable.type === "manual" ){
            return (this.runnable as ActionRunnableManualBased).run({ environment: new Map <string, any>() });
        } else if( this.runnable.type === "event" ){
            return (this.runnable as ActionRunnableEventBased).run({ environment: new Map <string, any>() });
        } else if( this.runnable.type === "time" ){
            return (this.runnable as ActionRunnableTimeBased).run();
        }
    }
    
    /**
     * @returns true wenn matchesListener true war und run() aufgerufen wurde
     */
    public checkedRun(event: Event): boolean {
        if (!event.matchesListener(this)) {
            return false;
        }
        this.run();
        return true;
    }
}