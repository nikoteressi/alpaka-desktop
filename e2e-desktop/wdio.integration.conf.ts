import path from 'path'
import { fileURLToPath } from 'url'
import type { Options, Capabilities } from '@wdio/types'
import { startTauriDriver, stopTauriDriver } from './helpers/tauri-driver.js'
import { clearTestDataDir } from './fixtures/db.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const APP_BINARY = path.resolve(__dirname, '../src-tauri/target/release/alpaka-desktop')
const OLLAMA_URL = 'http://localhost:11434'

export const config: Options.Testrunner & Capabilities.WithRequestedTestrunnerCapabilities = {
  runner: 'local',
  specs: ['./integration/**/*.spec.ts'],
  maxInstances: 1,
  capabilities: [
    {
      'wdio:maxInstances': 1,
      browserName: 'wry',
      'wdio:enforceWebDriverClassic': true,
      'tauri:options': {
        application: APP_BINARY,
      },
    },
  ],
  logLevel: 'warn',
  hostname: '127.0.0.1',
  port: 4444,
  path: '/',
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  async onPrepare() {
    const res = await fetch(`${OLLAMA_URL}/api/tags`).catch(() => null)
    if (!res || !res.ok) {
      throw new Error(
        `Ollama is not running at ${OLLAMA_URL}. Start it with: ollama serve`
      )
    }
    clearTestDataDir()
    return startTauriDriver()
  },
  onComplete() {
    return stopTauriDriver()
  },
}
