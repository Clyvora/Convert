import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ErrorDetails from './ErrorDetails'
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => { if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard); else Reflect.deleteProperty(navigator, 'clipboard') })

it('offers selectable details when clipboard access is unavailable', async () => {
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('Denied'))}})
  render(<ErrorDetails area="local" code="LOCAL_CONVERSION_FAILED" options={{outputFormat:'mp3'}}/>)
  fireEvent.click(screen.getByRole('button',{name:'Copy error details'}))
  const text = await screen.findByRole('textbox',{name:'Error details'})
  expect(JSON.parse((text as HTMLTextAreaElement).value).code).toBe('LOCAL_CONVERSION_FAILED')
  fireEvent.focus(text)
  expect((text as HTMLTextAreaElement).selectionStart).toBe(0)
  expect((text as HTMLTextAreaElement).selectionEnd).toBe((text as HTMLTextAreaElement).value.length)
})
