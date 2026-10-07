-- =============================================================================
-- Geräte normalisieren: die JSON-Spalte devices.attributes wird durch
-- Fähigkeits-, Listen- und Modul-Detailtabellen ersetzt (alle 1:n bzw. 1:1 zu devices).
-- =============================================================================

ALTER TABLE devices
    ADD COLUMN icon       VARCHAR(64)  NULL AFTER name,
    ADD COLUMN type_label VARCHAR(128) NULL AFTER icon,
    DROP COLUMN attributes;


-- -----------------------------------------------------------------------------
-- Licht, Lüfter, Tasten, Energie
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_lights (
    device_id          VARCHAR(255)  NOT NULL,
    is_on              BOOLEAN       NULL,
    brightness         DOUBLE        NULL,
    color_temperature  DOUBLE        NULL,
    color_x            DOUBLE        NULL,
    color_y            DOUBLE        NULL,

    CONSTRAINT pk_device_lights PRIMARY KEY (device_id),
    CONSTRAINT fk_device_lights_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Zustand von Leuchten und Lüftern (is_on schaltet bei Lüftern den Lüfter).';


CREATE TABLE IF NOT EXISTS device_fans (
    device_id         VARCHAR(255)  NOT NULL,
    speed             DOUBLE        NULL,
    is_light_on       BOOLEAN       NULL,
    light_brightness  DOUBLE        NULL,

    CONSTRAINT pk_device_fans PRIMARY KEY (device_id),
    CONSTRAINT fk_device_fans_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_buttons (
    device_id              VARCHAR(255)  NOT NULL,
    button_id              VARCHAR(255)  NOT NULL,
    sort_index             INT           NOT NULL,
    name                   VARCHAR(255)  NULL,
    is_connected_to_light  BOOLEAN       NULL,
    is_on                  BOOLEAN       NOT NULL DEFAULT FALSE,
    press_count            INT           NOT NULL DEFAULT 0,
    initial_press_time     BIGINT        NOT NULL DEFAULT 0,
    first_press_time       BIGINT        NOT NULL DEFAULT 0,
    last_press_time        BIGINT        NOT NULL DEFAULT 0,
    intensity              DOUBLE        NULL,

    CONSTRAINT pk_device_buttons PRIMARY KEY (device_id, button_id),
    CONSTRAINT fk_device_buttons_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Tasten von Schaltern; button_id ist z. B. die Hue-Ressource oder die Matter-Endpoint-ID.';


CREATE TABLE IF NOT EXISTS device_energy_totals (
    device_id                VARCHAR(255)  NOT NULL,
    current_usage            DOUBLE        NOT NULL DEFAULT 0,
    today_total              DOUBLE        NOT NULL DEFAULT 0,
    yesterday_until_now      DOUBLE        NOT NULL DEFAULT 0,
    yesterday_total          DOUBLE        NOT NULL DEFAULT 0,
    week_total               DOUBLE        NOT NULL DEFAULT 0,
    last_week_until_now      DOUBLE        NOT NULL DEFAULT 0,
    last_week_total          DOUBLE        NOT NULL DEFAULT 0,
    month_total              DOUBLE        NOT NULL DEFAULT 0,
    last_month_until_now     DOUBLE        NOT NULL DEFAULT 0,
    last_month_total         DOUBLE        NOT NULL DEFAULT 0,
    year_total               DOUBLE        NOT NULL DEFAULT 0,
    last_year_until_now      DOUBLE        NOT NULL DEFAULT 0,
    last_year_total          DOUBLE        NOT NULL DEFAULT 0,

    CONSTRAINT pk_device_energy_totals PRIMARY KEY (device_id),
    CONSTRAINT fk_device_energy_totals_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Verbrauchssummen von Energie-Schaltern (Feld energyUsage).';


CREATE TABLE IF NOT EXISTS device_energy_readings (
    device_id    VARCHAR(255)  NOT NULL,
    sort_index   INT           NOT NULL,
    recorded_at  BIGINT        NOT NULL,
    usage_value  DOUBLE        NOT NULL,

    CONSTRAINT pk_device_energy_readings PRIMARY KEY (device_id, sort_index),
    CONSTRAINT fk_device_energy_readings_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Verbrauchsverlauf (Feld energyUsages); recorded_at in Millisekunden seit 1970.';


-- -----------------------------------------------------------------------------
-- Sensoren und Thermostate
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_motion_sensors (
    device_id             VARCHAR(255)  NOT NULL,
    sensitivity           DOUBLE        NULL,
    is_motion             BOOLEAN       NULL,
    motion_last_detected  VARCHAR(64)   NULL,

    CONSTRAINT pk_device_motion_sensors PRIMARY KEY (device_id),
    CONSTRAINT fk_device_motion_sensors_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_light_level_sensors (
    device_id    VARCHAR(255)  NOT NULL,
    light_level  DOUBLE        NULL,

    CONSTRAINT pk_device_light_level_sensors PRIMARY KEY (device_id),
    CONSTRAINT fk_device_light_level_sensors_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_temperature_sensors (
    device_id    VARCHAR(255)  NOT NULL,
    temperature  DOUBLE        NULL,

    CONSTRAINT pk_device_temperature_sensors PRIMARY KEY (device_id),
    CONSTRAINT fk_device_temperature_sensors_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_temperature_readings (
    device_id         VARCHAR(255)  NOT NULL,
    sort_index        INT           NOT NULL,
    recorded_at       BIGINT        NOT NULL,
    temperature       DOUBLE        NOT NULL,
    temperature_goal  DOUBLE        NOT NULL,

    CONSTRAINT pk_device_temperature_readings PRIMARY KEY (device_id, sort_index),
    CONSTRAINT fk_device_temperature_readings_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Temperaturverlauf; recorded_at in Millisekunden seit 1970.';


CREATE TABLE IF NOT EXISTS device_thermostats (
    device_id         VARCHAR(255)  NOT NULL,
    temperature_goal  DOUBLE        NOT NULL,

    CONSTRAINT pk_device_thermostats PRIMARY KEY (device_id),
    CONSTRAINT fk_device_thermostats_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_thermostat_schedules (
    device_id       VARCHAR(255)  NOT NULL,
    schedule_index  INT           NOT NULL,
    rule_name       VARCHAR(255)  NOT NULL,
    is_active       BOOLEAN       NOT NULL,

    CONSTRAINT pk_device_thermostat_schedules PRIMARY KEY (device_id, schedule_index),
    CONSTRAINT fk_device_thermostat_schedules_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_thermostat_schedule_times (
    device_id       VARCHAR(255)      NOT NULL,
    schedule_index  INT               NOT NULL,
    time_index      INT               NOT NULL,
    weekday         TINYINT UNSIGNED  NOT NULL,
    time_of_day     VARCHAR(8)        NOT NULL,
    temperature     DOUBLE            NOT NULL,

    CONSTRAINT pk_device_thermostat_schedule_times PRIMARY KEY (device_id, schedule_index, time_index),
    CONSTRAINT fk_device_thermostat_schedule_times_schedule
        FOREIGN KEY (device_id, schedule_index) REFERENCES device_thermostat_schedules (device_id, schedule_index)
        ON DELETE CASCADE
)
COMMENT = 'Zeitfenster eines Thermostat-Zeitplans (weekday 0 = Sonntag).';


-- -----------------------------------------------------------------------------
-- Lautsprecher und Receiver
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_speakers (
    device_id     VARCHAR(255)                    NOT NULL,
    play_state    ENUM('play', 'pause', 'stop')   NULL,
    volume        DOUBLE                          NULL,
    is_muted      BOOLEAN                         NULL,
    volume_start  DOUBLE                          NULL,
    volume_max    DOUBLE                          NULL,

    CONSTRAINT pk_device_speakers PRIMARY KEY (device_id),
    CONSTRAINT fk_device_speakers_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'volume_start und volume_max gibt es nur bei Receivern.';


CREATE TABLE IF NOT EXISTS device_speaker_zones (
    device_id     VARCHAR(255)  NOT NULL,
    sort_index    INT           NOT NULL,
    name          VARCHAR(255)  NULL,
    display_name  VARCHAR(255)  NULL,
    is_powered    BOOLEAN       NULL,

    CONSTRAINT pk_device_speaker_zones PRIMARY KEY (device_id, sort_index),
    CONSTRAINT fk_device_speaker_zones_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_speaker_subwoofers (
    device_id      VARCHAR(255)  NOT NULL,
    sort_index     INT           NOT NULL,
    subwoofer_id   VARCHAR(255)  NULL,
    name           VARCHAR(255)  NULL,
    is_powered     BOOLEAN       NULL,
    level_db       DOUBLE        NULL,

    CONSTRAINT pk_device_speaker_subwoofers PRIMARY KEY (device_id, sort_index),
    CONSTRAINT fk_device_speaker_subwoofers_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_speaker_sources (
    device_id     VARCHAR(255)  NOT NULL,
    sort_index    INT           NOT NULL,
    source_key    VARCHAR(255)  NULL,
    display_name  VARCHAR(255)  NULL,
    is_selected   BOOLEAN       NULL,

    CONSTRAINT pk_device_speaker_sources PRIMARY KEY (device_id, sort_index),
    CONSTRAINT fk_device_speaker_sources_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Eingangsquellen eines Receivers; source_key ist das Feld index des Receivers.';


-- -----------------------------------------------------------------------------
-- Fernseher
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_tvs (
    device_id         VARCHAR(255)  NOT NULL,
    is_powered        BOOLEAN       NULL,
    is_screen_on      BOOLEAN       NULL,
    volume            DOUBLE        NOT NULL DEFAULT 0,
    selected_channel  VARCHAR(255)  NULL,
    selected_app      VARCHAR(255)  NULL,

    CONSTRAINT pk_device_tvs PRIMARY KEY (device_id),
    CONSTRAINT fk_device_tvs_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_tv_channels (
    device_id            VARCHAR(255)   NOT NULL,
    sort_index           INT            NOT NULL,
    channel_id           VARCHAR(255)   NULL,
    name                 VARCHAR(255)   NULL,
    channel_number       INT            NULL,
    home_channel_number  INT            NULL,
    channel_type         VARCHAR(64)    NULL,
    is_hd                BOOLEAN        NULL,
    img_url              VARCHAR(2048)  NULL,

    CONSTRAINT pk_device_tv_channels PRIMARY KEY (device_id, sort_index),
    CONSTRAINT fk_device_tv_channels_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_tv_apps (
    device_id        VARCHAR(255)   NOT NULL,
    sort_index       INT            NOT NULL,
    app_id           VARCHAR(255)   NULL,
    name             VARCHAR(255)   NULL,
    img_url          VARCHAR(2048)  NULL,
    home_app_number  INT            NULL,

    CONSTRAINT pk_device_tv_apps PRIMARY KEY (device_id, sort_index),
    CONSTRAINT fk_device_tv_apps_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


-- -----------------------------------------------------------------------------
-- Saugroboter
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_vacuums (
    device_id                VARCHAR(255)   NOT NULL,
    is_powered               BOOLEAN        NULL,
    is_cleaning              BOOLEAN        NULL,
    is_docked                BOOLEAN        NULL,
    battery                  DOUBLE         NULL,
    fan_speed                DOUBLE         NULL,
    water_box_level          DOUBLE         NULL,
    dirty_water_box_level    DOUBLE         NULL,
    is_water_box_full        BOOLEAN        NULL,
    is_dirty_water_box_full  BOOLEAN        NULL,
    current_room             VARCHAR(255)   NULL,
    current_zone             VARCHAR(255)   NULL,
    mode                     VARCHAR(64)    NULL,
    error_message            VARCHAR(1024)  NULL,

    CONSTRAINT pk_device_vacuums PRIMARY KEY (device_id),
    CONSTRAINT fk_device_vacuums_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_vacuum_room_assignments (
    device_id       VARCHAR(255)  NOT NULL,
    vacuum_room_id  VARCHAR(64)   NOT NULL,
    room_id         VARCHAR(128)  NOT NULL,

    CONSTRAINT pk_device_vacuum_room_assignments PRIMARY KEY (device_id, vacuum_room_id),
    INDEX idx_device_vacuum_room_assignments_room_id (room_id),
    CONSTRAINT fk_device_vacuum_room_assignments_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_device_vacuum_room_assignments_room
        FOREIGN KEY (room_id) REFERENCES rooms (id)
        ON DELETE CASCADE
)
COMMENT = 'Zuordnung Saugroboter-Raum-ID zu Raum im Grundriss (Feld roomMapping).';


-- -----------------------------------------------------------------------------
-- Fahrzeuge
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_cars (
    device_id                VARCHAR(255)  NOT NULL,
    vin                      VARCHAR(32)   NULL,
    fuel_level_percent       DOUBLE        NULL,
    range_km                 DOUBLE        NULL,
    mileage_km               DOUBLE        NULL,
    is_locked                BOOLEAN       NULL,
    is_in_use                BOOLEAN       NULL,
    is_climate_control_on    BOOLEAN       NULL,

    CONSTRAINT pk_device_cars PRIMARY KEY (device_id),
    CONSTRAINT fk_device_cars_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_car_locations (
    device_id  VARCHAR(255)  NOT NULL,
    name       VARCHAR(512)  NOT NULL,
    latitude   DOUBLE        NOT NULL,
    longitude  DOUBLE        NOT NULL,

    CONSTRAINT pk_device_car_locations PRIMARY KEY (device_id),
    CONSTRAINT fk_device_car_locations_car
        FOREIGN KEY (device_id) REFERENCES device_cars (device_id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_car_windows (
    device_id       VARCHAR(255)  NOT NULL,
    left_front      BOOLEAN       NOT NULL,
    left_rear       BOOLEAN       NOT NULL,
    right_front     BOOLEAN       NOT NULL,
    right_rear      BOOLEAN       NOT NULL,
    combined_state  BOOLEAN       NOT NULL,

    CONSTRAINT pk_device_car_windows PRIMARY KEY (device_id),
    CONSTRAINT fk_device_car_windows_car
        FOREIGN KEY (device_id) REFERENCES device_cars (device_id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_car_doors (
    device_id                VARCHAR(255)  NOT NULL,
    combined_security_state  BOOLEAN       NOT NULL,
    left_front               BOOLEAN       NOT NULL,
    left_rear                BOOLEAN       NOT NULL,
    right_front              BOOLEAN       NOT NULL,
    right_rear               BOOLEAN       NOT NULL,
    combined_state           BOOLEAN       NOT NULL,
    hood                     BOOLEAN       NOT NULL,
    trunk                    BOOLEAN       NOT NULL,

    CONSTRAINT pk_device_car_doors PRIMARY KEY (device_id),
    CONSTRAINT fk_device_car_doors_car
        FOREIGN KEY (device_id) REFERENCES device_cars (device_id)
        ON DELETE CASCADE
);


-- -----------------------------------------------------------------------------
-- Wetter
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_weather_reports (
    device_id                  VARCHAR(255)  NOT NULL,
    latitude                   DOUBLE        NULL,
    longitude                  DOUBLE        NULL,
    temperature                DOUBLE        NULL,
    temperature_min            DOUBLE        NULL,
    temperature_max            DOUBLE        NULL,
    weather_code               INT           NULL,
    humidity                   DOUBLE        NULL,
    pressure                   DOUBLE        NULL,
    visibility                 DOUBLE        NULL,
    uv_index                   DOUBLE        NULL,
    wind_speed_mps             DOUBLE        NULL,
    wind_speed_max             DOUBLE        NULL,
    wind_direction             DOUBLE        NULL,
    wind_direction_dominant    DOUBLE        NULL,
    precipitation_probability  DOUBLE        NULL,
    rain                       DOUBLE        NULL,
    rain_sum                   DOUBLE        NULL,
    showers                    DOUBLE        NULL,
    showers_sum                DOUBLE        NULL,
    snowfall                   DOUBLE        NULL,
    snowfall_sum               DOUBLE        NULL,
    snow_depth                 DOUBLE        NULL,
    sunrise                    VARCHAR(40)   NULL,
    sunset                     VARCHAR(40)   NULL,
    daylight_duration          DOUBLE        NULL,
    sunshine_duration          DOUBLE        NULL,

    CONSTRAINT pk_device_weather_reports PRIMARY KEY (device_id),
    CONSTRAINT fk_device_weather_reports_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Standort und aktuelles Wetter eines Wetter-Geräts.';


CREATE TABLE IF NOT EXISTS device_weather_forecasts (
    device_id     VARCHAR(255)  NOT NULL,
    sort_index    INT           NOT NULL,
    forecast_at   VARCHAR(40)   NOT NULL,
    temperature   DOUBLE        NOT NULL,
    weather_code  INT           NOT NULL,

    CONSTRAINT pk_device_weather_forecasts PRIMARY KEY (device_id, sort_index),
    CONSTRAINT fk_device_weather_forecasts_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Tagesprognose (Feld forecast).';


CREATE TABLE IF NOT EXISTS device_weather_hourly_forecasts (
    device_id                  VARCHAR(255)  NOT NULL,
    sort_index                 INT           NOT NULL,
    forecast_at                VARCHAR(40)   NOT NULL,
    temperature                DOUBLE        NOT NULL,
    weather_code               INT           NOT NULL,
    precipitation_probability  DOUBLE        NULL,

    CONSTRAINT pk_device_weather_hourly_forecasts PRIMARY KEY (device_id, sort_index),
    CONSTRAINT fk_device_weather_hourly_forecasts_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Stundenprognose (Feld hourlyForecast).';


-- -----------------------------------------------------------------------------
-- Anwesenheit
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_presences (
    device_id   VARCHAR(255)  NOT NULL,
    is_present  BOOLEAN       NOT NULL DEFAULT FALSE,

    CONSTRAINT pk_device_presences PRIMARY KEY (device_id),
    CONSTRAINT fk_device_presences_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


-- -----------------------------------------------------------------------------
-- Kalender
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_calendars (
    id                   VARCHAR(255)  NOT NULL,
    device_id            VARCHAR(255)  NOT NULL,
    sort_index           INT           NOT NULL,
    module_id            VARCHAR(64)   NOT NULL,
    name                 VARCHAR(255)  NOT NULL,
    color                VARCHAR(32)   NOT NULL,
    is_shown             BOOLEAN       NOT NULL,
    is_created_manually  BOOLEAN       NOT NULL DEFAULT FALSE,
    credential_id        VARCHAR(128)  NULL,

    CONSTRAINT pk_device_calendars PRIMARY KEY (id),
    INDEX idx_device_calendars_device_id (device_id, sort_index),
    INDEX idx_device_calendars_credential (module_id, credential_id),
    CONSTRAINT fk_device_calendars_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_device_calendars_module_credential
        FOREIGN KEY (module_id, credential_id) REFERENCES module_credentials (module_id, id)
        ON DELETE CASCADE
)
COMMENT = 'Kalender des Kalender-Geräts; CalDAV-Kalender verweisen auf die Zugangsdaten ihres Moduls.';


CREATE TABLE IF NOT EXISTS device_calendar_users (
    calendar_id  VARCHAR(255)  NOT NULL,
    user_id      VARCHAR(128)  NOT NULL,
    sort_index   INT           NOT NULL,

    CONSTRAINT pk_device_calendar_users PRIMARY KEY (calendar_id, user_id),
    INDEX idx_device_calendar_users_user_id (user_id),
    CONSTRAINT fk_device_calendar_users_calendar
        FOREIGN KEY (calendar_id) REFERENCES device_calendars (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_device_calendar_users_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
)
COMMENT = 'Zuordnung Kalender zu Benutzern (n:m, Feld assignedUserIds).';


CREATE TABLE IF NOT EXISTS device_calendar_entries (
    calendar_id              VARCHAR(255)   NOT NULL,
    id                       VARCHAR(255)   NOT NULL,
    sort_index               INT            NOT NULL,
    title                    TEXT           NOT NULL,
    description              TEXT           NULL,
    location                 TEXT           NULL,
    event_url                TEXT           NULL,
    starts_at                VARCHAR(64)    NOT NULL,
    ends_at                  VARCHAR(64)    NOT NULL,
    is_all_day               BOOLEAN        NULL,
    is_notification_enabled  BOOLEAN        NOT NULL,
    status                   VARCHAR(64)    NULL,
    recurrence_rule          TEXT           NULL,
    remote_updated_at        VARCHAR(64)    NOT NULL,
    remote_url               TEXT           NULL,
    etag                     VARCHAR(255)   NULL,
    ical_uid                 VARCHAR(255)   NULL,

    CONSTRAINT pk_device_calendar_entries PRIMARY KEY (calendar_id, id),
    CONSTRAINT fk_device_calendar_entries_calendar
        FOREIGN KEY (calendar_id) REFERENCES device_calendars (id)
        ON DELETE CASCADE
)
COMMENT = 'Termine; Zeiten als ISO-Text wie vom Anbieter geliefert. remote_url/etag/ical_uid nur bei CalDAV, die Zugangsdaten kommen vom Kalender.';


CREATE TABLE IF NOT EXISTS device_calendar_entry_organizers (
    calendar_id  VARCHAR(255)  NOT NULL,
    entry_id     VARCHAR(255)  NOT NULL,
    name         VARCHAR(255)  NULL,
    email        VARCHAR(255)  NULL,

    CONSTRAINT pk_device_calendar_entry_organizers PRIMARY KEY (calendar_id, entry_id),
    CONSTRAINT fk_device_calendar_entry_organizers_entry
        FOREIGN KEY (calendar_id, entry_id) REFERENCES device_calendar_entries (calendar_id, id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_calendar_entry_attendees (
    calendar_id  VARCHAR(255)  NOT NULL,
    entry_id     VARCHAR(255)  NOT NULL,
    sort_index   INT           NOT NULL,
    name         VARCHAR(255)  NULL,
    email        VARCHAR(255)  NULL,
    role         VARCHAR(64)   NULL,
    status       VARCHAR(64)   NULL,

    CONSTRAINT pk_device_calendar_entry_attendees PRIMARY KEY (calendar_id, entry_id, sort_index),
    CONSTRAINT fk_device_calendar_entry_attendees_entry
        FOREIGN KEY (calendar_id, entry_id) REFERENCES device_calendar_entries (calendar_id, id)
        ON DELETE CASCADE
);


-- -----------------------------------------------------------------------------
-- Modulspezifische Verbindungsdaten (1:1 zu devices)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_hue_details (
    device_id                 VARCHAR(255)  NOT NULL,
    bridge_id                 VARCHAR(255)  NULL,
    resource_id               VARCHAR(64)   NULL,
    battery_resource_id       VARCHAR(64)   NULL,
    motion_resource_id        VARCHAR(64)   NULL,
    light_level_resource_id   VARCHAR(64)   NULL,
    temperature_resource_id   VARCHAR(64)   NULL,

    CONSTRAINT pk_device_hue_details PRIMARY KEY (device_id),
    INDEX idx_device_hue_details_bridge_id (bridge_id),
    CONSTRAINT fk_device_hue_details_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Hue-Ressourcen-IDs (rid) des Geräts an seiner Bridge.';


CREATE TABLE IF NOT EXISTS device_matter_details (
    device_id  VARCHAR(255)  NOT NULL,
    node_id    VARCHAR(64)   NULL,

    CONSTRAINT pk_device_matter_details PRIMARY KEY (device_id),
    INDEX idx_device_matter_details_node_id (node_id),
    CONSTRAINT fk_device_matter_details_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_xiaomi_details (
    device_id  VARCHAR(255)  NOT NULL,
    address    VARCHAR(255)  NULL,
    token      VARCHAR(255)  NULL,
    model      VARCHAR(128)  NULL,
    did        VARCHAR(64)   NULL,

    CONSTRAINT pk_device_xiaomi_details PRIMARY KEY (device_id),
    CONSTRAINT fk_device_xiaomi_details_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_lg_details (
    device_id    VARCHAR(255)  NOT NULL,
    address      VARCHAR(255)  NULL,
    client_key   VARCHAR(255)  NULL,
    mac_address  VARCHAR(32)   NULL,

    CONSTRAINT pk_device_lg_details PRIMARY KEY (device_id),
    CONSTRAINT fk_device_lg_details_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_sonos_details (
    device_id  VARCHAR(255)  NOT NULL,
    address    VARCHAR(255)  NULL,
    room_name  VARCHAR(255)  NULL,

    CONSTRAINT pk_device_sonos_details PRIMARY KEY (device_id),
    CONSTRAINT fk_device_sonos_details_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_heos_details (
    device_id  VARCHAR(255)  NOT NULL,
    address    VARCHAR(255)  NULL,
    pid        BIGINT        NULL,

    CONSTRAINT pk_device_heos_details PRIMARY KEY (device_id),
    CONSTRAINT fk_device_heos_details_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'HEOS-Geräte (Denon); pid ist die HEOS-Player-ID.';


CREATE TABLE IF NOT EXISTS device_wac_details (
    device_id  VARCHAR(255)       NOT NULL,
    address    VARCHAR(255)       NULL,
    port       SMALLINT UNSIGNED  NULL,

    CONSTRAINT pk_device_wac_details PRIMARY KEY (device_id),
    CONSTRAINT fk_device_wac_details_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS device_voice_assistant_details (
    device_id      VARCHAR(255)       NOT NULL,
    keyword        VARCHAR(255)       NOT NULL,
    port           SMALLINT UNSIGNED  NOT NULL,
    passcode       INT UNSIGNED       NOT NULL,
    discriminator  SMALLINT UNSIGNED  NOT NULL,

    CONSTRAINT pk_device_voice_assistant_details PRIMARY KEY (device_id),
    CONSTRAINT uq_device_voice_assistant_details_port UNIQUE (port),
    CONSTRAINT fk_device_voice_assistant_details_device
        FOREIGN KEY (device_id) REFERENCES devices (id)
        ON DELETE CASCADE
)
COMMENT = 'Matter-Sprachassistent-Geräte (eines je Aktion).';
