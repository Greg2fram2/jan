import { describe, it, expect } from 'vitest'
import {
  careProjects,
  careProjectsForProfession,
  getCareProject,
} from '../projects'

describe('careProjects (catalogue embarqué)', () => {
  it('loads the four ergo defaults in stable order', () => {
    expect(careProjects.map((p) => p.slug)).toEqual([
      'compte-rendu-seance',
      'bilan-initial',
      'courrier',
      'amenagements-enfant',
    ])
  })

  it('every project has a system prompt and a template', () => {
    for (const p of careProjects) {
      expect(p.system.length, p.slug).toBeGreaterThan(0)
      expect(p.template.length, p.slug).toBeGreaterThan(0)
      expect(p.inputs.length, p.slug).toBeGreaterThan(0)
    }
  })

  it('getCareProject finds by slug', () => {
    expect(getCareProject('courrier')?.name).toBeTruthy()
    expect(getCareProject('inexistant')).toBeUndefined()
  })
})

describe('careProjectsForProfession', () => {
  it('returns matching profession plus universal projects', () => {
    expect(careProjectsForProfession('ergotherapeute')).toHaveLength(
      careProjects.length
    )
  })

  it('hides projects of another profession', () => {
    const visible = careProjectsForProfession('orthophoniste')
    expect(visible.every((p) => !p.profession)).toBe(true)
  })

  it('shows everything when profession is unknown', () => {
    expect(careProjectsForProfession(null)).toHaveLength(careProjects.length)
  })
})
