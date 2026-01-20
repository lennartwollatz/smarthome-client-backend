package com.smarthome.backend.server.api.modules;

import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.events.EventStreamManager;

public class ModuleManager {

    protected final DatabaseManager databaseManager;
    protected final EventStreamManager eventStreamManager;
    protected final ActionManager actionManager;

    public ModuleManager(DatabaseManager databaseManager, EventStreamManager eventStreamManager, ActionManager actionManager) {
        this.databaseManager = databaseManager;
        this.eventStreamManager = eventStreamManager;
        this.actionManager = actionManager;
    }

}
