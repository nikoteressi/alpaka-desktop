---
layout: home
---

<LinearHero>
  <template #title>Install Alpaka</template>
  <template #tagline>
    Alpaka is distributed as a native <span class="text-vp-c-text-1 font-medium">AppImage</span>, through our official <span class="text-vp-c-text-1 font-medium">APT repository</span>, and via the Arch User Repository. Choose the method that best fits your workflow.
  </template>
  <template #actions>
    <a href="https://github.com/nikoteressi/alpaka-desktop/releases/latest" class="btn-linear group">
      <div class="btn-linear-inner flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="7 10 12 15 17 10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Download AppImage
      </div>
    </a>
    <a href="https://github.com/nikoteressi/alpaka-desktop" class="px-5 py-2 rounded-full border border-[var(--vp-c-border)] hover:border-[var(--vp-c-brand-1)] text-[14px] font-medium transition-all bg-[var(--vp-c-bg)] flex items-center gap-2">
      View Releases
    </a>
  </template>
</LinearHero>

<div class="max-w-4xl mx-auto px-6 mb-16">
  <div class="grid sm:grid-cols-2 gap-4">

<SpotlightCard>
  <div class="w-10 h-10 rounded-lg bg-[var(--vp-c-bg-soft)] border border-[var(--vp-c-border)] flex items-center justify-center mb-4 text-[var(--vp-c-brand-1)]">
    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
  </div>
  <h3 class="text-[15px] font-semibold text-[var(--vp-c-text-1)] mb-2">Native Performance</h3>
  <p class="text-[14px] text-[var(--vp-c-text-2)] leading-relaxed">Built on Tauri v2 and Rust, consuming significantly less memory than Electron-based alternatives.</p>
</SpotlightCard>

<SpotlightCard>
  <div class="w-10 h-10 rounded-lg bg-[var(--vp-c-bg-soft)] border border-[var(--vp-c-border)] flex items-center justify-center mb-4 text-[var(--vp-c-brand-1)]">
    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
  </div>
  <h3 class="text-[15px] font-semibold text-[var(--vp-c-text-1)] mb-2">System Integrated</h3>
  <p class="text-[14px] text-[var(--vp-c-text-2)] leading-relaxed">Deep integration with KWallet and GNOME Keyring for secure credential storage.</p>
</SpotlightCard>

<SpotlightCard>
  <div class="w-10 h-10 rounded-lg bg-[var(--vp-c-bg-soft)] border border-[var(--vp-c-border)] flex items-center justify-center mb-4 text-[var(--vp-c-brand-1)]">
    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
  </div>
  <h3 class="text-[15px] font-semibold text-[var(--vp-c-text-1)] mb-2">Multi-Host Sync</h3>
  <p class="text-[14px] text-[var(--vp-c-text-2)] leading-relaxed">Add multiple Ollama endpoints, monitor health status, and switch between them instantly.</p>
</SpotlightCard>

<SpotlightCard>
  <div class="w-10 h-10 rounded-lg bg-[var(--vp-c-bg-soft)] border border-[var(--vp-c-border)] flex items-center justify-center mb-4 text-[var(--vp-c-brand-1)]">
    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
  </div>
  <h3 class="text-[15px] font-semibold text-[var(--vp-c-text-1)] mb-2">Thinking Blocks</h3>
  <p class="text-[14px] text-[var(--vp-c-text-2)] leading-relaxed">Collapsible panels for models that expose chain-of-thought reasoning (e.g. DeepSeek-R1).</p>
</SpotlightCard>

  </div>
</div>

<div class="max-w-4xl mx-auto px-6 mb-16">
  <h2 class="text-2xl font-semibold mb-6 text-[var(--vp-c-text-1)]">Package Managers</h2>
  
  <AnimatedTabs :tabs="['Debian / Ubuntu', 'Arch Linux', 'Source']">
    <template #tab-0>
      <div class="language-bash vp-adaptive-theme">
        <span class="lang">bash</span>
        <pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 1. Import signing key</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#79B8FF;">sudo</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> mkdir -p /etc/apt/keyrings</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">curl</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> -fsSL https://nikoteressi.github.io/alpaka-desktop/apt/key.gpg \</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  | </span><span style="--shiki-light:#D73A49;--shiki-dark:#79B8FF;">sudo</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> tee /etc/apt/keyrings/alpaka-desktop.asc > /dev/null</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 2. Add repository</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">echo</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> "deb [arch=amd64 signed-by=/etc/apt/keyrings/alpaka-desktop.asc] \</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">  https://nikoteressi.github.io/alpaka-desktop/apt stable main"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> \</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  | </span><span style="--shiki-light:#D73A49;--shiki-dark:#79B8FF;">sudo</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> tee /etc/apt/sources.list.d/alpaka-desktop.list</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 3. Install</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#79B8FF;">sudo</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> apt update && </span><span style="--shiki-light:#D73A49;--shiki-dark:#79B8FF;">sudo</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> apt install alpaka-desktop</span></span></code></pre>
      </div>
    </template>
    <template #tab-1>
      <div class="language-bash vp-adaptive-theme">
        <span class="lang">bash</span>
        <pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Install via AUR helper (e.g., yay or paru)</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">yay</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> -S alpaka-desktop-bin</span></span></code></pre>
      </div>
    </template>
    <template #tab-2>
      <div class="language-bash vp-adaptive-theme">
        <span class="lang">bash</span>
        <pre class="shiki shiki-themes github-light github-dark vp-code"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Prerequisites: Node.js, pnpm, Rust, Tauri dependencies</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">git</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> clone https://github.com/nikoteressi/alpaka-desktop.git</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">cd</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> alpaka-desktop</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Install JS dependencies</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">pnpm</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> install</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Build the application</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">pnpm</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> tauri build</span></span></code></pre>
      </div>
    </template>
  </AnimatedTabs>
</div>

<style>
/* Linear button styles scoped to this page */
.btn-linear {
  position: relative;
  border-radius: 9999px;
  padding: 1px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 100%);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
  display: inline-block;
}
.btn-linear-inner {
  background: var(--vp-c-bg-elv);
  border-radius: 9999px;
  padding: 8px 24px;
  font-weight: 500;
  font-size: 14px;
  color: var(--vp-c-text-1);
  transition: background 0.2s ease;
}
.btn-linear:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(130, 81, 238, 0.3);
}
html:not(.dark) .btn-linear { background: var(--vp-c-brand-1); }
html:not(.dark) .btn-linear-inner { background: var(--vp-c-brand-1); color: white; }
html:not(.dark) .btn-linear:hover { box-shadow: 0 4px 15px rgba(130, 81, 238, 0.4); }
</style>
