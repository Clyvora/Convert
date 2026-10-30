import { renderToReadableStream } from 'react-dom/server'
import App from './App'
import { RenderPathContext } from './core/renderPath'
export async function render(path: string) {
  const stream = await renderToReadableStream(<RenderPathContext.Provider value={path}><App/></RenderPathContext.Provider>)
  await stream.allReady
  return new Response(stream).text()
}
