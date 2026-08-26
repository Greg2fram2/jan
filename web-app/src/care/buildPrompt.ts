import type { CareProject } from './types'

export type CareFormValues = Record<string, string>

// Assemble le message utilisateur envoyé au modèle : les informations saisies
// dans le formulaire, puis la trame à suivre. Le rôle et les consignes de
// rédaction (system.md) partent séparément comme prompt système de
// l'assistant du thread.
export function buildUserPrompt(
  project: CareProject,
  values: CareFormValues
): string {
  const sections: string[] = []

  sections.push('Voici les informations fournies par le professionnel :')

  for (const input of project.inputs) {
    const value = values[input.id]?.trim()
    if (!value) continue
    // Les valeurs multi-lignes passent dans un bloc pour rester intactes
    if (value.includes('\n')) {
      sections.push(`### ${input.label}\n\n${value}`)
    } else {
      sections.push(`**${input.label} :** ${value}`)
    }
  }

  if (project.template.trim()) {
    sections.push(
      'Rédige le document en suivant exactement la trame ci-dessous. ' +
        'Les parties entre parenthèses décrivent le contenu attendu de chaque ' +
        'section ; remplace les gabarits {champ} par les valeurs fournies.'
    )
    sections.push('```\n' + project.template.trim() + '\n```')
  } else {
    sections.push('Rédige le document demandé à partir de ces informations.')
  }

  return sections.join('\n\n')
}

// Titre du thread affiché dans l'historique, ex. "Compte-rendu de séance — Léo M."
export function buildThreadTitle(
  project: CareProject,
  values: CareFormValues
): string {
  const firstId = project.inputs[0]?.id
  const first = firstId ? values[firstId]?.trim() : undefined
  return first ? `${project.name} — ${first.slice(0, 40)}` : project.name
}
