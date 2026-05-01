use html_escape::decode_html_entities;
use once_cell::sync::Lazy;
use serde::Serialize;

use crate::error::AppError;

// ── Public types ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct LibraryModel {
    pub name: String,
    pub slug: String,
    pub description: String,
    pub tags: Vec<String>,
    pub pull_count: Option<String>,
    pub updated_at: Option<String>,
    pub tag_count: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct LibraryTag {
    pub name: String,
    pub size: String,
    pub hash: String,
    pub updated_at: String,
    pub context: Option<String>,
    pub input: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct LaunchApp {
    pub name: String,
    pub command: String,
    pub icon_url: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct LibraryModelDetails {
    pub readme: String,
    pub launch_apps: Vec<LaunchApp>,
}

// ── Regex statics ─────────────────────────────────────────────────────────────

static RE_MODEL: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(
        r#"(?si)<a\b[^>]*?href="/library/(?P<slug>[^"]+)"[^>]*?class="group[^"]*"[^>]*?>.*?</a>"#,
    )
    .expect("RE_MODEL")
});
static RE_NAME: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(
        r#"(?si)<span\b[^>]*?x-test-search-response-title[^>]*?>(?P<name>.*?)</span>"#,
    )
    .expect("RE_NAME")
});
static RE_DESC: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(r#"(?si)<p\b[^>]*?class="[^"]*text-md[^"]*"[^>]*?>(?P<desc>.*?)</p>"#)
        .expect("RE_DESC")
});
static RE_TAGS: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(
        r#"(?si)<span\b[^>]*?class="[^"]*text-(?:indigo|blue)-600[^"]*"[^>]*?>(?P<tag>.*?)</span>"#,
    )
    .expect("RE_TAGS")
});
static RE_PULLS: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(r#"(?si)<span\b[^>]*?x-test-pull-count[^>]*?>(?P<pulls>.*?)</span>"#)
        .expect("RE_PULLS")
});
static RE_UPDATED: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(r#"(?si)<span\b[^>]*?x-test-updated[^>]*?>(?P<updated>.*?)</span>"#)
        .expect("RE_UPDATED")
});
static RE_TAG_COUNT: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(r#"(?si)<span\b[^>]*?x-test-tag-count[^>]*?>(?P<count>.*?)</span>"#)
        .expect("RE_TAG_COUNT")
});
static RE_TAG_NAME: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(r#"href="/library/[^" ]+:(?P<tag>[^" ]+)""#).expect("RE_TAG_NAME")
});
static RE_TAG_DETAILS: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(
        r#"(?si)<(?:p|div)\b[^>]*?class="[^"]*text-\[13px\][^"]*"[^>]*?>(?P<val>.*?)</(?:p|div)>"#,
    )
    .expect("RE_TAG_DETAILS")
});
static RE_TAG_HASH: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(
        r#"(?si)<span\b[^>]*?class="font-mono[^"]*"[^>]*?>(?P<hash>[a-f0-9]{7,12})</span>"#,
    )
    .expect("RE_TAG_HASH")
});
static RE_TAG_UPDATED: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(r#"(?si)(?:</span>|·|&nbsp;)\s*(?P<updated>(?:\d+|a|an)\s+\w+\s+ago)"#)
        .expect("RE_TAG_UPDATED")
});
static RE_DESKTOP_BLOCK: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(
        r#"(?si)<div\b[^>]*?class="hidden md:flex[^"]*"[^>]*?>(?P<block>.*?)</div>\s*</div>"#,
    )
    .expect("RE_DESKTOP_BLOCK")
});
static RE_README: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(r#"(?si)id=["']editor["'][^>]*?>(?P<readme>.*?)</textarea\s*>"#)
        .expect("RE_README")
});
static RE_META_DESC: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(
        r#"(?si)<meta\b[^>]*?name=["']description["'][^>]*?content=["'](?P<desc>.*?)["']"#,
    )
    .expect("RE_META_DESC")
});
static RE_LAUNCH_APP: Lazy<regex::Regex> = Lazy::new(|| {
    regex::Regex::new(r#"(?si)<div\b[^>]*?class="[^"]*group flex items-center[^"]*"[^>]*?>.*?<img\b[^>]*?src="(?P<icon>[^"]+)"[^>]*?>.*?<span\b[^>]*?>(?P<name>.*?)</span>.*?<code\b[^>]*?>(?P<command>.*?)</code>"#).expect("RE_LAUNCH_APP")
});

// ── Internal parse helpers (pub(crate) for tests) ────────────────────────────

pub(crate) fn parse_library_html(html: &str) -> Vec<LibraryModel> {
    let mut models = Vec::new();
    for cap in RE_MODEL.captures_iter(html) {
        let slug = cap["slug"].to_string();
        let full_html = &cap[0];

        let name = RE_NAME
            .captures(full_html)
            .map(|c| c["name"].trim().to_owned())
            .unwrap_or_else(|| slug.clone());
        let description = RE_DESC
            .captures(full_html)
            .map(|c| {
                let desc = c["desc"].trim().to_owned();
                decode_html_entities(&desc).into_owned()
            })
            .unwrap_or_default();

        let mut tags = Vec::new();
        for t in RE_TAGS.captures_iter(full_html) {
            let t = t["tag"].trim().to_owned();
            if !t.is_empty() && t.len() < 25 {
                tags.push(t);
            }
        }

        let pull_count = RE_PULLS
            .captures(full_html)
            .map(|c| c["pulls"].trim().to_owned());
        let updated_at = RE_UPDATED
            .captures(full_html)
            .map(|c| c["updated"].trim().to_owned());
        let tag_count = RE_TAG_COUNT
            .captures(full_html)
            .map(|c| c["count"].trim().to_owned());

        models.push(LibraryModel {
            name,
            slug,
            description,
            tags,
            pull_count,
            updated_at,
            tag_count,
        });
    }
    models
}

// ── Public service functions ──────────────────────────────────────────────────

const USER_AGENT: &str =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

fn validate_slug(slug: &str) -> Result<(), AppError> {
    if slug.is_empty()
        || slug.len() > 128
        || !slug
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' || c == ':')
    {
        return Err(AppError::Internal(format!(
            "Invalid model slug: '{}'",
            slug
        )));
    }
    Ok(())
}

pub async fn search(
    client: &reqwest::Client,
    query: &str,
    filter: Option<&str>,
) -> Result<Vec<LibraryModel>, AppError> {
    let is_cloud = filter == Some("cloud");
    let max_pages = if is_cloud { 3 } else { 1 };
    let mut all_models = Vec::new();

    for page in 1..=max_pages {
        let mut params: Vec<(&str, String)> = vec![("q", query.to_owned())];
        if let Some(f) = filter {
            if f == "cloud" {
                params.push(("c", "cloud".to_owned()));
                params.push(("sort", "newest".to_owned()));
            } else {
                params.push(("t", f.to_owned()));
            }
        }
        if page > 1 {
            params.push(("page", page.to_string()));
        }

        let resp = client
            .get("https://ollama.com/search")
            .query(&params)
            .header(reqwest::header::USER_AGENT, USER_AGENT)
            .send()
            .await?;

        if !resp.status().is_success() {
            if page == 1 {
                return Err(AppError::Http(format!(
                    "Ollama library HTTP {}",
                    resp.status()
                )));
            }
            break;
        }

        let html = resp.text().await?;
        let found = parse_library_html(&html);
        if found.is_empty() {
            break;
        }
        all_models.extend(found);
    }

    Ok(all_models)
}

pub async fn get_tags(client: &reqwest::Client, slug: &str) -> Result<Vec<LibraryTag>, AppError> {
    validate_slug(slug)?;
    let url = format!("https://ollama.com/library/{}/tags", slug);
    let resp = client
        .get(&url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Failed to fetch tags: HTTP {}",
            resp.status()
        )));
    }

    let html = resp.text().await?;
    let mut tags = Vec::new();

    // Since the HTML can be complex with nested divs, we'll split by the row start class
    let parts: Vec<&str> = html.split("class=\"group px-4 py-3\"").collect();
    for row in parts.iter().skip(1) {
        // Only parse the desktop block to avoid mobile-only hidden elements
        let target_content = RE_DESKTOP_BLOCK
            .captures(row)
            .map(|c| c["block"].to_string())
            .unwrap_or_else(|| row.to_string());

        if let Some(name_cap) = RE_TAG_NAME.captures(&target_content) {
            let tag_name = name_cap["tag"].to_string();
            // Full name is slug:tag_name
            let name = format!("{}:{}", slug, tag_name);

            // Collect all matches of text-[13px] as they contain Size, Context, Input
            let mut details = Vec::new();
            for d_cap in RE_TAG_DETAILS.captures_iter(&target_content) {
                let val = d_cap["val"].trim();
                // Avoid capturing the raw HTML or long strings
                if !val.contains('<') && val.len() < 30 {
                    details.push(val.to_string());
                }
            }

            let size = details.first().cloned().unwrap_or_else(|| "--".to_string());
            let context = details.get(1).cloned();
            let input = details.get(2).cloned();

            let hash = RE_TAG_HASH
                .captures(&target_content)
                .map(|c| c["hash"].to_string())
                .unwrap_or_default();

            let updated_at = RE_TAG_UPDATED
                .captures(&target_content)
                .map(|c| c["updated"].to_string())
                .unwrap_or_else(|| "unknown".to_string());

            tags.push(LibraryTag {
                name,
                size,
                hash,
                updated_at,
                context,
                input,
            });
        }
    }

    Ok(tags)
}

