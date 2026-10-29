import { useEffect, useRef, useState } from 'react'
import { remoteMedia } from '../core/mediaClient'
import './services.css'

const popularServices = [
  ['YouTube', 'youtube', 'YT', '#ee6565'], ['Instagram', 'instagram', 'ig', '#d291ba'],
  ['TikTok', 'tiktok', 'tk', '#78c7c7'], ['X / Twitter', 'twitter', '𝕏', '#bdbdbd'],
  ['Reddit', 'reddit', 'r/', '#e79670'], ['SoundCloud', 'soundcloud', 'sc', '#edb073'],
  ['Facebook', 'facebook', 'f', '#8baee0'], ['Vimeo', 'vimeo', 'v', '#86c4df'],
  ['Twitch', 'twitch', 'tw', '#b89ce8'], ['Pinterest', 'pinterest', 'P', '#de8990'],
  ['Dailymotion', 'dailymotion', 'dm', '#a3b9dd'], ['Bluesky', 'bluesky', 'bs', '#86b8ed'],
  ['Bilibili', 'bilibili', 'bi', '#83c7db'], ['Tumblr', 'tumblr', 't', '#9baec7'],
  ['Snapchat', 'snapchat', 'sn', '#dbd483'], ['Streamable', 'streamable', 'st', '#8db4dd'],
  ['Bandcamp', 'bandcamp', 'bc', '#83bdc5'], ['Mixcloud', 'mixcloud', 'mc', '#a5a2d6'],
  ['Newgrounds', 'newgrounds', 'ng', '#d5b179'], ['Loom', 'loom', 'lo', '#b0a2e2'],
]
type Catalog = Awaited<ReturnType<typeof remoteMedia.services>>
export default function Services() {
  const [query, setQuery] = useState(''), [showMore, setShowMore] = useState(false)
  const [page, setPage] = useState<Catalog | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const request = useRef(0)
  const term = query.trim().toLowerCase()
  const matches = popularServices.filter(([name, id]) => `${name} ${id}`.toLowerCase().includes(term))
  const visible = term || showMore ? matches : matches.slice(0, 8)
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
    setQuery(value); setPage(null); setError(''); setBusy(Boolean(value.trim()))
  }
  useEffect(() => {
    if (!term) return
    const timer = window.setTimeout(() => void search(term), 300)
    return () => window.clearTimeout(timer)
  }, [term])
  return <div className="services-popover-content service-directory">
    <form className="directory-search" role="search" onSubmit={e => { e.preventDefault(); if (term) void search(term) }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
      <input autoFocus aria-label="Search services" placeholder="Search the full service catalog…" value={query} onChange={e => changeQuery(e.target.value)}/>
      {query && <button type="button" aria-label="Clear search" onClick={() => changeQuery('')}>×</button>}
    </form>
    <div className="directory-heading"><span>{term ? 'Popular matches' : 'Popular services'}</span></div>
    {!!visible.length && <div className="directory-grid">{visible.map(([name, id, mark, color]) => {
      const entry = page?.items.find(item => item.id.toLowerCase() === id)
      return <button type="button" className="directory-card" key={id} onClick={() => changeQuery(id)}>
        <span className="directory-mark" style={{ color }} aria-hidden="true">{mark}</span>
        <span className="directory-card-copy"><span>{name}</span>{entry && <small>{entry.enabled ? entry.single === 'verified-audio-only' ? 'Audio verified' : 'Enabled' : 'Disabled'}</small>}</span>
        <span className="directory-card-arrow" aria-hidden="true">↗</span>
      </button>
    })}</div>}
    {!term && <button className="directory-browse" type="button" aria-expanded={showMore} onClick={() => setShowMore(!showMore)}>{showMore ? 'Fewer popular services' : 'More popular services'}<span aria-hidden="true">{showMore ? '−' : '+'}</span></button>}
    {term && <div className="directory-feedback" role="status">{busy ? 'Checking the catalog…' : error ? 'Catalog check unavailable.' : page && !page.items.length ? 'No catalog matches. Try another name.' : !matches.length && !page ? 'Searching the catalog…' : ''}</div>}
    {error && <button type="button" className="directory-browse" onClick={() => void search(term)}>Try again<span aria-hidden="true">↗</span></button>}
    {!!other.length && <details className="directory-other" key={term} open={matches.length ? undefined : true}><summary>{matches.length ? 'More catalog matches' : 'Catalog matches'}<span>{other.length}{page?.next ? '+' : ''}</span></summary><div className="directory-catalog">{other.map(item => <div className="directory-catalog-row" key={item.id}><span>{item.id}</span><small>{item.enabled ? 'Enabled' : 'Disabled'}</small></div>)}</div></details>}
    {page?.next && <button className="directory-browse" type="button" disabled={busy} onClick={() => void search(term, page.next!)}>Load more matches<span aria-hidden="true">↓</span></button>}
    <p className="directory-note">Popular picks shown. Search the full catalog for more. Availability varies by source.</p>
  </div>
}

