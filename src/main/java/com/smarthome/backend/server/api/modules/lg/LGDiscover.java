package com.smarthome.backend.server.api.modules.lg;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import javax.jmdns.JmDNS;
import javax.jmdns.ServiceEvent;
import javax.jmdns.ServiceInfo;
import javax.jmdns.ServiceListener;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;

/**
 * Führt eine mDNS-Discovery für LG webOS-TVs durch.
 * Sucht nach _airplay._tls.local. Services und filtert nach LG-Geräten
 * basierend auf manufacturer oder integrator in den TXT-Records.
 */
public class LGDiscover {
    private final Logger logger = LoggerFactory.getLogger(LGDiscover.class);
    private static final String SERVICE_TYPE = "_airplay._tcp.local.";

    private final Repository<LGDiscoveredDevice> lgDiscoveredDeviceRepository;

    public LGDiscover(DatabaseManager databaseManager) {
        this.lgDiscoveredDeviceRepository = new JsonRepository<>(databaseManager, LGDiscoveredDevice.class);
    }

    /**
     * Prüft, ob das ServiceInfo-Objekt ein LG-Gerät ist.
     * Ein Gerät ist LG, wenn manufacturer="LG" oder integrator="LG" in den TXT-Records steht.
     */
    private boolean matchesLGDevice(ServiceInfo info) {
        if (info == null) {
            return false;
        }

        String manufacturer = info.getPropertyString("manufacturer");
        String integrator = info.getPropertyString("integrator");

        boolean isLG = false;
        if (manufacturer != null && !manufacturer.isEmpty() && manufacturer.equalsIgnoreCase("LG")) {
            isLG = true;
        }
        if (integrator != null && !integrator.isEmpty() && integrator.equalsIgnoreCase("LG")) {
            isLG = true;
        }

        if (!isLG) {
            logger.debug("mDNS Gerät ist kein LG: manufacturer='{}', integrator='{}'",
                    manufacturer, integrator);
        }
        return isLG;
    }

