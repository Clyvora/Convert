import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Updates from './Updates'
import { betaUpdate, browserUpdate, bugFixUpdate } from '../core/updates'

beforeEach(() => {
  history.replaceState(null, '', '/updates')
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  vi.spyOn(window, 'scrollTo')
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('navigates all three updates in both directions without native anchor scrolling', async () => {
  const user = userEvent.setup()
  render(<Updates/>)
  expect(screen.getByRole('heading', { name: browserUpdate.title })).toHaveFocus()
  expect(screen.queryByRole('link', { name: /Previous page/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: `Next page: ${bugFixUpdate.version}` }))
  expect(location.hash).toBe(`#${bugFixUpdate.id}`)
  expect(screen.getByRole('heading', { name: bugFixUpdate.title })).toHaveFocus()
  expect(screen.getByRole('link', { name: `Previous page: ${browserUpdate.version}` })).toBeVisible()
  await user.click(screen.getByRole('link', { name: `Next page: ${betaUpdate.version}` }))
  expect(screen.getByRole('heading', { name: betaUpdate.title })).toBeVisible()
  expect(screen.queryByRole('link', { name: /Next page/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: `Previous page: ${bugFixUpdate.version}` }))
  await user.click(screen.getByRole('link', { name: `Previous page: ${browserUpdate.version}` }))
  expect(screen.getByRole('heading', { name: browserUpdate.title })).toHaveFocus()
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
})

it.each([betaUpdate, bugFixUpdate])('preserves the existing $version deep link', release => {
  history.replaceState(null, '', `/updates#${release.id}`)
  render(<Updates/>)
  expect(screen.getByRole('heading', { name: release.title })).toBeVisible()
})
