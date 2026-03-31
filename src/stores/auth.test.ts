import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args)
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockInvoke.mockReset()
  })

  it('login updates user and authenticated status', async () => {
    const authStore = useAuthStore()
    
    // Backend returns null/void on success
    mockInvoke.mockResolvedValueOnce(null) // login
    mockInvoke.mockResolvedValueOnce(true) // get_auth_status

    await authStore.login('host1', 'token123')

    expect(mockInvoke).toHaveBeenCalledWith('login', { hostId: 'host1', token: 'token123' })
    expect(mockInvoke).toHaveBeenCalledWith('get_auth_status', { hostId: 'host1' })
    expect(authStore.user?.username).toBe('Ollama User')
    expect(authStore.authenticatedHosts['host1']).toBe(true)
  })

  it('logout clears authenticated status and user if no hosts left', async () => {
    const authStore = useAuthStore()
    authStore.authenticatedHosts = { 'host1': true }
    authStore.user = { id: 'user1', username: 'testuser' }

    mockInvoke.mockResolvedValue(null)

    await authStore.logout('host1')

    expect(mockInvoke).toHaveBeenCalledWith('logout', { hostId: 'host1' })
    expect(authStore.authenticatedHosts['host1']).toBe(false)
    expect(authStore.user).toBeNull()
  })

})
