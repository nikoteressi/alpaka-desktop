CREATE TABLE IF NOT EXISTS model_user_data (
    name        TEXT    PRIMARY KEY NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    tags_json   TEXT    NOT NULL DEFAULT '[]',
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
