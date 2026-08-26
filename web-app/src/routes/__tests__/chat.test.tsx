/* eslint-disable @typescript-eslint/no-explicit-any */
// IA Pros Santé : le chat libre a été déplacé de / vers /chat, gardé par
// l'écran d'activation (anciennement le gate SetupScreen de index.test.tsx).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'

const h = vi.hoisted(() => ({
  activated: true,
  search: { threadModel: undefined as any },
  setCurrentThreadId: vi.fn(),
  useTools: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({ ...config, id: '/chat' }),
  useSearch: () => h.search,
}))

vi.mock('@/i18n/react-i18next-compat', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/care/useCareActivation', () => ({
  useCareActivation: (selector: any) => selector({ activated: h.activated }),
}))

vi.mock('@/hooks/useThreads', () => ({
  useThreads: () => ({ setCurrentThreadId: h.setCurrentThreadId }),
}))

vi.mock('@/hooks/useTools', () => ({
  useTools: h.useTools,
}))

vi.mock('@/containers/ChatInput', () => ({
  default: ({ model, initialMessage }: any) => (
    <div data-testid="chat-input" data-initial={String(initialMessage)}>
      {model ? model.id : 'no-model'}
    </div>
  ),
}))

vi.mock('@/containers/HeaderPage', () => ({
  default: ({ children }: any) => <div data-testid="header-page">{children}</div>,
}))

vi.mock('@/containers/DropdownModelProvider', () => ({
  default: ({ model }: any) => (
    <div data-testid="dropdown">{model ? model.id : 'none'}</div>
  ),
}))

vi.mock('@/containers/CareActivationScreen', () => ({
  default: () => <div data-testid="activation-screen" />,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...c: any[]) => c.filter(Boolean).join(' '),
}))

vi.mock('@/constants/routes', () => ({
  route: { home: '/', careChat: '/chat' },
}))

import { Route } from '../chat'

const renderComponent = () => {
  const Component = Route.component as React.ComponentType
  return render(<Component />)
}

describe('Chat route (/chat)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.activated = true
    h.search = { threadModel: undefined }
  })

  it('validateSearch returns threadModel from search params', () => {
    const tm = { id: 'm1', provider: 'p1' }
    const result = (Route as any).validateSearch({ threadModel: tm })
    expect(result.threadModel).toEqual(tm)
  })

  it('validateSearch handles missing threadModel', () => {
    const result = (Route as any).validateSearch({})
    expect(result.threadModel).toBeUndefined()
  })

  it('renders the activation screen when not activated', () => {
    h.activated = false
    renderComponent()
    expect(screen.getByTestId('activation-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument()
  })

  it('renders chat UI when activated', () => {
    renderComponent()
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    expect(screen.getByTestId('header-page')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown')).toBeInTheDocument()
    expect(screen.getByText('chat:description')).toBeInTheDocument()
  })

  it('passes threadModel from search into DropdownModelProvider and ChatInput', () => {
    h.search = { threadModel: { id: 'gpt-x', provider: 'openai' } }
    renderComponent()
    expect(screen.getByTestId('dropdown')).toHaveTextContent('gpt-x')
    expect(screen.getByTestId('chat-input')).toHaveTextContent('gpt-x')
    expect(screen.getByTestId('chat-input')).toHaveAttribute('data-initial', 'true')
  })

  it('calls setCurrentThreadId(undefined) and useTools on mount', () => {
    renderComponent()
    expect(h.setCurrentThreadId).toHaveBeenCalledWith(undefined)
    expect(h.useTools).toHaveBeenCalled()
  })
})
