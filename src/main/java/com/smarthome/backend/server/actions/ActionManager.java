package com.smarthome.backend.server.actions;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.smarthome.backend.model.Action;
import com.smarthome.backend.model.DeviceTrigger;
import com.smarthome.backend.model.Node;
import com.smarthome.backend.model.Scene;
import com.smarthome.backend.model.TimeTrigger;
import com.smarthome.backend.model.TriggerConfig;
import com.smarthome.backend.model.Workflow;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.model.devices.helper.DeviceListenerParams;
import com.smarthome.backend.model.devices.helper.DevicePolymorphicAdapter;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;

/**
 * Zentraler ActionManager für die Verwaltung von Geräten und Aktionen.
 * 
 * Der ActionManager:
 * - Verwaltet alle Geräte im Netzwerk
 * - Ermöglicht Modulen, ihre Geräte zu registrieren
 * - Lädt bei Initialisierung alle Devices aus der Datenbank und instanziiert sie
 * - Lädt alle Aktionen aus der Datenbank
 * - Baut Workflows als ausführbare Funktionen nach
 * - Versieht Geräte basierend auf Action-Triggern mit Listenern
 * - Führt zeitbasierte Aktionen aus
 * - Integriert manuelle Aktionen in Scenes
 */
public class ActionManager {
    private static final Logger logger = LoggerFactory.getLogger(ActionManager.class);
    

    private final Gson deviceGson;
    private final DatabaseManager databaseManager;
    

    private final Repository<Device> deviceRepository;
    private final Repository<Action> actionRepository;
    private final Repository<Scene> sceneRepository;
    

    private final Map<String, Device> devices = new ConcurrentHashMap<>();
    private final Map<String, Action> actions = new ConcurrentHashMap<>();
    private final Map<String, Scene> scenes = new ConcurrentHashMap<>();

    private final Map<String, ActionRunnable> actionRunnables = new ConcurrentHashMap<>();
    
    /**
     * Map der aktiven TimeTriggerRunnables.
     * Key: Action-ID, Value: TimeTriggerRunnable
     */
    private final Map<String, TimeTriggerRunnable> timeTriggerRunnables = new ConcurrentHashMap<>();
    
    /**
     * Executor-Service für zeitbasierte Trigger.
     */
    private final ScheduledExecutorService schedulerService;
    

    /**
     * Konstruktor.
     * 
     * @param databaseManager Der DatabaseManager für Repository-Zugriff
     */
    public ActionManager(DatabaseManager databaseManager) {
        this.databaseManager = databaseManager;
        this.deviceRepository = new JsonRepository<>(databaseManager, Device.class);
        this.actionRepository = new JsonRepository<>(databaseManager, Action.class);
        this.sceneRepository = new JsonRepository<>(databaseManager, Scene.class);
        
        // Initialisiere Scheduler-Service für zeitbasierte Trigger
        this.schedulerService = Executors.newScheduledThreadPool(10);
        
        // Initialisiere deviceGson mit polymorphem Adapter
        this.deviceGson = new GsonBuilder()
            .registerTypeAdapter(Device.class, new DevicePolymorphicAdapter())
            .create();
        
        this.initialize();
        
        logger.info("ActionManager erstellt");
    }
    
    /**
     * Initialisiert den ActionManager.
     * Lädt alle Devices und Actions aus der Datenbank und richtet Workflows ein.
     * 
     */
    public void initialize() {       
        logger.info("Initialisiere ActionManager...");
        
        try {
            // Lade alle Devices aus der Datenbank
            loadDevicesFromDatabase();
            
            // Lade alle Actions aus der Datenbank
            loadActionsFromDatabase();

            // Lade alle Scenes aus der Datenbank
            loadScenesFromDatabase();
            
            // Baue Workflows und richte Trigger ein
            setupWorkflows();
            
            logger.info("ActionManager erfolgreich initialisiert. {} Devices, {} Actions, {} Scenes geladen", 
                devices.size(), actions.size(), scenes.size());
        } catch (Exception e) {
            logger.error("Fehler bei der Initialisierung des ActionManager", e);
            throw e;
        }
    }
    
