package com.smarthome.backend.model;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

/**
 * Konfiguration für einen Geräte-Trigger.
 */
@Data
public class DeviceTrigger {
    @SerializedName("triggerDeviceId")
    private String triggerDeviceId;
    
    @SerializedName("triggerModuleId")
    private String triggerModuleId;
    
    @SerializedName("triggerEvent")
    private String triggerEvent; // z.B. 'on', 'off', 'motion', 'temperature_change'
    
    @SerializedName("triggerValue")
    private Object triggerValue; // Optional, number | string
}
