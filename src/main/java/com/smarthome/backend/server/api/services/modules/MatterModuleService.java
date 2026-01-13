package com.smarthome.backend.server.api.services.modules;

import com.google.gson.Gson;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.db.DatabaseManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Map;

/**
 * Service für Matter-Module-API-Endpunkte.
 */
public class MatterModuleService {
    private static final Logger logger = LoggerFactory.getLogger(MatterModuleService.class);
    private static final Gson gson = new Gson();
    
    //private final MatterModule matterModule;
    
    public MatterModuleService(DatabaseManager databaseManager) {
        //this.matterModule = new MatterModule(databaseManager);
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("MatterModuleService: {} {}", method, path);
        
        if (path.equals("/modules/matter/devices/discover")) {
            if ("GET".equals(method)) {
                discoverDevices(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/matter/devices/[^/]+/pair")) {
            if ("POST".equals(method)) {
                pairDevice(exchange, path);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void discoverDevices(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        //matterModule.discoverDevices(exchange);
        ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not implemented")));
    }
    
    
    private void pairDevice(com.sun.net.httpserver.HttpExchange exchange, String path) throws IOException {
        //matterModule.pairDevice(exchange, path);
        ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not implemented")));
    }
}

