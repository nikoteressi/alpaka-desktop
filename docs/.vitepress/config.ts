import { defineConfig } from 'vitepress'
import { createRequire } from 'module'
import tailwindcss from '@tailwindcss/vite'
import { withMermaid } from 'vitepress-plugin-mermaid'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json') as { version: string }

const base = '/alpaka-desktop/'

export default withMermaid(defineConfig({
  title: 'Alpaka Desktop',
  description: 'Native desktop client for Ollama — built with Tauri v2 and Vue 3',
  base,
  appearance: 'dark',
  cleanUrls: true,

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['mermaid', 'dayjs'],
    },
  },

  srcExclude: ['ARCHITECTURE.md', 'PRODUCT_SPEC.md'],

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: `${base}logo.png` }],
  ],

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'Alpaka Desktop',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'Developer', link: '/dev/', activeMatch: '/dev/' },
      {
        text: `v${pkg.version}`,
        items: [
          {
            text: 'Changelog',
            link: 'https://github.com/nikoteressi/alpaka-desktop/releases',
          },
          {
            text: 'GitHub',
            link: 'https://github.com/nikoteressi/alpaka-desktop',
          },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [{ text: 'Introduction', link: '/guide/' }],
        },
        {
          text: 'Features',
          items: [
            { text: 'Chat', link: '/guide/chat' },
            { text: 'Models', link: '/guide/models' },
            { text: 'Settings', link: '/guide/settings' },
            { text: 'Ollama Cloud', link: '/guide/cloud' },
            { text: 'Multi-Host', link: '/guide/multi-host' },
            { text: 'System Integration', link: '/guide/system' },
            { text: 'Keyboard Shortcuts', link: '/guide/keyboard' },
          ],
        },
      ],
      '/dev/': [
        {
          text: 'Developer Reference',
          items: [
            { text: 'Architecture', link: '/dev/' },
            { text: 'Backend', link: '/dev/backend' },
            { text: 'Frontend', link: '/dev/frontend' },
            { text: 'Contributing', link: '/dev/contributing' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nikoteressi/alpaka-desktop' },
    ],

    search: { provider: 'local' },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Alpaka Desktop Contributors',
    },
  },
}))
