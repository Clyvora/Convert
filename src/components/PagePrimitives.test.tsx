import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PageDirectory } from './PagePrimitives'
import userEvent from '@testing-library/user-event'
import AboutPage from './AboutPage'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('reveals an off-screen selected category without scrolling the page', () => {
  const entries = [{ id: 'first', label: 'First', icon: 'about', group: 0 }, { id: 'last', label: 'Last', icon: 'settings', group: 0 }] as const
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

it('opens About sections from the compact picker and restores deep links through history', async () => {
  history.replaceState(null, '', '/about/privacy')
  const user = userEvent.setup()
  render(<AboutPage/>)
  const picker = screen.getByRole('combobox', { name: 'About section' })
  expect(picker).toHaveValue('privacy')
  expect(screen.getByRole('article', { name: 'Privacy policy' })).toBeVisible()
  await user.selectOptions(picker, 'credits')
  expect(location.pathname).toBe('/about/credits')
  expect(screen.getByRole('article', { name: 'Thanks & licenses' })).toBeVisible()
  history.back()
  await waitFor(() => expect(picker).toHaveValue('privacy'))
  expect(screen.getByRole('article', { name: 'Privacy policy' })).toBeVisible()
})
