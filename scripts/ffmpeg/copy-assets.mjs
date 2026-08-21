import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const expectedVersion = '0.12.10'
const corePackage = JSON.parse(await readFile(path.join(projectRoot, 'node_modules/@ffmpeg/core/package.json'), 'utf8'))
const coreMtPackage = JSON.parse(await readFile(path.join(projectRoot, 'node_modules/@ffmpeg/core-mt/package.json'), 'utf8'))
if (corePackage.version !== expectedVersion || coreMtPackage.version !== expectedVersion) {
  throw new Error(`FFmpeg runtime mismatch: expected ${expectedVersion}, found ${corePackage.version}/${coreMtPackage.version}. Update the runtime version in the copier and ffmpegAssets.ts together.`)
}
const runtimeRoot = `public/ffmpeg/runtime/v${expectedVersion}`

const assets = [
  ['node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', `${runtimeRoot}/single/ffmpeg-core.js`],
  ['node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', `${runtimeRoot}/single/ffmpeg-core.wasm`],
  ['node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.js', `${runtimeRoot}/multi/ffmpeg-core.js`],
  ['node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.wasm', `${runtimeRoot}/multi/ffmpeg-core.wasm`],
  ['node_modules/@ffmpeg/core-mt/dist/esm/ffmpeg-core.worker.js', `${runtimeRoot}/multi/ffmpeg-core.worker.js`],
]

for (const [source, destination] of assets) {
  const destinationPath = path.join(projectRoot, destination)
  await mkdir(path.dirname(destinationPath), { recursive: true })
  await copyFile(path.join(projectRoot, source), destinationPath)
}

console.log('Prepared self-hosted FFmpeg runtime assets.')
