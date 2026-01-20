package com.smarthome.backend.server.api.modules.hue;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.cert.X509Certificate;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

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
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.model.devices.DeviceLight;
import com.smarthome.backend.model.devices.DeviceLightDimmer;
import com.smarthome.backend.model.devices.DeviceLightDimmerTemperature;
import com.smarthome.backend.model.devices.DeviceLightDimmerTemperatureColor;
import com.smarthome.backend.model.devices.DeviceLightLevel;
import com.smarthome.backend.model.devices.DeviceMotion;
import com.smarthome.backend.model.devices.DeviceSwitch;
import com.smarthome.backend.model.devices.DeviceTemperature;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.modules.Module;
import com.smarthome.backend.server.api.modules.ModuleEventStreamManager;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;

/**
 * EventStreamManager für Hue Bridges.
 * Verwaltet den Event-Stream für eine spezifische Hue Bridge und verarbeitet Events.
 */
public class HueModuleEventStreamManager implements ModuleEventStreamManager {
    private static final Logger logger = LoggerFactory.getLogger(HueModuleEventStreamManager.class);
    private static final Gson gson = new Gson();
    
    private final String bridgeId;
    private final ActionManager actionManager;
    private final Repository<HueDiscoveredBridge> bridgeRepository;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private Thread eventStreamThread;
    private HttpsURLConnection connection;
    private BufferedReader reader;
    
    /**
     * Konstruktor.
     * 
     * @param bridgeId Die ID der Bridge, für die der Event-Stream verwaltet werden soll
     * @param actionManager Der ActionManager für Device-Zugriff
     * @param databaseManager Der DatabaseManager für Bridge-Zugriff
     */
    public HueModuleEventStreamManager(String bridgeId, ActionManager actionManager, DatabaseManager databaseManager) {
        this.bridgeId = bridgeId;
        this.actionManager = actionManager;
        this.bridgeRepository = new JsonRepository<>(databaseManager, HueDiscoveredBridge.class);
    }
    
    @Override
    public void start() throws Exception {
        logger.info("Starte EventStream für Bridge {}", bridgeId);
        if (running.get()) {
            logger.warn("EventStream für Bridge {} läuft bereits", bridgeId);
            return;
        }
        
        Optional<HueDiscoveredBridge> bridgeOpt = bridgeRepository.findById(bridgeId);
        if (bridgeOpt.isEmpty()) {
            throw new Exception("Bridge mit ID '" + bridgeId + "' nicht gefunden");
        }
        
        HueDiscoveredBridge bridge = bridgeOpt.get();
        
        if (!bridge.getIsPaired() || bridge.getUsername() == null) {
            throw new Exception("Bridge '" + bridgeId + "' ist nicht gepaart");
        }
        
        String bridgeIp = bridge.getBestConnectionAddress();
        int port = bridge.getPort();
        String username = bridge.getUsername();
        
        if (bridgeIp == null || bridgeIp.isEmpty()) {
            throw new Exception("Keine gültige IP-Adresse für Bridge '" + bridgeId + "'");
        }
        
        logger.info("Starte EventStream für Bridge {} ({}:{})", bridgeId, bridgeIp, port);
        
        running.set(true);
        
        // Starte EventStream in separatem Thread
        eventStreamThread = new Thread(() -> {
            try {
                startEventStream(bridgeIp, port, username);
            } catch (Exception e) {
                logger.error("Fehler im EventStream für Bridge {}", bridgeId, e);
                running.set(false);
            }
        }, "HueEventStream-" + bridgeId);
        
        eventStreamThread.start();
    }
    
    @Override
    public void stop() throws Exception {
        if (!running.get()) {
            logger.debug("EventStream für Bridge {} läuft nicht", bridgeId);
            return;
        }
        
        logger.info("Stoppe EventStream für Bridge {}", bridgeId);
        running.set(false);
        
        // Schließe Verbindung
        if (reader != null) {
            try {
                reader.close();
            } catch (IOException e) {
                logger.debug("Fehler beim Schließen des EventStream-Readers", e);
            }
        }
        
        if (connection != null) {
            connection.disconnect();
        }
        
        // Warte auf Thread-Ende
        if (eventStreamThread != null && eventStreamThread.isAlive()) {
            try {
                eventStreamThread.interrupt();
                eventStreamThread.join(5000);
            } catch (InterruptedException e) {
                logger.warn("Warten auf EventStream-Thread wurde unterbrochen", e);
                Thread.currentThread().interrupt();
            }
        }
        
        logger.info("EventStream für Bridge {} gestoppt", bridgeId);
    }
    
