package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceType;

/**
 * Repräsentiert eine farbige dimmbare Lampe im Smart Home System.
 * Basisklasse ist {@link DeviceLightDimmer}. Zusätzliche Eigenschaften:
 * - color: Farbwert mit x- und y-Komponente.
 *
 * Die Klasse erweitert DeviceLightDimmer um:
 * Action-Funktionen:
 *  - setColor(double, double)
 *
 * Trigger-Funktionen:
 *  - onColorChanged
 *
 * Zusätzliche Bool-Funktionen sind nicht definiert.
 */
public abstract class DeviceLightDimmerTemperatureColor extends DeviceLightDimmerTemperature {

    /**
     * Einfache Farbklasse mit x- und y-Komponente.
     * Werte liegen zwischen 0.0 und 1.0 mit drei Nachkommastellen.
     */
    public static class Color {
        @SerializedName("x")
        private double x;

        @SerializedName("y")
        private double y;

        public Color(double x, double y) {
            this.x = Math.round(x * 1000.0) / 1000.0; // Auf 3 Nachkommastellen runden
            this.y = Math.round(y * 1000.0) / 1000.0;
        }

        public double getX() {
            return x;
        }

        public void setX(double x) {
            this.x = Math.round(x * 1000.0) / 1000.0; // Auf 3 Nachkommastellen runden
        }

        public double getY() {
            return y;
        }

        public void setY(double y) {
            this.y = Math.round(y * 1000.0) / 1000.0; // Auf 3 Nachkommastellen runden
        }
    }

    /**
     * Enum für die zusätzlichen Action-Funktionsnamen der farbigen dimmbaren Lampe.
     */
    public static enum ColorActionFunctionName {
        SET_COLOR("setColor(double,double)");

        private final String value;

        ColorActionFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Enum für die zusätzlichen Trigger-Funktionsnamen der farbigen dimmbaren Lampe.
     */
    public static enum ColorTriggerFunctionName {
        ON_COLOR_CHANGED("onColorChanged");

        private final String value;

        ColorTriggerFunctionName(String value) {
            this.value = value;
        }

        private static boolean hasValue(String triggerName) {
            return Arrays.stream(ColorTriggerFunctionName.values()).anyMatch(trigger -> trigger.getValue().equals(triggerName));
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Farbwert der Lampe.
     */
    @SerializedName("color")
    protected Color color = new Color(0, 0);

    /**
     * Standard-Konstruktor.
     * Initialisiert die zusätzlichen Funktionen (Action/Trigger) für Farbe.
     */
    public DeviceLightDimmerTemperatureColor() {
        super();
        setType(DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR);
        initializeFunctionsAction();
        initializeFunctionsTrigger();
        initializeFunctionsBool();
    }

    /**
     * Konstruktor mit Name und ID.
     *
     * @param name Der Name der farbigen dimmbaren Lampe
     * @param id   Die eindeutige ID der farbigen dimmbaren Lampe
     */
    public DeviceLightDimmerTemperatureColor(String name, String id) {
        super(name, id);
        setType(DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR);
        initializeFunctionsAction();
        initializeFunctionsTrigger();
        initializeFunctionsBool();
    }

    /**
     * Erweitert die Liste der Action-Funktionen um die Farb-Funktionen.
     */
    @Override
    protected void initializeFunctionsAction() {
        super.initializeFunctionsAction();
        List<String> functions = getFunctionsAction();
        if (functions == null) {
            functions = new ArrayList<>();
        }
        functions.add(ColorActionFunctionName.SET_COLOR.getValue());
        setFunctionsAction(functions);
    }

    /**
     * Erweitert die Liste der Trigger-Funktionen um die Farb-Trigger.
     */
    @Override
    protected void initializeFunctionsTrigger() {
        super.initializeFunctionsTrigger();
        List<String> functions = getFunctionsTrigger();
        if (functions == null) {
            functions = new ArrayList<>();
        }
        functions.add(ColorTriggerFunctionName.ON_COLOR_CHANGED.getValue());
        setFunctionsTrigger(functions);
    }

    /**
     * Prüft und führt Color-spezifische Trigger-Listener aus.
     *
     * @param triggerName Der Name des Triggers
     */
    @Override
    protected void checkListener(String triggerName) {
        super.checkListener(triggerName);
        if( triggerName == null || triggerName.isEmpty() || ! ColorTriggerFunctionName.hasValue(triggerName) ) {
            return;
        }
        List<DeviceListenerPair> listeners = triggerListeners.get(triggerName);
        if (listeners == null || listeners.isEmpty()) {
            return;
        }
        if(ColorTriggerFunctionName.ON_COLOR_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
    }

    /**
     * Action-Funktion: Setzt die Farbe der Lampe.
     *
     * @param x x-Komponente der Farbe (0.0-1.0)
     * @param y y-Komponente der Farbe (0.0-1.0)
     */
    public void setColor(double x, double y, boolean execute) {
        if (this.color == null) {
            this.color = new Color(x, y);
        } else {
            this.color.setX(x);
            this.color.setY(y);
        }

        if( execute ){ this.executeSetColor(x, y); }

        checkListener(ColorTriggerFunctionName.ON_COLOR_CHANGED.getValue());
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um die Farbe am tatsächlichen Gerät zu setzen.
     *
     * @param x x-Komponente der Farbe (0.0-1.0)
     * @param y y-Komponente der Farbe (0.0-1.0)
     */
    protected abstract void executeSetColor(double x, double y);
}

