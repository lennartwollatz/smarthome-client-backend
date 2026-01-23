package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceType;

/**
 * Reprasentiert einen Saugroboter im Smart Home System.
 * Erbt von {@link Device} und erganzt spezifische Eigenschaften wie
 * Reinigungsstatus, Dockingstatus, Batteriestand und Modus.
 */
public abstract class DeviceVacuumCleaner extends Device {
    /**
     * Enum fur die Trigger-Funktionsnamen des Saugroboters.
     */
    public static enum TriggerFunctionName {
        CLEANING_STARTED("cleaningStarted"),
        CLEANING_STOPPED("cleaningStopped"),
        CLEANING_PAUSED("cleaningPaused"),
        CLEANING_RESUMED("cleaningResumed"),
        CLEANING_DONE("cleaningDone"),
        ROOM_CLEANED("roomCleaned(string)"),
        ROOM_ENTERED("inRoom(string)"),
        ROOM_LEFT("roomLeft(string)"),
        ZONE_CLEANED("zoneCleaned(string)"),
        ZONE_ENTERED("zoneEntered(string)"),
        ZONE_LEFT("zoneLeft(string)"),
        WATER_BOX_FULL("waterBoxFull"),
        WATER_BOX_EMPTY("waterBoxEmpty"),
        WATER_BOX_LEVEL_GREATER("waterBoxLevelGreater(int)"),
        WATER_BOX_LEVEL_LESS("waterBoxLevelLess(int)"),
        WATER_BOX_LEVEL_EQUALS("waterBoxLevelEquals(int)"),
        DIRTY_WATER_BOX_FULL("dirtyWaterBoxFull"),
        DIRTY_WATER_BOX_EMPTY("dirtyWaterBoxEmpty"),
        DIRTY_WATER_BOX_LEVEL_GREATER("dirtyWaterBoxLevelGreater(int)"),
        DIRTY_WATER_BOX_LEVEL_LESS("dirtyWaterBoxLevelLess(int)"),
        DIRTY_WATER_BOX_LEVEL_EQUALS("dirtyWaterBoxLevelEquals(int)"),
        FAN_SPEED_CHANGED("fanSpeedChanged"),
        FAN_SPEED_GREATER("fanSpeedGreater(int)"),
        FAN_SPEED_LESS("fanSpeedLess(int)"),
        FAN_SPEED_EQUALS("fanSpeedEquals(int)"),
        DOCKED("docked"),
        UNDOCKED("undocked"),
        BATTERY_GREATER("batteryGreater(int)"),
        BATTERY_LESS("batteryLess(int)"),
        BATTERY_EQUALS("batteryEquals(int)"),
        MODE_CHANGED("modeChanged"),
        MODE_EQUALS("modeEquals(string)");

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
     * Enum fur die Action-Funktionsnamen des Saugroboters.
     */
    public static enum ActionFunctionName {
        START_CLEANING("startCleaning"),
        STOP_CLEANING("stopCleaning"),
        PAUSE_CLEANING("pauseCleaning"),
        RESUME_CLEANING("resumeCleaning"),
        DOCK("dock"),
        SET_MODE("setMode(string)"),
        CLEAN_ROOM("cleanRoom(string)"),
        CLEAN_ZONE("cleanZone(string)"),
        CHANGE_FAN_SPEED("changeFanSpeed(int)"),
        CHANGE_MODE("changeMode(string)");

        private final String value;

        ActionFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Enum fur die Bool-Funktionsnamen des Saugroboters.
     */
    public static enum BoolFunctionName {
        CLEANING("cleaning"),
        DOCKED("docked"),
        UNDOCKED("undocked"),
        FAN_SPEED_GREATER("fanSpeedGreater(int)"),
        FAN_SPEED_LESS("fanSpeedLess(int)"),
        FAN_SPEED_EQUALS("fanSpeedEquals(int)"),
        WATER_BOX_FULL("waterBoxFull"),
        WATER_BOX_EMPTY("waterBoxEmpty"),
        WATER_BOX_LEVEL_GREATER("waterBoxLevelGreater(int)"),
        WATER_BOX_LEVEL_LESS("waterBoxLevelLess(int)"),
        WATER_BOX_LEVEL_EQUALS("waterBoxLevelEquals(int)"),
        DIRTY_WATER_BOX_FULL("dirtyWaterBoxFull"),
        DIRTY_WATER_BOX_EMPTY("dirtyWaterBoxEmpty"),
        DIRTY_WATER_BOX_LEVEL_GREATER("dirtyWaterBoxLevelGreater(int)"),
        DIRTY_WATER_BOX_LEVEL_LESS("dirtyWaterBoxLevelLess(int)"),
        DIRTY_WATER_BOX_LEVEL_EQUALS("dirtyWaterBoxLevelEquals(int)"),
        BATTERY_GREATER("batteryGreater(int)"),
        BATTERY_LESS("batteryLess(int)"),
        BATTERY_EQUALS("batteryEquals(int)"),
        MODE_EQUALS("modeEquals(string)"),
        IN_ROOM("inRoom(string)"),
        IN_ZONE("inZone(string)"),
        OUT_ROOM("outRoom(string)"),
        OUT_ZONE("outZone(string)");

        private final String value;

        BoolFunctionName(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }
    }

    /**
     * Aktueller Power-Status.
     */
    @SerializedName("power")
    protected Boolean power;

    /**
     * Aktueller Reinigungsstatus.
     */
    @SerializedName("cleaning")
    protected Boolean cleaning;

    /**
     * Aktueller Dockingstatus.
     */
    @SerializedName("docked")
    protected Boolean docked;

    /**
     * Aktueller Batteriestand.
     */
    @SerializedName("battery")
    protected Integer battery;

    /**
     * Aktuelle Lueftergeschwindigkeit.
     */
    @SerializedName("fanSpeed")
    protected Integer fanSpeed;

    /**
     * Fuellstand der Wasserbox (0-100).
     */
    @SerializedName("waterBoxLevel")
    protected Integer waterBoxLevel;

    /**
     * Fuellstand der Schmutzwasserbox (0-100).
     */
    @SerializedName("dirtyWaterBoxLevel")
    protected Integer dirtyWaterBoxLevel;

    /**
     * Aktueller Raum des Saugroboters.
     */
    @SerializedName("currentRoom")
    protected String currentRoom;

    /**
     * Aktuelle Zone des Saugroboters.
     */
    @SerializedName("currentZone")
    protected String currentZone;

    /**
     * Status der Wasserbox (voll).
     */
    @SerializedName("waterBoxFull")
    protected Boolean waterBoxFull;

    /**
     * Status der Schmutzwasserbox (voll).
     */
    @SerializedName("dirtyWaterBoxFull")
    protected Boolean dirtyWaterBoxFull;

    /**
     * Aktueller Reinigungsmodus.
     */
    @SerializedName("mode")
    protected String mode;

    /**
     * Aktueller Fehlerzustand.
     */
    @SerializedName("error")
    protected String error;