    @Override
    public boolean isRunning() {
        return running.get();
    }
    
    @Override
    public String getModuleId() {
        return Module.HUE.getModuleId();
    }
    
    @Override
    public String getManagerId() {
        return bridgeId;
    }
    
    @Override
    public String getDescription() {
        return "Hue EventStream für Bridge " + bridgeId;
    }
    
    /**
     * Startet den EventStream für die Bridge.
     */
    private void startEventStream(String bridgeIp, int port, String username) {
        logger.info("Starte EventStream für Bridge {} ({}:{})", bridgeId, bridgeIp, port);
        try {
            // Erstelle SSLContext, der alle Zertifikate akzeptiert
            SSLContext sslContext = SSLContext.getInstance("TLS");
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
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
            
            // Erstelle HTTPS-Verbindung zum Eventstream-Endpoint
            String eventStreamUrl = "https://" + bridgeIp + ":" + port + "/eventstream/clip/v2";
            URI uri = new URI(eventStreamUrl);
            connection = (HttpsURLConnection) uri.toURL().openConnection();
            connection.setSSLSocketFactory(sslContext.getSocketFactory());
            connection.setHostnameVerifier((hostname, session) -> true);
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(0); // Kein Timeout für Eventstream
            connection.setRequestProperty("hue-application-key", username);
            connection.setRequestProperty("Accept", "text/event-stream");
            
            logger.debug("Verbinde mit Eventstream: {}", eventStreamUrl);
            
            int status = connection.getResponseCode();
            if (status != 200) {
                logger.error("Eventstream-Verbindung fehlgeschlagen für Bridge {}: HTTP {}", bridgeId, status);
                running.set(false);
                return;
            }
            
            logger.info("Eventstream verbunden für Bridge {}", bridgeId);
            
            // Lese Eventstream (Server-Sent Events)
            reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
            
            String line;
            StringBuilder eventData = new StringBuilder();
            
            while (running.get() && (line = reader.readLine()) != null) {
                if (line.startsWith("data:")) {
                    String data = line.substring(5).trim();
                    eventData.append(data);
                    
                    // Wenn die Datenzeile mit ] endet, ist das Event vollständig
                    if (data.endsWith("]")) {
                        processEventData(eventData.toString());
                        eventData.setLength(0);
                    }
                } else if (line.isEmpty()) {
                    // Leere Zeile markiert Ende eines Events
                    if (eventData.length() > 0) {
                        processEventData(eventData.toString());
                        eventData.setLength(0);
                    }
                }
            }
            
        } catch (Exception e) {
            if (running.get()) {
                logger.error("Fehler im Eventstream für Bridge {}: {}", bridgeId, e.getMessage(), e);
            }
        } finally {
            if (reader != null) {
                try {
                    reader.close();
                } catch (IOException e) {
                    logger.debug("Fehler beim Schließen des Eventstream-Readers", e);
                }
            }
            if (connection != null) {
                connection.disconnect();
            }
            running.set(false);
            logger.info("Eventstream für Bridge {} beendet", bridgeId);
        }
    }
    
