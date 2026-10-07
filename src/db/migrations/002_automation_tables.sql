-- =============================================================================
-- Automatisierung: Aktionen (Workflows) und Szenen
-- =============================================================================

CREATE TABLE IF NOT EXISTS actions (
    id            VARCHAR(128)  NOT NULL,
    name          VARCHAR(255)  NOT NULL,
    trigger_type  ENUM('manual', 'device', 'time', 'voice_assistant') NOT NULL,
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    workflow      JSON          NOT NULL,
    created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_actions PRIMARY KEY (id),
    INDEX idx_actions_trigger_type (trigger_type),
    INDEX idx_actions_created_at (created_at)
)
COMMENT = 'Aktionen. workflow ist der Knotengraph aus dem Workflow-Editor.';


CREATE TABLE IF NOT EXISTS action_ai_suggestions (
    action_id       VARCHAR(128)  NOT NULL,
    description     TEXT          NULL,
    confidence      DOUBLE        NULL,
    pattern_type    VARCHAR(64)   NULL,
    evidence_count  INT UNSIGNED  NULL,

    CONSTRAINT pk_action_ai_suggestions PRIMARY KEY (action_id),
    CONSTRAINT fk_action_ai_suggestions_action
        FOREIGN KEY (action_id) REFERENCES actions (id)
        ON DELETE CASCADE
)
COMMENT = 'Nur für KI-vorgeschlagene Aktionen vorhanden (1:1 zu actions).';


CREATE TABLE IF NOT EXISTS scenes (
    id            VARCHAR(128)  NOT NULL,
    name          VARCHAR(255)  NULL,
    icon          VARCHAR(64)   NULL,
    description   TEXT          NULL,
    is_active     BOOLEAN       NOT NULL DEFAULT FALSE,
    show_on_home  BOOLEAN       NOT NULL DEFAULT TRUE,
    is_custom     BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_scenes PRIMARY KEY (id),
    INDEX idx_scenes_created_at (created_at)
);


CREATE TABLE IF NOT EXISTS scene_actions (
    scene_id    VARCHAR(128)  NOT NULL,
    action_id   VARCHAR(128)  NOT NULL,
    sort_index  INT           NOT NULL,

    CONSTRAINT pk_scene_actions PRIMARY KEY (scene_id, action_id),
    INDEX idx_scene_actions_action_id (action_id),
    CONSTRAINT fk_scene_actions_scene
        FOREIGN KEY (scene_id) REFERENCES scenes (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_scene_actions_action
        FOREIGN KEY (action_id) REFERENCES actions (id)
        ON DELETE CASCADE
)
COMMENT = 'Zuordnung Szene zu Aktionen (n:m) in Ausführungsreihenfolge.';
