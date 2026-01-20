package com.smarthome.backend.model.devices.helper;

/**
 * Parameter-Klasse für Listener-Registrierung bei Device-Klassen.
 */
public class DeviceListenerParams {
    private String key;
    private String name;
    private Object param1;
    private Object param2;
    
    public DeviceListenerParams() {
    }
    
    public DeviceListenerParams(String key, String name) {
        this.key = key;
        this.name = name;
    }
    
    public DeviceListenerParams(String key, String name, Object param1) {
        this.key = key;
        this.name = name;
        this.param1 = param1;
    }
    
    public DeviceListenerParams(String key, String name, Object param1, Object param2) {
        this.key = key;
        this.name = name;
        this.param1 = param1;
        this.param2 = param2;
    }
    
    public String getKey() {
        return key;
    }
    
    public void setKey(String key) {
        this.key = key;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public Object getParam1() {
        return param1;
    }
    
    public void setParam1(Object param1) {
        this.param1 = param1;
    }
    
    public Object getParam2() {
        return param2;
    }
    
    public void setParam2(Object param2) {
        this.param2 = param2;
    }
    
    public Integer getParam1AsInt() {
        if (param1 instanceof Integer) {
            return (Integer) param1;
        } else if (param1 instanceof Number) {
            return ((Number) param1).intValue();
        }
        return null;
    }
    
    public String getParam1AsString() {
        return param1 != null ? param1.toString() : null;
    }
    
    public Boolean getParam1AsBoolean() {
        if (param1 instanceof Boolean) {
            return (Boolean) param1;
        }
        return null;
    }
    
    public Integer getParam2AsInt() {
        if (param2 instanceof Integer) {
            return (Integer) param2;
        } else if (param2 instanceof Number) {
            return ((Number) param2).intValue();
        }
        return null;
    }
    
    public String getParam2AsString() {
        return param2 != null ? param2.toString() : null;
    }
    
    public Boolean getParam2AsBoolean() {
        if (param2 instanceof Boolean) {
            return (Boolean) param2;
        }
        return null;
    }
}

