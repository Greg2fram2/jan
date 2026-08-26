import { useState } from 'react'
import { KeyRoundIcon } from 'lucide-react'
import {
  CARE_CODE_LENGTH,
  formatActivationCode,
  normalizeActivationCode,
} from '@/care/activation'
import { useCareActivation } from '@/care/useCareActivation'
import { cn } from '@/lib/utils'

// IA Pros Santé : premier lancement. Le code à 12 caractères fourni à l'achat
// déchiffre la config client (profession, clé API) et active l'application.
export default function CareActivationScreen() {
  const activate = useCareActivation((s) => s.activate)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const complete = normalizeActivationCode(code).length === CARE_CODE_LENGTH

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !complete) return
    setBusy(true)
    setError(null)
    try {
      await activate(code)
      // Le gate parent (accueil) bascule vers la grille dès que le store change.
    } catch {
      setError(
        'Ce code ne correspond pas. Vérifiez la saisie (12 caractères, fournis à l’achat).'
      )
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-main-view-fg/5">
          <KeyRoundIcon className="size-6 text-main-view-fg/70" />
        </div>
        <h1 className="text-xl font-studio font-medium">
          Activer IA Pros Santé
        </h1>
        <p className="text-sm text-main-view-fg/60 mt-2">
          Saisissez le code d&rsquo;activation qui vous a été remis.
        </p>

        <input
          type="text"
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(formatActivationCode(e.target.value))
            setError(null)
          }}
          placeholder="XXXX-XXXX-XXXX"
          spellCheck={false}
          autoComplete="off"
          className={cn(
            'mt-6 w-full rounded-md border border-main-view-fg/15 bg-main-view',
            'px-3 py-2.5 text-center font-mono text-lg tracking-widest uppercase',
            'placeholder:text-main-view-fg/30 placeholder:tracking-widest',
            'focus:outline-none focus:ring-2 focus:ring-accent'
          )}
        />

        {error && <p className="text-sm text-destructive mt-3">{error}</p>}

        <button
          type="submit"
          disabled={busy || !complete}
          className={cn(
            'mt-4 w-full rounded-md bg-accent text-accent-fg px-4 py-2.5',
            'text-sm font-medium hover:opacity-90 transition-opacity',
            (busy || !complete) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {busy ? 'Activation…' : 'Activer'}
        </button>
      </form>

      <p className="absolute bottom-6 text-xs text-main-view-fg/40 text-center px-6">
        Données traitées en France, jamais stockées hors de votre ordinateur.
      </p>
    </div>
  )
}
