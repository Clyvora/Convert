import { useCallback, useEffect, useRef, type MouseEvent } from 'react'
import LocalConverter from './LocalConverter'
import RemoteMedia, { About } from './components/RemoteMedia'
import SettingsPage from './components/SettingsPage'
import Updates from './components/Updates'
import { Icon } from './components/Icon'
import { useRemoteMedia, type Panel } from './core/useRemoteMedia'
import { useNavigation, type Route } from './core/navigation'
import './polish.css'

const titles = { '/': 'Convert', '/local': 'Local conversion', '/settings': 'Settings', '/updates': 'Updates', '/about': 'About Convert', missing: 'Page not found' }

export default function App() {
  const { route, navigate } = useNavigation()
  const remote = useRemoteMedia()
  const closePanel = remote.setPanel
  const heading = useRef<HTMLHeadingElement>(null)
  const setPanel = (panel: Panel) => {
    if (panel === 'settings' || panel === 'updates' || panel === 'about') { remote.setPanel(null); navigate(`/${panel}`) }
    else remote.setPanel(panel)
  }
  const controller = { ...remote, setPanel }
  const showLocal = useCallback(() => navigate('/local'), [navigate])
  useEffect(() => {
    document.title = `${titles[route]} · Clyvora`
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
  return <div className="convert-app">
    <span className="mobile-beta">Beta</span>
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <nav className="app-rail" aria-label="Convert navigation">
      <a className="rail-brand" href="/" onClick={event => visit(event, '/')} aria-label="Clyvora Convert home, beta"><img src="/brand-cat-transparent.svg" alt="" width="52" height="52"/><span className="app-beta-label">Beta</span></a>
      <div className="rail-workspaces">{link('/', 'Download workspace', 'download', 'Download')}{link('/local', 'Local conversion workspace', 'convert', 'Convert')}</div>
      <div className="rail-utilities">{link('/updates', 'Open updates', 'updates', 'Updates')}{link('/settings', 'Open settings', 'settings', 'Settings')}{link('/about', 'About Convert', 'about', 'About')}</div>
    </nav>
    <button className={`queue-trigger ${remote.activeCount ? 'has-active-jobs' : ''}`} type="button" aria-label={`Open download queue${remote.activeCount ? `, ${remote.activeCount} active` : ''}`} aria-expanded={remote.panel === 'queue'} onClick={() => remote.setPanel('queue')}><Icon name="download"/>{remote.activeCount > 0 && <span className="queue-count">{remote.activeCount}</span>}</button>
    <main id="workspace" className="app-workspace" tabIndex={-1}>
      <h1 ref={heading} tabIndex={-1} className={infoPage ? 'page-title' : 'sr-only'}>{titles[route]}</h1>
      <RemoteMedia active={route === '/'} controller={controller}/>
      <LocalConverter active={route === '/local'} onShow={showLocal}/>
      {infoPage && <div className={`content-page ${route === '/settings' ? 'settings-page' : ''}`}>
        {route === '/settings' && <SettingsPage controller={controller}/>}
        {route === '/updates' && <Updates/>}{route === '/about' && <About/>}
        {route === 'missing' && <p>This page isn’t available. <a href="/" onClick={event => visit(event, '/')}>Return to downloads</a>.</p>}
      </div>}
    </main>
  </div>
}
