import { expect, it } from 'vitest'
import { errorReport } from './errorReport'

it('copies useful settings without private links, filenames, messages, headers or arbitrary values', () => {
  const secret = 'private-token-123'
  const result = errorReport({area:'download',code:'SOURCE_BLOCKED',state:'failed',engine:'2026.10.26',options:{mode:'audio',container:'mp3',audioBitrate:192,url:`https://private.example/${secret}`,filename:`${secret}.wav`,message:secret,language:secret,subtitle:secret,headers:{Authorization:secret},videoCodec:secret}},`Mozilla/5.0 (Windows NT 10.0) Chrome/131.0.1 ${secret}`)
  expect(result).not.toContain(secret)
  expect(JSON.parse(result)).toMatchObject({code:'SOURCE_BLOCKED',browser:'Chrome 131',platform:'Windows',engine:'2026.10.26',options:{mode:'audio',container:'mp3',audioBitrate:192}})
  expect(Object.keys(JSON.parse(result).options)).toEqual(['mode','container','audioBitrate'])
})
it('excludes malformed codes, states, engine values and invalid settings', () => {
  const result = JSON.parse(errorReport({area:'local',code:'file.wav',state:'private filename',engine:'https://private',options:{container:'private.mp3',audioBitrate:Infinity,outputFormat:'flac',audioSampleRate:'source'}}))
  expect(result).toMatchObject({code:'UNKNOWN_ERROR',options:{outputFormat:'flac',audioSampleRate:'source'}})
  expect(result.state).toBeUndefined(); expect(result.engine).toBeUndefined()
})
