import {readFileSync,existsSync} from 'node:fs'
import {expect,it} from 'vitest'
import credits from './thirdPartyCredits.json'

it('keeps installed frontend license declarations distinct from the application license',()=>{
  for(const name of Object.keys(JSON.parse(readFileSync('package.json','utf8')).dependencies)){
    const installed=JSON.parse(readFileSync(`node_modules/${name}/package.json`,'utf8'))
    expect(credits.runtime.find(item=>item.name===name)).toMatchObject({version:installed.version,license:installed.license})
  }
  expect(credits.runtime.find(item=>item.name==='@ffmpeg/ffmpeg')?.license).toBe('MIT')
  expect(credits.runtime.find(item=>item.name==='@ffmpeg/core')?.license).toBe('GPL-2.0-or-later')
  expect(readFileSync('public/licenses/mewvi-code.txt','utf8')).toBe(readFileSync('LICENSE','utf8'))
})

it('ships readable license texts and notices without private machine paths',()=>{
  for(const file of ['public/third-party-notices.txt','public/licenses/ffmpeg-wrapper-MIT.txt','public/licenses/GPL-2.0.txt','public/ibm-plex-mono-OFL.txt'])expect(existsSync(file)).toBe(true)
  const notices=readFileSync('public/third-party-notices.txt','utf8')
  for(const name of ['react','react-dom','scheduler','torph','@ffmpeg/core','@fontsource/ibm-plex-mono'])expect(notices).toContain(name)
  expect(notices).toContain('Lochie Axon')
  expect(notices).not.toMatch(/[A-Z]:\\Users\\|\.private[\\/]|MEDIA_SIGNING_KEY/)
  expect(readFileSync('public/licenses/GPL-2.0.txt','utf8')).toContain('GNU GENERAL PUBLIC LICENSE')
})