    /**
     * Lädt alle Devices aus der Datenbank und instanziiert sie mit den richtigen Klassen.
     * Verwendet deviceGson mit DevicePolymorphicAdapter für korrekte polymorphe Deserialisierung.
     */
    private void loadDevicesFromDatabase() {
        logger.info("Lade Devices aus der Datenbank...");
        
        try {
            // Lese JSON-Daten direkt aus der Datenbank und deserialisiere mit polymorphem Adapter
            String sql = "SELECT id, data FROM objects WHERE type = ? ORDER BY created_at DESC";
            
            try (java.sql.Connection conn = databaseManager.getConnection()) {
                if (conn == null) {
                    logger.error("Konnte keine Datenbankverbindung herstellen");
                    return;
                }
                
                try (java.sql.PreparedStatement stmt = conn.prepareStatement(sql)) {
                    stmt.setString(1, "Device");
                    
                    try (java.sql.ResultSet rs = stmt.executeQuery()) {
                        while (rs.next()) {
                            String id = rs.getString("id");
                            String json = rs.getString("data");
                            
                            try {
                                // Deserialisiere mit polymorphem Adapter, um die richtige konkrete Klasse zu erhalten
                                Device device = deviceGson.fromJson(json, Device.class);
                                
                                if (device != null && device.getId() != null) {
                                    devices.put(device.getId(), device);
                                    logger.debug("Device {} geladen: {} ({})", 
                                        device.getId(), device.getName(), device.getClass().getSimpleName());
                                }
                            } catch (Exception e) {
                                logger.error("Fehler beim Deserialisieren von Device {} aus Datenbank", id, e);
                            }
                        }
                    }
                }
            }
            
            logger.info("{} Devices aus der Datenbank geladen", devices.size());
        } catch (Exception e) {
            logger.error("Fehler beim Laden der Devices aus der Datenbank", e);
        }
    }
    
    /**
     * Lädt alle Actions aus der Datenbank.
     */
    private void loadActionsFromDatabase() {
        logger.info("Lade Actions aus der Datenbank...");
        
        try {
            List<Action> dbActions = actionRepository.findAll();
            
            for (Action action : dbActions) {
                if (action != null && action.getActionId() != null) {
                    actions.put(action.getActionId(), action);
                    logger.debug("Action {} geladen: {}", action.getActionId(), action.getName());
                }
            }
            
            logger.info("{} Actions aus der Datenbank geladen", actions.size());
        } catch (Exception e) {
            logger.error("Fehler beim Laden der Actions aus der Datenbank", e);
        }
    }
    
    /**
     * Lädt alle Actions aus der Datenbank.
     */
    private void loadScenesFromDatabase() {
        logger.info("Lade Scenes aus der Datenbank...");
        
        try {
            List<Scene> dbScenes = sceneRepository.findAll();
            
            for (Scene scene : dbScenes) {
                if (scene != null && scene.getId() != null) {
                    scenes.put(scene.getId(), scene);
                    logger.debug("Scene {} geladen: {}", scene.getId(), scene.getName());
                }
            }
            
            logger.info("{} Scenes aus der Datenbank geladen", scenes.size());
        } catch (Exception e) {
            logger.error("Fehler beim Laden der Scenes aus der Datenbank", e);
        }
    }
    
    /**
     * Baut alle Workflows auf und richtet Trigger ein.
     */
    private void setupWorkflows() {
        logger.info("Richte Workflows ein...");
        
        for (Action action : actions.values()) {
            actionRunnables.put(action.getActionId(), action.getActionRunnable(devices, scenes, actionRunnables));
        }

        addRunnablesForScenes();
        addRunnablesForActions();
        
        logger.info("Workflows eingerichtet");
    }

    private void addRunnablesForActions() {
        for(Action action : actions.values()) {
            boolean runnableCreated = false;
            String triggerInfo = null;
            
            switch(action.getTriggerType()) {
                case "manual":
                    addRunnablesForActionsManual(action);
                    if (actionRunnables.containsKey(action.getActionId())) {
                        runnableCreated = true;
                        triggerInfo = "manuell";
                    }
                    break;
                case "device":
                    addRunnableForActionsDevice(action);
                    if (actionRunnables.containsKey(action.getActionId())) {
                        runnableCreated = true;
                        triggerInfo = getDeviceTriggerInfo(action);
                    }
                    break;
                case "time":
                    addRunnableForActionsTime(action);
                    if (actionRunnables.containsKey(action.getActionId())) {
                        runnableCreated = true;
                        triggerInfo = getTimeTriggerInfo(action);
                    }
                    break;
            }
            
            if (runnableCreated && triggerInfo != null) {
                logger.info("Aktion {} initialisiert:\n  Trigger - {}", action.getName(), triggerInfo);
            }
        }
    }
    
