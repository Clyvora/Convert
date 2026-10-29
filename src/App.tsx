import { useCallback, useEffect, useRef, type MouseEvent } from 'react'
import LocalConverter from './LocalConverter'
import RemoteMedia, { About } from './components/RemoteMedia'
import SettingsPage from './components/SettingsPage'
import Updates from './components/Updates'
import { MorphText } from './MorphText'
import { MotionPreferenceContext } from './core/motionPreference'
import { useInterfacePreferences } from './core/interfacePreferences'
import { Icon } from './components/Icon'
import { useRemoteMedia, type Panel } from './core/useRemoteMedia'
import { useNavigation, type Route } from './core/navigation'
import './polish.css'

const titles = { '/': 'mewvi', '/local': 'Local conversion', '/settings': 'Settings', '/updates': 'Updates', '/about': 'About mewvi', missing: 'Page not found' }

export default function App() {
  const { route, navigate } = useNavigation()
  const remote = useRemoteMedia()
  const [ui] = useInterfacePreferences()
  const closePanel = remote.setPanel
  const heading = useRef<HTMLHeadingElement>(null)
  const setPanel = (panel: Panel) => {
    if (panel === 'settings' || panel === 'updates' || panel === 'about') { remote.setPanel(null); navigate(`/${panel}`) }
    else remote.setPanel(panel)
  }
  const controller = { ...remote, setPanel }
  const showLocal = useCallback(() => navigate('/local'), [navigate])
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(ui.reduceMotion)
    document.documentElement.dataset.reduceTransparency = String(ui.reduceTransparency)
    const media = window.matchMedia?.('(prefers-color-scheme: light)')
    const applyTheme = () => {
      let theme = 'dark'
      try { theme = localStorage.getItem('clyvora-theme') || 'dark' } catch { /* Optional preference. */ }
      const resolved = theme === 'auto' ? media?.matches ? 'light' : 'dark' : theme
      document.documentElement.dataset.theme = resolved
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#fafafa' : '#0a0a0a')
    }
    applyTheme(); media?.addEventListener('change', applyTheme); window.addEventListener('convert-interface-change', applyTheme); window.addEventListener('storage', applyTheme)
    return () => { media?.removeEventListener('change', applyTheme); window.removeEventListener('convert-interface-change', applyTheme); window.removeEventListener('storage', applyTheme) }
  }, [ui.reduceMotion, ui.reduceTransparency])
  useEffect(() => {
    document.title = route === '/' ? 'mewvi' : `${route === '/about' ? 'About' : titles[route]} · mewvi`
    closePanel(null)
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
  }, [route, closePanel])
  const visit = (event: MouseEvent<HTMLAnchorElement>, path: Route) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); navigate(path)
  }
  const link = (path: Route, label: string, icon: Parameters<typeof Icon>[0]['name'], text: string) => <a href={path} aria-label={label} aria-current={route === path ? 'page' : undefined} onClick={event => visit(event, path)}><Icon name={icon}/><span>{text}</span></a>
  const infoPage = !['/', '/local'].includes(route)
  return <MotionPreferenceContext.Provider value={ui.reduceMotion}><div className="convert-app" onClick={event => {
    if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as Element).closest('a[href]') as HTMLAnchorElement | null
    if (!anchor || anchor.target || anchor.hasAttribute('download') || !anchor.getAttribute('href')?.startsWith('/')) return
    const target = new URL(anchor.href)
    if (target.origin !== location.origin || !/^\/(?:local|settings(?:\/[a-z-]+)?|about(?:\/[a-z-]+)?|updates)?$/.test(target.pathname)) return
    event.preventDefault(); navigate(`${target.pathname}${target.hash}`)
  }}>
    <span className="mobile-beta">Beta</span>
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <nav className="app-rail" aria-label="mewvi navigation">
      <a className="rail-brand" href="/" onClick={event => visit(event, '/')} aria-label="mewvi home, beta"><img src="/brand-cat-transparent.svg" alt="" width="52" height="52"/><span className="app-beta-label">Beta</span></a>
      <div className="rail-workspaces">{link('/', 'Download workspace', 'download', 'Download')}{link('/local', 'Local conversion workspace', 'convert', 'Convert')}</div>
      <div className="rail-utilities">{link('/settings', 'Open settings', 'settings', 'Settings')}{link('/updates', 'Open updates', 'updates', 'Updates')}{link('/about', 'About mewvi', 'about', 'About')}</div>
    </nav>
    <button className={`queue-trigger ${remote.activeCount ? 'has-active-jobs' : ''}`} type="button" aria-label={`Open download queue${remote.activeCount ? `, ${remote.activeCount} active` : ''}`} aria-expanded={remote.panel === 'queue'} onClick={() => remote.setPanel('queue')}><Icon name="download"/>{remote.activeCount > 0 && <span className="queue-count"><MorphText>{String(remote.activeCount)}</MorphText></span>}</button>
    <main id="workspace" className="app-workspace" tabIndex={-1}>
      <h1 ref={heading} tabIndex={-1} className="sr-only">{titles[route]}</h1>
      <RemoteMedia active={route === '/'} controller={controller}/>
      <LocalConverter active={route === '/local'} onShow={showLocal}/>
      {infoPage && <div className={`content-page ${route === '/settings' ? 'settings-page' : ''}`}>
        {route === '/settings' && <SettingsPage controller={controller}/>}
        {route === '/updates' && <Updates/>}{route === '/about' && <About onUpdates={() => navigate('/updates')}/>}
        {route === 'missing' && <p>This page isn’t available. <a href="/" onClick={event => visit(event, '/')}>Return to downloads</a>.</p>}
      </div>}
    </main>
  </div></MotionPreferenceContext.Provider>
}
