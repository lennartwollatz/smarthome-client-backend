package com.smarthome.backend.server.api.modules.lg;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.model.devices.DeviceTV;
import com.smarthome.backend.server.actions.ActionManager;
import com.smarthome.backend.server.api.ApiRouter;
import com.smarthome.backend.server.api.modules.ModuleManager;
import com.smarthome.backend.server.db.DatabaseManager;
import com.smarthome.backend.server.db.JsonRepository;
import com.smarthome.backend.server.db.Repository;
import com.smarthome.backend.server.events.EventStreamManager;

/**
 * Modul-Manager für LG-Fernseher.
 * <p>
 * Dieses Modul kapselt alle LG-spezifischen Funktionen (Discovery, Status, Steuerung).
 */
public class LGModuleManager extends ModuleManager {

    private static final Logger logger = LoggerFactory.getLogger(LGModuleManager.class);
    private static final Gson gson = new Gson();

    private final Repository<LGDiscoveredDevice> lgDiscoveredDeviceRepository;
    private final LGDiscover lgDiscover;
    private final ActionManager actionManager;

    public LGModuleManager(DatabaseManager databaseManager, EventStreamManager eventStreamManager, ActionManager actionManager) {
        super(databaseManager, eventStreamManager, actionManager);
        this.lgDiscoveredDeviceRepository = new JsonRepository<>(databaseManager, LGDiscoveredDevice.class);
        this.lgDiscover = new LGDiscover(databaseManager);
        this.actionManager = actionManager;
    }

    /**
     * Discovery-Endpoint für LG-TVs.
     * Führt eine SSDP-Discovery über {@link LGDiscover} durch und gibt die
     * gefundenen Geräte als {@link LGTV}-Instanzen über das HTTP-Exchange zurück.
     */
    public void discoverDevices(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
        logger.info("Suche nach LG Fernsehern über SSDP (LGDiscover)");

        try {
            // mDNS-Discovery nach _airplay._tls.local. mit LG-Filterung
            Set<LGDiscoveredDevice> discovered = lgDiscover.discover(5);
            List<LGTV> devices = new ArrayList<>();
            for (LGDiscoveredDevice device : discovered) {
                // Nicht verbunden: clientKey bleibt null
                devices.add(new LGTV(
                        device.getName(),
                        device.getId(),
                        device.getAddress(),
                        device.getMacAddress(),
                        null));
            }
            String response = gson.toJson(devices);
            ApiRouter.sendResponse(exchange, 200, response);
        } catch (Exception e) {
            logger.error("Fehler bei der LG-Geräteerkennung", e);
            ApiRouter.sendResponse(exchange, 500,
                    gson.toJson(java.util.Map.of("error", "Fehler bei der Geräteerkennung: " + e.getMessage())));
        }
    }


    public void connectDevice(com.sun.net.httpserver.HttpExchange exchange, String deviceId) throws IOException {
        logger.info("Verbinde mit LG TV: {}", deviceId);
        Optional<LGDiscoveredDevice> deviceOpt = lgDiscoveredDeviceRepository.findById(deviceId);
        if (deviceOpt.isEmpty()) {
            logger.warn("LG TV {} nicht gefunden", deviceId);
            ApiRouter.sendResponse(exchange, 404, gson.toJson(java.util.Map.of("error", "Gerät nicht gefunden")));
            return;
        }
        LGTV tv = new LGTV(deviceOpt.get().getName(), deviceOpt.get().getId(), deviceOpt.get().getAddress(), deviceOpt.get().getMacAddress(), null);
        Boolean connected = tv.register();
        if (!connected) {
            logger.warn("Verbindung zu LG TV {} nicht erfolgreich", deviceId);
            ApiRouter.sendResponse(exchange, 404, gson.toJson(java.util.Map.of("error", "Verbindung zu LG TV nicht erfolgreich")));
            return;
        }
        tv.updateValues();
        tv.updateChannels();
        tv.updateApps();
        actionManager.saveDevice(tv);

        ApiRouter.sendResponse(exchange, 200, gson.toJson(java.util.Map.of("success", true, "device", tv)));
    }

