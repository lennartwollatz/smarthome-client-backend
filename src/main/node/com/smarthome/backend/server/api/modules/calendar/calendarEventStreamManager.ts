import { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import type { DatabaseManager } from "../../../db/database.js";
import type { CalendarEvent } from "./calendarEvent.js";
import { CALENDARCONFIG } from "./calendarModule.js";
import { CalendarDeviceController } from "./calendarDeviceController.js";

export class CalendarEventStreamManager extends ModuleEventStreamManager<CalendarDeviceController, CalendarEvent> {

  constructor(managerId: string, controller: CalendarDeviceController, actionManager: ActionManager, databaseManager: DatabaseManager) {
    super(managerId, CALENDARCONFIG.id, controller, actionManager);
  }

  protected handleEvent(_event: CalendarEvent): void {
    // aktuell keine Kalender-Events (wird ggf. von externen Providern in Zukunft genutzt)
  }

  protected async startEventStream(callback: (event: CalendarEvent) => void): Promise<void> {
    
  }

  protected async stopEventStream(): Promise<void> {

  }
}


