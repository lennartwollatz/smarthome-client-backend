package com.smarthome.backend.model.devices;

import java.util.List;

/**
 * Repräsentiert einen Receiver-Lautsprecher.
 * Erweitert {@link DeviceSpeaker} um zusätzliche Eigenschaften.
 */
public abstract class DeviceSpeakerReceiver extends DeviceSpeaker {

    protected List<Zone> zones;
    protected List<Subwoofer> subwoofers;
    protected Integer volumeStart;
    protected Integer volumeMax;
    protected List<Source> sources;

    public DeviceSpeakerReceiver() {
        super();
    }

    public DeviceSpeakerReceiver(String name, String id) {
        super(name, id);
    }

    public List<Subwoofer> getSubwoofers() {
        return subwoofers;
    }

    public List<Source> getSources() {
        return sources;
    }

    public void setSubwooferLevel(String subwooferName, Integer level, boolean execute) {
        this.subwoofers.stream().filter(subwoofer -> subwoofer.getName().equals(subwooferName)).findFirst().ifPresent(subwoofer -> subwoofer.setDb(level));
        if( execute ){
            this.executeSetSubwooferLevel(subwooferName, level);
        }
    }

    protected abstract void executeSetSubwooferLevel(String subwooferName, Integer level);

    public void setSubwooferPower(String subwooferName, boolean power, boolean execute) {
        this.subwoofers.stream().filter(subwoofer -> subwoofer.getName().equals(subwooferName)).findFirst().ifPresent(subwoofer -> subwoofer.setPower(power));
        if( execute ){
            this.executeSetSubwooferPower(subwooferName, power);
        }
    }
    
    protected abstract void executeSetSubwooferPower(String subwooferName, boolean power);


    public void setVolumeStart(Integer volumeStart, boolean execute) {
        this.volumeStart = volumeStart;
        if( execute ){
            this.executeSetVolumeStart(volumeStart);
        }
    }

    protected abstract void executeSetVolumeStart(Integer volumeStart);

    public void setVolumeMax(Integer volumeMax, boolean execute) {
        this.volumeMax = volumeMax;
        if( execute ){
            this.executeSetVolumeMax(volumeMax);
        }
    }

    protected abstract void executeSetVolumeMax(Integer volumeMax);


    public void setZonePower(String zoneName, boolean power, boolean execute) {
        this.zones.stream().filter(zone -> zone.getName().equals(zoneName)).findFirst().ifPresent(zone -> zone.setPower(power));
        this.zones.stream().filter(zone -> !zone.getName().equals(zoneName)).forEach(zone -> zone.setPower(false));
        if( execute ){
            this.executeSetZonePower(zoneName, power);
        }
    }
    protected abstract void executeSetZonePower(String zoneName, boolean power);

    public void setSource(String sourceIndex, boolean selected, boolean execute) {
        this.sources.stream().filter(source -> source.getIndex().equals(sourceIndex)).findFirst().ifPresent(source -> source.setSelected(selected));
        this.sources.stream().filter(source -> !source.getIndex().equals(sourceIndex)).forEach(source -> source.setSelected(false));
        if( execute ){
            this.executeSetSource(sourceIndex, selected);
        }
    }
    
    protected abstract void executeSetSource(String sourceIndex, boolean selected);

    /**
     * Repräsentiert eine Quelle des Receivers.
     */
    public static class Source {
        private String index;
        private String displayName;
        private Boolean selected;

        public Source() {
            // Default-Konstruktor für Serialisierung/Deserialisierung
        }

        public Source(String index, String displayName, Boolean selected) {
            this.index = index;
            this.displayName = displayName;
            this.selected = selected;
        }

        public String getIndex() {
            return index;
        }

        public void setIndex(String index) {
            this.index = index;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }

        public Boolean getSelected() {
            return selected;
        }

        public void setSelected(Boolean selected) {
            this.selected = selected;
        }
    }

    /**
     * Repräsentiert einen Subwoofer.
     */
    public static class Subwoofer {
        private String id;
        private String name;
        private Boolean power;
        private Integer db;

        public Subwoofer() {
            // Default-Konstruktor für Serialisierung/Deserialisierung
        }

        public Subwoofer(String id, String name, Boolean power, Integer db) {
            this.id = id;
            this.name = name;
            this.power = power;
            this.db = db;
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

        public Boolean getPower() {
            return power;
        }

        public void setPower(Boolean power) {
            this.power = power;
        }

        public Integer getDb() {
            return db;
        }

        public void setDb(Integer db) {
            this.db = db;
        }
    }

    /**
     * Repräsentiert eine Zone des Receivers.
     */
    public static class Zone {
        private String name;
        private String displayName;
        private Boolean power;

        public Zone() {
            // Default-Konstruktor für Serialisierung/Deserialisierung
        }

        public Zone(String name, String displayName, Boolean power) {
            this.name = name;
            this.displayName = displayName;
            this.power = power;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }

        public Boolean getPower() {
            return power;
        }

        public void setPower(Boolean power) {
            this.power = power;
        }
    }
}

