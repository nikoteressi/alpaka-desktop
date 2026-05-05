/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  test: {
    environment: 'happy-dom',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/e2e/**',
      '**/e2e-desktop/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/.tabs/**',
      '**/.worktrees/**',
      '**/.claude/worktrees/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 70, functions: 70, branches: 65, statements: 70 },
      exclude: [
        '**/*.config.{ts,js}',
        'src/main.ts',
        'src/router/**',
        'src/types/**',
        '**/*.d.ts',
      ],
    },
  }
})
