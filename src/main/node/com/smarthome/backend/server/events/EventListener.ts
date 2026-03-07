import { Event } from "./events/Event.js";
import { ActionRunnable } from "../actions/runnable/ActionRunnable.js";
import { ActionRunnableManualBased } from "../actions/runnable/ActionRunnableManualBased.js";
import { ActionRunnableEventBased } from "../actions/runnable/ActionRunnableEventBased.js";
import { ActionRunnableTimeBased } from "../actions/runnable/ActionRunnableTimeBased.js";

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
            return (this.runnable as ActionRunnableManualBased).run({ environment: new Map <string, any>() }).then(response => {
                if( !response.success ){
                    console.log(response.error);
                }
                if( response.warning ){
                    console.log(response.warning);
                }
            });
        } else if( this.runnable.type === "event" ){
            return (this.runnable as ActionRunnableEventBased).run({ environment: new Map <string, any>() }).then(response => {
                if( !response.success ){
                    console.log(response.error);
                }
                if( response.warning ){
                    console.log(response.warning);
                }
            });
        } else if( this.runnable.type === "time" ){
            return (this.runnable as ActionRunnableTimeBased).run();
        }
    }
    
    public checkedRun(event: Event){
        if( event.matchesListener(this) ){
            this.run();
        }
    }
}