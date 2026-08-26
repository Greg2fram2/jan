import { useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PaperclipIcon, XIcon } from 'lucide-react'
import { route } from '@/constants/routes'
import { SESSION_STORAGE_PREFIX } from '@/constants/chat'
import { useThreads } from '@/hooks/useThreads'
import { useModelProvider } from '@/hooks/useModelProvider'
import { defaultModel } from '@/lib/models'
import { cn } from '@/lib/utils'
import { buildThreadTitle, buildUserPrompt } from '@/care/buildPrompt'
import type { CareFormValues } from '@/care/buildPrompt'
import type { CareInput, CareProject } from '@/care/types'

// IA Pros Santé : formulaire d'un Projet métier. À la validation, un thread
// est créé avec un assistant éphémère (system.md du Projet comme prompt
// système), le message assemblé part comme message initial, et on navigue
// vers le thread — le résultat y est relisible et affinable par le chat.

const inputBaseClass = cn(
  'w-full rounded-md border border-main-view-fg/15 bg-main-view px-3 py-2',
  'text-sm placeholder:text-main-view-fg/40',
  'focus:outline-none focus:ring-2 focus:ring-accent'
)

function FieldLabel({ input }: { input: CareInput }) {
  return (
    <label htmlFor={`care-${input.id}`} className="block text-sm font-medium mb-1.5">
      {input.label}
      {input.required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )
}

function FileOrTextField({
  input,
  value,
  onChange,
}: {
  input: CareInput
  value: string
  onChange: (value: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      onChange(typeof reader.result === 'string' ? reader.result : '')
      setFileName(file.name)
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <textarea
        id={`care-${input.id}`}
        className={cn(inputBaseClass, 'min-h-32 resize-y')}
        placeholder={input.placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          if (fileName) setFileName(null)
        }}
      />
      <div className="flex items-center gap-2 mt-1.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs text-main-view-fg/60',
            'hover:text-main-view-fg transition-colors'
          )}
        >
          <PaperclipIcon className="size-3.5" />
          Joindre un fichier texte
        </button>
        {fileName && (
          <span className="inline-flex items-center gap-1 text-xs bg-main-view-fg/8 rounded px-1.5 py-0.5">
            {fileName}
            <button
              type="button"
              aria-label="Retirer le fichier"
              onClick={() => {
                onChange('')
                setFileName(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) readFile(file)
          }}
        />
      </div>
      {input.help && (
        <p className="text-xs text-main-view-fg/50 mt-1">{input.help}</p>
      )}
    </div>
  )
}

export default function CareProjectForm({ project }: { project: CareProject }) {
  const navigate = useNavigate()
  const { createThread } = useThreads()
  const selectedModel = useModelProvider((s) => s.selectedModel)
  const selectedProvider = useModelProvider((s) => s.selectedProvider)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initialValues = useMemo(() => {
    const values: CareFormValues = {}
    for (const input of project.inputs) {
      // Petit confort : les champs "date" sont préremplis à aujourd'hui
      values[input.id] =
        input.id === 'date' ? new Date().toLocaleDateString('fr-FR') : ''
    }
    return values
  }, [project])
  const [values, setValues] = useState<CareFormValues>(initialValues)

  const setValue = (id: string, value: string) =>
    setValues((prev) => ({ ...prev, [id]: value }))

  const missingRequired = project.inputs.filter(
    (input) => input.required && !values[input.id]?.trim()
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (missingRequired.length > 0) {
      setError(
        `Champs obligatoires manquants : ${missingRequired
          .map((i) => i.label)
          .join(', ')}`
      )
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const assistant: Assistant = {
        id: `care-${project.slug}`,
        name: project.name,
        created_at: Date.now(),
        description: project.description,
        instructions: project.system,
        parameters: {},
      }
      const thread = await createThread(
        {
          id: selectedModel?.id ?? defaultModel(selectedProvider),
          provider: selectedProvider,
        },
        buildThreadTitle(project, values),
        assistant
      )
      sessionStorage.setItem(
        `${SESSION_STORAGE_PREFIX.INITIAL_MESSAGE}${thread.id}`,
        JSON.stringify({ text: buildUserPrompt(project, values), files: [] })
      )
      navigate({ to: route.threadsDetail, params: { threadId: thread.id } })
    } catch (err) {
      console.error('[care] échec de création du thread :', err)
      setError('Impossible de lancer la rédaction. Réessayez.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-studio font-medium flex items-center gap-2">
          <span aria-hidden>{project.icon ?? '📄'}</span>
          {project.name}
        </h1>
        <p className="text-sm text-main-view-fg/60 mt-1">{project.description}</p>
      </div>

      <div className="flex flex-col gap-5">
        {project.inputs.map((input) => (
          <div key={input.id}>
            <FieldLabel input={input} />
            {input.type === 'select' ? (
              <select
                id={`care-${input.id}`}
                className={inputBaseClass}
                value={values[input.id] ?? ''}
                onChange={(e) => setValue(input.id, e.target.value)}
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {(input.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : input.type === 'file_or_text' ? (
              <FileOrTextField
                input={input}
                value={values[input.id] ?? ''}
                onChange={(value) => setValue(input.id, value)}
              />
            ) : input.multiline ? (
              <textarea
                id={`care-${input.id}`}
                className={cn(inputBaseClass, 'min-h-20 resize-y')}
                placeholder={input.placeholder}
                value={values[input.id] ?? ''}
                onChange={(e) => setValue(input.id, e.target.value)}
              />
            ) : (
              <input
                id={`care-${input.id}`}
                type="text"
                className={inputBaseClass}
                placeholder={input.placeholder}
                value={values[input.id] ?? ''}
                onChange={(e) => setValue(input.id, e.target.value)}
              />
            )}
            {input.type !== 'file_or_text' && input.help && (
              <p className="text-xs text-main-view-fg/50 mt-1">{input.help}</p>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive mt-4">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'rounded-md bg-accent text-accent-fg px-4 py-2 text-sm font-medium',
            'hover:opacity-90 transition-opacity',
            submitting && 'opacity-60 cursor-not-allowed'
          )}
        >
          {submitting ? 'Création…' : 'Rédiger le document'}
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: route.home })}
          className="text-sm text-main-view-fg/60 hover:text-main-view-fg transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
