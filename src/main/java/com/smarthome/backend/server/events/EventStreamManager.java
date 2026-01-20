package com.smarthome.backend.server.events;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.smarthome.backend.server.api.modules.ModuleEventStreamManager;

/**
 * Zentraler EventStreamManager, der mehrere ModuleEventStreamManager verwaltet.
 * 
 * Dieser Manager:
 * - Nimmt EventStreamManager von Modulen entgegen
 * - Verwaltet und hält sie am Laufen
 * - Startet alle registrierten EventStreamManager beim Start
 * - Stoppt alle EventStreamManager beim Shutdown
 * 
 * Die Klasse wird im NgrokServer beim Start initialisiert.
 */
public class EventStreamManager {
    private static final Logger logger = LoggerFactory.getLogger(EventStreamManager.class);
    
    /**
     * Map der registrierten ModuleEventStreamManager.
     * Key: Modul-ID, Value: ModuleEventStreamManager
     */
    private final Map<String, ModuleEventStreamManager> moduleEventStreamManagers = new ConcurrentHashMap<>();
    
    /**
     * Registriert einen ModuleEventStreamManager.
     * Wenn der EventStreamManager bereits gestartet wurde, wird der neue Manager sofort gestartet.
     * 
     * @param manager Der ModuleEventStreamManager, der registriert werden soll
     * @throws IllegalArgumentException wenn manager null ist oder bereits ein Manager für diese Modul-ID registriert ist
     */
    public void registerModuleEventStreamManager(List<ModuleEventStreamManager> managers) {
        if (managers == null) {
            throw new IllegalArgumentException("ModuleEventStreamManager darf nicht null sein");
        }
        for(ModuleEventStreamManager manager : managers) {
            registerModuleEventStreamManager(manager);
        }
    }

    /**
     * Registriert einen ModuleEventStreamManager.
     * Wenn der EventStreamManager bereits gestartet wurde, wird der neue Manager sofort gestartet.
     * 
     * @param manager Der ModuleEventStreamManager, der registriert werden soll
     * @throws IllegalArgumentException wenn manager null ist oder bereits ein Manager für diese Modul-ID registriert ist
     */
    public void registerModuleEventStreamManager(ModuleEventStreamManager manager) {
        if (manager == null) {
            throw new IllegalArgumentException("ModuleEventStreamManager darf nicht null sein");
        }
        
        String moduleId = manager.getModuleId();
        if (moduleId == null || moduleId.isEmpty()) {
            throw new IllegalArgumentException("Modul-ID darf nicht null oder leer sein");
        }

        String managerId = manager.getManagerId();
        if (managerId == null || managerId.isEmpty()) {
            throw new IllegalArgumentException("Manager-ID darf nicht null oder leer sein");
        }

        String eventStreamId = moduleId + "@" + managerId;
        
        // Prüfe, ob bereits ein Manager für diese Modul-ID registriert ist
        if (moduleEventStreamManagers.containsKey(eventStreamId)) {
            logger.warn("ModuleEventStreamManager für Modul '{}' und Manager '{}' ist bereits registriert. Überschreibe vorhandenen Manager.", moduleId, managerId);
            try {
                moduleEventStreamManagers.get(eventStreamId).stop();
            } catch (Exception e) {
                logger.error("Fehler beim Stoppen des ModuleEventStreamManager für Modul '{}' und Manager '{}'", moduleId, managerId, e);
            }
        }
        
        moduleEventStreamManagers.put(moduleId + "@" + managerId, manager);
        logger.info("ModuleEventStreamManager für Modul '{}' und Manager '{}' registriert: {}", moduleId, managerId, manager.getDescription());
        
        try {
            manager.start();
            logger.info("ModuleEventStreamManager für Modul '{}' und Manager '{}' gestartet", moduleId, managerId);
        } catch (Exception e) {
            logger.error("Fehler beim Starten des ModuleEventStreamManager für Modul '{}' und Manager '{}'", moduleId, managerId, e);
        }
    }
    
    /**
     * Entfernt einen ModuleEventStreamManager.
     * Stoppt den Manager, falls er läuft, bevor er entfernt wird.
     * 
     * @param moduleId Die Modul-ID des Managers, der entfernt werden soll
     * @return true wenn der Manager gefunden und entfernt wurde, false sonst
     */
    public boolean unregisterModuleEventStreamManager(String moduleId, String managerId) {
        if (moduleId == null || moduleId.isEmpty() || managerId == null || managerId.isEmpty()) {
            return false;
        }
        
        String eventStreamId = moduleId + "@" + managerId;
        ModuleEventStreamManager manager = moduleEventStreamManagers.remove(eventStreamId);
        if (manager != null) {
            // Stoppe den Manager, falls er läuft
            if (manager.isRunning()) {
                try {
                    manager.stop();
                    logger.info("ModuleEventStreamManager für Modul '{}' und Manager '{}' gestoppt", moduleId, managerId);
                } catch (Exception e) {
                    logger.error("Fehler beim Stoppen des ModuleEventStreamManager für Modul '{}' und Manager '{}'", moduleId, managerId, e);
                }
            }
            logger.info("ModuleEventStreamManager für Modul '{}' und Manager '{}' entfernt", moduleId, managerId);
            return true;
        }
        
        return false;
    }
    
   
    /**
     * Stoppt alle registrierten ModuleEventStreamManager.
     * 
     * @throws Exception wenn ein Fehler beim Stoppen auftritt
     */
    public void stop() throws Exception {
        logger.info("Stoppe EventStreamManager mit {} registrierten Modulen", moduleEventStreamManagers.size());
        
        List<String> failedEventStreams = new ArrayList<>();
        
        // Stoppe alle registrierten Manager
        for (Map.Entry<String, ModuleEventStreamManager> entry : moduleEventStreamManagers.entrySet()) {
            String eventStreamId = entry.getKey();
            String moduleId = eventStreamId.split("@")[0];
            String managerId = eventStreamId.split("@")[1];
            ModuleEventStreamManager manager = entry.getValue();
            
            if (manager.isRunning()) {
                try {
                    manager.stop();
                    logger.info("ModuleEventStreamManager für Modul '{}' und Manager '{}' gestoppt", moduleId, managerId);
                } catch (Exception e) {
                    logger.error("Fehler beim Stoppen des ModuleEventStreamManager für Modul '{}' und Manager '{}'", moduleId, managerId, e);
                    failedEventStreams.add(eventStreamId);
                }
            } else {
                logger.debug("ModuleEventStreamManager für Modul '{}' und Manager '{}' läuft nicht, überspringe", moduleId, managerId);
            }
        }
        
        if (!failedEventStreams.isEmpty()) {
            logger.warn("EventStreamManager gestoppt, aber {} EventStreams konnten nicht gestoppt werden: {}", 
                failedEventStreams.size(), failedEventStreams);
        } else {
            logger.info("EventStreamManager erfolgreich gestoppt. Alle {} EventStreams gestoppt.", moduleEventStreamManagers.size());
        }
    }
    
}

