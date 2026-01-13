package com.smarthome.backend.server.api.modules.heos;

import com.smarthome.backend.server.api.modules.heos.HeosController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.UUID;

import javax.jmdns.JmDNS;
import javax.jmdns.ServiceEvent;
import javax.jmdns.ServiceInfo;
import javax.jmdns.ServiceListener;

/**
 * Abstrakte Basisklasse für mDNS-basierte Geräteerkennung für Denon HEOS-Geräte.
 * Nutzt JmDNS für mDNS-Discovery und HeosController für Player-Info-Abruf.
 */
public abstract class HeosDiscover {
    protected static final Logger logger = LoggerFactory.getLogger(HeosDiscover.class);
    
    protected final Map<String, HeosDiscoveredDevice> devices = new ConcurrentHashMap<>();
    
    // JmDNS-Instanzen und Listener für mDNS-Discovery
    private final List<JmDNS> jmdnsInstances = new ArrayList<>();
    private ServiceListener mdnsListener;
    private String manufacturer;

    // Logging / Metrics (pro Discovery-Lauf)
    private volatile String currentRunId;
    private volatile long currentRunStartMs;
    private final AtomicLong playerInfoSuccess = new AtomicLong(0);
    private final AtomicLong playerInfoFailure = new AtomicLong(0);

    private String runTag() {
        return currentRunId != null ? "[run=" + currentRunId + "] " : "";
    }
    
    /**
     * Konstruktor für die Basisklasse.
     */
    protected HeosDiscover(String manufacturer) {
        this.manufacturer = manufacturer;
    }
    
    /**
     * Liefert den mDNS-Service-Typ, nach dem mit JmDNS gesucht wird.
     */
    private String getMdnsServiceType() {
        return "_airplay._tcp.local.";
    }
    
    /**
     * Prüft, ob das ServiceInfo-Objekt das erwartete manufacturer-Attribut enthält.
     */
    private boolean matchesManufacturer(ServiceInfo info) {
        if (info == null || manufacturer == null) {
            return false;
    }
    
        String deviceManufacturer = info.getPropertyString("manufacturer");
        if (deviceManufacturer == null || deviceManufacturer.isEmpty()) {
            return false;
    }
    
        boolean matches = manufacturer.equalsIgnoreCase(deviceManufacturer);
        if (!matches) {
            logger.debug("{}mDNS manufacturer mismatch: expected='{}', found='{}'", 
                runTag(), manufacturer, deviceManufacturer);
        }
        return matches;
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
                    String host = info != null ? info.getHostAddress() : "n/a";
                    int port = info != null ? info.getPort() : -1;

                    StringBuilder txtBuilder = new StringBuilder();
                    if (info != null) {
                        java.util.Enumeration<String> txtNames = info.getPropertyNames();
                        while (txtNames != null && txtNames.hasMoreElements()) {
                            String key = txtNames.nextElement();
                            String val = info.getPropertyString(key);
                            txtBuilder.append(key).append("=").append(val).append("; ");
        }
    }
    
                    logger.debug(
                        "{}mDNS serviceAdded: type='{}', name='{}', host='{}', port={}, txt='{}', rawEvent='{}'",
                        runTag(),
                        type,
                        name,
                        host,
                        port,
                        txtBuilder.toString(),
                        event
                    );
                    // Details nachladen
                    event.getDNS().requestServiceInfo(event.getType(), event.getName(), true);
        }
        
                @Override
                public void serviceRemoved(ServiceEvent event) {
                    logger.info("{}mDNS serviceRemoved: type='{}', name='{}', host={}", runTag(),
                        event.getType(), event.getName(), event.getInfo() != null ? event.getInfo().getHostAddress() : "n/a");
        }
        
