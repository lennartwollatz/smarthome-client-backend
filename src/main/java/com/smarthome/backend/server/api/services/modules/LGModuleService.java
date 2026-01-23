package com.smarthome.backend.server.api.services.modules;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.model.devices.DeviceTV;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.api.modules.lg.LGModuleManager;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.events.EventStreamManager;

/**
 * Service für LG-Module-API-Endpunkte.
 */
public class LGModuleService {
    private static final Logger logger = LoggerFactory.getLogger(LGModuleService.class);
    private static final Gson gson = new Gson();

    private final LGModuleManager lgModule;

    public LGModuleService(DatabaseManager databaseManager, EventStreamManager eventStreamManager, ActionManager actionManager) {
        this.lgModule = new LGModuleManager(databaseManager, eventStreamManager, actionManager);
    }

    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("LGModuleService: {} {}", method, path);

        if (path.equals("/modules/lg/devices/discover")) {
            if ("GET".equals(method)) {
                discoverDevices(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/pair")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/pair");
                pairDevice(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/setOn")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/setOn");
                setOn(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/setOff")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/setOff");
                setOff(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/setVolume")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/setVolume");
                setVolume(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/screenOn")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/screenOn");
                screenOn(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/screenOff")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/screenOff");
                screenOff(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/setChannel")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/setChannel");
                setChannel(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/startApp")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/startApp");
                startApp(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/notify")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/notify");
                notify(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/channels")) {
            if ("GET".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/channels");
                getChannels(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/apps")) {
            if ("GET".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/apps");
                getApps(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/selectedApp")) {
            if ("GET".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/selectedApp");
                getSelectedApp(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/selectedChannel")) {
            if ("GET".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/selectedChannel");
                getSelectedChannel(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/setHomeAppNumber")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/setHomeAppNumber");
                setHomeAppNumber(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/lg/devices/[^/]+/setHomeChannelNumber")) {
            if ("POST".equals(method)) {
                String deviceId = ApiRouter.extractPathParam(path, "/modules/lg/devices/{deviceId}/setHomeChannelNumber");
                setHomeChannelNumber(exchange, deviceId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }

    private void discoverDevices(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        lgModule.discoverDevices(exchange);
    }

    private void pairDevice(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        lgModule.connectDevice(exchange, deviceId);
    }

    private void setOn(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        boolean success = lgModule.powerOn(deviceId);
        if (success) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
        }
    }

    private void setOff(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        boolean success = lgModule.powerOff(deviceId);
        if (success) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
        }
    }

    private void setVolume(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        String requestBody = ApiRouter.readRequestBody(exchange);
        if (requestBody == null || requestBody.isEmpty()) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Body")));
            return;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> request = gson.fromJson(requestBody, Map.class);
        if (request == null || !request.containsKey("volume")) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "volume parameter is required")));
            return;
        }

        Object volumeObj = request.get("volume");
        int volume;
        if (volumeObj instanceof Number) {
            volume = ((Number) volumeObj).intValue();
        } else {
            volume = Integer.parseInt(String.valueOf(volumeObj));
        }

        boolean success = lgModule.setVolume(deviceId, volume);
        if (success) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
        }
    }

    private void screenOn(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        boolean success = lgModule.screenOn(deviceId);
        if (success) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
        }
    }

    private void screenOff(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        boolean success = lgModule.screenOff(deviceId);
        if (success) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
        }
    }

    private void setChannel(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        String requestBody = ApiRouter.readRequestBody(exchange);
        if (requestBody == null || requestBody.isEmpty()) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Body")));
            return;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> request = gson.fromJson(requestBody, Map.class);
        if (request == null || !request.containsKey("channelId")) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "channelId parameter is required")));
            return;
        }

        String channelId = String.valueOf(request.get("channelId"));
        boolean success = lgModule.setChannel(deviceId, channelId);
        if (success) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
        }
    }

    private void startApp(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        String requestBody = ApiRouter.readRequestBody(exchange);
        if (requestBody == null || requestBody.isEmpty()) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Body")));
            return;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> request = gson.fromJson(requestBody, Map.class);
        if (request == null || !request.containsKey("appId")) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "appId parameter is required")));
            return;
        }

        String appId = String.valueOf(request.get("appId"));
        boolean success = lgModule.startApp(deviceId, appId);
        if (success) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
        }
    }

    private void notify(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        String requestBody = ApiRouter.readRequestBody(exchange);
        if (requestBody == null || requestBody.isEmpty()) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Body")));
            return;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> request = gson.fromJson(requestBody, Map.class);
        if (request == null || !request.containsKey("message")) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "message parameter is required")));
            return;
        }

        String message = String.valueOf(request.get("message"));
        boolean success = lgModule.notify(deviceId, message);
        if (success) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder nicht unterstützt")));
        }
    }

    private void getChannels(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        List<DeviceTV.Channel> channels = lgModule.getChannels(deviceId);
        if (channels == null) {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder keine Daten")));
            return;
        }
        ApiRouter.sendResponse(exchange, 200, gson.toJson(channels));
    }

    private void getApps(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        List<DeviceTV.App> apps = lgModule.getApps(deviceId);
        if (apps == null) {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder keine Daten")));
            return;
        }
        ApiRouter.sendResponse(exchange, 200, gson.toJson(apps));
    }

    private void getSelectedApp(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        String appId = lgModule.getSelectedApp(deviceId);
        if (appId == null) {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder keine Daten")));
            return;
        }
        ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("appId", appId)));
    }

    private void getSelectedChannel(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        String channelId = lgModule.getSelectedChannel(deviceId);
        if (channelId == null) {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät nicht gefunden oder keine Daten")));
            return;
        }
        ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("channelId", channelId)));
    }

    private void setHomeAppNumber(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        String requestBody = ApiRouter.readRequestBody(exchange);
        if (requestBody == null || requestBody.isEmpty()) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Body")));
            return;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> request = gson.fromJson(requestBody, Map.class);
        if (request == null || !request.containsKey("appId") || !request.containsKey("homeAppNumber")) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "appId und homeAppNumber sind erforderlich")));
            return;
        }

        String appId = String.valueOf(request.get("appId"));
        Object numberObj = request.get("homeAppNumber");
        int newNumber;
        if (numberObj instanceof Number) {
            newNumber = ((Number) numberObj).intValue();
        } else {
            newNumber = Integer.parseInt(String.valueOf(numberObj));
        }

        boolean success = lgModule.setHomeAppNumber(deviceId, appId, newNumber);
        if (success) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät/App nicht gefunden oder ungültige Nummer")));
        }
    }

    private void setHomeChannelNumber(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        String requestBody = ApiRouter.readRequestBody(exchange);
        if (requestBody == null || requestBody.isEmpty()) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Ungültiger Body")));
            return;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> request = gson.fromJson(requestBody, Map.class);
        if (request == null || !request.containsKey("channelId") || !request.containsKey("homeChannelNumber")) {
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "channelId und homeChannelNumber sind erforderlich")));
            return;
        }

        String channelId = String.valueOf(request.get("channelId"));
        Object numberObj = request.get("homeChannelNumber");
        int newNumber;
        if (numberObj instanceof Number) {
            newNumber = ((Number) numberObj).intValue();
        } else {
            newNumber = Integer.parseInt(String.valueOf(numberObj));
        }

        boolean success = lgModule.setHomeChannelNumber(deviceId, channelId, newNumber);
        if (success) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(Map.of("success", true)));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Gerät/Channel nicht gefunden oder ungültige Nummer")));
        }
    }
}

