import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { searchPages, siteOrigin } from '../src/core/seo.ts'
const sitemap = await readFile('dist/sitemap.xml', 'utf8')
const titles = new Set()
for (const path of Object.keys(searchPages)) {
  const html = await readFile(path === '/' ? 'dist/index.html' : `dist${path}/index.html`, 'utf8')
  assert(html.includes(`rel="canonical" href="${siteOrigin}${path}"`), `Wrong canonical: ${path}`)
  assert(sitemap.includes(`<loc>${siteOrigin}${path}</loc>`), `Missing from sitemap: ${path}`)
  assert(!html.includes('<div id="root"></div>'), `Empty initial HTML: ${path}`)
  assert(html.includes('<h1'), `No primary heading: ${path}`)
  assert(html.includes('index, follow, max-image-preview:large'), `Not indexable: ${path}`)
  const title = html.match(/<title>(.*?)<\/title>/)[1]
  assert(!titles.has(title), `Duplicate title: ${path}`); titles.add(title)
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
  assert.equal(schema['@graph'].find(item => item['@type'] === 'WebPage').url, siteOrigin + path)
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)) await access('dist' + asset)
}
assert((await readFile('dist/settings/index.html','utf8')).includes('noindex, follow'))
assert((await readFile('dist/404.html','utf8')).includes('noindex, follow'))
assert(!sitemap.includes('/settings'))
console.log(`SEO checks passed for ${Object.keys(searchPages).length} readable pages, structured data, assets, sitemap and indexing rules.`)
