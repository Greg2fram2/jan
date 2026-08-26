// IA Pros Santé — Système de Projets en configuration.
// Un Projet = un dossier de config (project.yaml + system.md + template.md)
// qui décrit un type de document produit par le professionnel.

export type CareInputType = 'text' | 'select' | 'file_or_text'

export interface CareInput {
  id: string
  label: string
  type: CareInputType
  required?: boolean
  placeholder?: string
  /** Pour type: select */
  options?: string[]
  /** Pour type: text — zone multi-lignes */
  multiline?: boolean
  /** Aide affichée sous le champ */
  help?: string
}

export interface CareOutput {
  format?: 'docx' | 'pdf' | 'text'
  /** Gabarit du nom de fichier, ex. "CR_{patient}_{date}.docx" */
  filename?: string
}

/** Contenu de project.yaml */
export interface CareProjectConfig {
  slug: string
  name: string
  description: string
  /** Emoji affiché sur la carte de la grille */
  icon?: string
  profession?: string
  inputs: CareInput[]
  output?: CareOutput
}

/** Projet complet = config + prompt système + trame du document */
export interface CareProject extends CareProjectConfig {
  /** system.md — rôle et consignes, injecté comme prompt système */
  system: string
  /** template.md — trame du document attendu */
  template: string
}
