package com.smarthome.backend.server.api.services;

import com.google.gson.Gson;
import com.smarthome.backend.model.*;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.Enumeration;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;

/**
 * Service für Settings-API-Endpunkte.
 */
public class SettingsService {
    private static final Logger logger = LoggerFactory.getLogger(SettingsService.class);
    private static final Gson gson = new Gson();
    
    private final Repository<Settings> settingsRepository;
    
    public SettingsService(DatabaseManager databaseManager) {
        this.settingsRepository = new JsonRepository<>(databaseManager, Settings.class);
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("SettingsService: {} {}", method, path);
        
        if (path.equals("/settings") || path.equals("/settings/")) {
            if ("GET".equals(method)) {
                loadSettings(exchange);
            } else if ("PUT".equals(method)) {
                updateSettings(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.equals("/settings/notifications")) {
            if ("PUT".equals(method)) {
                updateNotificationSettings(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.equals("/settings/privacy")) {
            if ("PUT".equals(method)) {
                updatePrivacySettings(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.equals("/settings/data")) {
            if ("DELETE".equals(method)) {
                deleteAllData(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.equals("/settings/factory-reset")) {
            if ("DELETE".equals(method)) {
                factoryReset(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            // Weiterleitung an SystemService
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void loadSettings(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Lade alle Einstellungen");
        Optional<Settings> settingsOpt = settingsRepository.findById("main-settings");
        
        Settings settings;
        if (settingsOpt.isPresent()) {
            settings = settingsOpt.get();
        } else {
            // Fallback: Erstelle Standard-Settings
            settings = createDefaultSettings();
            settingsRepository.save("main-settings", settings);
        }
        
        // Aktualisiere server-ip bei jeder Anfrage
        updateServerIp(settings);
        settingsRepository.save("main-settings", settings);
        
        String response = gson.toJson(settings);
        ApiRouter.sendResponse(exchange, 200, response);
    }
    
    private void updateSettings(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Aktualisiere alle Einstellungen");
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            Settings settings = gson.fromJson(requestBody, Settings.class);
            
            // Aktualisiere server-ip bei jeder Anfrage
            updateServerIp(settings);
            
            settingsRepository.save("main-settings", settings);
            String response = gson.toJson(settings);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren der Einstellungen", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid settings data: " + e.getMessage())));
        }
    }
    
    private void updateNotificationSettings(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Aktualisiere Benachrichtigungseinstellungen");
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            NotificationSettings newNotifications = gson.fromJson(requestBody, NotificationSettings.class);
            
            // Lade das Settings-Objekt aus der Datenbank oder erstelle Standard-Settings
            Settings settings = settingsRepository.findById("main-settings")
                .orElse(createDefaultSettings());
            
            // Aktualisiere die NotificationSettings im Settings-Objekt
            settings.setNotifications(newNotifications);
            
            // Aktualisiere server-ip bei jeder Anfrage
            updateServerIp(settings);
            
            // Speichere das gesamte Settings-Objekt
            settingsRepository.save("main-settings", settings);
            
            String response = gson.toJson(newNotifications);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren der Benachrichtigungseinstellungen", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid notification settings: " + e.getMessage())));
        }
    }
    
    private void updatePrivacySettings(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Aktualisiere Datenschutzeinstellungen");
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            PrivacySettings newPrivacy = gson.fromJson(requestBody, PrivacySettings.class);
            
            // Lade das Settings-Objekt aus der Datenbank oder erstelle Standard-Settings
            Settings settings = settingsRepository.findById("main-settings")
                .orElse(createDefaultSettings());
            
            // Aktualisiere die PrivacySettings im Settings-Objekt
            settings.setPrivacy(newPrivacy);
            
            // Aktualisiere server-ip bei jeder Anfrage
            updateServerIp(settings);
            
            // Speichere das gesamte Settings-Objekt
            settingsRepository.save("main-settings", settings);
            
            String response = gson.toJson(newPrivacy);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren der Datenschutzeinstellungen", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid privacy settings: " + e.getMessage())));
        }
    }
    
    private void deleteAllData(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.warn("Lösche alle Benutzerdaten");
        // Hier würde man alle User-Daten löschen
        ApiRouter.sendResponse(exchange, 204, "");
    }
    
    private void factoryReset(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.warn("Führe Werksreset durch");
        Settings defaultSettings = createDefaultSettings();
        settingsRepository.save("main-settings", defaultSettings);
        String response = gson.toJson(defaultSettings);
        ApiRouter.sendResponse(exchange, 200, response);
    }
    
    private Settings createDefaultSettings() {
        Settings settings = new Settings();
        
        GeneralSettings allgemein = new GeneralSettings();
        allgemein.setName("Mein Smart Home");
        allgemein.setSprache("de");
        allgemein.setTemperatur("celsius");
        settings.setAllgemein(allgemein);
        
        NotificationSettings notifications = new NotificationSettings();
        notifications.setSecurity(true);
        notifications.setBatterystatus(true);
        notifications.setEnergyreport(false);
        settings.setNotifications(notifications);
        
        PrivacySettings privacy = new PrivacySettings();
        privacy.setAilearning(true);
        settings.setPrivacy(privacy);
        
        SystemSettings system = new SystemSettings();
        system.setAutoupdate(true);
        UpdateTimes updateTimes = new UpdateTimes();
        updateTimes.setFrom("02:00");
        updateTimes.setTo("05:00");
        system.setUpdatetimes(updateTimes);
        settings.setSystem(system);
        
        // Initialisiere SystemSettings mit Versionen aus der Konfiguration
        initializeSystemSettings(settings);
        
        return settings;
    }
    
