import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import Services from './Services'

afterEach(cleanup)

it('connects the selected service to its visible description and clears the previous selection', async () => {
  const user = userEvent.setup()
  render(<Services/>)
  const spotify = screen.getByRole('button', { name: 'Spotify' })
  const soundcloud = screen.getByRole('button', { name: 'SoundCloud' })
  await user.click(spotify)
  expect(spotify).toHaveAttribute('aria-pressed', 'true')
  expect(spotify).toHaveAccessibleDescription(/YouTube/)
  await user.click(soundcloud)
  expect(spotify).toHaveAttribute('aria-pressed', 'false')
  expect(spotify).not.toHaveAttribute('aria-describedby')
  expect(soundcloud).toHaveAttribute('aria-pressed', 'true')
  expect(soundcloud).toHaveAccessibleDescription(/Public audio tracks/)
  expect(screen.getByRole('status')).toHaveTextContent('SoundCloud')
})

it('restores the selection hint when a service is toggled off and explains access limits', async () => {
  const user = userEvent.setup()
  render(<Services/>)
  const button = screen.getByRole('button', { name: 'YouTube' })
  await user.click(button)
  await user.click(button)
  expect(button).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('status')).toHaveTextContent('Choose a service')
  expect(screen.getByText(/Private and sign-in-required videos aren't supported/)).toBeVisible()
})
