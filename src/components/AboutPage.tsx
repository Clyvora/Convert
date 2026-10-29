import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Mascot from './Mascot'
import './AboutPage.css'

const sections = [
  { id: 'general', label: 'What’s Convert?' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'usage', label: 'Responsible use' },
  { id: 'support', label: 'Help & feedback' },
  { id: 'credits', label: 'Credits & licenses' },
] as const
type Section = typeof sections[number]['id']
function current(): Section { return sections.find(s => s.id === location.hash.slice(1))?.id || 'general' }
function External({ href, children }: { href: string; children: ReactNode }) { return <a href={href} target="_blank" rel="noreferrer">{children}<span className="sr-only"> (opens in a new tab)</span></a> }

export default function AboutPage({ onUpdates }: { onUpdates?: () => void }) {
  const [section, setSection] = useState(current)
  useEffect(() => {
    const changed = () => setSection(current())
    window.addEventListener('hashchange', changed); window.addEventListener('popstate', changed)
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('popstate', changed) }
  }, [])
  const updatesLink = <a href="/updates" onClick={event => { if (onUpdates && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onUpdates() } }}>Updates</a>
  return <div className="about-guide">
    <nav className="about-directory" aria-label="About sections">{sections.map(item => <a key={item.id} href={`#${item.id}`} aria-current={section === item.id ? 'location' : undefined} onClick={() => setSection(item.id)}>{item.label}</a>)}</nav>
    <article key={section} className="about-document" aria-label={sections.find(s => s.id === section)!.label}>
      {section === 'general' && <>
        <header className="about-overview"><div><h2>Media, in the format you need.</h2><p>Download public media or convert your own audio and video, in one workspace.</p></div><Mascot pose="ready"/></header>
        <h3>Public links</h3><p>Paste a supported public link, choose Auto, Audio, or Video only, and start a download. Convert checks what the source offers before creating work. Settings holds your preferred formats, quality, languages, and extras.</p><p>When public collection discovery is supported, you can select playlist or profile items before downloading them. The queue keeps progress, cancellation, retries, and completed files together. Unavailable settings require a choice rather than a silent substitution.</p>
        <h3>Your files, your device</h3><p>Local conversion handles files you choose from your device. Audio and video are processed in your browser using FFmpeg WebAssembly. The available formats depend on that processing build and your device’s resources.</p><p>You can move between Convert’s pages while work runs. Refreshing restores available remote jobs, but local files must be selected again. Remote downloads started before a refresh won’t automatically download a second time.</p>
        <h3>Still in beta</h3><p>Convert is being built and tested. Source platforms change, some features remain unverified, and an extractor listing does not establish that every link, playlist, or profile works. Public-link downloads need an available media backend. Keep your original files while trying conversions.</p>
        <h3>Part of Clyvora</h3><p>Clyvora makes focused browser tools for everyday tasks. Explore the other projects on <External href="https://www.clyvora.tech/">Clyvora.tech</External>, or read {updatesLink} for what’s changed in Convert.</p>
      </>}
      {section === 'privacy' && <>
        <h2>What stays here. What goes online.</h2>
        <h3>Local files</h3><p>Files chosen for local conversion are processed on your device. Their contents and filenames are not uploaded by that conversion flow. The processing engine is loaded from the site when needed.</p><p>Local file selections and generated outputs are held by the current page. Refreshing or closing it loses that workspace; keep downloaded results and select the source files again if needed.</p>
        <h3>Public links</h3><p>Submitting a link sends it to Clyvora infrastructure. The media service contacts the source platform to inspect metadata, discover explicitly requested collection items, and retrieve selected media. That work can involve additional media, thumbnail, and subtitle requests.</p><p>Source metadata, job progress, and remotely processed files are stored by the media service so you can return to your queue and download completed results. This is server processing, even when you started it from the same interface as local conversion.</p>
        <h3>Retention and access</h3><p>The service’s default retention is 24 hours for remote files and seven days for job and anonymous-session metadata. Temporary files are cleaned up after work finishes, fails, or expires. Deployment settings can affect those limits.</p><p>An anonymous session cookie associates remote jobs with this browser. Artifact access is protected by short-lived, file-specific grants. Clearing that cookie can remove your access to previous jobs; Clyvora does not provide an account recovery flow for anonymous sessions.</p>
        <h3>Browser preferences</h3><p>Theme and output choices are saved in this browser’s local storage. Local files are not saved there. The application cache holds site assets and conversion runtime files; API responses and downloaded media are excluded from the general application cache.</p><p>Hosting infrastructure and source platforms also handle network requests under their own policies. For implementation details, see Convert’s <External href="https://github.com/Clyvora/Convert/blob/main/NETWORK.md">network documentation</External>.</p>
      </>}
      {section === 'usage' && <>
        <h2>Use it with care.</h2>
        <h3>Permission comes first</h3><p>Use Convert for media you own or have permission to download, convert, and use. Being publicly accessible does not grant permission to redistribute someone else’s work. Respect creators’ licenses and the source platform’s rules.</p>
        <h3>Public access only</h3><p>Convert does not bypass DRM, paywalls, private accounts, or authentication barriers. It does not accept account passwords or browser cookies to work around access restrictions. Deleted, unavailable, region-restricted, and unsupported media can fail.</p>
        <h3>Service coverage</h3><p>The service catalog distinguishes listed extraction support from tested capabilities. Single-item downloads, playlists, and profile discovery are separate capabilities. A working post does not prove that the same provider’s full profile can be enumerated.</p><p>Rate limits, source changes, collection limits, and unavailable posts can interrupt a batch or produce partial results. Check the item results before assuming a collection is complete.</p>
        <h3>Conversion has limits</h3><p>A higher bitrate, a larger resolution, WAV, or FLAC cannot recover detail missing from the source. Some choices require transcoding and may change quality. Keep originals, check the result, and use a format your player supports.</p>
      </>}
      {section === 'support' && <>
        <h2>Help make Convert better.</h2>
        <h3>Report a problem</h3><p>Use the <External href="https://github.com/Clyvora/Convert/issues">Convert issue tracker</External> for bugs and suggestions. Describe what you tried, what you expected, and what happened. Include your browser, device, output settings, and any error shown.</p><p>For public-link problems, a permitted public sample and the affected capability—single download, playlist, or profile—help reproduce the issue. Do not post private links, signed download grants, account cookies, passwords, or personal files.</p>
        <h3>Before retrying</h3><p>Check the error and queue item results. A source may be unavailable or rate-limited, or a selected format may need changing. Retrying failed collection items preserves completed work. Expired artifacts need a new job.</p><p>If the remote service is unavailable, on-device conversion can still work once its runtime is available. Local conversion can fail when a file exceeds the browser’s memory or processing limits.</p>
        <h3>Security reports</h3><p>Report suspected vulnerabilities through the process in <External href="https://github.com/Clyvora/Convert/blob/main/SECURITY.md">SECURITY.md</External>. Avoid publishing sensitive details in a public bug report.</p>
        <h3>Follow development</h3><p>Read {updatesLink} for the current beta notes, or browse the <External href="https://github.com/Clyvora/Convert">source repository</External>. Source availability and permission to reuse code are governed by the repository’s license.</p>
      </>}
      {section === 'credits' && <>
        <h2>The people and tools behind Convert.</h2>
        <h3>Clyvora</h3><p>Convert is a Clyvora project. The mascot artwork and cat mark were supplied for Clyvora Convert. Their appearance here does not provide a separate license to reuse them.</p>
        <h3>Processing tools</h3><p><External href="https://github.com/ffmpegwasm/ffmpeg.wasm">FFmpeg WebAssembly</External> powers local audio and video conversion. The remote service uses <External href="https://github.com/yt-dlp/yt-dlp">yt-dlp</External> for maintained extraction support and native <External href="https://ffmpeg.org/">FFmpeg and ffprobe</External> for media processing and verification.</p><p>The interface is built with React and TypeScript, using Vite. These projects and their dependencies retain their own licenses and notices.</p>
        <h3>Design reference</h3><p><External href="https://cobalt.tools/">Cobalt</External> informed the simple download interaction and page organization. Clyvora’s interface uses original components and the supplied Clyvora artwork. Cobalt’s mascot and other brand assets are not included.</p>
        <h3>Licenses</h3><p>Convert’s application code uses the PolyForm Shield License 1.0.0. The repository license and dependency notices describe the applicable terms. Review them before reusing or distributing the application; different processing components have different obligations.</p><div className="about-resource-links"><External href="https://github.com/Clyvora/Convert/blob/main/LICENSE">Project license</External><External href="https://github.com/Clyvora/Convert/blob/main/THIRD_PARTY_NOTICES.md">Dependency notices</External></div>
      </>}
    </article>
  </div>
}