    /**
     * Standard-Konstruktor.
     * Setzt den Typ automatisch auf "vacuum".
     */
    public DeviceVacuumCleaner() {
        super();
        setType(DeviceType.VACUUM);
        setIcon("&#129529;"); // Besen-Icon
        setTypeLabel("deviceType.vacuum");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Konstruktor mit Name und ID.
     *
     * @param name Der Name des Saugroboters
     * @param id   Die eindeutige ID des Saugroboters
     */
    public DeviceVacuumCleaner(String name, String id) {
        super();
        setName(name);
        setId(id);
        setType(DeviceType.VACUUM);
        setIcon("&#129529;");
        setTypeLabel("deviceType.vacuum");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    public abstract void updateValues();

    @Override
    protected void initializeFunctionsBool() {
        List<String> functions = new ArrayList<>();
        functions.add(BoolFunctionName.CLEANING.getValue());
        functions.add(BoolFunctionName.DOCKED.getValue());
        functions.add(BoolFunctionName.UNDOCKED.getValue());
        functions.add(BoolFunctionName.FAN_SPEED_GREATER.getValue());
        functions.add(BoolFunctionName.FAN_SPEED_LESS.getValue());
        functions.add(BoolFunctionName.FAN_SPEED_EQUALS.getValue());
        functions.add(BoolFunctionName.WATER_BOX_FULL.getValue());
        functions.add(BoolFunctionName.WATER_BOX_EMPTY.getValue());
        functions.add(BoolFunctionName.WATER_BOX_LEVEL_GREATER.getValue());
        functions.add(BoolFunctionName.WATER_BOX_LEVEL_LESS.getValue());
        functions.add(BoolFunctionName.WATER_BOX_LEVEL_EQUALS.getValue());
        functions.add(BoolFunctionName.DIRTY_WATER_BOX_FULL.getValue());
        functions.add(BoolFunctionName.DIRTY_WATER_BOX_EMPTY.getValue());
        functions.add(BoolFunctionName.DIRTY_WATER_BOX_LEVEL_GREATER.getValue());
        functions.add(BoolFunctionName.DIRTY_WATER_BOX_LEVEL_LESS.getValue());
        functions.add(BoolFunctionName.DIRTY_WATER_BOX_LEVEL_EQUALS.getValue());
        functions.add(BoolFunctionName.BATTERY_GREATER.getValue());
        functions.add(BoolFunctionName.BATTERY_LESS.getValue());
        functions.add(BoolFunctionName.BATTERY_EQUALS.getValue());
        functions.add(BoolFunctionName.MODE_EQUALS.getValue());
        functions.add(BoolFunctionName.IN_ROOM.getValue());
        functions.add(BoolFunctionName.IN_ZONE.getValue());
        functions.add(BoolFunctionName.OUT_ROOM.getValue());
        functions.add(BoolFunctionName.OUT_ZONE.getValue());
        setFunctionsBool(functions);
    }

    @Override
    protected void initializeFunctionsAction() {
        List<String> functions = new ArrayList<>();
        functions.add(ActionFunctionName.START_CLEANING.getValue());
        functions.add(ActionFunctionName.STOP_CLEANING.getValue());
        functions.add(ActionFunctionName.PAUSE_CLEANING.getValue());
        functions.add(ActionFunctionName.RESUME_CLEANING.getValue());
        functions.add(ActionFunctionName.DOCK.getValue());
        functions.add(ActionFunctionName.SET_MODE.getValue());
        functions.add(ActionFunctionName.CLEAN_ROOM.getValue());
        functions.add(ActionFunctionName.CLEAN_ZONE.getValue());
        functions.add(ActionFunctionName.CHANGE_FAN_SPEED.getValue());
        functions.add(ActionFunctionName.CHANGE_MODE.getValue());
        setFunctionsAction(functions);
    }

    @Override
    protected void initializeFunctionsTrigger() {
        List<String> functions = new ArrayList<>();
        functions.add(TriggerFunctionName.CLEANING_STARTED.getValue());
        functions.add(TriggerFunctionName.CLEANING_STOPPED.getValue());
        functions.add(TriggerFunctionName.CLEANING_PAUSED.getValue());
        functions.add(TriggerFunctionName.CLEANING_RESUMED.getValue());
        functions.add(TriggerFunctionName.CLEANING_DONE.getValue());
        functions.add(TriggerFunctionName.ROOM_CLEANED.getValue());
        functions.add(TriggerFunctionName.ROOM_ENTERED.getValue());
        functions.add(TriggerFunctionName.ROOM_LEFT.getValue());
        functions.add(TriggerFunctionName.ZONE_CLEANED.getValue());
        functions.add(TriggerFunctionName.ZONE_ENTERED.getValue());
        functions.add(TriggerFunctionName.ZONE_LEFT.getValue());
        functions.add(TriggerFunctionName.WATER_BOX_FULL.getValue());
        functions.add(TriggerFunctionName.WATER_BOX_EMPTY.getValue());
        functions.add(TriggerFunctionName.WATER_BOX_LEVEL_GREATER.getValue());
        functions.add(TriggerFunctionName.WATER_BOX_LEVEL_LESS.getValue());
        functions.add(TriggerFunctionName.WATER_BOX_LEVEL_EQUALS.getValue());
        functions.add(TriggerFunctionName.DIRTY_WATER_BOX_FULL.getValue());
        functions.add(TriggerFunctionName.DIRTY_WATER_BOX_EMPTY.getValue());
        functions.add(TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_GREATER.getValue());
        functions.add(TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_LESS.getValue());
        functions.add(TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_EQUALS.getValue());
        functions.add(TriggerFunctionName.FAN_SPEED_CHANGED.getValue());
        functions.add(TriggerFunctionName.FAN_SPEED_GREATER.getValue());
        functions.add(TriggerFunctionName.FAN_SPEED_LESS.getValue());
        functions.add(TriggerFunctionName.FAN_SPEED_EQUALS.getValue());
        functions.add(TriggerFunctionName.DOCKED.getValue());
        functions.add(TriggerFunctionName.UNDOCKED.getValue());
        functions.add(TriggerFunctionName.BATTERY_GREATER.getValue());
        functions.add(TriggerFunctionName.BATTERY_LESS.getValue());
        functions.add(TriggerFunctionName.BATTERY_EQUALS.getValue());
        functions.add(TriggerFunctionName.MODE_CHANGED.getValue());
        functions.add(TriggerFunctionName.MODE_EQUALS.getValue());
        setFunctionsTrigger(functions);
    }

    @Override
    protected void checkListener(String triggerName) {
        super.checkListener(triggerName);
        if (triggerName == null || triggerName.isEmpty() || !TriggerFunctionName.hasValue(triggerName)) {
            return;
        }
        List<DeviceListenerPair> listeners = triggerListeners.get(triggerName);
        if (listeners == null || listeners.isEmpty()) {
            return;
        }

        if (TriggerFunctionName.CLEANING_STARTED.getValue().equals(triggerName)) {
            if (cleaning()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if (TriggerFunctionName.CLEANING_STOPPED.getValue().equals(triggerName)) {
            if (!cleaning()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if (TriggerFunctionName.CLEANING_PAUSED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.CLEANING_RESUMED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.CLEANING_DONE.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.ROOM_CLEANED.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String roomId = pair.getParams().getParam1AsString();
                return roomId != null && inRoom(roomId);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.ROOM_ENTERED.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String roomId = pair.getParams().getParam1AsString();
                return roomId != null && inRoom(roomId);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.ROOM_LEFT.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String roomId = pair.getParams().getParam1AsString();
                return roomId != null && outRoom(roomId);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.ZONE_CLEANED.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String zoneId = pair.getParams().getParam1AsString();
                return zoneId != null && inZone(zoneId);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.ZONE_ENTERED.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String zoneId = pair.getParams().getParam1AsString();
                return zoneId != null && inZone(zoneId);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.ZONE_LEFT.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String zoneId = pair.getParams().getParam1AsString();
                return zoneId != null && outZone(zoneId);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.WATER_BOX_FULL.getValue().equals(triggerName)) {
            if (waterBoxFull()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if (TriggerFunctionName.WATER_BOX_EMPTY.getValue().equals(triggerName)) {
            if (waterBoxEmpty()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if (TriggerFunctionName.WATER_BOX_LEVEL_GREATER.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && waterBoxLevelGreater(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.WATER_BOX_LEVEL_LESS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && waterBoxLevelLess(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.WATER_BOX_LEVEL_EQUALS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer target = pair.getParams().getParam1AsInt();
                return target != null && waterBoxLevelEquals(target);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.DIRTY_WATER_BOX_FULL.getValue().equals(triggerName)) {
            if (dirtyWaterBoxFull()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if (TriggerFunctionName.DIRTY_WATER_BOX_EMPTY.getValue().equals(triggerName)) {
            if (dirtyWaterBoxEmpty()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if (TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_GREATER.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && dirtyWaterBoxLevelGreater(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_LESS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && dirtyWaterBoxLevelLess(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_EQUALS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer target = pair.getParams().getParam1AsInt();
                return target != null && dirtyWaterBoxLevelEquals(target);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.FAN_SPEED_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.FAN_SPEED_GREATER.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && fanSpeedGreater(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.FAN_SPEED_LESS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && fanSpeedLess(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.FAN_SPEED_EQUALS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer target = pair.getParams().getParam1AsInt();
                return target != null && fanSpeedEquals(target);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.DOCKED.getValue().equals(triggerName)) {
            if (docked()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if (TriggerFunctionName.UNDOCKED.getValue().equals(triggerName)) {
            if (!docked()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if (TriggerFunctionName.BATTERY_GREATER.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && batteryGreater(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.BATTERY_LESS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && batteryLess(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.BATTERY_EQUALS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer target = pair.getParams().getParam1AsInt();
                return target != null && batteryEquals(target);
            }).forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.MODE_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if (TriggerFunctionName.MODE_EQUALS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String targetMode = pair.getParams().getParam1AsString();
                return targetMode != null && modeEquals(targetMode);
            }).forEach(DeviceListenerPair::run);
        }
    }

    public void setPower(boolean power, boolean execute) {
        this.power = power;
        if (execute) {
            this.executeSetPower(power);
        }
    }

    protected abstract void executeSetPower(Boolean power);

    public void startCleaning(boolean execute) {
        this.cleaning = true;
        this.power = true;
        if (execute) {
            this.executeStartCleaning();
        }
    }

    protected abstract void executeStartCleaning();

    public void stopCleaning(boolean execute) {
        this.cleaning = false;
        if (execute) {
            this.executeStopCleaning();
        }
    }

    protected abstract void executeStopCleaning();

    public void pauseCleaning(boolean execute) {
        this.cleaning = false;
        if (execute) {
            this.executePauseCleaning();
        }
    }

    protected abstract void executePauseCleaning();

    public void resumeCleaning(boolean execute) {
        this.cleaning = true;
        this.docked = false;
        if (execute) {
            this.executeResumeCleaning();
        }
    }

    protected abstract void executeResumeCleaning();

    public void dock(boolean execute) {
        if (execute) {
            this.executeDock();
        }
    }

    protected abstract void executeDock();

    public void setMode(String mode, boolean execute) {
        this.mode = mode;
        this.power = true;
        if (execute) {
            this.executeSetMode(mode);
        }
    }

    protected abstract void executeSetMode(String mode);

    public void cleanRoom(String roomId, boolean execute) {
        this.power = true;
        if (execute) {
            this.executeCleanRoom(roomId);
        }
    }

    protected abstract void executeCleanRoom(String roomId);

    public void cleanZone(String zoneId, boolean execute) {
        this.power = true;
        if (execute) {
            this.executeCleanZone(zoneId);
        }
    }

    protected abstract void executeCleanZone(String zoneId);

    public void changeFanSpeed(int fanSpeed, boolean execute) {
        this.fanSpeed = fanSpeed;
        if (execute) {
            this.executeChangeFanSpeed(fanSpeed);
        }
    }

    protected abstract void executeChangeFanSpeed(int fanSpeed);

    public void changeMode(String mode, boolean execute) {
        this.mode = mode;
        this.power = true;
        if (execute) {
            this.executeChangeMode(mode);
        }
    }

    protected abstract void executeChangeMode(String mode);

    public void setBattery(Integer battery) {
        this.battery = battery;
    }

    public void setFanSpeed(Integer fanSpeed) {
        this.fanSpeed = fanSpeed;
    }

    public void setWaterBoxLevel(Integer waterBoxLevel) {
        this.waterBoxLevel = waterBoxLevel;
    }

    public void setDirtyWaterBoxLevel(Integer dirtyWaterBoxLevel) {
        this.dirtyWaterBoxLevel = dirtyWaterBoxLevel;
    }

    public void setCurrentRoom(String currentRoom) {
        this.currentRoom = currentRoom;
    }

    public void setCurrentZone(String currentZone) {
        this.currentZone = currentZone;
    }

    public void setWaterBoxFull(Boolean waterBoxFull) {
        this.waterBoxFull = waterBoxFull;
    }

    public void setDirtyWaterBoxFull(Boolean dirtyWaterBoxFull) {
        this.dirtyWaterBoxFull = dirtyWaterBoxFull;
    }

    public void setDocked(Boolean docked) {
        this.docked = docked;
    }

    public void setCleaning(Boolean cleaning) {
        this.cleaning = cleaning;
    }

    public void setError(String error) {
        this.error = error;
    }

    public void clearError(boolean execute) {
        this.error = null;
        if (execute) {
            this.executeClearError();
        }
    }

    protected abstract void executeClearError();

    /**
     * Prueft, ob der Saugroboter eingeschaltet ist.
     */
    public boolean powerOn() {
        return Boolean.TRUE.equals(this.power);
    }

    /**
     * Prueft, ob der Saugroboter ausgeschaltet ist.
     */
    public boolean powerOff() {
        return Boolean.FALSE.equals(this.power);
    }

    /**
     * Prueft, ob der Saugroboter reinigt.
     */
    public boolean cleaning() {
        return Boolean.TRUE.equals(this.cleaning);
    }

    /**
     * Prueft, ob der Saugroboter gedockt ist.
     */
    public boolean docked() {
        return Boolean.TRUE.equals(this.docked);
    }

    /**
     * Prueft, ob der Batteriestand groesser als der angegebene Wert ist.
     */
    public boolean batteryGreater(int threshold) {
        return this.battery != null && this.battery > threshold;
    }

    /**
     * Prueft, ob der Batteriestand kleiner als der angegebene Wert ist.
     */
    public boolean batteryLess(int threshold) {
        return this.battery != null && this.battery < threshold;
    }

    /**
     * Prueft, ob der Batteriestand gleich dem angegebenen Wert ist.
     */
    public boolean batteryEquals(int value) {
        return this.battery != null && this.battery == value;
    }

    /**
     * Prueft, ob die Lueftergeschwindigkeit groesser als der angegebene Wert ist.
     */
    public boolean fanSpeedGreater(int threshold) {
        return this.fanSpeed != null && this.fanSpeed > threshold;
    }

    /**
     * Prueft, ob die Lueftergeschwindigkeit kleiner als der angegebene Wert ist.
     */
    public boolean fanSpeedLess(int threshold) {
        return this.fanSpeed != null && this.fanSpeed < threshold;
    }

    /**
     * Prueft, ob die Lueftergeschwindigkeit gleich dem angegebenen Wert ist.
     */
    public boolean fanSpeedEquals(int value) {
        return this.fanSpeed != null && this.fanSpeed == value;
    }

    /**
     * Prueft, ob die Wasserbox voll ist.
     */
    public boolean waterBoxFull() {
        if (this.waterBoxFull != null) {
            return Boolean.TRUE.equals(this.waterBoxFull);
        }
        return this.waterBoxLevel != null && this.waterBoxLevel >= 100;
    }

    /**
     * Prueft, ob die Wasserbox leer ist.
     */
    public boolean waterBoxEmpty() {
        if (this.waterBoxFull != null) {
            return Boolean.FALSE.equals(this.waterBoxFull);
        }
        return this.waterBoxLevel != null && this.waterBoxLevel <= 0;
    }

    /**
     * Prueft, ob der Wasserbox-Fuellstand groesser als der angegebene Wert ist.
     */
    public boolean waterBoxLevelGreater(int threshold) {
        return this.waterBoxLevel != null && this.waterBoxLevel > threshold;
    }

    /**
     * Prueft, ob der Wasserbox-Fuellstand kleiner als der angegebene Wert ist.
     */
    public boolean waterBoxLevelLess(int threshold) {
        return this.waterBoxLevel != null && this.waterBoxLevel < threshold;
    }

    /**
     * Prueft, ob der Wasserbox-Fuellstand gleich dem angegebenen Wert ist.
     */
    public boolean waterBoxLevelEquals(int value) {
        return this.waterBoxLevel != null && this.waterBoxLevel == value;
    }

    /**
     * Prueft, ob die Schmutzwasserbox voll ist.
     */
    public boolean dirtyWaterBoxFull() {
        if (this.dirtyWaterBoxFull != null) {
            return Boolean.TRUE.equals(this.dirtyWaterBoxFull);
        }
        return this.dirtyWaterBoxLevel != null && this.dirtyWaterBoxLevel >= 100;
    }

    /**
     * Prueft, ob die Schmutzwasserbox leer ist.
     */
    public boolean dirtyWaterBoxEmpty() {
        if (this.dirtyWaterBoxFull != null) {
            return Boolean.FALSE.equals(this.dirtyWaterBoxFull);
        }
        return this.dirtyWaterBoxLevel != null && this.dirtyWaterBoxLevel <= 0;
    }

    /**
     * Prueft, ob der Schmutzwasserbox-Fuellstand groesser als der angegebene Wert ist.
     */
    public boolean dirtyWaterBoxLevelGreater(int threshold) {
        return this.dirtyWaterBoxLevel != null && this.dirtyWaterBoxLevel > threshold;
    }

    /**
     * Prueft, ob der Schmutzwasserbox-Fuellstand kleiner als der angegebene Wert ist.
     */
    public boolean dirtyWaterBoxLevelLess(int threshold) {
        return this.dirtyWaterBoxLevel != null && this.dirtyWaterBoxLevel < threshold;
    }

    /**
     * Prueft, ob der Schmutzwasserbox-Fuellstand gleich dem angegebenen Wert ist.
     */
    public boolean dirtyWaterBoxLevelEquals(int value) {
        return this.dirtyWaterBoxLevel != null && this.dirtyWaterBoxLevel == value;
    }

    /**
     * Prueft, ob der angegebene Modus aktiv ist.
     */
    public boolean modeEquals(String targetMode) {
        return targetMode != null && targetMode.equals(this.mode);
    }

    /**
     * Prueft, ob der Saugroboter im angegebenen Raum ist.
     */
    public boolean inRoom(String roomId) {
        return roomId != null && roomId.equals(this.currentRoom);
    }

    /**
     * Prueft, ob der Saugroboter in der angegebenen Zone ist.
     */
    public boolean inZone(String zoneId) {
        return zoneId != null && zoneId.equals(this.currentZone);
    }

    /**
     * Prueft, ob der Saugroboter nicht im angegebenen Raum ist.
     */
    public boolean outRoom(String roomId) {
        return roomId != null && !roomId.equals(this.currentRoom);
    }

    /**
     * Prueft, ob der Saugroboter nicht in der angegebenen Zone ist.
     */
    public boolean outZone(String zoneId) {
        return zoneId != null && !zoneId.equals(this.currentZone);
    }

    /**
     * Prueft, ob der angegebene Fehler aktiv ist.
     */
    public boolean errorEquals(String targetError) {
        return targetError != null && targetError.equals(this.error);
    }
}

