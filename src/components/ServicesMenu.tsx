import { useContext, useEffect, useRef, useState } from 'react'
import { MotionPreferenceContext } from '../core/motionPreference'
import { Icon } from './Icon'
import Panel from './Panel'
import Services from './Services'

export default function ServicesMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const menu = useRef<HTMLDivElement>(null)
  const hoverOpened = useRef(false)
  const [focusOnOpen, setFocusOnOpen] = useState(false)
  const [present, setPresent] = useState(open)
  const reduceMotion = useContext(MotionPreferenceContext)
  useEffect(() => {
    if (open) { setPresent(true); return }
    if (reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPresent(false)
      return
    }
    // Keep only the closing picture; focus and pointer access end immediately.
    const timeout = window.setTimeout(() => setPresent(false), 300)
    return () => window.clearTimeout(timeout)
  }, [open, reduceMotion])
  useEffect(() => {
    if (!open) return
    const close = () => onOpenChange(false)
    const outside = (event: Event) => { if (event.target instanceof Node && !menu.current?.contains(event.target)) close() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close() } }
    const move = (event: PointerEvent) => {
      if (!hoverOpened.current || event.pointerType !== 'mouse' || menu.current?.contains(event.target as Node)) return
      const trigger = menu.current?.querySelector('.services-trigger')?.getBoundingClientRect()
      const panel = menu.current?.querySelector('.panel-services')?.getBoundingClientRect()
      if (trigger && panel && event.clientY >= trigger.bottom && event.clientY <= panel.top) {
        // Keep the route from the trigger to the wider panel hoverable.
        const progress = (event.clientY - trigger.bottom) / Math.max(1, panel.top - trigger.bottom)
        const left = trigger.left + (panel.left - trigger.left) * progress - 8
        const right = trigger.right + (panel.right - trigger.right) * progress + 8
        if (event.clientX >= left && event.clientX <= right) return
      }
      close()
    }
    const leaveWindow = () => { if (hoverOpened.current) close() }
    document.addEventListener('pointermove', move)
    window.addEventListener('blur', leaveWindow)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointermove', move)
      window.removeEventListener('blur', leaveWindow)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, onOpenChange])
  return <div className="services-menu" ref={menu}>
    <button type="button" className="services-trigger" aria-expanded={open} aria-haspopup="dialog" onPointerEnter={event => {
      if (event.pointerType !== 'mouse' || open) return
      hoverOpened.current = true
      setFocusOnOpen(false)
      onOpenChange(true)
    }} onClick={event => {
      if (open && hoverOpened.current && event.detail > 0) return
      hoverOpened.current = false
      setFocusOnOpen(true)
      onOpenChange(!open)
    }}><span className="services-expand-icon" aria-hidden="true"><Icon name="plus"/></span>Supported services</button>
    {(open || present) && <Panel title="Supported services" placement="services" modal={false} active={open} focusOnOpen={focusOnOpen} onClose={() => onOpenChange(false)}><Services/></Panel>}
  </div>
}
