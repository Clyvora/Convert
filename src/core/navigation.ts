import { useCallback, useEffect, useState } from 'react'

export type Route = '/' | '/local' | '/settings' | '/updates' | '/about'
const routes: string[] = ['/', '/local', '/settings', '/updates', '/about']
function current(): Route | 'missing' {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (/^\/(settings|about)\/[a-z-]+$/.test(path)) return `/${path.split('/')[1]}` as Route
  return routes.includes(path) ? path as Route : 'missing'
}
export function useNavigation() {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const pop = () => setRoute(current())
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  const navigate = useCallback((path: string) => {
    if (`${window.location.pathname}${window.location.hash}` !== path) window.history.pushState(null, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
    setRoute(current())
  }, [])
  return { route, navigate }
}

export function useSectionNavigation<T extends string>(base: string, sections: readonly T[], fallback: T, aliases: Record<string, T> = {}) {
  const read = () => {
    const path = location.pathname.slice(base.length + 1), hash = location.hash.slice(1)
    const candidate = aliases[path] || path || aliases[hash] || hash
    return sections.includes(candidate as T) ? candidate as T : fallback
  }
  const [section, setSection] = useState(read)
  useEffect(() => {
    const changed = () => setSection(read())
    window.addEventListener('popstate', changed); window.addEventListener('hashchange', changed)
    return () => { window.removeEventListener('popstate', changed); window.removeEventListener('hashchange', changed) }
    // Sections and aliases are static route definitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base])
  return section
}
