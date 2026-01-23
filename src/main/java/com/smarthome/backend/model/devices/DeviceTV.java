package com.smarthome.backend.model.devices;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.helper.DeviceListenerPair;
import com.smarthome.backend.model.devices.helper.DeviceType;

/**
 * Repräsentiert einen Fernseher (TV) im Smart Home System.
 * Erbt von {@link Device} und ergänzt TV-spezifische Eigenschaften wie
 * Power-Status, Kanäle und Apps.
 */
public abstract class DeviceTV extends Device {

    /**
     * Enum für die Trigger-Funktionsnamen des Temperature-Sensors.
     */
    public static enum TriggerFunctionName {
        POWER_ON("powerOn"),
        POWER_OFF("powerOff"),
        SCREEN_ON("screenOn"),
        SCREEN_OFF("screenOff"),
        CHANNEL_CHANGED("channelChanged"),
        APP_CHANGED("appChanged"),
        CHANNEL_SELECTED("channelSelected(string)"),
        APP_SELECTED("appSelected(string)"),
        VOLUME_CHANGED("volumeChanged"),
        VOLUME_GREATER("volumeGreater(int)"),
        VOLUME_LESS("volumeLess(int)");
        
        private final String value;
        
        TriggerFunctionName(String value) {
            this.value = value;
        }

        private static boolean hasValue(String triggerName) {
            return Arrays.stream(TriggerFunctionName.values()).anyMatch(trigger -> trigger.getValue().equals(triggerName));
        }
        
        public String getValue() {
            return value;
        }
    }
    
    /**
     * Enum für die Action-Funktionsnamen des Temperature-Sensors.
     * Temperature Sensoren haben typischerweise keine Action-Funktionen,
     * da sie nur messen, nicht steuern.
     */
    public static enum ActionFunctionName {
        POWER_ON("powerOn"),
        POWER_OFF("powerOff"),
        SCREEN_ON("screenOn"),
        SCREEN_OFF("screenOff"),
        SELECT_APP("selectApp(string)"),
        SELECT_CHANNEL("selectChannel(string)"),
        SET_VOLUME("setVolume(int)");
        
        private final String value;
        
        ActionFunctionName(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }
    
    /**
     * Enum für die Bool-Funktionsnamen des Temperature-Sensors.
     */
    public static enum BoolFunctionName {
        POWER_ON("powerOn"),
        POWER_OFF("powerOff"),
        SCREEN_ON("screenOn"),
        SCREEN_OFF("screenOff"),
        VOLUME_GREATER("volumeGreater(int)"),
        VOLUME_LESS("volumeLess(int)"),
        APP_SELECTED("appSelected(string)"),
        CHANNEL_SELECTED("channelSelected(string)");
        
        private final String value;
        
        BoolFunctionName(String value) {
            this.value = value;
        }
        
        public String getValue() {
            return value;
        }
    }

    /**
     * Aktueller Power-Status des Fernsehers.
     */
    @SerializedName("power")
    protected Boolean power;

    /**
     * Aktueller Bildschirm-Status des Fernsehers.
     */
    @SerializedName("screen")
    protected Boolean screen;

    /**
     * Aktuelle Lautstärke des Fernsehers.
     */
    @SerializedName("volume")
    protected int volume;

    /**
     * Liste der verfügbaren Kanäle.
     */
    @SerializedName("channels")
    protected List<Channel> channels;

    /**
     * ID des aktuell ausgewählten Kanals.
     */
    @SerializedName("selectedChannel")
    protected String selectedChannel;

    /**
     * Liste der verfügbaren Apps (z. B. Netflix, YouTube).
     */
    @SerializedName("apps")
    protected List<App> apps;

    /**
     * ID der aktuell ausgewählten App.
     */
    @SerializedName("selectedApp")
    protected String selectedApp;

