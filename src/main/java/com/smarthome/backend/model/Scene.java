package com.smarthome.backend.model;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.annotations.SerializedName;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

/**
 * Repräsentiert eine Szene, die mehrere Aktionen zusammenfasst.
 */
@Data
@Getter
@Setter
public class Scene {
    private String id;
    private String name;
    private String icon; // Optional
    private Boolean active; // Optional, Standard: false
    private String description; // Optional
    
    @SerializedName("actionIds")
    private List<String> actionIds;
    
    public List<String> getActions() {
        return actionIds;
    }

    // Zentrale HashMap für Trigger-Listener
    private final Map<String, Runnable> triggerListeners = new HashMap<>();

    /**
     * Zentrale Methode zum Registrieren von Trigger-Listenern.
     *
     * @param actionId   Die ID der Aktion
     * @param listener Die Runnable, die aufgerufen wird
     */
    public void addListener(String actionId, Runnable listener) {
        triggerListeners.put(actionId, listener);
    }

    /**
     * Zentrale Methode zum Entfernen von Trigger-Listenern .
     *
     * @param actionId   Die ID der Aktion
     */
    public void removeListener(String actionId) {
        triggerListeners.remove(actionId);
    }

     /**
     * Zentrale Methode zum Entfernen aller Trigger-Listener.
     */
     public void removeAllListeners() {
        triggerListeners.clear();
    }

    /**
     * Zentrale Methode zum Ausführen der Aktionen.
     */
    public void onToggle(){
        triggerListeners.entrySet().forEach(entry -> entry.getValue().run());
    }
}
