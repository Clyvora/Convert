import { useId, useState } from 'react'
import { services } from '../core/services'
import './services.css'

const filters = [{ id: 'all', name: 'All' }, { id: 'music', name: 'Music' }, { id: 'video', name: 'Video' }, { id: 'collections', name: 'Collections' }] as const

export default function Services() {
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<typeof filters[number]['id']>('all')
  const detailsId = useId(), searchId = useId()
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visible = services.filter(item => (filter === 'all' || (filter === 'collections' ? item.collection : item.category === filter)) && words.every(word => `${item.name} ${item.links.join(' ')}`.toLowerCase().includes(word)))
  const service = services.find(item => item.id === selected)
  return <div className="services-popover-content service-directory">
    <div className="directory-tools">
      <label htmlFor={searchId}>Find a service</label>
      <div className="directory-search"><input id={searchId} type="search" value={query} onChange={event => { setQuery(event.target.value); setSelected(null) }} placeholder="Search names or link types"/>{query && <button type="button" className="quiet-button" onClick={() => { setQuery(''); setSelected(null); document.getElementById(searchId)?.focus() }} aria-label="Clear service search">×</button>}</div>
      <div className="directory-filters" role="group" aria-label="Filter services">{filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setSelected(null) }}>{item.name}</button>)}</div>
      <p className="directory-count" aria-live="polite">{visible.length} of {services.length} services</p>
    </div>
    <div className="directory-selected" id={detailsId} role="status"><span>{service?.name || 'Choose a service'}</span>{service && <span className="directory-link-types">{service.links.join(' · ')}</span>}<small>{service?.detail || 'Select a platform to see supported links and limits.'}</small></div>
    <div className="directory-icons" aria-label="Supported platforms">{visible.map(item => <button
      type="button" className="directory-platform" key={item.id} aria-label={item.name} title={item.name}
      aria-pressed={selected === item.id} aria-describedby={selected === item.id ? detailsId : undefined} onClick={() => setSelected(current => current === item.id ? null : item.id)}
    >
      <span className="directory-platform-icon" style={{ maskImage: `url(/platforms/${item.icon}.svg)`, WebkitMaskImage: `url(/platforms/${item.icon}.svg)` }} aria-hidden="true"/>
      <span className="directory-platform-name">{item.name}</span>
    </button>)}</div>
    {visible.length === 0 && <div className="directory-empty"><p>No services match your search and filters.</p><button className="text-button" type="button" onClick={() => { setQuery(''); setFilter('all'); setSelected(null); document.getElementById(searchId)?.focus() }}>Reset filters</button></div>}
    <p className="directory-note">Availability varies by link and format. Private and sign-in-required videos aren't supported. Spotify links use matching YouTube audio.</p>
  </div>
}