    private String getDeviceTriggerInfo(Action action) {
        Workflow workflow = action.getWorkflow();
        if (workflow == null) {
            return "unbekannt WF";
        }
        
        Node triggerNode = workflow.getTriggerNode();
        if (triggerNode == null) {
            return "unbekannt TN";
        }
        
        TriggerConfig triggerConfig = triggerNode.getTriggerConfig();
        if (triggerConfig == null) {
            return "unbekannt TC";
        }
        
        DeviceTrigger deviceTrigger = triggerConfig.getDeviceTrigger();
        if (deviceTrigger == null) {
            return "unbekannt DT";
        }
        
        String triggerDeviceId = deviceTrigger.getTriggerDeviceId();
        if (triggerDeviceId == null) {
            return "unbekannt TDID";
        }
        
        Device device = devices.get(triggerDeviceId);
        if (device == null) {
            return "unbekannt D";
        }
        
        String deviceName = device.getName() != null ? device.getName() : triggerDeviceId;
        String deviceType = device.getTypeLabel() != null ? device.getTypeLabel() : 
                           (device.getType() != null ? device.getType().toString() : "unbekannt");
        
        return String.format("%s - %s", deviceName, deviceType);
    }
    
    private String getTimeTriggerInfo(Action action) {
        Workflow workflow = action.getWorkflow();
        if (workflow == null) {
            return "Zeit-Trigger (unbekannt)";
        }
        
        Node triggerNode = workflow.getTriggerNode();
        if (triggerNode == null) {
            return "Zeit-Trigger (unbekannt)";
        }
        
        TriggerConfig triggerConfig = triggerNode.getTriggerConfig();
        if (triggerConfig == null) {
            return "Zeit-Trigger (unbekannt)";
        }
        
        TimeTrigger timeTrigger = triggerConfig.getTimeTrigger();
        if (timeTrigger == null) {
            return "Zeit-Trigger (unbekannt)";
        }
        
        String frequency = timeTrigger.getFrequency() != null ? timeTrigger.getFrequency() : "unbekannt";
        String time = timeTrigger.getTime() != null ? timeTrigger.getTime() : "unbekannt";
        
        return String.format("Zeit-Trigger - %s um %s", frequency, time);
    }

    private void addRunnablesForScenes() {
        for(Scene scene : scenes.values()) {
            addRunnablesForScene(scene);
        }
    }

    private void addRunnablesForScene(Scene scene) {
        for(String actionId : scene.getActionIds()) {
            if(actionRunnables.containsKey(actionId)) {
                scene.addListener(actionId, () -> { if(actionRunnables.containsKey(actionId)) { actionRunnables.get(actionId).run(); } else { logger.warn("Action {} nicht gefunden", actionId); } });
            }
        }
    }

    private void addRunnablesForActionsManual(Action action) {
        for(Scene scene : scenes.values()) {
            if(actionRunnables.containsKey(action.getActionId())) {
                scene.addListener(action.getActionId(), () -> { if(actionRunnables.containsKey(action.getActionId())) { actionRunnables.get(action.getActionId()).run(); } else { logger.warn("Action {} nicht gefunden", action.getActionId()); } });
            }
        }
    }

    private void addRunnableForActionsDevice(Action action) {
        Workflow workflow = action.getWorkflow();
        if( workflow == null ) {
            return;
        }
        Node triggerNode = workflow.getTriggerNode();
        if(triggerNode == null) {
            return;
        }
        TriggerConfig triggerConfig = triggerNode.getTriggerConfig();
        if(triggerConfig == null) {
            return;
        }
        DeviceTrigger deviceTrigger = triggerConfig.getDeviceTrigger();
        if(deviceTrigger == null) {
            return;
        }
        String triggerDeviceId = deviceTrigger.getTriggerDeviceId();
        if(triggerDeviceId == null) {
            return;
        }
        Device device = devices.get(triggerDeviceId);
        if(device == null) {
            return;
        }
        addTriggers(deviceTrigger, action, device);
    }

