import { useEffect, useId, useRef, type MouseEvent } from 'react'
import { useSectionNavigation } from '../core/navigation'
import bannerSmall from '../assets/social-card-640.webp'
import bannerLarge from '../assets/social-card-1280.webp'
import updateBanner from '../assets/updates-october-2026-1280.webp'
import updateBannerSmall from '../assets/updates-october-2026-640.webp'
import browserBanner from '../assets/updates-november-2026-1280.webp'
import browserBannerSmall from '../assets/updates-november-2026-640.webp'
import polishBanner from '../assets/updates-ui-polish-2026-11-1280.webp'
import polishBannerSmall from '../assets/updates-ui-polish-2026-11-640.webp'
import servicesBanner from '../assets/updates-services-2026-11-1280.webp'
import servicesBannerSmall from '../assets/updates-services-2026-11-640.webp'
import { servicesUpdate, polishUpdate, browserUpdate, bugFixUpdate, betaUpdate as update, convertArchive, type ConvertArchiveEntry } from '../core/updates'
import Mascot from './Mascot'
import './Updates.css'

const cast = [
  { pose: 'sitting', label: 'Ready when you are', detail: 'Waiting for your next link.' },
  { pose: 'curious', label: 'Taking a look', detail: 'Checking what the source offers.' },
  { pose: 'working', label: 'On the move', detail: 'Your media is being prepared.' },
  { pose: 'ready', label: 'All yours', detail: 'A file is ready to download.' },
  { pose: 'confused', label: 'A little help?', detail: 'Something needs your attention.' },
] as const

const releases = [servicesUpdate, polishUpdate, browserUpdate, bugFixUpdate, update, ...convertArchive]
const latestUpdate = releases[0]
const updateIds = releases.map(release => release.id)

