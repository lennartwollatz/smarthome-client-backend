package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;


public abstract class DeviceSwitch extends Device {

    /**
     * Enum für die Trigger-Funktionsnamen des Switches.
     */
    public static enum TriggerFunctionName {
        ON_PRESSED("onPressed"),
        ON_PRESSED_INT("onPressed(int)"),
        ON_DOUBLE_PRESSED("onDoublePressed"),
        ON_DOUBLE_PRESSED_INT("onDoublePressed(int)"),
        ON_TRIPLE_PRESSED("onTriplePressed"),
        ON_TRIPLE_PRESSED_INT("onTriplePressed(int)"),
        ON_BUTTON_ON_INT("onButtonOn(int)"),
        ON_BUTTON_OFF_INT("onButtonOff(int)");

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
     * Enum für die Action-Funktionsnamen des Switches.
     */
    public static enum ActionFunctionName {
        TOGGLE("toggle(int)"),
        DOUBLE_PRESS("doublePress(int)"),
        TRIPLE_PRESS("triplePress(int)");

        private final String value;

        ActionFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Enum für die Bool-Funktionsnamen des Switches.
     */
    public static enum BoolFunctionName {
        ON_INT("on(int)"),
        OFF_INT("off(int)");

        private final String value;

        BoolFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    protected static class Button {
        boolean on;
        int pressCount;
        long initialPressTime;
        long lastPressTime;
        long firstPressTime;

        /**
         * Standard-Konstruktor für Gson-Deserialisierung.
         */
        public Button() {
            this(false, 0, 0, 0, 0);
        }

        public Button(boolean on, int pressCount, long initialPressTime, long lastPressTime, long firstPressTime) {
            this.on = on;
            this.pressCount = pressCount;
            this.initialPressTime = initialPressTime;
            this.lastPressTime = lastPressTime;
            this.firstPressTime = firstPressTime;
        }
        
        public boolean isOn() {
            return on;
        }
        
        public int getPressCount() {
            return pressCount;
        }
        
        public long getLastPressTime() {
            return lastPressTime;
        }
        
        public long getFirstPressTime() {
            return firstPressTime;
        }

        public long getInitialPressTime() {
            return initialPressTime;
        }

        public void setInitialPressTime(long initialPressTime) {   
            this.initialPressTime = initialPressTime;
        }

        public void setFirstPressTime(long firstPressTime) {
            this.firstPressTime = firstPressTime;
        }

        public void setPressCount(int pressCount) {
            this.pressCount = pressCount;
        }

        public void setOn(boolean on) {
            this.on = on;
        }

        public void setLastPressTime(long lastPressTime) {
            this.lastPressTime = lastPressTime;
        }
    }
    
    /**
     * Gibt an, ob der Switch eingeschaltet ist.
     */
    @SerializedName("buttons")
    protected Map<String,Button> buttons;

