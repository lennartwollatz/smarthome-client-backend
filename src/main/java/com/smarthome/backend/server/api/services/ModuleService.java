package com.smarthome.backend.server.api.services;

import com.google.gson.Gson;
import com.smarthome.backend.model.Module;
import com.smarthome.backend.model.ModuleActiveRequest;
import com.smarthome.backend.model.ModuleSettingsRequest;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.api.services.modules.MatterModuleService;
import com.smarthome.backend.server.api.services.modules.DenonModuleService;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service für Module-API-Endpunkte.
 */
public class ModuleService {
    private static final Logger logger = LoggerFactory.getLogger(ModuleService.class);
    private static final Gson gson = new Gson();
    
    private final Repository<Module> moduleRepository;
    private final MatterModuleService matterModuleService;
    private final DenonModuleService denonModuleService;
    
    public ModuleService(DatabaseManager databaseManager) {
        this.moduleRepository = new JsonRepository<>(databaseManager, Module.class);
        this.denonModuleService = new DenonModuleService(databaseManager);
        this.matterModuleService = new MatterModuleService(databaseManager);
    }
    
    public void handleRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        logger.debug("ModuleService: {} {}", method, path);
        
        // Sonoff-spezifische Endpunkte
        if (path.startsWith("/modules/sonoff/")) {
            handleSonoffRequest(exchange, method, path);
            return;
        }

        // Sonoff-spezifische Endpunkte
        if (path.startsWith("/modules/denon/")) {
            handleDenonRequest(exchange, method, path);
            return;
        }
        
        // Matter-spezifische Endpunkte
        if (path.startsWith("/modules/matter/")) {
            handleMatterRequest(exchange, method, path);
            return;
        }
        
