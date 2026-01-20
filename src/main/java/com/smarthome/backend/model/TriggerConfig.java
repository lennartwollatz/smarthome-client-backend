package com.smarthome.backend.model;

import lombok.Data;

/**
 * Konfiguration für einen Trigger-Knoten im Workflow.
 */
@Data
public class TriggerConfig {
    private String type; // 'manual' | 'device' | 'time'
    private DeviceTrigger device; // Optional, wenn type 'device'
    private TimeTrigger time; // Optional, wenn type 'time'

    public DeviceTrigger getDeviceTrigger(){
        return device;
    }

    public TimeTrigger getTimeTrigger(){
        return time;
    }
}