    /**
     * Führt eine mDNS-Discovery durch und liefert befüllte {@link LGDiscoveredDevice}.
     *
     * @param timeout Wartezeit in Sekunden, bis die Discovery beendet wird
     * @return Set der gefundenen LG-Geräte
     */
    public Set<LGDiscoveredDevice> discover(int timeout) {
        logger.info("Starte mDNS-Discovery für LG-TVs (ServiceType: {})", SERVICE_TYPE);

        // Verwende ConcurrentHashMap um thread-sicher zu tracken, welche IPs bereits gefunden wurden
        java.util.concurrent.ConcurrentHashMap<String, LGDiscoveredDevice> devicesMap = new java.util.concurrent.ConcurrentHashMap<>();
        List<JmDNS> jmdnsInstances = new ArrayList<>();

        ServiceListener mdnsListener = new ServiceListener() {
            @Override
            public void serviceAdded(ServiceEvent event) {
                logger.debug("mDNS serviceAdded: type='{}', name='{}'",
                        event.getType(), event.getName());
                // Details nachladen
                event.getDNS().requestServiceInfo(event.getType(), event.getName(), true);
            }

            @Override
            public void serviceRemoved(ServiceEvent event) {
                logger.debug("mDNS serviceRemoved: type='{}', name='{}'",
                        event.getType(), event.getName());
            }

            @Override
            public void serviceResolved(ServiceEvent event) {
                ServiceInfo info = event.getInfo();
                String name = info != null ? info.getName() : event.getName();
                
                // IPv4-Adresse ermitteln (nur IPv4 zulassen)
                String host = "n/a";
                if (info != null) {
                    java.net.InetAddress[] addresses = info.getInetAddresses();
                    if (addresses != null && addresses.length > 0) {
                        // Bevorzuge IPv4
                        for (java.net.InetAddress addr : addresses) {
                            if (addr instanceof java.net.Inet4Address) {
                                host = addr.getHostAddress();
                                break;
                            }
                        }
                    }
                }
                
                int port = info != null ? info.getPort() : -1;

                logger.info("mDNS serviceResolved: type='{}', name='{}', host='{}', port={}",
                        event.getType(), name, host, port);

                if (info == null) {
                    logger.debug("mDNS serviceResolved ignoriert: ServiceInfo ist null");
                    return;
                }

                // Prüfe ob es ein LG-Gerät ist
                if (!matchesLGDevice(info)) {
                    logger.debug("mDNS serviceResolved ignoriert: Kein LG-Gerät (type='{}', name='{}', host={})",
                            event.getType(), name, host);
                    return;
                }

                // LG-Gerät gefunden - erstelle LGDiscoveredDevice nur wenn IP-Adresse noch nicht vorhanden
                // Verwende putIfAbsent für atomare Operation (thread-sicher)
                try {
                    // Nur hinzufügen, wenn die IP-Adresse gültig ist
                    if (host.equals("n/a")) {
                        logger.debug("Ignoriere Gerät mit ungültiger IP-Adresse: {}", name);
                        return;
                    }

                    // Prüfe atomar, ob bereits ein Gerät mit dieser IP-Adresse existiert
                    LGDiscoveredDevice existingDevice = devicesMap.get(host);
                    if (existingDevice != null) {
                        logger.debug("LG-Gerät mit IP {} bereits vorhanden, überspringe: {} ({})",
                                host, name, event.getType());
                        return;
                    }

                    logger.info("LG-Gerät gefunden: {}", info);

                    // Erstelle neues Gerät
                    String manufacturer = info.getPropertyString("manufacturer");
                    String integrator = info.getPropertyString("integrator");
                    String deviceName = name != null ? name : host;
                    String deviceId = "lg-mdns-" + host + "-" + info.getPropertyString("serialNumber");
                    String serialNumber = info.getPropertyString("serialNumber");
                    String macAddress = null;
                    if (serialNumber != null) {
                        int underscoreIndex = serialNumber.lastIndexOf('_');
                        if (underscoreIndex >= 0 && underscoreIndex + 1 < serialNumber.length()) {
                            macAddress = serialNumber.substring(underscoreIndex + 1);
                        } else if (!serialNumber.isEmpty()) {
                            macAddress = serialNumber;
                        }
                    }
                    LGDiscoveredDevice device = new LGDiscoveredDevice(
                            deviceId,
                            deviceName,
                            host,
                            SERVICE_TYPE,
                            manufacturer,
                            integrator,
                            macAddress
                    );

                    // Atomar hinzufügen - wenn bereits vorhanden, wird null zurückgegeben
                    LGDiscoveredDevice previous = devicesMap.putIfAbsent(host, device);
                    if (previous == null) {
                        // Erfolgreich hinzugefügt (war noch nicht vorhanden)
                        logger.info("LG-Gerät gefunden: {} ({}:{})", deviceName, host, port);
                    } else {
                        // Wurde bereits von anderem Thread hinzugefügt
                        logger.debug("LG-Gerät mit IP {} wurde bereits von anderem Thread hinzugefügt: {}",
                                host, name);
                    }
                } catch (Exception e) {
                    logger.warn("Fehler beim Erstellen eines LGDiscoveredDevice für {}: {}",
                            host, e.getMessage());
                }
            }
        };

        try {
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
                        jm.addServiceListener(SERVICE_TYPE, mdnsListener);
                        logger.info("JmDNS mDNS Discovery gestartet auf Interface {} ({}) für '{}'",
                                ni.getName(), addr.getHostAddress(), SERVICE_TYPE);
                    } catch (Exception ex) {
                        logger.warn("Konnte JmDNS auf Interface {} ({}) nicht starten: {}",
                                ni.getName(), addr.getHostAddress(), ex.getMessage());
                    }
                }
            }

            if (jmdnsInstances.isEmpty()) {
                logger.warn("Konnte keine JmDNS-Instanz für mDNS-Discovery erzeugen (keine geeigneten Interfaces)");
            } else {
                logger.info("mDNS-Discovery mit JmDNS gestartet auf {} Interface(s) (ServiceType='{}')",
                        jmdnsInstances.size(), SERVICE_TYPE);

                // Warte auf Ergebnisse (mit Timeout)
                try {
                    Thread.sleep(timeout * 1000L);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    logger.warn("mDNS-Discovery durch Interrupt beendet");
                }
                logger.info("mDNS-Discovery beendet: {} LG-Geräte gefunden", devicesMap.size());
            }
        } catch (Exception e) {
            logger.error("Fehler bei der mDNS-Discovery: {}", e.getMessage(), e);
        } finally {
            // Cleanup: Alle JmDNS-Instanzen schließen
            for (JmDNS jm : jmdnsInstances) {
                try {
                    jm.removeServiceListener(SERVICE_TYPE, mdnsListener);
                    jm.close();
                } catch (IOException e) {
                    logger.warn("Fehler beim Schließen von JmDNS: {}", e.getMessage());
                }
            }
        }

        for(LGDiscoveredDevice device : devicesMap.values()) {
            lgDiscoveredDeviceRepository.save(device.getId(), device);
        }

        // Konvertiere die Map zu einem Set für die Rückgabe
        return new HashSet<>(devicesMap.values());
    }
}


