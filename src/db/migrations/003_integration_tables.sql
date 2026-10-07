-- =============================================================================
-- Integrationen: Bridges, gefundene Geräte, Zugangsdaten und OAuth-Tokens
-- =============================================================================

CREATE TABLE IF NOT EXISTS bridges (
    bridge_type  VARCHAR(64)        NOT NULL,
    id           VARCHAR(255)       NOT NULL,
    name         VARCHAR(255)       NULL,
    address      VARCHAR(255)       NULL,
    port         SMALLINT UNSIGNED  NULL,
    is_paired    BOOLEAN            NOT NULL DEFAULT FALSE,
    attributes   JSON               NOT NULL,
    created_at   DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at   DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_bridges PRIMARY KEY (bridge_type, id)
)
COMMENT = 'Gefundene bzw. gekoppelte Bridges, z. B. bridge_type = HueBridgeDiscovered.';


CREATE TABLE IF NOT EXISTS discovered_devices (
    discovery_type  VARCHAR(64)        NOT NULL,
    id              VARCHAR(255)       NOT NULL,
    name            VARCHAR(255)       NULL,
    address         VARCHAR(255)       NULL,
    port            SMALLINT UNSIGNED  NULL,
    attributes      JSON               NOT NULL,
    created_at      DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_discovered_devices PRIMARY KEY (discovery_type, id)
)
COMMENT = 'Per Netzwerksuche gefundene Geräte inkl. Pairing-Daten, z. B. discovery_type = MatterDeviceDiscovered.';


CREATE TABLE IF NOT EXISTS module_credentials (
    module_id      VARCHAR(64)    NOT NULL,
    id             VARCHAR(128)   NOT NULL,
    username       VARCHAR(255)   NULL,
    password       VARCHAR(1024)  NULL,
    server_url     VARCHAR(1024)  NULL,
    captcha_token  TEXT           NULL,
    created_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_module_credentials PRIMARY KEY (module_id, id)
)
COMMENT = 'Zugangsdaten externer Dienste je Modul (z. B. BMW, Apple-Kalender).';


CREATE TABLE IF NOT EXISTS module_oauth_tokens (
    module_id      VARCHAR(64)  NOT NULL,
    access_token   TEXT         NOT NULL,
    refresh_token  TEXT         NOT NULL,
    valid_until    DATETIME(3)  NOT NULL,
    raw_response   MEDIUMTEXT   NULL,
    created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_module_oauth_tokens PRIMARY KEY (module_id)
);
