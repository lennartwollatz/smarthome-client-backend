package com.smarthome.backend.server.api.modules.hue;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;

/**
 * Controller für die Ausführung von Aktionen auf Hue-Geräten.
 * Verwaltet Verbindungen zu Hue Bridges und bietet Funktionen
 * zum Abrufen von Sensor-Daten (Battery, Temperature, Light Level, Motion).
 * 
 * Der Controller ist NICHT für die Speicherung von Geräten zuständig.
 */
public class HueDeviceController {
    private static final Logger logger = LoggerFactory.getLogger(HueDeviceController.class);
    private static final Gson gson = new Gson();
    
    private final Repository<HueDiscoveredBridge> bridgeRepository;
    private final ExecutorService executorService;
    
    /**
     * Cache für Bridges, um wiederholte Datenbankabfragen zu vermeiden.
     * Key: bridgeId, Value: HueDiscoveredBridge
     */
    private final ConcurrentHashMap<String, HueDiscoveredBridge> bridgeCache = new ConcurrentHashMap<>();
    
    /**
     * Einfaches Request-Rate-Limit:
     * Maximal 10 Requests pro Sekunde über alle Threads.
     */
    private final Object rateLimitLock = new Object();
    private long rateWindowStartMillis = 0L;
    private int requestsInCurrentWindow = 0;
    
    /**
     * Konstruktor ohne DatabaseManager (für Rückwärtskompatibilität).
     */
    public HueDeviceController() {
        this.bridgeRepository = null;
        this.executorService = Executors.newCachedThreadPool();
    }
    
    /**
     * Konstruktor mit DatabaseManager für persistente Speicherung.
     */
    public HueDeviceController(DatabaseManager databaseManager) {
        if (databaseManager != null) {
            this.bridgeRepository = new JsonRepository<>(databaseManager, HueDiscoveredBridge.class);
        } else {
            this.bridgeRepository = null;
        }
        this.executorService = Executors.newCachedThreadPool();
    }
    
