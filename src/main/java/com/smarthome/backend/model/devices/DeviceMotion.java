package com.smarthome.backend.model.devices;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceListenerParams;
import com.smarthome.backend.model.devices.helper.DeviceType;

/**
 * Repräsentiert einen Bewegungs-Sensor (Motion Device) im Smart Home System.
 * Basisklasse ist {@link Device}. Zusätzliche Eigenschaften:
 * - sensitivity: Empfindlichkeit des Sensors
 * - motion: Ob aktuell eine Bewegung erkannt wird
 * - motion_last_detect: Zeitpunkt der letzten erkannten Bewegung
 */
public abstract class DeviceMotion extends Device {
    
    /**
     * Enum für die Trigger-Funktionsnamen des Motion-Sensors.
     */
    public static enum TriggerFunctionName {
        SENSIBILITY_CHANGED("sensibilityChanged"),
        MOTION_DETECTED("motionDetected"),
        NO_MOTION_DETECTED("noMotionDetected"),
        MOTION_DETECTED_SINCE("motionDetectedSince(int)"),
        NO_MOTION_DETECTED_SINCE("noMotionDetectedSince(int)");
        
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
     * Enum für die Action-Funktionsnamen des Motion-Sensors.
     */
    public static enum ActionFunctionName {
        SET_SENSIBILITY("setSensibility(int)");
        
        private final String value;
        
        ActionFunctionName(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }
    
    /**
     * Enum für die Bool-Funktionsnamen des Motion-Sensors.
     */
    public static enum BoolFunctionName {
        MOTION("motion"),
        NO_MOTION("noMotion"),
        MOTION_SINCE("motionSince(int)"),
        NO_MOTION_SINCE("noMotionSince(int)");
        
        private final String value;
        
        BoolFunctionName(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }

    /**
     * Empfindlichkeit des Sensors (z.B. 0-100).
     */
    @SerializedName("sensitivity")
    protected Integer sensitivity;

    /**
     * Gibt an, ob aktuell Bewegung erkannt wird.
     * transient: Wird nicht in der Datenbank gespeichert, da es zur Laufzeit aktualisiert wird.
     */
    protected transient Boolean motion;

    /**
     * Zeitpunkt der letzten erkannten Bewegung (z.B. als ISO-String oder Epoch-Millis).
     */
    @SerializedName("motion_last_detect")
    protected String motionLastDetect;
    
    /**
     * Scheduler für periodische Prüfungen der "Since"-Trigger.
     */
    private static final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(10);
    
    /**
     * Map zur Speicherung der ScheduledFuture-Objekte für periodische Prüfungen.
     * Key: Listener-Key (z.B. actionId-wait-nodeId), Value: ScheduledFuture
     */
    private transient Map<String, ScheduledFuture<?>> periodicCheckTasks;
    
    /**
     * Initialisiert periodicCheckTasks, falls es null ist (z.B. nach Deserialisierung).
     */
    private void ensurePeriodicCheckTasksInitialized() {
        if (periodicCheckTasks == null) {
            periodicCheckTasks = new ConcurrentHashMap<>();
        }
    }
    
