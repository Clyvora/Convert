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

describe('production network boundary', () => {
  it('keeps direct network access isolated to the user-triggered link importer', () => {
    const matches = productionSources(join(root, 'src')).filter((path) =>
      /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(readFileSync(path, 'utf8')),
    )
    expect(matches.map((path) => relative(root, path).replaceAll('\\', '/'))).toEqual([
      'src/core/linkImport.ts',
    ])
  })

  it('does not contact link services speculatively', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).not.toMatch(/rel="(?:preconnect|dns-prefetch)"/)
  })
})
