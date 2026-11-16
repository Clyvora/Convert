import {readFile,writeFile,mkdir,readdir,realpath} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=fileURLToPath(new URL('../',import.meta.url))
const project=JSON.parse(await readFile(join(root,'package.json'),'utf8'))
const runtime=[],tooling=[],seen=new Set()
async function packageDirectory(name,parent=root){
  const require=createRequire(join(parent,'package.json'))
  try{return dirname(require.resolve(name+'/package.json'))}catch{
    let directory=dirname(require.resolve(name))
    while(directory!==dirname(directory)){
      try{if(JSON.parse(await readFile(join(directory,'package.json'),'utf8')).name===name)return directory}catch{}
      directory=dirname(directory)
    }
    throw new Error('Cannot locate dependency metadata: '+name)
  }
}
async function inspect(name,directory,target,recursive=false){
  directory=await realpath(directory)
  const metadata=JSON.parse(await readFile(join(directory,'package.json'),'utf8'))
  const id=name+'@'+metadata.version
  if(seen.has(id))return
  seen.add(id)
  const upstream=typeof metadata.repository==='string'?metadata.repository:metadata.repository?.url
  const url=metadata.homepage?.split('#')[0] || upstream?.replace(/^git\+/,'').replace(/\.git$/,'') || 'https://www.npmjs.com/package/'+name
  const texts=[]
  for(const file of (await readdir(directory)).filter(file=>/^(license(?:\.[\w-]+)?|copying(?:\.[\w-]+)?|notice(?:\.[\w-]+)?)$/i.test(file))){
    try{texts.push({file,text:await readFile(join(directory,file),'utf8')})}catch{}
  }
  if(['@ffmpeg/ffmpeg','@ffmpeg/types'].includes(name))texts.push({file:'Upstream MIT license',text:await readFile(join(root,'public/licenses/ffmpeg-wrapper-MIT.txt'),'utf8')})
  if(['@ffmpeg/core','@ffmpeg/core-mt'].includes(name))texts.push({file:'GPL version 2 (package declares or-later)',text:await readFile(join(root,'public/licenses/GPL-2.0.txt'),'utf8')})
  target.push({name,version:metadata.version,license:metadata.license||'See upstream notices',url,texts})
  if(recursive)for(const dependency of Object.keys(metadata.dependencies||{}))await inspect(dependency,await packageDirectory(dependency,directory),target,true)
}
for(const name of Object.keys(project.dependencies))await inspect(name,join(root,'node_modules',name),runtime,true)
for(const name of Object.keys(project.devDependencies))await inspect(name,join(root,'node_modules',name),tooling)
const strip=({texts:_texts,...metadata})=>metadata
const metadata={runtime:runtime.map(strip).sort((a,b)=>a.name.localeCompare(b.name)),tooling:tooling.map(strip).sort((a,b)=>a.name.localeCompare(b.name))}
await mkdir(join(root,'public/licenses'),{recursive:true})
await writeFile(join(root,'src/core/thirdPartyCredits.json'),JSON.stringify(metadata,null,2)+'\n')
await writeFile(join(root,'public/licenses/mewvi-code.txt'),await readFile(join(root,'LICENSE')))
const notice=await readFile(join(root,'THIRD_PARTY_NOTICES.md'),'utf8')
const complete=notice+'\n\n# Installed frontend runtime packages and license texts\n\n'+runtime.map(item=>{
  const title=item.name+' '+item.version+' — '+item.license+'\n'+item.url
  return title+'\n\n'+(item.texts.length?item.texts.map(part=>part.file+'\n'+part.text).join('\n\n'):'See upstream source and package notices.')
}).join('\n\n'+ '='.repeat(72)+'\n\n')+'\n\n# Development tools (not the media runtime)\n\n'+metadata.tooling.map(item=>item.name+' '+item.version+' — '+item.license+'\n'+item.url).join('\n\n')+'\n'
await writeFile(join(root,'public/third-party-notices.txt'),complete)
console.log('Prepared third-party notices for '+runtime.length+' runtime packages and '+tooling.length+' development tools.')
