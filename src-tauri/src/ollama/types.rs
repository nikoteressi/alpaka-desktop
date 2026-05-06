use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<String>,
    /// Present when model responds with tool calls instead of content
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    /// Used in tool-response messages (role = "tool")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// Controls reasoning depth. Boolean for most models (Qwen3, DeepSeek);
/// string level "low"|"medium"|"high" for GPT-OSS.
#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum ThinkParam {
    Bool(bool),
    Level(String),
}

/// Tool function call returned by the model inside a streaming response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    #[serde(default)]
    pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub function: ToolCallFunction,
}

/// Tool definition passed to Ollama to enable function calling.
#[derive(Debug, Clone, Serialize)]
pub struct Tool {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: ToolFunctionDef,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolFunctionDef {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub stream: bool,
    /// Top-level think parameter — NOT inside options
    #[serde(skip_serializing_if = "Option::is_none")]
    pub think: Option<ThinkParam>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<ChatOptions>,
}

/// Placeholder for future model-parameter tuning (temperature, top_p, etc.)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChatOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_predict: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_ctx: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repeat_penalty: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repeat_last_n: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mirostat: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mirostat_tau: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mirostat_eta: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_gpu: Option<i32>,
}

impl ChatOptions {
    pub fn merge_with_fallback(&self, fallback: &ChatOptions) -> ChatOptions {
        ChatOptions {
            temperature: self.temperature.or(fallback.temperature),
            top_p: self.top_p.or(fallback.top_p),
            top_k: self.top_k.or(fallback.top_k),
            num_predict: self.num_predict.or(fallback.num_predict),
            num_ctx: self.num_ctx.or(fallback.num_ctx),
            repeat_penalty: self.repeat_penalty.or(fallback.repeat_penalty),
            repeat_last_n: self.repeat_last_n.or(fallback.repeat_last_n),
            seed: self.seed.or(fallback.seed),
            stop: self.stop.clone().or_else(|| fallback.stop.clone()),
            mirostat: self.mirostat.or(fallback.mirostat),
            mirostat_tau: self.mirostat_tau.or(fallback.mirostat_tau),
            mirostat_eta: self.mirostat_eta.or(fallback.mirostat_eta),
            num_gpu: self.num_gpu.or(fallback.num_gpu),
        }
    }
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
                thinking: None,
                tool_calls: None,
                name: None,
            }],
            stream: false,
            think: None,
            tools: None,
            options: None,
        };

        let val = serde_json::to_value(&req).unwrap();
        assert_eq!(val["messages"][0]["images"][0], "base64encodedstr");
    }

    #[test]
    fn test_message_serialization_without_images_omits_field() {
        let req = ChatRequest {
            model: "llama3".into(),
            messages: vec![Message {
                role: "user".into(),
                content: "No image here".into(),
                images: None,
                thinking: None,
                tool_calls: None,
                name: None,
            }],
            stream: false,
            think: None,
            tools: None,
            options: None,
        };

        let val = serde_json::to_value(&req).unwrap();
        // Should omit "images" entirely rather than outputting `"images": null`
        assert!(
            val["messages"][0].get("images").is_none(),
            "images field should be completely omitted when None"
        );
    }

    #[test]
    fn test_thinking_field_omitted_when_none() {
        let msg = Message {
            role: "assistant".into(),
            content: "Hello".into(),
            images: None,
            thinking: None,
            tool_calls: None,
            name: None,
        };
        let val = serde_json::to_value(&msg).unwrap();
        assert!(
            val.get("thinking").is_none(),
            "thinking field should be omitted when None"
        );
    }

    #[test]
    fn test_thinking_field_serialized_when_present() {
        let msg = Message {
            role: "assistant".into(),
            content: "Final answer".into(),
            images: None,
            thinking: Some("step-by-step reasoning".into()),
            tool_calls: None,
            name: None,
        };
        let val = serde_json::to_value(&msg).unwrap();
        assert_eq!(val["thinking"], "step-by-step reasoning");
    }

    #[test]
    fn test_stream_response_deserializes_thinking_field() {
        let json = r#"{
            "model": "deepseek-r1",
            "created_at": "2024-01-01T00:00:00Z",
            "message": {
                "role": "assistant",
                "content": "",
                "thinking": "I should reason carefully here"
            },
            "done": false
        }"#;
        let resp: StreamResponse = serde_json::from_str(json).unwrap();
        assert_eq!(
            resp.message.thinking.as_deref(),
            Some("I should reason carefully here")
        );
        assert_eq!(resp.message.content, "");
    }

    #[test]
    fn test_mirostat_fields_serialized_when_set() {
        let opts = ChatOptions {
            mirostat: Some(2),
            mirostat_tau: Some(5.0),
            mirostat_eta: Some(0.1),
            ..Default::default()
        };
        let val = serde_json::to_value(&opts).unwrap();
        assert_eq!(val["mirostat"], 2);
        assert!((val["mirostat_tau"].as_f64().unwrap() - 5.0).abs() < 1e-5);
        assert!((val["mirostat_eta"].as_f64().unwrap() - 0.1).abs() < 1e-5);
    }

    #[test]
    fn test_mirostat_fields_omitted_when_none() {
        let opts = ChatOptions::default();
        let val = serde_json::to_value(&opts).unwrap();
        assert!(val.get("mirostat").is_none());
        assert!(val.get("mirostat_tau").is_none());
        assert!(val.get("mirostat_eta").is_none());
    }

    #[test]
    fn test_merge_with_fallback_mirostat() {
        let primary = ChatOptions {
            mirostat: Some(1),
            ..Default::default()
        };
        let fallback = ChatOptions {
            mirostat: Some(2),
            mirostat_tau: Some(5.0),
            mirostat_eta: Some(0.1),
            ..Default::default()
        };
        let merged = primary.merge_with_fallback(&fallback);
        assert_eq!(merged.mirostat, Some(1)); // primary wins
        assert_eq!(merged.mirostat_tau, Some(5.0)); // fallback fills in
        assert_eq!(merged.mirostat_eta, Some(0.1)); // fallback fills in
    }

    #[test]
    fn test_stream_response_thinking_absent_is_none() {
        let json = r#"{
            "model": "llama3",
            "created_at": "2024-01-01T00:00:00Z",
            "message": {
                "role": "assistant",
                "content": "Hello!"
            },
            "done": false
        }"#;
        let resp: StreamResponse = serde_json::from_str(json).unwrap();
        assert!(resp.message.thinking.is_none());
    }

    #[test]
    fn test_num_gpu_serialized_when_set() {
        let opts = ChatOptions {
            num_gpu: Some(20),
            ..Default::default()
        };
        let val = serde_json::to_value(&opts).unwrap();
        assert_eq!(val["num_gpu"], 20);
    }

    #[test]
    fn test_num_gpu_omitted_when_none() {
        let opts = ChatOptions::default();
        let val = serde_json::to_value(&opts).unwrap();
        assert!(val.get("num_gpu").is_none());
    }

    #[test]
    fn test_num_gpu_merge_primary_wins() {
        let primary = ChatOptions {
            num_gpu: Some(10),
            ..Default::default()
        };
        let fallback = ChatOptions {
            num_gpu: Some(30),
            ..Default::default()
        };
        let merged = primary.merge_with_fallback(&fallback);
        assert_eq!(merged.num_gpu, Some(10));
    }

    #[test]
    fn test_num_gpu_merge_fallback_fills() {
        let primary = ChatOptions::default();
        let fallback = ChatOptions {
            num_gpu: Some(20),
            ..Default::default()
        };
        let merged = primary.merge_with_fallback(&fallback);
        assert_eq!(merged.num_gpu, Some(20));
    }

    #[test]
    fn test_num_gpu_negative_one_serialized() {
        let opts = ChatOptions {
            num_gpu: Some(-1),
            ..Default::default()
        };
        let val = serde_json::to_value(&opts).unwrap();
        assert_eq!(val["num_gpu"], -1);
    }
}