    /**
     * Lädt die Settings aus der Datenbank oder erstellt Standard-Settings, falls sie nicht existieren.
     * Aktualisiert dabei immer die server-ip.
     * 
     * @return Die geladenen oder erstellten Settings
     */
    Settings loadOrCreateSettings() {
        Optional<Settings> settingsOpt = settingsRepository.findById("main-settings");
        Settings settings;
        
        if (settingsOpt.isPresent()) {
            settings = settingsOpt.get();
            // Stelle sicher, dass SystemSettings initialisiert sind
            if (settings.getSystem() == null || 
                settings.getSystem().getFrontend() == null || 
                settings.getSystem().getBackend() == null) {
                initializeSystemSettings(settings);
            }
        } else {
            // Erstelle Standard-Settings
            settings = createDefaultSettings();
        }
        
        // Aktualisiere server-ip bei jeder Anfrage
        updateServerIp(settings);
        settingsRepository.save("main-settings", settings);
        
        return settings;
    }
    
    /**
     * Speichert die Settings in der Datenbank.
     * 
     * @param settings Die zu speichernden Settings
     */
    void saveSettings(Settings settings) {
        settingsRepository.save("main-settings", settings);
    }
    
    /**
     * Initialisiert die SystemSettings im Settings-Objekt mit Versionen aus der Konfiguration.
     */
    void initializeSystemSettings(Settings settings) {
        // Lade Versionen aus der Konfigurationsdatei
        Properties config = loadConfiguration();
        
        // Stelle sicher, dass SystemSettings existiert
        if (settings.getSystem() == null) {
            settings.setSystem(new SystemSettings());
        }
        
        SystemSettings systemSettings = settings.getSystem();
        
        // Initialisiere Frontend-VersionInfo
        if (systemSettings.getFrontend() == null) {
            systemSettings.setFrontend(new VersionInfo());
        }
        VersionInfo frontend = systemSettings.getFrontend();
        String frontendCurrent = getProperty(config, "version.frontend.current", "1.0.0");
        String frontendLatest = getProperty(config, "version.frontend.latest", "1.0.0");
        frontend.setCurrentVersion(frontendCurrent);
        frontend.setLatestVersion(frontendLatest);
        frontend.setHasUpdate(!frontendCurrent.equals(frontendLatest));
        
        // Initialisiere Backend-VersionInfo
        if (systemSettings.getBackend() == null) {
            systemSettings.setBackend(new VersionInfo());
        }
        VersionInfo backend = systemSettings.getBackend();
        String backendCurrent = getProperty(config, "version.backend.current", "1.0.0");
        String backendLatest = getProperty(config, "version.backend.latest", "1.0.0");
        backend.setCurrentVersion(backendCurrent);
        backend.setLatestVersion(backendLatest);
        backend.setHasUpdate(!backendCurrent.equals(backendLatest));
    }
    
    /**
     * Lädt die Konfigurationsdatei application.properties.
     */
    private Properties loadConfiguration() {
        Properties properties = new Properties();
        try (InputStream inputStream = getClass().getClassLoader()
                .getResourceAsStream("application.properties")) {
            if (inputStream != null) {
                properties.load(inputStream);
            } else {
                logger.warn("Konfigurationsdatei application.properties nicht gefunden, verwende Standardwerte");
            }
        } catch (IOException e) {
            logger.error("Fehler beim Laden der Konfigurationsdatei", e);
        }
        return properties;
    }
    
    /**
     * Liest eine Property aus der Konfiguration oder verwendet den Standardwert.
     * Prüft zuerst System-Properties, dann die geladene Konfigurationsdatei.
     */
    private String getProperty(Properties config, String key, String defaultValue) {
        // Prüfe zuerst System-Properties (können über -D Parameter gesetzt werden)
        String systemProperty = System.getProperty(key);
        if (systemProperty != null && !systemProperty.isEmpty()) {
            return systemProperty;
        }
        
        // Dann aus der Konfigurationsdatei
        String configProperty = config.getProperty(key);
        if (configProperty != null && !configProperty.isEmpty()) {
            return configProperty;
        }
        
        // Fallback auf Standardwert
        return defaultValue;
    }
    
    /**
     * Aktualisiert die server-ip in den SystemSettings.
     * Ermittelt die aktuelle lokale Netzwerk-IP-Adresse und setzt sie in SystemSettings.
     * 
     * @param settings Die Settings, deren server-ip aktualisiert werden soll
     */
    private void updateServerIp(Settings settings) {
        // Stelle sicher, dass SystemSettings existiert
        if (settings.getSystem() == null) {
            settings.setSystem(new SystemSettings());
        }
        
        // Ermittle die lokale Netzwerk-IP-Adresse
        String serverIp = getLocalNetworkIpAddress();
        
        // Setze die server-ip in SystemSettings
        settings.getSystem().setServerIp(serverIp);
        logger.debug("Server-IP aktualisiert: {}", serverIp);
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
}

