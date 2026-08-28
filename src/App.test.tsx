// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const engineState = vi.hoisted(() => ({ cancelFirst: false, calls: 0 }))

vi.mock('./engines/audio', () => ({
  MediaConversionEngine: class {
    async convert(_file: File, _detected: unknown, _options: unknown, signal: AbortSignal, progress: (value: number, label: string) => void) {
      engineState.calls += 1
      progress(0.2, 'Converting audio')
      if (engineState.cancelFirst && engineState.calls === 1) {
        await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }))
      }
      return new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })
    }
    cancel() {}
    dispose() {}
  },
}))

function wavFile(name = 'sample.wav'): File {
  const bytes = new Uint8Array(16)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  bytes.set([0x57, 0x41, 0x56, 0x45], 8)
  return new File([bytes], name, { type: 'audio/wav' })
}

function pngFile(): File {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'image.png', { type: 'image/png' })
}

describe('Clyvora Convert', () => {
  beforeEach(() => {
    localStorage.clear()
    engineState.cancelFirst = false
    engineState.calls = 0
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:clyvora-result') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  it('presents only the local audio and video journey', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: /convert media without uploading it/i })).toBeVisible()
    expect(screen.getByText(/mp3, wav, ogg, opus, mp4, or webm/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /paste link/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/png|jpeg|image resizing/i)).not.toBeInTheDocument()
  })

  it('adds an audio file and exposes compatible output formats', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, wavFile())
    expect(await screen.findByRole('heading', { name: /1 file ready/i })).toBeVisible()
    expect(screen.getByLabelText(/output format for sample.wav/i)).toHaveValue('mp3')
    expect(screen.getByRole('button', { name: /options for sample.wav/i })).toBeEnabled()
  })

  it('rejects image files instead of retaining hidden image conversion', async () => {
    const { container } = render(<App />)
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [pngFile()] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/supported audio or video format/i)
    expect(screen.queryByText(/file ready/i)).not.toBeInTheDocument()
  })

  it('downloads a completed conversion automatically', async () => {
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { container } = render(<App />)
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, wavFile())
    await user.click(await screen.findByRole('button', { name: /^convert 1$/i }))
    expect(await screen.findByText(/^complete$/i)).toBeVisible()
    expect(click).toHaveBeenCalledOnce()
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('sample.mp3')
  })

  it('can cancel a conversion and immediately retry successfully', async () => {
    engineState.cancelFirst = true
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, wavFile())
    await user.click(await screen.findByRole('button', { name: /^convert 1$/i }))
    await user.click(await screen.findByRole('button', { name: /cancel conversion/i }))
    expect(await screen.findByText(/^cancelled$/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^convert 1$/i }))
    expect(await screen.findByText(/^complete$/i)).toBeVisible()
    expect(engineState.calls).toBe(2)
  })

  it('moves focus into options and restores it when closed', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, wavFile())
    const trigger = await screen.findByRole('button', { name: /options for sample.wav/i })
    await user.click(trigger)
    const close = screen.getByRole('button', { name: /close options/i })
    await waitFor(() => expect(close).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
