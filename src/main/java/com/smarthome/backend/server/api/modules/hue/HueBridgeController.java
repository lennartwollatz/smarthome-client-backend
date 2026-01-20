package com.smarthome.backend.server.api.modules.hue;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.smarthome.backend.model.Module;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.api.modules.ModuleEventStreamManager;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;

/**
 * Kapselt die Logik zum Pairing mit einer Hue Bridge über die Hue CLIP API.
 */
public class HueBridgeController {

    private static final Logger logger = LoggerFactory.getLogger(HueBridgeController.class);
    private static final Gson gson = new Gson();
    
    private final Repository<HueDiscoveredBridge> bridgeRepository;
    private final Repository<Module> moduleRepository;
    private final DatabaseManager databaseManager;
    
    public HueBridgeController() {
        this.bridgeRepository = null;
        this.moduleRepository = null;
        this.databaseManager = null;
    }
    
    public HueBridgeController(DatabaseManager databaseManager) {
        this.databaseManager = databaseManager;
        if (databaseManager != null) {
            this.bridgeRepository = new JsonRepository<>(databaseManager, HueDiscoveredBridge.class);
            this.moduleRepository = new JsonRepository<>(databaseManager, Module.class);
        } else {
            this.bridgeRepository = null;
            this.moduleRepository = null;
        }
    }


