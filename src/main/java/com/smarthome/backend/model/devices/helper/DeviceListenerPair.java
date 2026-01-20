package com.smarthome.backend.model.devices.helper;

import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Einfache Pair-Klasse für DeviceListenerParams und Runnable.
 */
public class DeviceListenerPair {
    private static final Logger logger = LoggerFactory.getLogger(DeviceListenerPair.class);
    
    private final DeviceListenerParams params;
    private final Runnable listener;
    private final Consumer<Object> listenerWithParam;
    
    public DeviceListenerPair(DeviceListenerParams params, Runnable listener) {
        this.params = params;
        this.listener = listener;
        this.listenerWithParam = null;
    }
    
    public DeviceListenerPair(DeviceListenerParams params, Consumer<Object> listenerWithParam) {
        this.params = params;
        this.listener = null;
        this.listenerWithParam = listenerWithParam;
    }
    
    public DeviceListenerParams getParams() {
        return params;
    }

    public void run(){
        String actionId = params != null ? params.getKey() : "unbekannt";
        String triggerName = params != null ? params.getName() : "unbekannt";
        logger.info("▶️ Listener ausgeführt: actionId={}, trigger={}", actionId, triggerName);
        
        if (listener != null) {
            this.listener.run();
        } else if (listenerWithParam != null) {
            this.listenerWithParam.accept(null);
        }
    }

    public void run(Object value){
        String actionId = params != null ? params.getKey() : "unbekannt";
        String triggerName = params != null ? params.getName() : "unbekannt";
        logger.info("▶️ Listener ausgeführt (mit Wert): actionId={}, trigger={}, value={}", actionId, triggerName, value);
        
        if (listenerWithParam != null) {
            this.listenerWithParam.accept(value);
        } else if (listener != null) {
            this.listener.run();
        }
    }
}

