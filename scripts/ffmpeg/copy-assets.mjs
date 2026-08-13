import { copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

const assets = [
  ['node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', 'public/ffmpeg/runtime/single/ffmpeg-core.js'],
  ['node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', 'public/ffmpeg/runtime/single/ffmpeg-core.wasm'],
  ['node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.js', 'public/ffmpeg/runtime/multi/ffmpeg-core.js'],
  ['node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.wasm', 'public/ffmpeg/runtime/multi/ffmpeg-core.wasm'],
  ['node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.worker.js', 'public/ffmpeg/runtime/multi/ffmpeg-core.worker.js'],
]

for (const [source, destination] of assets) {
  const destinationPath = path.join(projectRoot, destination)
  await mkdir(path.dirname(destinationPath), { recursive: true })
  await copyFile(path.join(projectRoot, source), destinationPath)
}

console.log('Prepared self-hosted FFmpeg runtime assets.')
