package com.smarthome.backend.server.api.modules.heos.denon;

import com.smarthome.backend.server.api.modules.Module;
import com.smarthome.backend.server.api.modules.heos.HeosController;
import com.smarthome.backend.server.api.modules.heos.HeosSpeaker;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.server.api.modules.heos.HeosDiscoveredDevice;

/**
 * Repräsentiert einen Denon HEOS-Speaker als Gerät.
 * Erweitert HeosSpeaker und setzt explizit den Modulnamen auf HEOS.
 */
public class DenonSpeaker extends HeosSpeaker {
    
    /**
     * Standardkonstruktor für Gson-Deserialisierung.
     * Wird verwendet, wenn Geräte aus der Datenbank geladen werden.
     */
    public DenonSpeaker() {
        super();
        // Setze explizit den Modulnamen auf HEOS
        super.setModuleId(Module.DENON.getModuleId());
    }
    
    /**
     * Erstellt einen neuen DenonSpeaker.
     * 
     * @param name Der Name des Speakers
     * @param id Die eindeutige ID des Speakers
     * @param address Die IP-Adresse des HEOS-Geräts
     * @param pid Die Player-ID
     * @param heos Die HeosController-Instanz für die Kommunikation
     */
    public DenonSpeaker(String name, String id, String address, int pid, HeosController heos) {
        super(name, id, address, pid, heos);
        // Setze explizit den Modulnamen auf HEOS
        super.setModuleId(Module.DENON.getModuleId());
    }

    public DenonSpeaker(Device device, HeosDiscoveredDevice discoveredDevice, HeosController heos) {
        super(device.getName(), discoveredDevice.getUdn(), discoveredDevice.getAddress(), discoveredDevice.getPid(), heos);
        setRoom(device.getRoom());
        setIcon(device.getIcon());
        // Setze explizit den Modulnamen auf HEOS
        super.setModuleId(Module.DENON.getModuleId());
    }
}

