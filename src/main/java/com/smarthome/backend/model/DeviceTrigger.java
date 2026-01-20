package com.smarthome.backend.model;

import java.util.List;

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
    private List<Object> triggerValues; // Optional, number | string

    public String getTriggerDeviceId(){
        return triggerDeviceId;
    }

    public String getTriggerModuleId(){
        return triggerModuleId;
    }

    public String getTriggerEvent(){
        return triggerEvent;
    }
    
    public List<Object> getTriggerValues(){
        return triggerValues;
    }
}
