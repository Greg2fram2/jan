import { useState } from 'react'
import {
  provisionWhisper,
  whisperStatus,
  type WhisperProgress,
} from '@/care/whisper'

// IA Pros Santé : flux d'installation de la transcription locale, partagé
// entre « Joindre un audio » et la dictée au micro. Le téléchargement
// (binaire + modèle) n'a lieu qu'une fois, au premier usage.

export function progressLabel(progress: WhisperProgress | null): string {
  if (!progress) return 'Installation de la transcription…'
  const what =
    progress.stage === 'model' ? 'du modèle de transcription' : 'du module'
  if (!progress.total) return `Téléchargement ${what}…`
  const percent = Math.min(
    100,
    Math.round((progress.downloaded / progress.total) * 100)
  )
  return `Téléchargement ${what}… ${percent} %`
}

export function useWhisperInstall() {
  const [progress, setProgress] = useState<WhisperProgress | null>(null)

  // true si binaire + modèle sont déjà en place
  const isReady = async (): Promise<boolean> => {
    const status = await whisperStatus()
    return status.binaryPresent && status.modelPresent
  }

  const install = async (): Promise<void> => {
    setProgress(null)
    await provisionWhisper(setProgress)
  }

  return { isReady, install, progress }
}
