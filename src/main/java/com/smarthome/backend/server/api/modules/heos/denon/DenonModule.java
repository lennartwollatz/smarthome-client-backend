package com.smarthome.backend.server.api.modules.heos.denon;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.model.devices.DeviceSpeaker;
import com.smarthome.backend.model.devices.helper.DeviceType;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.api.modules.Module;
import com.smarthome.backend.server.api.modules.heos.HeosController;
import com.smarthome.backend.server.api.modules.heos.HeosDiscoveredDevice;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;

/**
 * Modul für Denon HEOS-Speaker-Verwaltung.
 * Bietet Funktionen zur Geräte-Entdeckung, -Speicherung und -Steuerung.
 */
public class DenonModule {
    private static final Logger logger = LoggerFactory.getLogger(DenonModule.class);
    private static final Gson gson = new Gson();
    
    private final Repository<HeosDiscoveredDevice> discoveredDeviceRepository;
    private final Repository<Device> deviceRepository;
    private final DenonHeosSpeakerDiscover discover;
    private final HeosController heosController;
    private final Map<String, DenonSpeaker> speakers = new ConcurrentHashMap<>();
    
    public DenonModule(DatabaseManager databaseManager) {
        this.discoveredDeviceRepository = new JsonRepository<>(databaseManager, HeosDiscoveredDevice.class);
        this.deviceRepository = new JsonRepository<>(databaseManager, Device.class);
        this.discover = new DenonHeosSpeakerDiscover();
        this.heosController = new HeosController();
        
        // Lade gespeicherte Geräte aus der Datenbank beim Start
        loadDevicesFromDatabase();
    }
    
