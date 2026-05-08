/// Trims the oldest non-system messages from `messages` so the total estimated token count
/// fits within `budget`. System messages (at the head of the list) are always preserved.
pub(crate) fn apply_sliding_window(
    messages: &mut Vec<crate::ollama::types::Message>,
    budget: usize,
) {
    let system_count = messages.iter().take_while(|m| m.role == "system").count();
    let history = &messages[system_count..];
    let mut accumulated = 0usize;
    let mut keep_from = 0usize;
    for (i, msg) in history.iter().enumerate().rev() {
        let est = (msg.content.len() / 4).max(1);
        if accumulated + est > budget {
            keep_from = i + 1;
            break;
        }
        accumulated += est;
    }
    if keep_from > 0 {
        let mut trimmed = messages[..system_count].to_vec();
        trimmed.extend_from_slice(&messages[system_count + keep_from..]);
        *messages = trimmed;
        log::info!(
            "Context sliding window: trimmed {} history messages to fit budget={}",
            keep_from,
            budget
        );
    }
}

/// Strips reasoning and tool-call noise from stored assistant message content
/// before sending it back to the LLM as history context.
pub(crate) fn strip_history_content(content: &str) -> String {
    let mut result = String::with_capacity(content.len());
    let mut remaining = content;

    loop {
        let think_start = remaining.find("<think>");
        let tool_start = remaining.find("<tool_call>");

        let (tag_start, end_tag) = match (think_start, tool_start) {
            (None, None) => break,
            (Some(t), None) => (t, "</think>"),
            (None, Some(t)) => (t, "</tool_call>"),
            (Some(a), Some(b)) => {
                if a <= b {
                    (a, "</think>")
                } else {
                    (b, "</tool_call>")
                }
            }
        };

        result.push_str(&remaining[..tag_start]);
        remaining = &remaining[tag_start..];

        if let Some(end_pos) = remaining.find(end_tag) {
            remaining = &remaining[end_pos + end_tag.len()..];
        } else {
            // Unclosed tag — remove everything from here to end
            remaining = "";
            break;
        }
    }

    result.push_str(remaining);
    result.trim().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sliding_window_keeps_system_and_recent_messages() {
        use crate::ollama::types::Message;

        let make_msg = |role: &str, content: &str| Message {
            role: role.to_string(),
            content: content.to_string(),
            images: None,
            thinking: None,
            tool_calls: None,
            name: None,
        };

        let mut messages = vec![
            make_msg("system", "sys"),
            make_msg("user", &"x".repeat(400)),
            make_msg("user", &"x".repeat(400)),
            make_msg("user", &"x".repeat(400)),
            make_msg("user", &"x".repeat(400)),
            make_msg("user", &"x".repeat(400)),
        ];

        // budget = 300 * 0.85 = 255 tokens ≈ 255 chars/4; each msg ≈ 100 tokens → only 2 fit
        let budget = (300_f32 * 0.85) as usize;
        apply_sliding_window(&mut messages, budget);

        assert_eq!(messages[0].role, "system", "system message always kept");
        assert_eq!(
            messages.len(),
            3,
            "expected 1 system + 2 history messages after trim, got {}",
            messages.len()
        );
        assert_eq!(
            messages.last().unwrap().content,
            "x".repeat(400),
            "most recent kept"
        );
    }

    #[test]
    fn strip_removes_think_blocks() {
        let input = "Hello <think>internal reasoning here</think> world";
        let result = strip_history_content(input);
        assert_eq!(result, "Hello  world");
    }

    #[test]
    fn strip_removes_multiline_think_blocks() {
        let input = "Before\n<think>\nline1\nline2\n</think>\nAfter";
        let result = strip_history_content(input);
        assert_eq!(result, "Before\n\nAfter");
    }

    #[test]
    fn strip_drops_tail_on_unclosed_tag() {
        let input = "text <think>unclosed";
        let result = strip_history_content(input);
        assert_eq!(result, "text");
    }

    #[test]
    fn strip_removes_tool_call_blocks() {
        let input = "Result: <tool_call>{\"name\":\"web_search\",\"args\":{}}</tool_call> done";
        let result = strip_history_content(input);
        assert_eq!(result, "Result:  done");
    }

    #[test]
    fn strip_leaves_plain_content_unchanged() {
        let input = "  Hello world  ";
        let result = strip_history_content(input);
        assert_eq!(result, "Hello world");
    }

    #[test]
    fn strip_handles_nested_content_correctly() {
        let input = "<think>think</think>Answer<tool_call>call</tool_call>end";
        let result = strip_history_content(input);
        assert_eq!(result, "Answerend");
    }
}