    private void addTriggers(DeviceTrigger deviceTrigger, Action action, Device device){
        String triggerEvent = deviceTrigger.getTriggerEvent();
        if(triggerEvent == null) {
            return;
        }
        List<Object> triggerValues = deviceTrigger.getTriggerValues();
        if( triggerValues == null || triggerValues.isEmpty() ) {
            if(triggerEvent.contains(":")) {
                device.addListener(new DeviceListenerParams(action.getActionId(), triggerEvent), (Object data) -> { if(actionRunnables.containsKey(action.getActionId())) { actionRunnables.get(action.getActionId()).run(data); } else { logger.warn("Action {} nicht gefunden", action.getActionId()); } });
            } else {
                device.addListener(new DeviceListenerParams(action.getActionId(), triggerEvent), () -> { if(actionRunnables.containsKey(action.getActionId())) { actionRunnables.get(action.getActionId()).run(); } else { logger.warn("Action {} nicht gefunden", action.getActionId()); } });
            }
        }
        if( triggerValues != null && triggerValues.size() == 1 ) {
            if(triggerEvent.contains(":")) {
                device.addListener(new DeviceListenerParams(action.getActionId(), triggerEvent, triggerValues.get(0)), (Object data) -> { if(actionRunnables.containsKey(action.getActionId())) { actionRunnables.get(action.getActionId()).run(data); } else { logger.warn("Action {} nicht gefunden", action.getActionId()); } });
            } else {
                device.addListener(new DeviceListenerParams(action.getActionId(), triggerEvent, triggerValues.get(0)), () -> { if(actionRunnables.containsKey(action.getActionId())) { actionRunnables.get(action.getActionId()).run(); } else { logger.warn("Action {} nicht gefunden", action.getActionId()); } });
            }
        }
        if( triggerValues != null && triggerValues.size() == 2 ) {
            if(triggerEvent.contains(":")) {
                device.addListener(new DeviceListenerParams(action.getActionId(), triggerEvent, triggerValues.get(0), triggerValues.get(1)), (Object data) -> { if(actionRunnables.containsKey(action.getActionId())) { actionRunnables.get(action.getActionId()).run(data); } else { logger.warn("Action {} nicht gefunden", action.getActionId()); } });
            } else {
                device.addListener(new DeviceListenerParams(action.getActionId(), triggerEvent, triggerValues.get(0), triggerValues.get(1)), () -> { if(actionRunnables.containsKey(action.getActionId())) { actionRunnables.get(action.getActionId()).run(); } else { logger.warn("Action {} nicht gefunden", action.getActionId()); } });
            }
        }
    }

    private void addRunnableForActionsTime(Action action) {
        Workflow workflow = action.getWorkflow();
        if( workflow == null ) {
            return;
        }
        Node triggerNode = workflow.getTriggerNode();
        if(triggerNode == null) {
            return;
        }
        TriggerConfig triggerConfig = triggerNode.getTriggerConfig();
        if(triggerConfig == null) {
            return;
        }
        TimeTrigger timeTrigger = triggerConfig.getTimeTrigger();
        if(timeTrigger == null) {
            return;
        }
        String triggerFrequency = timeTrigger.getFrequency();
        if(triggerFrequency == null) {
            return;
        }

        // Erstelle TimeTriggerRunnable für alle Frequenzen
        TimeTriggerRunnable timeTriggerRunnable = new TimeTriggerRunnable(
            timeTrigger, 
            () -> { if(actionRunnables.containsKey(action.getActionId())) { actionRunnables.get(action.getActionId()).run(); } else { logger.warn("Action {} nicht gefunden", action.getActionId()); } }, 
            schedulerService
        );
        
        // Speichere die TimeTriggerRunnable-Instanz
        timeTriggerRunnables.put(action.getActionId(), timeTriggerRunnable);
        
        // Starte den TimeTriggerRunnable
        timeTriggerRunnable.start();
        
        logger.info("TimeTriggerRunnable für Action {} gestartet: frequency={}, time={}", 
            action.getActionId(), triggerFrequency, timeTrigger.getTime());
    }
    
