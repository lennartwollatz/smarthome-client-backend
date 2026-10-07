import { Event } from "./events/Event.js";

export class EventLogger {
    private events: Event[] = [];

    constructor() {
        this.clearEvents();
    }

    public log(event: Event) {
        console.log(`Event ausgelöst:${event.deviceId} - ${event.eventType}  Conditions:[${event.eventConditions.map(condition => condition.name + "=" + condition.value).join(", ")}] Parameters:[${event.eventParameters.map(parameter => parameter.name + "=" + parameter.value).join(", ")}] Results:[${event.eventResults.map(result => result.name + "=" + result.value).join(", ")}]`);
        this.events.push(event);
    }

    public getEventsLast10Minutes(): Event[] {
        const eventsCopied = [...this.events];
        return eventsCopied.filter(event => new Date().getTime() - event.timestamp < 10 * 60 * 1000);
    }

    private clearEvents() {
        setInterval(() => {
            try{
            const newEvents = this.events.filter(event => new Date().getTime() - event.timestamp < 10 * 60 * 1000);
            this.events = newEvents;
            } catch (err) {
                console.error({ err }, "Fehler beim Löschen der Events");
            }
        }, 1000 * 60);
    }
}