package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceType;

/**
 * Repräsentiert eine dimmbare Lampe im Smart Home System.
 * Basisklasse ist {@link DeviceLight}. Zusätzliche Eigenschaften:
 * - brightness: Helligkeitswert der Lampe (z.B. 0-100)
 *
 * Die Klasse erweitert DeviceLight um folgende Funktionen:
 * Bool-Funktionen:
 *  - brightnessEquals(int)
 *  - brightnessLess(int)
 *  - brightnessGreater(int)
 *
 * Action-Funktionen:
 *  - setBrightness(int)
 *
 * Trigger-Funktionen:
 *  - onBrightnessEquals(int)
 *  - onBrightnessLess(int)
 *  - onBrightnessGreater(int)
 *  - onBrightnessChanged
 */
public abstract class DeviceLightDimmer extends DeviceLight {

    /**
     * Enum für die zusätzlichen Trigger-Funktionsnamen der dimmbaren Lampe.
     */
    public static enum DimmerTriggerFunctionName {
        ON_BRIGHTNESS_EQUALS("onBrightnessEquals(int)"),
        ON_BRIGHTNESS_LESS("onBrightnessLess(int)"),
        ON_BRIGHTNESS_GREATER("onBrightnessGreater(int)"),
        ON_BRIGHTNESS_CHANGED("onBrightnessChanged");

        private final String value;

        DimmerTriggerFunctionName(String value) {
            this.value = value;
        }

