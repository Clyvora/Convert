import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { services } from '../core/services'
import './services.css'

export default function Services() {
  const [active, setActive] = useState<{ id: string; anchor: HTMLButtonElement; host: HTMLElement } | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const directory = useRef<HTMLDivElement>(null)
  const tooltip = useRef<HTMLDivElement>(null)
  const detailsId = useId()
  const service = services.find(item => item.id === active?.id)
  const showDetails = (id: string, anchor: HTMLButtonElement) => {
    const host = anchor.closest<HTMLElement>('.panel-services') || directory.current
    if (!host) return
    setPosition(null)
    setActive({ id, anchor, host })
  }
  useLayoutEffect(() => {
    if (!active || !tooltip.current) return
    const panel = active.host.getBoundingClientRect(), anchor = active.anchor.getBoundingClientRect(), tip = tooltip.current.getBoundingClientRect()
    const zoom = active.host.offsetWidth ? panel.width / active.host.offsetWidth : 1
    const gap = 8 * zoom
    const left = Math.max(panel.left + gap, Math.min(anchor.left + (anchor.width - tip.width) / 2, panel.right - tip.width - gap))
    const top = anchor.bottom + tip.height + gap > panel.bottom - gap ? anchor.top - tip.height - gap : anchor.bottom + gap
    setPosition({ left: (left - panel.left) / zoom, top: Math.max(gap, top - panel.top) / zoom })
    const hide = () => setActive(null)
    active.host.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      active.host.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [active])
  return <div className="services-popover-content service-directory" ref={directory}>
    <div className="directory-icons" aria-label="Supported platforms">{services.map(item => <button
      type="button" className="directory-platform" key={item.id} aria-label={item.name}
      aria-describedby={active?.id === item.id ? detailsId : undefined}
      onPointerEnter={event => { if (event.pointerType === 'mouse') showDetails(item.id, event.currentTarget) }}
      onPointerLeave={() => setActive(null)} onFocus={event => showDetails(item.id, event.currentTarget)} onBlur={() => setActive(null)}
      onClick={event => showDetails(item.id, event.currentTarget)}
    >
      <span className="directory-platform-icon" style={{ maskImage: `url(/platforms/${item.icon}.svg)`, WebkitMaskImage: `url(/platforms/${item.icon}.svg)` }} aria-hidden="true"/>
      <span className="directory-platform-name">{item.name}</span>
    </button>)}</div>
    {active && service && createPortal(<div className="directory-support-tooltip" role="tooltip" id={detailsId} ref={tooltip} style={{ ...position, visibility: position ? 'visible' : 'hidden' }}><strong>{service.name}</strong><span className="directory-link-types">{service.links.join(' · ')}</span><small>{service.detail}</small></div>, active.host)}
  </div>
}
