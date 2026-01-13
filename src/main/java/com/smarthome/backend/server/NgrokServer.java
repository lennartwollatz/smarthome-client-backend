package com.smarthome.backend.server;

import com.smarthome.backend.server.api.ApiHandler;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;
import com.sun.net.httpserver.HttpServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.sql.SQLException;

/**
 * Main class for the ngrok server implementation.
 * This server handles HTTP API requests and database management.
 */
public class NgrokServer {
    private static final Logger logger = LoggerFactory.getLogger(NgrokServer.class);
    
    private int port;
    private DatabaseManager databaseManager;
    private HttpServer httpServer;
    
    public NgrokServer(int port) {
        this.port = port;
        
        // Initialisiere Datenbank mit Standard-Konfiguration
        // Kann auch über Konfigurationsdatei geladen werden
        String dbUrl = System.getProperty("db.url", "jdbc:h2:./data/smarthome");
        String dbUser = System.getProperty("db.user", "sa");
        String dbPassword = System.getProperty("db.password", "");
        this.databaseManager = new DatabaseManager(dbUrl, dbUser, dbPassword);
    }
    
    public NgrokServer(int port, String dbUrl, String dbUser, String dbPassword) {
        this.port = port;
        this.databaseManager = new DatabaseManager(dbUrl, dbUser, dbPassword);
    }
    
    public void start() {
        logger.info("========================================");
        logger.info("Starte ngrok Server auf Port {}", port);
        logger.info("========================================");
        
        // Initialisiere Datenbank
        try {
            databaseManager.connect();
            logger.info("Datenbank erfolgreich initialisiert");
        } catch (SQLException e) {
            logger.error("Fehler beim Initialisieren der Datenbank", e);
            throw new RuntimeException("Datenbank konnte nicht initialisiert werden", e);
        }
        
        // Starte HTTP-Server
        try {
            httpServer = HttpServer.create(new InetSocketAddress(port), 0);
            
            // Erstelle API Handler
            ApiHandler apiHandler = new ApiHandler(databaseManager);
            
            // Registriere Handler für alle API-Routen
            httpServer.createContext("/", apiHandler);
            
            // Starte Server
            httpServer.setExecutor(null); // Verwendet Standard-Executor
            httpServer.start();
            
            logger.info("HTTP-Server gestartet auf Port {}", port);
            logger.info("API-Endpunkte verfügbar unter: http://localhost:{}/", port);
        } catch (IOException e) {
            logger.error("Fehler beim Starten des HTTP-Servers", e);
            throw new RuntimeException("HTTP-Server konnte nicht gestartet werden", e);
        }
        
        logger.info("Server bereit für Anfragen");
    }
    
    public void stop() {
        logger.info("========================================");
        logger.info("Stoppe ngrok Server");
        logger.info("========================================");
        
        // Stoppe HTTP-Server
        if (httpServer != null) {
            httpServer.stop(0);
            logger.info("HTTP-Server gestoppt");
        }
        
        // Schließe Datenbankverbindung
        databaseManager.close();
        
        logger.info("Server gestoppt");
    }
    
    /**
     * Gibt den DatabaseManager zurück, um auf die Datenbank zuzugreifen.
     * 
     * @return Der DatabaseManager
     */
    public DatabaseManager getDatabaseManager() {
        return databaseManager;
    }
    
    /**
     * Erstellt ein Repository für einen bestimmten Objekttyp.
     * 
     * @param typeClass Die Klasse des Objekttyps
     * @param <T> Der Typ der Objekte
     * @return Ein Repository für den angegebenen Typ
     */
    public <T> Repository<T> getRepository(Class<T> typeClass) {
        return new JsonRepository<>(databaseManager, typeClass);
    }
    
    public static void main(String[] args) {
        int port = 4040; // Default ngrok API port
        if (args.length > 0) {
            port = Integer.parseInt(args[0]);
        }
        
        NgrokServer server = new NgrokServer(port);
        server.start();
    }
}

