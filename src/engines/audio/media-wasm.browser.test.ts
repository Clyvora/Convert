import { afterAll, describe, expect, it } from 'vitest'

import { detectSignature } from '../../core/detection'
import { LocalMediaFfmpegEngine } from './AudioFfmpegEngine'
import type { LocalMediaConversionOptions, LocalMediaFormat } from './types'

const audioEngine = new LocalMediaFfmpegEngine()
const videoEngine = new LocalMediaFfmpegEngine()

function conversionOptions(outputFormat: LocalMediaFormat): LocalMediaConversionOptions {
  return {
    outputFormat,
    audioBitrate: 96,
    audioChannels: 'source',
    audioSampleRate: 'source',
    videoQuality: 'smaller',
    videoResolution: 480,
    videoCodec: 'auto',
  }
}

function createWavFixture(): File {
  const sampleRate = 44_100
  const sampleCount = Math.round(sampleRate / 5)
  const buffer = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(buffer)
  const writeText = (offset: number, value: string) => Array.from(value).forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)))
  writeText(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); writeText(8, 'WAVE')
  writeText(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  writeText(36, 'data'); view.setUint32(40, sampleCount * 2, true)
  for (let index = 0; index < sampleCount; index += 1) {
    view.setInt16(44 + index * 2, Math.round(Math.sin(2 * Math.PI * 440 * index / sampleRate) * 8_000), true)
  }
  return new File([buffer], 'tone.wav', { type: 'audio/wav' })
}

async function createWebmFixture(): Promise<File> {
  if (typeof MediaRecorder === 'undefined') throw new Error('This browser does not expose MediaRecorder for the WebM integration fixture.')
  const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find((candidate) => MediaRecorder.isTypeSupported(candidate))
  if (!mimeType) throw new Error('This browser cannot record a WebM integration fixture.')

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable for the WebM integration fixture.')
    context.fillStyle = '#111312'; context.fillRect(0, 0, 64, 64)
    const stream = canvas.captureStream(0)
    const videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }
    if (!videoTrack.requestFrame) throw new Error('This browser cannot request deterministic canvas video frames.')
    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    const started = new Promise<void>((resolve) => { recorder.onstart = () => resolve() })
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve()
      recorder.onerror = () => reject(new Error('The browser failed to record the WebM integration fixture.'))
    })
    recorder.start(250)
    await started
    await new Promise((resolve) => setTimeout(resolve, 50))
    for (let frame = 0; frame < 45; frame += 1) {
      context.fillStyle = frame % 2 ? '#eeeae0' : '#111312'
      context.fillRect(0, 0, 64, 64)
      context.fillStyle = frame % 2 ? '#111312' : '#eeeae0'
      context.fillRect((frame * 3) % 46, 20, 18, 18)
      videoTrack.requestFrame()
      await new Promise((resolve) => setTimeout(resolve, 34))
    }
    recorder.requestData()
    await new Promise((resolve) => setTimeout(resolve, 100))
    recorder.stop()
    await stopped
    stream.getTracks().forEach((track) => track.stop())
    const fixture = new File(chunks, 'motion.webm', { type: 'video/webm' })
    if (fixture.size > 1_000) return fixture
  }
  throw new Error('The browser repeatedly produced an empty WebM integration fixture.')
}

afterAll(() => { audioEngine.dispose(); videoEngine.dispose() })

describe.sequential('real FFmpeg WebAssembly media conversions', () => {
  it('encodes WAV to MP3, OGG, and Opus and decodes the MP3 result back to WAV', async () => {
    const source = createWavFixture()
    const mp3 = await audioEngine.convert(source, 'wav', conversionOptions('mp3'))
    const ogg = await audioEngine.convert(source, 'wav', conversionOptions('ogg'))
    const opus = await audioEngine.convert(source, 'wav', conversionOptions('opus'))
    const restored = await audioEngine.convert(new File([mp3.blob], 'tone.mp3', { type: mp3.mimeType }), 'mp3', conversionOptions('wav'))

    expect(mp3.blob.size).toBeGreaterThan(100)
    expect(ogg.blob.size).toBeGreaterThan(100)
    expect(opus.blob.size).toBeGreaterThan(100)
    expect(detectSignature(new Uint8Array(await restored.blob.slice(0, 512).arrayBuffer()))?.format).toBe('wav')
    expect(detectSignature(new Uint8Array(await ogg.blob.slice(0, 512).arrayBuffer()))?.format).toBe('ogg')
    expect(detectSignature(new Uint8Array(await opus.blob.slice(0, 512).arrayBuffer()))?.format).toBe('opus')
  })

  it('transcodes a real WebM fixture to MP4 and back to WebM', async () => {
    const source = await createWebmFixture()
    expect(source.size).toBeGreaterThan(1_000)
    expect(detectSignature(new Uint8Array(await source.slice(0, 512).arrayBuffer()))?.format).toBe('webm')
    const mp4 = await videoEngine.convert(source, 'webm', conversionOptions('mp4'))
    const webm = await videoEngine.convert(new File([mp4.blob], 'motion.mp4', { type: mp4.mimeType }), 'mp4', conversionOptions('webm'))

    expect(mp4.blob.size).toBeGreaterThan(500)
    expect(webm.blob.size).toBeGreaterThan(500)
    expect(detectSignature(new Uint8Array(await mp4.blob.slice(0, 512).arrayBuffer()))?.format).toBe('mp4')
    expect(detectSignature(new Uint8Array(await webm.blob.slice(0, 512).arrayBuffer()))?.format).toBe('webm')
  })
})
