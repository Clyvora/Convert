import type { ToolKind } from './remoteContracts'

export interface ToolDraft {
  id: string; url: string; kind: 'all'|'image'|'video'; after: string; before: string
  all: boolean; selected: string[]; excluded: string[]; cursor: string; query: string; archiveName?: string
}
const key=(tool:ToolKind)=>`mewvi-tool-workspace-v1:${tool}`
export function readToolDraft(tool:ToolKind):ToolDraft|null {
  try {
    const value=JSON.parse(sessionStorage.getItem(key(tool))||'null')
    if(!value||typeof value.id!=='string'||!value.id||typeof value.url!=='string'||value.url.length>4096||!['all','image','video'].includes(value.kind)||typeof value.all!=='boolean')return null
    for(const field of ['after','before','cursor','query'])if(typeof value[field]!=='string'||value[field].length>300)return null
    if(value.archiveName!==undefined&&(typeof value.archiveName!=='string'||value.archiveName.length>120))return null
    for(const field of ['selected','excluded'])if(!Array.isArray(value[field])||value[field].length>1000||value[field].some((id:unknown)=>typeof id!=='string'||id.length>100))return null
    return value
  }catch{return null}
}
export function saveToolDraft(tool:ToolKind,value:ToolDraft) {
  try{sessionStorage.setItem(key(tool),JSON.stringify(value))}catch{/* Recovery still works from the owned server history. */}
}