    /**
     * Beispiel: Schaltet einen LG-TV ein (Power-On).
     * Aktuell nur Platzhalter, der prüft, ob das Device existiert.
     */
    public boolean powerOn(String deviceId) {
        logger.info("Schalte LG TV ein: {}", deviceId);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof DeviceTV)) {
            logger.warn("LG TV {} nicht gefunden", deviceId);
            return false;
        }

        ((DeviceTV) deviceOpt.get()).setPower(true, true);
        actionManager.saveDevice(deviceOpt.get());

        return true;
    }

    /**
     * Schaltet den Bildschirm eines LG-TVs ein.
     */
    public boolean screenOn(String deviceId) {
        logger.info("Schalte Bildschirm ein für LG TV: {}", deviceId);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof DeviceTV)) {
            logger.warn("LG TV {} nicht gefunden", deviceId);
            return false;
        }

        ((DeviceTV) deviceOpt.get()).setScreen(true, true);
        actionManager.saveDevice(deviceOpt.get());
        return true;
    }

    /**
     * Schaltet den Bildschirm eines LG-TVs aus.
     */
    public boolean screenOff(String deviceId) {
        logger.info("Schalte Bildschirm aus für LG TV: {}", deviceId);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof DeviceTV)) {
            logger.warn("LG TV {} nicht gefunden", deviceId);
            return false;
        }

        ((DeviceTV) deviceOpt.get()).setScreen(false, true);
        actionManager.saveDevice(deviceOpt.get());
        return true;
    }

    /**
     * Beispiel: Schaltet einen LG-TV aus (Standby).
     * Aktuell nur Platzhalter, der prüft, ob das Device existiert.
     */
    public boolean powerOff(String deviceId) {
        logger.info("Schalte LG TV aus: {}", deviceId);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof DeviceTV)) {
            logger.warn("LG TV {} nicht gefunden", deviceId);
            return false;
        }

        ((DeviceTV) deviceOpt.get()).setPower(false, true);
        actionManager.saveDevice(deviceOpt.get());
        return true;
    }

    /**
     * Setzt den TV-Kanal eines LG-TVs.
     *
     * @param deviceId  ID des Geräts
     * @param channelId Kanal-ID (wie von webOS geliefert)
     * @return true, wenn das Gerät gefunden wurde und der Befehl ausgelöst wurde
     */
    public boolean setChannel(String deviceId, String channelId) {
        logger.info("Setze Kanal für LG TV {} auf {}", deviceId, channelId);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof DeviceTV)) {
            logger.warn("LG TV {} nicht gefunden oder kein LGTV", deviceId);
            return false;
        }

        ((DeviceTV) deviceOpt.get()).setChannel(channelId, true);
        actionManager.saveDevice(deviceOpt.get());
        return true;
    }

    /**
     * Startet eine App auf dem LG-TV.
     *
     * @param deviceId ID des Geräts
     * @param appId    App-ID (z.B. \"netflix\", wie von webOS geliefert)
     * @return true, wenn das Gerät gefunden wurde und der Befehl ausgelöst wurde
     */
    public boolean startApp(String deviceId, String appId) {
        logger.info("Starte App {} auf LG TV {}", appId, deviceId);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof DeviceTV)) {
            logger.warn("LG TV {} nicht gefunden oder kein LGTV", deviceId);
            return false;
        }

        ((DeviceTV) deviceOpt.get()).startApp(appId, true);
        actionManager.saveDevice(deviceOpt.get());
        return true;
    }

    /**
     * Zeigt eine Toast-Notification auf dem LG-TV an.
     *
     * @param deviceId ID des Geräts
     * @param message  Nachrichtentext
     * @return true, wenn das Gerät gefunden wurde und der Befehl ausgelöst wurde
     */
    public boolean notify(String deviceId, String message) {
        logger.info("Sende Notification an LG TV {}: {}", deviceId, message);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof DeviceTV)) {
            logger.warn("LG TV {} nicht gefunden oder kein LGTV", deviceId);
            return false;
        }

        ((DeviceTV) deviceOpt.get()).notify(message, true);
        return true;
    }

    /**
     * Setzt die Lautstärke eines LG-TVs.
     *
     * @param deviceId ID des Geräts
     * @param volume   Lautstärke (1-100)
     * @return true, wenn das Gerät gefunden wurde und der Befehl ausgelöst wurde
     */
    public boolean setVolume(String deviceId, int volume) {
        logger.info("Setze Lautstärke für LG TV {} auf {}", deviceId, volume);
        if (volume < 1 || volume > 100) {
            logger.warn("setVolume() abgebrochen: Volume außerhalb Bereich (1-100): {}", volume);
            return false;
        }
        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof DeviceTV)) {
            logger.warn("LG TV {} nicht gefunden oder kein LGTV", deviceId);
            return false;
        }
        ((DeviceTV) deviceOpt.get()).setVolume(volume, true);
        actionManager.saveDevice(deviceOpt.get());
        return true;
    }

    public boolean setHomeChannelNumber(String deviceId, String channelId, int newNumber) {
        logger.info("Setze HomeChannelNumber für LG TV {} (channelId={}, newNumber={})", deviceId, channelId, newNumber);
        if (newNumber < 1) {
            return false;
        }
        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof LGTV)) {
            logger.warn("LG TV {} nicht gefunden oder kein LGTV", deviceId);
            return false;
        }
        LGTV tv = (LGTV) deviceOpt.get();
        List<DeviceTV.Channel> channels = tv.getChannels();
        if (channels == null || channels.isEmpty()) {
            return false;
        }
        DeviceTV.Channel target = null;
        for (DeviceTV.Channel channel : channels) {
            if (channelId != null && channelId.equals(channel.getId())) {
                target = channel;
                break;
            }
        }
        if (target == null) {
            return false;
        }
        Integer oldNumber = target.getHomeChannelNumber();
        if (oldNumber != null && oldNumber == newNumber) {
            return actionManager.saveDevice(tv);
        }
        for (DeviceTV.Channel channel : channels) {
            if (channel == target) {
                continue;
            }
            Integer number = channel.getHomeChannelNumber();
            if (number == null) {
                continue;
            }
            if (oldNumber == null) {
                if (number >= newNumber) {
                    channel.setHomeChannelNumber(number + 1);
                }
            } else if (newNumber < oldNumber) {
                if (number >= newNumber && number < oldNumber) {
                    channel.setHomeChannelNumber(number + 1);
                }
            } else if (newNumber > oldNumber) {
                if (number <= newNumber && number > oldNumber) {
                    channel.setHomeChannelNumber(number - 1);
                }
            }
        }
        target.setHomeChannelNumber(newNumber);
        return actionManager.saveDevice(tv);
    }

    public boolean setHomeAppNumber(String deviceId, String appId, int newNumber) {
        logger.info("Setze HomeAppNumber für LG TV {} (appId={}, newNumber={})", deviceId, appId, newNumber);
        if (newNumber < 1) {
            return false;
        }
        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof LGTV)) {
            logger.warn("LG TV {} nicht gefunden oder kein LGTV", deviceId);
            return false;
        }
        LGTV tv = (LGTV) deviceOpt.get();
        List<DeviceTV.App> apps = tv.getApps();
        if (apps == null || apps.isEmpty()) {
            return false;
        }
        DeviceTV.App target = null;
        for (DeviceTV.App app : apps) {
            if (appId != null && appId.equals(app.getId())) {
                target = app;
                break;
            }
        }
        if (target == null) {
            return false;
        }
        Integer oldNumber = target.getHomeAppNumber();
        if (oldNumber != null && oldNumber == newNumber) {
            return actionManager.saveDevice(tv);
        }
        for (DeviceTV.App app : apps) {
            if (app == target) {
                continue;
            }
            Integer number = app.getHomeAppNumber();
            if (number == null) {
                continue;
            }
            if (oldNumber == null) {
                if (number >= newNumber) {
                    app.setHomeAppNumber(number + 1);
                }
            } else if (newNumber < oldNumber) {
                if (number >= newNumber && number < oldNumber) {
                    app.setHomeAppNumber(number + 1);
                }
            } else if (newNumber > oldNumber) {
                if (number <= newNumber && number > oldNumber) {
                    app.setHomeAppNumber(number - 1);
                }
            }
        }
        target.setHomeAppNumber(newNumber);
        return actionManager.saveDevice(tv);
    }

    /**
     * Liefert die Kanalliste eines LG-TVs.
     */
    public List<DeviceTV.Channel> getChannels(String deviceId) {
        logger.info("Lade Kanäle für LG TV: {}", deviceId);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof LGTV)) {
            logger.warn("LG TV {} nicht gefunden oder kein LGTV", deviceId);
            return null;
        }

        LGTV tv = (LGTV) deviceOpt.get();
        return LGController.getChannels(tv);
    }

    /**
     * Liefert die App-Liste eines LG-TVs.
     */
    public List<DeviceTV.App> getApps(String deviceId) {
        logger.info("Lade Apps für LG TV: {}", deviceId);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof LGTV)) {
            logger.warn("LG TV {} nicht gefunden oder kein LGTV", deviceId);
            return null;
        }

        LGTV tv = (LGTV) deviceOpt.get();
        return LGController.getApps(tv);
    }

    /**
     * Liefert die aktuell ausgewählte App eines LG-TVs.
     */
    public String getSelectedApp(String deviceId) {
        logger.info("Lade aktuelle App für LG TV: {}", deviceId);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof LGTV)) {
            logger.warn("LG TV {} nicht gefunden oder kein LGTV", deviceId);
            return null;
        }

        LGTV tv = (LGTV) deviceOpt.get();
        return LGController.getSelectedApp(tv);
    }

    /**
     * Liefert den aktuell ausgewählten Kanal eines LG-TVs.
     */
    public String getSelectedChannel(String deviceId) {
        logger.info("Lade aktuellen Kanal für LG TV: {}", deviceId);

        Optional<Device> deviceOpt = actionManager.getDevice(deviceId);
        if (deviceOpt.isEmpty() || !(deviceOpt.get() instanceof LGTV)) {
            logger.warn("LG TV {} nicht gefunden oder kein LGTV", deviceId);
            return null;
        }

        LGTV tv = (LGTV) deviceOpt.get();
        return LGController.getSelectedChannel(tv);
    }


}

 