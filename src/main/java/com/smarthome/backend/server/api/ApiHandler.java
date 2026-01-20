package com.smarthome.backend.server.api;

import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.events.EventStreamManager;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

import com.smarthome.backend.server.actions.ActionManager;

/**
 * Handles HTTP API requests for the ngrok server.
 */
public class ApiHandler implements HttpHandler {
    private static final Logger logger = LoggerFactory.getLogger(ApiHandler.class);
    
    private ApiRouter apiRouter;
    
    public ApiHandler(DatabaseManager databaseManager, EventStreamManager eventStreamManager, ActionManager actionManager) {
        this.apiRouter = new ApiRouter(databaseManager, eventStreamManager, actionManager);
    }
    
    @Override
    public void handle(HttpExchange exchange) throws IOException {
        long startTime = System.currentTimeMillis();
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        String remoteAddress = exchange.getRemoteAddress() != null ? 
            exchange.getRemoteAddress().getAddress().getHostAddress() : "unknown";
        
        // Setze CORS-Header für alle Anfragen
        setCorsHeaders(exchange);
        
        // Log eingehende Anfrage
        logger.info(">>> Eingehende Anfrage: {} {} von {}", method, path, remoteAddress);
        
        try {
            // Behandle OPTIONS-Preflight-Anfragen direkt
            if ("OPTIONS".equals(method)) {
                handleOptionsRequest(exchange);
                long duration = System.currentTimeMillis() - startTime;
                logger.info("<<< OPTIONS-Anfrage verarbeitet: {} - Dauer: {}ms", path, duration);
                return;
            }
            
            // Leite Anfrage an Router weiter
            apiRouter.handleRequest(exchange);
            
            long duration = System.currentTimeMillis() - startTime;
            logger.info("<<< Anfrage verarbeitet: {} {} ({})- Dauer: {}ms", 
                method, path, exchange.getResponseCode(), duration);
                
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            logger.error("Fehler bei Verarbeitung der Anfrage {} {} - Dauer: {}ms", 
                method, path, duration, e);
            
            // Sende Fehlerantwort
            try {
                String errorResponse = "{\"error\": \"" + e.getMessage() + "\"}";
                ApiRouter.sendResponse(exchange, 500, errorResponse);
            } catch (IOException ioException) {
                logger.error("Fehler beim Senden der Fehlerantwort", ioException);
            }
        }
    }
    
    /**
     * Setzt CORS-Header für Cross-Origin-Anfragen.
     */
    private void setCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "3600");
    }
    
    /**
     * Behandelt OPTIONS-Preflight-Anfragen.
     */
    private void handleOptionsRequest(HttpExchange exchange) throws IOException {
        exchange.sendResponseHeaders(200, -1);
        exchange.close();
    }
}

