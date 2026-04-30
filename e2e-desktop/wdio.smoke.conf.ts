import path from 'path'
import type { Options } from '@wdio/types'
import { startTauriDriver, stopTauriDriver } from './helpers/tauri-driver'
import { clearTestDb } from './fixtures/db'

const APP_BINARY = path.resolve(__dirname, '../src-tauri/target/release/alpaka-desktop')

export const config: Options.Testrunner = {
  runner: 'local',
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: path.resolve(__dirname, 'tsconfig.json'),
      transpileOnly: true,
    },
  },
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