    /**
     * Standard-Konstruktor.
     * Initialisiert die Funktionen.
     */
    public DeviceSwitch() {
        super();
        this.buttons = new HashMap<>();
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Konstruktor mit Name und ID.
     *
     * @param name Der Name des Switches
     * @param id   Die eindeutige ID des Switches
     */
    public DeviceSwitch(String name, String id) {
        super();
        setName(name);
        setId(id);
        this.buttons = new HashMap<>();
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    public abstract void updateValues();

    public void addButton(String buttonId) {
        if (buttons == null) {
            buttons = new HashMap<>();
        }
        buttons.put(buttonId, new Button(false, 0, 0, 0, 0));
    }

    /**
     * Initialisiert die Liste der booleschen Funktionen für den Switch.
     */
    protected void initializeFunctionsBool() {
        List<String> functions = new ArrayList<>();
        functions.add(BoolFunctionName.ON_INT.getValue());
        functions.add(BoolFunctionName.OFF_INT.getValue());
        setFunctionsBool(functions);
    }

    /**
     * Initialisiert die Liste der Action-Funktionen für den Switch.
     */
    protected void initializeFunctionsAction() {
        List<String> functions = new ArrayList<>();
        functions.add(ActionFunctionName.TOGGLE.getValue());
        functions.add(ActionFunctionName.DOUBLE_PRESS.getValue());
        functions.add(ActionFunctionName.TRIPLE_PRESS.getValue());
        setFunctionsAction(functions);
    }

    /**
     * Initialisiert die Liste der Trigger-Funktionen für den Switch.
     */
    protected void initializeFunctionsTrigger() {
        List<String> functions = new ArrayList<>();
        functions.add(TriggerFunctionName.ON_PRESSED.getValue());
        functions.add(TriggerFunctionName.ON_PRESSED_INT.getValue());
        functions.add(TriggerFunctionName.ON_DOUBLE_PRESSED.getValue());
        functions.add(TriggerFunctionName.ON_DOUBLE_PRESSED_INT.getValue());
        functions.add(TriggerFunctionName.ON_TRIPLE_PRESSED.getValue());
        functions.add(TriggerFunctionName.ON_TRIPLE_PRESSED_INT.getValue());
        functions.add(TriggerFunctionName.ON_BUTTON_ON_INT.getValue());
        functions.add(TriggerFunctionName.ON_BUTTON_OFF_INT.getValue());
        setFunctionsTrigger(functions);
    }

    /**
     * Prüft, ob der Switch einen Trigger hat und führt die entsprechenden Listener aus.
     * @param triggerName Der Name des Triggers
     */
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

        // Für Double/Triple Press Trigger: Prüfe pressCount
        if (TriggerFunctionName.ON_DOUBLE_PRESSED.getValue().equals(triggerName)) {
            // Prüfe, ob mindestens ein Button pressCount = 2 hat
            boolean hasDoublePress = buttons != null && buttons.values().stream()
                .anyMatch(button -> button.getPressCount() == 2);
            if (!hasDoublePress) {
                return;
            }
        } else if (TriggerFunctionName.ON_TRIPLE_PRESSED.getValue().equals(triggerName)) {
            // Prüfe, ob mindestens ein Button pressCount = 3 hat
            boolean hasTriplePress = buttons != null && buttons.values().stream()
                .anyMatch(button -> button.getPressCount() == 3);
            if (!hasTriplePress) {
                return;
            }
        }

        // Für alle Trigger-Typen: alle zugehörigen Listener ausführen
        if(TriggerFunctionName.ON_DOUBLE_PRESSED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_TRIPLE_PRESSED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_PRESSED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
    }

    /**
     * Prüft, ob der Switch einen Trigger hat und führt die entsprechenden Listener aus.
     * @param triggerName Der Name des Triggers
     * @param buttonId Die ID des Buttons
     */
    private void checkListener(String triggerName, String buttonId) {
        if( triggerName == null || triggerName.isEmpty() || ! TriggerFunctionName.hasValue(triggerName) ) {
            return;
        }
        List<DeviceListenerPair> listeners = triggerListeners.get(triggerName);
        if (listeners == null || listeners.isEmpty()) {
            return;
        }
        
        // Für Double/Triple Press Trigger: Prüfe pressCount des spezifischen Buttons
        if (TriggerFunctionName.ON_DOUBLE_PRESSED_INT.getValue().equals(triggerName)) {
            Button button = buttons != null ? buttons.get(buttonId) : null;
            if (button == null || button.getPressCount() != 2) {
                return;
            }
        } else if (TriggerFunctionName.ON_TRIPLE_PRESSED_INT.getValue().equals(triggerName)) {
            Button button = buttons != null ? buttons.get(buttonId) : null;
            if (button == null || button.getPressCount() != 3) {
                return;
            }
        } else if (TriggerFunctionName.ON_BUTTON_ON_INT.getValue().equals(triggerName)) {
            Button button = buttons != null ? buttons.get(buttonId) : null;
            if (button == null || !button.isOn()) {
                return;
            }
        } else if (TriggerFunctionName.ON_BUTTON_OFF_INT.getValue().equals(triggerName)) {
            Button button = buttons != null ? buttons.get(buttonId) : null;
            if (button == null || button.isOn()) {
                return;
            }
        }

        // Filtere nach buttonId (param1) und führe nur passende Listener aus
        if(TriggerFunctionName.ON_DOUBLE_PRESSED_INT.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String listenerParam = pair.getParams().getParam1AsString();
                return listenerParam != null && listenerParam.equals(buttonId);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_TRIPLE_PRESSED_INT.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String listenerParam = pair.getParams().getParam1AsString();
                return listenerParam != null && listenerParam.equals(buttonId);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_PRESSED_INT.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String listenerParam = pair.getParams().getParam1AsString();
                return listenerParam != null && listenerParam.equals(buttonId);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_BUTTON_ON_INT.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String listenerParam = pair.getParams().getParam1AsString();
                return listenerParam != null && listenerParam.equals(buttonId);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.ON_BUTTON_OFF_INT.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String listenerParam = pair.getParams().getParam1AsString();
                return listenerParam != null && listenerParam.equals(buttonId);
            }).forEach(DeviceListenerPair::run);
        }
    }
    
