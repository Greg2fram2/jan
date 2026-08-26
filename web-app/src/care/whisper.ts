import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getServiceHub } from '@/hooks/useServiceHub'

// IA Pros Santé : façade de la transcription locale whisper.cpp (doc §4).
// Le binaire et le modèle sont téléchargés au premier usage par le backend
// (care_provision_whisper) ; l'audio ne quitte jamais le poste.

export interface WhisperStatus {
  binaryPresent: boolean
  modelPresent: boolean
  dir: string
}

export interface WhisperProgress {
  stage: 'binary' | 'model'
  downloaded: number
  total: number
}

// Doc §4 : « large-v3-turbo ou medium selon la RAM détectée ». On reste dans
// la famille large-v3-turbo : la variante quantifiée q5_0 (~574 Mo) est plus
// précise et plus rapide que medium tout en tenant sur les 8 Go du parc réel.
export function whisperModelForRam(totalMemoryMib: number): string {
  return totalMemoryMib >= 12 * 1024 ? 'large-v3-turbo' : 'large-v3-turbo-q5_0'
}

let cachedModel: string | null = null

export async function currentWhisperModel(): Promise<string> {
  if (cachedModel) return cachedModel
  const hardware = await getServiceHub()
    .hardware()
    .getHardwareInfo()
    .catch(() => null)
  cachedModel = whisperModelForRam(hardware?.total_memory ?? 0)
  return cachedModel
}

export async function whisperStatus(): Promise<WhisperStatus> {
  const model = await currentWhisperModel()
  return invoke<WhisperStatus>('care_whisper_status', { model })
}

// Télécharge binaire + modèle si absents. onProgress reçoit l'avancement
// (émis par le backend tous les ~5 Mo).
export async function provisionWhisper(
  onProgress?: (progress: WhisperProgress) => void
): Promise<WhisperStatus> {
  const model = await currentWhisperModel()
  let unlisten: UnlistenFn | undefined
  if (onProgress) {
    unlisten = await listen<WhisperProgress>('care:whisper-progress', (event) =>
      onProgress(event.payload)
    )
  }
  try {
    return await invoke<WhisperStatus>('care_provision_whisper', { model })
  } finally {
    unlisten?.()
  }
}

// Transcrit un fichier audio (wav, mp3, ogg, flac) et renvoie le texte brut.
export async function transcribeAudioFile(path: string): Promise<string> {
  const model = await currentWhisperModel()
  return invoke<string>('care_transcribe', { path, model, language: 'fr' })
}
