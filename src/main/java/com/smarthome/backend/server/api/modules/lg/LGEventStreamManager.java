package com.smarthome.backend.server.api.modules.lg;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.modules.Module;
import com.smarthome.backend.server.api.modules.ModuleEventStreamManager;

/**
 * EventStreamManager für LG TVs.
 * Ruft subscribe.py auf und verarbeitet Events für ein einzelnes Gerät.
 */
public class LGEventStreamManager implements ModuleEventStreamManager {
    private static final Logger logger = LoggerFactory.getLogger(LGEventStreamManager.class);

    private final String deviceId;
    private final ActionManager actionManager;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private Thread eventStreamThread;
    private Process process;

    public LGEventStreamManager(String deviceId, ActionManager actionManager) {
        this.deviceId = deviceId;
        this.actionManager = actionManager;
    }

    @Override
    public void start() throws Exception {
        if (running.get()) {
            logger.warn("LG EventStream für Gerät {} läuft bereits", deviceId);
            return;
        }
        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof LGTV)) {
            throw new Exception("LGTV mit ID '" + deviceId + "' nicht gefunden");
        }

        LGTV tv = (LGTV) deviceOpt.get();
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        if (address == null || address.isBlank()) {
            throw new Exception("Keine gültige IP-Adresse für LGTV '" + deviceId + "'");
        }
        if (clientKey == null || clientKey.isBlank()) {
            throw new Exception("Kein Client-Key für LGTV '" + deviceId + "'");
        }

        running.set(true);
        eventStreamThread = new Thread(() -> {
            try {
                startEventStream(address, clientKey);
            } catch (Exception e) {
                logger.error("Fehler im LG EventStream für Gerät {}", deviceId, e);
            } finally {
                running.set(false);
            }
        }, "LGEventStream-" + deviceId);
        eventStreamThread.start();
    }

    @Override
    public void stop() throws Exception {
        if (!running.get()) {
            return;
        }
        running.set(false);
        if (process != null) {
            process.destroy();
        }
        if (eventStreamThread != null && eventStreamThread.isAlive()) {
            try {
                eventStreamThread.interrupt();
                eventStreamThread.join(5000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    @Override
    public boolean isRunning() {
        return running.get();
    }

    @Override
    public String getModuleId() {
        return Module.LG.getModuleId();
    }

    @Override
    public String getManagerId() {
        return deviceId;
    }

    @Override
    public String getDescription() {
        return "LG EventStream für Gerät " + deviceId;
    }

    private void startEventStream(String address, String clientKey) throws Exception {
        Path scriptPath = Paths.get("scripts", "pywebostv", "subscribe.py").toAbsolutePath();
        ProcessBuilder processBuilder = new ProcessBuilder(
                "python",
                scriptPath.toString(),
                "--ip",
                address,
                "--client-key",
                clientKey,
                "--events",
                "all");
        processBuilder.redirectErrorStream(true);

        process = processBuilder.start();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while (running.get() && (line = reader.readLine()) != null) {
                handleEventLine(line);
            }
        }
    }

    private void handleEventLine(String line) {
        String trimmed = line.trim();
        if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
            logger.debug("LG EventStream ignoriert: {}", line);
            return;
        }
        JsonObject event;
        try {
            event = JsonParser.parseString(trimmed).getAsJsonObject();
        } catch (Exception e) {
            logger.debug("LG EventStream JSON ungültig: {}", line, e);
            return;
        }

        if (event.has("event") && "error".equals(event.get("event").getAsString())) {
            logger.warn("LG EventStream error: {}", event);
            return;
        }

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof LGTV)) {
            return;
        }
        LGTV tv = (LGTV) deviceOpt.get();

        String eventName = event.has("event") ? event.get("event").getAsString() : null;
        JsonElement payload = event.get("payload");
        if (eventName == null || payload == null || payload.isJsonNull()) {
            return;
        }

        switch (eventName) {
            case "app.current":
                String appId = extractAppId(payload);
                if (appId != null) {
                    tv.startApp(appId, false);
                    actionManager.saveDevice(tv);
                }
                break;
            case "channel.current":
                String channelId = extractChannelId(payload);
                if (channelId != null) {
                    tv.setChannel(channelId, false);
                    actionManager.saveDevice(tv);
                }
                break;
            default:
                break;
        }
    }

    private String extractAppId(JsonElement payload) {
        if (payload.isJsonPrimitive()) {
            return payload.getAsString();
        }
        if (payload.isJsonObject()) {
            JsonObject obj = payload.getAsJsonObject();
            if (obj.has("id")) {
                return obj.get("id").getAsString();
            }
            if (obj.has("appId")) {
                return obj.get("appId").getAsString();
            }
        }
        return null;
    }

    private String extractChannelId(JsonElement payload) {
        if (payload.isJsonPrimitive()) {
            return payload.getAsString();
        }
        if (payload.isJsonObject()) {
            JsonObject obj = payload.getAsJsonObject();
            if (obj.has("channelId")) {
                return obj.get("channelId").getAsString();
            }
            if (obj.has("id")) {
                return obj.get("id").getAsString();
            }
        }
        return null;
    }
}