                @Override
                public void serviceResolved(ServiceEvent event) {
                    logger.debug("{}mDNS event catched: {}", runTag(), event.toString());
                    ServiceInfo info = event.getInfo();
                    String name = info != null ? info.getName() : event.getName();
                    String discoveredType = info != null ? info.getType() : event.getType();
                    String host = info != null ? info.getHostAddress() : "n/a";

                    logger.debug("{}mDNS serviceResolved: type='{}', name='{}', host={}", runTag(),
                        discoveredType, name, host);

                    // Prüfe manufacturer-Attribut in TXT-Properties
                    if (info == null) {
                        logger.debug("{}mDNS serviceResolved ignoriert: ServiceInfo ist null", runTag());
                        return;
                    }

                    if (!matchesManufacturer(info)) {
                        logger.debug("{}mDNS serviceResolved ignoriert: manufacturer stimmt nicht überein (type='{}', name='{}', host={})",
                            runTag(), discoveredType, name, host);
                        return;
                    }

                    // Manufacturer stimmt überein - Gerät erstellen und hinzufügen
                    try {
                        // Extrahiere alle benötigten Werte aus dem mDNS-Daten-Segment
                        String deviceManufacturer = info.getPropertyString("manufacturer");
                        String modelName = info.getPropertyString("model");
                        String modelNumber = info.getPropertyString("modelNumber");
                        String wlanMac = info.getPropertyString("wlanMac");
                        
                        // deviceId mit Fallback auf gid, pi
                        String deviceId = info.getPropertyString("deviceId");
                        if (deviceId == null || deviceId.isEmpty()) {
                            deviceId = info.getPropertyString("gid");
                }
                        if (deviceId == null || deviceId.isEmpty()) {
                            deviceId = info.getPropertyString("pi");
                        }
                        
                        // Firmware-Version (fv)
                        String firmwareVersion = info.getPropertyString("fv");
                        
                        // Serial Number
                        String serialNumber = info.getPropertyString("serialNumber");
                        
                        // Port
                        int port = info.getPort();
                        
                        // IPv4 und IPv6 Adressen extrahieren
                        String ipv4Address = null;
                        String ipv6Address = null;
                        java.net.InetAddress[] addresses = info.getInetAddresses();
                        if (addresses != null) {
                            for (java.net.InetAddress addr : addresses) {
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
                            // Prüfe, ob host eine IPv6-Adresse mit eckigen Klammern ist
                            String cleanedHost = host.trim();
                            if (cleanedHost.startsWith("[") && cleanedHost.endsWith("]")) {
                                // Ist IPv6, speichere als IPv6
                                ipv6Address = cleanedHost.substring(1, cleanedHost.length() - 1);
                            } else {
                                // Versuche als IPv4 zu verwenden
                                ipv4Address = cleanedHost;
                }
                        }
                        
                        // Name aus mDNS-Antwort
                        String mdnsName = name;
                        
                        // Verwende Hostname oder Name als UDN, falls kein UDN vorhanden
                        String udn = info.getPropertyString("udn");
                        if (udn == null || udn.isEmpty()) {
                            udn = "mdns-" + (ipv4Address != null ? ipv4Address.replace(".", "-") : host.replace(".", "-")) + "-" + name.replace(" ", "-");
                }
                
                        // Verwende Name als friendlyName, falls vorhanden
                        String friendlyName = name;
                        if (friendlyName == null || friendlyName.isEmpty()) {
                            friendlyName = ipv4Address != null ? ipv4Address : host;
                        }

                       HeosDiscoveredDevice device = new HeosDiscoveredDevice(
                           udn,
                           friendlyName,
                            modelName,
                            modelNumber,
                            deviceId,
                            wlanMac,
                            ipv4Address != null ? ipv4Address : host
                        );
                        
                        // Prüfe, ob das Gerät bereits existiert
                        if (devices.containsKey(udn)) {
                            logger.debug("{}mDNS Gerät bereits vorhanden, überspringe: udn='{}', name='{}', host={}",
                                runTag(), udn, friendlyName, host);
                            return;
                        }
                        
                        // Setze mDNS-basierte Eigenschaften
                        device.setIpv4Address(ipv4Address);
                        device.setIpv6Address(ipv6Address);
                        device.setPort(port);
                        device.setMdnsName(mdnsName);
                        device.setFirmwareVersion(firmwareVersion);
                        device.setSerialNumber(serialNumber);
                        device.setManufacturer(deviceManufacturer);
                    
                    devices.put(udn, device);
                        logger.info("{}mDNS Gerät akzeptiert und hinzugefügt: udn='{}', name='{}', manufacturer='{}', ipv4={}, ipv6={}, port={}, fv='{}', serialNumber='{}'",
                            runTag(), udn, friendlyName, deviceManufacturer, ipv4Address, ipv6Address, port, firmwareVersion, serialNumber);
                    } catch (Exception e) {
                        logger.warn("{}Fehler beim Erstellen des HeosDiscoveredDevice für {}: {}", 
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
                java.util.Enumeration<java.net.InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    java.net.InetAddress addr = addrs.nextElement();
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
     * Ruft die Player-Informationen (IP-Adressen und PID-IDs) von einem HEOS-Gerät ab
     * und setzt sie direkt im HeosDiscoveredDevice.
     * Verbindet sich über Telnet (Port 1255) zum Gerät und sendet den Befehl 'player/get_players'.
     * Verwendet den ersten Player aus der Liste.
     * 
     * @param device Das HeosDiscoveredDevice, in das die Player-Informationen gesetzt werden sollen
     * @throws Exception bei Fehlern bei der Verbindung oder Kommunikation
     */
    private void setPlayerInfo(HeosDiscoveredDevice device) throws Exception {
        // Verwende die beste verfügbare Adresse (IPv4 bevorzugt, IPv6 als Fallback, eckige Klammern entfernt)
        String deviceAddress = device.getBestConnectionAddress();
        if (deviceAddress == null || deviceAddress.isEmpty()) {
            throw new Exception("Keine gültige Adresse für Gerät gefunden");
        }
        
        logger.debug("{}Rufe Player-IDs von HEOS-Gerät {} ab (udn={}, friendlyName='{}', ipv4={}, ipv6={})",
            runTag(), deviceAddress, device.getUdn(), device.getFriendlyName(), 
            device.getIpv4Address(), device.getIpv6Address());
        
        HeosController heosController = new HeosController();
        HeosController.Connection connection = heosController.createTemporaryConnection(deviceAddress);
        
        try {
            // Verbinde zum Gerät
            long t0 = System.currentTimeMillis();
            connection.connect().get(10, TimeUnit.SECONDS);
            logger.debug("{}Verbunden mit HEOS-Gerät {} (connectMs={})", runTag(), deviceAddress, (System.currentTimeMillis() - t0));
            
            // Sende Befehl player/get_players
            long t1 = System.currentTimeMillis();
            List<Map<String, Object>> players = connection.playerGetPlayers().get(10, TimeUnit.SECONDS);
            logger.debug("{}player/get_players -> {} players (durationMs={})",
                runTag(), players != null ? players.size() : 0, (System.currentTimeMillis() - t1));
            
            if (players != null && !players.isEmpty()) {
                // Finde den passenden Player anhand von IP-Adresse oder Serial-Nummer
                Map<String, Object> matchingPlayer = null;
                String deviceSerialNumber = device.getSerialNumber();
                String deviceIpv4 = device.getIpv4Address();
                String deviceIpv6 = device.getIpv6Address();
                
                logger.debug("{}Suche passenden Player für Gerät: serialNumber='{}', ipv4={}, ipv6={}, address={}",
                    runTag(), deviceSerialNumber, deviceIpv4, deviceIpv6, deviceAddress);
                
                for (Map<String, Object> player : players) {
                    logger.trace("{}Prüfe Player: {}", runTag(), player);
                    
                    // Prüfe IP-Adresse
                    String playerIp = (String) player.getOrDefault("ip", "");
                    boolean ipMatches = false;
                    
                    if (playerIp != null && !playerIp.isEmpty()) {
                        // Entferne eckige Klammern von IPv6-Adressen
                        String cleanedPlayerIp = playerIp.trim();
                        if (cleanedPlayerIp.startsWith("[") && cleanedPlayerIp.endsWith("]")) {
                            cleanedPlayerIp = cleanedPlayerIp.substring(1, cleanedPlayerIp.length() - 1);
                        }
                        
                        // Vergleiche mit IPv4, IPv6 oder deviceAddress
                        ipMatches = cleanedPlayerIp.equals(deviceIpv4) || 
                                   cleanedPlayerIp.equals(deviceIpv6) ||
                                   cleanedPlayerIp.equals(deviceAddress) ||
                                   cleanedPlayerIp.equals(device.getBestConnectionAddress());
                    }
                    
                    // Prüfe Serial-Nummer
                    String playerSerial = (String) player.getOrDefault("serial", "");
                    boolean serialMatches = false;
                    
                    if (deviceSerialNumber != null && !deviceSerialNumber.isEmpty() && 
                        playerSerial != null && !playerSerial.isEmpty()) {
                        serialMatches = deviceSerialNumber.equals(playerSerial);
                    }
                    
                    if (ipMatches || serialMatches) {
                        matchingPlayer = player;
                        logger.debug("{}Passenden Player gefunden: ipMatches={}, serialMatches={}, player={}",
                            runTag(), ipMatches, serialMatches, player);
                        break;
                    }
                }
                
                // Falls kein passender Player gefunden, verwende den ersten als Fallback
                if (matchingPlayer == null) {
                    logger.warn("{}Kein passender Player gefunden (IP/Serial), verwende ersten Player als Fallback", runTag());
                    matchingPlayer = players.get(0);
                }
                
                logger.trace("{}Verwende Player: {}", runTag(), matchingPlayer);
                
                    // Extrahiere PID
                Object pidObj = matchingPlayer.get("pid");
                    int pid = 0;
                    if (pidObj instanceof Number) {
                        pid = ((Number) pidObj).intValue();
                    } else if (pidObj instanceof String) {
                        pid = Integer.parseInt((String) pidObj);
                } else {
                    throw new Exception("PID konnte nicht aus Player-Daten extrahiert werden");
                    }
                    
                    // Extrahiere Name
                String name = (String) matchingPlayer.getOrDefault("name", "");
                    
                    // Extrahiere IP-Adresse (falls vorhanden)
                String ipAddress = (String) matchingPlayer.getOrDefault("ip", deviceAddress);
                    
                    // Falls keine IP in der Antwort, verwende die Geräte-IP
                    if (ipAddress == null || ipAddress.isEmpty()) {
                        ipAddress = deviceAddress;
                    }
                
                // Entferne eckige Klammern von IPv6-Adressen
                if (ipAddress.startsWith("[") && ipAddress.endsWith("]")) {
                    ipAddress = ipAddress.substring(1, ipAddress.length() - 1);
                }
                    
                    // Setze die Attribute direkt im HeosDiscoveredDevice
                    device.setIpAddress(ipAddress);
                    device.setPid(pid);
                    device.setName(name);
                    
                playerInfoSuccess.incrementAndGet();
                logger.debug("{}Player-Informationen gesetzt: name='{}' pid={} ip={}", runTag(), name, pid, ipAddress);
            } else {
                throw new Exception("Keine Player für Gerät gefunden");
            }
            
        } finally {
            // Trenne Verbindung
            try {
                CompletableFuture<Void> disconnectFuture = connection.disconnect();
                if (disconnectFuture != null) {
                    disconnectFuture.get(5, TimeUnit.SECONDS);
                }
            } catch (Exception e) {
                logger.warn("Fehler beim Trennen der Verbindung zu {}", deviceAddress, e);
            }
        }
    }
    
    /**
     * Ermittelt für alle Geräte im Snapshot die Player-Informationen und gibt
     * eine Liste der angereicherten Geräte zurück.
     * Nur Geräte mit erfolgreich abgerufenen Player-Informationen werden zurückgegeben.
     */
    private List<HeosDiscoveredDevice> getPlayerInfo(List<HeosDiscoveredDevice> snapshot) {
        List<HeosDiscoveredDevice> devicesWithPlayerIds = new ArrayList<>();

        for (HeosDiscoveredDevice device : snapshot) {
            try {
                logger.debug("{}Ermittle Player-IDs für Gerät: friendlyName='{}' address={} udn={}",
                    runTag(), device.getFriendlyName(), device.getAddress(), device.getUdn());
                setPlayerInfo(device);
                // Nur hinzufügen, wenn Player-Info erfolgreich abgerufen wurde
                devicesWithPlayerIds.add(device);
                logger.info("{}Player-Informationen gesetzt: friendlyName='{}' pid={} name='{}' ip='{}'",
                    runTag(), device.getFriendlyName(), device.getPid(), device.getName(), device.getIpAddress());
            } catch (Exception e) {
                playerInfoFailure.incrementAndGet();
                logger.warn("{}Fehler beim Abrufen der Player-IDs für Gerät {} ({}): {} - Gerät wird nicht zurückgegeben", 
                        runTag(), device.getFriendlyName(), device.getAddress(), e.getMessage());
                // Gerät NICHT hinzufügen, da Player-Info nicht erfolgreich abgerufen werden konnte
            }
        }

        logger.info("{}Discovery abgeschlossen. {} Geräte mit Player-Info (playerInfoSuccess={}, playerInfoFailure={}, totalDevices={})",
            runTag(), devicesWithPlayerIds.size(), playerInfoSuccess.get(), playerInfoFailure.get(), devices.size());

        return devicesWithPlayerIds;
    }

    /**
     * Startet einen Discovery-Suchlauf über mDNS, ermittelt die PID-IDs der gefundenen Geräte
     * und gibt die vollständigen Geräteinformationen zurück.
     * 
     * @param searchDurationMs Die Dauer der Suche in Millisekunden
     * @return Liste von HeosDiscoveredDevice mit vollständigen Informationen inklusive Player-IDs
     */
    public List<HeosDiscoveredDevice> discoverDevicesWithPlayerIds(long searchDurationMs) {
        currentRunId = UUID.randomUUID().toString().substring(0, 8);
        currentRunStartMs = System.currentTimeMillis();
        playerInfoSuccess.set(0);
        playerInfoFailure.set(0);

        logger.info("{}Starte mDNS Discovery-Suchlauf für {} ms", runTag(), searchDurationMs);
        
        // Leere die bisher gefundenen Geräte
        devices.clear();
        
        // Starte mDNS-Discovery mit JmDNS
        startMdnsDiscovery();
        
        try {
            // Warte auf die Suche, damit mDNS-Discovery laufen kann
            Thread.sleep(searchDurationMs);
            
            // Snapshot, damit mDNS-Thread während PID-Lookup nicht iterierende Strukturen verändert
            List<HeosDiscoveredDevice> snapshot = new ArrayList<>(devices.values());
            logger.info("{}Discovery-Suchlauf abgeschlossen. {} Geräte gefunden", runTag(), snapshot.size());
            logger.debug("{}Devices snapshot: {}", runTag(), snapshot);
            
            // Für jedes gefundene Gerät die Player-IDs abrufen
            List<HeosDiscoveredDevice> devicesWithPlayerIds = getPlayerInfo(snapshot);
            return devicesWithPlayerIds;
            
        } catch (InterruptedException e) {
            logger.error("Discovery-Suchlauf wurde unterbrochen", e);
            Thread.currentThread().interrupt();
            return new ArrayList<>();
        } finally {
            // Stoppe den Discovery-Prozess
            stopMdnsDiscovery();
            currentRunId = null;
            currentRunStartMs = 0;
        }
    }
    
}
