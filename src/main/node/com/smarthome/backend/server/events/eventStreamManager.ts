import type { ModuleEventStreamManager } from "../api/modules/moduleEventStreamManager.js";
import { logger } from "../../logger.js";

export class EventStreamManager {
  private moduleEventStreamManagers = new Map<string, ModuleEventStreamManager>();

  registerModuleEventStreamManager(managers: ModuleEventStreamManager[]): void;
  registerModuleEventStreamManager(manager: ModuleEventStreamManager): void;
  registerModuleEventStreamManager(
    managerOrManagers: ModuleEventStreamManager | ModuleEventStreamManager[]
  ) {
    if (!managerOrManagers) {
      throw new Error("ModuleEventStreamManager darf nicht null sein");
    }
    const managers = Array.isArray(managerOrManagers) ? managerOrManagers : [managerOrManagers];
    managers.forEach(manager => this.registerSingle(manager));
  }

  private registerSingle(manager: ModuleEventStreamManager) {
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

  unregisterModuleEventStreamManager(moduleId: string, managerId: string) {
    if (!moduleId || !managerId) return false;
    const eventStreamId = `${moduleId}@${managerId}`;
    const manager = this.moduleEventStreamManagers.get(eventStreamId);
    if (!manager) return false;
    this.moduleEventStreamManagers.delete(eventStreamId);
    if (manager.isRunning()) {
      try {
        void manager.stop();
        logger.info({ moduleId, managerId }, "ModuleEventStreamManager gestoppt");
      } catch (err) {
        logger.error(
          { err, moduleId, managerId },
          "Fehler beim Stoppen des ModuleEventStreamManager"
        );
      }
    }
    logger.info({ moduleId, managerId }, "ModuleEventStreamManager entfernt");
    return true;
  }

  async start() {
    for (const manager of this.moduleEventStreamManagers.values()) {
      try {
        await manager.start();
      } catch (err) {
        logger.warn({ err, managerId: manager.getManagerId() }, "EventStreamManager start fehlgeschlagen");
      }
    }
  }

  async stop() {
    logger.info(
      { count: this.moduleEventStreamManagers.size },
      "Stoppe EventStreamManager mit registrierten Modulen"
    );
    const failedEventStreams: string[] = [];
    for (const [eventStreamId, manager] of this.moduleEventStreamManagers.entries()) {
      const [moduleId, managerId] = eventStreamId.split("@");
      if (manager.isRunning()) {
        try {
          await manager.stop();
          logger.info({ moduleId, managerId }, "ModuleEventStreamManager gestoppt");
        } catch (err) {
          logger.error(
            { err, moduleId, managerId },
            "Fehler beim Stoppen des ModuleEventStreamManager"
          );
          failedEventStreams.push(eventStreamId);
        }
      } else {
        logger.debug(
          { moduleId, managerId },
          "ModuleEventStreamManager laeuft nicht, ueberspringe"
        );
      }
    }
    if (failedEventStreams.length > 0) {
      logger.warn(
        { failedCount: failedEventStreams.length, failedEventStreams },
        "EventStreamManager gestoppt, aber EventStreams konnten nicht gestoppt werden"
      );
    } else {
      logger.info(
        { count: this.moduleEventStreamManagers.size },
        "EventStreamManager erfolgreich gestoppt"
      );
    }
  }
}