    /**
     * Standard-Konstruktor.
     * Setzt den Typ automatisch auf "motion" und initialisiert die Funktionen.
     */
    public DeviceMotion() {
        super();
        setType(DeviceType.MOTION);
        setIcon("&#128064;"); // Auge als Standard-Icon für Motion-Sensor
        setTypeLabel("deviceType.motion");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Konstruktor mit Name und ID.
     * 
     * @param name Der Name des Motion-Sensors
     * @param id Die eindeutige ID des Motion-Sensors
     */
    public DeviceMotion(String name, String id) {
        super();
        setName(name);
        setId(id);
        setType(DeviceType.MOTION);
        setIcon("&#128064;");
        setTypeLabel("deviceType.motion");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    public abstract void updateValues();
    
    
    /**
     * Überschreibt removeListener, um periodische Prüfungen zu beenden.
     */
    @Override
    public void removeListener(String key, String name) {
        // Beende periodische Prüfung, falls vorhanden
        ensurePeriodicCheckTasksInitialized();
        ScheduledFuture<?> task = periodicCheckTasks.remove(key);
        if (task != null && !task.isCancelled()) {
            task.cancel(false);
        }
        super.removeListener(key, name);
    }
    
    /**
     * Initialisiert die Liste der booleschen Funktionen für den Motion-Sensor.
     */
    @Override
    protected void initializeFunctionsBool() {
        List<String> functions = new ArrayList<>();
        functions.add(BoolFunctionName.MOTION.getValue());
        functions.add(BoolFunctionName.NO_MOTION.getValue());
        functions.add(BoolFunctionName.MOTION_SINCE.getValue());
        functions.add(BoolFunctionName.NO_MOTION_SINCE.getValue());
        setFunctionsBool(functions);
    }
    
    /**
     * Initialisiert die Liste der Action-Funktionen für den Motion-Sensor.
     */
    @Override
    protected void initializeFunctionsAction() {
        List<String> functions = new ArrayList<>();
        functions.add(ActionFunctionName.SET_SENSIBILITY.getValue());
        setFunctionsAction(functions);
    }
    
    /**
     * Initialisiert die Liste der Trigger-Funktionen für den Motion-Sensor.
     */
    @Override
    protected void initializeFunctionsTrigger() {
        List<String> functions = new ArrayList<>();
        functions.add(TriggerFunctionName.SENSIBILITY_CHANGED.getValue());
        functions.add(TriggerFunctionName.MOTION_DETECTED.getValue());
        functions.add(TriggerFunctionName.NO_MOTION_DETECTED.getValue());
        functions.add(TriggerFunctionName.MOTION_DETECTED_SINCE.getValue());
        functions.add(TriggerFunctionName.NO_MOTION_DETECTED_SINCE.getValue());
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
        
        if(TriggerFunctionName.SENSIBILITY_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.MOTION_DETECTED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.NO_MOTION_DETECTED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.MOTION_DETECTED_SINCE.getValue().equals(triggerName)) {
            // Für alle Listener, bei denen die Bedingung aktuell false ist, periodische Prüfung einrichten
            for (DeviceListenerPair pair : listeners) {
                setupPeriodicCheckIfNeeded(pair, TriggerFunctionName.MOTION_DETECTED_SINCE.getValue());
            }
        }
        if(TriggerFunctionName.NO_MOTION_DETECTED_SINCE.getValue().equals(triggerName)) {
            // Für alle Listener, bei denen die Bedingung aktuell false ist, periodische Prüfung einrichten
            for (DeviceListenerPair pair : listeners) {
                setupPeriodicCheckIfNeeded(pair, TriggerFunctionName.NO_MOTION_DETECTED_SINCE.getValue());
            }
        }
    }

    /**
     * Richtet eine periodische Prüfung ein, falls der Listener für "Since"-Trigger ist.
     * Die Prüfung wird nach der angegebenen Zeit (in Sekunden) durchgeführt.
     * 
     * @param params Die Parameter des Listeners
     * @param triggerName Der Name des Triggers (motionDetectedSince oder noMotionDetectedSince)
     */
    private void setupPeriodicCheckIfNeeded(DeviceListenerPair pair, String triggerName) {
        
        ensurePeriodicCheckTasksInitialized();
        
        String listenerKey = pair.getParams().getKey();
        
        // Prüfe, ob bereits eine periodische Prüfung für diesen Listener existiert
        // Wenn ja, entferne den alten Task, bevor ein neuer erstellt wird
        if (periodicCheckTasks.containsKey(listenerKey)) {
            ScheduledFuture<?> existingTask = periodicCheckTasks.remove(listenerKey);
            if (existingTask != null && !existingTask.isCancelled() && !existingTask.isDone()) {
                // Alten Task abbrechen
                existingTask.cancel(false);
            }
        }
        
        Integer seconds = pair.getParams().getParam1AsInt();
        if (seconds == null || seconds <= 0) {
            return;
        }
        
        // Berechne die verbleibende Zeit, bis die Bedingung erfüllt ist
        long remainingSeconds = calculateRemainingSeconds(seconds);
        if (remainingSeconds <= 0) {
            pair.run();
            // Bedingung ist bereits erfüllt.
            return;
        }
        
        // Erstelle Task, der nach der verbleibenden Zeit prüft
        Runnable checkTask = () -> {
            // Prüfe Bedingung
            boolean conditionMet = false;
            if (TriggerFunctionName.MOTION_DETECTED_SINCE.getValue().equals(triggerName)) {
                conditionMet = isMotionDetectedSince(seconds);
            } else if (TriggerFunctionName.NO_MOTION_DETECTED_SINCE.getValue().equals(triggerName)) {
                conditionMet = isNoMotionDetectedSince(seconds);
            }
            // Wenn Bedingung erfüllt, führe Listener aus und beende Task
            if (conditionMet) {
                pair.run();
                // Beende Task nach erfolgreicher Ausführung
                ensurePeriodicCheckTasksInitialized();
                ScheduledFuture<?> task = periodicCheckTasks.remove(listenerKey);
                if (task != null) {
                    task.cancel(false);
                }
            } else {
                setupPeriodicCheckIfNeeded(pair, triggerName);
            }
        };
        
        // Starte Task, der nach der verbleibenden Zeit einmalig prüft
        ScheduledFuture<?> future = scheduler.schedule(checkTask, remainingSeconds, TimeUnit.SECONDS);
        periodicCheckTasks.put(listenerKey, future);
    }
    
    /**
     * Berechnet die verbleibende Zeit in Sekunden, bis die Bedingung erfüllt ist.
     * 
     * @param seconds Die benötigte Zeit in Sekunden
     * @return Die verbleibende Zeit in Sekunden, oder -1 wenn die Bedingung bereits erfüllt ist oder nicht berechnet werden kann
     */
    private long calculateRemainingSeconds(int seconds) {
        try {
            // Parse motionLastDetect
            if (motionLastDetect == null || motionLastDetect.isEmpty()) {
                return seconds + 1; // Kann nicht berechnet werden
            }
            
            long lastDetectTime;
            if (motionLastDetect.matches("\\d+")) {
                // Epoch-Millis
                lastDetectTime = Long.parseLong(motionLastDetect);
            } else {
                // ISO-String - kann nicht geparst werden
                lastDetectTime = parseISOStringToEpochMillis(motionLastDetect);
                if (lastDetectTime == -1) {
                    return seconds + 1;
                }
            }
            
            long currentTime = Instant.now().toEpochMilli(); // UTC Zeit
            
            // Berechne bereits vergangene Zeit in Sekunden
            long elapsedSeconds = (currentTime - lastDetectTime) / 1000;
            
            // Berechne verbleibende Zeit
            long remaining = seconds - elapsedSeconds;
            
            // Wenn bereits erfüllt, return -1
            if (remaining < 0) {
                return -1;
            }
            
            return remaining + 1;
        } catch (NumberFormatException e) {
            return seconds + 1; // Fehler beim Parsen
        }
    }

    private long parseISOStringToEpochMillis(String motionLastDetect) {
            try {
                return Instant.parse(motionLastDetect).toEpochMilli();
            } catch (Exception e) {
                return -1;
            }
        }
        
    
    /**
     * Prüft, ob aktuell Bewegung erkannt wird.
     * 
     * @return true wenn Bewegung erkannt wird, false sonst
     */
    public boolean motion() {
        return this.motion != null && this.motion;
    }
    
    /**
     * Prüft, ob aktuell keine Bewegung erkannt wird.
     * 
     * @return true wenn keine Bewegung erkannt wird, false sonst
     */
    public boolean noMotion() {
        return !motion();
    }
    
    /**
     * Prüft, ob seit der angegebenen Anzahl von Sekunden Bewegung erkannt wird.
     * 
     * @param seconds Die Anzahl der Sekunden
     * @return true wenn seit dieser Zeit Bewegung erkannt wird, false sonst
     */
    public boolean motionSince(int seconds) {
        return isMotionDetectedSince(seconds);
    }
    
    /**
     * Prüft, ob seit der angegebenen Anzahl von Sekunden keine Bewegung erkannt wird.
     * 
     * @param seconds Die Anzahl der Sekunden
     * @return true wenn seit dieser Zeit keine Bewegung erkannt wird, false sonst
     */
    public boolean noMotionSince(int seconds) {
        return isNoMotionDetectedSince(seconds);
    }
    
    /**
     * Prüft, ob seit der angegebenen Anzahl von Sekunden Bewegung erkannt wird.
     * 
     * @param seconds Die Anzahl der Sekunden
     * @return true wenn seit dieser Zeit Bewegung erkannt wird, false sonst
     */
    protected boolean isMotionDetectedSince(int seconds) {
        if (motionLastDetect == null || motionLastDetect.isEmpty()) {
            return false;
        }
        try {
            // Versuche, motionLastDetect als ISO-String oder Epoch-Millis zu parsen
            long lastDetectTime;
            if (motionLastDetect.matches("\\d+")) {
                // Epoch-Millis
                lastDetectTime = Long.parseLong(motionLastDetect);
            } else {
                lastDetectTime = parseISOStringToEpochMillis(motionLastDetect);
                if (lastDetectTime == -1) {
                    return false;
                }
            }
            long currentTime = Instant.now().toEpochMilli(); // UTC Zeit
            long diffSeconds = (currentTime - lastDetectTime) / 1000;
            return diffSeconds >= seconds;
        } catch (NumberFormatException e) {
            return false;
        }
    }
    
    /**
     * Prüft, ob seit der angegebenen Anzahl von Sekunden keine Bewegung erkannt wird.
     * 
     * @param seconds Die Anzahl der Sekunden
     * @return true wenn seit dieser Zeit keine Bewegung erkannt wird, false sonst
     */
    protected boolean isNoMotionDetectedSince(int seconds) {
        if (motionLastDetect == null || motionLastDetect.isEmpty()) {
            return true;
        }
        try {
            // Versuche, motionLastDetect als ISO-String oder Epoch-Millis zu parsen
            long lastDetectTime;
            if (motionLastDetect.matches("\\d+")) {
                // Epoch-Millis
                lastDetectTime = Long.parseLong(motionLastDetect);
            } else {
                lastDetectTime = parseISOStringToEpochMillis(motionLastDetect);
                if (lastDetectTime == -1) {
                    return true;
                }
            }
            long currentTime = Instant.now().toEpochMilli(); // UTC Zeit
            long diffSeconds = (currentTime - lastDetectTime) / 1000;
            return diffSeconds >= seconds;
        } catch (NumberFormatException e) {
            return true;
        }
    }
    
    /**
     * Setzt die Empfindlichkeit des Sensors.
     * 
     * @param sensitivity Die neue Empfindlichkeit (z.B. 0-100)
     */
    public void setSensibility(int sensitivity, boolean execute) {
        this.sensitivity = sensitivity;
        if( execute ){ this.executeSetSensibility(sensitivity); }
        checkListener(TriggerFunctionName.SENSIBILITY_CHANGED.getValue());
    }

    /**
     * Abstrakte Methode, die von Unterklassen implementiert werden muss,
     * um die Empfindlichkeit am tatsächlichen Gerät zu setzen.
     * 
     * @param sensitivity Die neue Empfindlichkeit
     */
    protected abstract void executeSetSensibility(int sensitivity);
    
    /**
     * Setzt den Bewegungsstatus des Sensors.
     * 
     * @param motion true wenn Bewegung erkannt wird, false sonst
     */
    public void setMotion(boolean motion, String motionLastDetect, boolean execute) {
        this.motion = motion;
        
        // Aktualisiere motionLastDetect, wenn Bewegung erkannt wird
        if (motion) {
            this.motionLastDetect = motionLastDetect;
        }

        if( execute ){ this.executeSetMotion(motion, motionLastDetect); }
        
        if (motion) {
            checkListener(TriggerFunctionName.MOTION_DETECTED.getValue());
        } else {
            checkListener(TriggerFunctionName.NO_MOTION_DETECTED.getValue());
        }
        checkListener(TriggerFunctionName.MOTION_DETECTED_SINCE.getValue());
        checkListener(TriggerFunctionName.NO_MOTION_DETECTED_SINCE.getValue());
    }

    protected abstract void executeSetMotion(boolean motion, String motionLastDetect);
}