    /**
     * Stellt über die Hue CLIP API ein Pairing zur angegebenen Bridge her.
     * Die Bridge wird anhand der bridgeId aus der Datenbank geladen.
     * 
     * Gemäß Hue API V2 Getting Started Guide:
     * - POST Request an http://<bridge ip address>/api
     * - Body: {"devicetype":"app_name#instance_name", "generateclientkey":true}
     * - Vor dem Aufruf muss der physische Link-Button an der Bridge gedrückt werden
     * 
     * @param exchange HTTP-Exchange für die Antwort
     * @param bridgeId Die deviceId der Bridge (aus dem Discovery-Suchlauf)
     * @throws IOException bei Fehlern beim Senden der Antwort
     */
    public void pairBridge(com.sun.net.httpserver.HttpExchange exchange, String bridgeId, Runnable onPairingSuccess) throws IOException {
        try {
            if (bridgeRepository == null) {
                ApiRouter.sendResponse(exchange, 500,
                    gson.toJson(Map.of("error", "DatabaseManager nicht initialisiert - Bridge kann nicht aus Datenbank geladen werden")));
                return;
            }
            
            logger.info("Starte Hue-Pairing für Bridge: {}", bridgeId);
            
            // Lade Bridge aus der Datenbank
            Optional<HueDiscoveredBridge> bridgeOpt = bridgeRepository.findById(bridgeId);
            if (!bridgeOpt.isPresent()) {
                ApiRouter.sendResponse(exchange, 404,
                    gson.toJson(Map.of("error", "Bridge mit ID '" + bridgeId + "' nicht in Datenbank gefunden. Bitte zuerst Discovery durchführen.")));
                return;
            }
            
            HueDiscoveredBridge bridge = bridgeOpt.get();
            String bridgeIp = bridge.getBestConnectionAddress();
            int port = bridge.getPort();
            
            if (bridgeIp == null || bridgeIp.isEmpty()) {
                ApiRouter.sendResponse(exchange, 400,
                    gson.toJson(Map.of("error", "Keine gültige IP-Adresse für Bridge '" + bridgeId + "' gefunden")));
                return;
            }
            
            logger.info("Bridge gefunden: {} -> {}:{}", bridgeId, bridgeIp, port);
            
            // Führe Pairing durch (POST https://{bridgeIp}:{port}/api)
            String apiUrl = "https://" + bridgeIp + ":" + port + "/api";
            URI uri = new URI(apiUrl);
            
            // Erstelle SSLContext, der alle Zertifikate akzeptiert
            TrustManager[] trustAllCerts = new TrustManager[] {
                new X509TrustManager() {
                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                    
                    @Override
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {
                        // Akzeptiere alle Client-Zertifikate
                    }
                    
                    @Override
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {
                        // Akzeptiere alle Server-Zertifikate
                    }
                }
            };
            
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
            
            // Erstelle HTTPS-Verbindung mit dem Trust-All SSLContext
            HttpsURLConnection connection = (HttpsURLConnection) uri.toURL().openConnection();
            connection.setSSLSocketFactory(sslContext.getSocketFactory());
            connection.setHostnameVerifier((hostname, session) -> true); // Akzeptiere alle Hostnamen
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000); // 10 Sekunden Timeout für Pairing
            connection.setReadTimeout(30000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            
            // Erstelle Request-Body gemäß Hue API (Standard-Werte)
            JsonObject payload = new JsonObject();
            payload.addProperty("devicetype", "smarthome-backend#server");
            payload.addProperty("generateclientkey", true);
            
            String payloadString = payload.toString();
            logger.debug("Pairing-Request an {}: {}", apiUrl, payloadString);
            
            // Sende Request
            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = payloadString.getBytes(StandardCharsets.UTF_8);
                os.write(input);
            }
            
            int status = connection.getResponseCode();
            InputStream is = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
            
            StringBuilder responseBuilder = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    responseBuilder.append(line);
                }
            }
            
            String responseBody = responseBuilder.toString();
            logger.debug("Pairing-Antwort von Bridge {}: HTTP {} {}", bridgeIp, status, responseBody);
            
            // Parse Response (Array mit success/error-Objekten)
            JsonArray responseArray;
            try {
                JsonElement jsonElement = gson.fromJson(responseBody, JsonElement.class);
                if (jsonElement.isJsonArray()) {
                    responseArray = jsonElement.getAsJsonArray();
                } else {
                    ApiRouter.sendResponse(exchange, 500,
                        gson.toJson(Map.of("error", "Ungültige Antwort-Format: Erwartet JSON-Array")));
                    return;
                }
            } catch (Exception parseEx) {
                ApiRouter.sendResponse(exchange, 500,
                    gson.toJson(Map.of("error", "Fehler beim Parsen der Bridge-Antwort: " + parseEx.getMessage() + " (Response: " + responseBody + ")")));
                return;
            }
            
            // Prüfe Response auf Success/Error
            PairingResult result = new PairingResult();
            result.setHttpStatus(status);
            result.setRawResponse(responseBody);
            
            for (JsonElement element : responseArray) {
                if (element.isJsonObject()) {
                    JsonObject obj = element.getAsJsonObject();
                    
                    // Prüfe auf Success
                    if (obj.has("success")) {
                        JsonObject successObj = obj.getAsJsonObject("success");
                        String username = null;
                        String clientKey = null;
                        
                        if (successObj.has("username")) {
                            username = successObj.get("username").getAsString();
                            result.setSuccess(true);
                            result.setUsername(username);
                            logger.info("Pairing erfolgreich: Bridge {} -> Username: {}", bridgeId, username);
                        }
                        if (successObj.has("clientkey")) {
                            clientKey = successObj.get("clientkey").getAsString();
                            result.setClientKey(clientKey);
                            logger.info("Client-Key erhalten: {}", clientKey.substring(0, Math.min(10, clientKey.length())) + "...");
                        }
                        
                        // Aktualisiere Bridge mit Pairing-Informationen (beide Werte)
                        if (username != null) {
                            bridge.setIsPaired(true);
                            bridge.setUsername(username);
                            if (clientKey != null) {
                                bridge.setClientKey(clientKey);
                            }
                            
                            // Speichere aktualisierte Bridge in der Datenbank
                            try {
                                bridgeRepository.save(bridgeId, bridge);
                                logger.info("Bridge {} erfolgreich als gepaart gespeichert (username: {}, clientKey: {})", 
                                    bridgeId, username, clientKey != null ? clientKey.substring(0, Math.min(10, clientKey.length())) + "..." : "null");
                                
                                // Aktualisiere Bridge auch im Hue-Modul
                                updateBridgeInModule(bridgeId, bridge);
                                
                            } catch (Exception saveEx) {
                                logger.error("Fehler beim Speichern der Pairing-Informationen für Bridge {}", bridgeId, saveEx);
                                // Fehler beim Speichern ist nicht kritisch, Pairing war erfolgreich
                            }
                        }
                    }
                    
                    // Prüfe auf Error
                    if (obj.has("error")) {
                        JsonObject errorObj = obj.getAsJsonObject("error");
                        int errorType = errorObj.has("type") ? errorObj.get("type").getAsInt() : -1;
                        String errorDescription = errorObj.has("description") 
                            ? errorObj.get("description").getAsString() 
                            : "Unbekannter Fehler";
                        
                        result.setError(true);
                        result.setErrorType(errorType);
                        result.setErrorDescription(errorDescription);
                        
                        logger.warn("Pairing-Fehler: Bridge {} -> Type: {}, Description: {}", 
                            bridgeId, errorType, errorDescription);
                    }
                }
            }

            
            // Erstelle Response
            Map<String, Object> response = new java.util.HashMap<>();
            response.put("success", result.isSuccess());
            if (result.isSuccess()) {
                response.put("username", result.getUsername());
                if (result.getClientKey() != null) {
                    response.put("clientKey", result.getClientKey());
                }
                onPairingSuccess.run();
            } else {
                response.put("error", result.getErrorDescription());
                response.put("errorType", result.getErrorType());
            }
            response.put("httpStatus", result.getHttpStatus());
            
            ApiRouter.sendResponse(exchange, 200, gson.toJson(response));
            
        } catch (Exception e) {
            logger.error("Fehler beim Pairing mit der Hue Bridge {}", bridgeId, e);
            ApiRouter.sendResponse(exchange, 500,
                gson.toJson(Map.of("error", "Fehler beim Pairing mit der Hue Bridge: " + e.getMessage())));
        }
    }
    
    /**
     * Aktualisiert die Bridge im Hue-Modul nach erfolgreichem Pairing.
     * 
     * @param bridgeId Die ID der Bridge
     * @param bridge Das aktualisierte Bridge-Objekt
     */
    private void updateBridgeInModule(String bridgeId, HueDiscoveredBridge bridge) {
        if (moduleRepository == null) {
            logger.debug("ModuleRepository nicht initialisiert - Bridge wird nicht im Modul aktualisiert");
            return;
        }
        
        try {
            String moduleId = "hue";
            Optional<Module> moduleOpt = moduleRepository.findById(moduleId);
            
            if (!moduleOpt.isPresent()) {
                logger.debug("Hue-Modul nicht in Datenbank gefunden - Bridge wird nicht im Modul aktualisiert");
                return;
            }
            
            Module module = moduleOpt.get();
            
            // Initialisiere moduleData falls null
            if (module.getModuleData() == null) {
                module.setModuleData(new java.util.HashMap<>());
            }
            
            // Hole Liste der Bridges aus moduleData und deserialisiere sie korrekt
            List<HueDiscoveredBridge> bridges = new ArrayList<>();
            Object bridgesObj = module.getModuleData().get("bridges");
            
            if (bridgesObj != null) {
                // Deserialisiere die Liste - Gson gibt LinkedTreeMap zurück, daher müssen wir konvertieren
                if (bridgesObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Object> bridgesList = (List<Object>) bridgesObj;
                    for (Object bridgeObj : bridgesList) {
                        if (bridgeObj instanceof HueDiscoveredBridge) {
                            bridges.add((HueDiscoveredBridge) bridgeObj);
                        } else {
                            // Konvertiere LinkedTreeMap zu HueDiscoveredBridge mit Gson
                            String bridgeJson = gson.toJson(bridgeObj);
                            HueDiscoveredBridge deserializedBridge = gson.fromJson(bridgeJson, HueDiscoveredBridge.class);
                            bridges.add(deserializedBridge);
                        }
                    }
                }
            }
            
            // Suche nach der Bridge in der Liste und aktualisiere sie
            boolean found = false;
            for (int i = 0; i < bridges.size(); i++) {
                HueDiscoveredBridge existingBridge = bridges.get(i);
                if (existingBridge != null && bridgeId.equals(existingBridge.getBridgeId())) {
                    // Aktualisiere die Bridge in der Liste
                    bridges.set(i, bridge);
                    found = true;
                    logger.debug("Bridge {} im Hue-Modul aktualisiert", bridgeId);
                    break;
                }
            }
            
            // Falls Bridge nicht in der Liste gefunden wurde, füge sie hinzu
            if (!found) {
                bridges.add(bridge);
                logger.debug("Bridge {} zum Hue-Modul hinzugefügt", bridgeId);
            }
            
            // Speichere aktualisierte Liste im Modul
            module.getModuleData().put("bridges", bridges);
            moduleRepository.save(moduleId, module);
            
            logger.info("Bridge {} erfolgreich im Hue-Modul aktualisiert", bridgeId);
            
        } catch (Exception e) {
            logger.warn("Fehler beim Aktualisieren der Bridge {} im Hue-Modul: {}", bridgeId, e.getMessage());
        }
    }

    /**
     * Erstellt EventStreamManager für alle gepaarten Bridges.
     * Lädt alle Bridges aus der Datenbank und erstellt für jede gepaarte Bridge
     * einen HueModuleEventStreamManager.
     * 
     * @param actionManager Der ActionManager für Device-Zugriff
     * @return Liste der erstellten ModuleEventStreamManager
     */
    public List<ModuleEventStreamManager> createEventStreamManager(ActionManager actionManager) {
        List<ModuleEventStreamManager> managers = new ArrayList<>();
        
        if (bridgeRepository == null || databaseManager == null || actionManager == null) {
            logger.warn("Kann EventStreamManager nicht erstellen: bridgeRepository, databaseManager oder actionManager ist null");
            return managers;
        }
        
        try {
            // Lade alle Bridges aus der Datenbank
            List<HueDiscoveredBridge> bridges = bridgeRepository.findAll();
            
            logger.info("Lade {} Bridges aus der Datenbank für EventStreamManager-Erstellung", bridges.size());
            
            // Erstelle für jede gepaarte Bridge einen EventStreamManager
            for (HueDiscoveredBridge bridge : bridges) {
                if (bridge == null || bridge.getBridgeId() == null) {
                    continue;
                }
                
                // Prüfe, ob die Bridge gepaart ist
                if (bridge.getIsPaired() == null || !bridge.getIsPaired()) {
                    logger.debug("Bridge {} ist nicht gepaart, überspringe EventStreamManager-Erstellung", bridge.getBridgeId());
                    continue;
                }
                
                // Prüfe, ob die Bridge einen Username hat (notwendig für Event-Stream)
                if (bridge.getUsername() == null || bridge.getUsername().isEmpty()) {
                    logger.debug("Bridge {} hat keinen Username, überspringe EventStreamManager-Erstellung", bridge.getBridgeId());
                    continue;
                }
                
                try {
                    // Erstelle EventStreamManager für diese Bridge
                    HueModuleEventStreamManager eventStreamManager = 
                        new HueModuleEventStreamManager(bridge.getBridgeId(), actionManager, databaseManager);
                    managers.add(eventStreamManager);
                    logger.info("EventStreamManager für gepaarte Bridge {} erstellt", bridge.getBridgeId());
                } catch (Exception e) {
                    logger.error("Fehler beim Erstellen des EventStreamManagers für Bridge {}", bridge.getBridgeId(), e);
                }
            }
            
            logger.info("{} EventStreamManager für gepaarte Bridges erstellt", managers.size());
        } catch (Exception e) {
            logger.error("Fehler beim Laden der Bridges aus der Datenbank für EventStreamManager-Erstellung", e);
        }
        
        return managers;
    }
    
    /**
     * Ergebnis-Klasse für den Pairing-Vorgang.
     */
    public static class PairingResult {
        private boolean success = false;
        private boolean error = false;
        private String username;
        private String clientKey;
        private int errorType;
        private String errorDescription;
        private int httpStatus;
        private String rawResponse;
        
        public boolean isSuccess() {
            return success;
        }
        
        public void setSuccess(boolean success) {
            this.success = success;
        }
        
        public boolean isError() {
            return error;
        }
        
        public void setError(boolean error) {
            this.error = error;
        }
        
        public String getUsername() {
            return username;
        }
        
        public void setUsername(String username) {
            this.username = username;
        }
        
        public String getClientKey() {
            return clientKey;
        }
        
        public void setClientKey(String clientKey) {
            this.clientKey = clientKey;
        }
        
        public int getErrorType() {
            return errorType;
        }
        
        public void setErrorType(int errorType) {
            this.errorType = errorType;
        }
        
        public String getErrorDescription() {
            return errorDescription;
        }
        
        public void setErrorDescription(String errorDescription) {
            this.errorDescription = errorDescription;
        }
        
        public int getHttpStatus() {
            return httpStatus;
        }
        
        public void setHttpStatus(int httpStatus) {
            this.httpStatus = httpStatus;
        }
        
        public String getRawResponse() {
            return rawResponse;
        }
        
        public void setRawResponse(String rawResponse) {
            this.rawResponse = rawResponse;
        }
    }
}


