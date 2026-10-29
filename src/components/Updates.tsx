import { betaUpdate as update } from '../core/updates'
import Mascot from './Mascot'
import './Updates.css'

const cast = [
  { pose: 'sitting', label: 'Ready when you are', detail: 'Waiting for your next link.' },
  { pose: 'curious', label: 'Taking a look', detail: 'Checking what the source offers.' },
  { pose: 'working', label: 'On the move', detail: 'Your media is being prepared.' },
  { pose: 'ready', label: 'All yours', detail: 'A file is ready to download.' },
  { pose: 'confused', label: 'A little help?', detail: 'Something needs your attention.' },
] as const

export default function Updates() {
  return <article className="beta-update" id={update.id} aria-labelledby="beta-update-title">
    <header className="beta-update-header"><div className="beta-update-meta"><span className="release-version">{update.version}</span><time dateTime={update.date}>29 October 2026</time><span className="release-status">In development</span></div><h2 id="beta-update-title">{update.title}</h2></header>
    <div className="beta-update-art" aria-hidden="true"><span className="update-art-word">hello,<br/>beta.</span><div className="update-art-orbit"/><Mascot pose="pounce"/><span className="update-art-sticker">still a little wild. ↗</span></div>
    <div className="beta-update-copy">
      <p className="update-intro">Convert has a new home, a simpler way to get your media, and a small companion with a very important job: looking busy while the actual work happens.</p>
      <p>We’ve brought public-link downloads and local conversion into one workspace. There’s more room for your files, fewer steps between you and a download, and a little more personality along the way.</p>
      <aside className="beta-callout"><span>β</span><div><strong>We’re in beta. Come kick the tires.</strong><p>Convert is still being built and tested. Features can change, sources can fail, and there are rough edges to work through. These notes describe this build, not a production release.</p></div></aside>
      <section><h3>Paste a link. Pick your output. Go.</h3><p>The download screen keeps the basics close: Auto, Audio, and Video only. Settings holds your preferred formats and finer details. When a source can’t provide your choice, Convert asks you to pick an alternative.</p><p>Collections get an item picker before work starts. Progress, cancellation, retries, and completed files live in a compact queue beside the download button.</p></section>
      <section><h3>Your files don’t need a round trip.</h3><p>Choose Local conversion to work with audio and video on your device. Processing happens in your browser. You can move between pages while work runs; after a refresh, local files need to be selected again.</p><p>Public links work differently: they contact Clyvora’s media service and the source platform. Remote jobs can return after a refresh, and completed files remain available until they expire.</p></section>
      <section className="update-cat-section"><h3>A little company for your downloads.</h3><p>Our cat has a few things to say. Five poses follow the download flow, with short transitions rather than constant movement. The empty queue gets a sleeping companion, and local conversion gets a stretch before the work begins.</p><div className="update-cat-cast">{cast.map(cat => <div key={cat.pose}><Mascot pose={cat.pose}/><strong>{cat.label}</strong><p>{cat.detail}</p></div>)}</div></section>
      <section><h3>The little details add up.</h3><ul><li>Dedicated Settings, Updates, and About pages, with browser back and forward support.</li><li>Separate audio and video format preferences, saved in your browser.</li><li>A compact services menu with twenty common provider shortcuts and catalog search.</li><li>Light and dark themes, keyboard access, and motion that respects your device preferences.</li><li>Automatic delivery for newly submitted work, with a manual download button if you need it. Refresh won’t repeat the automatic download.</li></ul></section>
      <section><h3>What’s still growing?</h3><p>Provider reliability, collection behavior, and the small details that only show up through use. A provider appearing in the catalog isn’t proof that every link, playlist, or profile works. Public-link processing also requires an available media backend.</p><p>Keep your original files while trying the beta. Download media you have permission to use; private accounts, authentication barriers, paywalls, and DRM aren’t bypassed.</p></section>
      <footer className="update-letter-end"><Mascot pose="ready"/><div><p>Thanks for helping us shape Convert.</p><span>— Clyvora, and the cat.</span></div></footer>
    </div>
  </article>
}
