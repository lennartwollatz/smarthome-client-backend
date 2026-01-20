package com.smarthome.backend.server.api.modules.hue;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.smarthome.backend.model.devices.DeviceMotion;
import com.smarthome.backend.server.api.modules.Module;
/**
 * Repräsentiert einen Hue Motion-Sensor als Gerät.
 * Erweitert DeviceMotion und implementiert die Hue-spezifische Kommunikation.
 */
public class HueMotionSensor extends DeviceMotion {
    private static final Logger logger = LoggerFactory.getLogger(HueMotionSensor.class);
    
    private String bridgeId;
    private String hueResourceId; // Die ID des Motion-Sensors in der Hue Bridge
    private String batteryRid;
    
    @com.google.gson.annotations.Expose(serialize = false, deserialize = false)
    private transient HueDeviceController hueDeviceController;
    
    /**
     * Standardkonstruktor für Gson-Deserialisierung.
     * Wird verwendet, wenn Geräte aus der Datenbank geladen werden.
     */
    public HueMotionSensor() {
        super();
        this.bridgeId = null;
        this.hueResourceId = null;
        this.batteryRid = null;
        this.hueDeviceController = null;
        setModuleId(Module.HUE.getModuleId());
        setIsConnected(true);
    }
    
    /**
     * Erstellt einen neuen HueMotionSensor.
     * 
     * @param name Der Name des Motion-Sensors
     * @param id Die eindeutige ID des Motion-Sensors
     * @param bridgeId Die ID der Hue Bridge, zu der dieser Sensor gehört
     * @param hueResourceId Die ID des Motion-Sensors in der Hue Bridge
     * @param batteryRid Die ID der Batterie des Motion-Sensors
     * @param hueDeviceController Die HueDeviceController-Instanz für die Kommunikation
     */
    public HueMotionSensor(String name, String id, String bridgeId, String hueResourceId, String batteryRid, HueDeviceController hueDeviceController) {
        super(name, id);
        this.bridgeId = bridgeId;
        this.hueResourceId = hueResourceId;
        this.batteryRid = batteryRid;
        this.hueDeviceController = hueDeviceController;
        setModuleId(Module.HUE.getModuleId());
        setIsConnected(true);
    }
    
    /**
     * Initialisiert die initialen Werte des Motion-Sensors.
     * Wird sowohl vom DeviceMotion-Konstruktor (wenn hueDeviceController noch null ist) als auch
     * vom HueMotionSensor-Konstruktor (nachdem hueDeviceController gesetzt wurde) aufgerufen.
     */
    @Override
    public void updateValues() {
        // Prüfe, ob hueDeviceController bereits gesetzt ist
        // Wenn nicht, wird initializeValues() später erneut aufgerufen, nachdem hueDeviceController gesetzt wurde
        if (this.hueDeviceController == null) {
            logger.debug("updateValues() übersprungen für {} - hueDeviceController ist noch null (wird später erneut aufgerufen)", getId());
            return;
        }
        
        logger.info("Update die Werte für {} ", getId());
        
        // Rufe Motion-Status ab (inkl. lastChanged)
        this.hueDeviceController.getMotion(this).thenAccept(motionStatus -> {
            if (motionStatus != null) {
                if (motionStatus.getMotion() != null) {
                    super.motion = motionStatus.getMotion();
                }
                if (motionStatus.getLastChanged() != null && motionStatus.getMotion() != null && motionStatus.getMotion()) {
                    super.motionLastDetect = motionStatus.getLastChanged();
                }
            }
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren des Motion-Status für {}", getId(), e);
            return null;
        });
        
        // Rufe Sensitivity ab
        this.hueDeviceController.getSensibility(this).thenAccept(sensValue -> {
            if (sensValue != null) {
                super.sensitivity = sensValue;
            }
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren der Sensitivity für {}", getId(), e);
            return null;
        });
        
        // Rufe Batteriestatus ab
        this.hueDeviceController.getBattery(this).thenAccept(battLevel -> {
            if (battLevel != null) {
                super.hasBattery = true;
                super.batteryLevel = battLevel;
            } else {
                super.hasBattery = false;
            }
        }).exceptionally(e -> {
            logger.error("Fehler beim Initialisieren des Batteriestatus für {}", getId(), e);
            return null;
        });
    }
    
    @Override
    protected void executeSetSensibility(int sensitivity) {
        if (hueDeviceController == null) {
            logger.warn("HueDeviceController ist null - kann Empfindlichkeit nicht setzen für {}", getId());
            return;
        }
        hueDeviceController.setSensibility(this, sensitivity);
    }
    
    @Override
    protected void executeSetMotion(boolean motion, String motionLastDetect) {}

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

