import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return productionSources(path)
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path] : []
  })
}

describe('Convert network boundary', () => {
  it('isolates browser network requests to the public-link client', () => {
    const matches = productionSources(join(root, 'src')).filter((path) => /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(readFileSync(path, 'utf8')))
    expect(matches.map((path) => relative(root, path).replaceAll('\\', '/'))).toEqual(['src/core/mediaClient.ts'])
  })
  it('submits only the validated URL to the resolver', () => {
    const client = readFileSync(join(root, 'src/core/mediaClient.ts'), 'utf8')
    expect(client).toContain('const url = validatePublicUrl(input)')
    expect(client).toContain('body: JSON.stringify({ url: url.href })')
    expect(client).not.toMatch(/new FormData|readAsDataURL|arrayBuffer\(\)/)
  })
})
