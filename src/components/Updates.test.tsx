import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Updates from './Updates'
import { betaUpdate, browserUpdate, bugFixUpdate, polishUpdate, servicesUpdate, convertArchive } from '../core/updates'
import { version } from '../../package.json'

beforeEach(() => {
  history.replaceState(null, '', '/updates')
  vi.spyOn(window, 'scrollTo')
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('navigates releases and the Convert archive in both directions without native anchor scrolling', async () => {
  const user = userEvent.setup()
  render(<Updates/>)
  expect(screen.getByRole('heading', { name: servicesUpdate.title })).toHaveFocus()
  expect(servicesUpdate.version).toBe(version)
  expect(screen.getByRole('option', { name: `${version} (latest)` })).toHaveProperty('selected', true)
  expect(screen.queryByRole('link', { name: /Previous page/ })).not.toBeInTheDocument()
  const releases = [servicesUpdate, polishUpdate, browserUpdate, bugFixUpdate, betaUpdate, ...convertArchive]
  for (const release of releases.slice(1)) {
    await user.click(screen.getByRole('link', { name: `Next page: ${release.version}` }))
    expect(location.hash).toBe(`#${release.id}`)
    expect(screen.getByRole('heading', { name: release.title })).toHaveFocus()
  }
  expect(screen.queryByRole('link', { name: /Next page/ })).not.toBeInTheDocument()
  for (const release of releases.slice(0, -1).reverse()) {
    await user.click(screen.getByRole('link', { name: `Previous page: ${release.version}` }))
    expect(location.hash).toBe(`#${release.id}`)
    expect(screen.getByRole('heading', { name: release.title })).toHaveFocus()
  }
  expect(screen.queryByRole('link', { name: /Previous page/ })).not.toBeInTheDocument()
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
})

it.each(convertArchive)('opens the $version archive directly without update images', release => {
  history.replaceState(null, '', `/updates#${release.id}`)
  const { container } = render(<Updates/>)
  expect(screen.getByRole('heading', { name: release.title })).toHaveFocus()
  expect(screen.getByRole('combobox', { name: 'Release' })).toHaveValue(release.id)
  expect(screen.getByText(/Reconstructed from the project/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'View original changes on GitHub.' })).toHaveAttribute('href', `https://github.com/Clyvora/Convert/commit/${release.commit}`)
  expect(container.querySelector('article img')).toBeNull()
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
