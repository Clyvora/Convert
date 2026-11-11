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

it('combines service categories with link-type search and resets an empty result', async () => {
  const user = userEvent.setup()
  render(<Services/>)
  await user.click(screen.getByRole('button', { name: 'Music' }))
  expect(screen.getByText('3 of 15 services')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'YouTube' })).not.toBeInTheDocument()
  await user.type(screen.getByRole('searchbox', { name: 'Find a service' }), 'ALBUM')
  expect(screen.getByText('2 of 15 services')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Spotify' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Bandcamp' }))
  expect(screen.getByRole('status')).toHaveTextContent('Tracks · Albums')
  await user.type(screen.getByRole('searchbox'), ' xyz')
  expect(screen.getByText(/No services match/)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Reset filters' }))
  expect(screen.getByText('15 of 15 services')).toBeVisible()
  expect(screen.getByRole('searchbox')).toHaveFocus()
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(screen.getByRole('status')).toHaveTextContent('Choose a service')
})

it('finds services by aliases and limits the collection list to supported platforms', async () => {
  const user = userEvent.setup()
  render(<Services/>)
  await user.type(screen.getByRole('searchbox'), 'twitter')
  expect(screen.getByText('1 of 15 services')).toBeVisible()
  expect(screen.getByRole('button', { name: 'X / Twitter' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Clear service search' }))
  expect(screen.getByRole('searchbox')).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Collections' }))
  expect(screen.getByRole('button', { name: 'YouTube' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'SoundCloud' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Bandcamp' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Spotify' })).not.toBeInTheDocument()
})
