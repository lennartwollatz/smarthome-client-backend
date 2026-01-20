package com.smarthome.backend.server.api.services;

import java.io.IOException;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.Enumeration;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.model.AutoUpdateSettings;
import com.smarthome.backend.model.Settings;
import com.smarthome.backend.model.SystemInfo;
import com.smarthome.backend.model.SystemSettings;
import com.smarthome.backend.model.UpdateComponentRequest;
import com.smarthome.backend.model.VersionInfo;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.db.DatabaseManager;

/**
 * Service für System-API-Endpunkte.
 */
public class SystemService {
    private static final Logger logger = LoggerFactory.getLogger(SystemService.class);
    private static final Gson gson = new Gson();
    
    private final SettingsService settingsService;

    
    public SystemService(DatabaseManager databaseManager) {
        this.settingsService = new SettingsService(databaseManager);
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("SystemService: {} {}", method, path);
        
        if (path.equals("/settings/system/info")) {
            if ("GET".equals(method)) {
                getSystemInfo(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.equals("/settings/system/install-update")) {
            if ("POST".equals(method)) {
                updateComponent(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.equals("/settings/system/auto-update")) {
            if ("PUT".equals(method)) {
                updateAutoUpdateSettings(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void getSystemInfo(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Lade System-Info");
        
        // Lade Settings aus der Datenbank oder erstelle sie, falls sie nicht existieren
        Settings settings = settingsService.loadOrCreateSettings();
        
        // Extrahiere SystemSettings aus Settings
        // Die server-ip wurde bereits in loadOrCreateSettings() aktualisiert
        SystemSettings systemSettings = settings.getSystem();
        String serverIp = systemSettings.getServerIp();
        
        // Erstelle SystemInfo aus SystemSettings
        SystemInfo systemInfo = new SystemInfo();
        systemInfo.setFrontend(systemSettings.getFrontend());
        systemInfo.setBackend(systemSettings.getBackend());
        systemInfo.setServerIp(serverIp);
        
        String response = gson.toJson(systemInfo);
        ApiRouter.sendResponse(exchange, 200, response);
    }
    
    /**
     * Ermittelt die lokale Netzwerk-IP-Adresse des Servers.
     * Sucht nach der ersten IPv4-Adresse, die nicht localhost (127.0.0.1) oder 0.0.0.0 ist.
     * 
     * @return Die lokale Netzwerk-IP-Adresse oder "localhost" als Fallback
     */
    private String getLocalNetworkIpAddress() {
        try {
            Enumeration<NetworkInterface> networkInterfaces = NetworkInterface.getNetworkInterfaces();
            
            while (networkInterfaces.hasMoreElements()) {
                NetworkInterface networkInterface = networkInterfaces.nextElement();
                
                // Prüfe, ob Interface aktiv und nicht loopback ist
                if (networkInterface.isUp() && !networkInterface.isLoopback() && !networkInterface.isVirtual()) {
                    Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                    
                    while (addresses.hasMoreElements()) {
                        InetAddress address = addresses.nextElement();
                        
                        // Verwende nur IPv4-Adressen, die nicht localhost oder 0.0.0.0 sind
                        if (address instanceof java.net.Inet4Address 
                                && !address.isLoopbackAddress() 
                                && !address.getHostAddress().equals("0.0.0.0")) {
                            String ipAddress = address.getHostAddress();
                            logger.debug("Lokale Netzwerk-IP-Adresse gefunden: {} auf Interface {}", 
                                ipAddress, networkInterface.getName());
                            return ipAddress;
                        }
                    }
                }
            }
            
            // Fallback: Versuche InetAddress.getLocalHost()
            try {
                InetAddress localHost = InetAddress.getLocalHost();
                if (localHost instanceof java.net.Inet4Address 
                        && !localHost.isLoopbackAddress() 
                        && !localHost.getHostAddress().equals("0.0.0.0")) {
                    logger.debug("Lokale Netzwerk-IP-Adresse über getLocalHost() gefunden: {}", 
                        localHost.getHostAddress());
                    return localHost.getHostAddress();
                }
            } catch (Exception e) {
                logger.debug("Fehler beim Abrufen von getLocalHost(): {}", e.getMessage());
            }
            
            logger.warn("Keine gültige Netzwerk-IP-Adresse gefunden, verwende 'localhost' als Fallback");
            return "localhost";
            
        } catch (SocketException e) {
            logger.error("Fehler beim Abrufen der Netzwerk-Interfaces", e);
            return "localhost";
        }
    }
    
    private void updateComponent(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Aktualisiere System-Komponente");
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            UpdateComponentRequest request = gson.fromJson(requestBody, UpdateComponentRequest.class);
            
            // Lade Settings aus der Datenbank oder erstelle sie, falls sie nicht existieren
            Settings settings = settingsService.loadOrCreateSettings();
            SystemSettings systemSettings = settings.getSystem();
            
            // Simuliere Update
            if ("frontend".equals(request.getComponent())) {
                VersionInfo frontend = systemSettings.getFrontend();
                frontend.setCurrentVersion(frontend.getLatestVersion());
                frontend.setHasUpdate(false);
            } else if ("backend".equals(request.getComponent())) {
                VersionInfo backend = systemSettings.getBackend();
                backend.setCurrentVersion(backend.getLatestVersion());
                backend.setHasUpdate(false);
            }
            
            // Speichere Settings über SettingsService
            // Die server-ip wurde bereits in loadOrCreateSettings() aktualisiert
            settingsService.saveSettings(settings);
            
            // Erstelle SystemInfo für Response
            SystemInfo systemInfo = new SystemInfo();
            systemInfo.setFrontend(systemSettings.getFrontend());
            systemInfo.setBackend(systemSettings.getBackend());
            systemInfo.setServerIp(systemSettings.getServerIp());
            
            String response = gson.toJson(systemInfo);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren der Komponente", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid request: " + e.getMessage())));
        }
    }
    
    private void updateAutoUpdateSettings(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Aktualisiere Auto-Update-Einstellungen");
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            AutoUpdateSettings autoUpdate = gson.fromJson(requestBody, AutoUpdateSettings.class);
            
            // Lade Settings aus der Datenbank oder erstelle sie, falls sie nicht existieren
            Settings settings = settingsService.loadOrCreateSettings();
            SystemSettings system = settings.getSystem();
            
            system.setAutoupdate(autoUpdate.getAutoupdate());
            system.setUpdatetimes(autoUpdate.getUpdatetimes());
            
            // Speichere Settings über SettingsService
            settingsService.saveSettings(settings);
            
            String response = gson.toJson(autoUpdate);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren der Auto-Update-Einstellungen", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid auto-update settings: " + e.getMessage())));
        }
    }
    
}

