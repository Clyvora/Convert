import type { AudioEngineMode } from './types'

interface FfmpegAssetUrls {
  coreURL: string
  wasmURL: string
  workerURL?: string
}

export const FFMPEG_RUNTIME_VERSION = '0.12.10'

function assetUrl(relativePath: string): string {
  const basePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return new URL(`${basePath}${relativePath}`, globalThis.location.origin).href
}

export function canUseMultithreadCore(): boolean {
  return globalThis.crossOriginIsolated === true && typeof globalThis.SharedArrayBuffer !== 'undefined'
}

export function getFfmpegAssetUrls(mode: AudioEngineMode): FfmpegAssetUrls {
  const folder = mode === 'multi-thread' ? 'multi' : 'single'
  const urls: FfmpegAssetUrls = {
    coreURL: assetUrl(`ffmpeg/runtime/v${FFMPEG_RUNTIME_VERSION}/${folder}/ffmpeg-core.js`),
    wasmURL: assetUrl(`ffmpeg/runtime/v${FFMPEG_RUNTIME_VERSION}/${folder}/ffmpeg-core.wasm`),
  }

  if (mode === 'multi-thread') {
    urls.workerURL = assetUrl(`ffmpeg/runtime/v${FFMPEG_RUNTIME_VERSION}/multi/ffmpeg-core.worker.js`)
  }

  return urls
}
