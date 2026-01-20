package com.smarthome.backend.model.devices.helper;

/**
 * Enum für die verschiedenen Gerätetypen im Smart Home System.
 */
public enum DeviceType {
    LIGHT("light"),
    LIGHT_DIMMER("light-dimmer"),
    LIGHT_DIMMER_TEMPERATURE_COLOR("light-dimmer-temperature-color"),
    LIGHT_DIMMER_TEMPERATURE("light-dimmer-temperature"),
    SWITCH("switch"),
    SWITCH_DIMMER("switch-dimmer"),
    THERMOSTAT("thermostat"),
    MOTION("motion"),
    LIGHT_LEVEL("light-level"),
    TEMPERATURE("temperature"),
    MOTION_LIGHT_LEVEL("motion-light-level"),
    MOTION_LIGHT_LEVEL_TEMPERATURE("motion-light-level-temperature"),
    SENSOR("sensor"),
    VACUUM("vacuum"),
    SPEAKER("speaker"),
    CAR("car"),
    LOCK("lock"),
    TV("tv");
    
    private final String value;
    
    DeviceType(String value) {
        this.value = value;
    }
    
    /**
     * Gibt den String-Wert des Enums zurück (für JSON-Serialisierung).
     * 
     * @return Der String-Wert des Gerätetyps
     */
    public String getValue() {
        return value;
    }
    
    /**
     * Konvertiert einen String-Wert in das entsprechende DeviceType-Enum.
     * 
     * @param value Der String-Wert (z.B. "light", "switch", "speaker", etc.)
     * @return Das entsprechende DeviceType-Enum oder null, wenn der Wert nicht erkannt wird
     */
    public static DeviceType fromString(String value) {
        if (value == null) {
            return null;
        }
        for (DeviceType type : DeviceType.values()) {
            if (type.value.equals(value)) {
                return type;
            }
        }
        return null;
    }
}