export default function Updates() {
  const selected = useSectionNavigation('/updates', updateIds, latestUpdate.id)
  const container = useRef<HTMLDivElement>(null)
  const releasePickerId = useId()
  const index = updateIds.indexOf(selected)
  const newer = releases[index - 1], older = releases[index + 1]
  const archiveEntry = convertArchive.find(release => release.id === selected)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    container.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }, [selected])
  const selectUpdate = (id: string) => {
    if (!updateIds.includes(id) || location.hash === `#${id}`) return
    history.pushState(null, '', `#${id}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  const switchUpdate = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]')
    if (!anchor || !updateIds.includes(anchor.hash.slice(1))) return
    event.preventDefault()
    selectUpdate(anchor.hash.slice(1))
  }
  return <div className="updates-reader" ref={container} onClick={switchUpdate}>
    <div className="update-release-picker"><label htmlFor={releasePickerId}>Release</label><select id={releasePickerId} value={selected} onChange={event => selectUpdate(event.target.value)}>{releases.map(release => <option key={release.id} value={release.id}>{release.version}{release.id === latestUpdate.id ? ' (latest)' : ''}</option>)}</select></div>
    {archiveEntry ? <ConvertArchiveUpdate release={archiveEntry}/> : selected === servicesUpdate.id ? <ServicesUpdate/> : selected === polishUpdate.id ? <PolishUpdate/> : selected === browserUpdate.id ? <BrowserUpdate/> : selected === bugFixUpdate.id ? <BugFixUpdate/> : <BetaUpdate/>}
    <nav className="update-pagination" aria-label="Browse updates">
      {newer && <a className="update-page-link update-page-newer" href={`#${newer.id}`} aria-label={`Previous page: ${newer.version}`}><span aria-hidden="true">←</span><span>{newer.version}</span></a>}
      {older && <a className="update-page-link update-page-older" href={`#${older.id}`} aria-label={`Next page: ${older.version}`}><span>{older.version}</span><span aria-hidden="true">→</span></a>}
    </nav>
  </div>
}

function ConvertArchiveUpdate({ release }: { release: ConvertArchiveEntry }) {
  return <article className="beta-update" id={release.id} aria-labelledby={`${release.id}-title`}>
    <header className="beta-update-header"><div className="beta-update-meta"><a className="release-version" href={`#${release.id}`} aria-label="Link to this update">Convert archive</a><time dateTime={release.date}>{release.dateLabel}</time></div><h2 id={`${release.id}-title`} tabIndex={-1}>{release.title}</h2></header>
    <div className="beta-update-copy">
      <p className="update-intro">{release.summary}</p>
      <section><h3>What changed.</h3><ul>{release.changes.map(change => <li key={change}>{change}</li>)}</ul></section>
      <p>Reconstructed from the project’s Git history. These notes describe Convert at the time; today’s features may differ. <a href={`https://github.com/Clyvora/Convert/commit/${release.commit}`} target="_blank" rel="noopener noreferrer">View original changes on GitHub.</a></p>
    </div>
  </article>
}

function ServicesUpdate() {
  return <article className="beta-update" id={servicesUpdate.id} aria-labelledby="services-update-title">
    <header className="beta-update-header"><div className="beta-update-meta"><a className="release-version" href={`#${servicesUpdate.id}`} aria-label="Link to this update">{servicesUpdate.version}</a><time dateTime={servicesUpdate.date}>11 November 2026</time></div><h2 id="services-update-title" tabIndex={-1}>{servicesUpdate.title}</h2></header>
    <img className="beta-update-banner" src={servicesBanner} srcSet={`${servicesBannerSmall} 640w, ${servicesBanner} 1280w`} sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) calc(100vw - 152px), 935px" decoding="async" fetchPriority="high" alt="mewvi sitting beside a whiteboard with all 15 supported service logos drawn in coloured marker." width="1280" height="720"/>
    <div className="beta-update-copy">
      <p className="update-intro">We've added eight more services, bringing the list to 15. The cat needed a bigger whiteboard.</p>
      <section><h3>More links to try.</h3><p>You can now download public Twitch clips, Bluesky video posts, Pinterest video pins, Streamable clips, Dailymotion videos, Bandcamp track audio, and video posts from Imgur and 9GAG.</p><p>Bandcamp uses publicly playable audio. For silent Imgur clips, choose Video only. Availability varies by link and region; private and sign-in-required videos remain unsupported.</p></section>
      <section><h3>Find the right service.</h3><p>The services popup is smaller, with a compact icon grid and a gentle spring when it opens and closes. Hover over an icon to see supported links and limits in a short tooltip, beside the popup when space allows. Keyboard focus shows the same details; on touch screens, tap.</p><p>YouTube links that include a playlist now offer a shortcut to choose its items. SoundCloud playlists and Bandcamp albums default to audio when you use Auto, while keeping your chosen audio format.</p></section>
      <section><h3>Know what happens next.</h3><p>Checking, downloading, preparing files and ready-to-save results now have clearer status cards and labels. Progress shows a percentage when the download size is known. Errors keep your link and offer an Edit link action; View downloads takes you to your files.</p></section>
      <section><h3>Room on smaller screens.</h3><p>Download controls stack on narrow phones, long titles wrap, and panels scroll while keeping their close buttons within reach. Shorter windows and enlarged layouts also get more room for navigation and save controls. Reduced-motion settings still keep the services popup instant.</p></section>
      <section className="update-fixes"><h3>A few fixes, too.</h3><ul>
        <li>Clearer messages for blocked sources, access restrictions and service outages.</li>
        <li>Fixed connection failures affecting public links on some networks.</li>
        <li>Made page and category changes reset the scroll position immediately, removed fade-in delays, and sped up changing labels.</li>
        <li>Warmed the local converter before its first visit and stopped redrawing it when changing download settings on another page.</li>
      </ul></section>
    </div>
  </article>
}

