package com.smarthome.backend.server.api.modules.hue;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.model.devices.DeviceLight;
import com.smarthome.backend.model.devices.DeviceLightDimmer;
import com.smarthome.backend.model.devices.DeviceLightDimmerTemperature;
import com.smarthome.backend.model.devices.DeviceLightDimmerTemperatureColor;
import com.smarthome.backend.model.devices.DeviceMotion;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.api.modules.ModuleManager;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.events.EventStreamManager;

/**
 * Modul-Manager für Hue Bridge-Verwaltung.
 * Bietet Funktionen zur Bridge-Entdeckung und -Verwaltung.
 */
public class HueModuleManager extends ModuleManager {
    private static final Logger logger = LoggerFactory.getLogger(HueModuleManager.class);
    private static final Gson gson = new Gson();
    
    private final HueDiscover hueDiscover;
    private final HueBridgeController hueBridgeController;
    private final HueDeviceController hueDeviceController;
    
    public HueModuleManager(DatabaseManager databaseManager, EventStreamManager eventStreamManager, ActionManager actionManager) {
        super(databaseManager, eventStreamManager, actionManager);
        this.hueDiscover = new HueDiscover(databaseManager);
        this.hueBridgeController = new HueBridgeController(databaseManager);
        this.hueDeviceController = new HueDeviceController(databaseManager);
        this.setHueDeviceController();
        eventStreamManager.registerModuleEventStreamManager(hueBridgeController.createEventStreamManager(actionManager));
    }

    public void setHueDeviceController() {
        List<Device> devices = actionManager.getDevices();
        for(Device device : devices) {
            this.setHueDeviceControllerForDevice(device);
        }
    }

    public void setHueDeviceControllerForDevice(Device device) {
        if (device instanceof HueLight) {
            ((HueLight) device).setHueDeviceController(hueDeviceController);
        } else if (device instanceof HueLightDimmer) {
            ((HueLightDimmer) device).setHueDeviceController(hueDeviceController);
        } else if (device instanceof HueLightDimmerTemperatureColor) {
            ((HueLightDimmerTemperatureColor) device).setHueDeviceController(hueDeviceController);
        } else if (device instanceof HueLightDimmerTemperature) {
            ((HueLightDimmerTemperature) device).setHueDeviceController(hueDeviceController);
        } else if (device instanceof HueLightLevelSensor) {
            ((HueLightLevelSensor) device).setHueDeviceController(hueDeviceController);
        } else if (device instanceof HueTemperatureSensor) {
            ((HueTemperatureSensor) device).setHueDeviceController(hueDeviceController);
        } else if (device instanceof HueMotionSensor) {
            ((HueMotionSensor) device).setHueDeviceController(hueDeviceController);
        }
    }
    
    /**
     * Sucht nach verfügbaren Hue Bridges im Netzwerk.
     * Gefundene Bridges werden zurückgegeben.
     * 
     * @param exchange HTTP-Exchange für die Antwort
     * @throws IOException bei Fehlern beim Senden der Antwort
     */
    public void discoverBridges(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Suche nach Hue Bridges");
        
        try {
            // Führe Discovery durch (5 Sekunden)
            long searchDurationMs = 5000;
            List<HueDiscoveredBridge> bridges = hueDiscover.discoverBridges(searchDurationMs);
            
            logger.info("{} Bridges gefunden", bridges.size());
            
            // Entferne sensible Daten (username, clientKey) vor der Serialisierung
            List<HueDiscoveredBridge> bridgesForApi = new java.util.ArrayList<>();
            for (HueDiscoveredBridge bridge : bridges) {
                bridgesForApi.add(bridge.withoutSensitiveData());
            }
            
            // Sende Antwort
            String response = gson.toJson(bridgesForApi);
            ApiRouter.sendResponse(exchange, 200, response);
            
        } catch (Exception e) {
            logger.error("Fehler bei der Bridge-Erkennung", e);
            ApiRouter.sendResponse(exchange, 500, 
                gson.toJson(Map.of("error", "Fehler bei der Bridge-Erkennung: " + e.getMessage())));
        }
    }
    
