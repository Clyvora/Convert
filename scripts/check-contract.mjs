import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const source = readFileSync(new URL('../src/core/remoteContracts.ts', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const expected = JSON.parse(readFileSync(new URL('../src/core/remoteContract.version.json', import.meta.url), 'utf8'))
if (createHash('sha256').update(source).digest('hex') !== expected.sha256) throw new Error('Generated API contract was edited without regeneration from ClyvoraAPI.')
console.log(`API v${expected.apiVersion} generated contract checksum verified.`)