    /**
     * Standard-Konstruktor.
     * Setzt den Typ automatisch auf "tv".
     */
    public DeviceTV() {
        super();
        setType(DeviceType.TV);
        setIcon("&#128250;"); // TV-Icon
        setTypeLabel("deviceType.tv");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Konstruktor mit Name und ID.
     *
     * @param name Der Name des Fernsehers
     * @param id   Die eindeutige ID des Fernsehers
     */
    public DeviceTV(String name, String id) {
        super();
        setName(name);
        setId(id);
        setType(DeviceType.TV);
        setIcon("&#128250;");
        setTypeLabel("deviceType.tv");
        initializeFunctionsBool();
        initializeFunctionsAction();
        initializeFunctionsTrigger();
    }

    /**
     * Initialisiert die Liste der booleschen Funktionen für den Fernseher.
     */
    @Override
    protected void initializeFunctionsBool() {
        List<String> functions = new ArrayList<>();
        functions.add(BoolFunctionName.POWER_ON.getValue());
        functions.add(BoolFunctionName.POWER_OFF.getValue());
        functions.add(BoolFunctionName.SCREEN_ON.getValue());
        functions.add(BoolFunctionName.SCREEN_OFF.getValue());
        functions.add(BoolFunctionName.VOLUME_GREATER.getValue());
        functions.add(BoolFunctionName.VOLUME_LESS.getValue());
        functions.add(BoolFunctionName.APP_SELECTED.getValue());
        functions.add(BoolFunctionName.CHANNEL_SELECTED.getValue());
        setFunctionsBool(functions);
    }
    
    /**
     * Initialisiert die Liste der Action-Funktionen für den Fernseher.
     */
    @Override
    protected void initializeFunctionsAction() {
        List<String> functions = new ArrayList<>();
        functions.add(ActionFunctionName.POWER_ON.getValue());
        functions.add(ActionFunctionName.POWER_OFF.getValue());
        functions.add(ActionFunctionName.SCREEN_ON.getValue());
        functions.add(ActionFunctionName.SCREEN_OFF.getValue());
        functions.add(ActionFunctionName.SELECT_APP.getValue());
        functions.add(ActionFunctionName.SELECT_CHANNEL.getValue());
        functions.add(ActionFunctionName.SET_VOLUME.getValue());
        setFunctionsAction(functions);
    }
    
    /**
     * Initialisiert die Liste der Trigger-Funktionen für den Fernseher.
     */
    @Override
    protected void initializeFunctionsTrigger() {
        List<String> functions = new ArrayList<>();
        functions.add(TriggerFunctionName.POWER_ON.getValue());
        functions.add(TriggerFunctionName.POWER_OFF.getValue());
        functions.add(TriggerFunctionName.SCREEN_ON.getValue());
        functions.add(TriggerFunctionName.SCREEN_OFF.getValue());
        functions.add(TriggerFunctionName.CHANNEL_CHANGED.getValue());
        functions.add(TriggerFunctionName.APP_CHANGED.getValue());
        functions.add(TriggerFunctionName.CHANNEL_SELECTED.getValue());
        functions.add(TriggerFunctionName.APP_SELECTED.getValue());
        functions.add(TriggerFunctionName.VOLUME_CHANGED.getValue());
        functions.add(TriggerFunctionName.VOLUME_GREATER.getValue());
        functions.add(TriggerFunctionName.VOLUME_LESS.getValue());
        setFunctionsTrigger(functions);
    }

    
    @Override
    protected void checkListener(String triggerName) {
        super.checkListener(triggerName);
        if( triggerName == null || triggerName.isEmpty() || ! TriggerFunctionName.hasValue(triggerName) ) {
            return;
        }
        List<DeviceListenerPair> listeners = triggerListeners.get(triggerName);
        if (listeners == null || listeners.isEmpty()) {
            return;
        }
        
        if(TriggerFunctionName.POWER_ON.getValue().equals(triggerName)) {
            if (powerOn()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if(TriggerFunctionName.POWER_OFF.getValue().equals(triggerName)) {
            if (powerOff()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if(TriggerFunctionName.SCREEN_ON.getValue().equals(triggerName)) {
            if (screenOn()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if(TriggerFunctionName.SCREEN_OFF.getValue().equals(triggerName)) {
            if (screenOff()) {
                listeners.forEach(DeviceListenerPair::run);
            }
        }
        if(TriggerFunctionName.CHANNEL_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.APP_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.CHANNEL_SELECTED.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String channelId = pair.getParams().getParam1AsString();
                return channelId != null && channelSelected(channelId);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.APP_SELECTED.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                String appId = pair.getParams().getParam1AsString();
                return appId != null && appSelected(appId);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.VOLUME_CHANGED.getValue().equals(triggerName)) {
            listeners.forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.VOLUME_GREATER.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && volumeGreater(threshold);
            }).forEach(DeviceListenerPair::run);
        }
        if(TriggerFunctionName.VOLUME_LESS.getValue().equals(triggerName)) {
            listeners.stream().filter(pair -> {
                Integer threshold = pair.getParams().getParam1AsInt();
                return threshold != null && volumeLess(threshold);
            }).forEach(DeviceListenerPair::run);
        }
    }


    public void setPower(boolean power, boolean execute) {
        this.power = power;
        if (execute) {
            this.executeSetPower(power);
        }
    }

    protected abstract void executeSetPower(Boolean power);

    public void setScreen(boolean screen, boolean execute) {
        this.screen = screen;
        if (execute) {
            this.executeSetScreen(screen);
        }
    }

    protected abstract void executeSetScreen(Boolean screen);

    public void setChannel(String channel, boolean execute) {
        this.selectedChannel = channel;
        this.power = true;
        if (execute) {
            this.executeSetChannel(channel);
        }
    }

    protected abstract void executeSetChannel(String channel);


    public void startApp(String appId, boolean execute) {
        this.selectedApp = appId;
        this.power = true;
        if (execute) {
            this.executeStartApp(appId);
        }
    }

    protected abstract void executeStartApp(String appId);

    public void notify(String message, boolean execute) {
        if (execute) {
            this.executeNotify(message);
        }
    }

    protected abstract void executeNotify(String message);

    public void setVolume(int volume, boolean execute) {
        this.volume = volume;
        if (execute) {
            this.executeSetVolume(volume);
        }
    }

    protected abstract void executeSetVolume(int volume);

    public List<Channel> getChannels() {
        return channels;
    }

    public List<App> getApps() {
        return apps;
    }

    /**
     * Prüft, ob der Fernseher eingeschaltet ist.
     *
     * @return true wenn der Fernseher eingeschaltet ist, sonst false
     */
    public boolean powerOn() {
        return Boolean.TRUE.equals(this.power);
    }

    /**
     * Prüft, ob der Fernseher ausgeschaltet ist.
     *
     * @return true wenn der Fernseher ausgeschaltet ist, sonst false
     */
    public boolean powerOff() {
        return Boolean.FALSE.equals(this.power);
    }

    /**
     * Prüft, ob der Bildschirm eingeschaltet ist.
     *
     * @return true wenn der Bildschirm eingeschaltet ist, sonst false
     */
    public boolean screenOn() {
        return Boolean.TRUE.equals(this.screen);
    }

    /**
     * Prüft, ob der Bildschirm ausgeschaltet ist.
     *
     * @return true wenn der Bildschirm ausgeschaltet ist, sonst false
     */
    public boolean screenOff() {
        return Boolean.FALSE.equals(this.screen);
    }

    /**
     * Prüft, ob die Lautstärke größer als der angegebene Wert ist.
     *
     * @param threshold Der Vergleichswert
     * @return true wenn die Lautstärke größer ist, sonst false
     */
    public boolean volumeGreater(int threshold) {
        return this.volume > threshold;
    }

    /**
     * Prüft, ob die Lautstärke kleiner als der angegebene Wert ist.
     *
     * @param threshold Der Vergleichswert
     * @return true wenn die Lautstärke kleiner ist, sonst false
     */
    public boolean volumeLess(int threshold) {
        return this.volume < threshold;
    }

    /**
     * Prüft, ob die angegebene App aktuell ausgewählt ist.
     *
     * @param appId Die App-ID zum Vergleich
     * @return true wenn die App ausgewählt ist, sonst false
     */
    public boolean appSelected(String appId) {
        return appId != null && appId.equals(this.selectedApp);
    }

    /**
     * Prüft, ob der angegebene Kanal aktuell ausgewählt ist.
     *
     * @param channelId Die Kanal-ID zum Vergleich
     * @return true wenn der Kanal ausgewählt ist, sonst false
     */
    public boolean channelSelected(String channelId) {
        return channelId != null && channelId.equals(this.selectedChannel);
    }
    /**
     * Repräsentiert einen Kanal des Fernsehers (z. B. Senderliste).
     */
    public static class Channel {
        private String id;
        private String name;
        private Integer channelNumber;
        private Integer homeChannelNumber;
        private String channelType;
        private Boolean hd;
        private String imgUrl;

        public Channel() {
            // Default-Konstruktor für Serialisierung/Deserialisierung
        }

        public Channel(String id, String name, Integer channelNumber, Integer homeChannelNumber, String channelType, Boolean hd, String imgUrl) {
            this.id = id;
            this.name = name;
            this.channelNumber = channelNumber;
            this.homeChannelNumber = homeChannelNumber;
            this.channelType = channelType;
            this.hd = hd;
            this.imgUrl = imgUrl;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public Integer getChannelNumber() {
            return channelNumber;
        }

        public void setChannelNumber(Integer channelNumber) {
            this.channelNumber = channelNumber;
        }

        public String getChannelType() {
            return channelType;
        }

        public void setChannelType(String channelType) {
            this.channelType = channelType;
        }

        public Boolean getHd() {
            return hd;
        }

        public void setHd(Boolean hd) {
            this.hd = hd;
        }

        public String getImgUrl() {
            return imgUrl;
        }

        public void setImgUrl(String imgUrl) {
            this.imgUrl = imgUrl;
        }

        public Integer getHomeChannelNumber() {
            return homeChannelNumber;
        }

        public void setHomeChannelNumber(Integer homeChannelNumber) {
            this.homeChannelNumber = homeChannelNumber;
        }

    }

    /**
     * Repräsentiert eine App auf dem Fernseher (z. B. Netflix, YouTube).
     */
    public static class App {
        private String id;
        private String name;
        private String imgUrl;
        private Integer homeAppNumber;


        public App() {
            // Default-Konstruktor für Serialisierung/Deserialisierung
        }

        public App(String id, String name, String imgUrl, Integer homeAppNumber) {
            this.id = id;
            this.name = name;
            this.imgUrl = imgUrl;
            this.homeAppNumber = homeAppNumber;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getImgUrl() {
            return imgUrl;
        }

        public void setImgUrl(String imgUrl) {
            this.imgUrl = imgUrl;
        }

        public Integer getHomeAppNumber() {
            return homeAppNumber;
        }

        public void setHomeAppNumber(Integer homeAppNumber) {
            this.homeAppNumber = homeAppNumber;
        }
    }
}