function PolishUpdate() {
  return <article className="beta-update" id={polishUpdate.id} aria-labelledby="polish-update-title">
    <header className="beta-update-header"><div className="beta-update-meta"><a className="release-version" href={`#${polishUpdate.id}`} aria-label="Link to this update">{polishUpdate.version}</a><time dateTime={polishUpdate.date}>10 November 2026</time></div><h2 id="polish-update-title" tabIndex={-1}>{polishUpdate.title}</h2></header>
    <img className="beta-update-banner" src={polishBanner} srcSet={`${polishBannerSmall} 640w, ${polishBanner} 1280w`} sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) calc(100vw - 152px), 935px" decoding="async" fetchPriority="high" alt="mewvi resting its chin between two rounded paws on a wooden windowsill in warm autumn light." width="1280" height="720"/>
    <div className="beta-update-copy">
      <p className="update-intro">A small update to make mewvi easier to read and move around, especially on phones and tablets.</p>
      <section><h3>A little more room.</h3><p>On phones, the Downloads button and Beta label now sit in a solid top bar. They stay clear of the text as you scroll. Navigation labels, hints and service descriptions are larger, too.</p><p>Tablets now use the grouped <a href="/settings">Settings menu</a>, with a page for each category. Format and bitrate choices line up in evenly sized rows, with room for their labels.</p></section>
      <section><h3>Fewer things to hunt for.</h3><ul>
        <li>Switch releases from the selector at the top of Updates on smaller screens. It stays within reach while you read.</li>
        <li>Choose any <a href="/about">About section</a> from the mobile dropdown, without searching through a sideways tab bar.</li>
        <li>See platform names beneath the supported-service icons. The panel also explains that Spotify links find matching audio on YouTube.</li>
      </ul></section>
      <section><h3>A reason for disabled controls.</h3><p>When you choose Original in <a href="/settings/audio">Audio settings</a>, a visible note explains why bitrate, sample rate and channels keep their source values. You can read it with setting descriptions turned off. Choose another format to adjust those controls; mewvi keeps your previous encoding choices when you switch back.</p></section>
      <section className="update-fixes"><h3>Bug fixes &amp; improvements</h3><ul>
        <li>Fixed update links drifting or clipping when changing browser zoom. The arrows now follow the space beside the article, with links below it on narrower layouts.</li>
        <li>Kept release selectors, direct links and browser back and forward navigation in sync.</li>
      </ul></section>
    </div>
  </article>
}

