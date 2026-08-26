import { useRef, useState } from 'react'
import {
  IconLoader2,
  IconMicrophone,
  IconPlayerStopFilled,
} from '@tabler/icons-react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CareRecorder, bytesToBase64 } from '@/care/recorder'
import { transcribeAudioFile, whisperStatus } from '@/care/whisper'
import { progressLabel, useWhisperInstall } from '@/care/useWhisperInstall'

// IA Pros Santé : dictée au micro dans les formulaires de Projet. Le son est
// enregistré en WAV 16 kHz, transcrit en local par whisper.cpp, puis le texte
// est inséré dans le champ. Rien ne quitte le poste.

type Step = 'idle' | 'recording' | 'needs-install' | 'installing' | 'transcribing'

export function CareDictationButton({
  onText,
}: {
  onText: (text: string) => void
}) {
  const [step, setStep] = useState<Step>('idle')
  const recorderRef = useRef<CareRecorder | null>(null)
  const { isReady, install, progress } = useWhisperInstall()

  const startRecording = async () => {
    try {
      if (!(await isReady())) {
        setStep('needs-install')
        return
      }
    } catch (err) {
      console.error('[care] statut whisper indisponible :', err)
      toast.error('Dictée indisponible', { description: String(err) })
      return
    }
    const recorder = new CareRecorder()
    try {
      await recorder.start()
    } catch (err) {
      console.error('[care] accès micro refusé :', err)
      toast.error("Impossible d'accéder au micro")
      return
    }
    recorderRef.current = recorder
    setStep('recording')
  }

  const stopAndTranscribe = async () => {
    const recorder = recorderRef.current
    if (!recorder) return
    recorderRef.current = null
    setStep('transcribing')
    try {
      const wav = await recorder.stop()
      const status = await whisperStatus()
      const path = `${status.dir}/dictee.wav`
      await invoke('write_file_base64', { args: [path, bytesToBase64(wav)] })
      const text = await transcribeAudioFile(path)
      if (text) {
        onText(text)
        toast.success('Dictée transcrite')
      } else {
        toast.info('Aucune parole détectée')
      }
    } catch (err) {
      console.error('[care] échec de la dictée :', err)
      toast.error('Impossible de transcrire la dictée', {
        description: String(err),
      })
    } finally {
      setStep('idle')
    }
  }

  const handleInstall = async () => {
    setStep('installing')
    try {
      await install()
      toast.success('Transcription installée', {
        description: 'Cliquez à nouveau sur le micro pour dicter.',
      })
    } catch (err) {
      console.error('[care] échec du provisionnement whisper :', err)
      toast.error("Impossible d'installer la transcription", {
        description: String(err),
      })
    } finally {
      setStep('idle')
    }
  }

  if (step === 'needs-install') {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-main-view-fg/60">
          La transcription locale doit d'abord être installée (~600 Mo, une
          seule fois).
        </span>
        <button type="button" className="underline" onClick={handleInstall}>
          Installer
        </button>
        <button
          type="button"
          className="text-main-view-fg/50"
          onClick={() => setStep('idle')}
        >
          Annuler
        </button>
      </span>
    )
  }

  if (step === 'installing' || step === 'transcribing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-main-view-fg/60">
        <IconLoader2 className="size-3.5 animate-spin" />
        {step === 'installing' ? progressLabel(progress) : 'Transcription en cours…'}
      </span>
    )
  }

  if (step === 'recording') {
    return (
      <button
        type="button"
        onClick={stopAndTranscribe}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs text-destructive',
          'hover:opacity-80 transition-opacity'
        )}
      >
        <IconPlayerStopFilled className="size-3.5 animate-pulse" />
        Arrêter la dictée
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-main-view-fg/60',
        'hover:text-main-view-fg transition-colors'
      )}
    >
      <IconMicrophone className="size-3.5" />
      Dicter
    </button>
  )
}
