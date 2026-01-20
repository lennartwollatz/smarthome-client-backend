package com.smarthome.backend.model.devices.helper;

import java.lang.reflect.Type;

import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonParseException;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;

/**
 * Gson TypeAdapter für DeviceType-Enum.
 * Serialisiert das Enum als String-Wert und deserialisiert Strings zurück zum Enum.
 */
public class DeviceTypeAdapter implements JsonSerializer<DeviceType>, JsonDeserializer<DeviceType> {
    
    @Override
    public JsonElement serialize(DeviceType src, Type typeOfSrc, JsonSerializationContext context) {
        return new JsonPrimitive(src.getValue());
    }
    
    @Override
    public DeviceType deserialize(JsonElement json, Type typeOfT, JsonDeserializationContext context)
            throws JsonParseException {
        String value = json.getAsString();
        return DeviceType.fromString(value);
    }
}

