import type { ToolKind } from './remoteContracts'

export const toolCards: Array<{id:ToolKind;name:string;description:string;placeholder:string;icon:'metadata'|'instances'|'video'}> = [
  {id:'instagram-post',name:'Carousel downloader',description:'Pick photos and videos from one Instagram post.',placeholder:'https://www.instagram.com/p/…',icon:'metadata'},
  {id:'instagram-profile',name:'Instagram profile',description:'Collect accessible public posts from a profile.',placeholder:'https://www.instagram.com/username/',icon:'instances'},
  {id:'youtube-shorts',name:'YouTube Shorts',description:'Choose Shorts from a channel in one place.',placeholder:'https://www.youtube.com/@channel/shorts',icon:'video'},
]
export function toolURL(tool:ToolKind,input:string):string {
  let value=input.trim()
  if(tool==='instagram-profile'&&/^@?[a-zA-Z0-9_.]{1,30}$/.test(value))value=`https://www.instagram.com/${value.replace(/^@/,'')}/`
  if(tool==='youtube-shorts'&&/^@[\w.-]{1,100}$/.test(value))value=`https://www.youtube.com/${value}/shorts`
  let url:URL
  try {url=new URL(value)}catch{throw new Error('Paste a complete link or a profile @handle.')}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port)throw new Error('Use a public link without credentials or a custom port.')
  const path=url.pathname.replace(/\/+$/,'')
  if(tool==='youtube-shorts') {
    if(!['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)||!/^\/(?:@[\w.-]{1,100}|channel\/UC[\w-]{22})(?:\/shorts)?$/.test(path))throw new Error('Paste a YouTube channel or its Shorts tab.')
    return `https://www.youtube.com${path.replace(/\/shorts$/,'')}/shorts`
  }
  if(!['instagram.com','www.instagram.com'].includes(url.hostname))throw new Error('Paste an Instagram link.')
  if(tool==='instagram-post'?!/^\/(p|reel)\/[\w-]{1,40}$/.test(path):!/^\/[\w.]{1,30}$/.test(path)||['/p','/reel','/reels','/stories','/explore','/accounts','/direct'].includes(path.toLowerCase()))throw new Error(tool==='instagram-post'?'Paste one Instagram post or Reel link.':'Paste a public Instagram profile link.')
  return `https://www.instagram.com${path}/`
}
