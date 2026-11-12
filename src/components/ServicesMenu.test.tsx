import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import ServicesMenu from './ServicesMenu'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function Harness() {
  const [open, setOpen] = useState(false)
  return <><input aria-label="Public link"/><ServicesMenu open={open} onOpenChange={setOpen}/><button>Outside</button></>
}

it('opens on hover without stealing focus and stays open across the gap until leaving the services area', async () => {
  const user = userEvent.setup()
  render(<Harness/>)
  const input = screen.getByRole('textbox')
  await user.click(input)
  const trigger = screen.getByRole('button', { name: 'Supported services' })
  await user.hover(trigger)
  const panel = screen.getByRole('dialog', { name: 'Supported services' })
  expect(input).toHaveFocus()
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Filter services' })).not.toBeInTheDocument()
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 250, top: 10, bottom: 50 } as DOMRect)
  vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ left: 40, right: 440, top: 70, bottom: 650 } as DOMRect)
  await user.pointer({ target: document.body, coords: { clientX: 175, clientY: 60 } })
  expect(panel).toBeInTheDocument()
  await user.hover(screen.getByRole('button', { name: 'Bandcamp' }))
  expect(panel).toBeInTheDocument()
  await user.pointer({ target: document.body, coords: { clientX: 500, clientY: 300 } })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(input).toHaveFocus()
})

it('supports touch without requiring hover and dismisses when tapping elsewhere', async () => {
  const user = userEvent.setup()
  render(<Harness/>)
  const trigger = screen.getByRole('button', { name: 'Supported services' })
  await user.pointer({ target: trigger, keys: '[TouchA>]' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.pointer({ keys: '[/TouchA]' })
  expect(screen.getByRole('dialog', { name: 'Supported services' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Outside' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus()
})

it('supports keyboard opening, Escape, and tabbing out without trapping focus', async () => {
  const user = userEvent.setup()
  render(<Harness/>)
  await user.tab()
  await user.tab()
  const trigger = screen.getByRole('button', { name: 'Supported services' })
  expect(trigger).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('button', { name: 'Close supported services' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  await user.keyboard('{Enter}')
  await user.tab({ shift: true })
  await user.tab({ shift: true })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveFocus()
})