        if (path.equals("/modules") || path.equals("/modules/")) {
            if ("GET".equals(method)) {
                getModules(exchange);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/[^/]+/install")) {
            if ("GET".equals(method)) {
                String moduleId = ApiRouter.extractPathParam(path, "/modules/{moduleId}/install");
                installModule(exchange, moduleId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/[^/]+/uninstall")) {
            if ("GET".equals(method)) {
                String moduleId = ApiRouter.extractPathParam(path, "/modules/{moduleId}/uninstall");
                uninstallModule(exchange, moduleId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/[^/]+/settings")) {
            if ("PUT".equals(method)) {
                String moduleId = ApiRouter.extractPathParam(path, "/modules/{moduleId}/settings");
                updateModuleSettings(exchange, moduleId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else if (path.matches("/modules/[^/]+")) {
            String moduleId = ApiRouter.extractPathParam(path, "/modules/{moduleId}");
            if ("GET".equals(method)) {
                getModule(exchange, moduleId);
            } else if ("PUT".equals(method)) {
                updateModule(exchange, moduleId);
            } else if ("POST".equals(method)) {
                toggleModuleActive(exchange, moduleId);
            } else {
                ApiRouter.sendResponse(exchange, 405, gson.toJson(Map.of("error", "Method not allowed")));
            }
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Endpoint not found")));
        }
    }
    
    private void handleSonoffRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        // Aktuell nicht implementiert
        ApiRouter.sendResponse(exchange, 501, gson.toJson(Map.of("error", "Sonoff module not implemented")));
    }

    private void handleDenonRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        // Weiterleitung an DenonModuleService
        denonModuleService.handleRequest(exchange, method, path);
    }
    
    private void handleMatterRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        // Weiterleitung an MatterModuleService
        matterModuleService.handleRequest(exchange, method, path);
    }
    
    private void getModules(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Lade alle Module");
        List<Module> modules = enrichWithDefaultModules(moduleRepository.findAll());
        String response = gson.toJson(modules);
        ApiRouter.sendResponse(exchange, 200, response);
    }

    private List<Module> enrichWithDefaultModules(List<Module> dbModules) {
        LinkedHashMap<String, Module> result = new LinkedHashMap<>();

        for (Module defaultModule : com.smarthome.backend.server.api.modules.Module.getDefaultModules()) {
            if (defaultModule != null && defaultModule.getId() != null && !defaultModule.getId().isBlank()) {
                result.put(defaultModule.getId(), defaultModule);
            }
        }

        if (dbModules != null) {
            for (Module dbModule : dbModules) {
                if (dbModule != null && dbModule.getId() != null && !dbModule.getId().isBlank()) {
                    // DB überschreibt Defaults für gleiche ID
                    result.put(dbModule.getId(), dbModule);
                }
            }
        }

        return new ArrayList<>(result.values());
    }
    
    private void getModule(com.sun.net.httpserver.HttpExchange exchange, String moduleId) throws IOException {
        logger.info("Lade Modul: {}", moduleId);
        Optional<Module> module = moduleRepository.findById(moduleId);
        
        if (module.isPresent()) {
            String response = gson.toJson(module.get());
            ApiRouter.sendResponse(exchange, 200, response);
        } else {
            // Fallback: Default-Modul zurückgeben, falls vorhanden
            com.smarthome.backend.server.api.modules.Module enumModule =
                com.smarthome.backend.server.api.modules.Module.fromModuleId(moduleId);
            Module defaultModule = enumModule != null ? enumModule.toDefaultModel() : null;

            if (defaultModule != null) {
                ApiRouter.sendResponse(exchange, 200, gson.toJson(defaultModule));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Module not found")));
            }
        }
    }
    
    private void installModule(com.sun.net.httpserver.HttpExchange exchange, String moduleId) throws IOException {
        logger.info("Installiere Modul: {}", moduleId);
        Optional<Module> moduleOpt = moduleRepository.findById(moduleId);
        
        com.smarthome.backend.server.api.modules.Module enumModule =
            com.smarthome.backend.server.api.modules.Module.fromModuleId(moduleId);
        Module module = moduleOpt.orElseGet(() -> enumModule != null ? enumModule.toDefaultModel() : null);

        if (module != null) {
            module.setIsInstalled(true);
            module.setIsActive(true);
            moduleRepository.save(moduleId, module);
            ApiRouter.sendResponse(exchange, 200, gson.toJson(true));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Module not found")));
        }
    }
    
    private void uninstallModule(com.sun.net.httpserver.HttpExchange exchange, String moduleId) throws IOException {
        logger.info("Deinstalliere Modul: {}", moduleId);
        Optional<Module> moduleOpt = moduleRepository.findById(moduleId);
        
        com.smarthome.backend.server.api.modules.Module enumModule =
            com.smarthome.backend.server.api.modules.Module.fromModuleId(moduleId);
        Module module = moduleOpt.orElseGet(() -> enumModule != null ? enumModule.toDefaultModel() : null);

        if (module != null) {
            module.setIsInstalled(false);
            module.setIsActive(false);
            moduleRepository.save(moduleId, module);
            ApiRouter.sendResponse(exchange, 200, gson.toJson(true));
        } else {
            ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Module not found")));
        }
    }
    
    private void toggleModuleActive(com.sun.net.httpserver.HttpExchange exchange, String moduleId) throws IOException {
        logger.info("Ändere Aktivierungsstatus für Modul: {}", moduleId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            ModuleActiveRequest request = gson.fromJson(requestBody, ModuleActiveRequest.class);
            Optional<Module> moduleOpt = moduleRepository.findById(moduleId);
            com.smarthome.backend.server.api.modules.Module enumModule =
                com.smarthome.backend.server.api.modules.Module.fromModuleId(moduleId);
            Module module = moduleOpt.orElseGet(() -> enumModule != null ? enumModule.toDefaultModel() : null);

            if (module != null) {
                module.setIsActive(request.getIsActive());
                moduleRepository.save(moduleId, module);
                ApiRouter.sendResponse(exchange, 200, gson.toJson(request.getIsActive()));
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Module not found")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Ändern des Aktivierungsstatus", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid request: " + e.getMessage())));
        }
    }
    
    private void updateModuleSettings(com.sun.net.httpserver.HttpExchange exchange, String moduleId) throws IOException {
        logger.info("Aktualisiere Einstellungen für Modul: {}", moduleId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            ModuleSettingsRequest request = gson.fromJson(requestBody, ModuleSettingsRequest.class);
            Optional<Module> moduleOpt = moduleRepository.findById(moduleId);
            
            com.smarthome.backend.server.api.modules.Module enumModule =
                com.smarthome.backend.server.api.modules.Module.fromModuleId(moduleId);
            Module module = moduleOpt.orElseGet(() -> enumModule != null ? enumModule.toDefaultModel() : null);

            if (module != null) {
                // Einstellungen würden hier verarbeitet werden
                // TODO: request in module übernehmen, sobald Settings-Felder definiert sind
                moduleRepository.save(moduleId, module);
                String response = gson.toJson(module);
                ApiRouter.sendResponse(exchange, 200, response);
            } else {
                ApiRouter.sendResponse(exchange, 404, gson.toJson(Map.of("error", "Module not found")));
            }
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren der Moduleinstellungen", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid request: " + e.getMessage())));
        }
    }
    
    private void updateModule(com.sun.net.httpserver.HttpExchange exchange, String moduleId) throws IOException {
        logger.info("Aktualisiere Modul: {}", moduleId);
        String requestBody = ApiRouter.readRequestBody(exchange);
        
        try {
            Module module = gson.fromJson(requestBody, Module.class);
            if (!moduleId.equals(module.getId())) {
                module.setId(moduleId);
            }
            
            moduleRepository.save(moduleId, module);
            String response = gson.toJson(module);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler beim Aktualisieren des Moduls", e);
            ApiRouter.sendResponse(exchange, 400, gson.toJson(Map.of("error", "Invalid module data: " + e.getMessage())));
        }
    }
}

