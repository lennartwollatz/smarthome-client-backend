package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceType;

/**
 * Repräsentiert einen Temperature Sensor (Temperatursensor) im Smart Home System.
 * Basisklasse ist {@link Device}. Zusätzliche Eigenschaften:
 * - temperature: Aktueller Temperaturwert
 */
public abstract class DeviceTemperature extends Device {
    
    /**
     * Enum für die Trigger-Funktionsnamen des Temperature-Sensors.
     */
    public static enum TriggerFunctionName {
        TEMPERATURE_CHANGED("temperatureChanged"),
        TEMPERATURE_GREATER("temperatureGreater(int)"),
        TEMPERATURE_LESS("temperatureLess(int)"),
        TEMPERATURE_EQUALS("temperatureEquals(int)");
        
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
     * Enum für die Action-Funktionsnamen des Temperature-Sensors.
     * Temperature Sensoren haben typischerweise keine Action-Funktionen,
     * da sie nur messen, nicht steuern.
     */
    public static enum ActionFunctionName {
        // Keine Action-Funktionen für Temperature Sensoren
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
     * Enum für die Bool-Funktionsnamen des Temperature-Sensors.
     */
    public static enum BoolFunctionName {
        TEMPERATURE_GREATER("temperatureGreater(int)"),
        TEMPERATURE_LESS("temperatureLess(int)"),
        TEMPERATURE_EQUALS("temperatureEquals(int)");
        
        private final String value;
        
        BoolFunctionName(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }

    /**
     * Aktueller Temperaturwert (z.B. in Grad Celsius).
     */
    @SerializedName("temperature")
    protected Integer temperature;
    
    /**
     * Standard-Konstruktor.
     * Setzt den Typ automatisch auf "temperature" und initialisiert die Funktionen.
     */
    public DeviceTemperature() {
        super();
        setType(DeviceType.TEMPERATURE);
        setIcon("&#127777;"); // Thermometer als Standard-Icon für Temperature Sensor
        setTypeLabel("deviceType.temperature");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Konstruktor mit Name und ID.
     * 
     * @param name Der Name des Temperature-Sensors
     * @param id Die eindeutige ID des Temperature-Sensors
     */
    public DeviceTemperature(String name, String id) {
        super();
        setName(name);
        setId(id);
        setType(DeviceType.TEMPERATURE);
        setIcon("&#127777;");
        setTypeLabel("deviceType.temperature");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    public abstract void updateValues();
    
    /**
     * Initialisiert die Liste der booleschen Funktionen für den Temperature-Sensor.
     */
    @Override
    protected void initializeFunctionsBool() {
        List<String> functions = new ArrayList<>();
        functions.add(BoolFunctionName.TEMPERATURE_GREATER.getValue());
        functions.add(BoolFunctionName.TEMPERATURE_LESS.getValue());
        functions.add(BoolFunctionName.TEMPERATURE_EQUALS.getValue());
        setFunctionsBool(functions);
    }
    
    /**
     * Initialisiert die Liste der Action-Funktionen für den Temperature-Sensor.
     */
    @Override
    protected void initializeFunctionsAction() {
        List<String> functions = new ArrayList<>();
        // Temperature Sensoren haben typischerweise keine Action-Funktionen
        setFunctionsAction(functions);
    }
    
    /**
     * Initialisiert die Liste der Trigger-Funktionen für den Temperature-Sensor.
     */
    @Override
    protected void initializeFunctionsTrigger() {
        List<String> functions = new ArrayList<>();
        functions.add(TriggerFunctionName.TEMPERATURE_CHANGED.getValue());
        functions.add(TriggerFunctionName.TEMPERATURE_GREATER.getValue());
        functions.add(TriggerFunctionName.TEMPERATURE_LESS.getValue());
        functions.add(TriggerFunctionName.TEMPERATURE_EQUALS.getValue());
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
        
        if(TriggerFunctionName.TEMPERATURE_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.TEMPERATURE_GREATER.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && temperatureGreater(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.TEMPERATURE_LESS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && temperatureLess(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.TEMPERATURE_EQUALS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer targetTemperature = pair.getParams().getParam1AsInt();
                return targetTemperature != null && temperatureEquals(targetTemperature);
            }).forEach(DeviceListenerPair::run);
        }
    }
    
    /**
     * Prüft, ob die Temperatur größer als der angegebene Wert ist.
     * 
     * @param threshold Der Vergleichswert
     * @return true wenn die Temperatur größer ist, false sonst
     */
    public boolean temperatureGreater(int threshold) {
        return this.temperature != null && this.temperature > threshold;
    }
    
    /**
     * Prüft, ob die Temperatur kleiner als der angegebene Wert ist.
     * 
     * @param threshold Der Vergleichswert
     * @return true wenn die Temperatur kleiner ist, false sonst
     */
    public boolean temperatureLess(int threshold) {
        return this.temperature != null && this.temperature < threshold;
    }
    
    /**
     * Prüft, ob die Temperatur genau dem angegebenen Wert entspricht.
     * 
     * @param value Der Vergleichswert
     * @return true wenn die Temperatur dem Wert entspricht, false sonst
     */
    public boolean temperatureEquals(int value) {
        return this.temperature != null && this.temperature == value;
    }
    
    /**
     * Setzt den Temperaturwert des Sensors.
     * 
     * @param temperature Der neue Temperaturwert
     */
    public void setTemperature(int temperature, boolean execute) {
        this.temperature = temperature;
        if( execute ){ this.executeSetTemperature(temperature); }
        
        checkListener(TriggerFunctionName.TEMPERATURE_CHANGED.getValue());
        checkListener(TriggerFunctionName.TEMPERATURE_GREATER.getValue());
        checkListener(TriggerFunctionName.TEMPERATURE_LESS.getValue());
        checkListener(TriggerFunctionName.TEMPERATURE_EQUALS.getValue());
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um den Temperaturwert am tatsächlichen Gerät zu setzen.
     * 
     * @param temperature Der neue Temperaturwert
     */
    protected abstract void executeSetTemperature(int temperature);
}

