import { useEffect, useRef, useState } from 'react'
import { remoteMedia } from '../core/mediaClient'
import './services.css'

const popularServices = [
  ['YouTube', 'youtube', 'youtube'], ['Instagram', 'instagram', 'instagram'],
  ['TikTok', 'tiktok', 'tiktok'], ['X / Twitter', 'twitter', 'x'],
  ['Reddit', 'reddit', 'reddit'], ['SoundCloud', 'soundcloud', 'soundcloud'],
  ['Spotify', 'spotify', 'spotify'], ['Facebook', 'facebook', 'facebook'],
  ['Vimeo', 'vimeo', 'vimeo'], ['Twitch', 'twitch', 'twitch'],
  ['Pinterest', 'pinterest', 'pinterest'],
]
type Catalog = Awaited<ReturnType<typeof remoteMedia.services>>
export default function Services() {
  const [query, setQuery] = useState(''), [browsing, setBrowsing] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let active = true
    void remoteMedia.services('').then(result => { if (active && typeof result.total === 'number') setTotal(result.total) }).catch(() => {})
    return () => { active = false }
  }, [])
  const moreCount = total === null ? null : Math.max(0, total - popularServices.length)
  const [page, setPage] = useState<Catalog | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const request = useRef(0)
  const term = query.trim().toLowerCase()
  const matches = popularServices.filter(([name, id]) => `${name} ${id}`.toLowerCase().includes(term))
  const other = page?.items.filter(item => !matches.some(([, id]) => id === item.id.toLowerCase())) ?? []
  async function search(value: string, cursor = '') {
    const id = ++request.current
    setBusy(true); setError('')
    try {
      const result = await remoteMedia.services(value, cursor)
      if (id === request.current) setPage(previous => cursor && previous ? { ...result, items: [...previous.items, ...result.items.filter(item => !previous.items.some(old => old.id === item.id))] } : result)
    } catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : 'Could not check the catalog.') }
    finally { if (id === request.current) setBusy(false) }
  }
  function changeQuery(value: string) {
    ++request.current
    setQuery(value); setBrowsing(false); setPage(null); setError(''); setBusy(Boolean(value.trim()))
  }
  useEffect(() => {
    if (!term) return
    const timer = window.setTimeout(() => void search(term), 300)
    return () => window.clearTimeout(timer)
  }, [term])
  return <div className="services-popover-content service-directory">
    <form className="directory-search" role="search" onSubmit={e => { e.preventDefault(); if (term) void search(term) }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
      <input ref={input} autoFocus aria-label="Search services" placeholder="Search the full service catalog…" value={query} onChange={e => changeQuery(e.target.value)}/>
      {query && <button type="button" aria-label="Clear search" onClick={() => changeQuery('')}>×</button>}
    </form>
    <div className="directory-icons" aria-label="Popular platforms">{popularServices.map(([name, id, icon]) => {
      return <button type="button" className="directory-platform" key={id} aria-label={name} title={name} aria-pressed={term === id} onClick={() => changeQuery(id)}>
        <span className="directory-platform-icon" style={{ maskImage: `url(/platforms/${icon}.svg)`, WebkitMaskImage: `url(/platforms/${icon}.svg)` }} aria-hidden="true"/>
      </button>
    })}<button type="button" className="directory-platform directory-more" aria-label={moreCount === null ? 'Browse more services' : `Browse ${moreCount.toLocaleString()} more catalog entries`} title={moreCount === null ? 'Browse the full catalog' : `${moreCount.toLocaleString()} more catalog entries. Aliases may be listed separately; availability varies.`} onClick={() => { changeQuery(''); setBrowsing(true); void search(''); input.current?.focus() }}><span>{moreCount === null ? '+' : `+${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(moreCount)}`}</span><small>more</small></button></div>
    {term && page?.items.filter(item => matches.some(([, id]) => id === item.id.toLowerCase())).map(item => <div className="directory-selected" key={item.id}><span>{popularServices.find(([, id]) => id === item.id.toLowerCase())?.[0]}</span><small>{item.enabled ? item.single === 'verified-audio-only' ? 'Audio verified' : item.single === 'matched-audio-only' ? 'YouTube matching' : 'Enabled' : 'Disabled'}</small></div>)}
    {(term || browsing) && <div className="directory-feedback" role="status">{busy ? 'Checking the catalog…' : error ? 'Catalog check unavailable.' : page && !page.items.length ? 'No catalog matches. Try another name.' : !matches.length && !page ? 'Searching the catalog…' : ''}</div>}
    {error && <button type="button" className="directory-browse" onClick={() => void search(term)}>Try again<span aria-hidden="true">↗</span></button>}
    {!!other.length && <details className="directory-other" key={term} open={browsing || !matches.length ? true : undefined}><summary>{matches.length ? 'More catalog matches' : 'Catalog matches'}<span>{other.length}{page?.next ? '+' : ''}</span></summary><div className="directory-catalog">{other.map(item => <div className="directory-catalog-row" key={item.id}><span>{item.id}</span><small>{item.enabled ? 'Enabled' : 'Disabled'}</small></div>)}</div></details>}
    {page?.next && <button className="directory-browse" type="button" disabled={busy} onClick={() => void search(term, page.next!)}>Load more matches<span aria-hidden="true">↓</span></button>}
    <p className="directory-note">Search for more platforms. Availability varies by source.</p>
  </div>
}
