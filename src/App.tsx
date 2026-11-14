import { updatePageSEO } from './core/seo'
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
const loadLocalConverter = () => import('./LocalConverter')
const LocalConverter = lazy(loadLocalConverter)
const warmLocalConverter = () => {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType || '')) return
  void loadLocalConverter().catch(() => { /* Navigation can retry a failed warm-up. */ })
}
import RemoteMedia, { About } from './components/RemoteMedia'
import SettingsPage from './components/SettingsPage'
import ServicesMenu from './components/ServicesMenu'
import Updates from './components/Updates'
import Tools from './components/Tools'
import { MorphText } from './MorphText'
import { MotionPreferenceContext } from './core/motionPreference'
import { useInterfacePreferences } from './core/interfacePreferences'
import { Icon } from './components/Icon'
import { useRemoteMedia, type Panel } from './core/useRemoteMedia'
import { useNavigation, type Route } from './core/navigation'
import './App.css'
import './polish.css'

const titles = { '/': 'mewvi media downloader and converter', '/local': 'Local conversion', '/tools': 'Tools', '/settings': 'Settings', '/updates': 'Updates', '/about': 'About mewvi', missing: 'Page not found' }

export default function App() {
  const { route, navigate } = useNavigation()
  const [localOpened, setLocalOpened] = useState(false)
  useEffect(() => { if (route === '/local') setLocalOpened(true) }, [route])
  useEffect(() => {
    if (localOpened || route === '/local') return
    if (typeof window.requestIdleCallback === 'function') {
      const idle = window.requestIdleCallback(warmLocalConverter, { timeout: 1500 })
      return () => window.cancelIdleCallback(idle)
    }
    const timer = globalThis.setTimeout(warmLocalConverter, 250)
    return () => globalThis.clearTimeout(timer)
  }, [route, localOpened])
  useEffect(() => {
    window.addEventListener('popstate', updatePageSEO)
    return () => window.removeEventListener('popstate', updatePageSEO)
  }, [])
  const remote = useRemoteMedia()
  const [ui] = useInterfacePreferences()
  const closePanel = remote.setPanel
  const setServicesOpen = useCallback((open: boolean) => closePanel(open ? 'services' : null), [closePanel])
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
    updatePageSEO()
    closePanel(null)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    heading.current?.focus({ preventScroll: true })
  }, [route, closePanel])
  const visit = (event: MouseEvent<HTMLAnchorElement>, path: Route) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); navigate(path)
  }
  const link = (path: Route, label: string, icon: Parameters<typeof Icon>[0]['name'], text: string) => <a href={path} aria-label={label} aria-current={route === path ? 'page' : undefined} onClick={event => visit(event, path)} onPointerEnter={path === '/local' ? warmLocalConverter : undefined} onFocus={path === '/local' ? warmLocalConverter : undefined}><Icon name={icon}/><span>{text}</span></a>
  const infoPage = !['/', '/local'].includes(route)
  return <MotionPreferenceContext.Provider value={ui.reduceMotion}><div className="convert-app" onClick={event => {
    if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as Element).closest('a[href]') as HTMLAnchorElement | null
    if (!anchor || anchor.target || anchor.hasAttribute('download') || !anchor.getAttribute('href')?.startsWith('/')) return
    const target = new URL(anchor.href)
    if (target.origin !== location.origin || !/^\/(?:local|tools(?:\/[a-z-]+)?|settings(?:\/[a-z-]+)?|about(?:\/[a-z-]+)?|updates)?$/.test(target.pathname)) return
    event.preventDefault(); navigate(`${target.pathname}${target.hash}`)
  }}>
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <header className="app-toolbar" aria-label="App controls">
      {route === '/' && <ServicesMenu open={remote.panel === 'services'} onOpenChange={setServicesOpen}/>}
      <span className="mobile-beta">Beta</span>
      <button className={`queue-trigger ${remote.activeCount ? 'has-active-jobs' : ''}`} type="button" aria-label={`Open download queue${remote.activeCount ? `, ${remote.activeCount} active` : ''}`} aria-expanded={remote.panel === 'queue'} onClick={() => remote.setPanel('queue')}><Icon name="download"/>{remote.activeCount > 0 && <span className="queue-count"><MorphText>{String(remote.activeCount)}</MorphText></span>}</button>
    </header>
    <nav className="app-rail" aria-label="mewvi navigation">
      <a className="rail-brand" href="/" onClick={event => visit(event, '/')} aria-label="mewvi home, beta"><img src="/brand-cat-transparent.svg" alt="" width="52" height="52" decoding="async" fetchPriority="high"/><span className="app-beta-label">Beta</span></a>
      <div className="rail-workspaces">{link('/', 'Download workspace', 'download', 'Download')}{link('/local', 'Local conversion workspace', 'convert', 'Convert')}{link('/tools', 'Open tools', 'tools', 'Tools')}</div>
      <div className="rail-utilities">{link('/settings', 'Open settings', 'settings', 'Settings')}{link('/updates', 'Open updates', 'updates', 'Updates')}{link('/about', 'About mewvi', 'about', 'About')}</div>
    </nav>
    <main id="workspace" className="app-workspace" tabIndex={-1}>
      <h1 ref={heading} tabIndex={-1} className="sr-only">{titles[route]}</h1>
      <RemoteMedia active={route === '/'} controller={controller}/>
      {(localOpened || route === '/local') && <Suspense fallback={<p role="status">Loading local converter…</p>}><LocalConverter active={route === '/local'} onShow={showLocal}/></Suspense>}
      {infoPage && <div className={`content-page ${route === '/settings' ? 'settings-page' : ''}`}>
        {route === '/settings' && <SettingsPage controller={controller}/>}
        {route === '/tools' && <Tools controller={controller}/>}
        {route === '/updates' && <Updates/>}{route === '/about' && <About onUpdates={() => navigate('/updates')}/>}
        {route === 'missing' && <p>This page isn’t available. <a href="/" onClick={event => visit(event, '/')}>Return to downloads</a>.</p>}
      </div>}
    </main>
  </div></MotionPreferenceContext.Provider>
}
