// IA Pros Santé : activation par code à 12 caractères.
// Le code, saisi au premier lancement, déchiffre un blob embarqué qui
// contient la config client (clé API, profession). Le blob est généré à la
// vente par web-app/scripts/care-make-activation.mjs ; sans le bon code il est
// inexploitable (PBKDF2-SHA256 + AES-256-GCM).

export interface CareActivationPayload {
  api_key: string
  profession: string
  /** Identifiant client libre, pour le support */
  customer?: string
}

export interface CareActivationBlob {
  v: number
  kdf: 'PBKDF2-SHA256'
  iter: number
  salt: string // base64
  iv: string // base64
  data: string // base64 (AES-256-GCM, tag inclus)
}

export const CARE_CODE_LENGTH = 12

// Retire tirets/espaces et met en majuscules : l'utilisateur peut saisir
// "ABCD-EFGH-IJKL" ou "abcd efgh ijkl" indifféremment.
export function normalizeActivationCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

export function formatActivationCode(raw: string): string {
  const code = normalizeActivationCode(raw).slice(0, CARE_CODE_LENGTH)
  return code.replace(/(.{4})(?=.)/g, '$1-')
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function deriveAesKey(
  code: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
}

export class InvalidActivationCodeError extends Error {
  constructor() {
    super('Code d’activation invalide')
    this.name = 'InvalidActivationCodeError'
  }
}

// Déchiffre le blob avec le code fourni. Rejette avec
// InvalidActivationCodeError si le code ne correspond pas (échec GCM).
export async function decryptActivationBlob(
  blob: CareActivationBlob,
  rawCode: string
): Promise<CareActivationPayload> {
  const code = normalizeActivationCode(rawCode)
  if (code.length !== CARE_CODE_LENGTH) throw new InvalidActivationCodeError()

  const key = await deriveAesKey(code, b64ToBytes(blob.salt), blob.iter)
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(blob.iv) as BufferSource },
      key,
      b64ToBytes(blob.data) as BufferSource
    )
  } catch {
    throw new InvalidActivationCodeError()
  }

  const payload = JSON.parse(
    new TextDecoder().decode(plaintext)
  ) as CareActivationPayload
  if (typeof payload.api_key !== 'string' || !payload.profession) {
    throw new InvalidActivationCodeError()
  }
  return payload
}
