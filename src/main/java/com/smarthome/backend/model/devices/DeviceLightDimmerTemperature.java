package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceType;

/**
 * Repräsentiert eine dimmbare Lampe mit Farbtemperatur im Smart Home System.
 * Basisklasse ist {@link DeviceLightDimmer}. Zusätzliche Eigenschaften:
 * - temperature: Farbtemperaturwert der Lampe
 *
 * Die Klasse erweitert DeviceLightDimmer um folgende Funktionen:
 * Bool-Funktionen:
 *  - temperatureEquals(int)
 *  - temperatureLess(int)
 *  - temperatureGreater(int)
 *
 * Action-Funktionen:
 *  - setTemperature(int)
 *
 * Trigger-Funktionen:
 *  - onTemperatureEquals(int)
 *  - onTemperatureLess(int)
 *  - onTemperatureGreater(int)
 *  - onTemperatureChanged
 */
public abstract class DeviceLightDimmerTemperature extends DeviceLightDimmer {

    /**
     * Enum für die zusätzlichen Trigger-Funktionsnamen der dimmbaren Lampe mit Farbtemperatur.
     */
    public static enum ColorTemperatureTriggerFunctionName {
        ON_TEMPERATURE_EQUALS("onTemperatureEquals(int)"),
        ON_TEMPERATURE_LESS("onTemperatureLess(int)"),
        ON_TEMPERATURE_GREATER("onTemperatureGreater(int)"),
        ON_TEMPERATURE_CHANGED("onTemperatureChanged");

        private final String value;

        ColorTemperatureTriggerFunctionName(String value) {
            this.value = value;
        }

        private static boolean hasValue(String triggerName) {
            return Arrays.stream(ColorTemperatureTriggerFunctionName.values()).anyMatch(trigger -> trigger.getValue().equals(triggerName));
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Enum für die zusätzlichen Action-Funktionsnamen der dimmbaren Lampe mit Farbtemperatur.
     */
    public static enum ColorTemperatureActionFunctionName {
        SET_TEMPERATURE("setTemperature(int)");

        private final String value;

        ColorTemperatureActionFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Enum für die zusätzlichen Bool-Funktionsnamen der dimmbaren Lampe mit Farbtemperatur.
     */
    public static enum ColorTemperatureBoolFunctionName {
        TEMPERATURE_EQUALS("temperatureEquals(int)"),
        TEMPERATURE_LESS("temperatureLess(int)"),
        TEMPERATURE_GREATER("temperatureGreater(int)");

        private final String value;

        ColorTemperatureBoolFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Farbtemperaturwert der Lampe.
     */
    @SerializedName("temperature")
    protected Integer temperature;

    /**
     * Standard-Konstruktor.
     * Initialisiert die zusätzlichen Funktionen (Bool/Action/Trigger) für Farbtemperatur.
     */
    public DeviceLightDimmerTemperature() {
        super();
        setType(DeviceType.LIGHT_DIMMER_TEMPERATURE);
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Konstruktor mit Name und ID.
     *
     * @param name Der Name der dimmbaren Lampe mit Farbtemperatur
     * @param id   Die eindeutige ID der dimmbaren Lampe mit Farbtemperatur
     */
    public DeviceLightDimmerTemperature(String name, String id) {
        super(name, id);
        setType(DeviceType.LIGHT_DIMMER_TEMPERATURE);
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Erweitert die Liste der booleschen Funktionen um die Farbtemperatur-Funktionen.
     */
    @Override
    protected void initializeFunctionsBool() {
        super.initializeFunctionsBool();
        List<String> functions = getFunctionsBool();
        if (functions == null) {
            functions = new ArrayList<>();
        }
        functions.add(ColorTemperatureBoolFunctionName.TEMPERATURE_EQUALS.getValue());
        functions.add(ColorTemperatureBoolFunctionName.TEMPERATURE_LESS.getValue());
        functions.add(ColorTemperatureBoolFunctionName.TEMPERATURE_GREATER.getValue());
        setFunctionsBool(functions);
    }

    /**
     * Erweitert die Liste der Action-Funktionen um die Farbtemperatur-Funktionen.
     */
    @Override
    protected void initializeFunctionsAction() {
        super.initializeFunctionsAction();
        List<String> functions = getFunctionsAction();
        if (functions == null) {
            functions = new ArrayList<>();
        }
        functions.add(ColorTemperatureActionFunctionName.SET_TEMPERATURE.getValue());
        setFunctionsAction(functions);
    }

    /**
     * Erweitert die Liste der Trigger-Funktionen um die Farbtemperatur-Trigger.
     */
    @Override
    protected void initializeFunctionsTrigger() {
        super.initializeFunctionsTrigger();
        List<String> functions = getFunctionsTrigger();
        if (functions == null) {
            functions = new ArrayList<>();
        }
        functions.add(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_EQUALS.getValue());
        functions.add(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_LESS.getValue());
        functions.add(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_GREATER.getValue());
        functions.add(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_CHANGED.getValue());
        setFunctionsTrigger(functions);
    }

    /**
     * Prüft und führt ColorTemperature-spezifische Trigger-Listener aus.
     *
     * @param triggerName Der Name des Triggers
     */
    @Override
    protected void checkListener(String triggerName) {
        super.checkListener(triggerName);
        if( triggerName == null || triggerName.isEmpty() || ! ColorTemperatureTriggerFunctionName.hasValue(triggerName) ) {
            return;
        }
    
        List<DeviceListenerPair> listeners = triggerListeners.get(triggerName);
        if (listeners == null || listeners.isEmpty()) {
            return;
        }

        if(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_EQUALS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer targetTemperature = pair.getParams().getParam1AsInt();
                return targetTemperature != null && temperatureEquals(targetTemperature);
            }).forEach(DeviceListenerPair::run);
        }
        if(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_LESS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                    Integer threshold = pair.getParams().getParam1AsInt();
                    return threshold != null && temperatureLess(threshold);
                }).forEach(DeviceListenerPair::run);
        }
        if(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_GREATER.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && temperatureGreater(threshold);
            }).forEach(DeviceListenerPair::run);
        }
    }

