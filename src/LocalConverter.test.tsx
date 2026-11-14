import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import LocalConverter from './LocalConverter'
import type { ConversionEngine } from './core/types'

const engine = vi.hoisted(() => ({ convert: vi.fn<ConversionEngine['convert']>(), dispose: vi.fn(), cancel: vi.fn() }))
vi.mock('./engines/audio', () => ({ MediaConversionEngine: class {
  convert = engine.convert
  dispose = engine.dispose
  cancel = engine.cancel
} }))

function wavFile(name = 'sample.wav') {
  const bytes = new Uint8Array(16)
  bytes.set([0x52, 0x49, 0x46, 0x46]); bytes.set([0x57, 0x41, 0x56, 0x45], 8)
  return new File([bytes], name, { type: 'audio/wav' })
}
async function addFiles(files = [wavFile()]) {
  const view = render(<LocalConverter active onShow={() => {}}/>)
  fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files } })
  await screen.findByRole('button', { name: `Convert ${files.length}` })
  return view
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:local-result') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  engine.convert.mockImplementation(async (_file, _detected, _options, _signal, progress) => {
    progress(0.2, 'Converting audio')
    return new Blob(['converted audio'])
  })
})

it('applies settings to compatible waiting files without changing a completed result', async () => {
  engine.convert.mockResolvedValueOnce(new Blob(['audio'], { type: 'audio/mpeg' }))
  engine.convert.mockRejectedValueOnce(new Error('Please retry'))
  await addFiles([wavFile('done.wav'), wavFile('waiting.wav')])
  fireEvent.click(screen.getByRole('button', { name: 'Convert 2' }))
  await screen.findByRole('button', { name: 'Convert 1' })
  fireEvent.change(screen.getByLabelText('Output format for waiting.wav'), { target: { value: 'flac' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add files' }))
  const input = document.querySelector('input[type=file]')!
  fireEvent.change(input, { target: { files: [wavFile('third.wav')] } })
  await screen.findByRole('button', { name: 'Convert 2' })
  fireEvent.click(screen.getByRole('button', { name: 'Options for waiting.wav' }))
  fireEvent.click(screen.getByRole('button', { name: 'Apply to 1 compatible file' }))
  expect(screen.getByLabelText('Output format for third.wav')).toHaveValue('flac')
  expect(screen.getByLabelText('Output format for done.wav')).toHaveValue('mp3')
})

it('clears only completed files and releases their preview URLs', async () => {
  engine.convert.mockResolvedValueOnce(new Blob(['audio']))
  engine.convert.mockRejectedValueOnce(new Error('Please retry'))
  await addFiles([wavFile('done.wav'), wavFile('retry.wav')])
  fireEvent.click(screen.getByRole('button', { name: 'Convert 2' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Clear completed' }))
  expect(screen.queryByText('done.wav')).not.toBeInTheDocument()
  expect(screen.getByText('retry.wav')).toBeVisible()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-result')
})

it('opens supported previews and stops playback when leaving local conversion', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably')
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  engine.convert.mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }))
  const view = await addFiles()
  fireEvent.click(screen.getByRole('button', { name: 'Convert 1' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Preview' }))
  expect(screen.getByLabelText('Preview sample.mp3')).toHaveAttribute('src', 'blob:local-result')
  view.rerender(<LocalConverter active={false} onShow={() => {}}/>)
  await waitFor(() => expect(screen.queryByLabelText('Preview sample.mp3')).not.toBeInTheDocument())
  expect(pause).toHaveBeenCalledOnce()
})

it('honors manual downloads and reports completed files accurately', async () => {
  localStorage.setItem('clyvora-convert-interface-v1', JSON.stringify({ autoDownload: false }))
  await addFiles()
  fireEvent.click(screen.getByRole('button', { name: 'Convert 1' }))
  expect(await screen.findByText('Complete', { exact: true })).toBeVisible()
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: '1 file complete.' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Download' }))
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce()
})

it('can prepare a completed file for a different conversion without selecting it again', async () => {
  const user = userEvent.setup()
  await addFiles()
  await user.click(screen.getByRole('button', { name: 'Convert 1' }))
  await user.click(await screen.findByRole('button', { name: 'Convert again' }))
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-result')
  expect(screen.getByLabelText('Output format for sample.wav')).toBeEnabled()
  await user.selectOptions(screen.getByLabelText('Output format for sample.wav'), 'flac')
  await user.click(screen.getByRole('button', { name: 'Convert 1' }))
  await waitFor(() => expect(engine.convert).toHaveBeenCalledTimes(2))
  expect(engine.convert.mock.calls[1][2].outputFormat).toBe('flac')
})

it('disables ignored bitrate controls for lossless output and keeps the prior lossy choice', async () => {
  const user = userEvent.setup()
  await addFiles()
  await user.click(screen.getByRole('button', { name: 'Options for sample.wav' }))
  await user.click(screen.getByRole('radio', { name: 'Higher 320 kbps' }))
  await user.click(within(screen.getByRole('group', { name: 'Output format' })).getByRole('radio', { name: 'FLAC' }))
  expect(screen.getByRole('radio', { name: 'Higher 320 kbps' })).toBeDisabled()
  expect(screen.getByText(/Bitrate does not apply to FLAC/)).toBeVisible()
  await user.click(screen.getByText('Advanced audio'))
  expect(screen.getByRole('combobox', { name: 'Audio bitrate' })).toBeDisabled()
  await user.click(within(screen.getByRole('group', { name: 'Output format' })).getByRole('radio', { name: 'MP3' }))
  expect(screen.getByRole('radio', { name: 'Higher 320 kbps' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Higher 320 kbps' })).toBeEnabled()
})

it('shows unknown engine progress without inventing a percentage', async () => {
  let finish!: (blob: Blob) => void
  engine.convert.mockImplementation((_file, _detected, _options, _signal, progress) => {
    progress(null, 'Loading local media engine')
    return new Promise(resolve => { finish = resolve })
  })
  await addFiles()
  fireEvent.click(screen.getByRole('button', { name: 'Convert 1' }))
  expect(await screen.findByRole('progressbar')).not.toHaveAttribute('value')
  await act(async () => { finish(new Blob(['audio'])) })
  expect(screen.getByText('Complete', { exact: true })).toBeVisible()
})

it('stops a batch after cancellation and retries the remaining files once', async () => {
  engine.convert.mockImplementationOnce((_file, _detected, _options, signal, progress) => {
    progress(null, 'Loading local media engine')
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Worker terminated'))))
  })
  await addFiles([wavFile('first.wav'), wavFile('second.wav')])
  fireEvent.click(screen.getByRole('button', { name: 'Convert 2' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel conversion' }))
  await screen.findByRole('button', { name: 'Convert 2' })
  expect(engine.convert).toHaveBeenCalledOnce()
  expect(screen.getByRole('alert')).toHaveTextContent('Conversion cancelled')
  fireEvent.click(screen.getByRole('button', { name: 'Convert 2' }))
  await waitFor(() => expect(screen.getAllByText('Complete', { exact: true })).toHaveLength(2))
  expect(engine.convert).toHaveBeenCalledTimes(3)
})

it('ignores late progress from cancelled work after a retry starts', async () => {
  let oldProgress!: Parameters<ConversionEngine['convert']>[4]
  let finish!: (blob: Blob) => void
  engine.convert.mockImplementationOnce((_file, _detected, _options, signal, progress) => {
    oldProgress = progress
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
  }).mockImplementationOnce((_file, _detected, _options, _signal, progress) => {
    progress(null, 'Loading local media engine')
    return new Promise(resolve => { finish = resolve })
  })
  await addFiles()
  fireEvent.click(screen.getByRole('button', { name: 'Convert 1' }))
  await waitFor(() => expect(engine.convert).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: 'Cancel conversion' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Convert 1' }))
  await waitFor(() => expect(engine.convert).toHaveBeenCalledTimes(2))
  act(() => oldProgress(0.9, 'Old conversion progress'))
  expect(screen.queryByText('Old conversion progress')).not.toBeInTheDocument()
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('value')
  await act(async () => { finish(new Blob(['new result'])) })
  expect(screen.getByText('Complete', { exact: true })).toBeVisible()
})

it('does not download or start remaining work after the converter is closed', async () => {
  let finish!: (blob: Blob) => void
  engine.convert.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = await addFiles([wavFile('first.wav'), wavFile('second.wav')])
  fireEvent.click(screen.getByRole('button', { name: 'Convert 2' }))
  await waitFor(() => expect(engine.convert).toHaveBeenCalledOnce())
  view.unmount()
  await act(async () => { finish(new Blob(['late result'])) })
  expect(engine.dispose).toHaveBeenCalledOnce()
  expect(engine.convert).toHaveBeenCalledOnce()
  expect(URL.createObjectURL).not.toHaveBeenCalled()
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
})

it('continues after one file fails and retries it without repeating completed work', async () => {
  engine.convert.mockRejectedValueOnce(new Error('Unsupported codec'))
  await addFiles([wavFile('first.wav'), wavFile('second.wav')])
  fireEvent.click(screen.getByRole('button', { name: 'Convert 2' }))
  await screen.findByText('Complete', { exact: true })
  expect(screen.getByRole('alert')).toHaveTextContent('Unsupported codec')
  fireEvent.click(screen.getByRole('button', { name: 'Convert 1' }))
  await waitFor(() => expect(screen.getAllByText('Complete', { exact: true })).toHaveLength(2))
  expect(engine.convert.mock.calls.map(([file]) => file.name)).toEqual(['first.wav', 'second.wav', 'first.wav'])
})
