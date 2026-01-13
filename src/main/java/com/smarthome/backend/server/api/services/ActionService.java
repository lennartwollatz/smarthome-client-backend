package com.smarthome.backend.server.api.services;

import com.google.gson.Gson;
import com.smarthome.backend.model.Action;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Service für Action-API-Endpunkte.
 */
public class ActionService {
    private static final Logger logger = LoggerFactory.getLogger(ActionService.class);
    private static final Gson gson = new Gson();
    
    private final Repository<Action> actionRepository;
    
    public ActionService(DatabaseManager databaseManager) {
        this.actionRepository = new JsonRepository<>(databaseManager, Action.class);
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("ActionService: {} {}", method, path);
        
        if (path.equals("/actions") || path.equals("/actions/")) {
            if ("GET".equals(method)) {
                getActions(exchange);
            } else if ("POST".equals(method)) {
                createAction(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/actions/[^/]+")) {
            String actionId = ApiRouter.extractPathParam(path, "/actions/{actionId}");
            if ("GET".equals(method)) {
                getAction(exchange, actionId);
            } else if ("PUT".equals(method)) {
                updateAction(exchange, actionId);
            } else if ("DELETE".equals(method)) {
                deleteAction(exchange, actionId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void getActions(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Lade alle Aktionen");
        List<Action> actions = actionRepository.findAll();
        String response = gson.toJson(actions);
        ApiRouter.sendResponse(exchange, 200, response);
    }
    
    private void getAction(com.sun.net.httpserver.HttpExchange exchange, String actionId) throws IOException {
        logger.info("Lade Aktion: {}", actionId);
        Optional<Action> action = actionRepository.findById(actionId);
        
        if (action.isPresent()) {
            String response = gson.toJson(action.get());
            ApiRouter.sendResponse(exchange, 200, response);
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Action not found")));
        }
    }
    
    private void createAction(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Erstelle neue Aktion");
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            Action action = gson.fromJson(requestBody, Action.class);
            if (action.getActionId() == null || action.getActionId().isEmpty()) {
                action.setActionId("action-" + UUID.randomUUID().toString());
            }
            
            // Setze Timestamps
            String now = java.time.Instant.now().toString();
            if (action.getCreatedAt() == null) {
                action.setCreatedAt(now);
            }
            action.setUpdatedAt(now);
            
            actionRepository.save(action.getActionId(), action);
            String response = gson.toJson(action);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Erstellen der Aktion", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid action data: " + e.getMessage())));
        }
    }
    
    private void updateAction(com.sun.net.httpserver.HttpExchange exchange, String actionId) throws IOException {
        logger.info("Aktualisiere Aktion: {}", actionId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            Action action = gson.fromJson(requestBody, Action.class);
            if (!actionId.equals(action.getActionId())) {
                action.setActionId(actionId);
            }
            
            // Aktualisiere updatedAt
            action.setUpdatedAt(java.time.Instant.now().toString());
            
            actionRepository.save(actionId, action);
            String response = gson.toJson(action);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren der Aktion", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid action data: " + e.getMessage())));
        }
    }
    
    private void deleteAction(com.sun.net.httpserver.HttpExchange exchange, String actionId) throws IOException {
        logger.info("Lösche Aktion: {}", actionId);
        boolean deleted = actionRepository.deleteById(actionId);
        
        if (deleted) {
            ApiRouter.sendResponse(exchange, 200, gson.toJson(true));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Action not found")));
        }
    }
}

