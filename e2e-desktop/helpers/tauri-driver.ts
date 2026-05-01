import { spawn, ChildProcess } from 'child_process'

let tauriDriver: ChildProcess | undefined

process.on('exit', () => { tauriDriver?.kill('SIGKILL') })
process.on('SIGINT', () => { tauriDriver?.kill('SIGKILL'); process.exit(1) })

export async function startTauriDriver(): Promise<void> {
  tauriDriver = spawn('tauri-driver', [], {
    stdio: ['ignore', process.stdout, process.stderr],
  })

  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://localhost:4444/status')
      if (res.ok) return
    } catch {
      // not ready yet
    }
    await new Promise<void>((r) => setTimeout(r, 100))
  }
  throw new Error('tauri-driver did not become ready within 10s')
}

export async function stopTauriDriver(): Promise<void> {
  if (tauriDriver) {
    tauriDriver.kill()
    tauriDriver = undefined
  }
}
