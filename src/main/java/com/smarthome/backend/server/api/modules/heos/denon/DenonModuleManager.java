package com.smarthome.backend.server.api.modules.heos.denon;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.model.devices.DeviceSpeaker;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.api.modules.ModuleManager;
import com.smarthome.backend.server.api.modules.heos.HeosController;
import com.smarthome.backend.server.api.modules.heos.HeosDiscoveredDevice;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;
import com.smarthome.backend.server.events.EventStreamManager;

/**
 * Modul-Manager für Denon HEOS-Speaker-Verwaltung.
 * Bietet Funktionen zur Geräte-Entdeckung, -Speicherung und -Steuerung.
 */
public class DenonModuleManager extends ModuleManager {
    private static final Logger logger = LoggerFactory.getLogger(DenonModuleManager.class);
    private static final Gson gson = new Gson();
    
    
    private final Repository<HeosDiscoveredDevice> discoveredDeviceRepository;
    private final DenonHeosSpeakerDiscover discover;
    private final HeosController heosController;

    public DenonModuleManager(DatabaseManager databaseManager, EventStreamManager eventStreamManager, ActionManager actionManager) {
        super(databaseManager, eventStreamManager, actionManager);
        this.discoveredDeviceRepository = new JsonRepository<>(databaseManager, HeosDiscoveredDevice.class);
        this.heosController = new HeosController();
        this.discover = new DenonHeosSpeakerDiscover(discoveredDeviceRepository, heosController);
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
            List<Device> denonSpeakers = discover.discoverDenonSpeakers(searchDurationMs);

            logger.info("{} Geräte gefunden", denonSpeakers.size());

            Boolean success = actionManager.saveDevices(denonSpeakers);
            if (!success) {
                logger.error("Fehler beim Speichern der Geräte");
                ApiRouter.sendResponse(exchange, 500, gson.toJson(Map.of("error", "Fehler beim Speichern der Geräte")));
                return;
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
        
        Optional<Device> speaker = actionManager.getDevice(deviceId);
        if (speaker.isEmpty() || !(speaker.get() instanceof DeviceSpeaker)) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            ((DeviceSpeaker) speaker.get()).setVolume(volume, true);
            actionManager.saveDevice(speaker.get());
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
        
        Optional<Device> speaker = actionManager.getDevice(deviceId);
        if (speaker.isEmpty() || !(speaker.get() instanceof DeviceSpeaker)) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            switch (DeviceSpeaker.PlayState.fromString(state)) {
                case PLAY:
                    ((DeviceSpeaker) speaker.get()).play(true);
                    break;
                case STOP:
                    ((DeviceSpeaker) speaker.get()).stopp(true);
                    break;
                case PAUSE:
                    ((DeviceSpeaker) speaker.get()).pause(true);
                    break;
            }
            actionManager.saveDevice(speaker.get());
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
        
        Optional<Device> speaker = actionManager.getDevice(deviceId);
        if (speaker.isEmpty() || !(speaker.get() instanceof DeviceSpeaker)) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            ((DeviceSpeaker) speaker.get()).setMute(mute, true);
            actionManager.saveDevice(speaker.get());
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
        
        Optional<Device> speaker = actionManager.getDevice(deviceId);
        if (speaker.isEmpty() || !(speaker.get() instanceof DeviceSpeaker)) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            ((DeviceSpeaker) speaker.get()).playNext();
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
        
        Optional<Device> speaker = actionManager.getDevice(deviceId);
        if (speaker.isEmpty() || !(speaker.get() instanceof DeviceSpeaker)) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }

        try {
            ((DeviceSpeaker) speaker.get()).playPrevious(); 
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
        
        Optional<Device> speaker = actionManager.getDevice(deviceId);
        if (speaker.isEmpty() || !(speaker.get() instanceof DeviceSpeaker)) {
            logger.warn("Gerät {} nicht gefunden", deviceId);
            return false;
        }
        
        try {
            //((DeviceSpeaker) speaker.get()).playSong(url);
            return true;
        } catch (Exception e) {
            logger.error("Fehler beim Abspielen des Liedes für Gerät {}", deviceId, e);
            return false;
        }
    }
}

