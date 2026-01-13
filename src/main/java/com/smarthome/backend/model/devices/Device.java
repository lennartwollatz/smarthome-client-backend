package com.smarthome.backend.model.devices;

import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonParseException;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;
import com.google.gson.annotations.JsonAdapter;
import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerParams;
import com.smarthome.backend.model.devices.helper.DeviceType;
import com.smarthome.backend.model.devices.helper.DeviceTypeAdapter;
import lombok.Data;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;

/**
 * Repräsentiert ein Gerät im Smart Home System mit allen zugehörigen Eigenschaften
 * und Funktionen.
 */
@Data
public class Device {
    /**
     * Einfache Pair-Klasse für DeviceListenerParams und Runnable.
     */
    protected static class ListenerPair {
        final DeviceListenerParams params;
        final Runnable listener;
        
        ListenerPair(DeviceListenerParams params, Runnable listener) {
            this.params = params;
            this.listener = listener;
        }
    }

    protected String id;
    protected String name;
    protected String room;
    protected String icon;
    
    @JsonAdapter(DeviceTypeAdapter.class)
    private DeviceType type;
    
    @SerializedName("typeLabel")
    private String typeLabel;
    
    @SerializedName("moduleId")
    private String moduleId;
    
    @SerializedName("isConnected")
    protected Boolean isConnected;
    
    @SerializedName("isConnecting")
    protected Boolean isConnecting; // Optional
    
    @SerializedName("functionsBool")
    private List<String> functionsBool; // Optional
    
    @SerializedName("functionsAction")
    private List<String> functionsAction; // Optional
    
    @SerializedName("functionsTrigger")
    private List<String> functionsTrigger; // Optional
}

