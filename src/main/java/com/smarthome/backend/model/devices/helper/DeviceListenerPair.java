package com.smarthome.backend.model.devices.helper;

/**
 * Einfache Pair-Klasse für DeviceListenerParams und Runnable.
 */
public class DeviceListenerPair {
    private final DeviceListenerParams params;
    private final Runnable listener;
    
    public DeviceListenerPair(DeviceListenerParams params, Runnable listener) {
        this.params = params;
        this.listener = listener;
    }
    
    public DeviceListenerParams getParams() {
        return params;
    }

    public void run(){
        this.listener.run();
    }
}

