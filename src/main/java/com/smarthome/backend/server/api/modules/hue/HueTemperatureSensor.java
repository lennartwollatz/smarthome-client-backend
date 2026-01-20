package com.smarthome.backend.server.api.modules.hue;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.smarthome.backend.model.devices.DeviceTemperature;
import com.smarthome.backend.server.api.modules.Module;
/**
 * Repräsentiert einen Hue Temperature Sensor als Gerät.
 * Erweitert DeviceTemperature und implementiert die Hue-spezifische Kommunikation.
 */
public class HueTemperatureSensor extends DeviceTemperature {
    private static final Logger logger = LoggerFactory.getLogger(HueTemperatureSensor.class);
    
    private String bridgeId;
    private String hueResourceId; // Die ID des Temperature-Sensors in der Hue Bridge
    private String batteryRid;
    @com.google.gson.annotations.Expose(serialize = false, deserialize = false)
    private transient HueDeviceController hueDeviceController;
    /**
     * Standardkonstruktor für Gson-Deserialisierung.
     * Wird verwendet, wenn Geräte aus der Datenbank geladen werden.
     */
    public HueTemperatureSensor() {
        super();
        this.bridgeId = null;
        this.hueResourceId = null;
        this.batteryRid = null;
        this.hueDeviceController = null;
        setModuleId(Module.HUE.getModuleId());
        setIsConnected(true);
    }
    
    /**
     * Erstellt einen neuen HueTemperatureSensor.
     * 
     * @param name Der Name des Temperature-Sensors
     * @param id Die eindeutige ID des Temperature-Sensors
     * @param bridgeId Die ID der Hue Bridge, zu der dieser Sensor gehört
     * @param hueResourceId Die ID des Temperature-Sensors in der Hue Bridge
     * @param batteryRid Die ID der Batterie des Temperature-Sensors
     */
    public HueTemperatureSensor(String name, String id, String bridgeId, String hueResourceId, String batteryRid, HueDeviceController hueDeviceController) {
        super(name, id);
        this.bridgeId = bridgeId;
        this.hueResourceId = hueResourceId;
        this.batteryRid = batteryRid;
        this.hueDeviceController = hueDeviceController;
        setModuleId(Module.HUE.getModuleId());
        setIsConnected(true);
    }
    
    @Override
    public void updateValues() {
        logger.info("Update die Werte für {} ", getId());
        if (this.hueDeviceController == null) {
            logger.warn("HueDeviceController ist null - kann Temperaturwert nicht initialisieren für {}", getId());
            return;
        }
        this.hueDeviceController.getTemperature(this).thenAccept(temperature -> {
            super.temperature = temperature;
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren der Temperaturwert für {}", getId(), e);
            return null;    
        });// Standard-Temperatur in Grad Celsius
    }
    
    @Override
    protected void executeSetTemperature(int temperature) {}
    
    public String getBridgeId() {
        return bridgeId;
    }
    
    public void setBridgeId(String bridgeId) {
        this.bridgeId = bridgeId;
    }
    
    public String getHueResourceId() {
        return hueResourceId;
    }
    
    public void setHueResourceId(String hueResourceId) {
        this.hueResourceId = hueResourceId;
    }

    public String getBatteryRid() {
        return batteryRid;
    }

    public void setBatteryRid(String batteryRid) {
        this.batteryRid = batteryRid;
    }
    
    /**
     * Setzt den HueDeviceController für diesen Sensor.
     * Wird verwendet, wenn der Sensor aus der Datenbank geladen wird und der Controller später gesetzt werden muss.
     * 
     * @param hueDeviceController Die HueDeviceController-Instanz
     */
    public void setHueDeviceController(HueDeviceController hueDeviceController) {
        this.hueDeviceController = hueDeviceController;
    }
}