    /**
     * Fügt eine neue Action hinzu.
     * Speichert die Action in der Datenbank, richtet den Workflow ein und aktiviert die Trigger.
     * 
     * @param action Die Action, die hinzugefügt werden soll
     * @return true wenn die Action erfolgreich hinzugefügt wurde, false sonst
     */
    public boolean addAction(Action action) {
        if (action == null || action.getActionId() == null || action.getActionId().isEmpty()) {
            logger.warn("Versuch, Action ohne gültige Action-ID hinzuzufügen");
            return false;
        }
        
        String actionId = action.getActionId();
        
        // Prüfe, ob Action bereits existiert
        if (actions.containsKey(actionId)) {
            return this.updateAction(action);
        }
        
        try {
            // Speichere Action in der Datenbank
            actionRepository.save(actionId, action);
            
            // Füge Action zur Map hinzu
            actions.put(actionId, action);
            
            // Erstelle ActionRunnable für den Workflow
            ActionRunnable workflowRunnable = action.getActionRunnable(devices, scenes, actionRunnables);
            actionRunnables.put(actionId, workflowRunnable);
            
            // Richte Trigger ein basierend auf triggerType
            setupTriggersForAction(action);
            
            logger.info("Action {} erfolgreich hinzugefügt: {}", actionId, action.getName());
            return true;
        } catch (Exception e) {
            logger.error("Fehler beim Hinzufügen der Action {}", actionId, e);
            // Rollback: Entferne aus Map, falls hinzugefügt
            actions.remove(actionId);
            actionRunnables.remove(actionId);
            return false;
        }
    }
    
    /**
     * Löscht eine Action.
     * Entfernt alle Trigger, löscht die Action aus der Map und aus der Datenbank.
     * 
     * @param actionId Die ID der Action, die gelöscht werden soll
     * @return true wenn die Action erfolgreich gelöscht wurde, false sonst
     */
    public boolean deleteAction(String actionId) {
        if (actionId == null || actionId.isEmpty()) {
            logger.warn("Versuch, Action mit ungültiger ID zu löschen");
            return false;
        }
        
        if (!actions.containsKey(actionId)) {
            logger.warn("Action {} nicht gefunden, kann nicht gelöscht werden", actionId);
            return false;
        }
        
        try {
            // Entferne alle Trigger für diese Action
            removeTriggersForAction(actionId);
            
            // Entferne aus Maps
            actions.remove(actionId);
            actionRunnables.remove(actionId);
            
            // Lösche aus der Datenbank
            actionRepository.deleteById(actionId);
            
            logger.info("Action {} erfolgreich gelöscht", actionId);
            return true;
        } catch (Exception e) {
            logger.error("Fehler beim Löschen der Action {}", actionId, e);
            return false;
        }
    }
    
    /**
     * Ändert eine bestehende Action.
     * Entfernt alte Trigger, aktualisiert die Action in der Datenbank und richtet neue Trigger ein.
     * 
     * @param oldAction Die alte Action (vor der Änderung)
     * @param newAction Die neue Action (nach der Änderung)
     * @return true wenn die Action erfolgreich geändert wurde, false sonst
     */
    public boolean updateAction(Action newAction) {

        if (newAction == null || newAction.getActionId() == null || newAction.getActionId().isEmpty()) {
            logger.warn("Versuch, Action ohne gültige neue Action-ID zu ändern");
            return false;
        }

        Action oldAction = this.actions.get(newAction.getActionId());
        // Validiere Parameter
        if (oldAction == null || oldAction.getActionId() == null || oldAction.getActionId().isEmpty()) {
            return addAction(newAction);
        }
        
        String oldActionId = oldAction.getActionId();
        String newActionId = newAction.getActionId();
        
        // Prüfe, ob die alte Action existiert
        if (!actions.containsKey(oldActionId)) {
            logger.warn("Action {} nicht gefunden, verwende addAction() zum Hinzufügen", oldActionId);
            return false;
        }
        
        try {
            if(deleteAction(oldActionId)){
                Boolean done = addAction(newAction);
                if(done){
                    logger.info("Action {} erfolgreich geändert: {} -> {}", oldActionId, oldAction.getName(), newAction.getName());
                    return true;
                } else {
                    logger.error("Fehler beim Hinzufügen der Action {}", newActionId);
                    return false;
                }
            } else {
                logger.error("Fehler beim Löschen der Action {}", oldActionId);
                return false;
            }

        } catch (Exception e) {
            logger.error("Fehler beim Ändern der Action {} zu {}", oldActionId, newActionId, e);
            return false;
        }
    }
    
