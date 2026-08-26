/* eslint-disable @typescript-eslint/no-explicit-any */
// IA Pros Santé : l'écran d'accueil est la grille de Projets métier.
// Tant que l'application n'est pas activée (code fourni à l'achat), l'écran
// d'activation prend toute la place. Le chat libre de Jan vit sur /chat.
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import HeaderPage from '@/containers/HeaderPage'
import CareProjectsGrid from '@/containers/CareProjectsGrid'
import CareActivationScreen from '@/containers/CareActivationScreen'
import { useCareActivation } from '@/care/useCareActivation'
import { useThreads } from '@/hooks/useThreads'
import { route } from '@/constants/routes'

export const Route = createFileRoute(route.home as any)({
  component: Index,
})

function Index() {
  const activated = useCareActivation((s) => s.activated)
  const { setCurrentThreadId } = useThreads()

  useEffect(() => {
    setCurrentThreadId(undefined)
  }, [setCurrentThreadId])

  if (!activated) {
    return <CareActivationScreen />
  }

  return (
    <div className="flex h-full flex-col">
      <HeaderPage />
      <CareProjectsGrid />
    </div>
  )
}
