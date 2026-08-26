// IA Pros Santé : aucune télémétrie, jamais.
// Le provider PostHog upstream est neutralisé — aucun SDK analytics n'est
// initialisé, quel que soit l'état du consentement hérité.
export function AnalyticProvider() {
  return null
}
