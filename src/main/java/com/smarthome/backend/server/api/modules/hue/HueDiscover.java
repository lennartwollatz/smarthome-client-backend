package com.smarthome.backend.server.api.modules.hue;

import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import javax.jmdns.JmDNS;
import javax.jmdns.ServiceEvent;
import javax.jmdns.ServiceInfo;
import javax.jmdns.ServiceListener;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.smarthome.backend.model.Module;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;

/**
 * Klasse für die Discovery von Hue Bridges im Netzwerk und das Abrufen der verbundenen Geräte.
 * Nutzt mDNS (JmDNS) für lokale Discovery und optional N-UPnP für Remote-Discovery.
 */
public class HueDiscover {
    private static final Logger logger = LoggerFactory.getLogger(HueDiscover.class);
    
    private final Map<String, HueDiscoveredBridge> bridges = new ConcurrentHashMap<>();
    
    // Repository für persistente Speicherung der Bridges
    private final Repository<HueDiscoveredBridge> bridgeRepository;
    
    // Repository für Module (um Bridges im Hue-Modul zu speichern)
    private final Repository<Module> moduleRepository;
    
    // Repository für Devices (um Motion-Sensoren zu speichern)
    private final Repository<Device> deviceRepository;
    
    // HueDeviceController für die Kommunikation mit Hue-Geräten
    private final HueDeviceController hueDeviceController;
    
    // JmDNS-Instanzen und Listener für mDNS-Discovery
    private final List<JmDNS> jmdnsInstances = new ArrayList<>();
    private ServiceListener mdnsListener;
    
    
    // Logging / Metrics (pro Discovery-Lauf)
    private volatile String currentRunId;
    
    /**
     * Konstruktor ohne DatabaseManager (für Rückwärtskompatibilität).
     */
    public HueDiscover() {
        this.bridgeRepository = null;
        this.moduleRepository = null;
        this.deviceRepository = null;
        this.hueDeviceController = new HueDeviceController();
    }
    
    /**
     * Konstruktor mit DatabaseManager für persistente Speicherung.
     */
    public HueDiscover(DatabaseManager databaseManager) {
        if (databaseManager != null) {
            this.bridgeRepository = new JsonRepository<>(databaseManager, HueDiscoveredBridge.class);
            this.moduleRepository = new JsonRepository<>(databaseManager, Module.class);
            this.deviceRepository = new JsonRepository<>(databaseManager, Device.class);
            this.hueDeviceController = new HueDeviceController(databaseManager);
        } else {
            this.bridgeRepository = null;
            this.moduleRepository = null;
            this.deviceRepository = null;
            this.hueDeviceController = new HueDeviceController();
        }
    }
    
    private String runTag() {
        return currentRunId != null ? "[run=" + currentRunId + "] " : "";
    }
    
    /**
     * Liefert den mDNS-Service-Typ für Hue Bridges.
     */
    private String getMdnsServiceType() {
        return "_hue._tcp.local.";
    }
    
