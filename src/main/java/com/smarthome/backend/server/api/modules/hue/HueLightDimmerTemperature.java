package com.smarthome.backend.server.api.modules.hue;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.smarthome.backend.model.devices.DeviceLightDimmerTemperatureColor;
import com.smarthome.backend.server.api.modules.Module;

/**
 * Repräsentiert ein Hue Light mit Dimm-, Farb- und Farbtemperatur-Funktion als Gerät.
 * Erweitert {@link DeviceLightDimmerTemperatureColor} und implementiert die Hue-spezifische Kommunikation.
 *
 * Analog zu {@link HueLightDimmerTemperatureColor}, {@link HueLightDimmer}, {@link HueLight},
 * {@link HueLightLevelSensor}, {@link HueMotionSensor} und {@link HueTemperatureSensor}.
 */
public class HueLightDimmerTemperature extends DeviceLightDimmerTemperatureColor {

    private static final Logger logger = LoggerFactory.getLogger(HueLightDimmerTemperature.class);

    private String bridgeId;
    private String hueResourceId; // Die ID der Lampe in der Hue Bridge
    private String batteryRid;

    @com.google.gson.annotations.Expose(serialize = false, deserialize = false)
    private transient HueDeviceController hueDeviceController;

    /**
     * Standardkonstruktor für Gson-Deserialisierung.
     * Wird verwendet, wenn Geräte aus der Datenbank geladen werden.
     */
    public HueLightDimmerTemperature() {
        super();
        this.bridgeId = null;
        this.hueResourceId = null;
        this.batteryRid = null;
        this.hueDeviceController = null;
        setModuleId(Module.HUE.getModuleId());
        setIsConnected(true);
    }

    /**
     * Erstellt ein neues HueLightDimmerTemperature-Device.
     *
     * @param name Der Name der Lampe
     * @param id Die eindeutige ID der Lampe
     * @param bridgeId Die ID der Hue Bridge, zu der diese Lampe gehört
     * @param hueResourceId Die ID der Lampe in der Hue Bridge
     * @param batteryRid Die ID der Batterie der Lampe (falls vorhanden)
     * @param hueDeviceController Die HueDeviceController-Instanz für die Kommunikation
     */
    public HueLightDimmerTemperature(String name, String id, String bridgeId, String hueResourceId,
                                          String batteryRid) {
        super(name, id);
        this.bridgeId = bridgeId;
        this.hueResourceId = hueResourceId;
        this.batteryRid = batteryRid;
        setModuleId(Module.HUE.getModuleId());
        setIsConnected(true);
    }

    /**
     * Initialisiert die initialen Werte der Lampe (Dimmwert, Farbtemperatur etc.).
     * Aktuell werden keine Werte aktiv von der Hue API gelesen.
     * Diese Methode kann in Zukunft erweitert werden (z. B. Abruf des aktuellen Dimm-/Temperatur-/On-Status).
     */
    @Override
    public void updateValues() {
        if (hueDeviceController == null) {
            logger.debug("initializeDimmerValues() übersprungen für {} - hueDeviceController ist noch null", getId());
            return;
        }
        hueDeviceController.fetchSingleResource(this.bridgeId, "light", this.hueResourceId).thenAccept(v -> {
            this.on = v.get("on").getAsBoolean();
            this.brightness = v.get("brightness").getAsInt();
            this.temperature = v.get("color_temperature").getAsJsonObject().get("mirek").getAsInt();
        });
    }

    /**
     * Schaltet die Lampe über Hue ein.
     * Aktuell nur Logging / Platzhalter, bis die entsprechende Implementierung im HueDeviceController vorhanden ist.
     */
    @Override
    protected void executeSetOn() {
        if (hueDeviceController == null) {
            logger.warn("HueDeviceController ist null - kann Lampe nicht einschalten für {}", getId());
            return;
        }
        hueDeviceController.setOn(this).thenAccept(v -> {
            this.on = true;
        });
    }

    /**
     * Schaltet die Lampe über Hue aus.
     * Aktuell nur Logging / Platzhalter, bis die entsprechende Implementierung im HueDeviceController vorhanden ist.
     */
    @Override
    protected void executeSetOff() {
        if (hueDeviceController == null) {
            logger.warn("HueDeviceController ist null - kann Lampe nicht ausschalten für {}", getId());
            return;
        }
        hueDeviceController.setOff(this).thenAccept(v -> {
            this.on = false;
        });
    }

    /**
     * Setzt die Helligkeit der Lampe über Hue.
     * Aktuell nur Logging / Platzhalter, bis die entsprechende Implementierung im HueDeviceController vorhanden ist.
     *
     * @param brightness Der neue Helligkeitswert
     */
    @Override
    protected void executeSetBrightness(int brightness) {
        if (hueDeviceController == null) {
            logger.warn("HueDeviceController ist null - kann Helligkeit nicht setzen für {}", getId());
            return;
        }
        hueDeviceController.setBrightness(this, brightness).thenAccept(v -> {
            this.brightness = brightness;
        });
    }

    /**
     * Setzt die Farbtemperatur der Lampe über Hue.
     * Aktuell nur Logging / Platzhalter, bis die entsprechende Implementierung im HueDeviceController vorhanden ist.
     *
     * @param temperature Der neue Farbtemperaturwert
     */
    @Override
    protected void executeSetTemperature(int temperature) {
        if (hueDeviceController == null) {
            logger.warn("HueDeviceController ist null - kann Farbtemperatur nicht setzen für {}", getId());
            return;
        }
        hueDeviceController.setTemperature(this, temperature).thenAccept(v -> {
            this.temperature = temperature;
        });
    }

    /**
     * Setzt die Farbe der Lampe über Hue.
     * Aktuell nur Logging / Platzhalter, bis die entsprechende Implementierung im HueDeviceController vorhanden ist.
     *
     * @param x x-Komponente der Farbe (0.0-1.0)
     * @param y y-Komponente der Farbe (0.0-1.0)
     */
    @Override
    protected void executeSetColor(double x, double y) {
        if (hueDeviceController == null) {
            logger.warn("HueDeviceController ist null - kann Farbe nicht setzen für {}", getId());
            return;
        }
        hueDeviceController.setColor(this, x, y).thenAccept(v -> {
            this.color.setX(x);
            this.color.setY(y);
        });
    }

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
     * Setzt den HueDeviceController für dieses Gerät.
     * Wird verwendet, wenn das Gerät aus der Datenbank geladen wird und der Controller später gesetzt werden muss.
     *
     * @param hueDeviceController Die HueDeviceController-Instanz
     */
    public void setHueDeviceController(HueDeviceController hueDeviceController) {
        this.hueDeviceController = hueDeviceController;
    }
}

