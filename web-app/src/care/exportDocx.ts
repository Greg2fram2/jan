import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { invoke } from '@tauri-apps/api/core'
import { getServiceHub } from '@/hooks/useServiceHub'

// IA Pros Santé : export d'une réponse (markdown simple) en .docx.
// Le professionnel choisit l'emplacement via la boîte de dialogue système ;
// l'écriture passe par la commande Tauri write_file_base64.

const NUMBERING_REF = 'care-numbered'

/** Découpe une ligne markdown en TextRun (gras **…**, italique *…*). */
function inlineRuns(text: string): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)
  return parts.map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return new TextRun({ text: part.slice(2, -2), bold: true })
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return new TextRun({ text: part.slice(1, -1), italics: true })
    }
    return new TextRun({ text: part })
  })
}

/** Convertit un markdown simple (titres, listes, gras) en paragraphes docx. */
export function markdownToParagraphs(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = []

  for (const rawLine of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) continue
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) continue

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      const levels = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
      ] as const
      paragraphs.push(
        new Paragraph({
          heading: levels[heading[1].length - 1],
          spacing: { before: 240, after: 120 },
          children: inlineRuns(heading[2]),
        })
      )
      continue
    }

    const bullet = trimmed.match(/^[-*+]\s+(.*)$/)
    if (bullet) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: inlineRuns(bullet[1]),
        })
      )
      continue
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/)
    if (numbered) {
      paragraphs.push(
        new Paragraph({
          numbering: { reference: NUMBERING_REF, level: 0 },
          spacing: { after: 60 },
          children: inlineRuns(numbered[1]),
        })
      )
      continue
    }

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 },
        children: inlineRuns(trimmed),
      })
    )
  }

  return paragraphs
}

export function buildDocx(markdown: string): Document {
  return new Document({
    numbering: {
      config: [
        {
          reference: NUMBERING_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 }, // 11 pt
        },
      },
    },
    sections: [{ children: markdownToParagraphs(markdown) }],
  })
}

/** Nettoie un nom de fichier proposé (caractères interdits Windows). */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.toLowerCase().endsWith('.docx') ? cleaned : `${cleaned}.docx`
}

/**
 * Exporte le markdown en .docx à l'emplacement choisi par l'utilisateur.
 * Retourne le chemin écrit, ou null si la boîte de dialogue a été annulée.
 */
export async function exportMarkdownAsDocx(
  markdown: string,
  suggestedFilename: string
): Promise<string | null> {
  const path = await getServiceHub()
    .dialog()
    .save({
      defaultPath: sanitizeFilename(suggestedFilename),
      filters: [{ name: 'Document Word', extensions: ['docx'] }],
    })
  if (!path) return null

  const finalPath = path.toLowerCase().endsWith('.docx')
    ? path
    : `${path}.docx`
  const base64 = await Packer.toBase64String(buildDocx(markdown))
  await invoke('write_file_base64', { args: [finalPath, base64] })
  return finalPath
}
