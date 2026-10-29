import { renderToString } from 'react-dom/server'
import App from './App'
import { RenderPathContext } from './core/renderPath'
export function render(path: string) {
  return renderToString(<RenderPathContext.Provider value={path}><App/></RenderPathContext.Provider>)
}
