package com.smarthome.backend.server.db;

import java.util.List;
import java.util.Optional;

/**
 * Generisches Repository-Interface für das Speichern und Abrufen von Objekten.
 * 
 * @param <T> Der Typ der zu speichernden Objekte
 */
public interface Repository<T> {
    
    /**
     * Speichert ein Objekt in der Datenbank.
     * 
     * @param id Die eindeutige ID des Objekts
     * @param object Das zu speichernde Objekt
     * @return Das gespeicherte Objekt
     */
    T save(String id, T object);
    
    /**
     * Ruft ein Objekt anhand seiner ID ab.
     * 
     * @param id Die ID des Objekts
     * @return Optional mit dem gefundenen Objekt oder leer, wenn nicht gefunden
     */
    Optional<T> findById(String id);
    
    /**
     * Ruft alle Objekte eines bestimmten Typs ab.
     * 
     * @return Liste aller Objekte
     */
    List<T> findAll();
    
    /**
     * Löscht ein Objekt anhand seiner ID.
     * 
     * @param id Die ID des zu löschenden Objekts
     * @return true, wenn das Objekt gefunden und gelöscht wurde
     */
    boolean deleteById(String id);
    
    /**
     * Prüft, ob ein Objekt mit der gegebenen ID existiert.
     * 
     * @param id Die ID des Objekts
     * @return true, wenn das Objekt existiert
     */
    boolean existsById(String id);
    
    /**
     * Zählt alle Objekte dieses Typs.
     * 
     * @return Die Anzahl der Objekte
     */
    long count();
}

