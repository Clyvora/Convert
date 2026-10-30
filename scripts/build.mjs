import { build } from 'vite'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pageSEO, searchPages, structuredData } from '../src/core/seo.ts'
const root = resolve('.')
const serverDir = join(root, '.prerender')
if (serverDir !== resolve(root, '.prerender')) throw new Error('Invalid prerender path')
const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
await build()
try {
  await build({ build: { ssr: 'src/entry-server.tsx', outDir: serverDir, emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'entry-server.js' } } } })
  const { render } = await import(pathToFileURL(join(serverDir, 'entry-server.js')).href)
  const template = await readFile('dist/index.html', 'utf8')
  const settings = ['appearance','accessibility','advanced','video','audio','instances','metadata','local','privacy','debug']
  for (const path of [...Object.keys(searchPages), '/settings', ...settings.map(s => '/settings/' + s), '/404']) {
    const page = pageSEO(path)
    const rendered = await render(path)
    let html = template.replace('<div id="root"></div>', () => '<div id="root">' + rendered + '</div>')
    html = html.replace(/<title>.*?<\/title>/s, '<title>' + escape(page.title) + '</title>')
    for (const [name, content] of Object.entries({description:page.description,robots:page.robots,'og:title':page.title,'og:description':page.description,'og:url':page.canonical,'twitter:title':page.title,'twitter:description':page.description})) {
      html = html.replace(new RegExp('(<meta (?:name|property)="' + name + '" content=")[^"]*("\\s*/?>)'), (_, a, b) => a + escape(content) + b)
    }
    html = html.replace(/(<link rel="canonical" href=")[^"]*("\s*\/?>)/, (_, a, b) => a + escape(page.canonical) + b)
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => '<script type="application/ld+json">' + JSON.stringify(structuredData(path)).replace(/</g,'\\u003c') + '</script>')
    const file = path === '/404' ? 'dist/404.html' : path === '/' ? 'dist/index.html' : 'dist' + path + '/index.html'
    await mkdir(resolve(file, '..'), { recursive:true }); await writeFile(file, html)
  }
  console.log('Prerendered search pages and private settings; no browser required.')
} finally {
  await rm(serverDir, { recursive:true, force:true })
}
