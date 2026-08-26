/* eslint-disable @typescript-eslint/no-explicit-any */
// IA Pros Santé : le "new chat" historique de Jan, déplacé de / vers /chat.
// L'accueil (/) est désormais la grille de Projets métier.
import { createFileRoute, useSearch } from '@tanstack/react-router'
import ChatInput from '@/containers/ChatInput'
import HeaderPage from '@/containers/HeaderPage'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useTools } from '@/hooks/useTools'
import { cn } from '@/lib/utils'

import CareActivationScreen from '@/containers/CareActivationScreen'
import { useCareActivation } from '@/care/useCareActivation'
import { route } from '@/constants/routes'

type ThreadModel = {
  id: string
  provider: string
}

type SearchParams = {
  threadModel?: ThreadModel
}
import { useEffect } from 'react'
import { useThreads } from '@/hooks/useThreads'
import DropdownModelProvider from '@/containers/DropdownModelProvider'

export const Route = createFileRoute(route.careChat as any)({
  component: ChatHome,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const result: SearchParams = {
      threadModel: search.threadModel as ThreadModel | undefined,
    }

    return result
  },
})

function ChatHome() {
  const { t } = useTranslation()
  const activated = useCareActivation((s) => s.activated)
  const search = useSearch({ from: route.careChat as any })
  const threadModel = (search as SearchParams).threadModel
  const { setCurrentThreadId } = useThreads()
  useTools()

  useEffect(() => {
    setCurrentThreadId(undefined)
  }, [setCurrentThreadId])

  if (!activated) {
    return <CareActivationScreen />
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <HeaderPage>
        <div className="flex items-center gap-2 w-full">
          <DropdownModelProvider model={threadModel} />
        </div>
      </HeaderPage>
      <div
        className={cn(
          'h-full overflow-y-auto inline-flex flex-col gap-2 justify-center px-3'
        )}
      >
        <div className={cn('mx-auto w-full md:w-4/5 xl:w-4/6 -mt-20')}>
          <div className={cn('text-center mb-4')}>
            <h1 className={cn('text-2xl mt-2 font-studio font-medium')}>
              {t('chat:description')}
            </h1>
          </div>
          <div className="flex-1 shrink-0">
            <ChatInput
              showSpeedToken={false}
              model={threadModel}
              initialMessage={true}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
