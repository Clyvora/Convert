import { describe, expect, it } from 'vitest'
import { detectFile, detectSignature, FileDetectionError } from './detection'

const bytes = (...values: number[]) => new Uint8Array(values)

describe('audio and video signature detection', () => {
  it.each([
    ['WAV', bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45), 'wav'],
    ['MP3', bytes(0x49, 0x44, 0x33, 4, 0), 'mp3'],
    ['Ogg Vorbis', bytes(0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0, 1, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73), 'ogg'],
    ['Ogg Opus', bytes(0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64), 'opus'],
    ['MP4', bytes(0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d), 'mp4'],
    ['WebM', bytes(0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0x77, 0x65, 0x62, 0x6d), 'webm'],
  ])('detects %s', (_label, value, format) => expect(detectSignature(value)).toMatchObject({ format }))

  it('rejects image signatures now owned by Clyvora Resize', async () => {
    const image = new File([bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)], 'image.png', { type: 'image/png' })
    expect(detectSignature(new Uint8Array(await image.arrayBuffer()))).toBeNull()
    await expect(detectFile(image)).rejects.toBeInstanceOf(FileDetectionError)
  })

  it('rejects unsupported Ogg codecs and unrelated ISO media brands', () => {
    expect(detectSignature(bytes(0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0x7f, 0x46, 0x4c, 0x41, 0x43))).toBeNull()
    expect(detectSignature(bytes(0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66))).toBeNull()
  })

  it('rejects a renamed supported file with a clear mismatch', async () => {
    const file = new File([bytes(0x49, 0x44, 0x33, 4, 0)], 'track.wav', { type: 'audio/wav' })
    await expect(detectFile(file)).rejects.toThrow(/contents are MP3/i)
  })
})