function BrowserUpdate() {
  return <article className="beta-update" id={browserUpdate.id} aria-labelledby="browser-update-title">
    <header className="beta-update-header"><div className="beta-update-meta"><a className="release-version" href={`#${browserUpdate.id}`} aria-label="Link to this update">{browserUpdate.version}</a><time dateTime={browserUpdate.date}>7 November 2026</time></div><h2 id="browser-update-title" tabIndex={-1}>{browserUpdate.title}</h2></header>
    <img className="beta-update-banner" src={browserBanner} srcSet={`${browserBannerSmall} 640w, ${browserBanner} 1280w`} sizes="(max-width: 700px) calc(100vw - 40px), 934px" decoding="async" fetchPriority="high" alt="mewvi’s black and orange cat riding a glowing orange paper plane above the city at night." width="1280" height="720"/>
    <div className="beta-update-copy">
      <p className="update-intro">Faster checks, more downloads on your device, and a little less waiting between you and your files.</p>
      <section><h3>More work on your device.</h3><p>Compatible SoundCloud, X, Facebook and Instagram downloads can now travel straight to your browser. When audio and video arrive separately, mewvi can combine them on your device without re-encoding. No extra app or browser extension is needed.</p><p>Your queue, progress, cancel and retry controls stay in one place. Browser transfers show their downloaded size and speed, with a separate stage when tracks are being combined. If direct access fails, mewvi falls back to the standard download path in the same queue.</p><p>Link checking still uses the media service. Direct-download files stay in this tab and are not stored in the app cache. Save them before closing or refreshing the page.</p></section>
      <section><h3>Seven favourites. One place.</h3><p>We’re focusing on SoundCloud, YouTube, Spotify links, Instagram, TikTok, X and Facebook. The services panel now puts those seven up front, with no catalog search or extra counter.</p><p>We’ve improved source connections for YouTube, TikTok and Spotify track matches. Spotify track links find matching audio on YouTube, with the source shown in the downloader.</p><p>More services will come over time. We’re taking the time to test and improve each one, from checking a link to saving the finished file. We’d rather have a smaller set that works reliably than a long list of services that barely work. Getting these seven into better shape comes first.</p></section>
      <section><h3>Keep the quality your source offers.</h3><p>Best available audio now follows the source’s format preference instead of comparing bitrate alone across different codecs. That helps SoundCloud and other audio sources keep a better available stream from being overlooked.</p><p>Original preserves compatible audio without re-encoding, including supported lossless audio. When you choose a different format, Best available now uses higher-quality automatic encoding settings unless you’ve selected a bitrate yourself.</p><p>The source still sets the limit: these changes preserve available quality, and cannot restore detail that wasn’t there or unlock subscriber-only audio.</p></section>
      <section><h3>Less time checking. More time downloading.</h3><p>We’ve reduced repeated setup between link checks. Larger downloads can also fetch several parts at once while keeping the quality you chose.</p><p>Sources can still take longer to respond, especially on a first check. When direct browser access isn’t available, the standard download path stays ready.</p></section>
      <section className="update-fixes"><h3>Bug fixes &amp; improvements</h3><ul>
        <li>Browser downloads:<ul>
          <li>Fixed slow transfers switching to the standard download path after 15 seconds even when data was still arriving.</li>
          <li>The source timeout now follows inactivity. Stalled transfers still time out, and the overall download limit stays in place.</li>
          <li>Added direct save links for files ready in your tab.</li>
          <li>Queued local audio/video merging so files can finish without getting in each other’s way.</li>
          <li>The combining engine loads only when needed and can be reused for the next file.</li>
        </ul></li>
        <li>Queue &amp; controls:<ul>
          <li>Cancelled downloads now update as soon as cancellation succeeds, without waiting for another queue refresh.</li>
          <li>Fixed simultaneous requests exceeding the browser download queue limit.</li>
          <li>Fixed repeated requests starting a duplicate download when the browser queue was full.</li>
        </ul></li>
        <li>Formats &amp; link checks:<ul>
          <li>Preserved supported ALAC and higher-bit-depth WAV audio in compatible Original downloads.</li>
          <li>Checked files with missing codec details before rejecting Original audio, and prevented an incompatible Original download from silently being re-encoded.</li>
          <li>Improved original-audio selection on YouTube.</li>
          <li>Fixed unnecessary container changes for some Original videos.</li>
          <li>Reduced repeated engine startup between link checks, with bounded waits and recovery after a checker stops responding.</li>
          <li>Refreshed browser-download availability when a media-service restart clears temporary source details.</li>
          <li>Improved recovery after cancelled or timed-out link checks.</li>
        </ul></li>
        <li>Interface:<ul>
          <li>Added a grouped mobile Settings menu with separate category pages and a back button.</li>
          <li>Hidden mobile scrollbars while keeping touch and keyboard scrolling available.</li>
          <li>Fixed the mobile converter layout overlapping artwork and squeezing the upload controls after the page loaded.</li>
          <li>Kept the selected About category visible in the mobile category bar.</li>
          <li>The supported-services panel now opens without waiting for a catalog request, and each icon shows a short description.</li>
          <li>Shortened the link-field hint so it fits on narrow screens.</li>
          <li>Kept download mode controls consistent while a request is in progress.</li>
          <li>Updated Settings version labels to follow the current app version.</li>
          <li>Kept older update links working when browsing the new release.</li>
        </ul></li>
      </ul></section>
    </div>
  </article>
}

function BugFixUpdate() {
  return <>
    <article className="beta-update" id={bugFixUpdate.id} aria-labelledby="bug-fix-update-title">
      <header className="beta-update-header"><div className="beta-update-meta"><a className="release-version" href={`#${bugFixUpdate.id}`} aria-label="Link to this bug-fix update">{bugFixUpdate.version}</a><time dateTime={bugFixUpdate.date}>30 October 2026</time></div><h2 id="bug-fix-update-title" tabIndex={-1}>{bugFixUpdate.title}</h2></header>
      <img className="beta-update-banner" src={updateBanner} srcSet={`${updateBannerSmall} 640w, ${updateBanner} 1280w`} sizes="(max-width: 700px) calc(100vw - 40px), 934px" decoding="async" alt="mewvi’s black and orange cat working on a laptop at night." width="1659" height="948"/>
      <div className="beta-update-copy">
        <p className="update-intro">Live transfer details and a few fixes to keep your downloads moving, make link checking clearer, and give the app less work to do when things are quiet.</p>
        <section><h3>More links. One go.</h3><p>Paste up to 20 public media links, one per line, and add them to your queue together. Repeated links are checked once, each link gets its own result, and a failed source won’t stop the rest. You can stop adding the remaining links while keeping downloads already queued.</p><p>Playlists and profiles still need to be opened separately so you can choose their items. If the service asks you to wait, the batch pauses before continuing.</p></section>
        <section><h3>See your speed and time remaining.</h3><p>The queue now shows transfer speed and an estimated time remaining when the source provides them. These figures describe the current source stream being fetched by the media service. Separate audio and video streams can have their own estimates; processing and the final download to your browser take additional time.</p><p>When an estimate is unavailable, the queue says so. If progress stops arriving, it shows that it’s waiting for an update instead of leaving an old speed on screen.</p></section>
        <section className="update-fixes"><h3>Bug fixes &amp; improvements</h3><ul>
          <li>Fixed slow collection refreshes delaying the download queue.</li>
          <li>Fixed delayed queue responses briefly hiding newly added downloads.</li>
          <li>Reduced idle queue checks and skipped unnecessary updates when nothing changes.</li>
          <li>Fixed Cancel check staying visible after link checking had finished.</li>
        </ul></section>
      </div>
    </article>
  </>
}

