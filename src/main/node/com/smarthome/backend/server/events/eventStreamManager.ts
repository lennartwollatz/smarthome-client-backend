import type { ModuleEventStreamManager } from "../api/modules/moduleEventStreamManager.js";
import { logger } from "../../logger.js";

export class EventStreamManager {
  private moduleEventStreamManagers = new Map<string, ModuleEventStreamManager<any, any>>();

  registerModuleEventStreamManager(managers: ModuleEventStreamManager<any, any>[]): void;
  registerModuleEventStreamManager(manager: ModuleEventStreamManager<any, any>): void;
  registerModuleEventStreamManager(
    managerOrManagers: ModuleEventStreamManager<any, any> | ModuleEventStreamManager<any, any>[]
  ) {
    if (!managerOrManagers) {
      throw new Error("ModuleEventStreamManager darf nicht null sein");
    }
    const managers = Array.isArray(managerOrManagers) ? managerOrManagers : [managerOrManagers];
    managers.forEach(manager => this.registerSingle(manager));
  }

  private registerSingle(manager: ModuleEventStreamManager<any, any>) {
    if (!manager) {
      throw new Error("ModuleEventStreamManager darf nicht null sein");
    }
    const moduleId = manager.getModuleId();
    if (!moduleId) {
      throw new Error("Modul-ID darf nicht null oder leer sein");
    }
    const managerId = manager.getManagerId();
    if (!managerId) {
      throw new Error("Manager-ID darf nicht null oder leer sein");
    }
    const eventStreamId = `${moduleId}@${managerId}`;

    if (this.moduleEventStreamManagers.has(eventStreamId)) {
      logger.warn(
        { moduleId, managerId },
        "ModuleEventStreamManager ist bereits registriert. Ueberschreibe vorhandenen Manager."
      );
      try {
        void this.moduleEventStreamManagers.get(eventStreamId)?.stop();
      } catch (err) {
        logger.error(
          { err, moduleId, managerId },
          "Fehler beim Stoppen des ModuleEventStreamManager"
        );
      }
    }

    this.moduleEventStreamManagers.set(eventStreamId, manager);
    logger.info(
      { moduleId, managerId, description: manager.getDescription() },
      "ModuleEventStreamManager registriert"
    );

    try {
      void manager.start();
      logger.info({ moduleId, managerId }, "ModuleEventStreamManager gestartet");
    } catch (err) {
      logger.error(
        { err, moduleId, managerId },
        "Fehler beim Starten des ModuleEventStreamManager"
      );
    }
  }

  public has(moduleId: string, managerId: string): boolean {
    return this.moduleEventStreamManagers.has(`${moduleId}@${managerId}`);
  }

  private unregisterModuleEventStreamManager(eventStreamId:string) {
    if (!eventStreamId) return false;
    const manager = this.moduleEventStreamManagers.get(eventStreamId);
    if (!manager) return false;
    this.moduleEventStreamManagers.delete(eventStreamId);
    if (manager.isRunning()) {
      try {
        void manager.stop();
        logger.info({ eventStreamId }, "ModuleEventStreamManager gestoppt");
      } catch (err) {
        logger.error(
          { err, eventStreamId },
          "Fehler beim Stoppen des ModuleEventStreamManager"
        );
      }
    }
    logger.info({ eventStreamId }, "ModuleEventStreamManager entfernt");
    return true;
  }


  public stop() {
    logger.info(
      { count: this.moduleEventStreamManagers.size },
      "Stoppe EventStreamManager mit registrierten Modulen"
    );
    for (const eventStreamId of this.moduleEventStreamManagers.keys()) {
      this.unregisterModuleEventStreamManager(eventStreamId);
    }
  }
}

