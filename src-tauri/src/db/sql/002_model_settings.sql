CREATE TABLE IF NOT EXISTS model_settings (
    model_name    TEXT PRIMARY KEY NOT NULL,
    defaults_json TEXT NOT NULL DEFAULT '{}',
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
