package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceType;

/**
 * Repräsentiert einen Light Level Sensor (Helligkeitssensor) im Smart Home System.
 * Basisklasse ist {@link Device}. Zusätzliche Eigenschaften:
 * - level: Aktueller Helligkeitswert
 */
public abstract class DeviceLightLevel extends Device {
    
    /**
     * Enum für die Trigger-Funktionsnamen des Light Level-Sensors.
     */
    public static enum TriggerFunctionName {
        LEVEL_CHANGED("levelChanged"),
        LEVEL_GREATER("levelGreater(int)"),
        LEVEL_LESS("levelLess(int)"),
        LEVEL_REACHES("levelReaches(int)"),
        DARK("dark"),
        BRIGHT("bright");
        
        private final String value;
        
        TriggerFunctionName(String value) {
            this.value = value;
        }

        private static boolean hasValue(String triggerName) {
            return Arrays.stream(TriggerFunctionName.values()).anyMatch(trigger -> trigger.getValue().equals(triggerName));
        }

        public String getValue() {
            return value;
        }
    }
    
    /**
     * Enum für die Action-Funktionsnamen des Light Level-Sensors.
     * Light Level Sensoren haben typischerweise keine Action-Funktionen,
     * da sie nur messen, nicht steuern.
     */
    public static enum ActionFunctionName {
        // Keine Action-Funktionen für Light Level Sensoren
        ;
        
        private final String value;
        
        ActionFunctionName(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }
    
    /**
     * Enum für die Bool-Funktionsnamen des Light Level-Sensors.
     */
    public static enum BoolFunctionName {
        DARK("dark"),
        BRIGHT("bright"),
        LEVEL_GREATER("levelGreater(int)"),
        LEVEL_LESS("levelLess(int)"),
        LEVEL_EQUALS("levelEquals(int)");
        
        private final String value;
        
        BoolFunctionName(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }

    /**
     * Aktueller Helligkeitswert (z.B. 0-100000 für Lux-Werte).
     */
    @SerializedName("level")
    protected Integer level;
    
    /**
     * Standard-Konstruktor.
     * Setzt den Typ automatisch auf "sensor" und initialisiert die Funktionen.
     */
    public DeviceLightLevel() {
        super();
        setType(DeviceType.LIGHT_LEVEL);
        setIcon("&#9728;"); // Sonne als Standard-Icon für Light Level Sensor
        setTypeLabel("deviceType.lightLevel");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Konstruktor mit Name und ID.
     * 
     * @param name Der Name des Light Level-Sensors
     * @param id Die eindeutige ID des Light Level-Sensors
     */
    public DeviceLightLevel(String name, String id) {
        super();
        setName(name);
        setId(id);
        setType(DeviceType.LIGHT_LEVEL);
        setIcon("&#128161;");
        setTypeLabel("deviceType.lightLevel");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    public abstract void updateValues();
    
    /**
     * Initialisiert die Liste der booleschen Funktionen für den Light Level-Sensor.
     */
    @Override
    protected void initializeFunctionsBool() {
        List<String> functions = new ArrayList<>();
        functions.add(BoolFunctionName.DARK.getValue());
        functions.add(BoolFunctionName.BRIGHT.getValue());
        functions.add(BoolFunctionName.LEVEL_GREATER.getValue());
        functions.add(BoolFunctionName.LEVEL_LESS.getValue());
        functions.add(BoolFunctionName.LEVEL_EQUALS.getValue());
        setFunctionsBool(functions);
    }
    
    /**
     * Initialisiert die Liste der Action-Funktionen für den Light Level-Sensor.
     */
    @Override
    protected void initializeFunctionsAction() {
        List<String> functions = new ArrayList<>();
        // Light Level Sensoren haben typischerweise keine Action-Funktionen
        setFunctionsAction(functions);
    }
    
    /**
     * Initialisiert die Liste der Trigger-Funktionen für den Light Level-Sensor.
     */
    @Override
    protected void initializeFunctionsTrigger() {
        List<String> functions = new ArrayList<>();
        functions.add(TriggerFunctionName.LEVEL_CHANGED.getValue());
        functions.add(TriggerFunctionName.LEVEL_GREATER.getValue());
        functions.add(TriggerFunctionName.LEVEL_LESS.getValue());
        functions.add(TriggerFunctionName.DARK.getValue());
        functions.add(TriggerFunctionName.BRIGHT.getValue());
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
        
        if(TriggerFunctionName.LEVEL_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.LEVEL_GREATER.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && levelGreater(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.LEVEL_LESS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && levelLess(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.DARK.getValue().equals(triggerName)) {
                listeners.stream().filter(pair -> {
                return dark();
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.BRIGHT.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                return bright();
            }).forEach(DeviceListenerPair::run);
        }
    }
    
    /**
     * Prüft, ob der Level größer als der angegebene Wert ist.
     * 
     * @param threshold Der Vergleichswert
     * @return true wenn der Level größer ist, false sonst
     */
    public boolean levelGreater(int threshold) {
        return this.level != null && this.level > threshold;
    }
    
    /**
     * Prüft, ob der Level kleiner als der angegebene Wert ist.
     * 
     * @param threshold Der Vergleichswert
     * @return true wenn der Level kleiner ist, false sonst
     */
    public boolean levelLess(int threshold) {
        return this.level != null && this.level < threshold;
    }
    
    /**
     * Prüft, ob der Level genau dem angegebenen Wert entspricht.
     * 
     * @param value Der Vergleichswert
     * @return true wenn der Level dem Wert entspricht, false sonst
     */
    public boolean levelEquals(int value) {
        return this.level != null && this.level == value;
    }
    
    /**
     * Prüft, ob es dunkel ist (Level unter dem Schwellenwert).
     * 
     * @param threshold Der Schwellenwert
     * @return true wenn es dunkel ist, false sonst
     */
    protected boolean dark() {
        return this.level != null && this.level < 7;
    }
    
    /**
     * Prüft, ob es hell ist (Level über oder gleich dem Schwellenwert).
     * 
     * @param threshold Der Schwellenwert
     * @return true wenn es hell ist, false sonst
     */
    protected boolean bright() {
        return this.level != null && this.level >= 7;
    }
    
    /**
     * Setzt den Helligkeitswert des Sensors.
     * 
     * @param level Der neue Helligkeitswert
     */
    public void setLevel(int level, boolean execute) {
        this.level = level;
        if( execute ){ this.executeSetLevel(level); }
        
        checkListener(TriggerFunctionName.LEVEL_CHANGED.getValue());
        checkListener(TriggerFunctionName.LEVEL_GREATER.getValue());
        checkListener(TriggerFunctionName.LEVEL_LESS.getValue());
        checkListener(TriggerFunctionName.DARK.getValue());
        checkListener(TriggerFunctionName.BRIGHT.getValue());
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um den Helligkeitswert am tatsächlichen Gerät zu setzen.
     * 
     * @param level Der neue Helligkeitswert
     */
    protected abstract void executeSetLevel(int level);
}

