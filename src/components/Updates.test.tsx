import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
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
  const pages = within(screen.getByRole('navigation', { name: 'Browse updates' }))
  expect(screen.getByRole('heading', { name: servicesUpdate.title })).toHaveFocus()
  expect(servicesUpdate.version).toBe(version)
  expect(screen.getByText(version, { selector: '.release-version' })).toBeVisible()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Previous page/ })).not.toBeInTheDocument()
  const releases = [servicesUpdate, polishUpdate, browserUpdate, bugFixUpdate, betaUpdate, ...convertArchive]
  for (const release of releases.slice(1)) {
    await user.click(pages.getByRole('link', { name: `Next page: ${release.version}` }))
    expect(location.hash).toBe(`#${release.id}`)
    expect(screen.getByRole('heading', { level: 2, name: release.title })).toHaveFocus()
  }
  expect(screen.queryByRole('link', { name: /Next page/ })).not.toBeInTheDocument()
  for (const release of releases.slice(0, -1).reverse()) {
    await user.click(pages.getByRole('link', { name: `Previous page: ${release.version}` }))
    expect(location.hash).toBe(`#${release.id}`)
    expect(screen.getByRole('heading', { level: 2, name: release.title })).toHaveFocus()
  }
  expect(screen.queryByRole('link', { name: /Previous page/ })).not.toBeInTheDocument()
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
// This visits every release in both directions alongside the other UI suites.
}, 15000)

it.each(convertArchive)('opens the $version archive directly without update images', release => {
  history.replaceState(null, '', `/updates#${release.id}`)
  const { container } = render(<Updates/>)
  expect(screen.getByRole('heading', { name: release.title })).toHaveFocus()
  expect(screen.getByText(release.version, { selector: '.release-version' })).toBeVisible()
  expect(screen.getByText(/Reconstructed from the project/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'View original changes on GitHub.' })).toHaveAttribute('href', `https://github.com/Clyvora/Convert/commit/${release.commit}`)
  expect(container.querySelector('article img')).toBeNull()
})

it.each([betaUpdate, bugFixUpdate, browserUpdate, polishUpdate])('preserves the existing $version deep link', release => {
  history.replaceState(null, '', `/updates#${release.id}`)
  render(<Updates/>)
  expect(screen.getByRole('heading', { name: release.title })).toBeVisible()
})

it('keeps the version label in sync with page links and browser history', async () => {
  const user = userEvent.setup()
  history.replaceState(null, '', `/updates#${betaUpdate.id}`)
  render(<Updates/>)
  expect(location.hash).toBe(`#${betaUpdate.id}`)
  expect(screen.getByRole('heading', { name: betaUpdate.title })).toHaveFocus()
  await user.click(screen.getByRole('link', { name: `Previous page: ${bugFixUpdate.version}` }))
  expect(screen.getByText(bugFixUpdate.version, { selector: '.release-version' })).toBeVisible()
  history.back()
  await waitFor(() => expect(screen.getByText(betaUpdate.version, { selector: '.release-version' })).toBeVisible())
  expect(screen.getByRole('heading', { name: betaUpdate.title })).toHaveFocus()
})

it('starts with highlights, keeps the full notes available, and returns to the latest release', async () => {
  const user = userEvent.setup()
  render(<Updates/>)
  expect(screen.getByRole('heading', { name: 'What’s new' })).toBeVisible()
  expect(screen.getByText('Services and collections')).not.toBeVisible()
  await user.click(screen.getByText('Full release notes'))
  expect(screen.getByRole('heading', { name: 'Services and collections' })).toBeVisible()
  await user.click(screen.getByRole('link', { name: `Next page: ${polishUpdate.version}` }))
  await user.click(screen.getByRole('link', { name: 'Go to latest update' }))
  expect(screen.getByRole('heading', { name: servicesUpdate.title })).toHaveFocus()
  expect(screen.getByText('Services and collections')).not.toBeVisible()
})

it('includes queue and local conversion improvements in the visible summary', () => {
  render(<Updates/>)
  const highlights = within(screen.getByRole('heading', { name: 'What’s new' }).parentElement!)
  expect(highlights.getByText('Downloads')).toBeVisible()
  expect(highlights.getByText('Local conversion')).toBeVisible()
  expect(highlights.getByText(/Convert again, save manually/)).toBeVisible()
  expect(highlights.getByText(/Safer cancel and retry/)).toBeVisible()
  expect(screen.getByText('Latest update')).toBeVisible()
})

it('names adjacent releases before opening them', async () => {
  const user = userEvent.setup()
  render(<Updates/>)
  const navigation = within(screen.getByRole('navigation', { name: 'Browse updates' }))
  expect(navigation.getByText(polishUpdate.title)).toBeVisible()
  await user.click(navigation.getByRole('link', { name: `Next page: ${polishUpdate.version}` }))
  expect(navigation.getByText(servicesUpdate.title)).toBeVisible()
  expect(navigation.getByText(browserUpdate.title)).toBeVisible()
})

it('copies the selected archive permalink and resets confirmation after navigation', async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
  const archive = convertArchive[0]
  history.replaceState(null, '', `/updates#${archive.id}`)
  render(<Updates/>)
  await user.click(screen.getByRole('button', { name: 'Copy update link' }))
  expect(write).toHaveBeenCalledWith(`${location.origin}/updates#${archive.id}`)
  expect(screen.getByRole('status')).toHaveTextContent('Update link copied.')
  await user.click(screen.getByRole('link', { name: 'Go to latest update' }))
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('offers a selectable link when the clipboard is unavailable', async () => {
  const user = userEvent.setup()
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Clipboard unavailable'))
  render(<Updates/>)
  await user.click(screen.getByRole('button', { name: 'Copy update link' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Copy the update link below.')
  const link = screen.getByRole('textbox', { name: 'Update link' }) as HTMLInputElement
  expect(link).toHaveValue(`${location.origin}/updates#${servicesUpdate.id}`)
  await user.click(link)
  expect(link.selectionEnd! - link.selectionStart!).toBe(link.value.length)
})

it('ignores a clipboard response that finishes after changing releases', async () => {
  const user = userEvent.setup()
  let finish = () => {}
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  render(<Updates/>)
  await user.click(screen.getByRole('button', { name: 'Copy update link' }))
  await user.click(screen.getByRole('link', { name: `Next page: ${polishUpdate.version}` }))
  await act(async () => finish())
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})
