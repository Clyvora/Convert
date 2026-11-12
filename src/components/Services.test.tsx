import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import Services from './Services'

afterEach(cleanup)

it('shows support details on hover and removes them when leaving the icon', async () => {
  const user = userEvent.setup()
  render(<Services/>)
  const spotify = screen.getByRole('button', { name: 'Spotify' })
  const soundcloud = screen.getByRole('button', { name: 'SoundCloud' })
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  expect(screen.queryByText('Choose a service')).not.toBeInTheDocument()
  expect(screen.queryByText('Select a platform to see supported links and limits.')).not.toBeInTheDocument()
  expect(screen.queryByText(/Availability varies by link and format/)).not.toBeInTheDocument()
  await user.hover(spotify)
  expect(screen.getByRole('tooltip')).toHaveTextContent('Track links')
  expect(spotify).toHaveAccessibleDescription(/YouTube/)
  await user.unhover(spotify)
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  expect(spotify).not.toHaveAttribute('aria-describedby')
  await user.hover(soundcloud)
  expect(soundcloud).toHaveAccessibleDescription(/Public audio tracks/)
  expect(screen.getByRole('tooltip')).toHaveTextContent('Tracks · Playlists · Albums')
})

it('shows the same details for keyboard focus and clears them on blur', async () => {
  const user = userEvent.setup()
  render(<Services/>)
  await user.tab()
  const soundcloud = screen.getByRole('button', { name: 'SoundCloud' })
  expect(soundcloud).toHaveFocus()
  expect(soundcloud).toHaveAccessibleDescription(/Public audio tracks/)
  await user.tab()
  const button = screen.getByRole('button', { name: 'YouTube' })
  expect(button).toHaveFocus()
  expect(button).toHaveAccessibleDescription(/Videos · Shorts · Playlists/)
  expect(soundcloud).not.toHaveAttribute('aria-describedby')
})

it('allows a touch tap to reveal service details without hover', async () => {
  const user = userEvent.setup()
  render(<Services/>)
  const button = screen.getByRole('button', { name: 'YouTube' })
  await user.pointer({ target: button, keys: '[TouchA]' })
  expect(screen.getByRole('tooltip')).toHaveTextContent('Videos · Shorts · Playlists')
  expect(button).toHaveAccessibleDescription(/Public video and audio/)
})
