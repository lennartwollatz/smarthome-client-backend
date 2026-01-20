package com.smarthome.backend.server.db;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Verwaltet die Datenbankverbindung und initialisiert die Datenbank.
 */
public class DatabaseManager {
    private static final Logger logger = LoggerFactory.getLogger(DatabaseManager.class);
    
    private String dbUrl;
    private String dbUser;
    private String dbPassword;
    private Connection connection;
    
    public DatabaseManager(String dbUrl, String dbUser, String dbPassword) {
        this.dbUrl = dbUrl;
        this.dbUser = dbUser;
        this.dbPassword = dbPassword;
    }
    
    /**
     * Öffnet eine Verbindung zur Datenbank.
     */
    public void connect() throws SQLException {
        if (connection != null && !connection.isClosed()) {
            logger.debug("Datenbankverbindung bereits geöffnet");
            return;
        }
        
        logger.info("Verbinde mit Datenbank: {}", dbUrl);
        connection = DriverManager.getConnection(dbUrl, dbUser, dbPassword);
        logger.info("Datenbankverbindung erfolgreich hergestellt");
        
        // Initialisiere Datenbank-Schema
        initializeSchema();
    }
    
    /**
     * Initialisiert das Datenbank-Schema.
     * Erstellt die Haupttabelle für alle Model-Klassen und Indizes für bessere Performance.
     */
    private void initializeSchema() throws SQLException {
        logger.info("Initialisiere Datenbank-Schema...");
        
        // Haupttabelle für alle Model-Klassen (JSON-basiert)
        String createTableSql = "CREATE TABLE IF NOT EXISTS objects (" +
            "id VARCHAR(255) NOT NULL, " +
            "type VARCHAR(255) NOT NULL, " +
            "data TEXT NOT NULL, " +
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
            "PRIMARY KEY (id, type)" +
            ")";
        
        // Index für schnelle Suche nach Typ
        String createTypeIndexSql = "CREATE INDEX IF NOT EXISTS idx_objects_type ON objects(type)";
        
        // Index für Suche nach Erstellungsdatum
        String createCreatedAtIndexSql = "CREATE INDEX IF NOT EXISTS idx_objects_created_at ON objects(created_at DESC)";
        
        try (Statement stmt = connection.createStatement()) {
            stmt.execute(createTableSql);
            logger.debug("Tabelle 'objects' erstellt");
            
            stmt.execute(createTypeIndexSql);
            logger.debug("Index 'idx_objects_type' erstellt");
            
            stmt.execute(createCreatedAtIndexSql);
            logger.debug("Index 'idx_objects_created_at' erstellt");
            
            logger.info("Datenbank-Schema erfolgreich initialisiert");
        }
    }
    
    /**
     * Gibt die aktuelle Datenbankverbindung zurück.
     * WARNUNG: Diese Connection ist nicht thread-safe und sollte nur im Hauptthread verwendet werden.
     * Für asynchrone Operationen verwende createNewConnection().
     */
    public Connection getConnection() throws SQLException {
        if (connection == null || connection.isClosed()) {
            connect();
        }
        return connection;
    }
    
    /**
     * Erstellt eine neue Datenbankverbindung für thread-safe Operationen.
     * Diese Methode sollte für asynchrone Operationen verwendet werden.
     * Die Connection muss vom Aufrufer geschlossen werden.
     * 
     * @return Eine neue Datenbankverbindung
     * @throws SQLException bei Fehlern beim Erstellen der Verbindung
     */
    public Connection createNewConnection() throws SQLException {
        // Stelle sicher, dass das Schema initialisiert ist
        if (connection == null || connection.isClosed()) {
            connect();
        }
        
        // Erstelle eine neue Connection für diesen Thread
        Connection newConn = DriverManager.getConnection(dbUrl, dbUser, dbPassword);
        logger.debug("Neue Datenbankverbindung erstellt für Thread: {}", Thread.currentThread().getName());
        return newConn;
    }
    
