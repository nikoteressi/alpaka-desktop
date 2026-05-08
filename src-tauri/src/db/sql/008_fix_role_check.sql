-- v15 was recorded against an older ALTER TABLE-only script that never updated the
-- role CHECK constraint. Recreate the messages table to fix it.
-- This is safe to run even if v15 already added is_archived via ALTER TABLE.

PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE;

DROP TABLE IF EXISTS messages_new;

CREATE TABLE messages_new (
    id                      TEXT    PRIMARY KEY NOT NULL,
    conversation_id         TEXT    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role                    TEXT    NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'compact_summary')),
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
    is_archived             INTEGER NOT NULL DEFAULT 0
);

INSERT INTO messages_new
    SELECT id, conversation_id, role, content, images_json, files_json,
           tokens_used, generation_time_ms, prompt_tokens, tokens_per_sec,
           total_duration_ms, load_duration_ms, prompt_eval_duration_ms, eval_duration_ms,
           seed, created_at, parent_id, sibling_order, is_active, is_archived
    FROM messages;

DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

COMMIT;

PRAGMA foreign_keys = ON;