    /**
     * Richtet Trigger für eine Action ein.
     * 
     * @param action Die Action, für die Trigger eingerichtet werden sollen
     */
    private void setupTriggersForAction(Action action) {
        String triggerType = action.getTriggerType();
        if (triggerType == null || triggerType.isEmpty()) {
            return;
        }
        
        switch (triggerType) {
            case "manual":
                addRunnablesForActionsManual(action);
                break;
            case "device":
                addRunnableForActionsDevice(action);
                break;
            case "time":
                addRunnableForActionsTime(action);
                break;
            default:
                logger.warn("Unbekannter Trigger-Typ '{}' für Action {}", triggerType, action.getActionId());
        }
    }
    
    /**
     * Entfernt alle Trigger für eine Action.
     * 
     * @param actionId Die ID der Action
     */
    private void removeTriggersForAction(String actionId) {
        Action action = actions.get(actionId);
        if (action == null) {
            return;
        }
        
        String triggerType = action.getTriggerType();
        if (triggerType == null) {
            return;
        }
        
        switch (triggerType) {
            case "device":
                removeDeviceTriggerForAction(action);
                break;
            case "time":
                removeTimeTriggerForAction(actionId);
                break;
            case "manual":
                removeSceneTriggerForAction(actionId);
                break;
        }
    }
    
    /**
     * Entfernt Device-Trigger für eine Action.
     * 
     * @param action Die Action, für die der Device-Trigger entfernt werden soll
     */
    private void removeDeviceTriggerForAction(Action action) {
        Workflow workflow = action.getWorkflow();
        if (workflow == null) {
            return;
        }
        
        Node triggerNode = workflow.getTriggerNode();
        if (triggerNode == null) {
            return;
        }
        
        TriggerConfig triggerConfig = triggerNode.getTriggerConfig();
        if (triggerConfig == null) {
            return;
        }
        
        DeviceTrigger deviceTrigger = triggerConfig.getDeviceTrigger();
        if (deviceTrigger == null) {
            return;
        }
        
        String triggerDeviceId = deviceTrigger.getTriggerDeviceId();
        if (triggerDeviceId == null) {
            return;
        }
        
        Device device = devices.get(triggerDeviceId);
        if (device == null) {
            return;
        }
        
        String triggerEvent = deviceTrigger.getTriggerEvent();
        if (triggerEvent == null) {
            return;
        }

        device.removeListener(action.getActionId(), triggerEvent);
    }
    
    /**
     * Entfernt Time-Trigger für eine Action.
     * 
     * @param actionId Die ID der Action
     */
    private void removeTimeTriggerForAction(String actionId) {
        TimeTriggerRunnable timeTriggerRunnable = timeTriggerRunnables.remove(actionId);
        if (timeTriggerRunnable != null) {
            try {
                timeTriggerRunnable.stop();
                logger.debug("Time-Trigger für Action {} entfernt", actionId);
            } catch (Exception e) {
                logger.error("Fehler beim Stoppen des TimeTriggerRunnables für Action {}", actionId, e);
            }
        }
    }
    