    /**
     * Lädt gespeicherte Geräte aus der Datenbank und initialisiert sie als HeosSpeaker.
     * Lädt sowohl aus discoveredDeviceRepository als auch aus deviceRepository.
     */
    private void loadDevicesFromDatabase() {
        logger.info("Lade gespeicherte Denon HEOS-Geräte aus der Datenbank");
        
        try {
            // Lade aus deviceRepository (Hauptquelle)
            List<Device> savedDevices = deviceRepository.findAll();
            
            for (Device device : savedDevices) {
                // Prüfe, ob es ein DeviceSpeaker ist und vom Denon-Modul stammt
                if (device.getType().equals(DeviceType.SPEAKER) && device.getModuleId().equals(Module.DENON.getModuleId())) {
                    try {
                        // Versuche, HeosDiscoveredDevice aus discoveredDeviceRepository zu laden
                        HeosDiscoveredDevice discoveredDevice = discoveredDeviceRepository.findById(device.getId()).orElse(null);
                        
                        if (discoveredDevice != null) {
                            // Erstelle DenonSpeaker aus HeosDiscoveredDevice und DeviceSpeaker
                            DenonSpeaker speaker = createDenonSpeakerFromDiscoveredDeviceAndSpeaker(discoveredDevice, device);
                            
                            // Speichere in der Liste
                            speakers.put(speaker.getId(), speaker);
                            
                            logger.info("Gerät {} aus Datenbank geladen: {} ({})", 
                                speaker.getId(), speaker.getName(), discoveredDevice.getAddress());
                        } 
                    } catch (Exception e) {
                        logger.error("Fehler beim Laden von Gerät {} aus Datenbank", device.getId(), e);
                    }
                }
            }
            
            logger.info("{} Geräte aus Datenbank geladen", speakers.size());
        } catch (Exception e) {
            logger.error("Fehler beim Laden der Geräte aus der Datenbank", e);
        }
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
     * Lädt alle gespeicherten HeosDiscoveredDevice aus der Datenbank (discoveredDeviceRepository).
     * 
     * @return Liste aller gespeicherten HeosDiscoveredDevice
     */
    private List<HeosDiscoveredDevice> loadDiscoveredDevicesFromRepository() {
        try {
            List<HeosDiscoveredDevice> discoveredDevices = discoveredDeviceRepository.findAll();
            logger.info("{} HeosDiscoveredDevice aus discoveredDeviceRepository geladen", discoveredDevices.size());
            
            // Logge Details für jedes geladene Gerät
            for (HeosDiscoveredDevice device : discoveredDevices) {
                logger.debug("HeosDiscoveredDevice geladen: {} (udn={}, pid={}, name={})", 
                    device.getFriendlyName(), device.getUdn(), device.getPid(), device.getName());
            }
            
            return discoveredDevices;
        } catch (Exception e) {
            logger.error("Fehler beim Laden der HeosDiscoveredDevice aus discoveredDeviceRepository", e);
            return new ArrayList<>();
        }
    }

    /**
     * Erstellt einen HeosSpeaker aus einem HeosDiscoveredDevice.
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
     * Erstellt einen HeosSpeaker aus einem HeosDiscoveredDevice.
     */
    private DenonSpeaker createDenonSpeakerFromDiscoveredDeviceAndSpeaker(HeosDiscoveredDevice device, Device speaker) {
        return new DenonSpeaker(speaker, device, heosController);
    }
    
    /**
     * Konvertiert eine Liste von HeosDiscoveredDevice zu DeviceSpeaker.
     * Speichert die Geräte in beiden Repositories und gibt die konvertierten DeviceSpeaker zurück.
     * 
     * @param discoveredDevices Die Liste der entdeckten Geräte
     * @return Liste der konvertierten DeviceSpeaker
     */
    private List<DenonSpeaker> convertDiscoveredDevicesToDenonSpeakers(List<HeosDiscoveredDevice> discoveredDevices) {
        List<DenonSpeaker> denonSpeakers = new ArrayList<>();
        
        for (HeosDiscoveredDevice device : discoveredDevices) {
            try {
                // Speichere oder aktualisiere in discoveredDeviceRepository (für interne Zwecke)
                String deviceId = device.getUdn();
                discoveredDeviceRepository.save(deviceId, device);
                
                // Erstelle HeosSpeaker
                DenonSpeaker speaker = createDenonSpeakerFromDiscoveredDevice(device);
                
                // Speichere als Device im deviceRepository (für DeviceService)
                saveDeviceToRepository(speaker);
                
                // Speichere in der Liste (überschreibt falls vorhanden)
                speakers.put(speaker.getId(), speaker);
                
                // Füge zur Rückgabeliste hinzu
                denonSpeakers.add(speaker);
                
                logger.debug("Gerät {} gespeichert und initialisiert: {} ({})", 
                    deviceId, speaker.getName(), device.getAddress());
            } catch (Exception e) {
                logger.error("Fehler beim Speichern/Initialisieren von Gerät {}", device.getUdn(), e);
            }
        }
        
        logger.info("{} Geräte zu DeviceSpeaker konvertiert", denonSpeakers.size());
        return denonSpeakers;
    }
    
    /**
     * Speichert ein Device im deviceRepository.
     * Aktualisiert vorhandene Geräte oder erstellt neue.
     * Speichert zusätzliche Informationen (Adresse, PID) in den properties für spätere Verwendung.
     */
    private void saveDeviceToRepository(DenonSpeaker device) {
        try {            
            deviceRepository.save(device.getId(), device);
            logger.debug("Gerät {} im deviceRepository gespeichert", device.getId());
        } catch (Exception e) {
            logger.error("Fehler beim Speichern von Gerät {} im deviceRepository", device.getId(), e);
        }
    }
    
    /**
     * Sucht nach verfügbaren Denon HEOS-Geräten.
     * Gefundene Geräte werden in der Datenbank gespeichert und als HeosSpeaker zurückgegeben.
     * 
     * @param exchange HTTP-Exchange für die Antwort
     * @throws IOException bei Fehlern beim Senden der Antwort
     */
    public void discoverDevices(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Suche nach Denon HEOS-Geräten");
        
        try {
            // Führe Discovery durch (30 Sekunden)
            long searchDurationMs = 30000;
            List<HeosDiscoveredDevice> discoveredDevices = discover.discoverDevicesWithPlayerIds(searchDurationMs);
            
            logger.info("{} Geräte gefunden", discoveredDevices.size());
            
            // Speichere alle discoveredDevices mit Player-IDs in die separate Datenbanktabelle
            saveDiscoveredDevicesToRepository(discoveredDevices);
            
            // Konvertiere alle HeosDiscoveredDevice zu DeviceSpeaker
            List<DenonSpeaker> denonSpeakers = convertDiscoveredDevicesToDenonSpeakers(discoveredDevices);

            for (DenonSpeaker speaker : denonSpeakers) {
                saveDeviceToRepository(speaker);
                speakers.put(speaker.getId(), speaker);
            }
            
            // Sende Antwort
            String response = gson.toJson(denonSpeakers);
            ApiRouter.sendResponse(exchange, 200, response);
            
        } catch (Exception e) {
            logger.error("Fehler bei der Geräteerkennung", e);
            ApiRouter.sendResponse(exchange, 500, 
                gson.toJson(Map.of("error", "Fehler bei der Geräteerkennung: " + e.getMessage())));
        }
    }
    
    /**
     * Setzt die Lautstärke eines Geräts.
     * 
     * @param deviceId Die ID des Geräts
     * @param volume Die Lautstärke (0-100)
     * @return true wenn erfolgreich
     */
    public boolean setVolume(String deviceId, int volume) {
        logger.info("Setze Lautstärke für Gerät {} auf {}", deviceId, volume);
        
        DenonSpeaker speaker = speakers.get(deviceId);
        if (speaker == null) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            // Verwende die setVolume-Methode von DeviceSpeaker, die dann executeSetVolume aufruft
            // executeSetVolume ruft heosController.setVolume(this) auf
            speaker.setVolume(volume);
            saveDeviceToRepository(speaker);
            return true;
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Lautstärke für Gerät {}", deviceId, e);
            return false;
        }
    }
    
