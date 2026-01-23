package com.smarthome.backend.model.devices.helper;

import java.lang.reflect.Type;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
import com.smarthome.backend.model.devices.DeviceLight;
import com.smarthome.backend.model.devices.DeviceLightDimmer;
import com.smarthome.backend.model.devices.DeviceLightDimmerTemperature;
import com.smarthome.backend.model.devices.DeviceLightDimmerTemperatureColor;
import com.smarthome.backend.model.devices.DeviceLightLevel;
import com.smarthome.backend.model.devices.DeviceMotion;
import com.smarthome.backend.model.devices.DeviceSpeaker;
import com.smarthome.backend.model.devices.DeviceTV;
import com.smarthome.backend.model.devices.DeviceTemperature;
import com.smarthome.backend.server.api.modules.Module;
import com.smarthome.backend.server.api.modules.heos.HeosController;
import com.smarthome.backend.server.api.modules.heos.HeosSpeaker;
import com.smarthome.backend.server.api.modules.heos.denon.DenonSpeaker;
import com.smarthome.backend.server.api.modules.hue.HueDeviceController;
import com.smarthome.backend.server.api.modules.hue.HueLight;
import com.smarthome.backend.server.api.modules.hue.HueLightDimmer;
import com.smarthome.backend.server.api.modules.hue.HueLightDimmerTemperature;
import com.smarthome.backend.server.api.modules.hue.HueLightDimmerTemperatureColor;
import com.smarthome.backend.server.api.modules.hue.HueLightLevelSensor;
import com.smarthome.backend.server.api.modules.hue.HueMotionSensor;
import com.smarthome.backend.server.api.modules.hue.HueTemperatureSensor;
import com.smarthome.backend.server.api.modules.lg.LGTV;

/**
 * Gson TypeAdapter für polymorphe Device-Deserialisierung.
 * Deserialisiert basierend auf dem DeviceType und moduleId die entsprechende Device-Klasse.
 * 
 * Unterstützt optionale Controller-Injection für Hue-Devices.
 */
public class DevicePolymorphicAdapter implements JsonSerializer<Device>, JsonDeserializer<Device> {
    
    private static final Gson gson = new GsonBuilder()
        .registerTypeAdapter(DeviceType.class, new DeviceTypeAdapter())
        .create();
    
    private final HueDeviceController hueDeviceController;
    private final HeosController heosController;
    private static final Logger logger = LoggerFactory.getLogger(DevicePolymorphicAdapter.class);
    
    /**
     * Standard-Konstruktor ohne Controller.
     * Devices werden ohne Controller deserialisiert.
     */
    public DevicePolymorphicAdapter() {
        logger.info("Konstruktor DevicePolymorphicAdapter()");
        this.hueDeviceController = null;
        this.heosController = null;
    }
    
    /**
     * Konstruktor mit HueDeviceController.
     * Hue-Devices erhalten automatisch den Controller nach der Deserialisierung.
     * 
     * @param hueDeviceController Der HueDeviceController (kann null sein)
     */
    public DevicePolymorphicAdapter(HueDeviceController hueDeviceController) {
        logger.info("Konstruktor DevicePolymorphicAdapter(HueDeviceController)");
        this.hueDeviceController = hueDeviceController;
        this.heosController = null;
    }

    /**
     * Konstruktor mit HeosController.
     * Heos-Devices erhalten automatisch den Controller nach der Deserialisierung.
     * 
     * @param heosController Der HeosController (kann null sein)
     */
    public DevicePolymorphicAdapter(HeosController heosController) {
        logger.info("Konstruktor DevicePolymorphicAdapter(HeosController)");
        this.heosController = heosController;
        this.hueDeviceController = null;
    }

