import { existsSync, rmSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const TEST_APP_ID = 'io.alpaka.desktop.test'

export function getTestDataDir(): string {
  return join(homedir(), '.local', 'share', TEST_APP_ID)
}

export function clearTestDb(): void {
  const base = join(getTestDataDir(), 'alpaka-desktop.db')
  for (const suffix of ['', '-wal', '-shm']) {
    const f = base + suffix
    if (existsSync(f)) rmSync(f)
  }
}

export function clearTestDataDir(): void {
  const dataDir = getTestDataDir()
  if (existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true, force: true })
  }
}