        private static boolean hasValue(String triggerName) {
            return Arrays.stream(DimmerTriggerFunctionName.values()).anyMatch(trigger -> trigger.getValue().equals(triggerName));
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Enum für die zusätzlichen Action-Funktionsnamen der dimmbaren Lampe.
     */
    public static enum DimmerActionFunctionName {
        SET_BRIGHTNESS("setBrightness(int)");

        private final String value;

        DimmerActionFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Enum für die zusätzlichen Bool-Funktionsnamen der dimmbaren Lampe.
     */
    public static enum DimmerBoolFunctionName {
        BRIGHTNESS_EQUALS("brightnessEquals(int)"),
        BRIGHTNESS_LESS("brightnessLess(int)"),
        BRIGHTNESS_GREATER("brightnessGreater(int)");

        private final String value;

        DimmerBoolFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Helligkeitswert der Lampe (z.B. 0-100).
     */
    @SerializedName("brightness")
    protected Integer brightness;

    /**
     * Standard-Konstruktor.
     * Setzt den Typ automatisch auf "switch-dimmer" und initialisiert die Funktionen.
     */
    public DeviceLightDimmer() {
        super();
        setType(DeviceType.LIGHT_DIMMER);
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Konstruktor mit Name und ID.
     *
     * @param name Der Name der dimmbaren Lampe
     * @param id   Die eindeutige ID der dimmbaren Lampe
     */
    public DeviceLightDimmer(String name, String id) {
        super(name, id);
        setType(DeviceType.LIGHT_DIMMER);
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Erweitert die Liste der booleschen Funktionen um die Dimmer-Funktionen.
     */
    @Override
    protected void initializeFunctionsBool() {
        super.initializeFunctionsBool();
        List<String> functions = getFunctionsBool();
        if (functions == null) {
            functions = new ArrayList<>();
        }
        functions.add(DimmerBoolFunctionName.BRIGHTNESS_EQUALS.getValue());
        functions.add(DimmerBoolFunctionName.BRIGHTNESS_LESS.getValue());
        functions.add(DimmerBoolFunctionName.BRIGHTNESS_GREATER.getValue());
        setFunctionsBool(functions);
    }

    /**
     * Erweitert die Liste der Action-Funktionen um die Dimmer-Funktionen.
     */
    @Override
    protected void initializeFunctionsAction() {
        super.initializeFunctionsAction();
        List<String> functions = getFunctionsAction();
        if (functions == null) {
            functions = new ArrayList<>();
        }
        functions.add(DimmerActionFunctionName.SET_BRIGHTNESS.getValue());
        setFunctionsAction(functions);
    }

    /**
     * Erweitert die Liste der Trigger-Funktionen um die Dimmer-Funktionen.
     */
    @Override
    protected void initializeFunctionsTrigger() {
        super.initializeFunctionsTrigger();
        List<String> functions = getFunctionsTrigger();
        if (functions == null) {
            functions = new ArrayList<>();
        }
        functions.add(DimmerTriggerFunctionName.ON_BRIGHTNESS_EQUALS.getValue());
        functions.add(DimmerTriggerFunctionName.ON_BRIGHTNESS_LESS.getValue());
        functions.add(DimmerTriggerFunctionName.ON_BRIGHTNESS_GREATER.getValue());
        functions.add(DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED.getValue());
        setFunctionsTrigger(functions);
    }

    /**
     * Prüft und führt Dimmer-spezifische Trigger-Listener aus.
     *
     * @param triggerName Der Name des Triggers
     */
    @Override
    protected void checkListener(String triggerName) {
        super.checkListener(triggerName);
        if( triggerName == null || triggerName.isEmpty() || ! DimmerTriggerFunctionName.hasValue(triggerName) ) {
            return;
        }
        List<DeviceListenerPair> listeners = triggerListeners.get(triggerName);
        if (listeners == null || listeners.isEmpty()) {
            return;
        }

        if(DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(DimmerTriggerFunctionName.ON_BRIGHTNESS_EQUALS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer targetBrightness = pair.getParams().getParam1AsInt();
                return targetBrightness != null && brightnessEquals(targetBrightness);
            }).forEach(DeviceListenerPair::run);
        }
        if(DimmerTriggerFunctionName.ON_BRIGHTNESS_LESS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && brightnessLess(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if(DimmerTriggerFunctionName.ON_BRIGHTNESS_GREATER.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && brightnessGreater(threshold);
            }).forEach(DeviceListenerPair::run);
        }
    }

    /**
     * Bool-Funktion: Prüft, ob die Helligkeit genau dem angegebenen Wert entspricht.
     *
     * @param value Der Vergleichswert
     * @return true wenn die Helligkeit dem Wert entspricht, false sonst
     */
    public boolean brightnessEquals(int value) {
        return this.brightness != null && this.brightness == value;
    }

    /**
     * Bool-Funktion: Prüft, ob die Helligkeit kleiner als der angegebene Wert ist.
     *
     * @param threshold Der Vergleichswert
     * @return true wenn die Helligkeit kleiner ist, false sonst
     */
    public boolean brightnessLess(int threshold) {
        return this.brightness != null && this.brightness < threshold;
    }

    /**
     * Bool-Funktion: Prüft, ob die Helligkeit größer als der angegebene Wert ist.
     *
     * @param threshold Der Vergleichswert
     * @return true wenn die Helligkeit größer ist, false sonst
     */
    public boolean brightnessGreater(int threshold) {
        return this.brightness != null && this.brightness > threshold;
    }

    /**
     * Action-Funktion: Setzt die Helligkeit der Lampe.
     *
     * @param brightness Der neue Helligkeitswert (z.B. 0-100)
     */
    public void setBrightness(int brightness, boolean execute) {
        this.brightness = brightness;
        if( execute ){ this.executeSetBrightness(brightness); }

        checkListener(DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED.getValue());
        checkListener(DimmerTriggerFunctionName.ON_BRIGHTNESS_EQUALS.getValue());
        checkListener(DimmerTriggerFunctionName.ON_BRIGHTNESS_LESS.getValue());
        checkListener(DimmerTriggerFunctionName.ON_BRIGHTNESS_GREATER.getValue());
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um die Helligkeit am tatsächlichen Gerät zu setzen.
     *
     * @param brightness Der neue Helligkeitswert
     */
    protected abstract void executeSetBrightness(int brightness);
}

