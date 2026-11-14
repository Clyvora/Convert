import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import LocalPreview from './LocalPreview'

it('keeps the source after Strict Mode cleanup and releases playback when closed', () => {
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  const view = render(<StrictMode><LocalPreview url="blob:local-result" mime="audio/mpeg" name="sample.mp3"/></StrictMode>)
  expect(screen.getByLabelText('Preview sample.mp3')).toHaveAttribute('src', 'blob:local-result')
  fireEvent.error(screen.getByLabelText('Preview sample.mp3'))
  expect(screen.getByRole('status')).toHaveTextContent('You can still download it')
  view.unmount()
  expect(pause).toHaveBeenCalledTimes(2)
})
