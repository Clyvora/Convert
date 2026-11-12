import { useId, useState } from 'react'
import { services } from '../core/services'
import './services.css'

export default function Services() {
  const [selected, setSelected] = useState<string | null>(null)
  const detailsId = useId()
  const service = services.find(item => item.id === selected)
  return <div className="services-popover-content service-directory">
    <div className="directory-selected" id={detailsId} role="status"><span>{service?.name || 'Choose a service'}</span>{service && <span className="directory-link-types">{service.links.join(' · ')}</span>}<small>{service?.detail || 'Select a platform to see supported links and limits.'}</small></div>
    <div className="directory-icons" aria-label="Supported platforms">{services.map(item => <button
      type="button" className="directory-platform" key={item.id} aria-label={item.name} title={item.name}
      aria-pressed={selected === item.id} aria-describedby={selected === item.id ? detailsId : undefined} onClick={() => setSelected(current => current === item.id ? null : item.id)}
    >
      <span className="directory-platform-icon" style={{ maskImage: `url(/platforms/${item.icon}.svg)`, WebkitMaskImage: `url(/platforms/${item.icon}.svg)` }} aria-hidden="true"/>
      <span className="directory-platform-name">{item.name}</span>
    </button>)}</div>
    <p className="directory-note">Availability varies by link and format. Private and sign-in-required videos aren't supported. Spotify links use matching YouTube audio.</p>
  </div>
}
