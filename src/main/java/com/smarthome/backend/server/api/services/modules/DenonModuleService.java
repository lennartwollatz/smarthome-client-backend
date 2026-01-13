package com.smarthome.backend.server.api.services.modules;

import java.io.IOException;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.api.modules.heos.denon.DenonModule;
import com.smarthome.backend.server.db.DatabaseManager;

/**
 * Service für Denon-Module-API-Endpunkte.
 */
public class DenonModuleService {
    private static final Logger logger = LoggerFactory.getLogger(DenonModuleService.class);
    private static final Gson gson = new Gson();
    
    private final DenonModule denonModule;
    
    public DenonModuleService(DatabaseManager databaseManager) {
        this.denonModule = new DenonModule(databaseManager);
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("DenonModuleService: {} {}", method, path);
        
        if (path.equals("/modules/denon/devices/discover")) {
            if ("GET".equals(method)) {
                discoverDevices(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/denon/devices/[^/]+/setVolume")) {
            if ("POST".equals(method)) {
                setVolume(exchange, path);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/denon/devices/[^/]+/setOn")) {
            if ("POST".equals(method)) {
                setOn(exchange, path);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/denon/devices/[^/]+/setOff")) {
            if ("POST".equals(method)) {
                setOff(exchange, path);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/denon/devices/[^/]+/setPlayState")) {
            if ("POST".equals(method)) {
                setPlayState(exchange, path);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/denon/devices/[^/]+/setMute")) {
            if ("POST".equals(method)) {
                setMute(exchange, path);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/denon/devices/[^/]+/playNext")) {
            if ("POST".equals(method)) {
                playNext(exchange, path);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/denon/devices/[^/]+/playPrevious")) {
            if ("POST".equals(method)) {
                playPrevious(exchange, path);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void discoverDevices(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        denonModule.discoverDevices(exchange);
    }
    
    private void setVolume(com.sun.net.httpserver.HttpExchange exchange, String path) throws IOException {
        try {
            String deviceId = ApiRouter.extractPathParam(path, "/modules/denon/devices/{deviceId}/setVolume");
            if (deviceId == null || deviceId.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültige Device ID")));
                return;
            }
            
            String requestBody = ApiRouter.readRequestBody(exchange);
            if (requestBody == null || requestBody.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Body")));
                return;
            }
            
            @SuppressWarnings("unchecked")
            Map<String, Object> request = gson.fromJson(requestBody, Map.class);
            if (request == null || !request.containsKey("volume")) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Volume-Parameter fehlt")));
                return;
            }
            
            Object volumeObj = request.get("volume");
            int volume;
            if (volumeObj instanceof Number) {
                volume = ((Number) volumeObj).intValue();
            } else if (volumeObj instanceof String) {
                volume = Integer.parseInt((String) volumeObj);
            } else {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Volume-Wert")));
                return;
            }
            
            boolean success = denonModule.setVolume(deviceId, volume);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Lautstärke", e);
            ApiRouter.sendResponse(exchange, 500, gson.toJson(Map.of("error", "Fehler beim Setzen der Lautstärke: " + e.getMessage())));
        }
    }
    
    private void setOn(com.sun.net.httpserver.HttpExchange exchange, String path) throws IOException {
        try {
            String deviceId = ApiRouter.extractPathParam(path, "/modules/denon/devices/{deviceId}/setOn");
            if (deviceId == null || deviceId.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültige Device ID")));
                return;
            }
            
            boolean success = denonModule.setPlayState(deviceId, "play");
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Einschalten des Geräts", e);
            ApiRouter.sendResponse(exchange, 500, gson.toJson(Map.of("error", "Fehler beim Einschalten des Geräts: " + e.getMessage())));
        }
    }
    
    private void setOff(com.sun.net.httpserver.HttpExchange exchange, String path) throws IOException {
        try {
            String deviceId = ApiRouter.extractPathParam(path, "/modules/denon/devices/{deviceId}/setOff");
            if (deviceId == null || deviceId.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültige Device ID")));
                return;
            }
            
            boolean success = denonModule.setPlayState(deviceId, "stop");
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Ausschalten des Geräts", e);
            ApiRouter.sendResponse(exchange, 500, gson.toJson(Map.of("error", "Fehler beim Ausschalten des Geräts: " + e.getMessage())));
        }
    }
    
    private void setPlayState(com.sun.net.httpserver.HttpExchange exchange, String path) throws IOException {
        try {
            String deviceId = ApiRouter.extractPathParam(path, "/modules/denon/devices/{deviceId}/setPlayState");
            if (deviceId == null || deviceId.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültige Device ID")));
                return;
            }
            
            String requestBody = ApiRouter.readRequestBody(exchange);
            if (requestBody == null || requestBody.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Body")));
                return;
            }
            
            @SuppressWarnings("unchecked")
            Map<String, Object> request = gson.fromJson(requestBody, Map.class);
            if (request == null || !request.containsKey("state")) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "State-Parameter fehlt")));
                return;
            }
            
            String state = (String) request.get("state");
            if (state == null || (!state.equals("play") && !state.equals("pause") && !state.equals("stop"))) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger State-Wert (muss 'play', 'pause' oder 'stop' sein)")));
                return;
            }
            
            boolean success = denonModule.setPlayState(deviceId, state);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Setzen des Wiedergabestatus", e);
            ApiRouter.sendResponse(exchange, 500, gson.toJson(Map.of("error", "Fehler beim Setzen des Wiedergabestatus: " + e.getMessage())));
        }
    }
    
    private void setMute(com.sun.net.httpserver.HttpExchange exchange, String path) throws IOException {
        try {
            String deviceId = ApiRouter.extractPathParam(path, "/modules/denon/devices/{deviceId}/setMute");
            if (deviceId == null || deviceId.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültige Device ID")));
                return;
            }
            
            String requestBody = ApiRouter.readRequestBody(exchange);
            if (requestBody == null || requestBody.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Body")));
                return;
            }
            
            @SuppressWarnings("unchecked")
            Map<String, Object> request = gson.fromJson(requestBody, Map.class);
            if (request == null || !request.containsKey("mute")) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Mute-Parameter fehlt")));
                return;
            }
            
            Object muteObj = request.get("mute");
            boolean mute;
            if (muteObj instanceof Boolean) {
                mute = (Boolean) muteObj;
            } else if (muteObj instanceof String) {
                mute = Boolean.parseBoolean((String) muteObj);
            } else {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Mute-Wert")));
                return;
            }
            
            boolean success = denonModule.setMute(deviceId, mute);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Stummschaltung", e);
            ApiRouter.sendResponse(exchange, 500, gson.toJson(Map.of("error", "Fehler beim Setzen der Stummschaltung: " + e.getMessage())));
        }
    }
    
    private void playNext(com.sun.net.httpserver.HttpExchange exchange, String path) throws IOException {
        try {
            String deviceId = ApiRouter.extractPathParam(path, "/modules/denon/devices/{deviceId}/playNext");
            if (deviceId == null || deviceId.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültige Device ID")));
                return;
            }
            
            boolean success = denonModule.playNext(deviceId);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Abspielen des nächsten Titels", e);
            ApiRouter.sendResponse(exchange, 500, gson.toJson(Map.of("error", "Fehler beim Abspielen des nächsten Titels: " + e.getMessage())));
        }
    }
    
    private void playPrevious(com.sun.net.httpserver.HttpExchange exchange, String path) throws IOException {
        try {
            String deviceId = ApiRouter.extractPathParam(path, "/modules/denon/devices/{deviceId}/playPrevious");
            if (deviceId == null || deviceId.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültige Device ID")));
                return;
            }
            
            boolean success = denonModule.playPrevious(deviceId);
            if (success) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Abspielen des vorherigen Titels", e);
            ApiRouter.sendResponse(exchange, 500, gson.toJson(Map.of("error", "Fehler beim Abspielen des vorherigen Titels: " + e.getMessage())));
        }
    }
    
}

