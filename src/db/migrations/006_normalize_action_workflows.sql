-- =============================================================================
-- Workflows normalisieren: die JSON-Spalte actions.workflow wird durch Knoten,
-- Verbindungen und Knotenkonfigurationen ersetzt (alle 1:n bzw. 1:1 zu actions).
-- Geräte-, Modul-, Szenen- und Aktions-IDs in den Konfigurationen sind bewusst
-- ohne Fremdschlüssel: Ziele dürfen entfallen, die Aktion behält den Verweis.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Knoten, Startknoten und Verbindungen
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS action_nodes (
    action_id   VARCHAR(128)  NOT NULL,
    node_id     VARCHAR(128)  NOT NULL,
    sort_index  INT           NOT NULL,
    node_type   ENUM('trigger', 'action', 'condition', 'wait', 'loop') NOT NULL,
    node_order  INT           NULL,
    name        VARCHAR(255)  NULL,
    position_x  DOUBLE        NULL,
    position_y  DOUBLE        NULL,

    CONSTRAINT pk_action_nodes PRIMARY KEY (action_id, node_id),
    CONSTRAINT uq_action_nodes_action_id_sort_index UNIQUE (action_id, sort_index),
    CONSTRAINT fk_action_nodes_action
        FOREIGN KEY (action_id) REFERENCES actions (id)
        ON DELETE CASCADE
)
COMMENT = 'Workflow-Knoten. sort_index ist die Position in der Knotenliste, node_order das Feld order des Editors.';


