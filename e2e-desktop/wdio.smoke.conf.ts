import path from 'path'
import { fileURLToPath } from 'url'
import type { Options } from '@wdio/types'
import { startTauriDriver, stopTauriDriver } from './helpers/tauri-driver.js'
import { clearTestDb } from './fixtures/db.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const APP_BINARY = path.resolve(__dirname, '../src-tauri/target/release/alpaka-desktop')

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./smoke/**/*.spec.ts'],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      browserName: 'wry',
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
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 30000,
  },
  onPrepare() {
    clearTestDb()
    return startTauriDriver()
  },
  onComplete() {
    return stopTauriDriver()
  },
}