    /**
     * Startet die mDNS-Discovery mit JmDNS auf allen geeigneten Netzwerk-Interfaces.
     */
    private void startMdnsDiscovery() {
        // Sicherstellen, dass keine alten Instanzen herumliegen
        stopMdnsDiscovery();
        
        try {
            mdnsListener = new ServiceListener() {
                @Override
                public void serviceAdded(ServiceEvent event) {
                    ServiceInfo info = event.getInfo();
                    String type = event.getType();
                    String name = event.getName();
                    String host = "n/a";
                    if (info != null && info.getInetAddresses() != null && info.getInetAddresses().length > 0) {
                        host = info.getInetAddresses()[0].getHostAddress();
                    }
                    int port = info != null ? info.getPort() : -1;

                    logger.debug(
                        "{}mDNS serviceAdded: type='{}', name='{}', host='{}', port={}",
                        runTag(), type, name, host, port
                    );
                    // Details nachladen
                    event.getDNS().requestServiceInfo(event.getType(), event.getName(), true);
                }
                
                @Override
                public void serviceRemoved(ServiceEvent event) {
                    ServiceInfo info = event.getInfo();
                    String host = "n/a";
                    if (info != null && info.getInetAddresses() != null && info.getInetAddresses().length > 0) {
                        host = info.getInetAddresses()[0].getHostAddress();
                    }
                    logger.info("{}mDNS serviceRemoved: type='{}', name='{}', host={}", runTag(),
                        event.getType(), event.getName(), host);
                }
                
                @Override
                public void serviceResolved(ServiceEvent event) {
                    logger.debug("{}mDNS serviceResolved: {}", runTag(), event.toString());
                    ServiceInfo info = event.getInfo();
                    String name = info != null ? info.getName() : event.getName();
                    String discoveredType = info != null ? info.getType() : event.getType();
                    String host = "n/a";
                    if (info != null && info.getInetAddresses() != null && info.getInetAddresses().length > 0) {
                        host = info.getInetAddresses()[0].getHostAddress();
                    }

                    logger.debug("{}mDNS serviceResolved: type='{}', name='{}', host={}", runTag(),
                        discoveredType, name, host);

                    if (info == null) {
                        logger.debug("{}mDNS serviceResolved ignoriert: ServiceInfo ist null", runTag());
                        return;
                    }

                    // Hue Bridge gefunden - Bridge-Informationen erstellen
                    try {
                        // Port
                        int port = info.getPort();
                        
                        // IPv4 und IPv6 Adressen extrahieren
                        String ipv4Address = null;
                        String ipv6Address = null;
                        InetAddress[] addresses = info.getInetAddresses();
                        if (addresses != null) {
                            for (InetAddress addr : addresses) {
                                if (addr instanceof java.net.Inet4Address) {
                                    ipv4Address = addr.getHostAddress();
                                } else if (addr instanceof java.net.Inet6Address) {
                                    String ipv6 = addr.getHostAddress();
                                    // Entferne eckige Klammern falls vorhanden
                                    if (ipv6.startsWith("[") && ipv6.endsWith("]")) {
                                        ipv6 = ipv6.substring(1, ipv6.length() - 1);
                                    }
                                    ipv6Address = ipv6;
                                }
                            }
                        }
                        // Fallback: verwende host als IPv4, falls keine Adressen gefunden
                        if (ipv4Address == null && host != null && !host.equals("n/a")) {
                            String cleanedHost = host.trim();
                            if (cleanedHost.startsWith("[") && cleanedHost.endsWith("]")) {
                                ipv6Address = cleanedHost.substring(1, cleanedHost.length() - 1);
                            } else {
                                ipv4Address = cleanedHost;
                            }
                        }
                        
                        // Name aus mDNS-Antwort
                        String mdnsName = name;
                        
                        // Verwende Name als friendlyName, falls vorhanden
                        String friendlyName = name;
                        if (friendlyName == null || friendlyName.isEmpty()) {
                            friendlyName = ipv4Address != null ? ipv4Address : host;
                        }
                        
                        // Erstelle Bridge-Objekt mit temporärer bridgeId (wird später durch generateDeviceId ersetzt)
                        String tempIpAddress = ipv4Address != null ? ipv4Address : host;
                        HueDiscoveredBridge bridge = new HueDiscoveredBridge(
                            "temp-id",
                            friendlyName,
                            tempIpAddress
                        );
                        
                        // Setze mDNS-basierte Eigenschaften
                        bridge.setIpv4Address(ipv4Address);
                        bridge.setIpv6Address(ipv6Address);
                        bridge.setPort(port);
                        bridge.setMdnsName(mdnsName);
                        bridge.setFriendlyName(friendlyName);
                        bridge.setManufacturer("Philips");
                        
                        // Generiere deviceId mit generateDeviceId
                        String bridgeId = generateDeviceId(bridge);
                        bridge.setBridgeId(bridgeId);
                        
                        // Prüfe, ob die Bridge bereits existiert
                        if (bridges.containsKey(bridgeId)) {
                            logger.debug("{}mDNS Bridge bereits vorhanden, überspringe: bridgeId='{}', name='{}', host={}",
                                runTag(), bridgeId, friendlyName, host);
                            return;
                        }
                        
                        bridges.put(bridgeId, bridge);
                        logger.info("{}mDNS Bridge akzeptiert und hinzugefügt: bridgeId='{}', name='{}', ipv4={}, ipv6={}, port={}",
                            runTag(), bridgeId, friendlyName, ipv4Address, ipv6Address, port);
                    } catch (Exception e) {
                        logger.warn("{}Fehler beim Erstellen der HueDiscoveredBridge für {}: {}", 
                            runTag(), host, e.getMessage());
                    }
                }
            };

            // Für alle geeigneten Netzwerk-Interfaces eine JmDNS-Instanz erzeugen
            java.util.Enumeration<java.net.NetworkInterface> ifaces = java.net.NetworkInterface.getNetworkInterfaces();
            while (ifaces.hasMoreElements()) {
                java.net.NetworkInterface ni = ifaces.nextElement();
                if (!ni.isUp() || ni.isLoopback() || ni.isVirtual()) {
                    continue;
                }
                java.util.Enumeration<InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress addr = addrs.nextElement();
                    if (addr.isLoopbackAddress() || addr.isMulticastAddress()) {
                        continue;
                    }
                    try {
                        JmDNS jm = JmDNS.create(addr);
                        jmdnsInstances.add(jm);
                        jm.addServiceListener(getMdnsServiceType(), mdnsListener);
                        logger.info("{}JmDNS mDNS Discovery gestartet auf Interface {} ({}) für '{}'",
                            runTag(), ni.getName(), addr.getHostAddress(), getMdnsServiceType());
                    } catch (Exception ex) {
                        logger.warn("{}Konnte JmDNS auf Interface {} ({}) nicht starten: {}", runTag(),
                            ni.getName(), addr.getHostAddress(), ex.getMessage());
                    }
                }
            }

            if (jmdnsInstances.isEmpty()) {
                logger.warn("{}Konnte keine JmDNS-Instanz für mDNS-Discovery erzeugen (keine geeigneten Interfaces)", runTag());
            } else {
                logger.info("{}mDNS-Discovery mit JmDNS gestartet auf {} Interface(s) (ServiceType='{}')",
                    runTag(), jmdnsInstances.size(), getMdnsServiceType());
            }
        } catch (Exception e) {
            logger.warn("{}Konnte JmDNS für mDNS-Discovery nicht initialisieren: {}", runTag(), e.getMessage());
        }
    }
    
    /**
     * Stoppt die mDNS-Discovery und bereinigt alle JmDNS-Instanzen.
     */
    private void stopMdnsDiscovery() {
        if (!jmdnsInstances.isEmpty()) {
            for (JmDNS jm : jmdnsInstances) {
                try {
                    if (mdnsListener != null) {
                        jm.removeServiceListener(getMdnsServiceType(), mdnsListener);
                    }
                    jm.close();
                    logger.debug("{}JmDNS für mDNS-Discovery geschlossen", runTag());
                } catch (Exception e) {
                    logger.warn("{}Fehler beim Schließen von JmDNS: {}", runTag(), e.getMessage());
                }
            }
            jmdnsInstances.clear();
        }
        mdnsListener = null;
    }
    
    /**
     * Generiert eine eindeutige deviceId für die Bridge basierend auf IP-Adresse und Port.
     * 
     * @param bridge Die Bridge, für die die deviceId generiert werden soll
     * @return Die generierte deviceId
     */
    private String generateDeviceId(HueDiscoveredBridge bridge) {
        String address = bridge.getBestConnectionAddress();
        int port = bridge.getPort();
        // Erstelle deviceId aus IP und Port: z.B. "hue-bridge-192-168-1-10-80"
        String deviceId = "hue-bridge-" + address.replace(".", "-") + "-" + port;
        return deviceId;
    }
        
    
    /**
     * Bereichert alle gefundenen Bridges mit deviceId und optional Geräten.
     * Wenn eine Bridge bereits in der Datenbank existiert, werden die Pairing-Informationen
     * (username, clientKey und isPaired) aus der Datenbank übernommen.
     * Speichert die vollständigen Bridge-Objekte auch im Hue-Modul.
     */
    private void enrichBridges(List<HueDiscoveredBridge> snapshot) {
        List<HueDiscoveredBridge> bridgesForModule = new ArrayList<>();
        
        for (HueDiscoveredBridge bridge : snapshot) {
            logger.debug("{}Bereichere Bridge: bridgeId='{}' address={}",
                runTag(), bridge.getBridgeId(), bridge.getBestConnectionAddress());
            
            // Generiere deviceId für die Bridge
            String deviceId = generateDeviceId(bridge);
            bridge.setBridgeId(deviceId);
            logger.debug("{}DeviceId für Bridge generiert: {}", runTag(), deviceId);
            
            // Speichere Bridge in der Datenbank (falls Repository vorhanden)
            if (bridgeRepository != null) {
                try {
                    // Prüfe, ob die Bridge bereits in der Datenbank existiert
                    Optional<HueDiscoveredBridge> existingBridgeOpt = bridgeRepository.findById(deviceId);
                    if (existingBridgeOpt.isPresent()) {
                        HueDiscoveredBridge existingBridge = existingBridgeOpt.get();
                        // Übernehme Pairing-Informationen aus der Datenbank
                        bridge.setIsPaired(existingBridge.getIsPaired());
                        bridge.setUsername(existingBridge.getUsername());
                        bridge.setClientKey(existingBridge.getClientKey());
                        logger.info("{}Bridge {} bereits in Datenbank gefunden - Pairing-Informationen übernommen (isPaired: {}, username: {})", 
                            runTag(), deviceId, existingBridge.getIsPaired(), 
                            existingBridge.getUsername() != null ? existingBridge.getUsername().substring(0, Math.min(10, existingBridge.getUsername().length())) + "..." : "null");
                    }
                    
                    bridgeRepository.save(deviceId, bridge);
                    logger.debug("{}Bridge in Datenbank gespeichert: {}", runTag(), deviceId);
                    
                    // Sammle vollständige Bridge für Modul-Speicherung
                    bridgesForModule.add(bridge);
                } catch (Exception e) {
                    logger.warn("{}Fehler beim Speichern der Bridge {} in Datenbank: {}", 
                        runTag(), deviceId, e.getMessage());
                }
            }
        }
        
        // Speichere alle vollständigen Bridge-Objekte im Hue-Modul
        if (moduleRepository != null && !bridgesForModule.isEmpty()) {
            try {
                String moduleId = "hue";
                Optional<Module> moduleOpt = moduleRepository.findById(moduleId);
                Module module;
                
                if (moduleOpt.isPresent()) {
                    module = moduleOpt.get();
                } else {
                    // Erstelle Default-Modul falls nicht vorhanden
                    com.smarthome.backend.server.api.modules.Module enumModule =
                        com.smarthome.backend.server.api.modules.Module.fromModuleId(moduleId);
                    if (enumModule != null) {
                        module = enumModule.toDefaultModel();
                    } else {
                        logger.warn("{}Konnte Hue-Modul nicht erstellen: moduleId '{}' nicht gefunden", runTag(), moduleId);
                        return;
                    }
                }
                
                // Initialisiere moduleData falls null
                if (module.getModuleData() == null) {
                    module.setModuleData(new java.util.HashMap<>());
                }
                
                // Speichere vollständige Bridge-Objekte im Modul
                module.getModuleData().put("bridges", bridgesForModule);
                moduleRepository.save(moduleId, module);
                
                logger.info("{}{} Bridges im Hue-Modul gespeichert", runTag(), bridgesForModule.size());
            } catch (Exception e) {
                logger.warn("{}Fehler beim Speichern der Bridges im Hue-Modul: {}", runTag(), e.getMessage());
            }
        }
    }

    
    /**
     * Startet einen Discovery-Suchlauf ohne Username (nur Bridge-Informationen, keine Geräte).
     * 
     * @param searchDurationMs Die Dauer der Suche in Millisekunden
     * @return Liste von HueDiscoveredBridge mit Bridge-Informationen
     */
    public List<HueDiscoveredBridge> discoverBridges(long searchDurationMs) {
        currentRunId = UUID.randomUUID().toString().substring(0, 8);

        logger.info("{}Starte mDNS Discovery-Suchlauf für {} ms", runTag(), searchDurationMs);
        
        // Leere die bisher gefundenen Bridges
        bridges.clear();
        
        // Starte mDNS-Discovery mit JmDNS
        startMdnsDiscovery();
        
        try {
            // Warte auf die Suche, damit mDNS-Discovery laufen kann
            Thread.sleep(searchDurationMs);
            
            // Snapshot, damit mDNS-Thread während Konfigurations-Lookup nicht iterierende Strukturen verändert
            List<HueDiscoveredBridge> snapshot = new ArrayList<>(bridges.values());
            logger.info("{}Discovery-Suchlauf abgeschlossen. {} Bridges gefunden", runTag(), snapshot.size());
            logger.debug("{}Bridges snapshot: {}", runTag(), snapshot);
            
            // Für jede gefundene Bridge die Konfiguration und Geräte abrufen
            enrichBridges(snapshot);
            
            return snapshot;
            
        } catch (InterruptedException e) {
            logger.error("{}Discovery-Suchlauf wurde unterbrochen", runTag(), e);
            Thread.currentThread().interrupt();
            return new ArrayList<>();
        } finally {
            // Stoppe den Discovery-Prozess
            stopMdnsDiscovery();
            currentRunId = null;
        }
    }
    
    /**
     * Sucht alle Geräte einer gepaarten Hue Bridge über die Hue CLIP API v2.
     * Die Bridge muss bereits gepaart sein (username vorhanden).
     * 
     * Ruft folgende Ressourcen ab:
     * - /clip/v2/resource/light (Lights)
     * - /clip/v2/resource/motion (Motion-Sensoren) - wird vollständig verarbeitet und als DeviceMotion gespeichert
     * - /clip/v2/resource/light_level (Light-Level-Sensoren)
     * - /clip/v2/resource/temperature (Temperatur-Sensoren)
     * - /clip/v2/resource/button (Button-Sensoren)
     * - /clip/v2/resource/grouped_light (Groups)
     * 
     * @param bridgeId Die deviceId der Bridge
     * @return Liste der erzeugten Devices (aktuell nur Motion-Sensoren)
     * @throws Exception wenn die Bridge nicht gefunden wurde, nicht gepaart ist oder ein Fehler beim Abrufen auftrat
     */
    public List<Device> discoverDevices(String bridgeId) throws Exception {
        logger.info("========== STARTE GERÄTE-SUCHE FÜR BRIDGE: {} ==========", bridgeId);
        
        if (bridgeRepository == null) {
            logger.error("Bridge-Repository ist null - DatabaseManager nicht initialisiert");
            throw new IllegalStateException("DatabaseManager nicht initialisiert - Bridge kann nicht aus Datenbank geladen werden");
        }
        
        logger.info("Lade Bridge aus Datenbank: bridgeId={}", bridgeId);
        
        // Lade Bridge aus der Datenbank
        Optional<HueDiscoveredBridge> bridgeOpt = bridgeRepository.findById(bridgeId);
        if (!bridgeOpt.isPresent()) {
            logger.error("Bridge mit ID '{}' nicht in Datenbank gefunden", bridgeId);
            throw new Exception("Bridge mit ID '" + bridgeId + "' nicht in Datenbank gefunden. Bitte zuerst Discovery durchführen.");
        }
        
        HueDiscoveredBridge bridge = bridgeOpt.get();
        logger.info("Bridge aus Datenbank geladen: bridgeId={}, friendlyName={}, ipv4={}, ipv6={}, port={}", 
            bridge.getBridgeId(), bridge.getFriendlyName(), bridge.getIpv4Address(), bridge.getIpv6Address(), bridge.getPort());
        
        // Prüfe, ob Bridge gepaart ist
        logger.info("Prüfe Pairing-Status: isPaired={}, username={}", 
            bridge.getIsPaired(), bridge.getUsername() != null ? bridge.getUsername().substring(0, Math.min(10, bridge.getUsername().length())) + "..." : "null");
        
        if (bridge.getIsPaired() == null || !bridge.getIsPaired() || bridge.getUsername() == null || bridge.getUsername().isEmpty()) {
            logger.error("Bridge '{}' ist nicht gepaart - Pairing erforderlich", bridgeId);
            throw new Exception("Bridge '" + bridgeId + "' ist nicht gepaart. Bitte zuerst Pairing durchführen.");
        }
        
        String bridgeIp = bridge.getBestConnectionAddress();
        int port = bridge.getPort();
        String username = bridge.getUsername();
        
        logger.info("Bridge-Verbindungsdaten: bridgeIp={}, port={}, username={}", bridgeIp, port, username.substring(0, Math.min(10, username.length())) + "...");
        
        if (bridgeIp == null || bridgeIp.isEmpty()) {
            logger.error("Keine gültige IP-Adresse für Bridge '{}' gefunden", bridgeId);
            throw new Exception("Keine gültige IP-Adresse für Bridge '" + bridgeId + "' gefunden");
        }
        
        logger.info("Bridge gefunden und gepaart: {} -> {}:{} (username: {})", bridgeId, bridgeIp, port, username.substring(0, Math.min(10, username.length())) + "...");
        
        // Initialisiere Listen für Geräte-IDs
        List<String> deviceIds = new ArrayList<>();
        
        // Liste für erzeugte Devices
        List<Device> discoveredDevices = new ArrayList<>();
        
        logger.info("Starte Abrufen der Devices über HueDeviceController für Bridge: {}", bridgeId);
        
        // Abrufen der Devices über HueDeviceController
        try {
            processDevices(
                bridgeId,
                (JsonObject obj) -> convertToDevice(obj, bridgeId),
                discoveredDevices,
                deviceIds
            );
            logger.info("Devices-Verarbeitung abgeschlossen: {} Devices erzeugt, {} Device-IDs gesammelt", 
                discoveredDevices.size(), deviceIds.size());
        } catch (Exception processEx) {
            logger.error("FEHLER beim Verarbeiten der Devices für Bridge {}: {}", bridgeId, processEx.getMessage(), processEx);
            throw processEx;
        }

        logger.info("Setze Device-IDs in Bridge: {} Device-IDs", deviceIds.size());
        bridge.setDevices(deviceIds);
        
        // Speichere aktualisierte Bridge in der Datenbank
        try {
            logger.info("Speichere aktualisierte Bridge in Datenbank: bridgeId={}", bridgeId);
            bridgeRepository.save(bridgeId, bridge);
            logger.info("Bridge {} erfolgreich mit {} Geräten aktualisiert", 
                bridgeId, deviceIds.size());
        } catch (Exception saveEx) {
            logger.error("Fehler beim Speichern der Geräte-IDs für Bridge {}: {}", bridgeId, saveEx.getMessage(), saveEx);
            throw new Exception("Fehler beim Speichern der Geräte-IDs: " + saveEx.getMessage());
        }
        
        logger.info("========== GERÄTE-SUCHE ABGESCHLOSSEN: {} Devices für Bridge {} erzeugt und gespeichert ==========", discoveredDevices.size(), bridgeId);
        return discoveredDevices;
    }
    
    /**
     * Verarbeitet Devices von der Hue Bridge über den HueDeviceController.
     * Ruft die Devices ab, konvertiert sie, speichert sie in der Datenbank
     * und fügt sie zur Liste der entdeckten Devices hinzu.
     * 
     * @param bridgeId Die ID der Bridge
     * @param converter Die Funktion zum Konvertieren eines JsonObject zu einer Liste von Devices
     * @param discoveredDevices Die Liste, zu der die konvertierten Devices hinzugefügt werden
     * @param idList Die Liste, zu der die Device-IDs hinzugefügt werden
     */
    private void processDevices(
            String bridgeId,
            java.util.function.Function<JsonObject, List<Device>> converter,
            List<Device> discoveredDevices,
            List<String> idList) {
        logger.info(">>> processDevices START: bridgeId={}", bridgeId);
        
        try {
            logger.info("Rufe alle Devices über HueDeviceController ab: bridgeId={}, resourceType=device", bridgeId);
            // Rufe alle Devices über HueDeviceController ab
            List<JsonObject> deviceObjects = hueDeviceController.fetchAllResources(bridgeId, "device")
                .get(); // Synchron warten, da wir in einem synchronen Kontext sind
            
            logger.info("Devices abgerufen: {} Device-Objekte gefunden", deviceObjects.size());
            
            // Konvertiere zu Devices und speichere in Datenbank
            int deviceIndex = 0;
            for (JsonObject obj : deviceObjects) {
                deviceIndex++;
                logger.info("--- Verarbeite Device {}/{} ---", deviceIndex, deviceObjects.size());
                
                try {
                    logger.debug("Device-Objekt {}: {}", deviceIndex, obj.toString());
                    
                    logger.info("Konvertiere Device-Objekt {} zu Device(s)...", deviceIndex);
                    List<Device> devices = converter.apply(obj);
                    
                    if (devices != null) {
                        logger.info("Konvertierung erfolgreich: {} Device(s) erzeugt", devices.size());
                        
                        for (int i = 0; i < devices.size(); i++) {
                            Device device = devices.get(i);
                            logger.info("Verarbeite Device {}/{} aus Device-Objekt {}", i + 1, devices.size(), deviceIndex);
                            
                            if (device != null) {
                                logger.info("Device erzeugt: id={}, type={}, name={}", 
                                    device.getId(), device.getClass().getSimpleName(), device.getName());
                                
                                // Speichere in Datenbank
                                if (deviceRepository != null) {
                                    logger.info("Speichere Device in Datenbank: id={}", device.getId());
                                    try {
                                        deviceRepository.save(device.getId(), device);
                                        logger.info("Device erfolgreich in Datenbank gespeichert: id={}", device.getId());
                                    } catch (Exception saveEx) {
                                        logger.error("FEHLER beim Speichern des Devices in Datenbank: id={}, error={}", 
                                            device.getId(), saveEx.getMessage(), saveEx);
                                        throw saveEx;
                                    }
                                } else {
                                    logger.warn("Device-Repository ist null - Device wird nicht gespeichert: id={}", device.getId());
                                }
                                
                                discoveredDevices.add(device);
                                logger.info("Device zur Discovered-Liste hinzugefügt: id={}", device.getId());
                                
                                // Für Device-Objekte verwenden wir die ID des Devices
                                if (device.getId() != null) {
                                    idList.add(device.getId());
                                    logger.info("Device-ID zur ID-Liste hinzugefügt: id={}", device.getId());
                                } else {
                                    logger.warn("Device-ID ist null - wird nicht zur ID-Liste hinzugefügt");
                                }
                            } else {
                                logger.warn("Device ist null - überspringe");
                            }
                        }
                    } else {
                        logger.warn("Konvertierung zurückgegeben null - keine Devices erzeugt");
                    }
                } catch (Exception convertEx) {
                    logger.error("FEHLER beim Konvertieren von Device-Objekt {}: {}", deviceIndex, convertEx.getMessage(), convertEx);
                    // Weiter mit nächstem Device
                }
            }
            
            logger.info(">>> processDevices ENDE: {} Devices verarbeitet, {} in Liste", deviceObjects.size(), discoveredDevices.size());
        } catch (Exception e) {
            logger.error("FEHLER beim Abrufen von Devices für Bridge {}: {}", bridgeId, e.getMessage(), e);
            throw new RuntimeException("Fehler beim Abrufen von Devices: " + e.getMessage(), e);
        }
    }
    
    /**
     * Datenklasse für die Haupteigenschaften eines Geräts aus dem deviceObj.
     */
    private static class DeviceProperties {
        private final String deviceId;
        private final String deviceName;
        private final String archetype;
        private final String productName;
        private final String manufacturerName;
        private final String modelId;
        private final String rid_battery;
        
        public DeviceProperties(String deviceId, String deviceName, String archetype, 
                               String productName, String manufacturerName, String modelId, String rid_battery) {
            this.deviceId = deviceId;
            this.deviceName = deviceName;
            this.archetype = archetype;
            this.productName = productName;
            this.manufacturerName = manufacturerName;
            this.modelId = modelId;
            this.rid_battery = rid_battery;
        }
        
        public String getDeviceId() {
            return deviceId;
        }
        
        public String getDeviceName() {
            return deviceName;
        }
        
        public String getArchetype() {
            return archetype;
        }
        
        public String getProductName() {
            return productName;
        }
        
        public String getManufacturerName() {
            return manufacturerName;
        }
        
        public String getModelId() {
            return modelId;
        }

        public String getRid_battery() {
            return rid_battery;
        }
    }
    
    /**
     * Extrahiert die Haupteigenschaften eines Geräts aus dem übergebenen deviceObj.
     * 
     * @param deviceObj Das vollständige Device-Objekt von der Hue API
     * @return DeviceProperties-Objekt mit den extrahierten Eigenschaften oder null bei Fehlern
     */
    private DeviceProperties extractDeviceProperties(JsonObject deviceObj) {
        if (deviceObj == null) {
            logger.warn("deviceObj ist null, kann keine Eigenschaften extrahieren");
            return null;
        }
        
        try {
            // Extrahiere Device-ID
            String deviceId = null;
            if (deviceObj.has("id")) {
                deviceId = deviceObj.get("id").getAsString();
            }
            
            // Extrahiere Name aus metadata
            String deviceName = null;
            String archetype = null;
            if (deviceObj.has("metadata") && deviceObj.get("metadata").isJsonObject()) {
                JsonObject metadata = deviceObj.getAsJsonObject("metadata");
                if (metadata.has("name")) {
                    deviceName = metadata.get("name").getAsString();
                }
                if (metadata.has("archetype")) {
                    archetype = metadata.get("archetype").getAsString();
                }
            }
            
            // Extrahiere Product-Daten
            String productName = null;
            String manufacturerName = null;
            String modelId = null;
            if (deviceObj.has("product_data") && deviceObj.get("product_data").isJsonObject()) {
                JsonObject productData = deviceObj.getAsJsonObject("product_data");
                if (productData.has("product_name")) {
                    productName = productData.get("product_name").getAsString();
                }
                if (productData.has("manufacturer_name")) {
                    manufacturerName = productData.get("manufacturer_name").getAsString();
                }
                if (productData.has("model_id")) {
                    modelId = productData.get("model_id").getAsString();
                }
            }

            String rid_battery = null;
            if (deviceObj.has("services") && deviceObj.get("services").isJsonArray()) {
                JsonArray services = deviceObj.getAsJsonArray("services");
                for (JsonElement service : services) {
                    if (!service.isJsonObject()) {
                        continue;
                    }
                    JsonObject serviceObj = service.getAsJsonObject();
                    if (serviceObj.has("rtype") && serviceObj.get("rtype").getAsString().equals("device_power")) {
                        if (serviceObj.has("rid")) {
                            rid_battery = serviceObj.get("rid").getAsString();
                        }
                    }
                }
            }

            if(rid_battery == null) {
                logger.debug("Device hat keine battery service, überspringe");
            }
            
            return new DeviceProperties(deviceId, deviceName, archetype, productName, manufacturerName, modelId, rid_battery);
            
        } catch (Exception e) {
            logger.warn("Fehler beim Extrahieren der Device-Eigenschaften: {}", e.getMessage());
            return null;
        }
    }
        
    
        /**
     * Konvertiert ein Hue Device JSON-Objekt zu einer Liste von Devices basierend auf den Services.
     * 
     * @param deviceObj Das JSON-Objekt des Devices von der Hue API
     * @param bridgeId Die ID der Bridge, zu der dieses Device gehört
     * @param baseUrl Die Basis-URL der Bridge (z.B. https://192.168.1.10:443/clip/v2/resource)
     * @param username Der Username (hue-application-key) für API-Aufrufe
     * @param sslContext Der SSLContext für HTTPS-Verbindungen
     * @return Liste der konvertierten Devices oder leere Liste bei Fehlern
     */
    private List<Device> convertToDevice(JsonObject deviceObj, String bridgeId) {
        logger.info(">>> convertToDevice START: bridgeId={}", bridgeId);
        List<Device> devices = new ArrayList<>();
        
        try {
            logger.info("Konvertiere Device: {}", deviceObj);
            
            // Extrahiere Services aus dem Device-Objekt
            if (!deviceObj.has("services")) {
                logger.warn("Device hat kein 'services' Feld - überspringe");
                return devices;
            }
            
            if (!deviceObj.get("services").isJsonArray()) {
                logger.warn("Device 'services' Feld ist kein JsonArray - überspringe");
                return devices;
            }
            
            JsonArray services = deviceObj.getAsJsonArray("services");
            logger.info("Device hat {} Services", services.size());

            logger.info("Extrahiere Device-Eigenschaften...");
            DeviceProperties deviceProperties = extractDeviceProperties(deviceObj);

            if (deviceProperties == null) {
                logger.error("FEHLER: DeviceProperties konnte nicht extrahiert werden - überspringe Device");
                return devices;
            }
            
            logger.info("Device Properties extrahiert: deviceId={}, deviceName={}, archetype={}, productName={}, manufacturerName={}, modelId={}, rid_battery={}", 
                deviceProperties.getDeviceId(), deviceProperties.getDeviceName(), deviceProperties.getArchetype(),
                deviceProperties.getProductName(), deviceProperties.getManufacturerName(), deviceProperties.getModelId(), deviceProperties.getRid_battery());
            
            // Analysiere Services: Prüfe, ob nur ein Service vom Typ "button" vorhanden ist
            List<String> buttonRids = new ArrayList<>();
            int buttonServiceCount = 0;
            
            for (JsonElement serviceElement : services) {
                if (!serviceElement.isJsonObject()) {
                    continue;
                }
                
                JsonObject service = serviceElement.getAsJsonObject();
                if (service.has("rtype") && service.get("rtype").getAsString().equals("button")) {
                    buttonServiceCount++;
                    if (service.has("rid")) {
                        buttonRids.add(service.get("rid").getAsString());
                    }
                }
            }
            
            // Wenn nur ein Button-Service vorhanden ist, verarbeite alle Button-rids zusammen
            if(buttonServiceCount == 0){
                // Iteriere über alle Services
                for (JsonElement serviceElement : services) {
                    if (!serviceElement.isJsonObject()) {
                        continue;
                    }
                    
                    JsonObject service = serviceElement.getAsJsonObject();
                    
                    // Extrahiere rtype und rid
                    if (!service.has("rtype") || !service.has("rid")) {
                        continue;
                    }
                    
                    String rtype = service.get("rtype").getAsString();
                    String rid = service.get("rid").getAsString();
                    
                    logger.info("Verarbeite Service: rtype={}, rid={}", rtype, rid);
                    
                    // Überspringe nicht-relevante Service-Typen
                    if (rtype.equals("zigbee_connectivity") || 
                        rtype.equals("device_software_update") ||
                        rtype.equals("motion_area_candidate") ||
                        rtype.equals("grouped_light") ||
                        rtype.equals("device_power") ||
                        rtype.equals("bridge")) {
                        logger.debug("Überspringe nicht-relevanten Service-Typ: rtype={}, rid={}", rtype, rid);
                        continue;
                    }
                    
                    // Rufe vollständige Resource-Daten über HueDeviceController ab
                    Device device = null;
                    try {
                        logger.info("Rufe Resource ab: rtype={}, rid={}, bridgeId={}", rtype, rid, bridgeId);
                        JsonObject resourceObj = hueDeviceController.fetchSingleResource(bridgeId, rtype, rid)
                            .get(); // Synchron warten, da wir in einem synchronen Kontext sind
                        
                        if (resourceObj == null) {
                            logger.warn("Resource-Objekt ist null für rtype={}, rid={} - überspringe", rtype, rid);
                            continue;
                        }
                        
                        logger.info("Resource abgerufen: rtype={}, rid={}, resourceObj={}", rtype, rid, resourceObj.toString());
                    
                        // Konvertiere basierend auf rtype
                        logger.info("Konvertiere Resource zu Device: rtype={}, rid={}", rtype, rid);
                        switch (rtype) {
                            case "motion":
                                logger.info("Konvertiere zu Motion-Sensor: rid={}", rid);
                                device = convertToHueMotionSensor(resourceObj, deviceProperties, bridgeId, rid);
                                break;
                            case "camera_motion":
                                logger.info("Konvertiere zu Camera Motion-Sensor: rid={}", rid);
                                device = convertToHueCameraMotionSensor(resourceObj, deviceProperties, bridgeId, rid);
                                break;
                            case "light_level":
                                logger.info("Konvertiere zu Light Level-Sensor: rid={}", rid);
                                device = convertToHueLightLevelSensor(resourceObj, deviceProperties, bridgeId, rid);
                                break;
                            case "temperature":
                                logger.info(">>> KONVERTIERE ZU TEMPERATURE-SENSOR: rid={}, bridgeId={}", rid, bridgeId);
                                device = convertToHueTemperatureSensor(resourceObj, deviceProperties, bridgeId, rid);
                                logger.info("<<< TEMPERATURE-SENSOR KONVERTIERUNG ABGESCHLOSSEN: rid={}, device={}", rid, device != null ? device.getId() : "null");
                                break;
                            case "light":
                                logger.info("Konvertiere zu Light: rid={}", rid);
                                device = convertToHueLight(resourceObj, deviceProperties, bridgeId, rid);
                                break;
                            case "button":
                                logger.debug("Button-Service übersprungen: rid={}", rid);
                                break;
                            default:
                                logger.debug("Unbekannter rtype: {}, überspringe", rtype);
                                break;
                        }
                        
                        if (device != null) {
                            logger.info("Device erfolgreich konvertiert: id={}, type={}, name={}", 
                                device.getId(), device.getClass().getSimpleName(), device.getName());
                            devices.add(device);
                        } else {
                            logger.warn("Konvertierung zurückgegeben null: rtype={}, rid={}", rtype, rid);
                        }
                        
                    } catch (Exception e) {
                        logger.error("FEHLER beim Abrufen/Konvertieren der Resource rtype={}, rid={}: {}", rtype, rid, e.getMessage(), e);
                        // Weiter mit nächstem Service
                    }
                }
            } else {
        
                String deviceId = null;
                if (deviceObj.has("id")) {
                    deviceId = deviceObj.get("id").getAsString();
                }
                
                // Wenn nur ein Button-Service vorhanden ist, erstelle ein DeviceSwitch mit allen Button-rids
                if (deviceId != null && !buttonRids.isEmpty()) {
                    try {
                        Device buttonDevice = convertToHueButtonWithMultipleRids(deviceObj, deviceProperties, bridgeId, deviceId, buttonRids);
                        if (buttonDevice != null) {
                            devices.add(buttonDevice);
                        }
                    } catch (Exception e) {
                        logger.error("Fehler beim Erstellen des Button-Devices mit mehreren RIDs: {}", e.getMessage(), e);
                    }
                }
            }
            
        } catch (Exception e) {
            logger.error("Fehler beim Konvertieren des Devices: {}", e.getMessage(), e);
        }
        
        return devices;
    }

    /**
     * Konvertiert ein Hue Light JSON-Objekt.
     * 
     * Aktuell werden zunächst nur die Informationen aus den optionalen Objekten
     * {@code dimming}, {@code color_temperature} und {@code color} extrahiert,
     * sofern sie im JSON vorhanden sind. Auf Basis dieser Informationen kann
     * später entschieden werden, welcher konkrete Gerätetyp (HueLight,
     * HueLightDimmer, HueLightDimmerTemperatureColor, HueLightDimmerTemperature) erzeugt
     * werden soll.
     * 
     * @param lightObj Das JSON-Objekt des Light von der Hue API
     * @param deviceObj Das vollständige Device-Objekt von der Hue API
     * @param bridgeId Die ID der Bridge, zu der dieses Light gehört
     * @param baseUrl Die Basis-URL der Bridge (z.B. https://192.168.1.10:443/clip/v2/resource)
     * @param username Der Username (hue-application-key) für API-Aufrufe
     * @param sslContext Der SSLContext für HTTPS-Verbindungen
     * @param rid Die Resource ID des Services
     * @return Aktuell immer {@code null}; die konkrete Geräteerzeugung wird später ergänzt.
     */
    private Device convertToHueLight(JsonObject lightObj, DeviceProperties deviceObj, String bridgeId, String rid) {
        try {
            logger.info("Konvertiere Light: {}", lightObj);

            Integer brightness = null;
            Integer colorTemperatureMirek = null;
            Double colorX = null;
            Double colorY = null;
            Boolean on = false;

            // Extrahiere dimming (Helligkeit), falls vorhanden
            if (lightObj.has("on") && lightObj.get("on").isJsonObject()) {
                JsonObject onObj = lightObj.getAsJsonObject("on");
                if (onObj.has("on")) {
                    try {
                        on = onObj.get("on").getAsBoolean();
                    } catch (Exception e) {
                        logger.warn("Konnte on aus on für Light {} nicht parsen: {}", rid, e.getMessage());
                    }
                }
            }   

            // Extrahiere dimming (Helligkeit), falls vorhanden
            if (lightObj.has("dimming") && lightObj.get("dimming").isJsonObject()) {
                JsonObject onObj = lightObj.getAsJsonObject("dimming");
                if (onObj.has("brightness")) {
                    try {
                        brightness = (int) (onObj.get("brightness").getAsFloat());
                    } catch (Exception e) {
                        logger.warn("Konnte brightness aus dimming für Light {} nicht parsen: {}", rid, e.getMessage());
                    }
                }
            }   

            // Extrahiere color_temperature, falls vorhanden
            if (lightObj.has("color_temperature") && lightObj.get("color_temperature").isJsonObject()) {
                JsonObject ctObj = lightObj.getAsJsonObject("color_temperature");
                if (ctObj.has("mirek")) {
                    try {
                        colorTemperatureMirek = ctObj.get("mirek").getAsInt();
                    } catch (Exception e) {
                        logger.warn("Konnte mirek aus color_temperature für Light {} nicht parsen: {}", rid, e.getMessage());
                    }
                }
            }

            // Extrahiere color (xy), falls vorhanden
            if (lightObj.has("color") && lightObj.get("color").isJsonObject()) {
                JsonObject colorObj = lightObj.getAsJsonObject("color");
                if (colorObj.has("xy") && colorObj.get("xy").isJsonObject()) {
                    JsonObject xyObj = colorObj.getAsJsonObject("xy");
                    if (xyObj.has("x")) {
                        try {
                            double xValue = xyObj.get("x").getAsDouble();
                            colorX = Math.round(xValue * 1000.0) / 1000.0; // Auf 3 Nachkommastellen runden
                        } catch (Exception e) {
                            logger.warn("Konnte x aus color.xy für Light {} nicht parsen: {}", rid, e.getMessage());
                        }
                    }
                    if (xyObj.has("y")) {
                        try {
                            double yValue = xyObj.get("y").getAsDouble();
                            colorY = Math.round(yValue * 1000.0) / 1000.0; // Auf 3 Nachkommastellen runden
                        } catch (Exception e) {
                            logger.warn("Konnte y aus color.xy für Light {} nicht parsen: {}", rid, e.getMessage());
                        }
                    }
                }
            }

            logger.debug(
                "Extrahierte Light-Daten für rid={}: on={}, brightness={}, colorTemperature(mirek)={}, colorX={}, colorY={}",
                rid, on, brightness, colorTemperatureMirek, colorX, colorY
            );

            // Auf Basis der extrahierten Informationen einen konkreten Device-Typ wählen:
            // - Nur Ein/Aus: HueLight
            // - Dimmbar: HueLightDimmer
            // - Dimmbar + Farbtemperatur: HueLightDimmerTemperature
            // - Dimmbar + Farbe (xy): HueLightDimmerTemperatureColor
            //
            // Hinweis: Die Hue API kann sowohl Farb- als auch Temperaturinformationen liefern.
            // In diesem Fall priorisieren wir Farbtemperatur gegenüber Farbe.

            String deviceId = "hue-light-" + rid;
            Device device;

            if (brightness == null && colorTemperatureMirek == null && colorX == null && colorY == null) {
                // Einfaches An/Aus-Licht ohne zusätzliche Eigenschaften
                HueLight light = new HueLight(deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery());
                if( on ) {light.setOn(false);} else {light.setOff(false);}
                light.setHueDeviceController(hueDeviceController);
                device = light;
            } else if (brightness != null && colorTemperatureMirek == null && colorX == null && colorY == null) {
                // Nur dimmbar
                HueLightDimmer dimmer = new HueLightDimmer(deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery());
                dimmer.setBrightness(brightness, false);
                if( on ) {dimmer.setOn(false);} else {dimmer.setOff(false);}
                dimmer.setHueDeviceController(hueDeviceController);
                device = dimmer;
            } else if (brightness != null && colorTemperatureMirek != null && (colorX == null || colorY == null)) {
                // Dimmbar + Farbtemperatur
                HueLightDimmerTemperature dimmerCt = new HueLightDimmerTemperature(
                    deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery()
                );
                dimmerCt.setBrightness(brightness, false);
                dimmerCt.setTemperature(colorTemperatureMirek, false);
                if( on ) {dimmerCt.setOn(false);} else {dimmerCt.setOff(false);}
                dimmerCt.setHueDeviceController(hueDeviceController);
                device = dimmerCt;
            } else if (brightness != null && colorX != null && colorY != null) {
                // Dimmbar + Farbe (xy)
                HueLightDimmerTemperatureColor dimmerColor = new HueLightDimmerTemperatureColor(
                    deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery()
                );
                dimmerColor.setBrightness(brightness, false);
                dimmerColor.setTemperature(colorTemperatureMirek, false);
                dimmerColor.setColor(colorX, colorY, false);
                if( on ) {dimmerColor.setOn(false);} else {dimmerColor.setOff(false);}
                dimmerColor.setHueDeviceController(hueDeviceController);
                device = dimmerColor;
            } else {
                // Fallback: mindestens dimmbar, ansonsten einfaches Licht
                if (brightness != null) {
                    HueLightDimmer dimmer = new HueLightDimmer(
                        deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery()
                    );
                    dimmer.setBrightness(brightness, false);
                    if( on ) {dimmer.setOn(false);} else {dimmer.setOff(false);}
                    dimmer.setHueDeviceController(hueDeviceController);
                    device = dimmer;
                } else {
                    HueLight light = new HueLight(
                        deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery()
                    );
                    if( on ) {light.setOn(false);} else {light.setOff(false);}
                    light.setHueDeviceController(hueDeviceController);
                    device = light;
                }
            }

            logger.debug("Light konvertiert: rid={} -> deviceId={}, type={}", rid, deviceId, device.getClass().getSimpleName());
            return device;

        } catch (Exception e) {
            logger.error("Fehler beim Konvertieren des Light-Objekts: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Konvertiert ein Hue Motion-Sensor JSON-Objekt zu einem HueMotionSensor Device.
     * 
     * @param motionObj Das JSON-Objekt des Motion-Sensors von der Hue API
     * @param deviceObj Das vollständige Device-Objekt von der Hue API
     * @param bridgeId Die ID der Bridge, zu der dieser Sensor gehört
     * @param baseUrl Die Basis-URL der Bridge (z.B. https://192.168.1.10:443/clip/v2/resource)
     * @param username Der Username (hue-application-key) für API-Aufrufe
     * @param sslContext Der SSLContext für HTTPS-Verbindungen
     * @param rid Die Resource ID des Services
     * @return Der konvertierte HueMotionSensor oder null bei Fehlern
     */
    private Device convertToHueMotionSensor(JsonObject motionObj, DeviceProperties deviceObj, String bridgeId, String rid) {
        try {
            logger.info("Konvertiere Motion-Sensor: {}", motionObj);
            // Erstelle eindeutige Device-ID: hue-motion-{bridgeId}-{hueResourceId}
            String deviceId = "hue-motion-" + rid;
            
            // Erstelle HueMotionSensor
            HueMotionSensor sensor = new HueMotionSensor(deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery(), hueDeviceController);
            
            // Extrahiere Motion-Daten aus motion Objekt
            if (motionObj.has("motion") && motionObj.get("motion").isJsonObject()) {
                JsonObject motionData = motionObj.getAsJsonObject("motion");
                if (motionData.has("motion_report") && motionData.get("motion_report").isJsonObject()) {
                    JsonObject motionReport = motionData.getAsJsonObject("motion_report");
                    // Motion-Status ist unter motion.motion_report.motion
                    if (motionReport.has("motion") && motionReport.has("changed")) {
                        sensor.setMotion(motionReport.get("motion").getAsBoolean(), motionReport.get("changed").getAsString(), false);
                    }
                }
            }
            
            // Extrahiere Sensitivity (falls vorhanden)
            if (motionObj.has("sensitivity") && motionObj.get("sensitivity").isJsonObject()) {
                JsonObject sensitivityData = motionObj.getAsJsonObject("sensitivity");
                if (sensitivityData.has("sensitivity")) {
                    sensor.setSensibility(sensitivityData.get("sensitivity").getAsInt(), false);
                }
            }
            
            // Abrufe Batteriestatus über HueDeviceController (falls verfügbar)
            if (deviceObj.getRid_battery() != null && !deviceObj.getRid_battery().isEmpty()) {
                try {
                    Integer batteryLevel = hueDeviceController.getBattery(bridgeId, deviceObj.getRid_battery())
                        .get(); // Synchron warten
                    if (batteryLevel != null) {
                        sensor.setHasBattery(true);
                        sensor.setBatteryLevel(batteryLevel);
                    } else {
                        sensor.setHasBattery(false);
                    }
                } catch (Exception e) {
                    logger.debug("Fehler beim Abrufen des Batteriestatus für Sensor {}: {}", rid, e.getMessage());
                    sensor.setHasBattery(false);
                }
            } else {
                sensor.setHasBattery(false);
            }
            
            logger.debug("Motion-Sensor konvertiert: {} -> {}", rid, deviceId);
            return sensor;
            
        } catch (Exception e) {
            logger.error("Fehler beim Konvertieren des Motion-Sensors: {}", e.getMessage(), e);
            return null;
        }
    }
    
    /**
     * Konvertiert ein Hue Camera Motion-Sensor JSON-Objekt zu einem HueCameraMotionSensor Device.
     * 
     * @param motionObj Das JSON-Objekt des Camera Motion-Sensors von der Hue API
     * @param deviceObj Das vollständige Device-Objekt von der Hue API
     * @param bridgeId Die ID der Bridge, zu der dieser Sensor gehört
     * @param baseUrl Die Basis-URL der Bridge (z.B. https://192.168.1.10:443/clip/v2/resource)
     * @param username Der Username (hue-application-key) für API-Aufrufe
     * @param sslContext Der SSLContext für HTTPS-Verbindungen
     * @param rid Die Resource ID des Services
     * @return Der konvertierte HueCameraMotionSensor oder null bei Fehlern
     */
    private Device convertToHueCameraMotionSensor(JsonObject motionObj, DeviceProperties deviceObj, String bridgeId, String rid) {
        try {
            logger.info("Konvertiere Camera Motion-Sensor: {}", motionObj);
            // Erstelle eindeutige Device-ID: hue-camera-motion-{rid}
            String deviceId = "hue-camera-motion-" + rid;
            
            // Erstelle HueCameraMotionSensor
            HueCameraMotionSensor sensor = new HueCameraMotionSensor(deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery(), hueDeviceController);
            
            // Extrahiere Motion-Daten aus motion Objekt
            if (motionObj.has("motion") && motionObj.get("motion").isJsonObject()) {
                JsonObject motionData = motionObj.getAsJsonObject("motion");
                if (motionData.has("motion_report") && motionData.get("motion_report").isJsonObject()) {
                    JsonObject motionReport = motionData.getAsJsonObject("motion_report");
                    // Motion-Status ist unter motion.motion_report.motion
                    if (motionReport.has("motion") && motionReport.has("changed")) {
                        sensor.setMotion(motionReport.get("motion").getAsBoolean(), motionReport.get("changed").getAsString(), false);
                    }
                }
            }
            
            // Extrahiere Sensitivity (falls vorhanden)
            if (motionObj.has("sensitivity") && motionObj.get("sensitivity").isJsonObject()) {
                JsonObject sensitivityData = motionObj.getAsJsonObject("sensitivity");
                if (sensitivityData.has("sensitivity")) {
                    sensor.setSensibility(sensitivityData.get("sensitivity").getAsInt(), false);
                }
            }
            
            // Abrufe Batteriestatus über HueDeviceController (falls verfügbar)
            if (deviceObj.getRid_battery() != null && !deviceObj.getRid_battery().isEmpty()) {
                try {
                    Integer batteryLevel = hueDeviceController.getBattery(bridgeId, deviceObj.getRid_battery())
                        .get(); // Synchron warten
                    if (batteryLevel != null) {
                        sensor.setHasBattery(true);
                        sensor.setBatteryLevel(batteryLevel);
                    } else {
                        sensor.setHasBattery(false);
                    }
                } catch (Exception e) {
                    logger.debug("Fehler beim Abrufen des Batteriestatus für Sensor {}: {}", rid, e.getMessage());
                    sensor.setHasBattery(false);
                }
            } else {
                sensor.setHasBattery(false);
            }
            
            logger.debug("Camera Motion-Sensor konvertiert: {} -> {}", rid, deviceId);
            return sensor;
            
        } catch (Exception e) {
            logger.error("Fehler beim Konvertieren des Camera Motion-Sensors: {}", e.getMessage(), e);
            return null;
        }
    }
    
    /**
     * Konvertiert ein Hue Light Level Sensor JSON-Objekt zu einem HueLightLevelSensor Device.
     * 
     * @param lightLevelObj Das JSON-Objekt des Light Level-Sensors von der Hue API
     * @param deviceObj Das vollständige Device-Objekt von der Hue API
     * @param bridgeId Die ID der Bridge, zu der dieser Sensor gehört
     * @param baseUrl Die Basis-URL der Bridge (z.B. https://192.168.1.10:443/clip/v2/resource)
     * @param username Der Username (hue-application-key) für API-Aufrufe
     * @param sslContext Der SSLContext für HTTPS-Verbindungen
     * @param rid Die Resource ID des Services
     * @return Der konvertierte HueLightLevelSensor oder null bei Fehlern
     */
    private Device convertToHueLightLevelSensor(JsonObject lightLevelObj, DeviceProperties deviceObj, String bridgeId, String rid) {
        try {
            logger.info("Konvertiere Light Level-Sensor: {}", lightLevelObj);
            // Erstelle eindeutige Device-ID: hue-light-level-{rid}
            String deviceId = "hue-light-level-" + rid;
            
            // Erstelle HueLightLevelSensor
            HueLightLevelSensor sensor = new HueLightLevelSensor(deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery(), hueDeviceController);
            
            // Extrahiere Light Level-Daten aus light_level Objekt
            if (lightLevelObj.has("light") && lightLevelObj.get("light").isJsonObject()) {
                JsonObject lightData = lightLevelObj.getAsJsonObject("light");
                if (lightData.has("light_level_report") && lightData.get("light_level_report").isJsonObject()) {
                    JsonObject lightLevelReport = lightData.getAsJsonObject("light_level_report");
                    // Level-Wert ist unter light.light_level_report.light_level
                    if (lightLevelReport.has("light_level")) {
                        sensor.setLevel(lightLevelReport.get("light_level").getAsInt(), false);
                    }
                }
            }
            
            // Abrufe Batteriestatus über HueDeviceController (falls verfügbar)
            if (deviceObj.getRid_battery() != null && !deviceObj.getRid_battery().isEmpty()) {
                try {
                    Integer batteryLevel = hueDeviceController.getBattery(bridgeId, deviceObj.getRid_battery())
                        .get(); // Synchron warten
                    if (batteryLevel != null) {
                        sensor.setHasBattery(true);
                        sensor.setBatteryLevel(batteryLevel);
                    } else {
                        sensor.setHasBattery(false);
                    }
                } catch (Exception e) {
                    logger.debug("Fehler beim Abrufen des Batteriestatus für Sensor {}: {}", rid, e.getMessage());
                    sensor.setHasBattery(false);
                }
            } else {
                sensor.setHasBattery(false);
            }
            
            logger.debug("Light Level-Sensor konvertiert: {} -> {}", rid, deviceId);
            return sensor;
            
        } catch (Exception e) {
            logger.error("Fehler beim Konvertieren des Light Level-Sensors: {}", e.getMessage(), e);
            return null;
        }
    }
    
    /**
     * Konvertiert ein Hue Temperature Sensor JSON-Objekt zu einem HueTemperatureSensor Device.
     * 
     * @param temperatureObj Das JSON-Objekt des Temperature-Sensors von der Hue API
     * @param deviceObj Das vollständige Device-Objekt von der Hue API
     * @param bridgeId Die ID der Bridge, zu der dieser Sensor gehört
     * @param baseUrl Die Basis-URL der Bridge (z.B. https://192.168.1.10:443/clip/v2/resource)
     * @param username Der Username (hue-application-key) für API-Aufrufe
     * @param sslContext Der SSLContext für HTTPS-Verbindungen
     * @param rid Die Resource ID des Services
     * @return Der konvertierte HueTemperatureSensor oder null bei Fehlern
     */
    private Device convertToHueTemperatureSensor(JsonObject temperatureObj, DeviceProperties deviceObj, String bridgeId, String rid) {
        logger.info(">>> convertToHueTemperatureSensor START: rid={}, bridgeId={}", rid, bridgeId);
        logger.info("Temperature-Objekt: {}", temperatureObj);
        logger.info("Device-Properties: deviceId={}, deviceName={}, rid_battery={}", 
            deviceObj.getDeviceId(), deviceObj.getDeviceName(), deviceObj.getRid_battery());
        
        try {
            // Erstelle eindeutige Device-ID: hue-temperature-{rid}
            String deviceId = "hue-temperature-" + rid;
            logger.info("Erstelle Device-ID: {}", deviceId);
            
            logger.info("Erstelle HueTemperatureSensor-Objekt...");
            logger.info("Parameter: name={}, id={}, bridgeId={}, hueResourceId={}, batteryRid={}, hueDeviceController={}", 
                deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery(), 
                hueDeviceController != null ? "vorhanden" : "null");
            
            // Erstelle HueTemperatureSensor
            HueTemperatureSensor sensor = null;
            try {
                sensor = new HueTemperatureSensor(deviceObj.getDeviceName(), deviceId, bridgeId, rid, deviceObj.getRid_battery(), hueDeviceController);
                logger.info("HueTemperatureSensor-Objekt erfolgreich erstellt: id={}", deviceId);
            } catch (Exception createEx) {
                logger.error("FEHLER beim Erstellen des HueTemperatureSensor-Objekts: {}", createEx.getMessage(), createEx);
                throw createEx;
            }
            
            // Extrahiere Temperature-Daten aus temperature Objekt
            logger.info("Extrahiere Temperature-Daten aus Objekt...");
            if (!temperatureObj.has("temperature")) {
                logger.warn("Temperature-Objekt hat kein 'temperature' Feld");
            } else if (!temperatureObj.get("temperature").isJsonObject()) {
                logger.warn("Temperature-Objekt 'temperature' Feld ist kein JsonObject");
            } else {
                JsonObject temperatureData = temperatureObj.getAsJsonObject("temperature");
                logger.info("Temperature-Daten-Objekt: {}", temperatureData);
                
                if (!temperatureData.has("temperature_report")) {
                    logger.warn("Temperature-Daten haben kein 'temperature_report' Feld");
                } else if (!temperatureData.get("temperature_report").isJsonObject()) {
                    logger.warn("Temperature-Daten 'temperature_report' Feld ist kein JsonObject");
                } else {
                    JsonObject temperatureReport = temperatureData.getAsJsonObject("temperature_report");
                    logger.info("Temperature-Report-Objekt: {}", temperatureReport);
                    
                    // Temperatur-Wert ist unter temperature.temperature_report.temperature
                    if (!temperatureReport.has("temperature")) {
                        logger.warn("Temperature-Report hat kein 'temperature' Feld");
                    } else {
                        try {
                            // Hue API gibt Temperatur in mired zurück, muss zu Celsius konvertiert werden
                            // Formel: temperature_celsius = (temperature_mired - 2000) / 100
                            // Oder direkt in Celsius, je nach API-Version
                            int temperatureValue = temperatureReport.get("temperature").getAsInt();
                            logger.info("Temperature-Wert extrahiert: {} (mired)", temperatureValue);
                            
                            logger.info("Setze Temperature-Wert im Sensor: value={}", temperatureValue);
                            sensor.setTemperature(temperatureValue, false);
                            logger.info("Temperature-Wert erfolgreich gesetzt");
                        } catch (Exception tempEx) {
                            logger.error("FEHLER beim Extrahieren/Setzen des Temperature-Werts: {}", tempEx.getMessage(), tempEx);
                        }
                    }
                }
            }
            
            // Abrufe Batteriestatus über HueDeviceController (falls verfügbar)
            logger.info("Prüfe Batteriestatus: rid_battery={}", deviceObj.getRid_battery());
            if (deviceObj.getRid_battery() != null && !deviceObj.getRid_battery().isEmpty()) {
                logger.info("Rufe Batteriestatus ab: bridgeId={}, batteryRid={}", bridgeId, deviceObj.getRid_battery());
                try {
                    Integer batteryLevel = hueDeviceController.getBattery(bridgeId, deviceObj.getRid_battery())
                        .get(); // Synchron warten
                    logger.info("Batteriestatus abgerufen: level={}", batteryLevel);
                    
                    if (batteryLevel != null) {
                        sensor.setHasBattery(true);
                        sensor.setBatteryLevel(batteryLevel);
                        logger.info("Batteriestatus gesetzt: hasBattery=true, level={}", batteryLevel);
                    } else {
                        sensor.setHasBattery(false);
                        logger.info("Batteriestatus null - setze hasBattery=false");
                    }
                } catch (Exception e) {
                    logger.warn("Fehler beim Abrufen des Batteriestatus für Sensor {}: {}", rid, e.getMessage(), e);
                    sensor.setHasBattery(false);
                }
            } else {
                logger.info("Keine Battery-RID vorhanden - setze hasBattery=false");
                sensor.setHasBattery(false);
            }
            
            logger.info("<<< convertToHueTemperatureSensor ENDE: Temperature-Sensor erfolgreich konvertiert: rid={} -> deviceId={}", rid, deviceId);
            return sensor;
            
        } catch (Exception e) {
            logger.error("FEHLER beim Konvertieren des Temperature-Sensors: rid={}, error={}", rid, e.getMessage(), e);
            logger.error("Stack-Trace:", e);
            return null;
        }
    }
    
    /**
     * Konvertiert ein Hue Button JSON-Objekt zu einem DeviceSwitch Device.
     * Diese Methode wird verwendet, wenn nur ein Button-Service vorhanden ist.
     * 
     * @param deviceObj Das vollständige Device-Objekt von der Hue API
     * @param deviceProperties Die Device-Eigenschaften (inkl. Batterie-rid)
     * @param bridgeId Die ID der Bridge, zu der dieser Button gehört
     * @param deviceId Die Device-ID aus dem deviceObj (wird als Button-ID verwendet)
     * @param buttonRids Liste aller Button-rids, die zu diesem DeviceSwitch hinzugefügt werden sollen
     * @return Der konvertierte DeviceSwitch oder null bei Fehlern
     */
    private Device convertToHueButtonWithMultipleRids(JsonObject deviceObj, DeviceProperties deviceProperties, String bridgeId, String deviceId, List<String> buttonRids) {
        try {
            logger.info("Konvertiere Button-Device mit mehreren RIDs: deviceId={}, buttonRids={}", deviceId, buttonRids);
            
            // Erstelle eindeutige Device-ID: hue-button-{deviceId}
            String hueDeviceId = "hue-button-" + deviceId;
            
            // Erstelle HueButton mit allen Button-IDs (deviceId + buttonRids)
            HueSwitchDimmer button = new HueSwitchDimmer(
                deviceProperties.getDeviceName(),
                hueDeviceId,
                bridgeId,
                buttonRids,
                deviceProperties.getRid_battery(),
                hueDeviceController
            );

            logger.debug("Button-Device konvertiert: deviceId={} -> hueDeviceId={}, allButtonIds={}", deviceId, hueDeviceId, buttonRids);
            return button;
            
        } catch (Exception e) {
            logger.error("Fehler beim Konvertieren des Button-Devices: {}", e.getMessage(), e);
            return null;
        }
    }

    
    

    
}

