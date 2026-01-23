package com.smarthome.backend.server.api.modules.xiaomi;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;

/**
 * Fuehrt eine Xiaomi MiIO Discovery ueber das Python-Skript discover.py aus.
 * Die Ausgabe wird als JSON geparst und als {@link XiaomiDiscoveredDevice} gespeichert.
 */
public class XiaomiDiscover {
    private static final Logger logger = LoggerFactory.getLogger(XiaomiDiscover.class);
    private static final Gson gson = new Gson();

    private final Repository<XiaomiDiscoveredDevice> xiaomiDiscoveredDeviceRepository;

    public XiaomiDiscover(DatabaseManager databaseManager) {
        this.xiaomiDiscoveredDeviceRepository = new JsonRepository<>(databaseManager, XiaomiDiscoveredDevice.class);
    }

    /**
     * Fuehrt die Discovery durch und liefert gefundene Xiaomi-Geraete zurueck.
     *
     * @param username Xiaomi Cloud Benutzername
     * @param password Xiaomi Cloud Passwort
     * @return Set der gefundenen Geraete
     */
    public Set<XiaomiDiscoveredDevice> discover(String username, String password) {
        logger.info("Starte Xiaomi MiIO Discovery via discover.py");

        Set<XiaomiDiscoveredDevice> devices = new HashSet<>();
        Path scriptPath = Paths.get("scripts", "miio", "discover.py").toAbsolutePath();
        ProcessBuilder processBuilder = new ProcessBuilder(
            "python",
            scriptPath.toString(),
            "--username",
            username,
            "--password",
            password
        );
        processBuilder.redirectErrorStream(true);

        String output = null;
        try {
            Process process = processBuilder.start();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    logger.info("Xiaomi discover.py output: {}", line);
                    String trimmed = line.trim();
                    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                        output = trimmed;
                    }
                }
            }
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                logger.error("discover.py beendet mit Exit-Code {}", exitCode);
            }
        } catch (java.io.IOException e) {
            logger.error("Fehler beim Starten von discover.py", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.error("discover.py wurde unterbrochen", e);
        }

        if (output == null || output.isEmpty()) {
            logger.warn("Xiaomi Discovery hat keine Daten geliefert");
            return devices;
        }

        try {
            JsonObject root = gson.fromJson(output, JsonObject.class);
            if (root == null || !root.has("ok") || !root.get("ok").getAsBoolean()) {
                logger.warn("Xiaomi Discovery meldet Fehler: {}", output);
                return devices;
            }

            JsonArray deviceArray = root.has("devices") ? root.getAsJsonArray("devices") : new JsonArray();
            for (int i = 0; i < deviceArray.size(); i++) {
                JsonObject dev = deviceArray.get(i).getAsJsonObject();
                String name = getString(dev, "name");
                String model = getString(dev, "model");
                String token = getString(dev, "token");
                String ip = getString(dev, "ip");
                String mac = getString(dev, "mac");
                String did = getString(dev, "did");
                String locale = getString(dev, "locale");
                String status = getString(dev, "status");

                String id = buildDeviceId(did, ip, name);
                XiaomiDiscoveredDevice device = new XiaomiDiscoveredDevice(id, name, model, token, ip, mac, did, locale, status);
                devices.add(device);
                xiaomiDiscoveredDeviceRepository.save(device.getId(), device);
            }
        } catch (JsonSyntaxException | IllegalStateException e) {
            logger.warn("Fehler beim Parsen der Xiaomi Discovery Ausgabe: {}", e.getMessage());
        }

        logger.info("Xiaomi Discovery beendet: {} Geraete gefunden", devices.size());
        return devices;
    }

    private static String getString(JsonObject obj, String key) {
        if (obj != null && obj.has(key) && !obj.get(key).isJsonNull()) {
            return obj.get(key).getAsString();
        }
        return null;
    }

    private static String buildDeviceId(String did, String ip, String name) {
        if (did != null && !did.isEmpty()) {
            return "xiaomi-" + did;
        }
        if (ip != null && !ip.isEmpty()) {
            return "xiaomi-" + ip;
        }
        if (name != null && !name.isEmpty()) {
            return "xiaomi-" + name.replaceAll("\\s+", "-").toLowerCase();
        }
        return "xiaomi-" + UUID.randomUUID();
    }
}

