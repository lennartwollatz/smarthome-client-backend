package com.smarthome.backend.server.api;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.services.ActionService;
import com.smarthome.backend.server.api.services.DeviceService;
import com.smarthome.backend.server.api.services.FloorPlanService;
import com.smarthome.backend.server.api.services.ModuleService;
import com.smarthome.backend.server.api.services.SceneService;
import com.smarthome.backend.server.api.services.SettingsService;
import com.smarthome.backend.server.api.services.SystemService;
import com.smarthome.backend.server.api.services.UserService;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.events.EventStreamManager;

/**
 * Router für API-Anfragen. Leitet Anfragen an die entsprechenden Service-Klassen weiter.
 */
public class ApiRouter {
    private static final Logger logger = LoggerFactory.getLogger(ApiRouter.class);
    private static final Gson gson = new Gson();
    
    private final UserService userService;
    private final SystemService systemService;
    private final SettingsService settingsService;
    private final SceneService sceneService;
    private final ModuleService moduleService;
    private final DeviceService deviceService;
    private final ActionService actionService;
    private final FloorPlanService floorPlanService;
    
    public ApiRouter(DatabaseManager databaseManager, EventStreamManager eventStreamManager, ActionManager actionManager) {
        this.userService = new UserService(databaseManager, eventStreamManager, actionManager);
        this.systemService = new SystemService(databaseManager);
        this.settingsService = new SettingsService(databaseManager);
        this.sceneService = new SceneService(databaseManager, eventStreamManager, actionManager);
        this.moduleService = new ModuleService(databaseManager, eventStreamManager, actionManager);
        this.deviceService = new DeviceService(databaseManager, eventStreamManager, actionManager);
        this.actionService = new ActionService(actionManager);
        this.floorPlanService = new FloorPlanService(databaseManager, actionManager);
    }
    
    /**
     * Verarbeitet eine HTTP-Anfrage und leitet sie an den entsprechenden Service weiter.
     */
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        String prefix = "/api";
        
        logger.debug("Route Anfrage: {} {}", method, path);
        
        try {
            // User Service Endpunkte
            if (path.startsWith(prefix + "/users")) {
                userService.handleRequest(exchange, method, path.replace(prefix, ""));
                return;
            }
            
            // System Service Endpunkte
            if (path.startsWith(prefix + "/settings/system")) {
                systemService.handleRequest(exchange, method, path.replace(prefix, ""));
                return;
            }
            
            // Settings Service Endpunkte
            if (path.startsWith(prefix + "/settings")) {
                settingsService.handleRequest(exchange, method, path.replace(prefix, ""));
                return;
            }
            
            // Scene Service Endpunkte
            if (path.startsWith(prefix + "/scenes")) {
                sceneService.handleRequest(exchange, method, path.replace(prefix, ""));
                return;
            }
            
            // Module Service Endpunkte
            if (path.startsWith(prefix + "/modules")) {
                moduleService.handleRequest(exchange, method, path.replace(prefix, ""));
                return;
            }
            
            // Device Service Endpunkte
            if (path.startsWith(prefix + "/devices")) {
                deviceService.handleRequest(exchange, method, path.replace(prefix, ""));
                return;
            }
            
            // Action Service Endpunkte
            if (path.startsWith(prefix + "/actions")) {
                actionService.handleRequest(exchange, method, path.replace(prefix, ""));
                return;
            }
            
            // Floor Plan Service Endpunkte
            if (path.startsWith(prefix + "/floorplan")) {
                floorPlanService.handleRequest(exchange, method, path.replace(prefix, ""));
                return;
            }
            
            // Unbekannter Endpunkt
            sendError(exchange, 404, "Endpoint not found: " + path);
            
        } catch (Exception e) {
            logger.error("Fehler bei Verarbeitung der Anfrage", e);
            sendError(exchange, 500, "Internal server error: " + e.getMessage());
        }
    }
    
    /**
     * Sendet eine Fehlerantwort.
     */
    private void sendError(com.sun.net.httpserver.HttpExchange exchange, int statusCode, String message) throws IOException {
        String response = gson.toJson(Map.of("error", message));
        sendResponse(exchange, statusCode, response);
    }
    
    /**
     * Sendet eine JSON-Antwort.
     */
    public static void sendResponse(com.sun.net.httpserver.HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, responseBytes.length);
        
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(responseBytes);
        }
    }
    
    /**
     * Liest den Request Body als String.
     */
    public static String readRequestBody(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
    
    /**
     * Extrahiert einen Pfad-Parameter aus dem Pfad.
     * Beispiel: extractPathParam("/users/123", "/users/{id}") -> "123"
     */
    public static String extractPathParam(String path, String pattern) {
        // Konvertiere Pattern wie "/users/{id}" zu Regex
        String regex = pattern.replaceAll("\\{[^}]+\\}", "([^/]+)");
        Pattern p = Pattern.compile(regex);
        Matcher m = p.matcher(path);
        
        if (m.matches() && m.groupCount() > 0) {
            return m.group(1);
        }
        return null;
    }
}

