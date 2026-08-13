import { describe, expect, it } from 'vitest'

import { detectFile, detectSignature, FileDetectionError } from './detection'

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values)
}

function fileBytes(...values: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length)
  new Uint8Array(buffer).set(values)
  return buffer
}

describe('file signature detection', () => {
  it.each([
    {
      label: 'PNG',
      value: bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      expected: { format: 'png', kind: 'image', mimeType: 'image/png', extension: 'png' },
    },
    {
      label: 'JPEG',
      value: bytes(0xff, 0xd8, 0xff, 0xe0),
      expected: { format: 'jpg', kind: 'image', mimeType: 'image/jpeg', extension: 'jpg' },
    },
    {
      label: 'WebP',
      value: bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50),
      expected: { format: 'webp', kind: 'image', mimeType: 'image/webp', extension: 'webp' },
    },
    {
      label: 'WAV',
      value: bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45),
      expected: { format: 'wav', kind: 'audio', mimeType: 'audio/wav', extension: 'wav' },
    },
    {
      label: 'ID3-tagged MP3',
      value: bytes(0x49, 0x44, 0x33, 4, 0),
      expected: { format: 'mp3', kind: 'audio', mimeType: 'audio/mpeg', extension: 'mp3' },
    },
    {
      label: 'MP3 frame sync',
      value: bytes(0xff, 0xfb, 0x90, 0x64),
      expected: { format: 'mp3', kind: 'audio', mimeType: 'audio/mpeg', extension: 'mp3' },
    },
  ])('detects $label from content', ({ value, expected }) => {
    expect(detectSignature(value)).toEqual(expected)
  })

  it('does not treat a RIFF container without a supported form type as WebP or WAV', () => {
    const avi = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20)
    expect(detectSignature(avi)).toBeNull()
  })

  it('rejects invalid MPEG frame fields instead of accepting a loose sync prefix', () => {
    expect(detectSignature(bytes(0xff, 0xe8, 0x00, 0x00))).toBeNull()
    expect(detectSignature(bytes(0xff, 0xfb, 0xf0, 0x00))).toBeNull()
  })

  it('does not infer support from a filename or MIME type alone', async () => {
    const fakePng = new File([fileBytes(1, 2, 3, 4)], 'photo.png', { type: 'image/png' })
    await expect(detectFile(fakePng)).rejects.toBeInstanceOf(FileDetectionError)
  })

  it('accepts the JPEG alias when content is actually JPEG', async () => {
    const jpeg = new File([fileBytes(0xff, 0xd8, 0xff, 0xe0)], 'photo.JPEG', { type: 'application/octet-stream' })
    await expect(detectFile(jpeg)).resolves.toMatchObject({ format: 'jpg', kind: 'image' })
  })

  it('rejects a renamed supported file with an explanatory mismatch', async () => {
    const renamed = new File(
      [fileBytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
      'photo.jpg',
      { type: 'image/jpeg' },
    )

    await expect(detectFile(renamed)).rejects.toThrow(/contents are PNG/i)
  })
})
