package com.smarthome.backend.server.api.modules.lg;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.smarthome.backend.model.devices.DeviceTV;

/**
 * Controller für die Ausführung von Aktionen auf LG-TV-Geräten.
 * <p>
 * Verwaltet WebOSClient-Verbindungen zu mehreren LG-TVs und stellt alle Controls
 * (Media, TV, System, Application, Input, Source) zur Verfügung.
 * <p>
 * Basiert auf der Python-Implementierung von pywebostv.
 */
public class LGController {
    private static final Logger logger = LoggerFactory.getLogger(LGController.class);

    public static Boolean register(LGTV tv) {
        Boolean connected = false;
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("register() für LGTV (address={})", address);
        if (clientKey != null) {
            return true;
        }
        if (address == null || address.isBlank()) {
            logger.warn("register() abgebrochen: Adresse fehlt ");
            return false;
        }

        Path scriptPath = Paths.get("scripts", "pywebostv", "register.py").toAbsolutePath();
        ProcessBuilder processBuilder = new ProcessBuilder(
                "python",
                scriptPath.toString(),
                "CONNECT",
                "--ip",
                address);
        processBuilder.redirectErrorStream(true);

        Pattern keyPattern = Pattern.compile("'client_key'\\s*:\\s*'([^']+)'");
        try {
            Process process = processBuilder.start();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.contains("Please accept the connect on the TV!")) {
                        logger.info("Pairing-Bestätigung am TV erforderlich ({})", address);
                    } else if (line.contains("Registration successful!")) {
                        logger.info("Registrierung erfolgreich ({})", address);
                    }
                    Matcher matcher = keyPattern.matcher(line);
                    if (matcher.find()) {
                        tv.setClientKey(matcher.group(1));
                        connected = true;
                    }
                }
            }

            int exitCode = process.waitFor();
            if (exitCode != 0) {
                logger.error("PyWebOSTV-Skript beendet mit Exit-Code {} für {}", exitCode, address);
            }
        } catch (java.io.IOException e) {
            logger.error("Fehler beim Starten des PyWebOSTV-Skripts für {}", address, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.error("PyWebOSTV-Skript wurde unterbrochen für {}", address, e);
        }
        return connected;
    }

    public static void powerOn(LGTV tv) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        String macAddress = tv.getMacAddress();
        logger.info("powerOn() für LGTV (address={})", address);
        if (macAddress == null || macAddress.isBlank()) {
            logger.warn("powerOn() abgebrochen: MAC-Adresse fehlt ");
            return;
        }
        String params = "{\"mac\":\"" + macAddress + "\"}";
        callController(address, clientKey, "wol", params);
    }

    public static void screenOn(LGTV tv) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("screenOn() für LGTV (address={})", address);
        callController(address, clientKey, "system.screen_on", null);
    }

    public static void screenOff(LGTV tv) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("screenOff() für LGTV (address={})", address);
        callController(address, clientKey, "system.screen_off", null);
    }

    public static void setVolume(LGTV tv, int volume) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("setVolume() für LGTV (address={}, volume={})", address, volume);
        if (clientKey == null) {
            logger.warn("setVolume() abgebrochen: Client-Key fehlt ");
            return;
        }
        if (volume < 1 || volume > 100) {
            logger.warn("setVolume() abgebrochen: Volume außerhalb Bereich (1-100): {}", volume);
            return;
        }
        callController(address, clientKey, "media.set_volume", String.valueOf(volume));
    }

    public static Integer getVolume(LGTV tv) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("getVolume() für LGTV (address={})", address);
        if (clientKey == null) {
            logger.warn("getVolume() abgebrochen: Client-Key fehlt ");
            return null;
        }
        JsonObject response = callController(address, clientKey, "media.get_volume", null);
        if (response == null) {
            return null;
        }
        if (response.has("status") && "error".equalsIgnoreCase(response.get("status").getAsString())) {
            logger.warn("getVolume() fehlgeschlagen: {}", response);
            return null;
        }
        JsonElement resultElement = response.get("result");
        if (resultElement == null || !resultElement.isJsonObject()) {
            return null;
        }
        JsonObject resultObj = resultElement.getAsJsonObject();
        if (!resultObj.has("volumeStatus")) {
            return null;
        }
        JsonObject volumeStatus = resultObj.get("volumeStatus").getAsJsonObject();
        if (volumeStatus == null || !volumeStatus.has("volume")) {
            return null;
        }
        try {
            return volumeStatus.get("volume").getAsInt();
        } catch (Exception e) {
            logger.warn("getVolume() Volume ungültig: {}", resultObj);
            return null;
        }
    }

    public static void powerOff(LGTV tv) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("powerOff() für LGTV (address={})", address);
        callController(address, clientKey, "system.power_off", null);

    }

    public static void setChannel(LGTV tv, String channelId) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("setChannel() für LGTV (address={})", address);
        if (clientKey == null) {
            logger.warn("setChannel() abgebrochen: Client-Key fehlt ");
            return;
        }
        String escapedChannelId = channelId
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
        String params = "\"" + escapedChannelId + "\"";
        callController(address, clientKey, "tv.set_channel_with_id", params);
    }

    public static void startApp(LGTV tv, String appId) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("startApp() für LGTV (address={})", address);
        if (clientKey == null) {
            logger.warn("startApp() abgebrochen: Client-Key fehlt ");
            return;
        }
        String escapedChannelId = appId
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
        String params = "\"" + escapedChannelId + "\"";
        callController(address, clientKey, "application.launch", params);
    }

    public static void notify(LGTV tv, String message) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("notify() für LGTV (address={})", address);
        if (message == null) {
            logger.warn("notify() abgebrochen: Nachricht fehlt ");
            return;
        }
        String escapedMessage = message
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
        String params = "{\"message\":\"" + escapedMessage + "\"}";
        callController(address, clientKey, "system.notify", params);
    }

    public static List<DeviceTV.Channel> getChannels(LGTV tv) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("getChannels() für LGTV (address={})", address);
        if (clientKey == null) {
            logger.warn("getChannels() abgebrochen: Client-Key fehlt ");
            return null;
        }
        JsonObject response = callController(address, clientKey, "tv.channel_list", null);
        return parseChannels(response);
    }

    public static List<DeviceTV.App> getApps(LGTV tv) {
        String address = tv.getAddress();
        String clientKey = tv.getClientKey();
        logger.info("getApps() für LGTV (address={})", address);
        if (clientKey == null) {
            logger.warn("getApps() abgebrochen: Client-Key fehlt ");
            return null;
        }
        JsonObject response = callController(address, clientKey, "application.list_apps", null);
        return parseApps(response);
    }

    private static List<DeviceTV.Channel> parseChannels(JsonObject response) {
        if (response == null) {
            return null;
        }
        if (response.has("status") && "error".equalsIgnoreCase(response.get("status").getAsString())) {
            logger.warn("getChannels() fehlgeschlagen: {}", response);
            return null;
        }

        JsonObject resultElement = response.getAsJsonObject("result");
        if (resultElement == null) {
            return null;
        }

        JsonArray channelArray = resultElement.getAsJsonArray("channelList");
        if (channelArray == null) {
            return null;
        } 

        List<DeviceTV.Channel> channels = new ArrayList<>();
        for (JsonElement element : channelArray) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject channelObj = element.getAsJsonObject();
            String id = null;
            String name = null;
            Integer channelNumber = null;
            String channelType = null;
            Boolean hd = null;
            String imgUrl = null;
            if (channelObj.has("channelId")) {
                id = channelObj.get("channelId").getAsString();
            } 
            if (channelObj.has("majorNumber")) {
                channelNumber = channelObj.get("majorNumber").getAsInt();
            }
            if (channelObj.has("channelMode")) {
                channelType = channelObj.get("channelMode").getAsString();
            }
            if (channelObj.has("HDTV")) {
                hd = channelObj.get("HDTV").getAsBoolean();
            }
            if (channelObj.has("channelName")) {
                name = channelObj.get("channelName").getAsString();
            } 
            if (channelObj.has("imgUrl")) {
                imgUrl = channelObj.get("imgUrl").getAsString();
            }
            channels.add(new DeviceTV.Channel(id, name, channelNumber, channelNumber, channelType, hd, imgUrl));
        }
        return channels;
    }

    private static List<DeviceTV.App> parseApps(JsonObject response) {
        if (response == null) {
            return null;
        }
        if (response.has("status") && "error".equalsIgnoreCase(response.get("status").getAsString())) {
            logger.warn("getApps() fehlgeschlagen: {}", response);
            return null;
        }

        JsonArray applications = response.getAsJsonArray("result");
        if (applications == null) {
            return null;
        }

        List<DeviceTV.App> appsArray = new ArrayList<>();
        
        for(JsonElement element : applications) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject appObj = element.getAsJsonObject();
            String id = null;
            String name = null;
            String imgUrl = null;
            if (appObj.has("id")) {
                id = appObj.get("id").getAsString();
            } else {
                continue;
            }
            if (appObj.has("title")) {
                name = appObj.get("title").getAsString();
            } else {
                continue;
            }
            if (appObj.has("icon")) {
                imgUrl = appObj.get("icon").getAsString();
            }
            appsArray.add(new DeviceTV.App(id, name, imgUrl, appsArray.size() + 1));
        }
        
        return appsArray;
    }
    
    private static JsonObject callController(String address, String clientKey, String event, String params) {
        boolean isWol = "wol".equalsIgnoreCase(event);
        if (!isWol && clientKey == null) {
            logger.warn("PyWebOSTV-Aufruf abgebrochen: Client-Key fehlt ");
            return null;
        }
        if (address == null || address.isBlank()) {
            logger.warn("PyWebOSTV-Aufruf abgebrochen: Adresse fehlt ");
            return null;
        }
        Path scriptPath = Paths.get("scripts", "pywebostv", "controller.py").toAbsolutePath();
        List<String> command = new ArrayList<>();
        command.add("python");
        command.add(scriptPath.toString());
        command.add("--ip");
        command.add(address);
        if (clientKey != null) {
            command.add("--client-key");
            command.add(clientKey);
        }
        command.add("--event");
        command.add(event);
        if (params != null) {
            command.add("--params");
            command.add(escapeArgIfWindows(params));
        }

        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(true);
        String lastJsonLine = null;
        try {
            Process process = processBuilder.start();

            try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    logger.info("PyWebOSTV-Skript output: {}", line);
                    String trimmed = line.trim();
                    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                        lastJsonLine = trimmed;
                    }
                }
            }

            int exitCode = process.waitFor();
            if (exitCode != 0) {
                logger.error("PyWebOSTV-Skript beendet mit Exit-Code {} für {}", exitCode, address);
            }
        } catch (java.io.IOException e) {
            logger.error("Fehler beim Starten des PyWebOSTV-Skripts für {}", address, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.error("PyWebOSTV-Skript wurde unterbrochen für {}", address, e);
        }
        if (lastJsonLine != null) {
            try {
                return JsonParser.parseString(lastJsonLine).getAsJsonObject();
            } catch (Exception e) {
                logger.warn("PyWebOSTV-Output ist kein gültiges JSON: {}", lastJsonLine, e);
            }
        }
        return null;
    }

    private static String escapeArgIfWindows(String value) {
        String osName = System.getProperty("os.name");
        if (osName != null && osName.toLowerCase().contains("win")) {
            return value.replace("\"", "\\\"");
        }
        return value;
    }

    public static String getSelectedApp(LGTV lgtv) {
        String address = lgtv.getAddress();
        String clientKey = lgtv.getClientKey();
        logger.info("getSelectedApp() für LGTV (address={})", address);
        if (clientKey == null) {
            logger.warn("getSelectedApp() abgebrochen: Client-Key fehlt ");
            return null;
        }
        JsonObject response = callController(address, clientKey, "application.get_current", null);
        if (response == null) {
            return null;
        }
        if (response.has("status") && "error".equalsIgnoreCase(response.get("status").getAsString())) {
            logger.warn("getSelectedApp() fehlgeschlagen: {}", response);
            return null;
        }
        JsonElement resultElement = response.get("result");
        if (resultElement == null) {
            return null;
        }
        return resultElement.getAsString();
    }

    public static String getSelectedChannel(LGTV lgtv) {
        String address = lgtv.getAddress();
        String clientKey = lgtv.getClientKey();
        logger.info("getSelectedChannel() für LGTV (address={})", address);
        if (clientKey == null) {
            logger.warn("getSelectedChannel() abgebrochen: Client-Key fehlt ");
            return null;
        }
        JsonObject response = callController(address, clientKey, "tv.get_current_channel", null);
        if (response == null) {
            return null;
        }
        if (response.has("status") && "error".equalsIgnoreCase(response.get("status").getAsString())) {
            logger.warn("getSelectedChannel() fehlgeschlagen: {}", response);
            return null;
        }
        JsonElement resultElement = response.get("result");
        if (resultElement == null) {
            return null;
        }
        if (resultElement.isJsonObject() && resultElement.getAsJsonObject().has("channelId")) {
            return resultElement.getAsJsonObject().get("channelId").getAsString();
        }
        return null;
    }

    public static Boolean getPower(LGTV lgtv) {
        return false;
    }

    public static Boolean getScreen(LGTV lgtv) {
        return false;
    }
}