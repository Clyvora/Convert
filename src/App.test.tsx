// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'

function pngFile(name = 'sample.png'): File {
  const header = new ArrayBuffer(8)
  new Uint8Array(header).set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return new File([header], name, { type: 'image/png' })
}

describe('Clyvora Convert interface', () => {
  it('puts the product, local-processing promise, file picker, and formats in the initial UI', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: /convert files locally/i })).toBeVisible()
    expect(screen.getByText(/your files never leave this device/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /choose files/i })).toBeEnabled()
    expect(screen.getAllByText(/PNG/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/MP3/).length).toBeGreaterThan(0)
  })

  it('adds a signature-validated file to an operable conversion workspace', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()

    await user.upload(input!, pngFile())

    expect(await screen.findByRole('heading', { name: /1 file in queue/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /configure sample\.png/i })).toBeEnabled()
    expect(screen.getByLabelText(/output format/i)).toHaveValue('jpg')
    expect(screen.getByRole('button', { name: /convert file/i })).toBeEnabled()
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
