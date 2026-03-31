use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub stream: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StreamResponse {
    pub model: String,
    pub created_at: String,
    pub message: Message,
    pub done: bool,
    pub done_reason: Option<String>,
    pub total_duration: Option<u64>,
    pub load_duration: Option<u64>,
    pub prompt_eval_count: Option<u32>,
    pub prompt_eval_duration: Option<u64>,
    pub eval_count: Option<u32>,
    pub eval_duration: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    

    #[test]
    fn test_message_serialization_with_images() {
        let req = ChatRequest {
            model: "llama3".into(),
            messages: vec![Message {
                role: "user".into(),
                content: "Look at this".into(),
                images: Some(vec!["base64encodedstr".into()]),
            }],
            stream: false,
        };

        let val = serde_json::to_value(&req).unwrap();
        assert_eq!(
            val["messages"][0]["images"][0],
            "base64encodedstr"
        );
    }

    #[test]
    fn test_message_serialization_without_images_omits_field() {
        let req = ChatRequest {
            model: "llama3".into(),
            messages: vec![Message {
                role: "user".into(),
                content: "No image here".into(),
                images: None,
            }],
            stream: false,
        };

        let val = serde_json::to_value(&req).unwrap();
        // Should omit "images" entirely rather than outputting `"images": null`
        assert!(val["messages"][0].get("images").is_none(), "images field should be completely omitted when None");
    }
}
