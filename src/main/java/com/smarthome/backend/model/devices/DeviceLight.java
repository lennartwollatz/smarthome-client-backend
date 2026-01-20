package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceType;

/**
 * Repräsentiert ein Licht (Lampe) im Smart Home System.
 * Basisklasse ist {@link Device}. Zusätzliche Eigenschaften:
 * - on: Gibt an, ob die Lampe ein- oder ausgeschaltet ist.
 *
 * Die Klasse stellt Bool-, Action- und Trigger-Funktionen bereit:
 * Bool-Funktionen:
 *  - on
 *  - off
 *
 * Action-Funktionen:
 *  - setOn
 *  - setOff
 *
 * Trigger-Funktionen:
 *  - toggled
 *  - onOn
 *  - onOff
 */
public abstract class DeviceLight extends Device {
    /**
     * Enum für die Trigger-Funktionsnamen der Lampe.
     */
    public static enum TriggerFunctionName {
        TOGGLED("toggled"),
        ON_ON("onOn"),
        ON_OFF("onOff");

        private static boolean hasValue(String triggerName) {
            return Arrays.stream(TriggerFunctionName.values()).anyMatch(trigger -> trigger.getValue().equals(triggerName));
        }

        private final String value;

        TriggerFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Enum für die Action-Funktionsnamen der Lampe.
     */
    public static enum ActionFunctionName {
        SET_ON("setOn"),
        SET_OFF("setOff"),
        TOGGLE("toggle");

        private final String value;

        ActionFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Enum für die Bool-Funktionsnamen der Lampe.
     */
    public static enum BoolFunctionName {
        ON("on"),
        OFF("off");

        private final String value;

        BoolFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Gibt an, ob die Lampe eingeschaltet ist.
     */
    @SerializedName("on")
    protected Boolean on;

    /**
     * Standard-Konstruktor.
     * Setzt den Typ automatisch auf "light" und initialisiert die Funktionen.
     */
    public DeviceLight() {
        super();
        setType(DeviceType.LIGHT);
        setIcon("&#128161;"); // Glühbirne als Standard-Icon
        setTypeLabel("deviceType.light");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Konstruktor mit Name und ID.
     *
     * @param name Der Name der Lampe
     * @param id   Die eindeutige ID der Lampe
     */
    public DeviceLight(String name, String id) {
        super();
        setName(name);
        setId(id);
        setType(DeviceType.LIGHT);
        setIcon("&#128161;");
        setTypeLabel("deviceType.light");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    public abstract void updateValues();

    /**
     * Initialisiert die Liste der booleschen Funktionen für die Lampe.
     */
    @Override
    protected void initializeFunctionsBool() {
        List<String> functions = new ArrayList<>();
        functions.add(BoolFunctionName.ON.getValue());
        functions.add(BoolFunctionName.OFF.getValue());
        setFunctionsBool(functions);
    }

    /**
     * Initialisiert die Liste der Action-Funktionen für die Lampe.
     */
    @Override
    protected void initializeFunctionsAction() {
        List<String> functions = new ArrayList<>();
        functions.add(ActionFunctionName.SET_ON.getValue());
        functions.add(ActionFunctionName.SET_OFF.getValue());
        setFunctionsAction(functions);
    }

    /**
     * Initialisiert die Liste der Trigger-Funktionen für die Lampe.
     */
    @Override
    protected void initializeFunctionsTrigger() {
        List<String> functions = new ArrayList<>();
        functions.add(TriggerFunctionName.TOGGLED.getValue());
        functions.add(TriggerFunctionName.ON_ON.getValue());
        functions.add(TriggerFunctionName.ON_OFF.getValue());
        setFunctionsTrigger(functions);
    }


    @Override
    protected void checkListener(String triggerName) {
        super.checkListener(triggerName);
        if( triggerName == null || triggerName.isEmpty() || ! TriggerFunctionName.hasValue(triggerName) ) {
            return;
        }
        List<DeviceListenerPair> listeners = triggerListeners.get(triggerName);
        if (listeners == null || listeners.isEmpty()) {
            return;
        }

        // Für alle Trigger-Typen: alle zugehörigen Listener ausführen
        listeners.forEach(DeviceListenerPair::run);
    }

    /**
     * Bool-Funktion: Gibt zurück, ob die Lampe eingeschaltet ist.
     *
     * @return true, wenn die Lampe an ist, sonst false
     */
    public boolean on() {
        return Boolean.TRUE.equals(this.on);
    }

    /**
     * Bool-Funktion: Gibt zurück, ob die Lampe ausgeschaltet ist.
     *
     * @return true, wenn die Lampe aus ist, sonst false
     */
    public boolean off() {
        return !on();
    }

    /**
     * Action-Funktion: Schaltet die Lampe ein.
     */
    public void setOn(boolean execute) {
        Boolean oldOn = this.on;
        this.on = true;
        if( execute ){ this.executeSetOn(); }
        
        checkListener(TriggerFunctionName.ON_ON.getValue());
        boolean changed = (oldOn == null) || !oldOn.equals(this.on);
        if (changed) {
            checkListener(TriggerFunctionName.TOGGLED.getValue());
        }
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um den Schaltzustand am tatsächlichen Gerät zu setzen.
     *
     */
    protected abstract void executeSetOn();

    /**
     * Action-Funktion: Schaltet die Lampe aus.
     */
    public void setOff(boolean execute) {
        Boolean oldOn = this.on;
        this.on = false;
        if( execute ){ this.executeSetOff(); }
        
        checkListener(TriggerFunctionName.ON_OFF.getValue());
        boolean changed = (oldOn == null) || !oldOn.equals(this.on);
        if (changed) {
            checkListener(TriggerFunctionName.TOGGLED.getValue());
        }
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um den Schaltzustand am tatsächlichen Gerät zu setzen.
     *
     */
    protected abstract void executeSetOff();

     /**
     * Action-Funktion: Schaltet die Lampe aus.
     */
     public void toggle() {
        this.on = !this.on;
        
        if( this.on ) {
            this.executeSetOn();
        } else {
            this.executeSetOff();
        }

        checkListener(TriggerFunctionName.TOGGLED.getValue());
        if( this.on ) {
            checkListener(TriggerFunctionName.ON_ON.getValue());
        } else {
            checkListener(TriggerFunctionName.ON_OFF.getValue());
        }
    }

}


