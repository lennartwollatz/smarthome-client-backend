-- =============================================================================
-- Normalisierung der Integrationen und Einstellungen:
-- bridges, discovered_devices (JSON-Spalte attributes) und settings
-- (Schlüssel-Wert-Zeilen) werden durch typisierte Tabellen ersetzt.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Hue-Bridges
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hue_bridges (
    id          VARCHAR(255)       NOT NULL,
    name        VARCHAR(255)       NULL,
    address     VARCHAR(255)       NULL,
    port        SMALLINT UNSIGNED  NULL,
    is_paired   BOOLEAN            NOT NULL DEFAULT FALSE,
    model_id    VARCHAR(64)        NULL,
    sw_version  VARCHAR(64)        NULL,
    username    VARCHAR(255)       NULL,
    client_key  VARCHAR(255)       NULL,
    created_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_hue_bridges PRIMARY KEY (id),
    INDEX idx_hue_bridges_name (name)
)
COMMENT = 'Gefundene bzw. gekoppelte Hue-Bridges inkl. Zugangsdaten (username, client_key).';


CREATE TABLE IF NOT EXISTS hue_bridge_devices (
    hue_bridge_id  VARCHAR(255)  NOT NULL,
    device_id      VARCHAR(255)  NOT NULL,
    sort_index     INT           NOT NULL,

    CONSTRAINT pk_hue_bridge_devices PRIMARY KEY (hue_bridge_id, device_id),
    CONSTRAINT uq_hue_bridge_devices_hue_bridge_id_sort_index UNIQUE (hue_bridge_id, sort_index),
    CONSTRAINT fk_hue_bridge_devices_hue_bridge
        FOREIGN KEY (hue_bridge_id) REFERENCES hue_bridges (id)
        ON DELETE CASCADE
)
COMMENT = 'Geräte-IDs einer Hue-Bridge in Listenreihenfolge. device_id ohne FK, da die Liste nicht an gespeicherte Geräte gebunden ist.';


-- -----------------------------------------------------------------------------
-- Per Netzwerksuche gefundene Geräte (eine Tabelle je Discovery-Typ)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS matter_discovered_devices (
    id                        VARCHAR(255)       NOT NULL,
    name                      VARCHAR(255)       NULL,
    address                   VARCHAR(255)       NULL,
    port                      SMALLINT UNSIGNED  NULL,
    vendor_id                 SMALLINT UNSIGNED  NULL,
    product_id                SMALLINT UNSIGNED  NULL,
    discriminator             SMALLINT UNSIGNED  NULL,
    device_type               INT UNSIGNED       NULL,
    instance_name             VARCHAR(255)       NULL,
    pairing_hint              VARCHAR(255)       NULL,
    pairing_instruction       VARCHAR(255)       NULL,
    rotating_id               VARCHAR(255)       NULL,
    is_commissionable         BOOLEAN            NOT NULL DEFAULT FALSE,
    is_operational            BOOLEAN            NOT NULL DEFAULT FALSE,
    last_seen_at              DATETIME(3)        NULL,
    session_idle_interval     INT UNSIGNED       NULL,
    session_active_interval   INT UNSIGNED       NULL,
    session_active_threshold  INT UNSIGNED       NULL,
    tcp_supported             BOOLEAN            NULL,
    compressed_fabric_id      VARCHAR(16)        NULL,
    operational_node_id       VARCHAR(16)        NULL,
    node_id                   VARCHAR(64)        NULL,
    node_fabric_id            VARCHAR(64)        NULL,
    token                     VARCHAR(255)       NULL,
    paired_at                 DATETIME(3)        NULL,
    is_paired                 BOOLEAN            NOT NULL DEFAULT FALSE,
    created_at                DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at                DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_matter_discovered_devices PRIMARY KEY (id),
    INDEX idx_matter_discovered_devices_name (name)
)
COMMENT = 'Gefundene Matter-Geräte inkl. Pairing-Daten. tcp_supported NULL = im TXT-Record nicht angegeben.';


CREATE TABLE IF NOT EXISTS matter_discovered_device_txt_records (
    matter_discovered_device_id  VARCHAR(255)   NOT NULL,
    record_key                   VARCHAR(255)   CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    record_value                 VARCHAR(1024)  NOT NULL,

    CONSTRAINT pk_matter_discovered_device_txt_records PRIMARY KEY (matter_discovered_device_id, record_key),
    CONSTRAINT fk_matter_discovered_device_txt_records_matter_discovered_device
        FOREIGN KEY (matter_discovered_device_id) REFERENCES matter_discovered_devices (id)
        ON DELETE CASCADE
)
COMMENT = 'mDNS-TXT-Einträge eines Matter-Geräts. record_key ist binär, da TXT-Schlüssel Groß-/Kleinschreibung unterscheiden.';


