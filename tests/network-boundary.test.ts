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
  it('contains no direct browser network client', () => {
    const matches = productionSources(join(root, 'src')).filter((path) => /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(readFileSync(path, 'utf8')))
    expect(matches.map((path) => relative(root, path))).toEqual([])
  })
  it('does not mention remote imports or SoundCloud in production files', () => {
    const production = productionSources(join(root, 'src')).map((path) => readFileSync(path, 'utf8')).join('\n')
    expect(production).not.toMatch(/soundcloud|paste link|link import/i)
  })
})
