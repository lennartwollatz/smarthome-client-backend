import { Event } from "./events/Event.js";

const EVENT_LOG_MAX = 20_000;

export class EventLogger {
    private events: Event[] = [];

    constructor() {
        this.clearEvents();
    }

    public log(event: Event) {
        this.events.push(event);
        if (this.events.length > EVENT_LOG_MAX) {
            this.events = this.events.slice(-Math.floor(EVENT_LOG_MAX / 2));
        }
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