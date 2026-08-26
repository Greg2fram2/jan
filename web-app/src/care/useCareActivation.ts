import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  decryptActivationBlob,
  InvalidActivationCodeError,
} from './activation'
import type { CareActivationBlob } from './activation'
import { applyCareApiKey, ensureLockedProvider } from './lockedProvider'
import activationBlob from './activation.blob.json'

// IA Pros Santé : état d'activation de l'application. Seuls la profession et
// le flag sont persistés ici — la clé API part dans le provider verrouillé
// puis dans le trousseau OS (register_provider_config), jamais en clair.

interface CareActivationState {
  activated: boolean
  profession: string | null
  customer: string | null
  /** Déchiffre le blob avec le code saisi et configure le provider. */
  activate: (code: string) => Promise<void>
  reset: () => void
}

export const useCareActivation = create<CareActivationState>()(
  persist(
    (set) => ({
      activated: false,
      profession: null,
      customer: null,
      activate: async (code: string) => {
        const payload = await decryptActivationBlob(
          activationBlob as CareActivationBlob,
          code
        )
        applyCareApiKey(payload.api_key)
        set({
          activated: true,
          profession: payload.profession,
          customer: payload.customer ?? null,
        })
      },
      reset: () =>
        set({ activated: false, profession: null, customer: null }),
    }),
    {
      name: 'care-activation',
      partialize: (state) => ({
        activated: state.activated,
        profession: state.profession,
        customer: state.customer,
      }),
    }
  )
)

// À appeler au démarrage : corrige la dérive de config du provider verrouillé
// (URL, modèle) une fois les providers hydratés.
export function bootstrapCareProvider(): void {
  if (useCareActivation.getState().activated) {
    ensureLockedProvider()
  }
}

export { InvalidActivationCodeError }