CREATE TABLE IF NOT EXISTS action_start_nodes (
    action_id  VARCHAR(128)  NOT NULL,
    node_id    VARCHAR(128)  NOT NULL,

    CONSTRAINT pk_action_start_nodes PRIMARY KEY (action_id),
    INDEX idx_action_start_nodes_action_id_node_id (action_id, node_id),
    CONSTRAINT fk_action_start_nodes_action_node
        FOREIGN KEY (action_id, node_id) REFERENCES action_nodes (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Startknoten des Workflows (optional, 1:1 zu actions).';


CREATE TABLE IF NOT EXISTS action_node_links (
    action_id       VARCHAR(128)  NOT NULL,
    node_id         VARCHAR(128)  NOT NULL,
    link_type       ENUM('next', 'true', 'false', 'loop') NOT NULL,
    sort_index      INT           NOT NULL,
    target_node_id  VARCHAR(128)  NOT NULL,

    CONSTRAINT pk_action_node_links PRIMARY KEY (action_id, node_id, link_type, sort_index),
    INDEX idx_action_node_links_action_id_target_node_id (action_id, target_node_id),
    CONSTRAINT fk_action_node_links_source_node
        FOREIGN KEY (action_id, node_id) REFERENCES action_nodes (action_id, node_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_action_node_links_target_node
        FOREIGN KEY (action_id, target_node_id) REFERENCES action_nodes (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Verbindungen in Listenreihenfolge: next = nextNodes, true/false = Bedingungszweige, loop = loopNodes.';


-- -----------------------------------------------------------------------------
-- Trigger
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS action_node_triggers (
    action_id     VARCHAR(128)  NOT NULL,
    node_id       VARCHAR(128)  NOT NULL,
    trigger_type  ENUM('manual', 'device', 'time', 'voice_assistant') NOT NULL,

    CONSTRAINT pk_action_node_triggers PRIMARY KEY (action_id, node_id),
    CONSTRAINT fk_action_node_triggers_action_node
        FOREIGN KEY (action_id, node_id) REFERENCES action_nodes (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Trigger-Konfiguration eines Knotens (optional, 1:1 zu action_nodes).';


CREATE TABLE IF NOT EXISTS action_node_trigger_devices (
    action_id   VARCHAR(128)  NOT NULL,
    node_id     VARCHAR(128)  NOT NULL,
    device_id   VARCHAR(255)  NULL,
    module_id   VARCHAR(64)   NULL,
    event_type  VARCHAR(255)  NULL,

    CONSTRAINT pk_action_node_trigger_devices PRIMARY KEY (action_id, node_id),
    INDEX idx_action_node_trigger_devices_device_id_event_type (device_id, event_type),
    CONSTRAINT fk_action_node_trigger_devices_action_node_trigger
        FOREIGN KEY (action_id, node_id) REFERENCES action_node_triggers (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Geräte-Trigger (optional, 1:1 zu action_node_triggers); event_type ist das auslösende Ereignis.';


CREATE TABLE IF NOT EXISTS action_node_trigger_device_values (
    action_id   VARCHAR(128)  NOT NULL,
    node_id     VARCHAR(128)  NOT NULL,
    sort_index  INT           NOT NULL,
    value_type  ENUM('string', 'number', 'boolean', 'null') NOT NULL,
    value_text  TEXT          NULL,

    CONSTRAINT pk_action_node_trigger_device_values PRIMARY KEY (action_id, node_id, sort_index),
    CONSTRAINT chk_action_node_trigger_device_values_value CHECK (
        (value_type = 'null') = (value_text IS NULL)
        AND (value_type <> 'boolean' OR value_text IN ('true', 'false'))
    ),
    CONSTRAINT fk_action_node_trigger_device_values_action_node_trigger_device
        FOREIGN KEY (action_id, node_id) REFERENCES action_node_trigger_devices (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Parameterwerte des Geräte-Triggers (triggerValues); value_text enthält den Wert gemäß value_type.';


CREATE TABLE IF NOT EXISTS action_node_trigger_times (
    action_id      VARCHAR(128)       NOT NULL,
    node_id        VARCHAR(128)       NOT NULL,
    frequency      ENUM('once', 'daily', 'weekly', 'monthly', 'yearly') NULL,
    time_of_day    TIME               NULL,
    day_of_month   TINYINT UNSIGNED   NULL,
    month_of_year  TINYINT UNSIGNED   NULL,
    day_of_year    SMALLINT UNSIGNED  NULL,

    CONSTRAINT pk_action_node_trigger_times PRIMARY KEY (action_id, node_id),
    CONSTRAINT fk_action_node_trigger_times_action_node_trigger
        FOREIGN KEY (action_id, node_id) REFERENCES action_node_triggers (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Zeit-Trigger (optional, 1:1 zu action_node_triggers).';


CREATE TABLE IF NOT EXISTS action_node_trigger_time_weekdays (
    action_id  VARCHAR(128)      NOT NULL,
    node_id    VARCHAR(128)      NOT NULL,
    weekday    TINYINT UNSIGNED  NOT NULL,

    CONSTRAINT pk_action_node_trigger_time_weekdays PRIMARY KEY (action_id, node_id, weekday),
    CONSTRAINT chk_action_node_trigger_time_weekdays_weekday CHECK (weekday <= 6),
    CONSTRAINT fk_action_node_trigger_time_weekdays_action_node_trigger_time
        FOREIGN KEY (action_id, node_id) REFERENCES action_node_trigger_times (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Wochentage eines Zeit-Triggers (0 = Sonntag bis 6 = Samstag).';


CREATE TABLE IF NOT EXISTS action_node_trigger_voice_assistants (
    action_id     VARCHAR(128)  NOT NULL,
    node_id       VARCHAR(128)  NOT NULL,
    keyword       VARCHAR(255)  NULL,
    action_type   VARCHAR(64)   NULL,
    device_id     VARCHAR(255)  NULL,
    pairing_code  VARCHAR(32)   NULL,

    CONSTRAINT pk_action_node_trigger_voice_assistants PRIMARY KEY (action_id, node_id),
    INDEX idx_action_node_trigger_voice_assistants_device_id (device_id),
    CONSTRAINT fk_action_node_trigger_voice_assistants_action_node_trigger
        FOREIGN KEY (action_id, node_id) REFERENCES action_node_triggers (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Sprachassistent-Trigger (optional, 1:1 zu action_node_triggers).';


-- -----------------------------------------------------------------------------
-- Aktionen, Bedingungen, Warten und Schleifen
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS action_node_actions (
    action_id         VARCHAR(128)  NOT NULL,
    node_id           VARCHAR(128)  NOT NULL,
    action_type       ENUM('device', 'scene', 'action') NULL,
    action_name       VARCHAR(255)  NULL,
    device_id         VARCHAR(255)  NULL,
    module_id         VARCHAR(64)   NULL,
    scene_id          VARCHAR(128)  NULL,
    called_action_id  VARCHAR(128)  NULL,

    CONSTRAINT pk_action_node_actions PRIMARY KEY (action_id, node_id),
    CONSTRAINT fk_action_node_actions_action_node
        FOREIGN KEY (action_id, node_id) REFERENCES action_nodes (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Aktions-Konfiguration eines Knotens (optional, 1:1). action_name ist die Gerätefunktion bzw. die aufgerufene Aktion.';


CREATE TABLE IF NOT EXISTS action_node_action_values (
    action_id   VARCHAR(128)  NOT NULL,
    node_id     VARCHAR(128)  NOT NULL,
    sort_index  INT           NOT NULL,
    value_type  ENUM('string', 'number', 'boolean', 'null') NOT NULL,
    value_text  TEXT          NULL,

    CONSTRAINT pk_action_node_action_values PRIMARY KEY (action_id, node_id, sort_index),
    CONSTRAINT chk_action_node_action_values_value CHECK (
        (value_type = 'null') = (value_text IS NULL)
        AND (value_type <> 'boolean' OR value_text IN ('true', 'false'))
    ),
    CONSTRAINT fk_action_node_action_values_action_node_action
        FOREIGN KEY (action_id, node_id) REFERENCES action_node_actions (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Parameterwerte der Aktion (values); value_text enthält den Wert gemäß value_type.';


CREATE TABLE IF NOT EXISTS action_node_conditions (
    action_id      VARCHAR(128)  NOT NULL,
    node_id        VARCHAR(128)  NOT NULL,
    device_id      VARCHAR(255)  NULL,
    module_id      VARCHAR(64)   NULL,
    property_name  VARCHAR(255)  NULL,

    CONSTRAINT pk_action_node_conditions PRIMARY KEY (action_id, node_id),
    CONSTRAINT fk_action_node_conditions_action_node
        FOREIGN KEY (action_id, node_id) REFERENCES action_nodes (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Bedingung eines Bedingungsknotens (optional, 1:1); property_name ist die geprüfte Gerätefunktion.';


CREATE TABLE IF NOT EXISTS action_node_condition_values (
    action_id   VARCHAR(128)  NOT NULL,
    node_id     VARCHAR(128)  NOT NULL,
    sort_index  INT           NOT NULL,
    value_type  ENUM('string', 'number', 'boolean', 'null') NOT NULL,
    value_text  TEXT          NULL,

    CONSTRAINT pk_action_node_condition_values PRIMARY KEY (action_id, node_id, sort_index),
    CONSTRAINT chk_action_node_condition_values_value CHECK (
        (value_type = 'null') = (value_text IS NULL)
        AND (value_type <> 'boolean' OR value_text IN ('true', 'false'))
    ),
    CONSTRAINT fk_action_node_condition_values_action_node_condition
        FOREIGN KEY (action_id, node_id) REFERENCES action_node_conditions (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Parameterwerte der Bedingung (values); value_text enthält den Wert gemäß value_type.';


CREATE TABLE IF NOT EXISTS action_node_waits (
    action_id        VARCHAR(128)  NOT NULL,
    node_id          VARCHAR(128)  NOT NULL,
    wait_type        ENUM('time', 'trigger') NULL,
    wait_seconds     DOUBLE        NULL,
    device_id        VARCHAR(255)  NULL,
    module_id        VARCHAR(64)   NULL,
    event_type       VARCHAR(255)  NULL,
    timeout_seconds  DOUBLE        NULL,

    CONSTRAINT pk_action_node_waits PRIMARY KEY (action_id, node_id),
    CONSTRAINT fk_action_node_waits_action_node
        FOREIGN KEY (action_id, node_id) REFERENCES action_nodes (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Warte-Konfiguration eines Knotens (optional, 1:1); Zeiten in Sekunden.';


CREATE TABLE IF NOT EXISTS action_node_wait_values (
    action_id   VARCHAR(128)  NOT NULL,
    node_id     VARCHAR(128)  NOT NULL,
    sort_index  INT           NOT NULL,
    value_type  ENUM('string', 'number', 'boolean', 'null') NOT NULL,
    value_text  TEXT          NULL,

    CONSTRAINT pk_action_node_wait_values PRIMARY KEY (action_id, node_id, sort_index),
    CONSTRAINT chk_action_node_wait_values_value CHECK (
        (value_type = 'null') = (value_text IS NULL)
        AND (value_type <> 'boolean' OR value_text IN ('true', 'false'))
    ),
    CONSTRAINT fk_action_node_wait_values_action_node_wait
        FOREIGN KEY (action_id, node_id) REFERENCES action_node_waits (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Parameterwerte des erwarteten Ereignisses (triggerValues); value_text enthält den Wert gemäß value_type.';


CREATE TABLE IF NOT EXISTS action_node_loops (
    action_id        VARCHAR(128)  NOT NULL,
    node_id          VARCHAR(128)  NOT NULL,
    loop_type        ENUM('for', 'while') NULL,
    iteration_count  INT           NULL,
    max_iterations   INT           NULL,

    CONSTRAINT pk_action_node_loops PRIMARY KEY (action_id, node_id),
    CONSTRAINT fk_action_node_loops_action_node
        FOREIGN KEY (action_id, node_id) REFERENCES action_nodes (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Schleifen-Konfiguration eines Knotens (optional, 1:1); iteration_count für for, max_iterations für while.';


CREATE TABLE IF NOT EXISTS action_node_loop_conditions (
    action_id      VARCHAR(128)  NOT NULL,
    node_id        VARCHAR(128)  NOT NULL,
    device_id      VARCHAR(255)  NULL,
    module_id      VARCHAR(64)   NULL,
    property_name  VARCHAR(255)  NULL,

    CONSTRAINT pk_action_node_loop_conditions PRIMARY KEY (action_id, node_id),
    CONSTRAINT fk_action_node_loop_conditions_action_node_loop
        FOREIGN KEY (action_id, node_id) REFERENCES action_node_loops (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Bedingung einer while-Schleife (optional, 1:1 zu action_node_loops).';


CREATE TABLE IF NOT EXISTS action_node_loop_condition_values (
    action_id   VARCHAR(128)  NOT NULL,
    node_id     VARCHAR(128)  NOT NULL,
    sort_index  INT           NOT NULL,
    value_type  ENUM('string', 'number', 'boolean', 'null') NOT NULL,
    value_text  TEXT          NULL,

    CONSTRAINT pk_action_node_loop_condition_values PRIMARY KEY (action_id, node_id, sort_index),
    CONSTRAINT chk_action_node_loop_condition_values_value CHECK (
        (value_type = 'null') = (value_text IS NULL)
        AND (value_type <> 'boolean' OR value_text IN ('true', 'false'))
    ),
    CONSTRAINT fk_action_node_loop_condition_values_action_node_loop_condition
        FOREIGN KEY (action_id, node_id) REFERENCES action_node_loop_conditions (action_id, node_id)
        ON DELETE CASCADE
)
COMMENT = 'Parameterwerte der Schleifenbedingung (values); value_text enthält den Wert gemäß value_type.';


-- -----------------------------------------------------------------------------
-- JSON-Spalte entfernen
-- -----------------------------------------------------------------------------

ALTER TABLE actions
    DROP COLUMN workflow,
    COMMENT = 'Aktionen. Der Workflow liegt in action_nodes, action_start_nodes, action_node_links und den Konfigurationstabellen action_node_*.';
