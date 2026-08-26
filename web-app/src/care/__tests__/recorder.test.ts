import { describe, it, expect } from 'vitest'
import { bytesToBase64, downsampleTo16k, encodeWav } from '../recorder'

const ascii = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length))

describe('encodeWav', () => {
  it('writes a valid mono 16-bit PCM header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1])
    const wav = encodeWav(samples, 16000)
    const view = new DataView(wav.buffer)

    expect(wav.length).toBe(44 + samples.length * 2)
    expect(ascii(wav, 0, 4)).toBe('RIFF')
    expect(ascii(wav, 8, 4)).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(34, true)).toBe(16) // bits
    expect(view.getUint32(40, true)).toBe(samples.length * 2)
  })

  it('clamps samples outside [-1, 1]', () => {
    const wav = encodeWav(new Float32Array([2, -2]), 16000)
    const view = new DataView(wav.buffer)
    expect(view.getInt16(44, true)).toBe(32767)
    expect(view.getInt16(46, true)).toBe(-32767)
  })
})

describe('downsampleTo16k', () => {
  it('returns the input untouched at 16 kHz', () => {
    const samples = new Float32Array([0.1, 0.2])
    expect(downsampleTo16k(samples, 16000)).toBe(samples)
  })

  it('halves the sample count from 32 kHz', () => {
    const samples = new Float32Array(3200)
    expect(downsampleTo16k(samples, 32000).length).toBe(1600)
  })
})

describe('bytesToBase64', () => {
  it('encodes bytes like btoa on a binary string', () => {
    expect(bytesToBase64(new Uint8Array([72, 101, 108, 108, 111]))).toBe(
      btoa('Hello')
    )
  })
})
