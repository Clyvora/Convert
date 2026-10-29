import type { AudioFormat, ImportedAudioFormat, InputMediaFormat, MediaFormat, MediaKind, VideoFormat } from './types'

export const conversionRegistry = {
  aac: { kind: 'audio', outputs: ['mp3', 'wav', 'ogg', 'opus', 'm4a', 'flac'] },
  m4a: { kind: 'audio', outputs: ['mp3', 'wav', 'ogg', 'opus', 'flac'] },
  flac: { kind: 'audio', outputs: ['mp3', 'wav', 'ogg', 'opus', 'm4a'] },
  ts: { kind: 'audio', outputs: ['mp3', 'wav', 'ogg', 'opus', 'm4a', 'flac'] },
  mp3: { kind: 'audio', outputs: ['wav', 'ogg', 'opus', 'm4a', 'flac'] },
  wav: { kind: 'audio', outputs: ['mp3', 'ogg', 'opus', 'm4a', 'flac'] },
  ogg: { kind: 'audio', outputs: ['mp3', 'wav', 'opus', 'm4a', 'flac'] },
  opus: { kind: 'audio', outputs: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] },
  mp4: { kind: 'video', outputs: ['webm', 'mp3', 'wav', 'ogg', 'opus', 'mkv', 'm4a', 'flac'] },
  webm: { kind: 'video', outputs: ['mp4', 'mp3', 'wav', 'ogg', 'opus', 'mkv', 'm4a', 'flac'] },
  mkv: { kind: 'video', outputs: ['mp4', 'webm', 'mp3', 'wav', 'ogg', 'opus', 'm4a', 'flac'] },
} as const satisfies Record<InputMediaFormat, { kind: MediaKind; outputs: readonly MediaFormat[] }>

export function isSupportedPair(input: InputMediaFormat, output: MediaFormat): boolean {
  return (conversionRegistry[input].outputs as readonly MediaFormat[]).includes(output)
}

export function getOutputFormats(input: InputMediaFormat): readonly MediaFormat[] {
  return conversionRegistry[input].outputs
}

export function isAudioFormat(format: InputMediaFormat): format is AudioFormat | ImportedAudioFormat {
  return conversionRegistry[format].kind === 'audio'
}

export function isVideoFormat(format: InputMediaFormat): format is VideoFormat {
  return conversionRegistry[format].kind === 'video'
}
