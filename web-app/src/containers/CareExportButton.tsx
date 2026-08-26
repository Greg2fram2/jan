import { useState } from 'react'
import { IconFileTypeDocx } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useThreads } from '@/hooks/useThreads'
import { exportMarkdownAsDocx } from '@/care/exportDocx'

// IA Pros Santé : bouton « Exporter en Word » sur les réponses de l'assistant
// dans les threads issus d'un Projet métier. Le nom proposé vient du gabarit
// du Projet (paramètre care_export_filename de l'assistant du thread).

export function CareExportButton({ text }: { text: string }) {
  const thread = useThreads((s) =>
    s.currentThreadId ? s.threads[s.currentThreadId] : undefined
  )
  const [exporting, setExporting] = useState(false)

  const assistant = thread?.assistants?.[0]
  if (!assistant?.id?.startsWith('care-')) return null

  const suggested =
    (assistant.parameters as Record<string, unknown> | undefined)
      ?.care_export_filename as string | undefined

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const path = await exportMarkdownAsDocx(
        text,
        suggested ?? `${thread?.title ?? 'document'}.docx`
      )
      if (path) toast.success('Document exporté', { description: path })
    } catch (err) {
      console.error('[care] échec export docx :', err)
      toast.error("Impossible d'exporter le document")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={handleExport}
      disabled={exporting}
      title="Exporter en Word (.docx)"
    >
      <IconFileTypeDocx size={16} />
    </Button>
  )
}