    /**
     * Schließt den ActionManager und gibt Ressourcen frei.
     * Stoppt alle TimeTriggerRunnables und den Scheduler-Service.
     */
    public void shutdown() {
        logger.info("Shutdown ActionManager...");
        
        // Stoppe alle TimeTriggerRunnables
        for (TimeTriggerRunnable timeTriggerRunnable : timeTriggerRunnables.values()) {
            try {
                timeTriggerRunnable.stop();
            } catch (Exception e) {
                logger.error("Fehler beim Stoppen eines TimeTriggerRunnables", e);
            }
        }
        timeTriggerRunnables.clear();
        
        // Schließe Scheduler-Service
        schedulerService.shutdown();
        try {
            if (!schedulerService.awaitTermination(5, TimeUnit.SECONDS)) {
                schedulerService.shutdownNow();
            }
        } catch (InterruptedException e) {
            schedulerService.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        logger.info("ActionManager heruntergefahren");
    }

    private void removeSceneTriggerForAction(String actionId) {
        for(Scene scene : scenes.values()) {
            scene.removeListener(actionId);
        }
    }

    public Optional<Action> getAction(String actionId) {
        return Optional.ofNullable(actions.get(actionId));
    }

    public List<Action> getActions() {
        return actions.values().stream().collect(Collectors.toList());
    }

    public List<Scene> getScenes() {
        return scenes.values().stream().collect(Collectors.toList());
    }

    public Optional<Scene> getScene(String sceneId) {
        return Optional.ofNullable(scenes.get(sceneId));
    }

    public boolean addScene(Scene scene) {
        if(scene == null || scene.getId() == null || scene.getId().isEmpty()) {
            logger.warn("Versuch, Szene mit ungültiger ID zu hinzufügen");
            return false;
        }
        addRunnablesForScene(scene);
        scenes.put(scene.getId(), scene);
        sceneRepository.save(scene.getId(), scene);
        return true;
    }

    public boolean saveScene(Scene scene) {
        if(scene == null || scene.getId() == null || scene.getId().isEmpty()) {
            logger.warn("Versuch, Szene mit ungültiger ID zu hinzufügen");
            return false;
        }
        scenes.put(scene.getId(), scene);
        sceneRepository.save(scene.getId(), scene);
        return true;
    }

    public boolean updateScene(Scene scene) {
        if(scene == null || scene.getId() == null || scene.getId().isEmpty()) {
            logger.warn("Versuch, Szene mit ungültiger ID zu aktualisieren");
            return false;
        }
        scene.removeAllListeners();
        addRunnablesForScene(scene);
        scenes.put(scene.getId(), scene);
        sceneRepository.save(scene.getId(), scene);
        return true;
    }   

    public boolean deleteScene(String sceneId) {
        if(sceneId == null || sceneId.isEmpty()) {
            logger.warn("Versuch, Szene mit ungültiger ID zu löschen");
            return false;
        }
        Scene scene = scenes.get(sceneId);
        if(scene == null) {
            logger.warn("Versuch, Szene mit ungültiger ID zu löschen");
            return false;
        }
        scene.removeAllListeners();
        scenes.remove(sceneId);
        sceneRepository.deleteById(sceneId);
        logger.info("Szene {} erfolgreich gelöscht", sceneId);
        return true;
    }

    public void removeRoomFromDevices(String roomId) {
        if(roomId == null || roomId.isEmpty()) {
            logger.warn("Versuch, Room mit ungültiger ID zu löschen");
            return;
        }
        for(Device device : devices.values()) {
            if(device.getRoom() != null && device.getRoom().equals(roomId)) {
                device.setRoom(null);
                deviceRepository.save(device.getId(), device);

            }
        }
    }

    public void removeDeviceForModule(String moduleId) {
        if(moduleId == null || moduleId.isEmpty()) {
            logger.warn("Versuch, Modul mit ungültiger ID zu löschen");
            return;
        }
        for(Device device : devices.values()) {
            if(device.getModuleId() != null && device.getModuleId().equals(moduleId)) {
                device.removeAllListeners();
            }
        }
    }

    public void addDevicesForModule(String moduleId) {
        if(moduleId == null || moduleId.isEmpty()) {
            logger.warn("Versuch, Modul mit ungültiger ID zu hinzufügen");
            return;
        }
        for(Action action : actions.values()) {
            Workflow workflow = action.getWorkflow();
            if (workflow == null) {
                continue;
            }
            
            Node triggerNode = workflow.getTriggerNode();
            if (triggerNode == null) {
                continue;
            }
            
            TriggerConfig triggerConfig = triggerNode.getTriggerConfig();
            if (triggerConfig == null) {
                continue;
            }
            
            DeviceTrigger deviceTrigger = triggerConfig.getDeviceTrigger();
            if (deviceTrigger == null) {
                continue;
            }
            
            String triggerDeviceId = deviceTrigger.getTriggerDeviceId();
            if (triggerDeviceId == null) {
                continue;
            }

            Device device = devices.get(triggerDeviceId);
            if (device == null) {
                continue;
            }

            if( device.getModuleId() != null && device.getModuleId().equals(moduleId) ) {
                addTriggers(deviceTrigger, action, device);
            }
        }
    }

    public boolean saveDevice(Device device) {
        if(device == null || device.getId() == null || device.getId().isEmpty()) {
            logger.warn("Versuch, Gerät mit ungültiger ID zu speichern");
            return false;
        }
        devices.put(device.getId(), device);
        deviceRepository.save(device.getId(), device);
        return true;
    }

    public boolean saveDevices(List<Device> devices) {
        for(Device device : devices) {
            if(!saveDevice(device)) {
                return false;
            }
        }
        return true;
    }

    public Optional<Device> getDevice(String deviceId) {
        return Optional.ofNullable(devices.get(deviceId));
    }

    public List<Device> getDevices() {
        return new ArrayList<>(devices.values());
    }
}

