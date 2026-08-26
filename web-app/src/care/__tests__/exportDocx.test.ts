import { describe, it, expect } from 'vitest'
import { markdownToParagraphs, sanitizeFilename } from '../exportDocx'
import { buildExportFilename } from '../buildPrompt'
import type { CareProject } from '../types'

describe('markdownToParagraphs', () => {
  it('converts headings, lists and paragraphs', () => {
    const md = [
      '# Compte-rendu',
      '',
      'Texte **important** et *nuancé*.',
      '',
      '## Objectifs',
      '- premier',
      '- second',
      '1. étape une',
      '---',
    ].join('\n')

    const paragraphs = markdownToParagraphs(md)
    // 1 titre + 1 paragraphe + 1 sous-titre + 2 puces + 1 numéroté ; le --- est ignoré
    expect(paragraphs).toHaveLength(6)
  })

  it('skips blank lines without crashing on empty input', () => {
    expect(markdownToParagraphs('')).toHaveLength(0)
    expect(markdownToParagraphs('\n\n\n')).toHaveLength(0)
  })
})

describe('sanitizeFilename', () => {
  it('replaces forbidden characters and appends .docx', () => {
    expect(sanitizeFilename('CR_Léo M._26/08/2026')).toBe(
      'CR_Léo M._26-08-2026.docx'
    )
  })

  it('keeps an existing .docx extension', () => {
    expect(sanitizeFilename('bilan.docx')).toBe('bilan.docx')
  })
})

describe('buildExportFilename', () => {
  const project = {
    slug: 'compte-rendu-seance',
    name: 'CR',
    description: '',
    inputs: [],
    output: { format: 'docx', filename: 'CR_{patient}_{date}.docx' },
    system: '',
    template: '',
  } as unknown as CareProject

  it('fills the template with form values', () => {
    expect(
      buildExportFilename(project, { patient: 'Léo M.', date: '26/08/2026' })
    ).toBe('CR_Léo M._26-08-2026.docx')
  })

  it('falls back to the slug without a template', () => {
    const bare = { ...project, output: undefined } as CareProject
    expect(buildExportFilename(bare, {})).toBe('compte-rendu-seance.docx')
  })
})
