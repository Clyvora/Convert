import { Children, cloneElement, isValidElement, lazy, Suspense, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import Mascot from './Mascot'
import { PageDirectory, SectionHeading } from './PagePrimitives'
import { useSectionNavigation } from '../core/navigation'
import { Icon } from './Icon'
import { version } from '../../package.json'
import './AboutPage.css'

const AboutPolicies=lazy(()=>import('./AboutPolicies'))

const sections = [
  { id: 'general', label: 'What’s mewvi?', icon: 'about', group: 0 },
  { id: 'community', label: 'Community & support', icon: 'instances', group: 0 },
  { id: 'privacy', label: 'Privacy policy', icon: 'privacy', group: 1 },
  { id: 'terms', label: 'Terms and ethics', icon: 'metadata', group: 1 },
  { id: 'credits', label: 'Thanks & licenses', icon: 'check', group: 1 },
] as const
const ids = sections.map(s => s.id)
function LinkedSections({ children }: { children: ReactNode }): ReactNode {
  return Children.map(children, child => {
    if (!isValidElement<{ children?: ReactNode; id?: string }>(child)) return child
    if(child.type==='h2')return cloneElement(child,{id:child.props.id||String(child.props.children).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'')})
    if (child.type === 'h3') {
      const title = String(child.props.children)
      return <SectionHeading id={title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}>{title}</SectionHeading>
    }
    return child.props.children ? cloneElement(child, {}, <LinkedSections>{child.props.children}</LinkedSections>) : child
  })
}
function External({ href, children }: { href: string; children: ReactNode }) { return <a href={href} target="_blank" rel="noreferrer">{children}<span className="sr-only"> (opens in a new tab)</span></a> }

export default function AboutPage({ onUpdates }: { onUpdates?: () => void }) {
  const section = useSectionNavigation('/about', ids, 'general', { support: 'community', usage: 'terms' })
  const article = useRef<HTMLElement>(null)
  useEffect(()=>{
    const heading=article.current?.querySelector('h2')
    heading?.setAttribute('tabindex','-1')
    heading?.focus({preventScroll:true})
    const hash=location.hash.slice(1)
    if(hash){const target=document.getElementById(hash);if(target&&article.current?.contains(target))target.scrollIntoView({block:'start',behavior:'instant'})}
  },[section])
  const updatesLink = <a href="/updates" onClick={event => { if (onUpdates && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onUpdates() } }}>Updates</a>
  return <div className="about-guide directory-layout">
    <PageDirectory title="About" base="/about" rootSection="general" compactLabel="About section" entries={sections} selected={section} companion={section !== 'general' && <Mascot className="directory-companion" pose={section === 'privacy' ? 'sleeping' : section === 'community' ? 'attention' : 'complete'}/>}/>
    <article ref={article} key={section} className={`about-document about-${section}`} aria-label={sections.find(s => s.id === section)!.label}><LinkedSections>
      {section === 'general' && <>
        <header className="about-overview"><div><p className="about-eyebrow">A Clyvora project</p><h2 id="media-in-the-format-you-need">Meet mewvi.</h2><p>Save public media, convert your own files and collect the posts you want to keep.</p><span className="about-release">{version}</span></div><Mascot pose="complete"/></header>
        <nav className="about-workflows" aria-label="Choose a workspace">
          <a id="public-links" href="/"><span className="about-workflow-icon"><Icon name="download"/></span><span><strong>Download media</strong><span>Paste a public link and choose your audio or video format.</span></span><Icon name="arrow"/></a>
          <a id="your-files-your-device" href="/local"><span className="about-workflow-icon"><Icon name="convert"/></span><span><strong>Convert your files</strong><span>Audio and video under 2 GB each, processed on your device.</span></span><Icon name="arrow"/></a>
          <a href="/tools"><span className="about-workflow-icon"><Icon name="tools"/></span><span><strong>Collect with Tools</strong><span>Choose Instagram photos and videos, or collect a channel’s YouTube Shorts in a ZIP.</span></span><Icon name="arrow"/></a>
        </nav>
        <h3>How your files are handled</h3><dl className="about-file-facts">
          <div><dt>Your local files</dt><dd>Stay in this browser. Save converted results before refreshing or closing the tab.</dd></div>
          <div><dt>Your public links</dt><dd>Reach our media service and the source platform. Available remote jobs can return after a refresh.</dd></div>
        </dl><p className="about-detail-link"><a href="/about/privacy">Read the privacy policy <Icon name="arrow"/></a></p>
        <aside id="still-in-beta" className="about-beta-note" aria-label="Beta availability"><Icon name="warning"/><div><strong>Still in beta</strong><p>Sources can change, and Instagram profiles remain experimental. Keep your originals and check your results.</p><a href="/about/community">Get help or report a problem</a></div></aside>
        <footer id="part-of-clyvora" className="about-project-note"><p>mewvi began as Convert. We’re part of <External href="https://www.clyvora.tech/">Clyvora</External>, a collection of focused browser tools.</p><div>{updatesLink}<a href="/about/credits">Credits &amp; licenses</a></div></footer>
      </>}
      {section === 'privacy' && <Suspense fallback={<p role="status">Loading privacy policy…</p>}><AboutPolicies kind="privacy"/></Suspense>}
      {section === 'terms' && <Suspense fallback={<p role="status">Loading terms…</p>}><AboutPolicies kind="terms"/></Suspense>}
      {section === 'community' && <>
        <h2>Help make mewvi better.</h2>
        <p className="about-page-intro">Found a bug or have an idea? Here’s where to start.</p>
        <div className="community-links"><a href="https://github.com/Clyvora/Convert/issues" target="_blank" rel="noreferrer"><strong>Report a problem <span aria-hidden="true">↗</span></strong><span>Share bugs and suggestions on GitHub.<span className="sr-only"> Opens in a new tab.</span></span></a><a href="/updates"><strong>Read the updates <Icon name="arrow"/></strong><span>See what changed in the current beta.</span></a></div>
        <h3>What to include</h3><ol className="about-report-steps"><li>What you tried, what you expected and what happened.</li><li>Your browser, device and the output settings you chose.</li><li><strong>Copy error details</strong>, when the error offers it. The report excludes links and filenames.</li></ol><p>A permitted public sample can help with link problems. Leave out personal files, private links, passwords, cookies and signed download links.</p>
        <h3>Before retrying</h3><ul className="about-help-list"><li><strong>A download failed?</strong> Check its error. Retry keeps completed items; expired files need a fresh download.</li><li><strong>A local conversion stopped?</strong> Save and clear completed files to free memory, then try a smaller resolution or compressed audio.</li><li><strong>A scan ended early?</strong> Save the found items as a partial ZIP. Instagram profile scans are experimental.</li></ul>
        <h3>Security reports</h3><p>Follow <External href="https://github.com/Clyvora/Convert/blob/main/SECURITY.md">SECURITY.md</External> for suspected vulnerabilities. Keep sensitive details out of public issues.</p>
        <p className="about-source-link"><External href="https://github.com/Clyvora/Convert">View the source on GitHub</External><a href="/about/credits">Credits &amp; licenses</a></p>
      </>}
      {section === 'credits' && <Suspense fallback={<p role="status">Loading credits and licenses…</p>}><AboutPolicies kind="credits"/></Suspense>}
    </LinkedSections></article>
  </div>
}
