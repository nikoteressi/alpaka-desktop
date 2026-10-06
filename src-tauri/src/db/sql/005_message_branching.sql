ALTER TABLE messages ADD COLUMN parent_id TEXT REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN sibling_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- Link existing flat messages to their chronological predecessor within each conversation.
-- Use rowid as a tiebreaker because created_at is second-precision and ties are common.
UPDATE messages SET parent_id = (
    SELECT m2.id FROM messages m2
    WHERE m2.conversation_id = messages.conversation_id
      AND (m2.created_at < messages.created_at
           OR (m2.created_at = messages.created_at AND m2.rowid < messages.rowid))
    ORDER BY m2.created_at DESC, m2.rowid DESC
    LIMIT 1
);

CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages (parent_id, is_active);
