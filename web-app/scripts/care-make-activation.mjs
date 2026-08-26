#!/usr/bin/env node
// IA Pros Santé : génère un blob d'activation chiffré (et le code associé).
// Usage :
//   node scripts/care-make-activation.mjs --api-key sk-... --profession ergotherapeute \
//     [--customer "Cabinet X"] [--code ABCD-EFGH-IJKL] [--out src/care/activation.blob.json]
// Sans --code, un code aléatoire est généré (alphabet sans caractères ambigus).
// Le code est affiché sur stderr : c'est lui qu'on remet au client, il n'est
// stocké nulle part.

import { webcrypto as crypto } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const getArg = (name) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 ? args[i + 1] : undefined
}

const apiKey = getArg('api-key')
const profession = getArg('profession')
const customer = getArg('customer')
const out = getArg('out')
let code = getArg('code')

if (!apiKey || !profession) {
  console.error(
    'Usage: node care-make-activation.mjs --api-key <clé> --profession <slug> [--customer <nom>] [--code <12 car.>] [--out <fichier>]'
  )
  process.exit(1)
}

// Alphabet sans ambigus (pas de 0/O, 1/I/L) — dicté au téléphone sans erreur.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 12

if (code) {
  code = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (code.length !== CODE_LENGTH) {
    console.error(`Le code doit faire ${CODE_LENGTH} caractères (hors tirets).`)
    process.exit(1)
  }
} else {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  code = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

const ITERATIONS = 300000
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
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
  material,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt']
)

const payload = { api_key: apiKey, profession, ...(customer && { customer }) }
const data = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode(JSON.stringify(payload))
)

const b64 = (buf) => Buffer.from(buf).toString('base64')
const blob = {
  v: 1,
  kdf: 'PBKDF2-SHA256',
  iter: ITERATIONS,
  salt: b64(salt),
  iv: b64(iv),
  data: b64(data),
}

const json = JSON.stringify(blob, null, 2) + '\n'
if (out) {
  writeFileSync(out, json)
  console.error(`Blob écrit dans ${out}`)
} else {
  process.stdout.write(json)
}
console.error(`Code d'activation : ${code.replace(/(.{4})(?=.)/g, '$1-')}`)
