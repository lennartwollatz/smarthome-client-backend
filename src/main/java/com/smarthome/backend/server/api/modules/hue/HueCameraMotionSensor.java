package com.smarthome.backend.server.api.modules.hue;

/**
 * Repräsentiert einen Hue Camera Motion-Sensor als Gerät.
 * Erweitert HueMotionSensor und erbt alle Funktionalitäten.
 */
public class HueCameraMotionSensor extends HueMotionSensor {
    
    /**
     * Standardkonstruktor für Gson-Deserialisierung.
     * Wird verwendet, wenn Geräte aus der Datenbank geladen werden.
     */
    public HueCameraMotionSensor() {
        super();
        setIcon("&#128249;"); // Video-Kamera Icon
    }
    
    /**
     * Erstellt einen neuen HueCameraMotionSensor.
     * 
     * @param name Der Name des Camera Motion-Sensors
     * @param id Die eindeutige ID des Camera Motion-Sensors
     * @param bridgeId Die ID der Hue Bridge, zu der dieser Sensor gehört
     * @param hueResourceId Die ID des Camera Motion-Sensors in der Hue Bridge
     * @param batteryRid Die ID der Batterie des Camera Motion-Sensors
     * @param hueDeviceController Die HueDeviceController-Instanz für die Kommunikation
     */
    public HueCameraMotionSensor(String name, String id, String bridgeId, String hueResourceId, String batteryRid, HueDeviceController hueDeviceController) {
        super(name, id, bridgeId, hueResourceId, batteryRid, hueDeviceController);
        setIcon("&#128249;"); // Video-Kamera Icon
    }
}

