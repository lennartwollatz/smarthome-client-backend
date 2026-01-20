package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

import com.smarthome.backend.model.devices.helper.DeviceListenerPair;

/**
 * Repräsentiert einen dimmbaren Switch im Smart Home System.
 * Basisklasse ist {@link DeviceSwitch}. Zusätzliche Eigenschaften:
 * - Buttons können unterschiedlich lange gedrückt werden, um das Licht auf- und abzudunkeln
 *
 * Die Klasse erweitert DeviceSwitch um folgende Funktionen:
 * Bool-Funktionen:
 *  - brightnessEquals(int, int)
 *  - brightnessLess(int, int)
 *  - brightnessGreater(int, int)
 *
 * Action-Funktionen:
 *  - setBrightness(int, int)
 *
 * Trigger-Funktionen:
 *  - onBrightnessEquals(int, int)
 *  - onBrightnessLess(int, int)
 *  - onBrightnessGreater(int, int)
 *  - onBrightnessChanged(int)
 */
public abstract class DeviceSwitchDimmer extends DeviceSwitch {

    /**
     * Enum für die zusätzlichen Trigger-Funktionsnamen des dimmbaren Switches.
     */
    public static enum DimmerTriggerFunctionName {
        ON_BRIGHTNESS_CHANGED("onBrightnessChange(int):int");

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
     * Enum für die zusätzlichen Action-Funktionsnamen des dimmbaren Switches.
     */
    public static enum DimmerActionFunctionName {
        ;

        private final String value;

        DimmerActionFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Enum für die zusätzlichen Bool-Funktionsnamen des dimmbaren Switches.
     */
    public static enum DimmerBoolFunctionName {
        ;
        private final String value;

        DimmerBoolFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Standard-Konstruktor.
     * Initialisiert die Funktionen.
     */
    public DeviceSwitchDimmer() {
        super();
        // Initialisiere buttons als DimmerButton Map
        this.buttons = new HashMap<>();
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Konstruktor mit Name und ID.
     *
     * @param name Der Name des dimmbaren Switches
     * @param id   Die eindeutige ID des dimmbaren Switches
     */
    public DeviceSwitchDimmer(String name, String id, List<String> buttonIds) {
        super(name, id);
        // Initialisiere buttons als DimmerButton Map
        this.buttons = new HashMap<>();
        if (buttonIds != null) {
            for (String buttonId : buttonIds) {
                buttons.put(buttonId, new Button(false, 0, 0, 0, 0));
            }
        }
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

     /**
     * Initialisiert die Liste der Trigger-Funktionen für den Switch.
     */
    protected void initializeFunctionsTrigger() {
        super.initializeFunctionsTrigger();
        List<String> triggerFunctions = getFunctionsTrigger();
        if (triggerFunctions == null) {
            triggerFunctions = new ArrayList<>();
        }
        triggerFunctions.add(DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED.getValue());
        setFunctionsTrigger(triggerFunctions);
    }


    /**
     * Prüft und führt Dimmer-spezifische Trigger-Listener aus.
     * Verwendet das triggerListeners Feld aus der Superklasse.
     *
     * @param triggerName Der Name des Triggers
     * @param buttonId Die ID des Buttons
     */
    private void checkListener(String triggerName, String buttonId, int brightness) {
        if( triggerName == null || triggerName.isEmpty() || ! DimmerTriggerFunctionName.hasValue(triggerName) ) {
            return;
        }
        List<DeviceListenerPair> listeners = triggerListeners.get(triggerName);
        if (listeners == null || listeners.isEmpty()) {
            return;
        }

        if(DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String listenerParam = pair.getParams().getParam1AsString();
                return listenerParam != null && listenerParam.equals(buttonId);
            }).forEach(pair -> pair.run((Object) brightness));
        }
    }
    
    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um die Helligkeit am tatsächlichen Gerät zu setzen.
     *
     * @param buttonId Die ID des Buttons
     * @param brightness Der neue Helligkeitswert
     */
    protected abstract void executeSetBrightness(String buttonId, int brightness);

    public void setLongPressed(String buttonId, boolean execute) {
        super.setLongPressed(buttonId, execute);
        // Nur Trigger auslösen, wenn sich die Brightness geändert hat
        Button button = buttons.get(buttonId);
        if( button == null ) {
            return;
        }
        long start = button.getInitialPressTime();
        long end = button.getLastPressTime();
        int duration = (int) (end - start);
        int brightness = (int) 1-(duration / 4000);
        checkListener(DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED.getValue(), buttonId, brightness);
    }
}

