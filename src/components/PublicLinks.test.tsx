// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import PublicLinks from './PublicLinks'
import { downloadMedia, resolveMedia } from '../core/mediaClient'

vi.mock('../core/mediaClient', () => ({ resolveMedia: vi.fn(), downloadMedia: vi.fn() }))
beforeEach(() => vi.resetAllMocks())

it('replaces file selection while typing and restores it when cleared', async () => {
  const user = userEvent.setup()
  const choose = vi.fn()
  render(<PublicLinks onFile={vi.fn()} onChooseFiles={choose} />)
  await user.click(screen.getByRole('button', { name: 'Choose files' }))
  expect(choose).toHaveBeenCalledOnce()
  await user.type(screen.getByRole('textbox', { name: 'SoundCloud link' }), 's')
  expect(screen.queryByRole('button', { name: 'Choose files' })).not.toBeInTheDocument()
  expect(resolveMedia).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Clear link' }))
  expect(screen.getByRole('button', { name: 'Choose files' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'SoundCloud link' })).toHaveFocus()
})

it('adds retrieved media to the local queue only after submission', async () => {
  const user = userEvent.setup()
  const onFile = vi.fn().mockResolvedValue(undefined)
  vi.mocked(resolveMedia).mockResolvedValue({ title: 'Demo track' } as Awaited<ReturnType<typeof resolveMedia>>)
  vi.mocked(downloadMedia).mockResolvedValue({ blob: new Blob(['audio'], { type: 'audio/mpeg' }), filename: 'demo.mp3' })
  render(<PublicLinks onFile={onFile} onChooseFiles={vi.fn()} />)
  await user.type(screen.getByRole('textbox', { name: 'SoundCloud link' }), 'https://soundcloud.com/demo/track')
  expect(resolveMedia).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Retrieve track' }))
  await waitFor(() => expect(onFile).toHaveBeenCalledOnce())
  expect(onFile.mock.calls[0][0]).toMatchObject({ name: 'demo.mp3', type: 'audio/mpeg' })
})

it('cancels retrieval and leaves the link available for retry', async () => {
  const user = userEvent.setup()
  vi.mocked(resolveMedia).mockImplementation((_url, signal) => new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
  }))
  render(<PublicLinks onFile={vi.fn()} onChooseFiles={vi.fn()} />)
  await user.type(screen.getByRole('textbox', { name: 'SoundCloud link' }), 'https://soundcloud.com/demo/track')
  await user.click(screen.getByRole('button', { name: 'Retrieve track' }))
  await user.click(screen.getByRole('button', { name: 'Cancel retrieval' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Retrieval cancelled')
  expect(screen.getByRole('button', { name: 'Retrieve track' })).toBeEnabled()
  expect(downloadMedia).not.toHaveBeenCalled()
})
