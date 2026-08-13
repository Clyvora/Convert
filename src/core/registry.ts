import type { AudioFormat, ImageFormat, MediaFormat, MediaKind } from './types'

export const conversionRegistry = {
  png: { kind: 'image', outputs: ['jpg', 'webp'] },
  jpg: { kind: 'image', outputs: ['png', 'webp'] },
  webp: { kind: 'image', outputs: ['png', 'jpg'] },
  mp3: { kind: 'audio', outputs: ['wav'] },
  wav: { kind: 'audio', outputs: ['mp3'] },
} as const satisfies Record<MediaFormat, { kind: MediaKind; outputs: readonly MediaFormat[] }>

export function isSupportedPair(input: MediaFormat, output: MediaFormat): boolean {
  return (conversionRegistry[input].outputs as readonly MediaFormat[]).includes(output)
}

export function getOutputFormats(input: MediaFormat): readonly MediaFormat[] {
  return conversionRegistry[input].outputs
}

export function isImageFormat(format: MediaFormat): format is ImageFormat {
  return conversionRegistry[format].kind === 'image'
}

export function isAudioFormat(format: MediaFormat): format is AudioFormat {
  return conversionRegistry[format].kind === 'audio'
}
