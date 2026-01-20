package com.smarthome.backend.server.db;

import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.ExclusionStrategy;
import com.google.gson.FieldAttributes;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

/**
 * JSON-basierte Repository-Implementierung, die Objekte als JSON in der Datenbank speichert.
 * 
 * @param <T> Der Typ der zu speichernden Objekte
 */
public class JsonRepository<T> implements Repository<T> {
    private static final Logger logger = LoggerFactory.getLogger(JsonRepository.class);
    private static final Gson gson = new GsonBuilder()
        .setPrettyPrinting()
        .addSerializationExclusionStrategy(new ExclusionStrategy() {
            @Override
            public boolean shouldSkipField(FieldAttributes f) {
                // Überspringe ThreadLocal-Felder
                if (f.getDeclaredClass() == java.lang.ThreadLocal.class) {
                    return true;
                }
                // Überspringe transient-Felder
                if (f.hasModifier(java.lang.reflect.Modifier.TRANSIENT)) {
                    return true;
                }
                // Überspringe Felder, die ThreadLocal enthalten (z.B. in Lambda-Ausdrücken)
                try {
                    Field field = f.getDeclaringClass().getDeclaredField(f.getName());
                    if (field != null) {
                        Class<?> fieldType = field.getType();
                        if (java.lang.ThreadLocal.class.isAssignableFrom(fieldType)) {
                            return true;
                        }
                    }
                } catch (NoSuchFieldException | SecurityException e) {
                    // Ignoriere Fehler beim Zugriff auf das Feld
                }
                return false;
            }

            @Override
            public boolean shouldSkipClass(Class<?> clazz) {
                // Überspringe ThreadLocal-Klassen
                return java.lang.ThreadLocal.class.isAssignableFrom(clazz);
            }
        })
        .create();
    
    private final DatabaseManager dbManager;
    private final Class<T> typeClass;
    private final String typeName;
    
    public JsonRepository(DatabaseManager dbManager, Class<T> typeClass) {
        this.dbManager = dbManager;
        this.typeClass = typeClass;
        this.typeName = typeClass.getSimpleName();
    }
    
    @Override
    public T save(String id, T object) {
        logger.info(">>> SPEICHERE: Typ={}, ID={}", typeName, id);
        
        String json = gson.toJson(object);
        int jsonSize = json.length();
        String sql = "MERGE INTO objects (id, type, data, updated_at) " +
            "VALUES (?, ?, ?, CURRENT_TIMESTAMP)";
        
        try (Connection conn = dbManager.createNewConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, id);
            stmt.setString(2, typeName);
            stmt.setString(3, json);
            stmt.executeUpdate();
            
            // Logge eine Zusammenfassung der Daten (erste 200 Zeichen)
            String dataPreview = json.length() > 200 ? json.substring(0, 200) + "..." : json;
            logger.info(">>> GESPEICHERT: Typ={}, ID={}, Größe={} Bytes, Daten-Vorschau: {}", 
                typeName, id, jsonSize, dataPreview.replaceAll("\\s+", " "));
            return object;
        } catch (SQLException e) {
            logger.error("Fehler beim Speichern des Objekts {} mit ID {}", typeName, id, e);
            throw new RuntimeException("Fehler beim Speichern in der Datenbank", e);
        }
    }
    
    @Override
    public Optional<T> findById(String id) {
        logger.info("<<< LESE: Typ={}, ID={}", typeName, id);
        
        String sql = "SELECT data FROM objects WHERE id = ? AND type = ?";
        
        try (Connection conn = dbManager.createNewConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, id);
            stmt.setString(2, typeName);
            
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    String json = rs.getString("data");
                    T object = gson.fromJson(json, typeClass);
                    int jsonSize = json.length();
                    String dataPreview = json.length() > 200 ? json.substring(0, 200) + "..." : json;
                    logger.info("<<< GEFUNDEN: Typ={}, ID={}, Größe={} Bytes, Daten-Vorschau: {}", 
                        typeName, id, jsonSize, dataPreview.replaceAll("\\s+", " "));
                    return Optional.of(object);
                } else {
                    logger.info("<<< NICHT GEFUNDEN: Typ={}, ID={}", typeName, id);
                    return Optional.empty();
                }
            }
        } catch (SQLException e) {
            logger.error("Fehler beim Abrufen des Objekts {} mit ID {}", typeName, id, e);
            throw new RuntimeException("Fehler beim Abrufen aus der Datenbank", e);
        }
    }
    
    @Override
    public List<T> findAll() {
        logger.info("<<< LESE ALLE: Typ={}", typeName);
        
        String sql = "SELECT id, data FROM objects WHERE type = ? ORDER BY created_at DESC";
        List<T> results = new ArrayList<>();
        List<String> foundIds = new ArrayList<>();
        
        try (Connection conn = dbManager.createNewConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, typeName);
            
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    String id = rs.getString("id");
                    String json = rs.getString("data");
                    T object = gson.fromJson(json, typeClass);
                    results.add(object);
                    foundIds.add(id);
                }
            }
            
            logger.info("<<< GEFUNDEN: Typ={}, Anzahl={}, IDs={}", typeName, results.size(), foundIds);
            return results;
        } catch (SQLException e) {
            logger.error("Fehler beim Abrufen aller Objekte vom Typ {}", typeName, e);
            throw new RuntimeException("Fehler beim Abrufen aus der Datenbank", e);
        }
    }
    
    @Override
    public boolean deleteById(String id) {
        logger.info(">>> LÖSCHE: Typ={}, ID={}", typeName, id);
        
        String sql = "DELETE FROM objects WHERE id = ? AND type = ?";
        
        try (Connection conn = dbManager.createNewConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, id);
            stmt.setString(2, typeName);
            
            int rowsAffected = stmt.executeUpdate();
            boolean deleted = rowsAffected > 0;
            
            if (deleted) {
                logger.info(">>> GELÖSCHT: Typ={}, ID={}", typeName, id);
            } else {
                logger.info(">>> NICHT GEFUNDEN ZUM LÖSCHEN: Typ={}, ID={}", typeName, id);
            }
            
            return deleted;
        } catch (SQLException e) {
            logger.error("Fehler beim Löschen des Objekts {} mit ID {}", typeName, id, e);
            throw new RuntimeException("Fehler beim Löschen aus der Datenbank", e);
        }
    }
    
    @Override
    public boolean existsById(String id) {
        logger.debug("Prüfe Existenz von Objekt {} mit ID: {}", typeName, id);
        
        String sql = "SELECT COUNT(*) FROM objects WHERE id = ? AND type = ?";
        
        try (Connection conn = dbManager.createNewConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, id);
            stmt.setString(2, typeName);
            
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
            
            return false;
        } catch (SQLException e) {
            logger.error("Fehler beim Prüfen der Existenz von Objekt {} mit ID {}", typeName, id, e);
            throw new RuntimeException("Fehler beim Prüfen in der Datenbank", e);
        }
    }
    
    @Override
    public long count() {
        logger.debug("Zähle Objekte vom Typ {}", typeName);
        
        String sql = "SELECT COUNT(*) FROM objects WHERE type = ?";
        
        try (Connection conn = dbManager.createNewConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, typeName);
            
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    long count = rs.getLong(1);
                    logger.debug("{} Objekte vom Typ {} gefunden", count, typeName);
                    return count;
                }
            }
            
            return 0;
        } catch (SQLException e) {
            logger.error("Fehler beim Zählen der Objekte vom Typ {}", typeName, e);
            throw new RuntimeException("Fehler beim Zählen in der Datenbank", e);
        }
    }
}

