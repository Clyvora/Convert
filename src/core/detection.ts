import type { DetectedFile } from './types'

const MIME_BY_FORMAT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg; codecs=opus',
  mp4: 'video/mp4',
  webm: 'video/webm',
} as const

export class FileDetectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileDetectionError'
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const signature = Array.from(value, (character) => character.charCodeAt(0))
  return bytes.some((_, offset) => startsWith(bytes, signature, offset))
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function isSupportedMp4Brand(brand: string): boolean {
  const normalized = brand.trim().toLowerCase()
  return ['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'm4v'].includes(normalized)
}

export function detectSignature(bytes: Uint8Array): DetectedFile | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { format: 'png', kind: 'image', mimeType: MIME_BY_FORMAT.png, extension: 'png' }
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { format: 'jpg', kind: 'image', mimeType: MIME_BY_FORMAT.jpg, extension: 'jpg' }
  }
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { format: 'webp', kind: 'image', mimeType: MIME_BY_FORMAT.webp, extension: 'webp' }
  }
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)) {
    return { format: 'wav', kind: 'audio', mimeType: MIME_BY_FORMAT.wav, extension: 'wav' }
  }
  if (startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])) {
    if (containsAscii(bytes, 'OpusHead')) return { format: 'opus', kind: 'audio', mimeType: MIME_BY_FORMAT.opus, extension: 'opus' }
    if (containsAscii(bytes, '\u0001vorbis')) return { format: 'ogg', kind: 'audio', mimeType: MIME_BY_FORMAT.ogg, extension: 'ogg' }
    return null
  }
  if (bytes.length >= 12 && startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    const majorBrand = ascii(bytes, 8, 4)
    if (!isSupportedMp4Brand(majorBrand)) return null
    return { format: 'mp4', kind: 'video', mimeType: MIME_BY_FORMAT.mp4, extension: 'mp4' }
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) && containsAscii(bytes, 'webm')) {
    return { format: 'webm', kind: 'video', mimeType: MIME_BY_FORMAT.webm, extension: 'webm' }
  }
  const hasMp3Frame = bytes.length >= 4
    && bytes[0] === 0xff
    && (bytes[1] & 0xe0) === 0xe0
    && ((bytes[1] >> 3) & 0x03) !== 0x01
    && ((bytes[1] >> 1) & 0x03) !== 0
    && ((bytes[2] >> 4) & 0x0f) !== 0
    && ((bytes[2] >> 4) & 0x0f) !== 0x0f
    && ((bytes[2] >> 2) & 0x03) !== 0x03
  if (startsWith(bytes, [0x49, 0x44, 0x33]) || hasMp3Frame) {
    return { format: 'mp3', kind: 'audio', mimeType: MIME_BY_FORMAT.mp3, extension: 'mp3' }
  }
  return null
}

export async function detectFile(file: File): Promise<DetectedFile> {
  const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer())
  const detected = detectSignature(bytes)
  if (!detected) {
    throw new FileDetectionError('This file’s contents do not match a supported image, audio, or video format.')
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  const acceptedExtensions = detected.format === 'jpg' ? ['jpg', 'jpeg'] : [detected.extension]
  if (extension && !acceptedExtensions.includes(extension)) {
    throw new FileDetectionError(
      `The filename says “.${extension}”, but the file contents are ${detected.format.toUpperCase()}. Rename the file correctly and try again.`,
    )
  }
  return detected
}
