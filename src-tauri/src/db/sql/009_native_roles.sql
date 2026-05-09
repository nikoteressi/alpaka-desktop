-- v17: add thinking, tool_calls_json, tool_name columns; extend role CHECK to include 'tool'

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE;

DROP TABLE IF EXISTS messages_new;

CREATE TABLE messages_new (
    id                      TEXT    PRIMARY KEY NOT NULL,
    conversation_id         TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role                    TEXT    NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'compact_summary', 'tool')),
    content                 TEXT    NOT NULL DEFAULT '',
    images_json             TEXT    NOT NULL DEFAULT '[]',
    files_json              TEXT    NOT NULL DEFAULT '[]',
    tokens_used             INTEGER,
    generation_time_ms      INTEGER,
    prompt_tokens           INTEGER,
    tokens_per_sec          REAL,
    total_duration_ms       INTEGER,
    load_duration_ms        INTEGER,
    prompt_eval_duration_ms INTEGER,
    eval_duration_ms        INTEGER,
    seed                    INTEGER,
    created_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    parent_id               TEXT    REFERENCES messages(id) ON DELETE CASCADE,
    sibling_order           INTEGER NOT NULL DEFAULT 0,
    is_active               INTEGER NOT NULL DEFAULT 1,
    is_archived             INTEGER NOT NULL DEFAULT 0,
    thinking                TEXT,
    tool_calls_json         TEXT,
    tool_name               TEXT
);

INSERT INTO messages_new
    SELECT id, conversation_id, role, content, images_json, files_json,
           tokens_used, generation_time_ms, prompt_tokens, tokens_per_sec,
           total_duration_ms, load_duration_ms, prompt_eval_duration_ms, eval_duration_ms,
           seed, created_at, parent_id, sibling_order, is_active, is_archived,
           NULL, NULL, NULL
    FROM messages;

DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

COMMIT;

PRAGMA foreign_keys = ON;
