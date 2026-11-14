import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Updates from './Updates'
import { batchUpdate, betaUpdate, browserUpdate, bugFixUpdate, polishUpdate, servicesUpdate, convertArchive } from '../core/updates'
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
  expect(screen.getByRole('heading', { name: batchUpdate.title })).toHaveFocus()
  expect(batchUpdate.version).toBe(version)
  expect(screen.getByText(version, { selector: '.release-version' })).toBeVisible()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Previous page/ })).not.toBeInTheDocument()
  const releases = [batchUpdate, servicesUpdate, polishUpdate, browserUpdate, bugFixUpdate, betaUpdate, ...convertArchive]
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

it.each([betaUpdate, bugFixUpdate, browserUpdate, polishUpdate, servicesUpdate])('preserves the existing $version deep link', release => {
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

it('shows the full article below the image and returns to the latest release', async () => {
  const user = userEvent.setup()
  const { container } = render(<Updates/>)
  expect(screen.queryByRole('heading', { name: 'What’s new' })).not.toBeInTheDocument()
  expect(container.querySelector('details')).toBeNull()
  const image = container.querySelector('.beta-update-banner')!
  const notes = container.querySelector('.update-release-notes')!
  expect(image.nextElementSibling).toBe(notes)
  expect(screen.getByRole('heading', { name: 'Queue and collections' })).toBeVisible()
  await user.click(screen.getByRole('link', { name: `Next page: ${servicesUpdate.version}` }))
  await user.click(screen.getByRole('link', { name: 'Go to latest update' }))
  expect(screen.getByRole('heading', { name: batchUpdate.title })).toHaveFocus()
  expect(screen.getByRole('heading', { name: 'Queue and collections' })).toBeVisible()
})

it('keeps tools, queue and local conversion details visible without duplicated highlights', () => {
  render(<Updates/>)
  expect(screen.getByRole('heading', { name: 'Tools' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Queue and collections' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Your local files' })).toBeVisible()
  expect(screen.getByText(/Apply your current settings/)).toBeVisible()
  expect(screen.getByText(/Retry failed, partial and interrupted/)).toBeVisible()
  expect(screen.queryByText('Latest update')).not.toBeInTheDocument()
})

it('names adjacent releases before opening them', async () => {
  const user = userEvent.setup()
  render(<Updates/>)
  const navigation = within(screen.getByRole('navigation', { name: 'Browse updates' }))
  expect(navigation.getByRole('link', { name: `Next page: ${servicesUpdate.version}` })).toHaveAttribute('title', servicesUpdate.title)
  await user.click(navigation.getByRole('link', { name: `Next page: ${servicesUpdate.version}` }))
  expect(navigation.getByRole('link', { name: `Previous page: ${batchUpdate.version}` })).toHaveAttribute('title', batchUpdate.title)
  expect(navigation.getByRole('link', { name: `Next page: ${polishUpdate.version}` })).toHaveAttribute('title', polishUpdate.title)
})

it('copies the selected archive permalink and resets confirmation after navigation', async () => {
  const user = userEvent.setup()
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
  const archive = convertArchive[0]
  history.replaceState(null, '', `/updates#${archive.id}`)
  render(<Updates/>)
  await user.click(screen.getByRole('button', { name: 'Copy update link' }))
  expect(write).toHaveBeenCalledWith(`${location.origin}/updates#${archive.id}`)
  expect(screen.getByRole('status')).toHaveTextContent('Link copied')
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
  expect(link).toHaveValue(`${location.origin}/updates#${batchUpdate.id}`)
  await user.click(link)
  expect(link.selectionEnd! - link.selectionStart!).toBe(link.value.length)
})

it('ignores a clipboard response that finishes after changing releases', async () => {
  const user = userEvent.setup()
  let finish = () => {}
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  render(<Updates/>)
  await user.click(screen.getByRole('button', { name: 'Copy update link' }))
  await user.click(screen.getByRole('link', { name: `Next page: ${servicesUpdate.version}` }))
  await act(async () => finish())
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})
