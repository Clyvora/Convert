import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

export function SectionHeading({ children, id }: { children: ReactNode; id: string }) {
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  async function copy() {
    try { const url = new URL(location.href); url.hash = id; await navigator.clipboard.writeText(url.href); setMessage('Link copied') }
    catch { setMessage('Could not copy link') }
    clearTimeout(timer.current); timer.current = setTimeout(() => setMessage(''), 2200)
  }
  return <div className="section-title" id={id}><h3>{children}</h3><button type="button" onClick={() => void copy()} aria-label={`Copy link to ${typeof children === 'string' ? children : 'section'}`} title="Copy section link"><Icon name="link"/></button><span role="status" className="section-copy-status">{message}</span></div>
}

export function PageDirectory({ title, version, base, entries, selected }: { title: string; version?: string; base: string; entries: readonly { id: string; label: string; icon: string; group: number }[]; selected: string }) {
  return <aside className="page-directory">{version && <span className="directory-version">{version}</span>}<h2>{title}</h2><nav aria-label={`${title} categories`}>{entries.map((item, index) => <a key={item.id} href={`${base}/${item.id}`} className={index && entries[index - 1].group !== item.group ? 'directory-group-start' : ''} aria-current={selected === item.id ? 'location' : undefined} onClick={event => { if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return; event.preventDefault(); history.pushState(null, '', `${base}/${item.id}`); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0) }}><span className={`directory-icon directory-icon-${item.id}`} aria-hidden="true">{item.icon}</span>{item.label}</a>)}</nav></aside>
}
