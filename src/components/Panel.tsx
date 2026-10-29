import { useEffect, useRef, type ReactNode } from 'react'

export default function Panel({ title, children, onClose, placement = 'drawer' }: { title: string; children: ReactNode; onClose: () => void; placement?: 'drawer' | 'queue' | 'services' }) {
  const dialog = useRef<HTMLDialogElement>(null), close = useRef<HTMLButtonElement>(null)
  const dismiss = useRef(onClose)
  dismiss.current = onClose
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const element = dialog.current!
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '')
    close.current?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss.current(); return }
      if (event.key !== 'Tab') return
      const controls = [...element.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], summary')].filter(el => !el.closest('[hidden]') && (!el.closest('details:not([open])') || el.tagName === 'SUMMARY'))
      if (!controls.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    element.addEventListener('keydown', keys)
    return () => { element.removeEventListener('keydown', keys); if (typeof element.showModal === 'function') element.close(); else element.removeAttribute('open'); if (previous?.isConnected) previous.focus() }
  }, [])
  return <dialog className={`side-panel panel-${placement}`} ref={dialog} aria-label={title} aria-modal="true" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="panel-content"><header className="panel-header"><h2>{title}</h2><button ref={close} className="quiet-button square-button" type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}><span aria-hidden="true">×</span></button></header><div className="panel-body">{children}</div></div>
  </dialog>
}
