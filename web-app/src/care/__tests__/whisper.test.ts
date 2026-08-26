import { describe, it, expect, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('@/hooks/useServiceHub', () => ({ getServiceHub: vi.fn() }))

import { whisperModelForRam } from '../whisper'

describe('whisperModelForRam', () => {
  it('uses the full large-v3-turbo model from 12 GiB of RAM', () => {
    expect(whisperModelForRam(16 * 1024)).toBe('large-v3-turbo')
    expect(whisperModelForRam(12 * 1024)).toBe('large-v3-turbo')
  })

  it('falls back to the q5_0 quantized variant below 12 GiB', () => {
    // 8 Go : le PC de cabinet type (doc §6)
    expect(whisperModelForRam(8 * 1024)).toBe('large-v3-turbo-q5_0')
    expect(whisperModelForRam(0)).toBe('large-v3-turbo-q5_0')
  })
})