    /**
     * Führt das Pairing mit einer Hue Bridge durch.
     * Delegiert den Aufruf an HueBridgeController und registriert den Event-Stream-Manager nach erfolgreichem Pairing.
     * 
     * @param exchange HTTP-Exchange für die Antwort
     * @param bridgeId Die deviceId der Bridge (aus dem Discovery-Suchlauf)
     * @throws IOException bei Fehlern beim Senden der Antwort
     */
    public void pairBridge(com.sun.net.httpserver.HttpExchange exchange, String bridgeId) throws IOException {
        hueBridgeController.pairBridge(exchange, bridgeId, () -> {
            // Callback nach erfolgreichem Pairing: Registriere Event-Stream-Manager
            try {
                HueModuleEventStreamManager moduleEventStreamManager = 
                    new HueModuleEventStreamManager(bridgeId, actionManager, databaseManager);
                eventStreamManager.registerModuleEventStreamManager(moduleEventStreamManager);
                logger.info("EventStreamManager für Bridge {} registriert", bridgeId);
            } catch (Exception e) {
                logger.error("Fehler beim Registrieren des EventStreamManagers für Bridge {}", bridgeId, e);
            }
        });
    }
    
    /**
     * Sucht alle Geräte einer gepaarten Hue Bridge.
     * Delegiert den Aufruf an HueDiscover.
     * 
     * @param exchange HTTP-Exchange für die Antwort
     * @param bridgeId Die deviceId der Bridge (aus dem Discovery-Suchlauf)
     * @throws IOException bei Fehlern beim Senden der Antwort
     */
    public void discoverDevices(com.sun.net.httpserver.HttpExchange exchange, String bridgeId) throws IOException {
        logger.info("Suche nach Geräten für Bridge: {}", bridgeId);
        
        try {
            List<Device> devices = hueDiscover.discoverDevices(bridgeId);
            
            if (devices != null && !devices.isEmpty()) {
                String response = gson.toJson(devices);
                ApiRouter.sendResponse(exchange, 200, response);
            } else {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(new java.util.ArrayList<>()));
            }
            
        } catch (Exception e) {
            logger.error("Fehler bei der Geräte-Suche für Bridge {}", bridgeId, e);
            ApiRouter.sendResponse(exchange, 500, 
                gson.toJson(Map.of("error", "Fehler bei der Geräte-Suche: " + e.getMessage())));
        }
    }
    
    /**
     * Setzt die Sensitivity eines Hue Motion Sensors.
     * 
     * @param deviceId Die ID des Motion Sensors
     * @param sensitivity Die neue Sensitivity (0-100)
     * @return true wenn erfolgreich, false sonst
     */
    public boolean setSensitivity(String deviceId, int sensitivity) {
        logger.info("Setze Sensitivity für Hue Motion Sensor: {} auf {}", deviceId, sensitivity);
        
        // Validiere Sensitivity-Wert (0-100)
        if (sensitivity < 0 || sensitivity > 100) {
            return false;
        }
        
        // Lade Device aus der Datenbank
        Optional<Device> device = actionManager.getDevice(deviceId);
        
        if (device.isEmpty() || !(device.get() instanceof DeviceMotion)) {
            return false;
        }

        try{
            ((DeviceMotion) device.get()).setSensibility(sensitivity, true);
            return actionManager.saveDevice(device.get());
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Sensitivity für Hue Motion Sensor {}", deviceId, e);
            return false;
        }
    }
    
    /**
     * Schaltet ein Hue Light ein.
     * 
     * @param deviceId Die ID des Light Devices
     * @return true wenn erfolgreich, false sonst
     */
    public boolean setOn(String deviceId) {
        logger.info("Schalte Hue Light ein: {}", deviceId);
        
        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof DeviceLight)) {
            return false;
        }

        try {
            ((DeviceLight) deviceOpt.get()).setOn(true);
            return actionManager.saveDevice(deviceOpt.get());
        } catch (Exception e) {
            logger.error("Fehler beim Einschalten des Hue Light {}", deviceId, e);
            return false;
        }
    }
    
    /**
     * Schaltet ein Hue Light aus.
     * 
     * @param deviceId Die ID des Light Devices
     * @return true wenn erfolgreich, false sonst
     */
    public boolean setOff(String deviceId) {
        logger.info("Schalte Hue Light aus: {}", deviceId);
        
        Optional<Device> device = actionManager.getDevice(deviceId);
        
        if (device.isEmpty() || !(device.get() instanceof DeviceLight)) {
            return false;
        }

        try {
            // Verwende die Basis-Methode, die für alle Hue Light Typen funktioniert
            ((DeviceLight) device.get()).setOff(true);
            return actionManager.saveDevice(device.get());
        } catch (Exception e) {
            logger.error("Fehler beim Ausschalten des Hue Light {}", deviceId, e);
            return false;
        }
    }
    
    /**
     * Setzt die Helligkeit eines Hue Light.
     * 
     * @param deviceId Die ID des Light Devices
     * @param brightness Die neue Helligkeit (0-100)
     * @return true wenn erfolgreich, false sonst
     */
    public boolean setBrightness(String deviceId, int brightness) {
        logger.info("Setze Helligkeit für Hue Light: {} auf {}", deviceId, brightness);
        
        // Validiere Brightness-Wert (0-100)
        if (brightness < 0 || brightness > 100) {
            return false;
        }
        
        Optional<Device> device = actionManager.getDevice(deviceId);
        
        if (device.isEmpty() || !(device.get() instanceof DeviceLightDimmer)) {
            return false;
        }

        try {
            // Verwende die Basis-Methode, die für HueLightDimmer, HueLightDimmerTemperature
            // und HueLightDimmerTemperatureColor funktioniert
            ((DeviceLightDimmer) device.get()).setBrightness(brightness, true);
            return actionManager.saveDevice(device.get());
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Helligkeit für Hue Light {}", deviceId, e);
            return false;
        }
    }
    
    /**
     * Setzt die Farbtemperatur eines Hue Light.
     * 
     * @param deviceId Die ID des Light Devices
     * @param temperature Die neue Farbtemperatur (in mirek)
     * @return true wenn erfolgreich, false sonst
     */
    public boolean setTemperature(String deviceId, int temperature) {
        logger.info("Setze Farbtemperatur für Hue Light: {} auf {}", deviceId, temperature);
        
        Optional<Device> device = actionManager.getDevice(deviceId);
        
        if (device.isEmpty() || !(device.get() instanceof DeviceLightDimmerTemperature)) {
            return false;
        }

        try {
            // Verwende die Basis-Methode, die sowohl für HueLightDimmerTemperature 
            // als auch für HueLightDimmerTemperatureColor funktioniert
            ((DeviceLightDimmerTemperature) device.get()).setTemperature(temperature, true);
            return actionManager.saveDevice(device.get());
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Farbtemperatur für Hue Light {}", deviceId, e);
            return false;
        }
    }
    
    /**
     * Setzt die Farbe eines Hue Light.
     * 
     * @param deviceId Die ID des Light Devices
     * @param x Die x-Komponente der Farbe (0.0-1.0)
     * @param y Die y-Komponente der Farbe (0.0-1.0)
     * @return true wenn erfolgreich, false sonst
     */
    public boolean setColor(String deviceId, double x, double y) {
        logger.info("Setze Farbe für Hue Light: {} auf ({}, {})", deviceId, x, y);
        
        // Validiere x und y Werte (0.0-1.0)
        if (x < 0.0 || x > 1.0 || y < 0.0 || y > 1.0) {
            return false;
        }
        
        Optional<Device> device = actionManager.getDevice(deviceId);
        
        if (device.isEmpty() || !(device.get() instanceof DeviceLightDimmerTemperatureColor)) {
            return false;
        }

        try {
            ((DeviceLightDimmerTemperatureColor) device.get()).setColor(x, y, true);
            return actionManager.saveDevice(device.get());
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Farbe für Hue Light {}", deviceId, e);
            return false;
        }
    }
    

}
