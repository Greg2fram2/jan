import { beforeEach, describe, it, expect, vi } from 'vitest'

const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

import {
  careProjects,
  careProjectsForProfession,
  getCareProject,
  mergeCareProjects,
  parseCareProject,
  refreshCareProjects,
  useCareProjects,
} from '../projects'

beforeEach(() => {
  invokeMock.mockReset()
  useCareProjects.setState({ projects: careProjects })
})

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

describe('parseCareProject', () => {
  it('builds a project from raw files', () => {
    const project = parseCareProject({
      slug: 'note-perso',
      yaml: 'name: Note\ndescription: Une note\ninputs:\n  - id: texte\n    label: Texte\n    type: text\n',
      system: 'Tu rédiges.',
      template: '# Note',
    })
    expect(project?.slug).toBe('note-perso')
    expect(project?.name).toBe('Note')
    expect(project?.inputs).toHaveLength(1)
  })

  it('rejects invalid yaml and missing name without throwing', () => {
    expect(
      parseCareProject({ slug: 'x', yaml: ': : :', system: '', template: '' })
    ).toBeNull()
    expect(
      parseCareProject({
        slug: 'x',
        yaml: 'description: sans nom',
        system: '',
        template: '',
      })
    ).toBeNull()
  })
})

describe('mergeCareProjects', () => {
  it('disk overrides same slug, new slugs are appended', () => {
    const override = { ...careProjects[0], name: 'Version disque' }
    const extra = { ...careProjects[1], slug: 'tout-nouveau' }
    const merged = mergeCareProjects(careProjects, [override, extra])
    expect(merged).toHaveLength(careProjects.length + 1)
    expect(merged[0].name).toBe('Version disque')
    expect(merged.at(-1)?.slug).toBe('tout-nouveau')
  })
})

describe('refreshCareProjects', () => {
  it('merges disk projects into the store', async () => {
    invokeMock.mockResolvedValue([
      {
        slug: 'bilan-conduite',
        yaml: 'name: Bilan préconduite\ndescription: Aptitude à la conduite\ninputs: []',
        system: 'Tu rédiges un bilan.',
        template: '# Bilan',
      },
    ])
    await refreshCareProjects()
    expect(invokeMock).toHaveBeenCalledWith('care_list_projects')
    const { projects } = useCareProjects.getState()
    expect(projects).toHaveLength(careProjects.length + 1)
    expect(getCareProject('bilan-conduite')?.name).toBe('Bilan préconduite')
  })

  it('keeps the embedded catalogue when the backend fails', async () => {
    invokeMock.mockRejectedValue(new Error('pas de backend'))
    await refreshCareProjects()
    expect(useCareProjects.getState().projects).toHaveLength(
      careProjects.length
    )
  })

  it('skips unparseable disk projects', async () => {
    invokeMock.mockResolvedValue([
      { slug: 'casse', yaml: ': : :', system: '', template: '' },
    ])
    await refreshCareProjects()
    expect(useCareProjects.getState().projects).toHaveLength(
      careProjects.length
    )
  })
})