    /**
     * Konstruktor mit beiden Controllern.
     * Heos-Devices erhalten automatisch den HeosController nach der Deserialisierung.
     * Hue-Devices erhalten automatisch den HueDeviceController nach der Deserialisierung.
     * 
     * @param heosController Der HeosController (kann null sein)
     * @param hueDeviceController Der HueDeviceController (kann null sein)
     */
    public DevicePolymorphicAdapter(HeosController heosController, HueDeviceController hueDeviceController) {
        logger.info("Konstruktor DevicePolymorphicAdapter(HeosController, HueDeviceController)");
        this.heosController = heosController;
        this.hueDeviceController = hueDeviceController;
    }
    
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
        Device device;
        switch (deviceType) {
            case SPEAKER:
                // Prüfe moduleId, um die richtige konkrete Klasse zu bestimmen
                if (Module.DENON.getModuleId().equals(moduleId)) {
                    // Verwende DenonSpeaker für Denon-Geräte
                    device = gson.fromJson(json, DenonSpeaker.class);
                } else {
                    // Fallback: Versuche DeviceSpeaker (kann fehlschlagen, da abstrakt)
                    // In diesem Fall sollte eine ConcreteDeviceSpeaker-Klasse verwendet werden
                    device = gson.fromJson(json, DeviceSpeaker.class);
                }
                break;
            case MOTION:
                // Prüfe moduleId, um die richtige konkrete Klasse zu bestimmen
                if (Module.HUE.getModuleId().equals(moduleId)) {
                    // Prüfe, ob es ein Camera Motion Sensor ist (kann durch Icon oder andere Eigenschaften erkannt werden)
                    // Für jetzt verwenden wir HueMotionSensor als Standard
                    // HueCameraMotionSensor erbt von HueMotionSensor, daher funktioniert das auch
                    device = gson.fromJson(json, HueMotionSensor.class);
                } else {
                    // Fallback: Versuche DeviceMotion (kann fehlschlagen, da abstrakt)
                    device = gson.fromJson(json, DeviceMotion.class);
                }
                break;
            case LIGHT_LEVEL:
                // Prüfe moduleId, um die richtige konkrete Klasse zu bestimmen
                if (Module.HUE.getModuleId().equals(moduleId)) {
                    // Verwende HueLightLevelSensor für Hue Light Level Sensoren
                    device = gson.fromJson(json, HueLightLevelSensor.class);
                } else {
                    // Fallback: Versuche DeviceLightLevel (kann fehlschlagen, da abstrakt)
                    device = gson.fromJson(json, DeviceLightLevel.class);
                }
                break;
            case TEMPERATURE:
                // Prüfe moduleId, um die richtige konkrete Klasse zu bestimmen
                if (Module.HUE.getModuleId().equals(moduleId)) {
                    // Verwende HueTemperatureSensor für Hue Temperature Sensoren
                    device = gson.fromJson(json, HueTemperatureSensor.class);
                } else {
                    // Fallback: Versuche DeviceTemperature (kann fehlschlagen, da abstrakt)
                    device = gson.fromJson(json, DeviceTemperature.class);
                }
                break;
            case LIGHT:
                // Prüfe moduleId, um die richtige konkrete Klasse zu bestimmen
                if (Module.HUE.getModuleId().equals(moduleId)) {
                    // Verwende HueLight für Hue Lights
                    device = gson.fromJson(json, HueLight.class);
                } else {
                    // Fallback: Versuche DeviceLight (kann fehlschlagen, da abstrakt)
                    device = gson.fromJson(json, DeviceLight.class);
                }
                break;
            case LIGHT_DIMMER:
                // Prüfe moduleId, um die richtige konkrete Klasse zu bestimmen
                if (Module.HUE.getModuleId().equals(moduleId)) {
                    // Verwende HueLightDimmer für Hue dimmbare Lights
                    device = gson.fromJson(json, HueLightDimmer.class);
                } else {
                    // Fallback: Versuche DeviceLightDimmer (kann fehlschlagen, da abstrakt)
                    device = gson.fromJson(json, DeviceLightDimmer.class);
                }
                break;
            case LIGHT_DIMMER_TEMPERATURE_COLOR:
                // Prüfe moduleId, um die richtige konkrete Klasse zu bestimmen
                if (Module.HUE.getModuleId().equals(moduleId)) {
                    // Verwende HueLightDimmerTemperatureColor für Hue dimmbare farbige Lights
                    device = gson.fromJson(json, HueLightDimmerTemperatureColor.class);
                } else {
                    // Fallback: Versuche DeviceLightDimmerTemperatureColor (kann fehlschlagen, da abstrakt)
                    device = gson.fromJson(json, DeviceLightDimmerTemperatureColor.class);
                }
                break;
            case LIGHT_DIMMER_TEMPERATURE:
                // Prüfe moduleId, um die richtige konkrete Klasse zu bestimmen
                if (Module.HUE.getModuleId().equals(moduleId)) {
                    // Verwende HueLightDimmerTemperature für Hue dimmbare farbige Lights mit Farbtemperatur
                    device = gson.fromJson(json, HueLightDimmerTemperature.class);
                } else {
                    // Fallback: Versuche DeviceLightDimmerTemperature (kann fehlschlagen, da abstrakt)
                    device = gson.fromJson(json, DeviceLightDimmerTemperature.class);
                }
                break;
            case TV:
                // Prüfe moduleId, um die richtige konkrete Klasse zu bestimmen
                if (Module.LG.getModuleId().equals(moduleId)) {
                    // Verwende LGTV für LG TV
                    device = gson.fromJson(json, LGTV.class);
                    
                } else {
                    // Fallback: Versuche DeviceTV (kann fehlschlagen, da abstrakt)
                    device = gson.fromJson(json, DeviceTV.class);
                    
                }
                break;
            default:
                // Für alle anderen Typen verwende die Basis-Device-Klasse
                device = gson.fromJson(json, Device.class);
                break;
        }

        // Setze Controller für Hue-Devices, falls verfügbar
        // Hinweis: updateValues() wird NICHT automatisch aufgerufen, um unnötige asynchrone Operationen
        // nach dem Deserialisieren zu vermeiden. updateValues() sollte nur explizit aufgerufen werden,
        // wenn die Werte tatsächlich aktualisiert werden müssen.
        if (this.hueDeviceController != null && Module.HUE.getModuleId().equals(moduleId)) {
            if (device instanceof HueLight) {
                ((HueLight) device).setHueDeviceController(this.hueDeviceController);
            } else if (device instanceof HueLightDimmer) {
                ((HueLightDimmer) device).setHueDeviceController(this.hueDeviceController);
            } else if (device instanceof HueLightDimmerTemperatureColor) {
                ((HueLightDimmerTemperatureColor) device).setHueDeviceController(this.hueDeviceController);
            } else if (device instanceof HueLightDimmerTemperature) {
                ((HueLightDimmerTemperature) device).setHueDeviceController(this.hueDeviceController);
            } else if (device instanceof HueLightLevelSensor) {
                ((HueLightLevelSensor) device).setHueDeviceController(this.hueDeviceController);
            } else if (device instanceof HueTemperatureSensor) {
                ((HueTemperatureSensor) device).setHueDeviceController(this.hueDeviceController);
            } else if (device instanceof HueMotionSensor) {
                ((HueMotionSensor) device).setHueDeviceController(this.hueDeviceController);
            } 
        } else if (this.heosController != null && Module.DENON.getModuleId().equals(moduleId)) {
            if (device instanceof HeosSpeaker) {
                ((HeosSpeaker) device).setHeosController(this.heosController);
            }
        } else if (Module.LG.getModuleId().equals(moduleId)) {
            if (device instanceof LGTV) {
                ((LGTV) device).updateValues();
            }
        }
        
        return device;
    }
}

