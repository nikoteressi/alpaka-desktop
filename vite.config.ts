/// <reference types="vitest/config" />
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
      include: ['src/**/*.{ts,vue}'],
      // Measured on vitest 4 (AST-aware v8 remapping), rounded down. vitest 2
      // reported never-imported .vue files as 100% covered, inflating the old
      // 80/80/75/80 baseline.
      thresholds: { lines: 79, functions: 71, branches: 69, statements: 77 },
      exclude: [
        '**/*.config.{ts,js}',
        'src/main.ts',
        'src/router/**',
        'src/types/**',
        '**/*.d.ts',
        'src/**/*.{spec,test}.{ts,js}',
      ],
    },
  }
})
