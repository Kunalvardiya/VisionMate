import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { NAV_ITEMS } from '../lib/nav'
import { routes } from '../routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('Shell navigation', () => {
  it('lists all seven pages', () => {
    renderAt('/')
    expect(NAV_ITEMS).toHaveLength(7)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const item of NAV_ITEMS) {
      expect(nav).toHaveTextContent(item.label)
    }
  })

  it('marks the current page for assistive tech', () => {
    renderAt('/camera')
    expect(screen.getByRole('link', { name: /Camera/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Dashboard/ })).not.toHaveAttribute('aria-current')
  })

  it('labels unbuilt pages honestly with their phase', () => {
    renderAt('/assistant')
    expect(screen.getByText(/Not implemented yet/)).toBeInTheDocument()
    expect(screen.getByText(/Phase 3/)).toBeInTheDocument()
  })

  it('makes every nav link keyboard focusable', () => {
    renderAt('/')
    const links = screen.getAllByRole('link')
    for (const link of links) expect(link).not.toHaveAttribute('tabindex', '-1')
  })
})
