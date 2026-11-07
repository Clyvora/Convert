import { getFfmpegAssetUrls } from '../engines/audio/ffmpegAssets'
import type { BrowserPlan, BrowserStream } from './remoteContracts'

type Engine = InstanceType<(typeof import('@ffmpeg/ffmpeg'))['FFmpeg']>
let engine: Engine | null = null
let queue: Promise<void> = Promise.resolve()

async function reserve(signal: AbortSignal): Promise<() => void> {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const previous = queue
  queue = previous.then(() => gate)
  try {
    await new Promise<void>((resolve, reject) => {
      signal.throwIfAborted()
      const abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      previous.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    })
    signal.throwIfAborted()
    return release
  } catch (error) { release(); throw error }
}

/** Copy source codecs into the selected container. No source URL reaches FFmpeg. */
export async function muxBrowserMedia(inputs: { stream: BrowserStream; blob: Blob; ext: string }[], plan: BrowserPlan, signal: AbortSignal): Promise<Blob> {
  if (!plan.mode || !plan.container || !['mp4', 'm4a', 'mkv', 'webm', 'opus', 'ogg'].includes(plan.container)) throw new Error('Unsupported local output container.')
  const release = await reserve(signal)
  const paths: string[] = []
  const directory = `/browser-${crypto.randomUUID()}`
  let current: Engine | null = null
  const stop = () => { engine?.terminate(); engine = null }
  signal.addEventListener('abort', stop, { once: true })
  try {
    signal.throwIfAborted()
    if (!engine?.loaded) {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      signal.throwIfAborted()
      engine = new FFmpeg()
      await engine.load(getFfmpegAssetUrls('single-thread'), { signal })
    }
    current = engine
    await current.createDir(directory, { signal })
    const args = ['-hide_banner', '-v', 'error', '-nostdin', '-y']
    for (const [index, input] of inputs.entries()) {
      const path = `${directory}/input-${index}.${input.ext}`
      paths.push(path)
      await current.writeFile(path, new Uint8Array(await input.blob.arrayBuffer()), { signal })
      args.push('-i', path)
    }
    const video = inputs.findIndex(input => input.stream.role !== 'audio')
    const audio = inputs.findIndex(input => input.stream.role !== 'video')
    if (plan.mode !== 'audio') { if (video < 0) throw new Error('Missing video stream.'); args.push('-map', `${video}:v:0`) }
    if (plan.mode !== 'video') { if (audio < 0) throw new Error('Missing audio stream.'); args.push('-map', `${audio}:a:0`) }
    args.push('-c', 'copy', '-threads', '2')
    if (['mp4', 'm4a'].includes(plan.container)) args.push('-movflags', '+faststart')
    const output = `${directory}/output.${plan.container}`
    paths.push(output); args.push(output)
    if (await current.exec(args, 60000, { signal }) !== 0) throw new Error('Local media assembly failed.')
    const bytes = await current.readFile(output, 'binary', { signal })
    signal.throwIfAborted()
    if (typeof bytes === 'string' || !bytes.length || bytes.length > plan.maxBytes) throw new Error('Invalid local output.')
    return new Blob([new Uint8Array(bytes)], { type: plan.mime })
  } catch (error) { stop(); throw error }
  finally {
    signal.removeEventListener('abort', stop)
    if (current?.loaded && current === engine) {
      for (const path of paths) await current.deleteFile(path).catch(() => {})
      await current.deleteDir(directory).catch(() => {})
    }
    release()
  }
}
