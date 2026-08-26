import { describe, it, expect } from 'vitest'
import {
  decryptActivationBlob,
  formatActivationCode,
  normalizeActivationCode,
  InvalidActivationCodeError,
} from '../activation'
import type { CareActivationBlob, CareActivationPayload } from '../activation'

// Chiffre un payload comme le fait scripts/care-make-activation.mjs, pour
// vérifier le déchiffrement côté app avec le même format de blob.
async function makeBlob(
  payload: CareActivationPayload,
  code: string
): Promise<CareActivationBlob> {
  const iterations = 1000 // rapide en test ; la prod utilise 300000
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  )
  const b64 = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
  return {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iter: iterations,
    salt: b64(salt),
    iv: b64(iv),
    data: b64(data),
  }
}

describe('normalizeActivationCode', () => {
  it('strips separators and uppercases', () => {
    expect(normalizeActivationCode('abcd-efgh 2345')).toBe('ABCDEFGH2345')
  })
})

describe('formatActivationCode', () => {
  it('groups by 4 with dashes and caps at 12 chars', () => {
    expect(formatActivationCode('abcdefgh2345XYZ')).toBe('ABCD-EFGH-2345')
  })
})

describe('decryptActivationBlob', () => {
  const payload: CareActivationPayload = {
    api_key: 'sk-test-123',
    profession: 'ergotherapeute',
    customer: 'Cabinet X',
  }

  it('decrypts with the right code, dashes or not', async () => {
    const blob = await makeBlob(payload, 'ERGOTEST2026')
    await expect(decryptActivationBlob(blob, 'ERGO-TEST-2026')).resolves.toEqual(
      payload
    )
    await expect(decryptActivationBlob(blob, 'ergotest2026')).resolves.toEqual(
      payload
    )
  })

  it('rejects a wrong code', async () => {
    const blob = await makeBlob(payload, 'ERGOTEST2026')
    await expect(
      decryptActivationBlob(blob, 'ERGO-TEST-9999')
    ).rejects.toBeInstanceOf(InvalidActivationCodeError)
  })

  it('rejects a code of the wrong length', async () => {
    const blob = await makeBlob(payload, 'ERGOTEST2026')
    await expect(decryptActivationBlob(blob, 'ERGO')).rejects.toBeInstanceOf(
      InvalidActivationCodeError
    )
  })
})
