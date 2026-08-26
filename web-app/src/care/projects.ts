import { parse } from 'yaml'
import type { CareProject, CareProjectConfig } from './types'

// Les Projets par défaut sont embarqués dans le bundle : chaque dossier de
// src/care/defaults/<slug>/ contient project.yaml + system.md + template.md.
// À terme, des Projets utilisateur pourront être chargés depuis le disque
// (dossier projects/ des données de l'app) et fusionnés ici.
const rawFiles = import.meta.glob('./defaults/*/*.{yaml,md}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

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
    const yamlSrc = files['project.yaml']
    if (!yamlSrc) {
      console.warn(`[care] dossier ${folder} ignoré : project.yaml manquant`)
      continue
    }
    try {
      const config = parse(yamlSrc) as CareProjectConfig
      projects.push({
        ...config,
        slug: config.slug ?? folder,
        inputs: config.inputs ?? [],
        system: files['system.md'] ?? '',
        template: files['template.md'] ?? '',
      })
    } catch (e) {
      console.error(`[care] project.yaml invalide dans ${folder} :`, e)
    }
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

export const careProjects: CareProject[] = loadDefaults()

export function getCareProject(slug: string): CareProject | undefined {
  return careProjects.find((p) => p.slug === slug)
}