    /**
     * Schließt die Datenbankverbindung.
     */
    public void close() {
        if (connection != null) {
            try {
                if (!connection.isClosed()) {
                    connection.close();
                    logger.info("Datenbankverbindung geschlossen");
                }
            } catch (SQLException e) {
                logger.error("Fehler beim Schließen der Datenbankverbindung", e);
            }
        }
    }
    
    /**
     * Prüft, ob die Verbindung aktiv ist.
     */
    public boolean isConnected() {
        try {
            return connection != null && !connection.isClosed();
        } catch (SQLException e) {
            return false;
        }
    }
    
    /**
     * Gibt eine Liste aller gespeicherten Objekttypen zurück.
     * 
     * @return Liste der eindeutigen Typnamen
     */
    public List<String> getAllTypes() {
        List<String> types = new ArrayList<>();
        String sql = "SELECT DISTINCT type FROM objects ORDER BY type";
        
        try {
            Connection conn = getConnection();
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(sql)) {
                
                while (rs.next()) {
                    types.add(rs.getString("type"));
                }
                
                logger.debug("{} verschiedene Objekttypen gefunden", types.size());
                return types;
            }
        } catch (SQLException e) {
            logger.error("Fehler beim Abrufen der Objekttypen", e);
            throw new RuntimeException("Fehler beim Abrufen der Objekttypen", e);
        }
    }
    
    /**
     * Zählt alle Objekte in der Datenbank.
     * 
     * @return Gesamtanzahl aller Objekte
     */
    public long countAllObjects() {
        String sql = "SELECT COUNT(*) FROM objects";
        
        try {
            Connection conn = getConnection();
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery(sql)) {
                
                if (rs.next()) {
                    long count = rs.getLong(1);
                    logger.debug("Gesamtanzahl Objekte: {}", count);
                    return count;
                }
                
                return 0;
            }
        } catch (SQLException e) {
            logger.error("Fehler beim Zählen aller Objekte", e);
            throw new RuntimeException("Fehler beim Zählen aller Objekte", e);
        }
    }
    
    /**
     * Zählt alle Objekte eines bestimmten Typs.
     * 
     * @param type Der Typ der Objekte
     * @return Anzahl der Objekte dieses Typs
     */
    public long countObjectsByType(String type) {
        String sql = "SELECT COUNT(*) FROM objects WHERE type = ?";
        
        try {
            Connection conn = getConnection();
            try (java.sql.PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, type);
                
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        long count = rs.getLong(1);
                        logger.debug("Anzahl Objekte vom Typ {}: {}", type, count);
                        return count;
                    }
                }
                
                return 0;
            }
        } catch (SQLException e) {
            logger.error("Fehler beim Zählen der Objekte vom Typ {}", type, e);
            throw new RuntimeException("Fehler beim Zählen der Objekte", e);
        }
    }
    
    /**
     * Löscht alle Objekte eines bestimmten Typs.
     * 
     * @param type Der Typ der zu löschenden Objekte
     * @return Anzahl der gelöschten Objekte
     */
    public int deleteAllByType(String type) {
        String sql = "DELETE FROM objects WHERE type = ?";
        
        try {
            Connection conn = getConnection();
            try (java.sql.PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, type);
                int deleted = stmt.executeUpdate();
                
                logger.info("{} Objekte vom Typ {} gelöscht", deleted, type);
                return deleted;
            }
        } catch (SQLException e) {
            logger.error("Fehler beim Löschen der Objekte vom Typ {}", type, e);
            throw new RuntimeException("Fehler beim Löschen der Objekte", e);
        }
    }
    
    /**
     * Löscht alle Objekte aus der Datenbank.
     * 
     * @return Anzahl der gelöschten Objekte
     */
    public int deleteAllObjects() {
        String sql = "DELETE FROM objects";
        
        try {
            Connection conn = getConnection();
            try (Statement stmt = conn.createStatement()) {
                int deleted = stmt.executeUpdate(sql);
                logger.warn("Alle {} Objekte aus der Datenbank gelöscht", deleted);
                return deleted;
            }
        } catch (SQLException e) {
            logger.error("Fehler beim Löschen aller Objekte", e);
            throw new RuntimeException("Fehler beim Löschen aller Objekte", e);
        }
    }
}

