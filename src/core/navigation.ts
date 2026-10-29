import { useCallback, useEffect, useState } from 'react'

export type Route = '/' | '/local' | '/settings' | '/updates' | '/about'
const routes: string[] = ['/', '/local', '/settings', '/updates', '/about']
function current(): Route | 'missing' {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return routes.includes(path) ? path as Route : 'missing'
}
export function useNavigation() {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const pop = () => setRoute(current())
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  const navigate = useCallback((path: Route) => {
    if (window.location.pathname !== path) window.history.pushState(null, '', path)
    setRoute(path)
  }, [])
  return { route, navigate }
}
