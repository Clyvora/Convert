// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import App from './App'

function pngFile(name = 'sample.png'): File {
  const header = new ArrayBuffer(8)
  new Uint8Array(header).set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return new File([header], name, { type: 'image/png' })
}

describe('Clyvora Convert interface', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the initial UI focused on the product promise and file picker', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: /convert media without uploading it/i })).toBeVisible()
    expect(screen.getByText(/file contents and names stay on this device/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /choose files/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /paste link/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^settings$/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/private by design/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /source/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try a sample image/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /paste an image/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/supported formats and privacy/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/automatic input detection and output selection/i)).not.toBeInTheDocument()
  })

  it('adds a signature-validated file to an operable conversion workspace', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()

    await user.upload(input!, pngFile())

    expect(await screen.findByRole('heading', { name: /1 file in queue/i })).toBeVisible()
    expect(screen.getByLabelText(/output format for sample\.png/i)).toHaveValue('jpg')
    expect(screen.getByRole('button', { name: /^options$/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^convert/i })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: /convert media without uploading/i })).not.toBeInTheDocument()
  })

  it('opens contextual image options without duplicating the output selector', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    await user.upload(input!, pngFile())
    await user.click(await screen.findByRole('button', { name: /^options$/i }))
    expect(screen.getByRole('dialog', { name: /sample\.png/i })).toBeVisible()
    expect(screen.getAllByRole('group')[0].querySelectorAll('button').length).toBeGreaterThan(1)
    expect(container.querySelectorAll('select')).toHaveLength(1)
  })

  it('remembers compatible conversion choices automatically', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    await user.upload(input, pngFile('first.png'))
    await user.selectOptions(screen.getByLabelText(/output format for first\.png/i), 'webp')
    await user.click(screen.getByRole('button', { name: /remove first\.png/i }))
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, pngFile('second.png'))
    expect(await screen.findByLabelText(/output format for second\.png/i)).toHaveValue('webp')
  })

  it('moves focus into dialogs, restores it on close, and hides background controls', async () => {
    const user = userEvent.setup()
    render(<App />)
    const trigger = screen.getByRole('button', { name: /paste link/i })
    await user.click(trigger)
    const close = screen.getByRole('button', { name: /close link importer/i })
    await waitFor(() => expect(close).toHaveFocus())
    expect(screen.queryByRole('button', { name: /choose files/i })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('uses the brand control to leave the queue and return home', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, pngFile())
    expect(await screen.findByRole('heading', { name: /1 file in queue/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /clyvora convert home/i }))
    expect(await screen.findByRole('heading', { name: /convert media without uploading/i })).toBeVisible()
  })

  it('announces a renamed-file rejection and allows dismissing it', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')

    await user.upload(input!, pngFile('renamed.jpg'))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/filename says/i)
    await user.click(screen.getByRole('button', { name: /dismiss message/i }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
