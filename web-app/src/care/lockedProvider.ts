import { useModelProvider } from '@/hooks/useModelProvider'
import { openAIProviderSettings } from '@/constants/providers'

// IA Pros Santé : provider unique, verrouillé. URL et modèle fixés ici —
// changer de modèle = changer cette config, pas de réglage utilisateur.
// La clé API est injectée à l'activation puis vit dans le trousseau OS
// (register_provider_config) ; elle n'est jamais persistée en clair.

export const CARE_PROVIDER_NAME = 'scaleway'
export const CARE_BASE_URL = 'https://api.scaleway.ai/v1'
// TODO(Greg) : vérifier l'identifiant exact du modèle dans le catalogue Scaleway.
export const CARE_MODEL_ID = 'deepseek-v4-flash'

export const CARE_PLACEHOLDER_KEY = 'REMPLACER-PAR-VRAIE-CLE-SCALEWAY'

const careModel = (): Model => ({
  id: CARE_MODEL_ID,
  name: 'DeepSeek V4 Flash',
  version: '1.0',
  description: 'Modèle servi depuis Paris (Scaleway Generative APIs).',
  capabilities: ['tools'],
})

function careProviderSettings(apiKey: string): ProviderSetting[] {
  // Mêmes réglages qu'un provider OpenAI-compatible, valeurs verrouillées.
  return openAIProviderSettings.map((setting) => {
    const cloned = JSON.parse(JSON.stringify(setting)) as ProviderSetting
    if (cloned.key === 'api-key') {
      cloned.controller_props = { ...cloned.controller_props, value: apiKey }
    }
    if (cloned.key === 'base-url') {
      cloned.controller_props = {
        ...cloned.controller_props,
        value: CARE_BASE_URL,
      }
    }
    return cloned
  })
}

// S'assure que le provider verrouillé existe et que son URL/modèle collent à
// la config — corrige toute dérive à chaque démarrage sans toucher à la clé.
export function ensureLockedProvider(): void {
  const store = useModelProvider.getState()
  const existing = store.providers.find(
    (p) => p.provider === CARE_PROVIDER_NAME
  )

  if (!existing) {
    store.addProvider({
      provider: CARE_PROVIDER_NAME,
      active: true,
      persist: true,
      base_url: CARE_BASE_URL,
      api_key: '',
      models: [careModel()],
      settings: careProviderSettings(''),
    })
    return
  }

  const patch: Partial<ModelProvider> = {}
  if (existing.base_url !== CARE_BASE_URL) patch.base_url = CARE_BASE_URL
  if (!existing.models?.some((m) => m.id === CARE_MODEL_ID)) {
    patch.models = [...(existing.models ?? []), careModel()]
  }
  if (!existing.active) patch.active = true
  if (Object.keys(patch).length > 0) {
    store.updateProvider(CARE_PROVIDER_NAME, patch)
  }
}

// Injecte la clé API (à l'activation) et sélectionne le modèle verrouillé.
// Ne remplace jamais une vraie clé déjà en place par un placeholder.
export function applyCareApiKey(apiKey: string): void {
  ensureLockedProvider()
  const store = useModelProvider.getState()
  const provider = store.providers.find(
    (p) => p.provider === CARE_PROVIDER_NAME
  )
  const existingKey = provider?.api_key ?? ''
  const existingIsReal =
    existingKey.length > 0 && existingKey !== CARE_PLACEHOLDER_KEY
  const incomingIsReal = apiKey.length > 0 && apiKey !== CARE_PLACEHOLDER_KEY

  if (incomingIsReal || !existingIsReal) {
    store.updateProvider(CARE_PROVIDER_NAME, {
      api_key: apiKey,
      settings: careProviderSettings(apiKey),
    })
  }
  store.selectModelProvider(CARE_PROVIDER_NAME, CARE_MODEL_ID)
}
