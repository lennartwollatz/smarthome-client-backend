package com.smarthome.backend.server.api.services;

import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.model.devices.DeviceSpeaker;
import com.smarthome.backend.model.devices.helper.DevicePolymorphicAdapter;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;

/**
 * Service für Device-API-Endpunkte.
 */
public class DeviceService {
    private static final Logger logger = LoggerFactory.getLogger(DeviceService.class);
    
    // Gson mit polymorphem TypeAdapter für Device-Deserialisierung
    private static final Gson gson = new GsonBuilder()
        .registerTypeAdapter(Device.class, new DevicePolymorphicAdapter())
        .create();
    
    private final Repository<Device> deviceRepository;
    private final DatabaseManager databaseManager;
    
    public DeviceService(DatabaseManager databaseManager) {
        this.deviceRepository = new JsonRepository<>(databaseManager, Device.class);
        this.databaseManager = databaseManager;
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("DeviceService: {} {}", method, path);
        
        if (path.equals("/devices") || path.equals("/devices/")) {
            if ("GET".equals(method)) {
                getDevices(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/devices/[^/]+/value")) {
            if ("PUT".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/devices/{deviceId}/value");
                setDeviceValue(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/devices/[^/]+")) {
            String deviceId = ApiRouter.extractPathParam(path, "/devices/{deviceId}");
            if ("PUT".equals(method)) {
                updateDevice(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void getDevices(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Lade alle Geräte");
        
        // Lese JSON-Strings direkt aus der Datenbank und deserialisiere sie mit dem polymorphen TypeAdapter
        List<Device> devices = new ArrayList<>();
        String sql = "SELECT data FROM objects WHERE type = ? ORDER BY created_at DESC";
        
        try (Connection conn = databaseManager.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, "Device");
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String json = rs.getString("data");
                    try {
                        // Deserialisiere mit dem polymorphen TypeAdapter, um die richtige Klasse zu erhalten
                        Device device = gson.fromJson(json, Device.class);
                        devices.add(device);
                        
                        // Logge den tatsächlichen Typ für Debugging
                        if (device instanceof DeviceSpeaker) {
                            logger.debug("Gerät {} ist vom Typ DeviceSpeaker", device.getId());
                        } else {
                            logger.debug("Gerät {} ist vom Typ Device", device.getId());
                        }
                    } catch (Exception e) {
                        logger.warn("Fehler beim Deserialisieren eines Geräts: {}", e.getMessage());
                    }
                }
            }
            
        } catch (SQLException e) {
            logger.error("Fehler beim Abrufen der Geräte aus der Datenbank", e);
            ApiRouter.sendResponse(exchange, 500, gson.toJson(Map.of("error", "Fehler beim Abrufen der Geräte")));
            return;
        }
        
        String response = gson.toJson(devices);
        ApiRouter.sendResponse(exchange, 200, response);
    }
    
    private void updateDevice(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        setDeviceValue(exchange, deviceId);
    }
    
    
    private void setDeviceValue(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        logger.info("Setze Hauptattribute für Gerät: {}", deviceId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> request = gson.fromJson(requestBody, Map.class);
            
            // Lese JSON direkt aus der Datenbank und deserialisiere mit dem polymorphen TypeAdapter
            Device device = findDeviceById(deviceId);
            
            if (device != null) {
                
                // Setze nur die Hauptattribute aus der Device-Klasse
                if (request.containsKey("name")) {
                    device.setName((String) request.get("name"));
                }
                if (request.containsKey("room")) {
                    device.setRoom((String) request.get("room"));
                }
                if (request.containsKey("icon")) {
                    device.setIcon((String) request.get("icon"));
                }
                if (request.containsKey("typeLabel")) {
                    device.setTypeLabel((String) request.get("typeLabel"));
                }
                if (request.containsKey("moduleId")) {
                    device.setModuleId((String) request.get("moduleId"));
                }
                if (request.containsKey("isConnected")) {
                    Object isConnectedObj = request.get("isConnected");
                    if (isConnectedObj instanceof Boolean) {
                        device.setIsConnected((Boolean) isConnectedObj);
                    } else if (isConnectedObj instanceof String) {
                        device.setIsConnected(Boolean.parseBoolean((String) isConnectedObj));
                    }
                }
                if (request.containsKey("isConnecting")) {
                    Object isConnectingObj = request.get("isConnecting");
                    if (isConnectingObj instanceof Boolean) {
                        device.setIsConnecting((Boolean) isConnectingObj);
                    } else if (isConnectingObj instanceof String) {
                        device.setIsConnecting(Boolean.parseBoolean((String) isConnectingObj));
                    }
                }
                
                // ID und Type sollten nicht über diesen Endpunkt geändert werden können
                // functionsBool, functionsAction, functionsTrigger werden vom Gerät selbst verwaltet
                
                deviceRepository.save(deviceId, device);
                
                ApiRouter.sendResponse(exchange, 200, gson.toJson(device));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Device not found")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Setzen der Geräteattribute", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid request: " + e.getMessage())));
        }
    }
    
    /**
     * Findet ein Gerät anhand seiner ID und deserialisiert es mit dem polymorphen TypeAdapter.
     * 
     * @param deviceId Die ID des Geräts
     * @return Das deserialisierte Gerät (kann DeviceSpeaker, DenonSpeaker, etc. sein) oder null wenn nicht gefunden
     */
    private Device findDeviceById(String deviceId) {
        String sql = "SELECT data FROM objects WHERE id = ? AND type = ?";
        
        try (Connection conn = databaseManager.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            
            stmt.setString(1, deviceId);
            stmt.setString(2, "Device");
            
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    String json = rs.getString("data");
                    // Deserialisiere mit dem polymorphen TypeAdapter, um die richtige Klasse zu erhalten
                    Device device = gson.fromJson(json, Device.class);
                    
                    // Logge den tatsächlichen Typ für Debugging
                    if (device instanceof DeviceSpeaker) {
                        logger.debug("Gerät {} ist vom Typ DeviceSpeaker", deviceId);
                    } else {
                        logger.debug("Gerät {} ist vom Typ Device", deviceId);
                    }
                    
                    return device;
                } else {
                    logger.debug("Gerät {} nicht gefunden", deviceId);
                    return null;
                }
            }
            
        } catch (SQLException e) {
            logger.error("Fehler beim Abrufen des Geräts {} aus der Datenbank", deviceId, e);
            return null;
        }
    }
}

