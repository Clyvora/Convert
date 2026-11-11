import { useId, useState } from 'react'
import './services.css'

const services = [
  { name: 'SoundCloud', id: 'soundcloud', icon: 'soundcloud', detail: 'Public audio tracks' },
  { name: 'YouTube', id: 'youtube', icon: 'youtube', detail: 'Public video and audio' },
  { name: 'Spotify', id: 'spotify', icon: 'spotify', detail: 'Track links matched on YouTube' },
  { name: 'Instagram', id: 'instagram', icon: 'instagram', detail: 'Public videos and reels' },
  { name: 'TikTok', id: 'tiktok', icon: 'tiktok', detail: 'Public videos' },
  { name: 'X / Twitter', id: 'twitter', icon: 'x', detail: 'Public videos' },
  { name: 'Facebook', id: 'facebook', icon: 'facebook', detail: 'Public videos and reels' },
  { name: 'Twitch', id: 'twitch', icon: 'twitch', detail: 'Public clips. Live streams are not supported.' },
  { name: 'Bluesky', id: 'bluesky', icon: 'bluesky', detail: 'Public video posts that play without signing in.' },
  { name: 'Pinterest', id: 'pinterest', icon: 'pinterest', detail: 'Public video pins. Image-only pins are not supported.' },
  { name: 'Streamable', id: 'streamable', icon: 'streamable', detail: 'Public video clips that play without signing in.' },
  { name: 'Dailymotion', id: 'dailymotion', icon: 'dailymotion', detail: 'Public videos. Availability can vary by region.' },
  { name: 'Bandcamp', id: 'bandcamp', icon: 'bandcamp', detail: 'Publicly playable track audio. Paid downloads and private tracks are not supported.' },
  { name: 'Imgur', id: 'imgur', icon: 'imgur', detail: 'Public video posts. For silent clips and GIFs, choose Video only.' },
  { name: '9GAG', id: '9gag', icon: '9gag', detail: 'Public video posts. Image-only posts are not supported.' },
]

export default function Services() {
  const [selected, setSelected] = useState<string | null>(null)
  const detailsId = useId()
  const service = services.find(item => item.id === selected)
  return <div className="services-popover-content service-directory">
    <div className="directory-selected" id={detailsId} role="status"><span>{service?.name || 'Choose a service'}</span><small>{service?.detail || 'Select a platform to see what you can download.'}</small></div>
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