    /**
     * Bool-Funktion: Gibt zurück, ob der Button mit der gegebenen ID gedrückt ist.
     *
     * @param buttonId Die ID des Buttons
     * @return true, wenn der Button gedrückt ist, sonst false
     */
    public boolean on(String buttonId) {
        if (buttons == null) {
            return false;
        }
        Button button = buttons.get(buttonId);
        return button != null && button.isOn();
    }

    /**
     * Bool-Funktion: Gibt zurück, ob der Button mit der gegebenen ID nicht gedrückt ist.
     *
     * @param buttonId Die ID des Buttons
     * @return true, wenn der Button nicht gedrückt ist, sonst false
     */
    public boolean off(String buttonId) {
        return !on(buttonId);
    }

    /**
     * Action-Funktion: Toggelt den Button mit der gegebenen ID.
     * 
     * @param buttonId Die ID des Buttons
     */
    public void toggle(String buttonId, boolean execute) {
        if (buttons == null) {
            return;
        }
        
        Button button = buttons.get(buttonId);
        if (button == null) {
            return;
        }
        
        // Aktuelle Zeit für Zeitstempel
        long currentTime = System.currentTimeMillis();
        
        // Prüfe, ob firstPressTime länger als 2.5 Sekunden her ist
        if (button.getFirstPressTime() == 0 || (currentTime - button.getFirstPressTime()) > 2500) {
            // Zeitfenster abgelaufen - starte neu
            button.setPressCount(1);
            button.setFirstPressTime(currentTime);
            button.setLastPressTime(currentTime);
        } else {
            // Innerhalb des Zeitfensters - inkrementiere pressCount
            button.setPressCount(button.getPressCount() + 1);
            button.setLastPressTime(currentTime);
        }
        
        // Toggle den Button-Zustand (on)
        button.setOn(!button.isOn());
        
        // Führe die abstrakte Methode aus
        if( execute ){ this.executeToggle(buttonId); }
        this.checkListener(TriggerFunctionName.ON_PRESSED.getValue());
        this.checkListener(TriggerFunctionName.ON_PRESSED_INT.getValue(), buttonId);
        this.checkListener(TriggerFunctionName.ON_DOUBLE_PRESSED.getValue());
        this.checkListener(TriggerFunctionName.ON_DOUBLE_PRESSED_INT.getValue(), buttonId);
        this.checkListener(TriggerFunctionName.ON_TRIPLE_PRESSED.getValue());
        this.checkListener(TriggerFunctionName.ON_TRIPLE_PRESSED_INT.getValue(), buttonId);
        
        if(button.isOn()) {
            this.checkListener(TriggerFunctionName.ON_BUTTON_ON_INT.getValue(), buttonId);
        } else {
            this.checkListener(TriggerFunctionName.ON_BUTTON_OFF_INT.getValue(), buttonId);
        }
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um den Toggle am tatsächlichen Gerät auszuführen.
     * 
     * @param buttonId Die ID des Buttons
     */
    protected abstract void executeToggle(String buttonId);

    /**
     * Action-Funktion: Führt einen Doppelklick auf den Button mit der gegebenen ID aus.
     * 
     * @param buttonId Die ID des Buttons
     */
    public void doublePress(String buttonId, boolean execute) {
        if (buttons == null) {
            return;
        }
        
        Button button = buttons.get(buttonId);
        if (button == null) {
            return;
        }
        
        // Aktualisiere Button-Status für Doppelklick
        long currentTime = System.currentTimeMillis();
        button.pressCount = 2;
        button.firstPressTime = currentTime - 2500;
        button.lastPressTime = currentTime;
        
        // Führe die abstrakte Methode aus
        if( execute ){ this.executeDoublePress(buttonId); }
        
        this.checkListener(TriggerFunctionName.ON_DOUBLE_PRESSED.getValue());
        this.checkListener(TriggerFunctionName.ON_DOUBLE_PRESSED_INT.getValue(), buttonId);
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um den Doppelklick am tatsächlichen Gerät auszuführen.
     * 
     * @param buttonId Die ID des Buttons
     */
    protected abstract void executeDoublePress(String buttonId);

    /**
     * Action-Funktion: Führt einen Dreifachklick auf den Button mit der gegebenen ID aus.
     * 
     * @param buttonId Die ID des Buttons
     */
    public void triplePress(String buttonId, boolean execute) {
        if (buttons == null) {
            return;
        }
        
        Button button = buttons.get(buttonId);
        if (button == null) {
            return;
        }
        
        // Aktualisiere Button-Status für Doppelklick
        long currentTime = System.currentTimeMillis();
        button.pressCount = 2;
        button.firstPressTime = currentTime - 2500;
        button.lastPressTime = currentTime;
        
        // Führe die abstrakte Methode aus
        if( execute ){ this.executeTriplePress(buttonId); }
        
        // Löse entsprechende Trigger aus
        this.checkListener(TriggerFunctionName.ON_TRIPLE_PRESSED.getValue());
        this.checkListener(TriggerFunctionName.ON_TRIPLE_PRESSED_INT.getValue(), buttonId);
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um den Dreifachklick am tatsächlichen Gerät auszuführen.
     * 
     * @param buttonId Die ID des Buttons
     */
    protected abstract void executeTriplePress(String buttonId);

    public void setInitialPressed(String buttonId) {
        if (buttons == null) {
            return;
        }
        Button button = buttons.get(buttonId);
        if (button == null) {
            return;
        }
        button.setInitialPressTime(System.currentTimeMillis());
    }

    public void setLongPressed(String buttonId, boolean execute) {
        if (buttons == null) {
            return;
        }
        Button button = buttons.get(buttonId);
        if (button == null) {
            return;
        }
        
        // Setze lastPressTime auf jetzt
        long now = System.currentTimeMillis();
        button.setLastPressTime(now);
        
        // Berechne die Millisekunden zwischen lastPressTime (jetzt) und firstPressTime
        long durationMs = now - button.getFirstPressTime();
        
        // Linear verteilen: 0ms = 100% Intensität, 5000ms = 0% Intensität
        // Formel: intensity = 100 * (1 - durationMs / 5000.0)
        // Wenn 5 Sekunden gedrückt: 100 * (1 - 5000/5000) = 100 * 0 = 0
        // Wenn 2.5 Sekunden gedrückt: 100 * (1 - 2500/5000) = 100 * 0.5 = 50
        double reductionFactor = Math.min(1.0, durationMs / 5000.0); // Maximal 100% Reduktion
        int intensity = (int) Math.round(100.0 * (1.0 - reductionFactor));
        
        // Stelle sicher, dass der Wert zwischen 0 und 100 liegt
        intensity = Math.max(0, Math.min(100, intensity));
        
        // Setze firstPressTime auf jetzt (für den nächsten Durchlauf)
        button.setFirstPressTime(now);
        button.setInitialPressTime(now);
        button.setPressCount(0);

        if( execute ){ this.executeSetBrightness(buttonId, intensity); }

    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um die Helligkeit am tatsächlichen Gerät zu setzen.
     * 
     * @param buttonId Die ID des Buttons
     * @param intensity Die neue Intensität (0-100)
     */
    protected abstract void executeSetBrightness(String buttonId, int intensity);

}