    /**
     * Verarbeitet Event-Daten vom Eventstream.
     * Die Event-Daten enthalten ein Array von Events, wobei jedes Event ein data-Array mit mehreren Updates haben kann.
     */
    private void processEventData(String eventDataJson) {
        logger.info("Verarbeite Eventstream-Daten");
        try {
            JsonArray events = gson.fromJson(eventDataJson, JsonArray.class);
            
            if (events != null) {
                for (JsonElement eventElement : events) {
                    if (eventElement.isJsonObject()) {
                        JsonObject event = eventElement.getAsJsonObject();
                        // Jedes Event kann ein data-Array mit mehreren Updates enthalten
                        if (event.has("data") && event.get("data").isJsonArray()) {
                            JsonArray dataArray = event.getAsJsonArray("data");
                            for (JsonElement dataElement : dataArray) {
                                if (dataElement.isJsonObject()) {
                                    JsonObject data = dataElement.getAsJsonObject();
                                    handleEventStreamEvent(data);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            logger.warn("Fehler beim Parsen von Event-Daten für Bridge {}: {}", bridgeId, e.getMessage());
        }
    }
    
    /**
     * Verarbeitet ein einzelnes Update vom Eventstream und aktualisiert das entsprechende Gerät.
     * Jedes Update enthält die Device-ID (id) und den Resource-Typ (type).
     * 
     * @param eventData Das Event-Daten-Objekt mit den geänderten Eigenschaften eines Geräts
     */
    private void handleEventStreamEvent(JsonObject eventData) {
        logger.info("Event-Daten: {}", eventData.toString());
        try {
            // Im data-Array findet sich unter id die Device-ID und unter type der resourceType
            String resourceType = eventData.has("type") ? eventData.get("type").getAsString() : null;
            String resourceId = null;
            
            // Bei Buttons wird die ID anders ermittelt (z.B. aus owner.rid)
            if ("button".equals(resourceType)) {
                // Button-IDs werden aus einem anderen Feld extrahiert
                if (eventData.has("owner") && eventData.getAsJsonObject("owner").has("rid")) {
                    resourceId = eventData.getAsJsonObject("owner").get("rid").getAsString();
                } else if (eventData.has("id")) {
                    // Fallback auf id, falls owner.rid nicht vorhanden
                    resourceId = eventData.get("id").getAsString();
                }
            } else {
                // Für alle anderen Device-Typen wird die ID direkt aus "id" extrahiert
                resourceId = eventData.has("id") ? eventData.get("id").getAsString() : null;
            }
            
            if (resourceType == null || resourceId == null) {
                logger.debug("Event-Daten unvollständig: type={}, id={}", resourceType, resourceId);
                return;
            }
            
            logger.info("Verarbeite Eventstream: type={}, id={}", resourceType, resourceId);
            
            // Aktualisiere das Device basierend auf dem Event-Typ
            // Jede updateXYZFromEvent Methode ist für die Device-Suche, -Aktualisierung und -Speicherung verantwortlich
            if ("light".equals(resourceType)) {
                updateLightFromEvent(resourceId, eventData);
            } else if ("button".equals(resourceType)) {
                updateButtonFromEvent(resourceId, eventData);
            } else if ("motion".equals(resourceType)) {
                updateMotionSensorFromEvent(resourceId, eventData);
            } else if ("temperature".equals(resourceType)) {
                updateTemperatureSensorFromEvent(resourceId, eventData);
            } else if ("light_level".equals(resourceType)) {
                updateLightLevelSensorFromEvent(resourceId, eventData);
            }
            
        } catch (Exception e) {
            logger.error("Fehler beim Verarbeiten von Eventstream-Event", e);
        }
    }
    
    /**
     * Aktualisiert ein Light-Device basierend auf Event-Daten.
     * 
     * @param resourceId Die Resource-ID des Geräts
     * @param eventData Das Event-Daten-Objekt mit den geänderten Eigenschaften
     */
    private void updateLightFromEvent(String resourceId, JsonObject eventData) {
        // Hue-Lights haben IDs im Format "hue-light-{resourceId}"
        String deviceId = "hue-light-" + resourceId;
        
        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty()) {
            logger.info("Device {} nicht gefunden für Eventstream-Update", deviceId);
            return;
        }
        
        Device device = deviceOpt.get();
        if (!(device instanceof DeviceLight)) {
            logger.warn("Device {} ist kein DeviceLight", deviceId);
            return;
        }
        
        DeviceLight light = (DeviceLight) device;
        
        // Aktualisiere on/off Status
        if (eventData.has("on")) {
            com.google.gson.JsonObject onObj = eventData.getAsJsonObject("on");
            if (onObj.has("on")) {
                boolean isOn = onObj.get("on").getAsBoolean();
                if (isOn != light.on()) {
                    if (isOn) {
                        light.setOn(false);
                    } else {
                        light.setOff(false);
                    }
                }
            }
        }
        
        // Aktualisiere Brightness für dimmable lights
        if (device instanceof DeviceLightDimmer) {
            DeviceLightDimmer dimmer = (DeviceLightDimmer) device;
            
            if (eventData.has("dimming")) {
                com.google.gson.JsonObject dimmingObj = eventData.getAsJsonObject("dimming");
                if (dimmingObj.has("brightness")) {
                    double brightness = dimmingObj.get("brightness").getAsDouble();
                    int brightnessPercent = (int) Math.round(brightness);
                    if (!dimmer.brightnessEquals(brightnessPercent)) {
                        logger.info("Aktualisiere Brightness für Device {}: {}", device.getName(), brightnessPercent);
                        dimmer.setBrightness(brightnessPercent, false);
                    }
                }
            }
        }
        
        // Aktualisiere Color für color lights
        if (device instanceof DeviceLightDimmerTemperatureColor) {
            DeviceLightDimmerTemperatureColor colorLight = (DeviceLightDimmerTemperatureColor) device;
            
            if (eventData.has("color")) {
                com.google.gson.JsonObject colorObj = eventData.getAsJsonObject("color");
                if (colorObj.has("xy")) {
                    com.google.gson.JsonObject xyObj = colorObj.getAsJsonObject("xy");
                    if (xyObj.has("x") && xyObj.has("y")) {
                        double x = xyObj.get("x").getAsDouble();
                        double y = xyObj.get("y").getAsDouble();
                        // Runde auf 3 Dezimalstellen
                        x = Math.round(x * 1000.0) / 1000.0;
                        y = Math.round(y * 1000.0) / 1000.0;
                        logger.info("Aktualisiere Color für Device {}: x={}, y={}", device.getName(), x, y);
                        colorLight.setColor(x, y, false);
                    }
                }
            }
        }
        
        // Aktualisiere Temperature für temperature lights
        if (device instanceof DeviceLightDimmerTemperature) {
            DeviceLightDimmerTemperature tempLight = (DeviceLightDimmerTemperature) device;
            
            if (eventData.has("color_temperature")) {
                com.google.gson.JsonObject tempObj = eventData.getAsJsonObject("color_temperature");
                if (tempObj.has("mirek")) {
                    int mirek = tempObj.get("mirek").getAsInt();
                    if (!tempLight.temperatureEquals(mirek)) {
                        logger.info("Aktualisiere Temperature für Device {}: {}", device.getName(), mirek);
                        tempLight.setTemperature(mirek, false);
                    }
                }
            }
        }
        
        // Speichere aktualisiertes Device
        actionManager.saveDevice(device);
        logger.debug("Device {} erfolgreich aus Eventstream aktualisiert", deviceId);
    }
    
    /**
     * Aktualisiert ein Button-Device basierend auf Event-Daten.
     * Buttons haben eine andere ID-Struktur als andere Devices.
     * 
     * @param resourceId Die Resource-ID des Geräts
     * @param eventData Das Event-Daten-Objekt mit den geänderten Eigenschaften
     */
    private void updateButtonFromEvent(String resourceId, JsonObject eventData) {
        logger.info("Event-Daten: {}", eventData.toString());
        
        // Buttons haben IDs im Format "hue-button-{resourceId}" (andere Struktur als andere Devices)
        String deviceId = "hue-button-" + resourceId;
        
        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty()) {
            logger.info("Device {} nicht gefunden für Eventstream-Update", deviceId);
            return;
        }
        
        Device device = deviceOpt.get();
        if (!(device instanceof DeviceSwitch)) {
            logger.warn("Device {} ist kein DeviceSwitch", deviceId);
            return;
        }

        String buttonId = eventData.get("id").getAsString();
        
        DeviceSwitch switchDevice = (DeviceSwitch) device;
        
        // Beim Inhalt button.button_report.event = short_release oder long_release soll auf dem device die funktion toggle aufgerufen werden.
        if (eventData.has("button_report") && eventData.getAsJsonObject("button_report").has("event")) {
            String event = eventData.getAsJsonObject("button_report").get("event").getAsString();
            if (event.equals("short_release")) {
                // toggle benötigt die Button-ID (resourceId)
                switchDevice.toggle(buttonId, false);
            } else if (event.equals("long_release")) {
                switchDevice.toggle(buttonId, false);
            }
        }
        
        // Speichere aktualisiertes Device
        actionManager.saveDevice(device);
        logger.debug("Device {} erfolgreich aus Eventstream aktualisiert", deviceId);
    }
    
    /**
     * Aktualisiert einen Motion-Sensor basierend auf Event-Daten.
     * 
     * @param resourceId Die Resource-ID des Geräts
     * @param eventData Das Event-Daten-Objekt mit den geänderten Eigenschaften
     */
    private void updateMotionSensorFromEvent(String resourceId, JsonObject eventData) {
        // Motion-Sensoren haben IDs im Format "hue-motion-{resourceId}"
        String deviceId = "hue-motion-" + resourceId;
        
        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty()) {
            logger.info("Device {} nicht gefunden für Eventstream-Update", deviceId);
            return;
        }
        
        Device device = deviceOpt.get();
        if (!(device instanceof DeviceMotion)) {
            logger.warn("Device {} ist kein DeviceMotion", deviceId);
            return;
        }
        
        DeviceMotion motionSensor = (DeviceMotion) device;
        
        if (eventData.has("motion")) {
            com.google.gson.JsonObject motionObj = eventData.getAsJsonObject("motion");
            if (motionObj.has("motion_report")) {
                logger.info("Event-Daten: {}", motionObj.toString());
                com.google.gson.JsonObject motion_report = motionObj.get("motion_report").getAsJsonObject();
                if (motion_report.has("changed") && motion_report.has("motion")) {
                    Boolean motion = motion_report.get("motion").getAsBoolean();
                    String motionLastDetect = motion_report.get("changed").getAsString();
                    logger.info("Aktualisiere Motion für Device {}: {}", device.getName(), motion);
                    motionSensor.setMotion(motion, motionLastDetect, false);
                }
            }
        }
        
        // Speichere aktualisiertes Device
        actionManager.saveDevice(device);
        logger.debug("Device {} erfolgreich aus Eventstream aktualisiert", deviceId);
    }
    
    /**
     * Aktualisiert einen Temperature-Sensor basierend auf Event-Daten.
     * 
     * @param resourceId Die Resource-ID des Geräts
     * @param eventData Das Event-Daten-Objekt mit den geänderten Eigenschaften
     */
    private void updateTemperatureSensorFromEvent(String resourceId, JsonObject eventData) {
        // Temperature-Sensoren haben IDs im Format "hue-temperature-{resourceId}"
        String deviceId = "hue-temperature-" + resourceId;
        
        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty()) {
            logger.info("Device {} nicht gefunden für Eventstream-Update", deviceId);
            return;
        }
        
        Device device = deviceOpt.get();
        if (!(device instanceof DeviceTemperature)) {
            logger.warn("Device {} ist kein DeviceTemperature", deviceId);
            return;
        }
        
        DeviceTemperature tempSensor = (DeviceTemperature) device;
        
        if (eventData.has("temperature")) {
            com.google.gson.JsonObject tempObj = eventData.getAsJsonObject("temperature");
            if (tempObj.has("temperature")) {
                int temperature = (int) tempObj.get("temperature").getAsDouble();
                if (!tempSensor.temperatureEquals(temperature)) {
                    logger.info("Aktualisiere Temperature für Device {}: {}", device.getName(), temperature);
                    tempSensor.setTemperature(temperature, false);
                }
            }
        }
        
        // Speichere aktualisiertes Device
        actionManager.saveDevice(device);
        logger.debug("Device {} erfolgreich aus Eventstream aktualisiert", deviceId);
    }
    
    /**
     * Aktualisiert einen Light-Level-Sensor basierend auf Event-Daten.
     * 
     * @param resourceId Die Resource-ID des Geräts
     * @param eventData Das Event-Daten-Objekt mit den geänderten Eigenschaften
     */
    private void updateLightLevelSensorFromEvent(String resourceId, JsonObject eventData) {
        // Light-Level-Sensoren haben IDs im Format "hue-light_level-{resourceId}"
        String deviceId = "hue-light_level-" + resourceId;
        
        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty()) {
            logger.info("Device {} nicht gefunden für Eventstream-Update", deviceId);
            return;
        }
        
        Device device = deviceOpt.get();
        if (!(device instanceof DeviceLightLevel)) {
            logger.warn("Device {} ist kein DeviceLightLevel", deviceId);
            return;
        }
        
        DeviceLightLevel lightLevelSensor = (DeviceLightLevel) device;
        
        if (eventData.has("light")) {
            com.google.gson.JsonObject lightObj = eventData.getAsJsonObject("light");
            if (lightObj.has("light_level")) {
                int lightLevel = lightObj.get("light_level").getAsInt();
                if (!lightLevelSensor.levelEquals(lightLevel)) {
                    logger.info("Aktualisiere Light Level für Device {}: {}", device.getName(), lightLevel);
                    lightLevelSensor.setLevel(lightLevel, false);
                }
            }
        }
        
        // Speichere aktualisiertes Device
        actionManager.saveDevice(device);
        logger.debug("Device {} erfolgreich aus Eventstream aktualisiert", deviceId);
    }
}

