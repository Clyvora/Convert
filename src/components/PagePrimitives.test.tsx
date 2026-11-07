import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PageDirectory } from './PagePrimitives'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('reveals an off-screen selected category without scrolling the page', () => {
  const entries = [{ id: 'first', label: 'First', icon: '', group: 0 }, { id: 'last', label: 'Last', icon: '', group: 0 }]
  const props = { title: 'Settings', base: '/settings', entries }
  const view = render(<PageDirectory {...props} selected="first"/>)
  const nav = screen.getByRole('navigation')
  Object.defineProperties(nav, { clientWidth: { value: 200 }, scrollWidth: { value: 400 } })
  vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({ left: 20, right: 220 } as DOMRect)
  vi.spyOn(screen.getByRole('link', { name: 'Last' }), 'getBoundingClientRect').mockReturnValue({ left: 270, right: 370 } as DOMRect)
  const scroll = vi.spyOn(window, 'scrollTo')
  view.rerender(<PageDirectory {...props} selected="last"/>)
  expect(nav.scrollLeft).toBe(150)
  expect(scroll).not.toHaveBeenCalled()
})
