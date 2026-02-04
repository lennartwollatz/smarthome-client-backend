package com.smarthome.backend.model.devices;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import com.google.gson.annotations.JsonAdapter;
import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceListenerParams;
import com.smarthome.backend.model.devices.helper.DeviceType;
import com.smarthome.backend.model.devices.helper.DeviceTypeAdapter;

import lombok.Data;

/**
 * Repräsentiert ein Gerät im Smart Home System mit allen zugehörigen Eigenschaften
 * und Funktionen.
 */
@Data
public class Device {

   // Zentrale HashMap für Trigger-Listener mit DeviceListenerParams
    // transient: Wird nicht serialisiert, da Listener zur Laufzeit neu erstellt werden
    protected transient Map<String, List<DeviceListenerPair>> triggerListeners = new HashMap<>();

    protected String id;
    protected String name;
    protected String room;
    protected String icon;
    
    @JsonAdapter(DeviceTypeAdapter.class)
    private DeviceType type;
    
    @SerializedName("typeLabel")
    private String typeLabel;
    
    @SerializedName("moduleId")
    private String moduleId;
    
    @SerializedName("isConnected")
    protected Boolean isConnected;
    
    protected transient Boolean isConnecting; // Optional - transient: Wird nicht in der Datenbank gespeichert
    protected transient List<String> functionsBool; // Optional - transient: Wird nicht in der Datenbank gespeichert
    protected transient List<String> functionsAction; // Optional - transient: Wird nicht in der Datenbank gespeichert
    protected transient List<String> functionsTrigger; // Optional - transient: Wird nicht in der Datenbank gespeichert

    @SerializedName("hasBattery")
    protected Boolean hasBattery = false;
    @SerializedName("batteryLevel")
    protected Integer batteryLevel = 0;
    
    @SerializedName("quickAccess")
    protected Boolean quickAccess = false;

    /**
     * Initialisiert triggerListeners, falls es null ist (z.B. nach Deserialisierung).
     */
    private void ensureTriggerListenersInitialized() {
        if (triggerListeners == null) {
            triggerListeners = new HashMap<>();
        }
    }

    /**
     * Zentrale Methode zum Registrieren von Trigger-Listenern mit DeviceListenerParams.
     *
     * @param params   Die Parameter für den Listener (name, param1, param2)
     * @param listener Die Callback-Funktion, die aufgerufen wird
     */
    public void addListener(DeviceListenerParams params, Runnable listener) {
        if (params == null || params.getName() == null || listener == null) {
            return;
        }

        ensureTriggerListenersInitialized();
        String triggerName = params.getName();
        triggerListeners.computeIfAbsent(triggerName, k -> new CopyOnWriteArrayList<>())
                        .add(new DeviceListenerPair(params, listener));
    }

    /**
     * Zentrale Methode zum Registrieren von Trigger-Listenern mit DeviceListenerParams, die einen Parameter akzeptieren.
     *
     * @param params   Die Parameter für den Listener (name, param1, param2)
     * @param listener Die Callback-Funktion, die mit einem Parameter aufgerufen wird
     */
    public void addListener(DeviceListenerParams params, java.util.function.Consumer<Object> listener) {
        if (params == null || params.getName() == null || listener == null) {
            return;
        }

        ensureTriggerListenersInitialized();
        String triggerName = params.getName();
        triggerListeners.computeIfAbsent(triggerName, k -> new CopyOnWriteArrayList<>())
                        .add(new DeviceListenerPair(params, listener));
    }

    /**
     * Zentrale Methode zum Registrieren von Trigger-Listenern mit DeviceListenerParams.
     *
     * @param key      Die Key des Listeners
     * @param name     Der Name des Listeners
     */
    public void removeListener(String key, String name) {
        if (key == null || name == null || triggerListeners == null) {
            return;
        }
        if( triggerListeners.containsKey(name) ) {
            triggerListeners.get(name).removeIf(listener -> listener.getParams().getKey().equals(key));
        }
    }

    /**
     * Zentrale Methode zum Entfernen aller Trigger-Listener.
     */
    public void removeAllListeners() {
        ensureTriggerListenersInitialized();
        triggerListeners.clear();
    }

    /**
     * Öffentliche Methode zum Prüfen von Listenern für einen bestimmten Trigger.
     * Ruft die protected checkListener-Methode auf.
     * 
     * @param triggerName Der Name des Triggers, für den die Listener geprüft werden sollen
     */
    public void triggerCheckListener(String triggerName) {
        checkListener(triggerName);
    }

    protected void checkListener(String triggerName) {}
    protected void initializeFunctionsBool() {};
    protected void initializeFunctionsAction() {};
    protected void initializeFunctionsTrigger() {};
}

