package com.smarthome.backend.server.api.services.modules;

import java.io.IOException;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.api.modules.hue.HueModuleManager;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.events.EventStreamManager;

/**
 * Service für Hue-Module-API-Endpunkte.
 */
public class HueModuleService {
    private static final Logger logger = LoggerFactory.getLogger(HueModuleService.class);
    private static final Gson gson = new Gson();
    
    private final HueModuleManager hueModule;
    
    public HueModuleService(DatabaseManager databaseManager, EventStreamManager eventStreamManager, ActionManager actionManager ) {
        this.hueModule = new HueModuleManager(databaseManager, eventStreamManager, actionManager);
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("HueModuleService: {} {}", method, path);
        
        if (path.equals("/modules/hue/bridges/discover")) {
            if ("GET".equals(method)) {
                discoverBridges(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/hue/bridges/[^/]+/pair")) {
            if ("POST".equals(method)) {
                String bridgeId = ApiRouter.extractPathParam(path, "/modules/hue/bridges/{bridgeId}/pair");
                pairBridge(exchange, bridgeId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/hue/discover/devices/[^/]+")) {
            if ("GET".equals(method)) {
                String bridgeId = ApiRouter.extractPathParam(path, "/modules/hue/discover/devices/{bridgeId}");
                discoverDevices(exchange, bridgeId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/hue/devices/[^/]+/setSensitivity")) {
            if ("PUT".equals(method) || "POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/hue/devices/{deviceId}/setSensitivity");
                setSensitivity(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/hue/devices/[^/]+/setOn")) {
            if ("PUT".equals(method) || "POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/hue/devices/{deviceId}/setOn");
                setOn(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/hue/devices/[^/]+/setOff")) {
            if ("PUT".equals(method) || "POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/hue/devices/{deviceId}/setOff");
                setOff(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/hue/devices/[^/]+/setBrightness")) {
            if ("PUT".equals(method) || "POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/hue/devices/{deviceId}/setBrightness");
                setBrightness(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/hue/devices/[^/]+/setTemperature")) {
            if ("PUT".equals(method) || "POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/hue/devices/{deviceId}/setTemperature");
                setTemperature(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/hue/devices/[^/]+/setColor")) {
            if ("PUT".equals(method) || "POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/hue/devices/{deviceId}/setColor");
                setColor(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void discoverBridges(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        hueModule.discoverBridges(exchange);
    }
    
    /**
     * API-Endpunkt zum Pairing mit einer Hue Bridge.
     * Die bridgeId wird aus dem Pfad extrahiert.
     * Erwartet im Body optional: deviceType und generateClientKey.
     */
    private void pairBridge(com.sun.net.httpserver.HttpExchange exchange, String bridgeId) throws IOException {
        hueModule.pairBridge(exchange, bridgeId);
    }
    
    /**
     * API-Endpunkt zum Suchen von Geräten einer Hue Bridge.
     * Die bridgeId wird aus dem Pfad extrahiert.
     */
    private void discoverDevices(com.sun.net.httpserver.HttpExchange exchange, String bridgeId) throws IOException {
        hueModule.discoverDevices(exchange, bridgeId);
    }
    
    /**
     * API-Endpunkt zum Setzen der Sensitivity eines Hue Motion Sensors.
     * Die deviceId wird aus dem Pfad extrahiert.
     * Erwartet im Body: {"sensitivity": <int>}
     */
    private void setSensitivity(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        logger.info("Setze Sensitivity für Hue Motion Sensor: {}", deviceId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> request = gson.fromJson(requestBody, Map.class);
            
            // Prüfe, ob sensitivity im Request vorhanden ist
            if (!request.containsKey("sensitivity")) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "sensitivity parameter is required")));
                return;
            }
            
            Object sensitivityObj = request.get("sensitivity");
            int sensitivity;
            if (sensitivityObj instanceof Number) {
                sensitivity = ((Number) sensitivityObj).intValue();
            } else if (sensitivityObj instanceof String) {
                sensitivity = Integer.parseInt((String) sensitivityObj);
            } else {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "sensitivity must be a number")));
                return;
            }
            
            // Rufe die Methode im HueModuleManager auf
            boolean success = hueModule.setSensitivity(deviceId, sensitivity);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Sensitivity", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid request: " + e.getMessage())));
        }
    }
    
    /**
     * API-Endpunkt zum Einschalten eines Hue Light.
     * Die deviceId wird aus dem Pfad extrahiert.
     * Kein Body erforderlich.
     */
    private void setOn(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        logger.info("Schalte Hue Light ein: {}", deviceId);
        
        try {
            // Rufe die Methode im HueModuleManager auf
            boolean success = hueModule.setOn(deviceId);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Einschalten des Hue Light", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid request: " + e.getMessage())));
        }
    }
    
    /**
     * API-Endpunkt zum Ausschalten eines Hue Light.
     * Die deviceId wird aus dem Pfad extrahiert.
     * Kein Body erforderlich.
     */
    private void setOff(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        logger.info("Schalte Hue Light aus: {}", deviceId);
        
        try {
            // Rufe die Methode im HueModuleManager auf
            boolean success = hueModule.setOff(deviceId);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Ausschalten des Hue Light", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid request: " + e.getMessage())));
        }
    }
    
    /**
     * API-Endpunkt zum Setzen der Helligkeit eines Hue Light.
     * Die deviceId wird aus dem Pfad extrahiert.
     * Erwartet im Body: {"brightness": <int>}
     */
    private void setBrightness(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        logger.info("Setze Helligkeit für Hue Light: {}", deviceId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> request = gson.fromJson(requestBody, Map.class);
            
            // Prüfe, ob brightness im Request vorhanden ist
            if (!request.containsKey("brightness")) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "brightness parameter is required")));
                return;
            }
            
            Object brightnessObj = request.get("brightness");
            int brightness;
            if (brightnessObj instanceof Number) {
                brightness = ((Number) brightnessObj).intValue();
            } else if (brightnessObj instanceof String) {
                brightness = Integer.parseInt((String) brightnessObj);
            } else {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "brightness must be a number")));
                return;
            }
            
            // Rufe die Methode im HueModuleManager auf
            boolean success = hueModule.setBrightness(deviceId, brightness);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Helligkeit", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid request: " + e.getMessage())));
        }
    }
    
    /**
     * API-Endpunkt zum Setzen der Farbtemperatur eines Hue Light.
     * Die deviceId wird aus dem Pfad extrahiert.
     * Erwartet im Body: {"temperature": <int>}
     */
    private void setTemperature(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        logger.info("Setze Farbtemperatur für Hue Light: {}", deviceId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> request = gson.fromJson(requestBody, Map.class);
            
            // Prüfe, ob temperature im Request vorhanden ist
            if (!request.containsKey("temperature")) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "temperature parameter is required")));
                return;
            }
            
            Object temperatureObj = request.get("temperature");
            int temperature;
            if (temperatureObj instanceof Number) {
                temperature = ((Number) temperatureObj).intValue();
            } else if (temperatureObj instanceof String) {
                temperature = Integer.parseInt((String) temperatureObj);
            } else {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "temperature must be a number")));
                return;
            }
            
            // Rufe die Methode im HueModuleManager auf
            boolean success = hueModule.setTemperature(deviceId, temperature);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Farbtemperatur", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid request: " + e.getMessage())));
        }
    }
    
    /**
     * API-Endpunkt zum Setzen der Farbe eines Hue Light.
     * Die deviceId wird aus dem Pfad extrahiert.
     * Erwartet im Body: {"x": <int>, "y": <int>}
     */
    private void setColor(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        logger.info("Setze Farbe für Hue Light: {}", deviceId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> request = gson.fromJson(requestBody, Map.class);
            
            // Prüfe, ob x und y im Request vorhanden sind
            if (!request.containsKey("x") || !request.containsKey("y")) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "x and y parameters are required")));
                return;
            }
            
            Object xObj = request.get("x");
            Object yObj = request.get("y");
            double x, y;
            
            if (xObj instanceof Number) {
                x = ((Number) xObj).doubleValue();
            } else if (xObj instanceof String) {
                x = Double.parseDouble((String) xObj);
            } else {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "x must be a number")));
                return;
            }
            
            if (yObj instanceof Number) {
                y = ((Number) yObj).doubleValue();
            } else if (yObj instanceof String) {
                y = Double.parseDouble((String) yObj);
            } else {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "y must be a number")));
                return;
            }
            
            // Validiere, dass x und y zwischen 0.0 und 1.0 liegen
            if (x < 0.0 || x > 1.0 || y < 0.0 || y > 1.0) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "x and y must be between 0.0 and 1.0")));
                return;
            }
            
            // Runde auf 3 Nachkommastellen
            x = Math.round(x * 1000.0) / 1000.0;
            y = Math.round(y * 1000.0) / 1000.0;
            
            // Rufe die Methode im HueModuleManager auf
            boolean success = hueModule.setColor(deviceId, x, y);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Farbe", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid request: " + e.getMessage())));
        }
    }
}

