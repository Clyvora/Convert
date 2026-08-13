import type { DetectedFile } from './types'

const MIME_BY_FORMAT = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
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
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  const detected = detectSignature(bytes)
  if (!detected) {
    throw new FileDetectionError('This file’s contents do not match PNG, JPG, WebP, MP3, or WAV.')
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