function BetaUpdate() {
  return <article className="beta-update" id={update.id} aria-labelledby="beta-update-title">
    <header className="beta-update-header"><div className="beta-update-meta"><a className="release-version" href={`#${update.id}`} aria-label="Link to this beta update">{update.version}</a><time dateTime={update.date}>29 October 2026</time></div><h2 id="beta-update-title" tabIndex={-1}>{update.title}</h2></header>
    <img className="beta-update-banner" src={bannerLarge} srcSet={`${bannerSmall} 640w, ${bannerLarge} 1280w`} sizes="(max-width: 700px) calc(100vw - 40px), 900px" decoding="async" alt="mewvi’s black and orange cat, ready for the beta." width="1731" height="909"/>
    <div className="beta-update-copy">
      <p className="update-intro">mewvi has a new home, a simpler way to get your media, and a small companion with a very important job: looking busy while the actual work happens.</p>
      <p>We’ve brought public-link downloads and local conversion into one workspace. There’s more room for your files, fewer steps between you and a download, and a little more personality along the way.</p>
      <aside className="beta-callout"><span>β</span><div><strong>We’re in beta. Come kick the tires.</strong><p>mewvi is still being built and tested. Features can change, sources can fail, and there are rough edges to work through. This is a beta update, not a promise that every source or feature works perfectly.</p></div></aside>
      <section><h3>From Convert to mewvi.</h3><p>Convert is now mewvi. A shorter name, a cat of its own, and the same Clyvora project underneath. The glossy orange arrows have handed things over to a simpler mark that stays sharp at small sizes.</p>
        <div className="brand-evolution" aria-label="Previous Convert and new mewvi logos"><figure><div className="brand-evolution-image"><img src="/brand-convert-previous.webp" alt="Previous Convert logo: glossy orange conversion arrows." width="140" height="140" loading="lazy" decoding="async"/></div><figcaption>Convert<span>The orange arrows</span></figcaption></figure><span className="brand-evolution-arrow" aria-hidden="true">→</span><figure><div className="brand-evolution-image"><img src="/brand-cat-transparent.svg" alt="New mewvi logo: the white cat head." width="140" height="140" loading="lazy" decoding="async"/></div><figcaption>mewvi<span>The cat takes over</span></figcaption></figure></div>
        <p>You’ll find the cat in the navigation, the browser tab, and mewvi’s listing on Clyvora.tech. The favicon also has a transparent background now. This is mewvi’s new identity; the main Clyvora brand keeps its own logo.</p><p>The full-colour artwork has a place too: the new social card introduces the cat when you share a link, and opens this very update.</p>
      </section>
      <section><h3>Paste a link. Pick your output. Go.</h3><p>The download screen keeps the basics close: Auto, Audio, and Video only. <a href="/settings/video">Settings</a> holds your preferred formats and finer details. When a source can’t provide your choice, mewvi asks you to pick an alternative.</p><p>Collections get an item picker before work starts. Progress, cancellation, retries, and completed files live in a compact queue beside the download button.</p></section>
      <section><h3>Your files don’t need a round trip.</h3><p>Choose <a href="/local">Local conversion</a> to work with audio and video on your device. Processing happens in your browser. You can move between pages while work runs; after a refresh, local files need to be selected again.</p><p>Public links work differently: they contact Clyvora’s media service and the source platform. Remote jobs can return after a refresh, and completed files remain available until they expire. <a href="/about/privacy">Read how your data is handled.</a></p></section>
      <section><h3>Settings finally have their own space.</h3><p>No more squeezing everything into one panel. Settings has a grouped category list, direct links to individual pages, and compact controls for formats, quality, audio tracks and extras.</p><ul><li><a href="/settings/appearance">Appearance</a> adds an automatic theme that follows your device, alongside light and dark.</li><li><a href="/settings/accessibility">Accessibility</a> lets you reduce motion and transparency, keep the queue closed while work starts, or choose manual downloads.</li><li><a href="/settings/advanced">Advanced</a> can export your preferences, import them on another browser, or reset them after confirmation. Jobs and files are not included in a settings export.</li></ul><p>Setting descriptions are optional, so the everyday view stays quiet. The little link beside section headings copies a direct link to that section.</p></section>
      <section><h3>A queue that knows when it’s finished.</h3><p>New work can start its download automatically when the file is ready. Once the service has sent the full file to your browser, a successful job moves out of the active queue and into Recent downloads. Download again stays available until the file expires.</p><p>A refresh restores available jobs without sending the same file again. Temporary download-link errors get a bounded retry, and partial collections keep their failed items visible so you can retry those items without repeating completed work.</p><p>Original audio also keeps its source settings instead of applying an old bitrate preference and doing an unnecessary conversion. If you want a particular encoding, choose an explicit format in <a href="/settings/audio">Audio settings</a>.</p><p>Your browser may still ask you to allow automatic downloads. A transfer to the browser does not confirm that you saved the file to disk, so the manual download button remains available.</p></section>
      <section className="update-cat-section"><h3>A little company for your downloads.</h3><p>Our cat has a few things to say. Five still poses follow the download flow. The empty queue gets a sleeping companion, and local conversion gets a stretch before the work begins. Motion stays with useful status changes, rather than the artwork.</p><div className="update-cat-cast">{cast.map(cat => <div key={cat.pose}><Mascot pose={cat.pose}/><strong>{cat.label}</strong></div>)}</div></section>
      <section><h3>Less bouncing. More useful movement.</h3><p>The artwork stays still: no bobbing cat, rotating logo, or image jumping when you hover. Torph handles short text changes where they help—like an action becoming ready, a processing stage changing, or a queue total updating.</p><p>Your device’s reduced-motion setting is respected. mewvi’s own <a href="/settings/accessibility">Reduce motion</a> option turns those transitions off too.</p></section>
      <section><h3>The little details add up.</h3><ul><li>Dedicated Settings, Updates, and About pages, with browser back and forward support.</li><li>Separate audio and video format preferences, saved in your browser.</li><li>A compact services menu with platform icons and full catalog search.</li><li>Light and dark themes, keyboard access, and motion that respects your device preferences.</li><li>Automatic delivery for newly submitted work, with a manual download button if you need it. Refresh won’t repeat the automatic download.</li></ul></section>
      <section><h3>What’s still growing?</h3><p>Provider reliability, collection behavior, and the small details that only show up through use. A provider appearing in the catalog isn’t proof that every link, playlist, or profile works. Public-link processing also requires an available media backend.</p><p>The current free service has limited processing capacity, so inspecting a source or converting a file can take time. Remote files normally expire after 24 hours, and temporary server storage can be cleared during a replacement. Download results you want to keep.</p><p>Keep your original files while trying the beta. Download media you have permission to use; private accounts, authentication barriers, paywalls, and DRM aren’t bypassed.</p><p>If something goes wrong, <a href="/about/community">tell us what happened</a>: your browser, chosen settings and the error shown are a useful start. Leave out private links, personal files and download access links.</p></section>
      <footer className="update-letter-end"><Mascot pose="ready"/><div><p>Thanks for helping us shape mewvi.</p><span>— Clyvora, and the cat.</span></div></footer>
    </div>
  </article>
}
