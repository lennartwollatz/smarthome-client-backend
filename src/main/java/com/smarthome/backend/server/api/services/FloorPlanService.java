package com.smarthome.backend.server.api.services;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.model.FloorPlan;
import com.smarthome.backend.model.Room;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;

/**
 * Service für FloorPlan-API-Endpunkte.
 */
public class FloorPlanService {
    private static final Logger logger = LoggerFactory.getLogger(FloorPlanService.class);
    private static final Gson gson = new Gson();
    
    private final Repository<FloorPlan> floorPlanRepository;
    private final Repository<Room> roomRepository;
    private final ActionManager actionManager;
    
    public FloorPlanService(DatabaseManager databaseManager, ActionManager actionManager) {
        this.floorPlanRepository = new JsonRepository<>(databaseManager, FloorPlan.class);
        this.roomRepository = new JsonRepository<>(databaseManager, Room.class);
        this.actionManager = actionManager;
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("FloorPlanService: {} {}", method, path);
        
        if (path.equals("/floorplan") || path.equals("/floorplan/")) {
            if ("GET".equals(method)) {
                loadFloorPlan(exchange);
            } else if ("PUT".equals(method)) {
                saveFloorPlan(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.equals("/floorplan/rooms") || path.equals("/floorplan/rooms/")) {
            logger.info("Füge Raum hinzu");
            logger.info("Method: {}", method);
            if ("POST".equals(method)) {
                addRoom(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/floorplan/rooms/[^/]+")) {
            String roomId = ApiRouter.extractPathParam(path, "/floorplan/rooms/{roomId}");
            if ("PUT".equals(method)) {
                updateRoom(exchange, roomId);
            } else if ("DELETE".equals(method)) {
                deleteRoom(exchange, roomId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void loadFloorPlan(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Lade Grundriss");
        Optional<FloorPlan> floorPlanOpt = floorPlanRepository.findById("main-floorplan");
        
        if (floorPlanOpt.isPresent()) {
            String response = gson.toJson(floorPlanOpt.get());
            ApiRouter.sendResponse(exchange, 200, response);
        } else {
            // Fallback: Leerer Grundriss
            FloorPlan floorPlan = new FloorPlan();
            floorPlan.setRooms(new java.util.ArrayList<>());
            floorPlanRepository.save("main-floorplan", floorPlan);
            String response = gson.toJson(floorPlan);
            ApiRouter.sendResponse(exchange, 200, response);
        }
    }
    
    private void saveFloorPlan(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Speichere Grundriss");
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            FloorPlan floorPlan = gson.fromJson(requestBody, FloorPlan.class);
            floorPlanRepository.save("main-floorplan", floorPlan);
            String response = gson.toJson(floorPlan);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Speichern des Grundrisses", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid floor plan data: " + e.getMessage())));
        }
    }
    
    private void addRoom(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Füge Raum hinzu");
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            Room room = gson.fromJson(requestBody, Room.class);
            
            // Generiere ID falls nicht vorhanden
            if (room.getId() == null || room.getId().isEmpty()) {
                room.setId("room-" + UUID.randomUUID().toString());
                logger.info("Neue Raum-ID generiert: {}", room.getId());
            }
            
            // Prüfe ob Raum bereits existiert
            if (roomRepository.existsById(room.getId())) {
                logger.warn("Raum mit ID {} existiert bereits, wird überschrieben", room.getId());
            }
            
            // Speichere Raum in der Datenbank
            logger.info("Speichere Raum in Datenbank: ID={}, Name={}", room.getId(), room.getName());
            roomRepository.save(room.getId(), room);
            
            // Lade oder erstelle FloorPlan
            Optional<FloorPlan> floorPlanOpt = floorPlanRepository.findById("main-floorplan");
            FloorPlan floorPlan = floorPlanOpt.orElse(new FloorPlan());
            if (floorPlan.getRooms() == null) {
                floorPlan.setRooms(new java.util.ArrayList<>());
            }
            
            // Prüfe ob Raum bereits im FloorPlan existiert (verhindert Duplikate)
            boolean roomExists = floorPlan.getRooms().stream()
                .anyMatch(r -> room.getId().equals(r.getId()));
            
            if (roomExists) {
                // Aktualisiere bestehenden Raum im FloorPlan
                logger.info("Raum {} existiert bereits im FloorPlan, wird aktualisiert", room.getId());
                floorPlan.getRooms().removeIf(r -> room.getId().equals(r.getId()));
            }
            
            // Füge Raum zum FloorPlan hinzu
            floorPlan.getRooms().add(room);
            logger.info("Füge Raum {} zum FloorPlan hinzu", room.getId());
            
            // Speichere aktualisierten FloorPlan in der Datenbank
            floorPlanRepository.save("main-floorplan", floorPlan);
            logger.info("FloorPlan erfolgreich aktualisiert mit {} Räumen", floorPlan.getRooms().size());
            
            String response = gson.toJson(room);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Hinzufügen des Raums", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid room data: " + e.getMessage())));
        }
    }
    
    private void updateRoom(com.sun.net.httpserver.HttpExchange exchange, String roomId) throws IOException {
        logger.info("Aktualisiere Raum: {}", roomId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            Room room = gson.fromJson(requestBody, Room.class);
            if (!roomId.equals(room.getId())) {
                room.setId(roomId);
            }
            
            roomRepository.save(roomId, room);
            
            // Aktualisiere auch im FloorPlan
            Optional<FloorPlan> floorPlanOpt = floorPlanRepository.findById("main-floorplan");
            if (floorPlanOpt.isPresent()) {
                FloorPlan floorPlan = floorPlanOpt.get();
                if (floorPlan.getRooms() != null) {
                    floorPlan.getRooms().removeIf(r -> roomId.equals(r.getId()));
                    floorPlan.getRooms().add(room);
                    floorPlanRepository.save("main-floorplan", floorPlan);
                }
            }
            
            String response = gson.toJson(room);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren des Raums", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid room data: " + e.getMessage())));
        }
    }
    
    private void deleteRoom(com.sun.net.httpserver.HttpExchange exchange, String roomId) throws IOException {
        logger.info("Lösche Raum: {}", roomId);
        boolean deleted = roomRepository.deleteById(roomId);
        
        if (deleted) {
            // Entferne auch aus FloorPlan
            Optional<FloorPlan> floorPlanOpt = floorPlanRepository.findById("main-floorplan");
            if (floorPlanOpt.isPresent()) {
                FloorPlan floorPlan = floorPlanOpt.get();
                if (floorPlan.getRooms() != null) {
                    floorPlan.getRooms().removeIf(r -> roomId.equals(r.getId()));
                    floorPlanRepository.save("main-floorplan", floorPlan);
                }
            }
            actionManager.removeRoomFromDevices(roomId);
            ApiRouter.sendResponse(exchange, 204, "");
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Room not found")));
        }
    }
}