    /**
     * Blockiert, bis ein Request-Token verfügbar ist.
     * Erzwingt maximal 10 Requests pro Sekunde.
     */
    private void acquireRequestPermit() {
        while (true) {
            long waitTimeMillis = 0L;
            
            synchronized (rateLimitLock) {
                long now = System.currentTimeMillis();
                
                // Neues Zeitfenster starten, falls älter als 1 Sekunde
                if (now - rateWindowStartMillis >= 1000L) {
                    rateWindowStartMillis = now;
                    requestsInCurrentWindow = 0;
                }
                
                if (requestsInCurrentWindow < 5) {
                    // Token verfügbar
                    requestsInCurrentWindow++;
                    return;
                } else {
                    // Kein Token verfügbar -> ausrechnen, wie lange bis zum nächsten Fenster
                    waitTimeMillis = 1000L - (now - rateWindowStartMillis);
                    if (waitTimeMillis <= 0L) {
                        // Sicherheits-Fallback: direkt neues Fenster starten
                        rateWindowStartMillis = now;
                        requestsInCurrentWindow = 1;
                        return;
                    }
                }
            }
            
            // Außerhalb des Locks schlafen, damit andere Threads weiterzählen können
            try {
                Thread.sleep(waitTimeMillis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                logger.warn("Rate-Limit-Wartezeit unterbrochen", e);
                return;
            }
        }
    }
    
    /**
     * Erstellt einen SSLContext, der alle Zertifikate akzeptiert.
     */
    private SSLContext createTrustAllSSLContext() throws Exception {
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
        return sslContext;
    }
    
    /**
     * Ruft Bridge-Informationen aus dem Cache oder der Datenbank ab.
     * Verwendet Caching, um wiederholte Datenbankabfragen zu vermeiden.
     */
    private CompletableFuture<HueDiscoveredBridge> getBridge(String bridgeId) {
        // Prüfe zuerst den Cache
        HueDiscoveredBridge cachedBridge = bridgeCache.get(bridgeId);
        if (cachedBridge != null) {
            return CompletableFuture.completedFuture(cachedBridge);
        }
        
        // Falls nicht im Cache, lade aus der Datenbank
        return CompletableFuture.supplyAsync(() -> {
            if (bridgeRepository == null) {
                throw new RuntimeException("DatabaseManager nicht initialisiert");
            }
            
            Optional<HueDiscoveredBridge> bridgeOpt = bridgeRepository.findById(bridgeId);
            if (!bridgeOpt.isPresent()) {
                throw new RuntimeException("Bridge mit ID '" + bridgeId + "' nicht gefunden");
            }
            
            HueDiscoveredBridge bridge = bridgeOpt.get();
            if (!bridge.getIsPaired()) {
                throw new RuntimeException("Bridge '" + bridgeId + "' ist nicht gepaart");
            }
            
            String username = bridge.getUsername();
            if (username == null || username.isEmpty()) {
                throw new RuntimeException("Bridge '" + bridgeId + "' hat keinen Username");
            }
            
            // Speichere im Cache für zukünftige Anfragen
            bridgeCache.put(bridgeId, bridge);
            
            return bridge;
        }, executorService);
    }
    
    /**
     * Invalidiert den Cache für eine bestimmte Bridge.
     * Sollte aufgerufen werden, wenn sich Bridge-Daten geändert haben.
     * 
     * @param bridgeId Die ID der Bridge, deren Cache-Eintrag entfernt werden soll
     */
    public void invalidateBridgeCache(String bridgeId) {
        bridgeCache.remove(bridgeId);
        logger.debug("Bridge-Cache für {} invalidiert", bridgeId);
    }
    
    /**
     * Leert den gesamten Bridge-Cache.
     * Sollte aufgerufen werden, wenn sich mehrere Bridges geändert haben.
     */
    public void clearBridgeCache() {
        bridgeCache.clear();
        logger.debug("Bridge-Cache geleert");
    }
    
    /**
     * Führt einen PUT-Request an die Hue Bridge API aus.
     */
    private CompletableFuture<JsonObject> updateResource(String bridgeId, String resourceType, String resourceId, JsonObject data) {
        return getBridge(bridgeId)
            .thenCompose(bridge -> {
                try {
                    // Rate-Limit prüfen (max. 10 Requests pro Sekunde)
                    acquireRequestPermit();
                    
                    String bridgeIp = bridge.getBestConnectionAddress();
                    int port = bridge.getPort();
                    String username = bridge.getUsername();
                    
                    if (bridgeIp == null || bridgeIp.isEmpty()) {
                        throw new RuntimeException("Keine gültige IP-Adresse für Bridge '" + bridgeId + "'");
                    }
                    
                    String baseUrl = "https://" + bridgeIp + ":" + port + "/clip/v2/resource";
                    String resourceUrl = baseUrl + "/" + resourceType + "/" + resourceId;
                    
                    SSLContext sslContext = createTrustAllSSLContext();
                    
                    URI uri = new URI(resourceUrl);
                    HttpsURLConnection connection = (HttpsURLConnection) uri.toURL().openConnection();
                    connection.setSSLSocketFactory(sslContext.getSocketFactory());
                    connection.setHostnameVerifier((hostname, session) -> true);
                    connection.setRequestMethod("PUT");
                    connection.setConnectTimeout(5000);
                    connection.setReadTimeout(5000);
                    connection.setRequestProperty("hue-application-key", username);
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.setDoOutput(true);
                    
                    // Sende Request-Body
                    String dataString = gson.toJson(data);
                    try (java.io.OutputStream os = connection.getOutputStream()) {
                        byte[] input = dataString.getBytes(StandardCharsets.UTF_8);
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
                    
                    if (status != 200) {
                        throw new RuntimeException("HTTP " + status + ": " + responseBody);
                    }
                    
                    // Parse Response (Format: {"data": [...], "errors": [...]})
                    JsonObject responseJson = gson.fromJson(responseBody, JsonObject.class);
                    if (responseJson.has("data") && responseJson.get("data").isJsonArray()) {
                        JsonArray dataArray = responseJson.getAsJsonArray("data");
                        if (dataArray.size() > 0) {
                            JsonElement firstElement = dataArray.get(0);
                            if (firstElement.isJsonObject()) {
                                return CompletableFuture.completedFuture(firstElement.getAsJsonObject());
                            }
                        }
                    }
                    
                    throw new RuntimeException("Keine Daten in der Response");
                    
                } catch (Exception e) {
                    return CompletableFuture.failedFuture(e);
                }
            });
    }
    
    /**
     * Ruft alle Resources eines bestimmten Typs von der Hue Bridge ab.
     * 
     * @param bridgeId Die ID der Bridge
     * @param resourceType Der Typ der Resource (z.B. "device", "light", "motion")
     * @return CompletableFuture mit einer Liste aller Resource-Objekte
     */
    public CompletableFuture<List<JsonObject>> fetchAllResources(String bridgeId, String resourceType) {
        return getBridge(bridgeId)
            .thenCompose(bridge -> {
                try {
                    // Rate-Limit prüfen (max. 5 Requests pro Sekunde)
                    acquireRequestPermit();
                    
                    String bridgeIp = bridge.getBestConnectionAddress();
                    int port = bridge.getPort();
                    String username = bridge.getUsername();
                    
                    if (bridgeIp == null || bridgeIp.isEmpty()) {
                        throw new RuntimeException("Keine gültige IP-Adresse für Bridge '" + bridgeId + "'");
                    }
                    
                    String baseUrl = "https://" + bridgeIp + ":" + port + "/clip/v2/resource";
                    String resourceUrl = baseUrl + "/" + resourceType;
                    
                    SSLContext sslContext = createTrustAllSSLContext();
                    
                    URI uri = new URI(resourceUrl);
                    HttpsURLConnection connection = (HttpsURLConnection) uri.toURL().openConnection();
                    connection.setSSLSocketFactory(sslContext.getSocketFactory());
                    connection.setHostnameVerifier((hostname, session) -> true);
                    connection.setRequestMethod("GET");
                    connection.setConnectTimeout(10000);
                    connection.setReadTimeout(10000);
                    connection.setRequestProperty("hue-application-key", username);
                    connection.setRequestProperty("Content-Type", "application/json");
                    
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
                    
                    if (status != 200) {
                        throw new RuntimeException("HTTP " + status + ": " + responseBody);
                    }
                    
                    // Parse Response (Format: {"data": [...], "errors": [...]})
                    JsonObject responseJson = gson.fromJson(responseBody, JsonObject.class);
                    List<JsonObject> objects = new java.util.ArrayList<>();
                    
                    if (responseJson.has("data") && responseJson.get("data").isJsonArray()) {
                        JsonArray dataArray = responseJson.getAsJsonArray("data");
                        for (JsonElement element : dataArray) {
                            if (element.isJsonObject()) {
                                objects.add(element.getAsJsonObject());
                            }
                        }
                    }
                    
                    // Prüfe auf Fehler in der Response
                    if (responseJson.has("errors") && responseJson.get("errors").isJsonArray()) {
                        JsonArray errorsArray = responseJson.getAsJsonArray("errors");
                        if (errorsArray.size() > 0) {
                            logger.warn("API-Fehler beim Abrufen von {}: {}", resourceType, errorsArray);
                        }
                    }
                    
                    return CompletableFuture.completedFuture(objects);
                    
                } catch (Exception e) {
                    return CompletableFuture.failedFuture(e);
                }
            });
    }
    
    /**
     * Ruft ein einzelnes Resource-Objekt von der Hue Bridge ab.
     * 
     * @param bridgeId Die ID der Bridge
     * @param resourceType Der Typ der Resource (z.B. "motion", "light", "temperature")
     * @param resourceId Die ID der Resource
     * @return CompletableFuture mit dem Resource-Objekt oder null wenn nicht gefunden
     */
    public CompletableFuture<JsonObject> fetchSingleResource(String bridgeId, String resourceType, String resourceId) {
        return fetchAllResources(bridgeId, resourceType + "/" + resourceId)
            .thenApply(objects -> {
                if (objects != null && !objects.isEmpty()) {
                    return objects.get(0);
                }
                return null;
            });
    }
    
    /**
     * Führt einen GET-Request an die Hue Bridge API aus.
     */
    private CompletableFuture<JsonObject> fetchResource(String bridgeId, String resourceType, String resourceId) {
        return getBridge(bridgeId)
            .thenCompose(bridge -> {
                try {
                    // Rate-Limit prüfen (max. 10 Requests pro Sekunde)
                    acquireRequestPermit();
                    
                    String bridgeIp = bridge.getBestConnectionAddress();
                    int port = bridge.getPort();
                    String username = bridge.getUsername();
                    
                    if (bridgeIp == null || bridgeIp.isEmpty()) {
                        throw new RuntimeException("Keine gültige IP-Adresse für Bridge '" + bridgeId + "'");
                    }
                    
                    String baseUrl = "https://" + bridgeIp + ":" + port + "/clip/v2/resource";
                    String resourceUrl = baseUrl + "/" + resourceType + "/" + resourceId;
                    
                    SSLContext sslContext = createTrustAllSSLContext();
                    
                    URI uri = new URI(resourceUrl);
                    HttpsURLConnection connection = (HttpsURLConnection) uri.toURL().openConnection();
                    connection.setSSLSocketFactory(sslContext.getSocketFactory());
                    connection.setHostnameVerifier((hostname, session) -> true);
                    connection.setRequestMethod("GET");
                    connection.setConnectTimeout(5000);
                    connection.setReadTimeout(5000);
                    connection.setRequestProperty("hue-application-key", username);
                    connection.setRequestProperty("Content-Type", "application/json");
                    
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
                    
                    if (status != 200) {
                        throw new RuntimeException("HTTP " + status + ": " + responseBody);
                    }
                    
                    // Parse Response (Format: {"data": [...], "errors": [...]})
                    JsonObject responseJson = gson.fromJson(responseBody, JsonObject.class);
                    if (responseJson.has("data") && responseJson.get("data").isJsonArray()) {
                        JsonArray dataArray = responseJson.getAsJsonArray("data");
                        if (dataArray.size() > 0) {
                            JsonElement firstElement = dataArray.get(0);
                            if (firstElement.isJsonObject()) {
                                return CompletableFuture.completedFuture(firstElement.getAsJsonObject());
                            }
                        }
                    }
                    
                    throw new RuntimeException("Keine Daten in der Response");
                    
                } catch (Exception e) {
                    return CompletableFuture.failedFuture(e);
                }
            });
    }
    
    /**
     * Ruft den Batteriestatus eines Hue-Geräts ab.
     * 
     * @param device Das Hue-Gerät (HueMotionSensor, HueLightLevelSensor, HueTemperatureSensor)
     * @return CompletableFuture mit dem Batteriestatus (0-100) oder null wenn nicht verfügbar
     */
    public CompletableFuture<Integer> getBattery(HueMotionSensor device) {
        return getBattery(device.getBridgeId(), device.getBatteryRid());
    }
    
    /**
     * Ruft den Batteriestatus eines Hue-Geräts ab.
     * 
     * @param device Das Hue-Gerät (HueLightLevelSensor)
     * @return CompletableFuture mit dem Batteriestatus (0-100) oder null wenn nicht verfügbar
     */
    public CompletableFuture<Integer> getBattery(HueLightLevelSensor device) {
        return getBattery(device.getBridgeId(), device.getBatteryRid());
    }
    
    /**
     * Ruft den Batteriestatus eines Hue-Geräts ab.
     * 
     * @param device Das Hue-Gerät (HueTemperatureSensor)
     * @return CompletableFuture mit dem Batteriestatus (0-100) oder null wenn nicht verfügbar
     */
    public CompletableFuture<Integer> getBattery(HueTemperatureSensor device) {
        return getBattery(device.getBridgeId(), device.getBatteryRid());
    }
    
    /**
     * Ruft den Batteriestatus eines Hue-Geräts ab.
     * 
     * @param bridgeId Die ID der Bridge
     * @param batteryRid Die Resource ID der Batterie
     * @return CompletableFuture mit dem Batteriestatus (0-100) oder null wenn nicht verfügbar
     */
    public CompletableFuture<Integer> getBattery(String bridgeId, String batteryRid) {
        if (batteryRid == null || batteryRid.isEmpty()) {
            return CompletableFuture.completedFuture(null);
        }
        
        return fetchResource(bridgeId, "device_power", batteryRid)
            .thenApply(resourceObj -> {
                try {
                    if (resourceObj.has("power_state") && resourceObj.get("power_state").isJsonObject()) {
                        JsonObject powerState = resourceObj.getAsJsonObject("power_state");
                        if (powerState.has("battery_level")) {
                            return powerState.get("battery_level").getAsInt();
                        }
                    }
                    return null;
                } catch (Exception e) {
                    logger.error("Fehler beim Parsen des Batteriestatus", e);
                    return null;
                }
            })
            .exceptionally(e -> {
                logger.error("Fehler beim Abrufen des Batteriestatus: {}", e.getMessage());
                return null;
            });
    }
    
    /**
     * Ruft die Temperatur eines HueTemperatureSensors ab.
     * 
     * @param device Der HueTemperatureSensor
     * @return CompletableFuture mit der Temperatur (in Grad Celsius) oder null bei Fehlern
     */
    public CompletableFuture<Integer> getTemperature(HueTemperatureSensor device) {
        return fetchResource(device.getBridgeId(), "temperature", device.getHueResourceId())
            .thenApply(resourceObj -> {
                try {
                    if (resourceObj.has("temperature") && resourceObj.get("temperature").isJsonObject()) {
                        JsonObject temperatureData = resourceObj.getAsJsonObject("temperature");
                        if (temperatureData.has("temperature_report") && temperatureData.get("temperature_report").isJsonObject()) {
                            JsonObject temperatureReport = temperatureData.getAsJsonObject("temperature_report");
                            if (temperatureReport.has("temperature")) {
                                // Hue API gibt Temperatur in mired zurück, muss zu Celsius konvertiert werden
                                // Formel: temperature_celsius = (temperature_mired - 2000) / 100
                                // Oder direkt in Celsius, je nach API-Version
                                return temperatureReport.get("temperature").getAsInt();
                            }
                        }
                    }
                    return null;
                } catch (Exception e) {
                    logger.error("Fehler beim Parsen der Temperatur", e);
                    return null;
                }
            })
            .exceptionally(e -> {
                logger.error("Fehler beim Abrufen der Temperatur für Sensor {}: {}", device.getId(), e.getMessage());
                return null;
            });
    }
    
    /**
     * Ruft den Helligkeitswert eines HueLightLevelSensors ab.
     * 
     * @param device Der HueLightLevelSensor
     * @return CompletableFuture mit dem Helligkeitswert oder null bei Fehlern
     */
    public CompletableFuture<Integer> getLightLevel(HueLightLevelSensor device) {
        return fetchResource(device.getBridgeId(), "light_level", device.getHueResourceId())
            .thenApply(resourceObj -> {
                try {
                    if (resourceObj.has("light") && resourceObj.get("light").isJsonObject()) {
                        JsonObject lightData = resourceObj.getAsJsonObject("light");
                        if (lightData.has("light_level_report") && lightData.get("light_level_report").isJsonObject()) {
                            JsonObject lightLevelReport = lightData.getAsJsonObject("light_level_report");
                            if (lightLevelReport.has("light_level")) {
                                return lightLevelReport.get("light_level").getAsInt();
                            }
                        }
                    }
                    return null;
                } catch (Exception e) {
                    logger.error("Fehler beim Parsen des Helligkeitswerts", e);
                    return null;
                }
            })
            .exceptionally(e -> {
                logger.error("Fehler beim Abrufen des Helligkeitswerts für Sensor {}: {}", device.getId(), e.getMessage());
                return null;
            });
    }
    
    /**
     * Datenklasse für Motion-Status mit Bewegungsstatus und letztem Änderungszeitpunkt.
     */
    public static class MotionStatus {
        private final Boolean motion;
        private final String lastChanged;
        
        public MotionStatus(Boolean motion, String lastChanged) {
            this.motion = motion;
            this.lastChanged = lastChanged;
        }
        
        public Boolean getMotion() {
            return motion;
        }
        
        public String getLastChanged() {
            return lastChanged;
        }
    }
    
    /**
     * Ruft den Bewegungsstatus eines HueMotionSensors ab.
     * 
     * @param device Der HueMotionSensor
     * @return CompletableFuture mit MotionStatus (Bewegungsstatus und letzter Änderungszeitpunkt) oder null bei Fehlern
     */
    public CompletableFuture<MotionStatus> getMotion(HueMotionSensor device) {
        return fetchResource(device.getBridgeId(), "motion", device.getHueResourceId())
            .thenApply(resourceObj -> {
                try {
                    Boolean motion = null;
                    String lastChanged = null;
                    
                    if (resourceObj.has("motion") && resourceObj.get("motion").isJsonObject()) {
                        JsonObject motionData = resourceObj.getAsJsonObject("motion");
                        if (motionData.has("motion_report") && motionData.get("motion_report").isJsonObject()) {
                            JsonObject motionReport = motionData.getAsJsonObject("motion_report");
                            if (motionReport.has("motion")) {
                                motion = motionReport.get("motion").getAsBoolean();
                            }
                            if (motionReport.has("changed")) {
                                lastChanged = motionReport.get("changed").getAsString();
                            }
                        }
                    }
                    
                    if (motion != null || lastChanged != null) {
                        return new MotionStatus(motion, lastChanged);
                    }
                    return null;
                } catch (Exception e) {
                    logger.error("Fehler beim Parsen des Bewegungsstatus", e);
                    return null;
                }
            })
            .exceptionally(e -> {
                logger.error("Fehler beim Abrufen des Bewegungsstatus für Sensor {}: {}", device.getId(), e.getMessage());
                return null;
            });
    }
    
    /**
     * Ruft die Empfindlichkeit eines HueMotionSensors ab.
     * 
     * @param device Der HueMotionSensor
     * @return CompletableFuture mit der Empfindlichkeit (0-100) oder null bei Fehlern
     */
    public CompletableFuture<Integer> getSensibility(HueMotionSensor device) {
        return fetchResource(device.getBridgeId(), "motion", device.getHueResourceId())
            .thenApply(resourceObj -> {
                try {
                    if (resourceObj.has("sensitivity") && resourceObj.get("sensitivity").isJsonObject()) {
                        JsonObject sensitivityData = resourceObj.getAsJsonObject("sensitivity");
                        if (sensitivityData.has("sensitivity")) {
                            return sensitivityData.get("sensitivity").getAsInt();
                        }
                    }
                    return null;
                } catch (Exception e) {
                    logger.error("Fehler beim Parsen der Empfindlichkeit", e);
                    return null;
                }
            })
            .exceptionally(e -> {
                logger.error("Fehler beim Abrufen der Empfindlichkeit für Sensor {}: {}", device.getId(), e.getMessage());
                return null;
            });
    }
    
    /**
     * Setzt die Empfindlichkeit eines HueMotionSensors.
     * 
     * @param device Der HueMotionSensor
     * @param sensitivity Die neue Empfindlichkeit (0-100)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Empfindlichkeit gesetzt wurde
     */
    public CompletableFuture<Void> setSensibility(HueMotionSensor device, int sensitivity) {
        logger.debug("Setze Empfindlichkeit für Motion-Sensor {} auf {}", device.getId(), sensitivity);
        
        // Erstelle JSON-Objekt für den Update-Request
        JsonObject sensitivityData = new JsonObject();
        sensitivityData.addProperty("sensitivity", sensitivity);
        
        JsonObject updateData = new JsonObject();
        updateData.addProperty("enabled", true);
        updateData.add("sensitivity", sensitivityData);
        updateData.addProperty("type", "motion");
        
        return updateResource(device.getBridgeId(), "motion", device.getHueResourceId(), updateData)
            .thenRun(() -> {
                logger.debug("Empfindlichkeit für Motion-Sensor {} erfolgreich auf {} gesetzt", device.getId(), sensitivity);
            })
            .exceptionally(e -> {
                logger.error("Fehler beim Setzen der Empfindlichkeit für Sensor {}: {}", device.getId(), e.getMessage());
                throw new RuntimeException("Fehler beim Setzen der Empfindlichkeit", e);
            });
    }
    
    // ========== Private Hilfsmethoden für Light-Operationen ==========
    
    /**
     * Schaltet ein Light ein oder aus.
     * 
     * @param bridgeId Die ID der Bridge
     * @param hueResourceId Die Resource ID des Lights
     * @param on true zum Einschalten, false zum Ausschalten
     * @return CompletableFuture, das abgeschlossen wird, wenn das Licht gesetzt wurde
     */
    private CompletableFuture<Void> setLightOnOff(String bridgeId, String hueResourceId, boolean on) {
        JsonObject onData = new JsonObject();
        onData.addProperty("on", on);
        
        JsonObject updateData = new JsonObject();
        updateData.add("on", onData);
        
        return updateResource(bridgeId, "light", hueResourceId, updateData)
            .thenRun(() -> {
                logger.debug("Light {} erfolgreich {}", hueResourceId, on ? "eingeschaltet" : "ausgeschaltet");
            })
            .exceptionally(e -> {
                logger.error("Fehler beim {} von Light {}: {}", on ? "Einschalten" : "Ausschalten", hueResourceId, e.getMessage());
                throw new RuntimeException("Fehler beim " + (on ? "Einschalten" : "Ausschalten") + " des Lichts", e);
            });
    }

    
    /**
     * Setzt die Helligkeit eines Lights.
     * 
     * @param bridgeId Die ID der Bridge
     * @param hueResourceId Die Resource ID des Lights
     * @param brightness Die neue Helligkeit (0-100)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Helligkeit gesetzt wurde
     */
    private CompletableFuture<Void> setLightBrightness(String bridgeId, String hueResourceId, int brightness) {
        JsonObject dimmingData = new JsonObject();
        dimmingData.addProperty("brightness", brightness);
        
        JsonObject updateData = new JsonObject();
        updateData.add("dimming", dimmingData);
        
        return updateResource(bridgeId, "light", hueResourceId, updateData)
            .thenRun(() -> {
                logger.debug("Helligkeit für Light {} erfolgreich auf {} gesetzt", hueResourceId, brightness);
            })
            .exceptionally(e -> {
                logger.error("Fehler beim Setzen der Helligkeit für Light {}: {}", hueResourceId, e.getMessage());
                throw new RuntimeException("Fehler beim Setzen der Helligkeit", e);
            });
    }
    
    /**
     * Setzt die Farbe eines Lights.
     * 
     * @param bridgeId Die ID der Bridge
     * @param hueResourceId Die Resource ID des Lights
     * @param x Die x-Komponente der Farbe (0-10000, wird zu 0.0-1.0 konvertiert)
     * @param y Die y-Komponente der Farbe (0-10000, wird zu 0.0-1.0 konvertiert)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Farbe gesetzt wurde
     */
    private CompletableFuture<Void> setLightColor(String bridgeId, String hueResourceId, double x, double y) {
        JsonObject xyData = new JsonObject();
        // Werte sind bereits 0.0-1.0, runden auf 3 Nachkommastellen
        double roundedX = Math.round(x * 1000.0) / 1000.0;
        double roundedY = Math.round(y * 1000.0) / 1000.0;
        xyData.addProperty("x", roundedX);
        xyData.addProperty("y", roundedY);
        
        JsonObject colorData = new JsonObject();
        colorData.add("xy", xyData);
        
        JsonObject updateData = new JsonObject();
        updateData.add("color", colorData);
        
        return updateResource(bridgeId, "light", hueResourceId, updateData)
            .thenRun(() -> {
                logger.debug("Farbe für Light {} erfolgreich auf ({}, {}) gesetzt", hueResourceId, roundedX, roundedY);
            })
            .exceptionally(e -> {
                logger.error("Fehler beim Setzen der Farbe für Light {}: {}", hueResourceId, e.getMessage());
                throw new RuntimeException("Fehler beim Setzen der Farbe", e);
            });
    }
    
    /**
     * Setzt die Farbtemperatur eines Lights.
     * 
     * @param bridgeId Die ID der Bridge
     * @param hueResourceId Die Resource ID des Lights
     * @param temperature Die neue Farbtemperatur (in mirek)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Farbtemperatur gesetzt wurde
     */
    private CompletableFuture<Void> setLightTemperature(String bridgeId, String hueResourceId, int temperature) {
        JsonObject colorTemperatureData = new JsonObject();
        colorTemperatureData.addProperty("mirek", temperature);
        
        JsonObject updateData = new JsonObject();
        updateData.add("color_temperature", colorTemperatureData);
        
        return updateResource(bridgeId, "light", hueResourceId, updateData)
            .thenRun(() -> {
                logger.debug("Farbtemperatur für Light {} erfolgreich auf {} gesetzt", hueResourceId, temperature);
            })
            .exceptionally(e -> {
                logger.error("Fehler beim Setzen der Farbtemperatur für Light {}: {}", hueResourceId, e.getMessage());
                throw new RuntimeException("Fehler beim Setzen der Farbtemperatur", e);
            });
    }
    
    // ========== HueLight Methoden ==========
    
    /**
     * Schaltet ein HueLight ein.
     * 
     * @param device Das HueLight
     * @return CompletableFuture, das abgeschlossen wird, wenn das Licht eingeschaltet wurde
     */
    public CompletableFuture<Void> setOn(HueLight device) {
        logger.debug("Schalte HueLight {} ein", device.getId());
        return setLightOnOff(device.getBridgeId(), device.getHueResourceId(), true);
    }
    
    /**
     * Schaltet ein HueLight aus.
     * 
     * @param device Das HueLight
     * @return CompletableFuture, das abgeschlossen wird, wenn das Licht ausgeschaltet wurde
     */
    public CompletableFuture<Void> setOff(HueLight device) {
        logger.debug("Schalte HueLight {} aus", device.getId());
        return setLightOnOff(device.getBridgeId(), device.getHueResourceId(), false);
    }
    
    // ========== HueLightDimmer Methoden ==========
    
    /**
     * Schaltet ein HueLightDimmer ein.
     * 
     * @param device Das HueLightDimmer
     * @return CompletableFuture, das abgeschlossen wird, wenn das Licht eingeschaltet wurde
     */
    public CompletableFuture<Void> setOn(HueLightDimmer device) {
        logger.debug("Schalte HueLightDimmer {} ein", device.getId());
        return setLightOnOff(device.getBridgeId(), device.getHueResourceId(), true);
    }
    
    /**
     * Schaltet ein HueLightDimmer aus.
     * 
     * @param device Das HueLightDimmer
     * @return CompletableFuture, das abgeschlossen wird, wenn das Licht ausgeschaltet wurde
     */
    public CompletableFuture<Void> setOff(HueLightDimmer device) {
        logger.debug("Schalte HueLightDimmer {} aus", device.getId());
        return setLightOnOff(device.getBridgeId(), device.getHueResourceId(), false);
    }
    
    /**
     * Setzt die Helligkeit eines HueLightDimmer.
     * 
     * @param device Das HueLightDimmer
     * @param brightness Die neue Helligkeit (0-100)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Helligkeit gesetzt wurde
     */
    public CompletableFuture<Void> setBrightness(HueLightDimmer device, int brightness) {
        logger.debug("Setze Helligkeit für HueLightDimmer {} auf {}", device.getId(), brightness);
        return setLightBrightness(device.getBridgeId(), device.getHueResourceId(), brightness);
    }
    
    // ========== HueLightDimmerTemperatureColor Methoden ==========
    
    /**
     * Schaltet ein HueLightDimmerTemperatureColor ein.
     * 
     * @param device Das HueLightDimmerTemperatureColor
     * @return CompletableFuture, das abgeschlossen wird, wenn das Licht eingeschaltet wurde
     */
    public CompletableFuture<Void> setOn(HueLightDimmerTemperatureColor device) {
        logger.debug("Schalte HueLightDimmerTemperatureColor {} ein", device.getId());
        return setLightOnOff(device.getBridgeId(), device.getHueResourceId(), true);
    }
    
    /**
     * Schaltet ein HueLightDimmerTemperatureColor aus.
     * 
     * @param device Das HueLightDimmerTemperatureColor
     * @return CompletableFuture, das abgeschlossen wird, wenn das Licht ausgeschaltet wurde
     */
    public CompletableFuture<Void> setOff(HueLightDimmerTemperatureColor device) {
        logger.debug("Schalte HueLightDimmerTemperatureColor {} aus", device.getId());
        return setLightOnOff(device.getBridgeId(), device.getHueResourceId(), false);
    }
    
    /**
     * Setzt die Helligkeit eines HueLightDimmerTemperatureColor.
     * 
     * @param device Das HueLightDimmerTemperatureColor
     * @param brightness Die neue Helligkeit (0-100)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Helligkeit gesetzt wurde
     */
    public CompletableFuture<Void> setBrightness(HueLightDimmerTemperatureColor device, int brightness) {
        logger.debug("Setze Helligkeit für HueLightDimmerTemperatureColor {} auf {}", device.getId(), brightness);
        return setLightBrightness(device.getBridgeId(), device.getHueResourceId(), brightness);
    }
    
    /**
     * Setzt die Farbe eines HueLightDimmerTemperatureColor.
     * 
     * @param device Das HueLightDimmerTemperatureColor
     * @param x Die x-Komponente der Farbe (0.0-1.0)
     * @param y Die y-Komponente der Farbe (0.0-1.0)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Farbe gesetzt wurde
     */
    public CompletableFuture<Void> setColor(HueLightDimmerTemperatureColor device, double x, double y) {
        logger.debug("Setze Farbe für HueLightDimmerTemperatureColor {} auf ({}, {})", device.getId(), x, y);
        return setLightColor(device.getBridgeId(), device.getHueResourceId(), x, y);
    }
    
    /**
     * Setzt die Farbtemperatur eines HueLightDimmerTemperatureColor.
     * 
     * @param device Das HueLightDimmerTemperatureColor
     * @param temperature Die neue Farbtemperatur (in mirek)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Farbtemperatur gesetzt wurde
     */
    public CompletableFuture<Void> setTemperature(HueLightDimmerTemperatureColor device, int temperature) {
        logger.debug("Setze Farbtemperatur für HueLightDimmerTemperatureColor {} auf {}", device.getId(), temperature);
        return setLightTemperature(device.getBridgeId(), device.getHueResourceId(), temperature);
    }
    
    // ========== HueLightDimmerTemperature Methoden ==========
    
    /**
     * Schaltet ein HueLightDimmerTemperature ein.
     * 
     * @param device Das HueLightDimmerTemperature
     * @return CompletableFuture, das abgeschlossen wird, wenn das Licht eingeschaltet wurde
     */
    public CompletableFuture<Void> setOn(HueLightDimmerTemperature device) {
        logger.debug("Schalte HueLightDimmerTemperature {} ein", device.getId());
        return setLightOnOff(device.getBridgeId(), device.getHueResourceId(), true);
    }
    
    /**
     * Schaltet ein HueLightDimmerTemperature aus.
     * 
     * @param device Das HueLightDimmerTemperature
     * @return CompletableFuture, das abgeschlossen wird, wenn das Licht ausgeschaltet wurde
     */
    public CompletableFuture<Void> setOff(HueLightDimmerTemperature device) {
        logger.debug("Schalte HueLightDimmerTemperature {} aus", device.getId());
        return setLightOnOff(device.getBridgeId(), device.getHueResourceId(), false);
    }
    
    /**
     * Setzt die Helligkeit eines HueLightDimmerTemperature.
     * 
     * @param device Das HueLightDimmerTemperature
     * @param brightness Die neue Helligkeit (0-100)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Helligkeit gesetzt wurde
     */
    public CompletableFuture<Void> setBrightness(HueLightDimmerTemperature device, int brightness) {
        logger.debug("Setze Helligkeit für HueLightDimmerTemperature {} auf {}", device.getId(), brightness);
        return setLightBrightness(device.getBridgeId(), device.getHueResourceId(), brightness);
    }
    
    /**
     * Setzt die Farbtemperatur eines HueLightDimmerTemperature.
     * 
     * @param device Das HueLightDimmerTemperature
     * @param temperature Die neue Farbtemperatur (in mirek)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Farbtemperatur gesetzt wurde
     */
    public CompletableFuture<Void> setTemperature(HueLightDimmerTemperature device, int temperature) {
        logger.debug("Setze Farbtemperatur für HueLightDimmerTemperature {} auf {}", device.getId(), temperature);
        return setLightTemperature(device.getBridgeId(), device.getHueResourceId(), temperature);
    }
    
    /**
     * Setzt die Farbe eines HueLightDimmerTemperature.
     * 
     * @param device Das HueLightDimmerTemperature
     * @param x Die x-Komponente der Farbe (0.0-1.0)
     * @param y Die y-Komponente der Farbe (0.0-1.0)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Farbe gesetzt wurde
     */
    public CompletableFuture<Void> setColor(HueLightDimmerTemperature device, double x, double y) {
        logger.debug("Setze Farbe für HueLightDimmerTemperature {} auf ({}, {})", device.getId(), x, y);
        return setLightColor(device.getBridgeId(), device.getHueResourceId(), x, y);
    }
    
    /**
     * Schließt alle Ressourcen.
     */
    public void shutdown() {
        if (executorService != null) {
            executorService.shutdown();
        }
    }
}

