import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { parse } from 'yaml'
import type { CareProject, CareProjectConfig } from './types'

// Les Projets par défaut sont embarqués dans le bundle : chaque dossier de
// src/care/defaults/<slug>/ contient project.yaml + system.md + template.md.
// Des Projets sur disque (<données Jan>/care/projects/<slug>/, doc §3)
// s'y ajoutent au démarrage : même slug = le disque remplace l'embarqué,
// nouveau slug = ajouté au catalogue. Changer un document produit se fait
// donc en déposant des fichiers, sans re-release.
const rawFiles = import.meta.glob('./defaults/*/*.{yaml,md}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

interface CareProjectFiles {
  slug: string
  yaml: string
  system: string
  template: string
}

// Parse un Projet depuis ses fichiers bruts. null si le YAML est invalide ou
// s'il manque l'essentiel — un dossier cassé ne doit pas casser le catalogue.
export function parseCareProject(files: CareProjectFiles): CareProject | null {
  let config: CareProjectConfig
  try {
    config = parse(files.yaml) as CareProjectConfig
  } catch (e) {
    console.error(`[care] project.yaml invalide dans ${files.slug} :`, e)
    return null
  }
  if (!config || typeof config.name !== 'string' || !config.name) {
    console.error(`[care] Projet ${files.slug} ignoré : « name » manquant`)
    return null
  }
  return {
    ...config,
    slug: config.slug ?? files.slug,
    description: config.description ?? '',
    inputs: Array.isArray(config.inputs) ? config.inputs : [],
    system: files.system,
    template: files.template,
  }
}

function loadDefaults(): CareProject[] {
  const byFolder = new Map<string, Record<string, string>>()

  for (const [path, content] of Object.entries(rawFiles)) {
    // path : ./defaults/<slug>/<fichier>
    const parts = path.split('/')
    const folder = parts[2]
    const file = parts[3]
    if (!folder || !file) continue
    const entry = byFolder.get(folder) ?? {}
    entry[file] = content
    byFolder.set(folder, entry)
  }

  const projects: CareProject[] = []
  for (const [folder, files] of byFolder) {
    if (!files['project.yaml']) {
      console.warn(`[care] dossier ${folder} ignoré : project.yaml manquant`)
      continue
    }
    const project = parseCareProject({
      slug: folder,
      yaml: files['project.yaml'],
      system: files['system.md'] ?? '',
      template: files['template.md'] ?? '',
    })
    if (project) projects.push(project)
  }

  // Ordre stable et voulu sur la grille d'accueil
  const order = [
    'compte-rendu-seance',
    'bilan-initial',
    'courrier',
    'amenagements-enfant',
  ]
  projects.sort((a, b) => {
    const ia = order.indexOf(a.slug)
    const ib = order.indexOf(b.slug)
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib)
  })
  return projects
}

/** Catalogue embarqué seul (sans les Projets disque). */
export const careProjects: CareProject[] = loadDefaults()

interface CareProjectsState {
  projects: CareProject[]
}

// Catalogue courant (embarqué + disque). Les composants s'y abonnent pour
// être re-rendus quand les Projets disque arrivent.
export const useCareProjects = create<CareProjectsState>(() => ({
  projects: careProjects,
}))

/** Fusion : le disque remplace l'embarqué à slug égal, sinon s'ajoute. */
export function mergeCareProjects(
  defaults: CareProject[],
  fromDisk: CareProject[]
): CareProject[] {
  return [
    ...defaults.map(
      (d) => fromDisk.find((p) => p.slug === d.slug) ?? d
    ),
    ...fromDisk.filter((p) => !defaults.some((d) => d.slug === p.slug)),
  ]
}

// À appeler au démarrage : charge les Projets déposés sur le disque. Toute
// erreur laisse le catalogue embarqué en place, jamais d'écran vide.
export async function refreshCareProjects(): Promise<void> {
  try {
    const files = await invoke<CareProjectFiles[]>('care_list_projects')
    const fromDisk = files
      .map(parseCareProject)
      .filter((p): p is CareProject => p !== null)
    if (fromDisk.length === 0) return
    useCareProjects.setState({
      projects: mergeCareProjects(careProjects, fromDisk),
    })
  } catch (e) {
    console.error('[care] Projets disque illisibles :', e)
  }
}

export function getCareProject(slug: string): CareProject | undefined {
  return useCareProjects.getState().projects.find((p) => p.slug === slug)
}

// Catalogue visible pour une profession donnée (clé `profession` de la config
// d'activation). Un Projet sans profession est universel ; ajouter une
// profession = ajouter des dossiers avec la bonne clé, sans toucher au code.
export function filterCareProjectsByProfession(
  projects: CareProject[],
  profession: string | null | undefined
): CareProject[] {
  if (!profession) return projects
  return projects.filter((p) => !p.profession || p.profession === profession)
}

export function careProjectsForProfession(
  profession: string | null | undefined
): CareProject[] {
  return filterCareProjectsByProfession(
    useCareProjects.getState().projects,
    profession
  )
}
