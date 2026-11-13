import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

export default function Panel({ title, children, onClose, placement = 'drawer', modal = true, active = true, focusOnOpen = true }: { title: string; children: ReactNode; onClose: () => void; placement?: 'drawer' | 'queue' | 'services'; modal?: boolean; active?: boolean; focusOnOpen?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null), popover = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null)
  const dismiss = useRef(onClose)
  dismiss.current = onClose
  useEffect(() => {
    if (!active) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const modalElement = dialog.current
    const element: HTMLElement = modal ? modalElement! : popover.current!
    let focusInside = element.contains(document.activeElement)
    const trackFocus = (event: FocusEvent) => { focusInside = event.target instanceof Node && element.contains(event.target) }
    if (!modal) document.addEventListener('focusin', trackFocus)
    if (modal && modalElement) {
      if (typeof modalElement.showModal === 'function') modalElement.showModal()
      else element.setAttribute('open', '')
    }
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss.current(); return }
      if (event.key !== 'Tab' || !modal) return
      const controls = [...element.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], summary')].filter(el => !el.closest('[hidden]') && (!el.closest('details:not([open])') || el.tagName === 'SUMMARY'))
      if (!controls.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    element.addEventListener('keydown', keys)
    return () => {
      element.removeEventListener('keydown', keys)
      if (!modal) document.removeEventListener('focusin', trackFocus)
      const restoreFocus = modal || focusInside
      if (modal && modalElement) { if (typeof modalElement.close === 'function') modalElement.close(); else element.removeAttribute('open') }
      if (restoreFocus && previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [modal, active])
  useEffect(() => { if (active && focusOnOpen) close.current?.focus({ preventScroll: true }) }, [active, focusOnOpen])
  const content = <div className="panel-content"><header className="panel-header"><h2>{title}</h2><button ref={close} className="quiet-button square-button dismiss-button" type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}><Icon name="close"/></button></header><div className="panel-body">{children}</div></div>
  return modal ? <dialog className={`side-panel panel-${placement}`} ref={dialog} aria-label={title} aria-modal="true" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>{content}</dialog>
    : <div className={`side-panel panel-${placement}`} ref={popover} role="dialog" aria-label={title} data-state={active ? 'open' : 'closed'} inert={!active} aria-hidden={!active || undefined}>{content}</div>
}
