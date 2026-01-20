package com.smarthome.backend.server.api.modules;

/**
 * Interface für EventStreamManager von Modulen.
 * Module können dieses Interface implementieren, um Eventstreams für ihre Geräte zu verwalten.
 * 
 * Der zentrale EventStreamManager verwaltet mehrere ModuleEventStreamManager-Instanzen
 * und hält sie am Laufen.
 */
public interface ModuleEventStreamManager {
    
    /**
     * Startet den EventStream für dieses Modul.
     * Diese Methode sollte alle notwendigen Eventstreams für die Geräte des Moduls starten.
     * 
     * @throws Exception wenn der EventStream nicht gestartet werden kann
     */
    void start() throws Exception;
    
    /**
     * Stoppt den EventStream für dieses Modul.
     * Diese Methode sollte alle laufenden Eventstreams für die Geräte des Moduls stoppen.
     * 
     * @throws Exception wenn der EventStream nicht gestoppt werden kann
     */
    void stop() throws Exception;
    
    /**
     * Gibt zurück, ob der EventStream aktuell läuft.
     * 
     * @return true wenn der EventStream läuft, false sonst
     */
    boolean isRunning();
    
    /**
     * Gibt die Modul-ID zurück, zu der dieser EventStreamManager gehört.
     * 
     * @return Die Modul-ID (z.B. "hue", "denon", "matter")
     */
    String getModuleId();
    
    /**
     * Gibt die Manager-ID zurück, die diesen EventStreamManager eindeutig identifiziert.
     * Diese ID kann verwendet werden, um mehrere EventStreamManager-Instanzen
     * für dasselbe Modul zu unterscheiden.
     * 
     * @return Die Manager-ID (z.B. "hue-bridge-1", "denon-speaker-2")
     */
    String getManagerId();
    
    /**
     * Gibt eine Beschreibung des EventStreamManagers zurück (für Logging/Debugging).
     * 
     * @return Eine Beschreibung des EventStreamManagers
     */
    String getDescription();
}