    /**
     * Setzt den Wiedergabestatus eines Geräts.
     * 
     * @param deviceId Die ID des Geräts
     * @param state Der Wiedergabestatus ("play", "pause" oder "stop")
     * @return true wenn erfolgreich
     */
    public boolean setPlayState(String deviceId, String state) {
        logger.info("Setze Wiedergabestatus für Gerät {} auf {}", deviceId, state);
        
        DenonSpeaker speaker = speakers.get(deviceId);
        if (speaker == null) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            switch (DeviceSpeaker.PlayState.fromString(state)) {
                case PLAY:
                    speaker.play();
                    break;
                case STOP:
                    speaker.stopp();
                    break;
                case PAUSE:
                    speaker.pause();
                    break;
            }
            saveDeviceToRepository(speaker);
            return true;
        } catch (Exception e) {
            logger.error("Fehler beim Setzen des Wiedergabestatus für Gerät {}", deviceId, e);
            return false;
        }
    }
    
    /**
     * Setzt die Stummschaltung eines Geräts.
     * 
     * @param deviceId Die ID des Geräts
     * @param mute true für stumm, false für nicht stumm
     * @return true wenn erfolgreich
     */
    public boolean setMute(String deviceId, boolean mute) {
        logger.info("Setze Stummschaltung für Gerät {} auf {}", deviceId, mute);
        
        DenonSpeaker speaker = speakers.get(deviceId);
        if (speaker == null) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            speaker.setMute(mute);
            saveDeviceToRepository(speaker);
            return true;
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Stummschaltung für Gerät {}", deviceId, e);
            return false;
        }
    }
    
    /**
     * Spielt den nächsten Titel auf einem Gerät ab.
     * 
     * @param deviceId Die ID des Geräts
     * @return true wenn erfolgreich
     */
    public boolean playNext(String deviceId) {
        logger.info("Spiele nächsten Titel auf Gerät {} ab", deviceId);
        
        DenonSpeaker speaker = speakers.get(deviceId);
        if (speaker == null) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            speaker.playNext();
            return true;
        } catch (Exception e) {
            logger.error("Fehler beim Abspielen des nächsten Titels für Gerät {}", deviceId, e);
            return false;
        }
    }
    
    /**
     * Spielt den vorherigen Titel auf einem Gerät ab.
     * 
     * @param deviceId Die ID des Geräts
     * @return true wenn erfolgreich
     */
    public boolean playPrevious(String deviceId) {
        logger.info("Spiele vorherigen Titel auf Gerät {} ab", deviceId);
        
        DenonSpeaker speaker = speakers.get(deviceId);
        if (speaker == null) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            speaker.playPrevious(); 
            return true;
        } catch (Exception e) {
            logger.error("Fehler beim Abspielen des vorherigen Titels für Gerät {}", deviceId, e);
            return false;
        }
    }
    
    /**
     * Spielt ein Lied/URL auf einem Gerät ab.
     * 
     * @param deviceId Die ID des Geräts
     * @param url Die URL des Liedes/Streams
     * @return true wenn erfolgreich
     */
    public boolean playSong(String deviceId, String url) {
        logger.info("Spiele Lied auf Gerät {} ab: {}", deviceId, url);
        
        DenonSpeaker speaker = speakers.get(deviceId);
        if (speaker == null) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            //speaker.playSong(url);
            return true;
        } catch (Exception e) {
            logger.error("Fehler beim Abspielen des Liedes für Gerät {}", deviceId, e);
            return false;
        }
    }
}