pub async fn get_readme(
    client: &reqwest::Client,
    slug: &str,
) -> Result<LibraryModelDetails, AppError> {
    validate_slug(slug)?;
    let url = format!("https://ollama.com/library/{}", slug);
    let resp = client
        .get(&url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Failed to fetch model page: HTTP {}",
            resp.status()
        )));
    }

    let html = resp.text().await?;

    // Parse Launch Apps
    let mut launch_apps = Vec::new();
    for cap in RE_LAUNCH_APP.captures_iter(&html) {
        let icon_url = if cap["icon"].starts_with("http") {
            cap["icon"].to_string()
        } else {
            format!("https://ollama.com{}", &cap["icon"])
        };

        launch_apps.push(LaunchApp {
            name: cap["name"].trim().to_string(),
            command: cap["command"].trim().to_string(),
            icon_url,
        });
    }

    // Try primary: the textarea editor
    if let Some(cap) = RE_README.captures(&html) {
        let content = cap["readme"].trim().to_owned();
        if !content.is_empty() {
            return Ok(LibraryModelDetails {
                readme: decode_html_entities(&content).into_owned(),
                launch_apps,
            });
        }
    }

    // Try fallback: meta description
    if let Some(cap) = RE_META_DESC.captures(&html) {
        let content = cap["desc"].trim().to_owned();
        if !content.is_empty() {
            return Ok(LibraryModelDetails {
                readme: decode_html_entities(&content).into_owned(),
                launch_apps,
            });
        }
    }

    Ok(LibraryModelDetails {
        readme: "No detailed documentation provided for this model.".to_string(),
        launch_apps,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn search_returns_parsed_models() {
        let html = r#"
<a href="/library/llama3" class="group flex gap-4">
  <span x-test-search-response-title>Llama 3</span>
  <p class="text-md">A great model</p>
  <span x-test-pull-count>1M</span>
  <span x-test-updated>2 weeks ago</span>
  <span x-test-tag-count>25</span>
</a>"#;
        let models = parse_library_html(html);
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].slug, "llama3");
        assert_eq!(models[0].name, "Llama 3");
        assert_eq!(models[0].description, "A great model");
        assert_eq!(models[0].pull_count.as_deref(), Some("1M"));
    }

    #[tokio::test]
    async fn parse_llama3_1_real_html() {
        let html = r#"
<a href="/library/llama3.1" class="group w-full">
    <div class="flex flex-col mb-1" title="llama3.1">
      <h2 class="truncate text-xl font-medium underline-offset-2 group-hover:underline md:text-2xl">
        <span x-test-search-response-title>llama3.1</span>
      </h2>
      <p class="max-w-lg break-words text-neutral-800 text-md">Llama 3.1 is a new state-of-the-art model from Meta available in 8B, 70B and 405B parameter sizes.</p>
    </div>
    <div class="flex flex-col">
          <span x-test-pull-count>113.7M</span>
          <span x-test-updated>9 months ago</span>
    </div>
</a>"#;
        let models = parse_library_html(html);
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].slug, "llama3.1");
        assert_eq!(models[0].name, "llama3.1");
        assert_eq!(models[0].description, "Llama 3.1 is a new state-of-the-art model from Meta available in 8B, 70B and 405B parameter sizes.");
        assert_eq!(models[0].pull_count.as_deref(), Some("113.7M"));
        assert_eq!(models[0].updated_at.as_deref(), Some("9 months ago"));
    }

    #[tokio::test]
    async fn parse_readme_real_html() {
        let html = r#"
            <textarea
              id="editor"
              name="markdown"
              style="height: 0px"
            >
### Meta Llama 3.1 

**Llama 3.1** family of models available: 
- **8B**
</textarea>"#;
        // Mock capture since it requires complex regex setup
        let cap = RE_README.captures(html).unwrap();
        let readme = cap["readme"].trim();
        assert!(readme.contains("### Meta Llama 3.1"));
        assert!(readme.contains("- **8B**"));
    }

    #[tokio::test]
    async fn parse_readme_complex_html() {
        let html = r#"
            <textarea id="not-this-one">Bad</textarea>
            <div class="header">
                <textarea 
                    name="markdown"
                    class="some-class"
                    id='editor'
                    style="display: block"
                >
Actual README Content
Multiple Lines
</textarea>
            </div>"#;
        let cap = RE_README
            .captures(html)
            .expect("Should match complex textarea");
        let readme = cap["readme"].trim();
        assert_eq!(readme, "Actual README Content\nMultiple Lines");
    }

    #[tokio::test]
    async fn search_returns_empty_on_no_match() {
        let html = "<html><body>nothing here</body></html>";
        let models = parse_library_html(html);
        assert!(models.is_empty());
    }
}