CREATE TABLE IF NOT EXISTS heos_discovered_devices (
    id                VARCHAR(255)       NOT NULL,
    name              VARCHAR(255)       NULL,
    address           VARCHAR(255)       NULL,
    port              SMALLINT UNSIGNED  NULL,
    friendly_name     VARCHAR(255)       NULL,
    model_name        VARCHAR(255)       NULL,
    model_number      VARCHAR(255)       NULL,
    heos_device_id    VARCHAR(255)       NULL,
    wlan_mac          VARCHAR(64)        NULL,
    ipv4_address      VARCHAR(64)        NULL,
    ipv6_address      VARCHAR(64)        NULL,
    mdns_name         VARCHAR(255)       NULL,
    firmware_version  VARCHAR(64)        NULL,
    serial_number     VARCHAR(255)       NULL,
    manufacturer      VARCHAR(255)       NULL,
    ip_address        VARCHAR(64)        NULL,
    pid               INT                NULL,
    created_at        DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at        DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_heos_discovered_devices PRIMARY KEY (id),
    INDEX idx_heos_discovered_devices_name (name)
)
COMMENT = 'Gefundene HEOS-Geräte. id ist die UDN; pid ist die (ggf. negative) HEOS-Player-ID.';


CREATE TABLE IF NOT EXISTS sonos_discovered_devices (
    id             VARCHAR(255)       NOT NULL,
    name           VARCHAR(255)       NULL,
    address        VARCHAR(255)       NULL,
    port           SMALLINT UNSIGNED  NULL,
    model_name     VARCHAR(255)       NULL,
    model_number   VARCHAR(255)       NULL,
    wlan_mac       VARCHAR(64)        NULL,
    serial_number  VARCHAR(255)       NULL,
    created_at     DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at     DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_sonos_discovered_devices PRIMARY KEY (id),
    INDEX idx_sonos_discovered_devices_name (name)
)
COMMENT = 'Gefundene Sonos-Geräte. id ist die UDN.';


CREATE TABLE IF NOT EXISTS lg_discovered_devices (
    id            VARCHAR(255)       NOT NULL,
    name          VARCHAR(255)       NULL,
    address       VARCHAR(255)       NULL,
    port          SMALLINT UNSIGNED  NULL,
    service_type  VARCHAR(255)       NULL,
    manufacturer  VARCHAR(255)       NULL,
    integrator    VARCHAR(255)       NULL,
    mac_address   VARCHAR(255)       NULL,
    created_at    DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_lg_discovered_devices PRIMARY KEY (id),
    INDEX idx_lg_discovered_devices_name (name)
)
COMMENT = 'Gefundene LG-Fernseher.';


CREATE TABLE IF NOT EXISTS xiaomi_discovered_devices (
    id          VARCHAR(255)       NOT NULL,
    name        VARCHAR(255)       NULL,
    address     VARCHAR(255)       NULL,
    port        SMALLINT UNSIGNED  NULL,
    model       VARCHAR(255)       NULL,
    token       VARCHAR(255)       NULL,
    mac         VARCHAR(64)        NULL,
    did         VARCHAR(64)        NULL,
    locale      VARCHAR(32)        NULL,
    status      VARCHAR(255)       NULL,
    created_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_xiaomi_discovered_devices PRIMARY KEY (id),
    INDEX idx_xiaomi_discovered_devices_name (name)
)
COMMENT = 'Gefundene Xiaomi-MiIO-Geräte inkl. Geräte-Token.';


CREATE TABLE IF NOT EXISTS waclighting_discovered_devices (
    id                VARCHAR(255)       NOT NULL,
    name              VARCHAR(255)       NULL,
    address           VARCHAR(255)       NULL,
    port              SMALLINT UNSIGNED  NULL,
    mac               VARCHAR(64)        NULL,
    model             VARCHAR(255)       NULL,
    manufacturer      VARCHAR(255)       NULL,
    client_id         VARCHAR(255)       NULL,
    fan_installed     BOOLEAN            NULL,
    light_installed   BOOLEAN            NULL,
    has_fan           BOOLEAN            NULL,
    has_light         BOOLEAN            NULL,
    firmware_version  VARCHAR(64)        NULL,
    product_type      VARCHAR(255)       NULL,
    created_at        DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at        DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_waclighting_discovered_devices PRIMARY KEY (id),
    INDEX idx_waclighting_discovered_devices_name (name)
)
COMMENT = 'Gefundene WAC-Lighting-Ventilatoren. Boolesche Felder NULL = Konfiguration nicht gelesen.';


