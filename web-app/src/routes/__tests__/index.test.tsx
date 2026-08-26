/* eslint-disable @typescript-eslint/no-explicit-any */
// IA Pros Santé : l'accueil (/) est la grille de Projets métier, gardée par
// l'écran d'activation. Les anciens tests du chat home vivent dans chat.test.tsx.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'

const h = vi.hoisted(() => ({
  activated: false,
  setCurrentThreadId: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({ ...config, id: '/' }),
}))

vi.mock('@/care/useCareActivation', () => ({
  useCareActivation: (selector: any) => selector({ activated: h.activated }),
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

vi.mock('@/containers/CareActivationScreen', () => ({
  default: () => <div data-testid="activation-screen" />,
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
    h.activated = false
  })

  it('renders the activation screen when not activated', () => {
    renderComponent()
    expect(screen.getByTestId('activation-screen')).toBeInTheDocument()
    expect(screen.queryByTestId('care-grid')).not.toBeInTheDocument()
  })

  it('renders the projects grid when activated', () => {
    h.activated = true
    renderComponent()
    expect(screen.getByTestId('care-grid')).toBeInTheDocument()
    expect(screen.getByTestId('header-page')).toBeInTheDocument()
    expect(screen.queryByTestId('activation-screen')).not.toBeInTheDocument()
  })

  it('clears the current thread id on mount', () => {
    h.activated = true
    renderComponent()
    expect(h.setCurrentThreadId).toHaveBeenCalledWith(undefined)
  })
})
