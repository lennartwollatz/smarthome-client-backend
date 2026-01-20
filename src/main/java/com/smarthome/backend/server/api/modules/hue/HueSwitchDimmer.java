package com.smarthome.backend.server.api.modules.hue;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.smarthome.backend.model.devices.DeviceSwitchDimmer;
import com.smarthome.backend.server.api.modules.Module;

/**
 * Repräsentiert einen Hue Switch mit Dimmfunktion als Gerät.
 * Erweitert DeviceSwitchDimmer und implementiert die Hue-spezifische Kommunikation.
 */
public class HueSwitchDimmer extends DeviceSwitchDimmer {
    private static final Logger logger = LoggerFactory.getLogger(HueSwitchDimmer.class);
    
    private String bridgeId;
    private String batteryRid;
    
    @com.google.gson.annotations.Expose(serialize = false, deserialize = false)
    private transient HueDeviceController hueDeviceController;
    
    /**
     * Standardkonstruktor für Gson-Deserialisierung.
     * Wird verwendet, wenn Geräte aus der Datenbank geladen werden.
     */
    public HueSwitchDimmer() {
        super();
        this.bridgeId = null;
        this.batteryRid = null;
        this.hueDeviceController = null;
        setModuleId(Module.HUE.getModuleId());
        setIsConnected(true);
    }
    
    /**
     * Erstellt einen neuen HueSwitchDimmer.
     * 
     * @param name Der Name des Switches
     * @param id Die eindeutige ID des Switches
     * @param bridgeId Die ID der Hue Bridge, zu der dieser Switch gehört
     * @param buttonRids Liste der Button-Resource-IDs in der Hue Bridge
     * @param batteryRid Die ID der Batterie des Switches
     * @param hueDeviceController Die HueDeviceController-Instanz für die Kommunikation
     */
    public HueSwitchDimmer(String name, String id, String bridgeId, List<String> buttonRids, String batteryRid, HueDeviceController hueDeviceController) {
        super(name, id, buttonRids != null ? buttonRids : new ArrayList<>());
        this.bridgeId = bridgeId;
        this.batteryRid = batteryRid;
        this.hueDeviceController = hueDeviceController;
        buttonRids.forEach(this::addButton);
        setModuleId(Module.HUE.getModuleId());
        setIsConnected(true);
    }
    
    /**
     * Initialisiert die initialen Werte des Switches.
     */
    @Override
    public void updateValues() {
        // Prüfe, ob hueDeviceController bereits gesetzt ist
        if (this.hueDeviceController == null) {
            logger.debug("updateValues() übersprungen für {} - hueDeviceController ist noch null (wird später erneut aufgerufen)", getId());
            return;
        }
        
        logger.info("Update die Werte für {} ", getId());
        
        // Rufe Batteriestatus ab
        if (batteryRid != null && !batteryRid.isEmpty()) {
            this.hueDeviceController.getBattery(bridgeId, batteryRid).thenAccept(battLevel -> {
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
        } else {
            super.hasBattery = false;
        }
    }
    
    @Override
    protected void executeToggle(String buttonId) {
        // Hue-Switches werden über Event-Streams aktualisiert, nicht direkt gesteuert
        logger.debug("executeToggle für Button {} - wird über Event-Stream verarbeitet", buttonId);
    }
    
    @Override
    protected void executeDoublePress(String buttonId) {
        // Hue-Switches werden über Event-Streams aktualisiert, nicht direkt gesteuert
        logger.debug("executeDoublePress für Button {} - wird über Event-Stream verarbeitet", buttonId);
    }
    
    @Override
    protected void executeTriplePress(String buttonId) {
        // Hue-Switches werden über Event-Streams aktualisiert, nicht direkt gesteuert
        logger.debug("executeTriplePress für Button {} - wird über Event-Stream verarbeitet", buttonId);
    }
    
    @Override
    protected void executeSetBrightness(String buttonId, int brightness) {
        // Hue-Switches werden über Event-Streams aktualisiert, nicht direkt gesteuert
        logger.debug("executeSetBrightness für Button {} - wird über Event-Stream verarbeitet", buttonId);
    }
    
    public String getBridgeId() {
        return bridgeId;
    }
    
    public void setBridgeId(String bridgeId) {
        this.bridgeId = bridgeId;
    }
    
    public String getBatteryRid() {
        return batteryRid;
    }
    
    public void setBatteryRid(String batteryRid) {
        this.batteryRid = batteryRid;
    }
    
    /**
     * Setzt den HueDeviceController für diesen Switch.
     * Wird verwendet, wenn der Switch aus der Datenbank geladen wird und der Controller später gesetzt werden muss.
     * 
     * @param hueDeviceController Die HueDeviceController-Instanz
     */
    public void setHueDeviceController(HueDeviceController hueDeviceController) {
        this.hueDeviceController = hueDeviceController;
    }
}

