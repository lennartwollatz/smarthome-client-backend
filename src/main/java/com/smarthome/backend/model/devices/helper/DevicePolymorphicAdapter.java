package com.smarthome.backend.model.devices.helper;

import java.lang.reflect.Type;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.model.devices.DeviceSpeaker;
import com.smarthome.backend.server.api.modules.Module;
import com.smarthome.backend.server.api.modules.heos.denon.DenonSpeaker;

/**
 * Gson TypeAdapter für polymorphe Device-Deserialisierung.
 * Deserialisiert basierend auf dem DeviceType und moduleId die entsprechende Device-Klasse.
 */
public class DevicePolymorphicAdapter implements JsonSerializer<Device>, JsonDeserializer<Device> {
    
    private static final Gson gson = new GsonBuilder()
        .registerTypeAdapter(DeviceType.class, new DeviceTypeAdapter())
        .create();
    
    @Override
    public JsonElement serialize(Device src, Type typeOfSrc, JsonSerializationContext context) {
        // Normale Serialisierung - Gson kann das automatisch
        return gson.toJsonTree(src);
    }
    
    @Override
    public Device deserialize(JsonElement json, Type typeOfT, JsonDeserializationContext context)
            throws JsonParseException {
        if (!json.isJsonObject()) {
            throw new JsonParseException("Device muss ein JSON-Objekt sein");
        }
        
        JsonObject jsonObject = json.getAsJsonObject();
        
        // Lese den type-Wert aus dem JSON
        JsonElement typeElement = jsonObject.get("type");
        if (typeElement == null) {
            // Fallback: Versuche typeLabel oder verwende Device als Standard
            return gson.fromJson(json, Device.class);
        }
        
        DeviceType deviceType;
        if (typeElement.isJsonPrimitive() && typeElement.getAsJsonPrimitive().isString()) {
            String typeValue = typeElement.getAsString();
            deviceType = DeviceType.fromString(typeValue);
        } else {
            // Versuche als Objekt zu deserialisieren (falls type ein Objekt ist)
            deviceType = gson.fromJson(typeElement, DeviceType.class);
        }
        
        if (deviceType == null) {
            // Fallback: Verwende Device als Standard
            return gson.fromJson(json, Device.class);
        }
        
        // Lese moduleId aus dem JSON (falls vorhanden)
        String moduleId = null;
        JsonElement moduleIdElement = jsonObject.get("moduleId");
        if (moduleIdElement != null && moduleIdElement.isJsonPrimitive() && moduleIdElement.getAsJsonPrimitive().isString()) {
            moduleId = moduleIdElement.getAsString();
        }
        
        // Deserialisiere basierend auf dem DeviceType und moduleId
        switch (deviceType) {
            case SPEAKER:
                // Prüfe moduleId, um die richtige konkrete Klasse zu bestimmen
                if (Module.DENON.getModuleId().equals(moduleId)) {
                    // Verwende DenonSpeaker für Denon-Geräte
                    return gson.fromJson(json, DenonSpeaker.class);
                }
                // Fallback: Versuche DeviceSpeaker (kann fehlschlagen, da abstrakt)
                // In diesem Fall sollte eine ConcreteDeviceSpeaker-Klasse verwendet werden
                return gson.fromJson(json, DeviceSpeaker.class);
            // Hier können weitere Device-Typen hinzugefügt werden:
            // case LIGHT:
            //     if ("sonoff".equals(moduleId)) {
            //         return gson.fromJson(json, SonoffLight.class);
            //     }
            //     return gson.fromJson(json, DeviceLight.class);
            // case SWITCH:
            //     return gson.fromJson(json, DeviceSwitch.class);
            // etc.
            default:
                // Für alle anderen Typen verwende die Basis-Device-Klasse
                return gson.fromJson(json, Device.class);
        }
    }
}

