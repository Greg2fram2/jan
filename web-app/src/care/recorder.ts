// IA Pros Santé : enregistrement micro → WAV 16 kHz mono, pour la dictée
// vocale transcrite en local par whisper.cpp. Tout reste sur le poste.

const TARGET_RATE = 16000

// Rééchantillonnage linéaire (suffisant pour de la voix destinée à whisper).
export function downsampleTo16k(
  samples: Float32Array,
  fromRate: number
): Float32Array {
  if (fromRate === TARGET_RATE) return samples
  const ratio = fromRate / TARGET_RATE
  const length = Math.floor(samples.length / ratio)
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const position = i * ratio
    const index = Math.floor(position)
    const fraction = position - index
    const next = samples[index + 1] ?? samples[index]
    out[i] = samples[index] * (1 - fraction) + next * fraction
  }
  return out
}

// WAV PCM 16 bits mono. Format minimal accepté partout, whisper compris.
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataLength = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // taille du bloc fmt
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // octets/s
  view.setUint16(32, 2, true) // octets par échantillon
  view.setUint16(34, 16, true) // bits par échantillon
  writeAscii(36, 'data')
  view.setUint32(40, dataLength, true)

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true)
  }
  return new Uint8Array(buffer)
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

// Enregistreur micro. start() ouvre le micro, stop() rend le WAV encodé.
export class CareRecorder {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private chunks: Float32Array[] = []

  async start(): Promise<void> {
    this.chunks = []
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
    // WebView2 (Chromium) rééchantillonne lui-même vers 16 kHz.
    this.context = new AudioContext({ sampleRate: TARGET_RATE })
    this.source = this.context.createMediaStreamSource(this.stream)
    this.processor = this.context.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (event) => {
      this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
    }
    this.source.connect(this.processor)
    // Sans sortie connectée le processor ne tourne pas ; l'output reste
    // silencieux (on n'écrit rien dans outputBuffer), donc pas d'écho.
    this.processor.connect(this.context.destination)
  }

  async stop(): Promise<Uint8Array> {
    const rate = this.context?.sampleRate ?? TARGET_RATE
    this.processor?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    await this.context?.close()

    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const samples = new Float32Array(total)
    let offset = 0
    for (const chunk of this.chunks) {
      samples.set(chunk, offset)
      offset += chunk.length
    }

    this.stream = null
    this.context = null
    this.processor = null
    this.source = null
    this.chunks = []

    return encodeWav(downsampleTo16k(samples, rate), TARGET_RATE)
  }
}
