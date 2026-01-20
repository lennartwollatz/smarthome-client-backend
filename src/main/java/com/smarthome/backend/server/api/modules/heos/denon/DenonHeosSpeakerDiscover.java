package com.smarthome.backend.server.api.modules.heos.denon;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.server.api.modules.heos.HeosController;
import com.smarthome.backend.server.api.modules.heos.HeosDiscover;
import com.smarthome.backend.server.api.modules.heos.HeosDiscoveredDevice;
import com.smarthome.backend.server.db.Repository;

/**
 * mDNS-basierte Geräteerkennung für Denon HEOS-Geräte.
 * Diese Klasse erweitert HeosDiscover und setzt den Denon-spezifischen mDNS-Service-Typ.
 * Konvertiert entdeckte Geräte direkt zu DenonSpeaker-Instanzen.
 */
public class DenonHeosSpeakerDiscover extends HeosDiscover {
    private static final Logger logger = LoggerFactory.getLogger(DenonHeosSpeakerDiscover.class);
    
    private final Repository<HeosDiscoveredDevice> discoveredDeviceRepository;
    private final HeosController heosController;
    
    /**
     * Konstruktor.
     * 
     * @param discoveredDeviceRepository Repository für HeosDiscoveredDevice
     * @param heosController Controller für HEOS-Kommunikation
     * @param actionManager ActionManager für Device-Speicherung
     */
    public DenonHeosSpeakerDiscover(Repository<HeosDiscoveredDevice> discoveredDeviceRepository, 
                                     HeosController heosController) {
        super("Denon");
        this.discoveredDeviceRepository = discoveredDeviceRepository;
        this.heosController = heosController;
    }
    
    /**
     * Startet einen Discovery-Suchlauf über mDNS, ermittelt die PID-IDs der gefundenen Geräte
     * und gibt die konvertierten DenonSpeaker zurück.
     * 
     * @param searchDurationMs Die Dauer der Suche in Millisekunden
     * @return Liste von DenonSpeaker mit vollständigen Informationen
     */
    public List<Device> discoverDenonSpeakers(long searchDurationMs) {
        // Rufe die Basis-Methode auf, um HeosDiscoveredDevice-Liste zu erhalten
        List<HeosDiscoveredDevice> discoveredDevices = super.discoverDevicesWithPlayerIds(searchDurationMs);
        
        // Speichere alle discoveredDevices mit Player-IDs in die separate Datenbanktabelle
        saveDiscoveredDevicesToRepository(discoveredDevices);
        
        // Konvertiere alle HeosDiscoveredDevice zu DenonSpeaker
        return convertDiscoveredDevicesToDenonSpeakers(discoveredDevices).stream().map(Device.class::cast).collect(Collectors.toList());
    }
    
    /**
     * Speichert alle HeosDiscoveredDevice mit Player-IDs in die separate Datenbanktabelle (discoveredDeviceRepository).
     * 
     * @param discoveredDevices Die Liste der entdeckten Geräte mit Player-IDs
     * @return Anzahl der erfolgreich gespeicherten Geräte
     */
    private int saveDiscoveredDevicesToRepository(List<HeosDiscoveredDevice> discoveredDevices) {
        int savedCount = 0;
        
        for (HeosDiscoveredDevice device : discoveredDevices) {
            try {
                String deviceId = device.getUdn();
                discoveredDeviceRepository.save(deviceId, device);
                savedCount++;
                logger.debug("HeosDiscoveredDevice {} in discoveredDeviceRepository gespeichert: {} (pid={})", 
                    deviceId, device.getFriendlyName(), device.getPid());
            } catch (Exception e) {
                logger.error("Fehler beim Speichern von HeosDiscoveredDevice {} in discoveredDeviceRepository", 
                    device.getUdn(), e);
            }
        }
        
        logger.info("{} von {} HeosDiscoveredDevice in discoveredDeviceRepository gespeichert", 
            savedCount, discoveredDevices.size());
        return savedCount;
    }

    /**
     * Erstellt einen DenonSpeaker aus einem HeosDiscoveredDevice.
     */
    private DenonSpeaker createDenonSpeakerFromDiscoveredDevice(HeosDiscoveredDevice device) {
        // Verwende UDN als eindeutige ID
        String deviceId = device.getUdn();
        
        // Verwende friendlyName als Name, falls vorhanden, sonst name
        String speakerName = device.getName() != null && !device.getName().isEmpty() 
            ? device.getName() 
            : (device.getFriendlyName() != null ? device.getFriendlyName() : "Denon Speaker");
        
        // Verwende die beste verfügbare Adresse (IPv4 bevorzugt, IPv6 als Fallback, eckige Klammern entfernt)
        String address = device.getBestConnectionAddress();
        if (address == null || address.isEmpty()) {
            logger.warn("Keine gültige Adresse für Gerät {} gefunden, verwende Fallback", deviceId);
            address = device.getAddress() != null ? device.getAddress() : "unknown";
        }
        
        // Erstelle DenonSpeaker (konkrete Implementierung)
        return new DenonSpeaker(speakerName, deviceId, address, device.getPid(), heosController);
    }

    /**
     * Konvertiert eine Liste von HeosDiscoveredDevice zu DenonSpeaker.
     * Speichert die Geräte in beiden Repositories und gibt die konvertierten DenonSpeaker zurück.
     * 
     * @param discoveredDevices Die Liste der entdeckten Geräte
     * @return Liste der konvertierten DenonSpeaker
     */
    private List<DenonSpeaker> convertDiscoveredDevicesToDenonSpeakers(List<HeosDiscoveredDevice> discoveredDevices) {
        List<DenonSpeaker> denonSpeakers = new ArrayList<>();
        
        for (HeosDiscoveredDevice device : discoveredDevices) {
            try {
                // Speichere oder aktualisiere in discoveredDeviceRepository (für interne Zwecke)
                String deviceId = device.getUdn();
                discoveredDeviceRepository.save(deviceId, device);
                
                // Erstelle DenonSpeaker
                DenonSpeaker speaker = createDenonSpeakerFromDiscoveredDevice(device);
                
                
                // Füge zur Rückgabeliste hinzu
                denonSpeakers.add(speaker);
                
                logger.debug("Gerät {} gespeichert und initialisiert: {} ({})", 
                    deviceId, speaker.getName(), device.getAddress());
            } catch (Exception e) {
                logger.error("Fehler beim Speichern/Initialisieren von Gerät {}", device.getUdn(), e);
            }
        }
        
        logger.info("{} Geräte zu DenonSpeaker konvertiert", denonSpeakers.size());
        return denonSpeakers;
    }
}