    /**
     * Bool-Funktion: Prüft, ob die Farbtemperatur genau dem angegebenen Wert entspricht.
     *
     * @param value Der Vergleichswert
     * @return true wenn die Temperatur dem Wert entspricht, false sonst
     */
    public boolean temperatureEquals(int value) {
        return this.temperature != null && this.temperature == value;
    }

    /**
     * Bool-Funktion: Prüft, ob die Farbtemperatur kleiner als der angegebene Wert ist.
     *
     * @param threshold Der Vergleichswert
     * @return true wenn die Temperatur kleiner ist, false sonst
     */
    public boolean temperatureLess(int threshold) {
        return this.temperature != null && this.temperature < threshold;
    }

    /**
     * Bool-Funktion: Prüft, ob die Farbtemperatur größer als der angegebene Wert ist.
     *
     * @param threshold Der Vergleichswert
     * @return true wenn die Temperatur größer ist, false sonst
     */
    public boolean temperatureGreater(int threshold) {
        return this.temperature != null && this.temperature > threshold;
    }

    /**
     * Action-Funktion: Setzt die Farbtemperatur der Lampe.
     *
     * @param temperature Der neue Farbtemperaturwert
     */
    public void setTemperature(int temperature, boolean execute) {
        this.temperature = temperature;
        if( execute ){ this.executeSetTemperature(temperature); }

        checkListener(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_CHANGED.getValue());
        checkListener(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_EQUALS.getValue());
        checkListener(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_LESS.getValue());
        checkListener(ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_GREATER.getValue());
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um die Farbtemperatur am tatsächlichen Gerät zu setzen.
     *
     * @param temperature Der neue Farbtemperaturwert
     */
    protected abstract void executeSetTemperature(int temperature);
}

