import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// IA Pros Santé : mode avancé caché. Par défaut l'app ne montre que les
// réglages utiles au professionnel (général, apparence, raccourcis,
// confidentialité). Le raccourci Ctrl/Cmd+Maj+A révèle le reste : Hub,
// providers, modèles locaux, embeddings, MCP, hardware, serveur API…

interface CareAdvancedModeState {
  advanced: boolean
  toggle: () => boolean
}

export const useCareAdvancedMode = create<CareAdvancedModeState>()(
  persist(
    (set, get) => ({
      advanced: false,
      toggle: () => {
        const next = !get().advanced
        set({ advanced: next })
        return next
      },
    }),
    {
      name: 'care-advanced-mode',
      partialize: (state) => ({ advanced: state.advanced }),
    }
  )
)
