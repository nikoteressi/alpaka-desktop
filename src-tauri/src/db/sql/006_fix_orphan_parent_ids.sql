-- Chain orphaned root messages to their immediate predecessor within each conversation.
-- Affects conversations created before branching support: user messages were stored with
-- parent_id = NULL, which caused the CTE to include all of them as branch roots instead of
-- following a single active path.
-- The first message in each conversation (no predecessor) is left as the legitimate root.
-- Assistant messages already have correct parent_ids and are unaffected by this WHERE clause.
UPDATE messages
SET parent_id = (
    SELECT prev.id
    FROM messages AS prev
    WHERE prev.conversation_id = messages.conversation_id
      AND prev.created_at < messages.created_at
    ORDER BY prev.created_at DESC, prev.id ASC
    LIMIT 1
)
WHERE parent_id IS NULL
  AND EXISTS (
    SELECT 1 FROM messages AS prev
    WHERE prev.conversation_id = messages.conversation_id
      AND prev.created_at < messages.created_at
  );
