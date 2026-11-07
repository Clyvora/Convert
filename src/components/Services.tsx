import { useState } from 'react'
import './services.css'

const services = [
  { name: 'SoundCloud', id: 'soundcloud', icon: 'soundcloud', detail: 'Public audio tracks' },
  { name: 'YouTube', id: 'youtube', icon: 'youtube', detail: 'Public video and audio' },
  { name: 'Spotify', id: 'spotify', icon: 'spotify', detail: 'Track links matched on YouTube' },
  { name: 'Instagram', id: 'instagram', icon: 'instagram', detail: 'Public videos and reels' },
  { name: 'TikTok', id: 'tiktok', icon: 'tiktok', detail: 'Public videos' },
  { name: 'X / Twitter', id: 'twitter', icon: 'x', detail: 'Public videos' },
  { name: 'Facebook', id: 'facebook', icon: 'facebook', detail: 'Public videos and reels' },
]

export default function Services() {
  const [selected, setSelected] = useState<string | null>(null)
  const service = services.find(item => item.id === selected)
  return <div className="services-popover-content service-directory">
    <div className="directory-icons" aria-label="Supported platforms">{services.map(item => <button
      type="button" className="directory-platform" key={item.id} aria-label={item.name} title={item.name}
      aria-pressed={selected === item.id} onClick={() => setSelected(current => current === item.id ? null : item.id)}
    >
      <span className="directory-platform-icon" style={{ maskImage: `url(/platforms/${item.icon}.svg)`, WebkitMaskImage: `url(/platforms/${item.icon}.svg)` }} aria-hidden="true"/>
    </button>)}</div>
    {service && <div className="directory-selected" role="status"><span>{service.name}</span><small>{service.detail}</small></div>}
    <p className="directory-note">Availability varies by link and selected format.</p>
  </div>
}
