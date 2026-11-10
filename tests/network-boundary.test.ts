import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const networkAPIs = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon'])

function usesNetworkAPI(source: string): boolean {
  const file = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found = false
  const visit = (node: ts.Node) => {
    if (found) return
    if (ts.isIdentifier(node) && networkAPIs.has(node.text)
      || ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && networkAPIs.has(node.argumentExpression.text)) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return productionSources(path)
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  })
}

describe('Convert network boundary', () => {
  it('isolates network API references to the API client and guarded browser downloader', () => {
    const matches = productionSources(join(root, 'src')).filter((path) => usesNetworkAPI(readFileSync(path, 'utf8')))
    expect(matches.map((path) => relative(root, path).replaceAll('\\', '/')).sort()).toEqual([
      'src/core/browserDownload.ts',
      'src/core/mediaClient.ts',
    ])
  })

  it.each([
    'fetch("/api")',
    'window.fetch("/api")',
    'globalThis["fetch"]("/api")',
    'const { fetch: request } = window; request("/api")',
    'new XMLHttpRequest()',
    'new WebSocket("wss://example.com")',
    'new EventSource("/events")',
    'navigator.sendBeacon("/events", "data")',
    'const send = navigator["sendBeacon"]; send("/events", "data")',
  ])('detects network API references in code: %s', source => {
    expect(usesNetworkAPI(source)).toBe(true)
  })

  it.each([
    'const text = "fetch XMLHttpRequest WebSocket EventSource sendBeacon"',
    '// fetch XMLHttpRequest WebSocket EventSource sendBeacon',
    '/* fetch XMLHttpRequest WebSocket EventSource sendBeacon */',
    'const copy = <p>Larger downloads can also fetch several parts at once.</p>',
  ])('ignores network words in prose, strings and comments: %s', source => {
    expect(usesNetworkAPI(source)).toBe(false)
  })

  it('submits only the validated URL to the resolver', () => {
    const client = readFileSync(join(root, 'src/core/mediaClient.ts'), 'utf8')
    expect(client).toContain('const url = validatePublicUrl(input)')
    expect(client).toContain('body: JSON.stringify({ url: url.href })')
    expect(client).not.toMatch(/new FormData|readAsDataURL|arrayBuffer\(\)/)
  })
})
