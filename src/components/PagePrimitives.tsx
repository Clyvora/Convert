import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
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

export function PageDirectory({ title, version, base, entries, selected, companion, compactLabel }: { title: string; version?: string; base: string; entries: readonly { id: string; label: string; icon: string; group: number }[]; selected: string; companion?: ReactNode; compactLabel?: string }) {
  const navigation = useRef<HTMLElement>(null)
  const pickerId = useId()
  const visitSection = (id: string) => {
    if (!entries.some(entry => entry.id === id)) return
    const path = `${base}/${id}`
    if (location.pathname !== path) history.pushState(null, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo(0, 0)
  }
  useEffect(() => {
    const nav = navigation.current, active = nav?.querySelector<HTMLElement>('[aria-current]')
    if (!nav || !active) return
    const reveal = () => {
      if (nav.scrollWidth <= nav.clientWidth) return
      const bounds = nav.getBoundingClientRect(), item = active.getBoundingClientRect()
      if (item.left < bounds.left) nav.scrollLeft += item.left - bounds.left
      else if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right
    }
    reveal()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(reveal) : null
    observer?.observe(nav); observer?.observe(active)
    let stopped = false
    void document.fonts?.ready.then(() => { if (!stopped) reveal() })
    return () => { stopped = true; observer?.disconnect() }
  }, [selected])
  return <aside className={`page-directory${compactLabel ? ' has-picker' : ''}`}>{version && <span className="directory-version">{version}</span>}<h2>{title}</h2>{compactLabel && <div className="directory-picker"><label htmlFor={pickerId}>{compactLabel}</label><select id={pickerId} value={selected} onChange={event => visitSection(event.target.value)}>{entries.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>}<nav ref={navigation} aria-label={`${title} categories`}>{entries.map((item, index) => <a key={item.id} href={`${base}/${item.id}`} className={index && entries[index - 1].group !== item.group ? 'directory-group-start' : ''} aria-current={selected === item.id ? 'location' : undefined} onClick={event => { if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return; event.preventDefault(); visitSection(item.id) }}><span className={`directory-icon directory-icon-${item.id}`} aria-hidden="true">{item.icon}</span>{item.label}</a>)}</nav>{companion}</aside>
}
