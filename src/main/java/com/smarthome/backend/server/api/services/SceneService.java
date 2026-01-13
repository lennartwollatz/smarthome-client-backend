package com.smarthome.backend.server.api.services;

import com.google.gson.Gson;
import com.smarthome.backend.model.Scene;
import com.smarthome.backend.model.SceneActivationResponse;
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
 * Service für Scene-API-Endpunkte.
 */
public class SceneService {
    private static final Logger logger = LoggerFactory.getLogger(SceneService.class);
    private static final Gson gson = new Gson();
    
    private final Repository<Scene> sceneRepository;
    
    public SceneService(DatabaseManager databaseManager) {
        this.sceneRepository = new JsonRepository<>(databaseManager, Scene.class);
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("SceneService: {} {}", method, path);
        
        if (path.equals("/scenes") || path.equals("/scenes/")) {
            if ("GET".equals(method)) {
                getScenes(exchange);
            } else if ("POST".equals(method)) {
                createScene(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/scenes/[^/]+/activate")) {
            if ("POST".equals(method)) {
                String sceneId = ApiRouter.extractPathParam(path, "/scenes/{sceneId}/activate");
                activateScene(exchange, sceneId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/scenes/[^/]+/deactivate")) {
            if ("POST".equals(method)) {
                String sceneId = ApiRouter.extractPathParam(path, "/scenes/{sceneId}/deactivate");
                deactivateScene(exchange, sceneId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/scenes/[^/]+")) {
            String sceneId = ApiRouter.extractPathParam(path, "/scenes/{sceneId}");
            if ("GET".equals(method)) {
                getScene(exchange, sceneId);
            } else if ("PUT".equals(method)) {
                updateScene(exchange, sceneId);
            } else if ("DELETE".equals(method)) {
                deleteScene(exchange, sceneId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void getScenes(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Lade alle Szenen");
        List<Scene> scenes = sceneRepository.findAll();
        String response = gson.toJson(scenes);
        ApiRouter.sendResponse(exchange, 200, response);
    }
    
    private void getScene(com.sun.net.httpserver.HttpExchange exchange, String sceneId) throws IOException {
        logger.info("Lade Szene: {}", sceneId);
        Optional<Scene> scene = sceneRepository.findById(sceneId);
        
        if (scene.isPresent()) {
            String response = gson.toJson(scene.get());
            ApiRouter.sendResponse(exchange, 200, response);
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Scene not found")));
        }
    }
    
    private void createScene(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Erstelle neue Szene");
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            Scene scene = gson.fromJson(requestBody, Scene.class);
            if (scene.getId() == null || scene.getId().isEmpty()) {
                scene.setId("scene-" + UUID.randomUUID().toString());
            }
            if (scene.getActive() == null) {
                scene.setActive(false);
            }
            
            sceneRepository.save(scene.getId(), scene);
            String response = gson.toJson(scene);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Erstellen der Szene", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid scene data: " + e.getMessage())));
        }
    }
    
    private void updateScene(com.sun.net.httpserver.HttpExchange exchange, String sceneId) throws IOException {
        logger.info("Aktualisiere Szene: {}", sceneId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            Scene scene = gson.fromJson(requestBody, Scene.class);
            if (!sceneId.equals(scene.getId())) {
                scene.setId(sceneId);
            }
            
            sceneRepository.save(sceneId, scene);
            String response = gson.toJson(scene);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren der Szene", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid scene data: " + e.getMessage())));
        }
    }
    
    private void deleteScene(com.sun.net.httpserver.HttpExchange exchange, String sceneId) throws IOException {
        logger.info("Lösche Szene: {}", sceneId);
        boolean deleted = sceneRepository.deleteById(sceneId);
        
        if (deleted) {
            ApiRouter.sendResponse(exchange, 204, "");
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Scene not found")));
        }
    }
    
    private void activateScene(com.sun.net.httpserver.HttpExchange exchange, String sceneId) throws IOException {
        logger.info("Aktiviere Szene: {}", sceneId);
        Optional<Scene> sceneOpt = sceneRepository.findById(sceneId);
        
        if (sceneOpt.isPresent()) {
            Scene scene = sceneOpt.get();
            scene.setActive(true);
            sceneRepository.save(sceneId, scene);
            
            SceneActivationResponse response = new SceneActivationResponse();
            response.setId(scene.getId());
            response.setName(scene.getName());
            response.setActive(true);
            
            ApiRouter.sendResponse(exchange, 200, gson.toJson(response));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Scene not found")));
        }
    }
    
    private void deactivateScene(com.sun.net.httpserver.HttpExchange exchange, String sceneId) throws IOException {
        logger.info("Deaktiviere Szene: {}", sceneId);
        Optional<Scene> sceneOpt = sceneRepository.findById(sceneId);
        
        if (sceneOpt.isPresent()) {
            Scene scene = sceneOpt.get();
            scene.setActive(false);
            sceneRepository.save(sceneId, scene);
            
            SceneActivationResponse response = new SceneActivationResponse();
            response.setId(scene.getId());
            response.setName(scene.getName());
            response.setActive(false);
            
            ApiRouter.sendResponse(exchange, 200, gson.toJson(response));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Scene not found")));
        }
    }
}

