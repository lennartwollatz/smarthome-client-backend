package com.smarthome.backend.server.api.services;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.model.User;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;
import com.smarthome.backend.server.events.EventStreamManager;

/**
 * Service für User-API-Endpunkte.
 * Handhabt: GET /users, POST /users, PUT /users/{userId}, DELETE /users/{userId}, GET /users/{userId}/regenerate-token
 */
public class UserService {
    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    private static final Gson gson = new Gson();
    
    private final Repository<User> userRepository;
    private final EventStreamManager eventStreamManager;
    private final ActionManager actionManager;
    
    public UserService(DatabaseManager databaseManager, EventStreamManager eventStreamManager, ActionManager actionManager) {
        this.userRepository = new JsonRepository<>(databaseManager, User.class);
        this.eventStreamManager = eventStreamManager;
        this.actionManager = actionManager;
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("UserService: {} {}", method, path);
        
        if (path.equals("/users") || path.equals("/users/")) {
            if ("GET".equals(method)) {
                loadUsers(exchange);
            } else if ("POST".equals(method)) {
                addUser(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/users/[^/]+/regenerate-token")) {
            if ("GET".equals(method)) {
                String userId = ApiRouter.extractPathParam(path, "/users/{userId}/regenerate-token");
                regenerateTrackingToken(exchange, userId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/users/[^/]+")) {
            String userId = ApiRouter.extractPathParam(path, "/users/{userId}");
            if ("GET".equals(method)) {
                getUser(exchange, userId);
            } else if ("PUT".equals(method)) {
                updateUser(exchange, userId);
            } else if ("DELETE".equals(method)) {
                deleteUser(exchange, userId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void loadUsers(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Lade alle Benutzer");
        List<User> users = userRepository.findAll();
        String response = gson.toJson(users);
        ApiRouter.sendResponse(exchange, 200, response);
    }
    
    private void addUser(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Erstelle neuen Benutzer");
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            User user = gson.fromJson(requestBody, User.class);
            
            // Generiere ID falls nicht vorhanden
            if (user.getId() == null || user.getId().isEmpty()) {
                user.setId("user-" + UUID.randomUUID().toString());
            }
            
            // Setze Standardwerte
            if (user.getLocationTrackingEnabled() == null) {
                user.setLocationTrackingEnabled(false);
            }
            if (user.getPushNotificationsEnabled() == null) {
                user.setPushNotificationsEnabled(false);
            }
            if (user.getEmailNotificationsEnabled() == null) {
                user.setEmailNotificationsEnabled(false);
            }
            if (user.getSmsNotificationsEnabled() == null) {
                user.setSmsNotificationsEnabled(false);
            }
            
            userRepository.save(user.getId(), user);
            ApiRouter.sendResponse(exchange, 201, "");
            
        } catch (Exception e) {
            logger.error("Fehler beim Erstellen des Benutzers", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid user data: " + e.getMessage())));
        }
    }
    
    private void getUser(com.sun.net.httpserver.HttpExchange exchange, String userId) throws IOException {
        logger.info("Lade Benutzer: {}", userId);
        Optional<User> user = userRepository.findById(userId);
        
        if (user.isPresent()) {
            String response = gson.toJson(user.get());
            ApiRouter.sendResponse(exchange, 200, response);
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "User not found")));
        }
    }
    
    private void updateUser(com.sun.net.httpserver.HttpExchange exchange, String userId) throws IOException {
        logger.info("Aktualisiere Benutzer: {}", userId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            User user = gson.fromJson(requestBody, User.class);
            
            // Stelle sicher, dass die ID übereinstimmt
            if (!userId.equals(user.getId())) {
                user.setId(userId);
            }
            
            userRepository.save(userId, user);
            ApiRouter.sendResponse(exchange, 200, "");
            
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren des Benutzers", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid user data: " + e.getMessage())));
        }
    }
    
    private void deleteUser(com.sun.net.httpserver.HttpExchange exchange, String userId) throws IOException {
        logger.info("Lösche Benutzer: {}", userId);
        boolean deleted = userRepository.deleteById(userId);
        
        if (deleted) {
            ApiRouter.sendResponse(exchange, 204, "");
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "User not found")));
        }
    }
    
    private void regenerateTrackingToken(com.sun.net.httpserver.HttpExchange exchange, String userId) throws IOException {
        logger.info("Regeneriere Tracking-Token für Benutzer: {}", userId);
        Optional<User> userOpt = userRepository.findById(userId);
        
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            // Generiere neues Token
            String newToken = UUID.randomUUID().toString().replace("-", "");
            user.setTrackingToken(newToken);
            userRepository.save(userId, user);
            
            String response = gson.toJson(newToken);
            ApiRouter.sendResponse(exchange, 200, response);
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "User not found")));
        }
    }
}

