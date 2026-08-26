/* eslint-disable @typescript-eslint/no-explicit-any */
// IA Pros Santé : l'accueil (/) est la grille de Projets métier.
// Les anciens tests du chat home vivent désormais dans chat.test.tsx.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'

const h = vi.hoisted(() => ({
  providers: [] as any[],
  setCurrentThreadId: vi.fn(),
  providerHasRemoteApiKeys: vi.fn(() => false),
  predefinedProviders: [
    { provider: 'openai' },
    { provider: 'llamacpp' },
    { provider: 'jan' },
  ],
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({ ...config, id: '/' }),
}))

vi.mock('@/hooks/useModelProvider', () => ({
  useModelProvider: () => ({ providers: h.providers }),
}))

vi.mock('@/hooks/useThreads', () => ({
  useThreads: () => ({ setCurrentThreadId: h.setCurrentThreadId }),
}))

vi.mock('@/containers/HeaderPage', () => ({
  default: ({ children }: any) => <div data-testid="header-page">{children}</div>,
}))

vi.mock('@/containers/CareProjectsGrid', () => ({
  default: () => <div data-testid="care-grid" />,
}))

vi.mock('@/containers/SetupScreen', () => ({
  default: () => <div data-testid="setup-screen" />,
}))

vi.mock('@/lib/provider-api-keys', () => ({
  providerHasRemoteApiKeys: (p: any) => h.providerHasRemoteApiKeys(p),
}))

vi.mock('@/constants/providers', () => ({
  predefinedProviders: h.predefinedProviders,
}))

vi.mock('@/constants/routes', () => ({
  route: { home: '/', careChat: '/chat', careProject: '/projet/$slug' },
}))

import { Route } from '../index'

const renderComponent = () => {
  const Component = Route.component as React.ComponentType
  return render(<Component />)
}

describe('Index route (grille de Projets)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.providers = []
    h.providerHasRemoteApiKeys.mockReturnValue(false)
  })

  it('renders SetupScreen when no valid providers exist', () => {
    h.providers = []
    renderComponent()
    expect(screen.getByTestId('setup-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('care-grid')).not.toBeInTheDocument()
  })

  it('renders the projects grid when a provider is usable', () => {
    h.providers = [{ provider: 'openai', models: [] }]
    h.providerHasRemoteApiKeys.mockReturnValue(true)
    renderComponent()
    expect(screen.getByTestId('care-grid')).toBeInTheDocument()
    expect(screen.getByTestId('header-page')).toBeInTheDocument()
    expect(screen.queryByTestId('setup-screen')).not.toBeInTheDocument()
  })

  it('clears the current thread id on mount', () => {
    h.providers = [{ provider: 'openai', models: [] }]
    h.providerHasRemoteApiKeys.mockReturnValue(true)
    renderComponent()
    expect(h.setCurrentThreadId).toHaveBeenCalledWith(undefined)
  })
})
