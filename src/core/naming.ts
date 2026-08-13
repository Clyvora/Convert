import type { MediaFormat } from './types'

function sanitizeStem(name: string): string {
  const withoutExtension = name.replace(/\.[^/.]+$/, '')
  const normalized = withoutExtension.normalize('NFKC')
  const safeCharacters = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
  const safe = Array.from(normalized, (character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || safeCharacters.has(character) ? '-' : character
  }).join('')
    .replace(/-+/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()
  return safe || 'converted'
}

export function outputFilename(inputName: string, output: MediaFormat): string {
  return `${sanitizeStem(inputName)}.${output}`
}

export function uniqueFilename(preferredName: string, used: ReadonlySet<string>): string {
  if (!used.has(preferredName.toLowerCase())) return preferredName
  const dot = preferredName.lastIndexOf('.')
  const stem = dot > 0 ? preferredName.slice(0, dot) : preferredName
  const extension = dot > 0 ? preferredName.slice(dot) : ''
  let suffix = 2
  while (used.has(`${stem} (${suffix})${extension}`.toLowerCase())) suffix += 1
  return `${stem} (${suffix})${extension}`
}
