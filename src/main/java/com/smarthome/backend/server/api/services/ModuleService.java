package com.smarthome.backend.server.api.services;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.model.Module;
import com.smarthome.backend.model.ModuleActiveRequest;
import com.smarthome.backend.model.ModuleSettingsRequest;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.api.modules.hue.HueDiscoveredBridge;
import com.smarthome.backend.server.api.services.modules.DenonModuleService;
import com.smarthome.backend.server.api.services.modules.HueModuleService;
import com.smarthome.backend.server.api.services.modules.MatterModuleService;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;
import com.smarthome.backend.server.events.EventStreamManager;

/**
 * Service für Module-API-Endpunkte.
 */
public class ModuleService {
    private static final Logger logger = LoggerFactory.getLogger(ModuleService.class);
    private static final Gson gson = new Gson();
    
    private final Repository<Module> moduleRepository;
    private final MatterModuleService matterModuleService;
    private final DenonModuleService denonModuleService;
    private final HueModuleService hueModuleService;
    private final ActionManager actionManager;
    
    public ModuleService(DatabaseManager databaseManager, EventStreamManager eventStreamManager, ActionManager actionManager) {
        this.moduleRepository = new JsonRepository<>(databaseManager, Module.class);
        this.actionManager = actionManager;
        this.denonModuleService = new DenonModuleService(databaseManager, eventStreamManager, actionManager);
        this.matterModuleService = new MatterModuleService(databaseManager, eventStreamManager, actionManager);
        this.hueModuleService = new HueModuleService(databaseManager, eventStreamManager, actionManager);
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

        // Hue-spezifische Endpunkte
        if (path.startsWith("/modules/hue/")) {
            handleHueRequest(exchange, method, path);
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

    private void handleHueRequest(com.sun.net.httpserver.HttpExchange exchange, String method, String path) throws IOException {
        // Weiterleitung an MatterModuleService
        hueModuleService.handleRequest(exchange, method, path);
    }
    
    private void getModules(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        List<Module> modules = enrichWithDefaultModules(moduleRepository.findAll());
        
        // Entferne sensible Daten (username, clientKey) aus Bridges im moduleData
        List<Module> modulesForApi = new ArrayList<>();
        for (Module module : modules) {
            modulesForApi.add(removeSensitiveDataFromModule(module));
        }
        
        String response = gson.toJson(modulesForApi);
        ApiRouter.sendResponse(exchange, 200, response);
    }
    
    /**
     * Entfernt sensible Daten (username, clientKey) aus Bridges im moduleData eines Moduls.
     * 
     * @param module Das Modul, aus dem sensible Daten entfernt werden sollen
     * @return Eine Kopie des Moduls ohne sensible Bridge-Daten
     */
    private Module removeSensitiveDataFromModule(Module module) {
        if (module == null || module.getModuleData() == null) {
            return module;
        }
        
        // Prüfe, ob es ein Hue-Modul mit Bridges ist
        if ("hue".equals(module.getId()) && module.getModuleData().containsKey("bridges")) {
            try {
                // Erstelle eine Kopie des Moduls
                Module moduleCopy = new Module();
                moduleCopy.setId(module.getId());
                moduleCopy.setName(module.getName());
                moduleCopy.setShortDescription(module.getShortDescription());
                moduleCopy.setLongDescription(module.getLongDescription());
                moduleCopy.setIcon(module.getIcon());
                moduleCopy.setCategoryKey(module.getCategoryKey());
                moduleCopy.setIsInstalled(module.getIsInstalled());
                moduleCopy.setIsActive(module.getIsActive());
                moduleCopy.setPrice(module.getPrice());
                moduleCopy.setFeatures(module.getFeatures());
                moduleCopy.setVersion(module.getVersion());
                moduleCopy.setIsPurchased(module.getIsPurchased());
                moduleCopy.setIsDisabled(module.getIsDisabled());
                moduleCopy.setDevices(module.getDevices());
                
                // Kopiere moduleData und filtere Bridges
                Map<String, Object> moduleDataCopy = new java.util.HashMap<>(module.getModuleData());
                
                // Filtere Bridges
                Object bridgesObj = moduleDataCopy.get("bridges");
                if (bridgesObj instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<Object> bridgesList = (List<Object>) bridgesObj;
                    List<HueDiscoveredBridge> filteredBridges = new ArrayList<>();
                    
                    for (Object bridgeObj : bridgesList) {
                        if (bridgeObj instanceof HueDiscoveredBridge) {
                            filteredBridges.add(((HueDiscoveredBridge) bridgeObj).withoutSensitiveData());
                        } else {
                            // Konvertiere LinkedTreeMap zu HueDiscoveredBridge mit Gson
                            String bridgeJson = gson.toJson(bridgeObj);
                            HueDiscoveredBridge bridge = gson.fromJson(bridgeJson, HueDiscoveredBridge.class);
                            filteredBridges.add(bridge.withoutSensitiveData());
                        }
                    }
                    
                    moduleDataCopy.put("bridges", filteredBridges);
                }
                
                moduleCopy.setModuleData(moduleDataCopy);
                return moduleCopy;
            } catch (Exception e) {
                logger.warn("Fehler beim Entfernen sensibler Daten aus Modul {}: {}", module.getId(), e.getMessage());
                return module;
            }
        }
        
        return module;
    }

    private List<Module> enrichWithDefaultModules(List<Module> dbModules) {
        LinkedHashMap<String, Module> result = new LinkedHashMap<>();

        // Zuerst alle Module aus der Datenbank hinzufügen
        if (dbModules != null) {
            for (Module dbModule : dbModules) {
                if (dbModule != null && dbModule.getId() != null && !dbModule.getId().isBlank()) {
                    result.put(dbModule.getId(), dbModule);
                }
            }
        }

        // Dann Default-Module hinzufügen, die nicht bereits in der Datenbank vorhanden sind
        for (Module defaultModule : com.smarthome.backend.server.api.modules.Module.getDefaultModules()) {
            if (defaultModule != null && defaultModule.getId() != null && !defaultModule.getId().isBlank()) {
                // Nur hinzufügen, wenn das Modul nicht bereits in der Datenbank existiert
                if (!result.containsKey(defaultModule.getId())) {
                    result.put(defaultModule.getId(), defaultModule);
                }
            }
        }

        return new ArrayList<>(result.values());
    }
    
    private void getModule(com.sun.net.httpserver.HttpExchange exchange, String moduleId) throws IOException {
        logger.info("Lade Modul: {}", moduleId);
        Optional<Module> module = moduleRepository.findById(moduleId);
        
        if (module.isPresent()) {
            // Entferne sensible Daten (username, clientKey) aus Bridges im moduleData
            Module moduleForApi = removeSensitiveDataFromModule(module.get());
            String response = gson.toJson(moduleForApi);
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
            actionManager.addDevicesForModule(moduleId);
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
            actionManager.removeDeviceForModule(moduleId);
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
                if( request.getIsActive() ) {
                    actionManager.addDevicesForModule(moduleId);
                } else {
                    actionManager.removeDeviceForModule(moduleId);
                }
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
    
    /**
     * Speichert modulspezifische Daten für ein Modul.
     * Erstellt das Modul, falls es noch nicht existiert.
     * 
     * @param moduleId Die ID des Moduls
     * @param key Der Schlüssel für die Daten
     * @param value Der Wert (kann beliebiger Typ sein, wird als JSON gespeichert)
     */
    public void saveModuleData(String moduleId, String key, Object value) {
        logger.debug("Speichere Modul-Daten: moduleId={}, key={}", moduleId, key);
        
        Module module = getOrCreateModule(moduleId);
        if (module.getModuleData() == null) {
            module.setModuleData(new java.util.HashMap<>());
        }
        module.getModuleData().put(key, value);
        moduleRepository.save(moduleId, module);
        
        logger.debug("Modul-Daten gespeichert: moduleId={}, key={}", moduleId, key);
    }
    
    /**
     * Lädt modulspezifische Daten für ein Modul.
     * 
     * @param moduleId Die ID des Moduls
     * @param key Der Schlüssel für die Daten
     * @return Der Wert oder null, falls nicht gefunden
     */
    public Object getModuleData(String moduleId, String key) {
        logger.debug("Lade Modul-Daten: moduleId={}, key={}", moduleId, key);
        
        Optional<Module> moduleOpt = moduleRepository.findById(moduleId);
        if (moduleOpt.isPresent()) {
            Module module = moduleOpt.get();
            if (module.getModuleData() != null) {
                Object value = module.getModuleData().get(key);
                logger.debug("Modul-Daten geladen: moduleId={}, key={}, found={}", 
                    moduleId, key, value != null);
                return value;
            }
        }
        
        logger.debug("Modul-Daten nicht gefunden: moduleId={}, key={}", moduleId, key);
        return null;
    }
    
    /**
     * Lädt alle modulspezifischen Daten für ein Modul.
     * 
     * @param moduleId Die ID des Moduls
     * @return Map mit allen Daten oder leere Map, falls keine Daten vorhanden
     */
    public Map<String, Object> getAllModuleData(String moduleId) {
        logger.debug("Lade alle Modul-Daten: moduleId={}", moduleId);
        
        Optional<Module> moduleOpt = moduleRepository.findById(moduleId);
        if (moduleOpt.isPresent()) {
            Module module = moduleOpt.get();
            if (module.getModuleData() != null) {
                return new java.util.HashMap<>(module.getModuleData());
            }
        }
        
        return new java.util.HashMap<>();
    }
    
    /**
     * Löscht modulspezifische Daten für ein Modul.
     * 
     * @param moduleId Die ID des Moduls
     * @param key Der Schlüssel für die zu löschenden Daten
     * @return true, wenn Daten gelöscht wurden, false sonst
     */
    public boolean removeModuleData(String moduleId, String key) {
        logger.debug("Lösche Modul-Daten: moduleId={}, key={}", moduleId, key);
        
        Optional<Module> moduleOpt = moduleRepository.findById(moduleId);
        if (moduleOpt.isPresent()) {
            Module module = moduleOpt.get();
            if (module.getModuleData() != null && module.getModuleData().containsKey(key)) {
                module.getModuleData().remove(key);
                moduleRepository.save(moduleId, module);
                logger.debug("Modul-Daten gelöscht: moduleId={}, key={}", moduleId, key);
                return true;
            }
        }
        
        logger.debug("Modul-Daten nicht gefunden zum Löschen: moduleId={}, key={}", moduleId, key);
        return false;
    }
    
    /**
     * Erstellt oder lädt ein Modul aus der Datenbank.
     * Falls das Modul nicht existiert, wird ein Default-Modul erstellt.
     * 
     * @param moduleId Die ID des Moduls
     * @return Das Modul (entweder aus DB oder als Default)
     */
    private Module getOrCreateModule(String moduleId) {
        Optional<Module> moduleOpt = moduleRepository.findById(moduleId);
        
        if (moduleOpt.isPresent()) {
            return moduleOpt.get();
        }
        
        // Erstelle Default-Modul
        com.smarthome.backend.server.api.modules.Module enumModule =
            com.smarthome.backend.server.api.modules.Module.fromModuleId(moduleId);
        
        if (enumModule != null) {
            Module defaultModule = enumModule.toDefaultModel();
            moduleRepository.save(moduleId, defaultModule);
            return defaultModule;
        }
        
        // Fallback: Erstelle minimales Modul
        Module module = new Module();
        module.setId(moduleId);
        module.setIsInstalled(true);
        module.setIsActive(true);
        moduleRepository.save(moduleId, module);
        return module;
    }
}

