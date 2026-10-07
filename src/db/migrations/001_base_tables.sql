-- =============================================================================
-- Stammdaten: Module, Einstellungen, Benutzer, Räume und Geräte
-- =============================================================================

CREATE TABLE IF NOT EXISTS modules (
    id            VARCHAR(64)  NOT NULL,
    is_installed  BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    is_purchased  BOOLEAN      NOT NULL DEFAULT TRUE,
    is_disabled   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_modules PRIMARY KEY (id)
)
COMMENT = 'Zustand der Module. Name, Beschreibung, Preis und Version stehen im Code (modules.ts).';


CREATE TABLE IF NOT EXISTS settings (
    section        VARCHAR(32)  NOT NULL,
    setting_key    VARCHAR(64)  NOT NULL,
    setting_value  JSON         NOT NULL,
    updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_settings PRIMARY KEY (section, setting_key)
)
COMMENT = 'Benutzereinstellungen je Bereich (allgemein, notifications, privacy, system).';


CREATE TABLE IF NOT EXISTS users (
    id                          VARCHAR(128)  NOT NULL,
    name                        VARCHAR(255)  NULL,
    email                       VARCHAR(255)  NULL,
    phone_number                VARCHAR(64)   NULL,
    role                        VARCHAR(32)   NULL,
    avatar                      MEDIUMTEXT    NULL,
    last_active                 VARCHAR(64)   NULL,
    location_tracking_enabled   BOOLEAN       NOT NULL DEFAULT FALSE,
    tracking_token              VARCHAR(64)   NULL,
    push_notifications_enabled  BOOLEAN       NOT NULL DEFAULT FALSE,
    email_notifications_enabled BOOLEAN       NOT NULL DEFAULT FALSE,
    sms_notifications_enabled   BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at                  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at                  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_tracking_token UNIQUE (tracking_token)
);


CREATE TABLE IF NOT EXISTS user_presence_devices (
    user_id        VARCHAR(128)       NOT NULL,
    port           SMALLINT UNSIGNED  NOT NULL,
    passcode       INT UNSIGNED       NOT NULL,
    discriminator  SMALLINT UNSIGNED  NOT NULL,
    pairing_code   VARCHAR(32)        NULL,

    CONSTRAINT pk_user_presence_devices PRIMARY KEY (user_id),
    CONSTRAINT uq_user_presence_devices_port UNIQUE (port),
    CONSTRAINT fk_user_presence_devices_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
)
COMMENT = 'Matter-Anwesenheitsgerät je Benutzer (optional, 1:1 zu users).';


CREATE TABLE IF NOT EXISTS rooms (
    id           VARCHAR(128)  NOT NULL,
    name         VARCHAR(255)  NULL,
    icon         VARCHAR(64)   NULL,
    color        VARCHAR(64)   NULL,
    temperature  DECIMAL(5,2)  NULL,
    pos_x        DOUBLE        NULL,
    pos_y        DOUBLE        NULL,
    width        DOUBLE        NULL,
    height       DOUBLE        NULL,
    sort_index   INT           NOT NULL DEFAULT 0,
    created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_rooms PRIMARY KEY (id),
    INDEX idx_rooms_sort_index (sort_index)
)
COMMENT = 'Räume des Grundrisses. Der Grundriss selbst ist die nach sort_index sortierte Raumliste.';


CREATE TABLE IF NOT EXISTS room_points (
    room_id      VARCHAR(128)  NOT NULL,
    point_index  INT           NOT NULL,
    x            DOUBLE        NOT NULL,
    y            DOUBLE        NOT NULL,

    CONSTRAINT pk_room_points PRIMARY KEY (room_id, point_index),
    CONSTRAINT fk_room_points_room
        FOREIGN KEY (room_id) REFERENCES rooms (id)
        ON DELETE CASCADE
)
COMMENT = 'Eckpunkte des Raum-Polygons in Zeichenreihenfolge.';


CREATE TABLE IF NOT EXISTS devices (
    id               VARCHAR(255)  NOT NULL,
    module_id        VARCHAR(64)   NULL,
    room_id          VARCHAR(128)  NULL,
    device_type      VARCHAR(64)   NULL,
    name             VARCHAR(255)  NULL,
    is_connected     BOOLEAN       NOT NULL DEFAULT FALSE,
    is_pairing_mode  BOOLEAN       NOT NULL DEFAULT FALSE,
    has_battery      BOOLEAN       NOT NULL DEFAULT FALSE,
    battery_level    DECIMAL(5,2)  NOT NULL DEFAULT 0,
    quick_access     BOOLEAN       NOT NULL DEFAULT FALSE,
    attributes       JSON          NOT NULL,
    created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_devices PRIMARY KEY (id),
    INDEX idx_devices_module_id (module_id),
    INDEX idx_devices_room_id (room_id),
    INDEX idx_devices_device_type (device_type),
    CONSTRAINT fk_devices_room
        FOREIGN KEY (room_id) REFERENCES rooms (id)
        ON DELETE SET NULL
)
COMMENT = 'Geräte. attributes enthält die typ- und modulspezifischen Felder (z. B. brightness, bridgeId).';
