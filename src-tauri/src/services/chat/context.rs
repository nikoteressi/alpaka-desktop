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
}
