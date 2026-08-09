CREATE TABLE IF NOT EXISTS info_board_translations (
    translation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    entity_type ENUM('forum', 'thread', 'post') NOT NULL,
    entity_id VARCHAR(32) NOT NULL,
    field_name VARCHAR(64) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    source_hash CHAR(64) NOT NULL,
    translated_text MEDIUMTEXT NOT NULL,
    provider VARCHAR(32) NOT NULL DEFAULT 'openai',
    model VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (translation_id),
    UNIQUE KEY uq_info_board_translation (entity_type, entity_id, field_name, language_code),
    KEY idx_info_board_translation_lookup (entity_type, language_code, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
