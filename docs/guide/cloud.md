# Ollama Cloud

Alpaka Desktop supports [Ollama Cloud](https://ollama.com) for running models hosted on Ollama's infrastructure, in addition to local models.

## Signing In

1. Go to **Settings → Account**.
2. Click **Sign in with Ollama**. The app polls for an OAuth token — your browser opens the Ollama sign-in page.
3. Complete sign-in in the browser. The app detects the token automatically and stores it in the system keyring.

Your account status is shown in **Settings → Account**.

## API Key

For programmatic access or Ollama Cloud model pull requests, you may need an API key:

1. Go to **Settings → Account → API Keys**.
2. Paste your Ollama Cloud API key.
3. Click **Save**. The key is validated against the API and stored in the system keyring — never in SQLite.
4. Click the trash icon to remove a saved key.

## Cloud Models

Once signed in, Ollama Cloud models appear in the **Models → Library** tab alongside public models. Cloud models run on Ollama's infrastructure — you do not need to pull them locally.

All requests to `api.ollama.com` hosts automatically include the `Authorization: Bearer` header using your stored API key. If the key is missing, a friendly error appears in the chat instead of a raw network failure.

## Privacy

Your conversations with local models never leave your machine. Conversations routed to Ollama Cloud hosts are subject to Ollama's privacy policy.
