/* eslint-disable @typescript-eslint/no-explicit-any */
// IA Pros Santé : l'écran d'accueil est la grille de Projets métier.
// Le chat libre historique de Jan vit désormais sur /chat (voir chat.tsx).
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import HeaderPage from '@/containers/HeaderPage'
import CareProjectsGrid from '@/containers/CareProjectsGrid'
import SetupScreen from '@/containers/SetupScreen'
import { useModelProvider } from '@/hooks/useModelProvider'
import { useThreads } from '@/hooks/useThreads'
import { route } from '@/constants/routes'
import { hasUsableProvider } from '@/lib/providerReadiness'

export const Route = createFileRoute(route.home as any)({
  component: Index,
})

function Index() {
  const { providers } = useModelProvider()
  const { setCurrentThreadId } = useThreads()

  const hasValidProviders = hasUsableProvider(providers)

  useEffect(() => {
    setCurrentThreadId(undefined)
  }, [setCurrentThreadId])

  if (!hasValidProviders) {
    return <SetupScreen />
  }

  return (
    <div className="flex h-full flex-col">
      <HeaderPage />
      <CareProjectsGrid />
    </div>
  )
}