CREATE TABLE IF NOT EXISTS bmw_discovered_devices (
    id          VARCHAR(255)       NOT NULL,
    name        VARCHAR(255)       NULL,
    address     VARCHAR(255)       NULL,
    port        SMALLINT UNSIGNED  NULL,
    vin         VARCHAR(32)        NOT NULL,
    brand       VARCHAR(64)        NULL,
    model       VARCHAR(255)       NULL,
    created_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_bmw_discovered_devices PRIMARY KEY (id),
    CONSTRAINT uq_bmw_discovered_devices_vin UNIQUE (vin),
    INDEX idx_bmw_discovered_devices_name (name)
)
COMMENT = 'Fahrzeuge aus dem BMW-Konto.';


CREATE TABLE IF NOT EXISTS hue_discovered_devices (
    id          VARCHAR(255)       NOT NULL,
    name        VARCHAR(255)       NULL,
    address     VARCHAR(255)       NULL,
    port        SMALLINT UNSIGNED  NULL,
    created_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_hue_discovered_devices PRIMARY KEY (id),
    INDEX idx_hue_discovered_devices_name (name)
)
COMMENT = 'Gefundene Hue-Geräte (nur Basisfelder).';


CREATE TABLE IF NOT EXISTS apple_calendar_discovered_devices (
    id          VARCHAR(255)       NOT NULL,
    name        VARCHAR(255)       NULL,
    address     VARCHAR(1024)      NULL,
    port        SMALLINT UNSIGNED  NULL,
    created_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_apple_calendar_discovered_devices PRIMARY KEY (id),
    INDEX idx_apple_calendar_discovered_devices_name (name)
)
COMMENT = 'CalDAV-Kalender (Apple). address ist die URL der Kalender-Collection.';


CREATE TABLE IF NOT EXISTS calendar_discovered_devices (
    id          VARCHAR(255)       NOT NULL,
    name        VARCHAR(255)       NULL,
    address     VARCHAR(255)       NULL,
    port        SMALLINT UNSIGNED  NULL,
    created_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_calendar_discovered_devices PRIMARY KEY (id),
    INDEX idx_calendar_discovered_devices_name (name)
)
COMMENT = 'Lokale Kalender (nur Basisfelder).';


CREATE TABLE IF NOT EXISTS weather_discovered_devices (
    id          VARCHAR(255)       NOT NULL,
    name        VARCHAR(255)       NULL,
    address     VARCHAR(255)       NULL,
    port        SMALLINT UNSIGNED  NULL,
    latitude    DOUBLE             NULL,
    longitude   DOUBLE             NULL,
    created_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at  DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_weather_discovered_devices PRIMARY KEY (id),
    INDEX idx_weather_discovered_devices_name (name)
)
COMMENT = 'Wetter-Standorte.';


-- -----------------------------------------------------------------------------
-- Einstellungen (genau eine Zeile)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS home_settings (
    id                                    TINYINT UNSIGNED               NOT NULL DEFAULT 1,
    home_name                             VARCHAR(255)                   NULL,
    language                              ENUM('de', 'en', 'fr')         NULL,
    temperature_unit                      ENUM('celsius', 'fahrenheit')  NULL,
    security_notifications_enabled        BOOLEAN                        NULL,
    battery_status_notifications_enabled  BOOLEAN                        NULL,
    energy_report_notifications_enabled   BOOLEAN                        NULL,
    ai_learning_enabled                   BOOLEAN                        NULL,
    auto_update_enabled                   BOOLEAN                        NULL,
    auto_update_time_from                 TIME                           NULL,
    auto_update_time_to                   TIME                           NULL,
    created_at                            DATETIME(3)                    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at                            DATETIME(3)                    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_home_settings PRIMARY KEY (id),
    CONSTRAINT chk_home_settings_singleton CHECK (id = 1)
)
COMMENT = 'Einstellungen des Smart Homes als einzige Zeile (id = 1). NULL = nicht gesetzt. Versionen und Server-IP werden berechnet.';


-- -----------------------------------------------------------------------------
-- Ersetzte Tabellen entfernen
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS bridges;
DROP TABLE IF EXISTS discovered_devices;
DROP TABLE IF EXISTS settings;
