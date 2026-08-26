import { useState } from 'react'
import { IconFileMusic, IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getServiceHub } from '@/hooks/useServiceHub'
import { transcribeAudioFile } from '@/care/whisper'
import { progressLabel, useWhisperInstall } from '@/care/useWhisperInstall'

// IA Pros Santé : « Joindre un audio » dans les formulaires de Projet.
// L'enregistrement (dictaphone, mémo du téléphone…) est transcrit en local
// par whisper.cpp puis inséré dans le champ texte. Au premier usage, le
// module de transcription est téléchargé une fois pour toutes.

type Step = 'idle' | 'needs-install' | 'installing' | 'transcribing'

const AUDIO_FILTERS = [
  { name: 'Audio', extensions: ['wav', 'mp3', 'm4a', 'ogg', 'flac'] },
]

export function CareAudioTranscribeButton({
  onText,
}: {
  onText: (text: string) => void
}) {
  const [step, setStep] = useState<Step>('idle')
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const { isReady, install, progress } = useWhisperInstall()

  const transcribe = async (path: string) => {
    setStep('transcribing')
    try {
      const text = await transcribeAudioFile(path)
      if (text) {
        onText(text)
        toast.success('Audio transcrit')
      } else {
        toast.info("Aucune parole détectée dans l'audio")
      }
    } catch (err) {
      console.error('[care] échec de transcription :', err)
      toast.error('Impossible de transcrire cet audio', {
        description: String(err),
      })
    } finally {
      setStep('idle')
      setPendingPath(null)
    }
  }

  const handlePick = async () => {
    const picked = await getServiceHub()
      .dialog()
      .open({ multiple: false, filters: AUDIO_FILTERS })
    const path = Array.isArray(picked) ? picked[0] : picked
    if (!path) return
    try {
      if (await isReady()) {
        await transcribe(path)
      } else {
        setPendingPath(path)
        setStep('needs-install')
      }
    } catch (err) {
      console.error('[care] statut whisper indisponible :', err)
      toast.error('Transcription indisponible', { description: String(err) })
    }
  }

  const handleInstall = async () => {
    setStep('installing')
    try {
      await install()
      if (pendingPath) await transcribe(pendingPath)
      else setStep('idle')
    } catch (err) {
      console.error('[care] échec du provisionnement whisper :', err)
      toast.error("Impossible d'installer la transcription", {
        description: String(err),
      })
      setStep('idle')
      setPendingPath(null)
    }
  }

  const buttonClass = cn(
    'inline-flex items-center gap-1.5 text-xs text-main-view-fg/60',
    'hover:text-main-view-fg transition-colors'
  )

  if (step === 'needs-install') {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-main-view-fg/60">
          La transcription locale doit d'abord être installée (~750 Mo, une
          seule fois).
        </span>
        <button type="button" className="underline" onClick={handleInstall}>
          Installer
        </button>
        <button
          type="button"
          className="text-main-view-fg/50"
          onClick={() => {
            setStep('idle')
            setPendingPath(null)
          }}
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

  return (
    <button type="button" className={buttonClass} onClick={handlePick}>
      <IconFileMusic className="size-3.5" />
      Joindre un audio (transcrit sur place)
    </button>
  )
}
