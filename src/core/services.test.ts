import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
import {services,serviceIconPath} from './services'

it('bundles a valid local image for every service icon',()=>{
 for(const service of services){
  const path=serviceIconPath(service.icon)
  expect(path).toMatch(/^\/platforms\/[a-z0-9-]+\.(svg|webp)$/)
  const bytes=readFileSync(new URL('../../public'+path,import.meta.url))
  if(path.endsWith('.svg'))expect(bytes.toString()).toMatch(/<svg\s/)
  else{expect(bytes.subarray(0,4).toString()).toBe('RIFF');expect(bytes.subarray(8,12).toString()).toBe('WEBP')}
 }
})
