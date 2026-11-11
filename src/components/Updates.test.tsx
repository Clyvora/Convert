import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Updates from './Updates'
import { betaUpdate, browserUpdate, bugFixUpdate, polishUpdate, servicesUpdate } from '../core/updates'
import { version } from '../../package.json'

beforeEach(() => {
  history.replaceState(null, '', '/updates')
  vi.spyOn(window, 'scrollTo')
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('navigates all five updates in both directions without native anchor scrolling', async () => {
  const user = userEvent.setup()
  render(<Updates/>)
  expect(screen.getByRole('heading', { name: servicesUpdate.title })).toHaveFocus()
  expect(servicesUpdate.version).toBe(version)
  expect(screen.getByRole('option', { name: `${version} (latest)` })).toHaveProperty('selected', true)
  expect(screen.queryByRole('link', { name: /Previous page/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: `Next page: ${polishUpdate.version}` }))
  expect(location.hash).toBe(`#${polishUpdate.id}`)
  expect(screen.getByRole('heading', { name: polishUpdate.title })).toHaveFocus()
  await user.click(screen.getByRole('link', { name: `Next page: ${browserUpdate.version}` }))
  expect(location.hash).toBe(`#${browserUpdate.id}`)
  expect(screen.getByRole('heading', { name: browserUpdate.title })).toHaveFocus()
  await user.click(screen.getByRole('link', { name: `Next page: ${bugFixUpdate.version}` }))
  expect(location.hash).toBe(`#${bugFixUpdate.id}`)
  expect(screen.getByRole('heading', { name: bugFixUpdate.title })).toHaveFocus()
  expect(screen.getByRole('link', { name: `Previous page: ${browserUpdate.version}` })).toBeVisible()
  await user.click(screen.getByRole('link', { name: `Next page: ${betaUpdate.version}` }))
  expect(screen.getByRole('heading', { name: betaUpdate.title })).toBeVisible()
  expect(screen.queryByRole('link', { name: /Next page/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: `Previous page: ${bugFixUpdate.version}` }))
  await user.click(screen.getByRole('link', { name: `Previous page: ${browserUpdate.version}` }))
  await user.click(screen.getByRole('link', { name: `Previous page: ${polishUpdate.version}` }))
  expect(screen.getByRole('heading', { name: polishUpdate.title })).toHaveFocus()
  await user.click(screen.getByRole('link', { name: `Previous page: ${servicesUpdate.version}` }))
  expect(screen.getByRole('heading', { name: servicesUpdate.title })).toHaveFocus()
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
})

it.each([betaUpdate, bugFixUpdate, browserUpdate, polishUpdate])('preserves the existing $version deep link', release => {
  history.replaceState(null, '', `/updates#${release.id}`)
  render(<Updates/>)
  expect(screen.getByRole('heading', { name: release.title })).toBeVisible()
})

it('keeps the release picker in sync with page links and browser history', async () => {
  const user = userEvent.setup()
  render(<Updates/>)
  const picker = screen.getByRole('combobox', { name: 'Release' })
  await user.selectOptions(picker, betaUpdate.id)
  expect(location.hash).toBe(`#${betaUpdate.id}`)
  expect(screen.getByRole('heading', { name: betaUpdate.title })).toHaveFocus()
  await user.click(screen.getByRole('link', { name: `Previous page: ${bugFixUpdate.version}` }))
  expect(picker).toHaveValue(bugFixUpdate.id)
  history.back()
  await waitFor(() => expect(picker).toHaveValue(betaUpdate.id))
  expect(screen.getByRole('heading', { name: betaUpdate.title })).toHaveFocus()
})
