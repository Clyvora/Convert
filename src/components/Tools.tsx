import { useEffect, useRef, useState } from 'react'
import { useSectionNavigation } from '../core/navigation'
import { remoteMedia } from '../core/mediaClient'
import type { Discovery, Item, Page, ToolKind } from '../core/remoteContracts'
import type { RemoteController } from '../core/useRemoteMedia'
import { toolCards, toolURL } from '../core/tools'
import { Icon } from './Icon'
import ErrorDetails from './ErrorDetails'
import './Tools.css'

const sections=['overview',...toolCards.map(tool=>tool.id)]
export default function Tools({controller:r}:{controller:RemoteController}) {
  const section=useSectionNavigation('/tools',sections,'overview')
  const tool=toolCards.find(tool=>tool.id===section)
  const heading=useRef<HTMLHeadingElement>(null)
  useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,left:0,behavior:'instant'})},[section])
  return <section className="tools-page" aria-label="Media tools">
    {!tool?<><header className="tools-intro"><p className="eyebrow">A little more mewvi</p><h2 ref={heading} tabIndex={-1}>Tools</h2><p>More than one link? Find the posts you want, then choose what to keep.</p></header>
      <div className="tools-grid">{toolCards.map(tool=><a className="tool-card" key={tool.id} href={`/tools/${tool.id}`}><span className="tool-card-icon"><Icon name={tool.icon}/></span><h3>{tool.name}</h3><p>{tool.description}{tool.id==='instagram-profile'&&<span className="tool-availability">Limited availability</span>}</p><span className="tool-card-open">Open tool <Icon name="arrow"/></span></a>)}</div>
      <p className="field-note tools-limit">Public posts only. Availability depends on the source. You always review the items before downloading.</p>
    </>:<><a href="/tools" className="tools-back">← All tools</a><header className="tools-intro"><h2 ref={heading} tabIndex={-1}>{tool.name}</h2><p>{tool.description}</p></header><ToolWorkspace key={tool.id} tool={tool.id} controller={r}/></>}
  </section>
}

function ToolWorkspace({tool,controller:r}:{tool:ToolKind;controller:RemoteController}) {
  const card=toolCards.find(card=>card.id===tool)!
  const [url,setURL]=useState(''),[kind,setKind]=useState<'all'|'image'|'video'>(tool==='youtube-shorts'?'video':'all')
  const [after,setAfter]=useState(''),[before,setBefore]=useState('')
  const [discovery,setDiscovery]=useState<Discovery|null>(null),[page,setPage]=useState<Page<Item>>({items:[],next:null})
  const [selected,setSelected]=useState<Map<string,Item>>(new Map()),[query,setQuery]=useState('')
  const [all,setAll]=useState(tool!=='instagram-post'),[excluded,setExcluded]=useState<Set<string>>(new Set())
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[errorCode,setErrorCode]=useState('UNKNOWN_ERROR')
  const request=useRef<AbortController|null>(null),generation=useRef(0),discoveryRef=useRef(discovery),cursor=useRef(''),lock=useRef(false)
  discoveryRef.current=discovery
  const discoveryId=discovery?.id,discoveryState=discovery?.state
  useEffect(()=>()=>{generation.current++;request.current?.abort()},[])
  useEffect(()=>{
    if(!discoveryId||discoveryState!=='discovering')return
    let stopped=false,timer:ReturnType<typeof setTimeout>
    const refresh=async()=>{
      try {
        const id=discoveryId,requestedCursor=cursor.current
        const [next,items]=await Promise.all([remoteMedia.discovery(id),remoteMedia.discoveryItems(id,requestedCursor)])
        if(stopped||discoveryRef.current?.id!==id)return
        setDiscovery(next);if(cursor.current===requestedCursor)setPage(items)
      }catch{ /* A transient refresh can retry without losing selections. */ }
      if(!stopped)timer=setTimeout(()=>void refresh(),2000)
    }
    timer=setTimeout(()=>void refresh(),1000)
    return()=>{stopped=true;clearTimeout(timer)}
  },[discoveryId,discoveryState])
  const perform=async(work:()=>Promise<void>)=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');setErrorCode('UNKNOWN_ERROR')
    const revision=generation.current
    try{await work()}catch(failure){if(generation.current===revision){setError(failure instanceof Error?failure.message:'This tool could not finish.');setErrorCode(failure&&typeof failure==='object'&&'code'in failure?String(failure.code):'TOOL_REQUEST_FAILED')}}
    finally{lock.current=false;if(generation.current===revision)setBusy(false)}
  }
  const find=()=>perform(async()=>{
    const normalized=toolURL(tool,url)
    if(after&&before&&after>before)throw new Error('The start date must be before the end date.')
    const controller=new AbortController();request.current=controller
    const result=await remoteMedia.discoverTool({tool,url:normalized,scope:'all',mediaType:kind,after:after.replaceAll('-','')||undefined,before:before.replaceAll('-','')||undefined},controller.signal)
    if(controller.signal.aborted)return
    cursor.current='';setURL(normalized);setDiscovery(result);setSelected(new Map());setAll(tool!=='instagram-post');setExcluded(new Set());setQuery('');setPage({items:[],next:null})
    const items=await remoteMedia.discoveryItems(result.id)
    if(!controller.signal.aborted)setPage(items)
  })
  const changePage=(next='')=>perform(async()=>{
    if(!discovery)return
    const revision=generation.current,items=await remoteMedia.discoveryItems(discovery.id,next)
    if(generation.current===revision){cursor.current=next;setPage(items)}
  })
  const stop=()=>perform(async()=>{if(discovery)setDiscovery(await remoteMedia.cancel(discovery.id,true) as Discovery)})
  const visible=page.items.filter(item=>item.title.toLowerCase().includes(query.trim().toLowerCase()))
  const selectVisible=(checked:boolean)=>{
    if(all)setExcluded(current=>{const next=new Set(current);for(const item of visible){if(checked)next.delete(item.id);else next.add(item.id)}return next})
    else setSelected(current=>{const next=new Map(current);for(const item of visible){if(checked)next.set(item.id,item);else next.delete(item.id)}return next})
  }
  const selectedCount=all?Math.max(0,(discovery?.count||0)-excluded.size):selected.size
  const running=discovery?.state==='discovering'
  const incomplete=Boolean(discovery&&!running&&(discovery.state!=='ready'||discovery.outcome!=='completed'))
  const downloadLabel=tool==='instagram-post'?'Download selected':incomplete?'Download partial ZIP':all&&excluded.size===0?tool==='youtube-shorts'?'Download all Shorts ZIP':'Download profile ZIP':'Download selection ZIP'
  const sourceError=error||discovery?.error?.message
  return <div className="tool-workspace">
    <form className="tool-form" onSubmit={event=>{event.preventDefault();void find()}}>
      <label className="tool-link">{tool==='instagram-post'?'Post link':tool==='youtube-shorts'?'Channel link or @handle':'Profile link or @handle'}<input type="text" inputMode="url" autoComplete="off" spellCheck={false} placeholder={card.placeholder} value={url} onChange={event=>setURL(event.target.value)} disabled={busy||running} required/></label>
      <div className="tool-filters">
        {tool!=='youtube-shorts'&&<label>Include<select value={kind} onChange={event=>setKind(event.target.value as typeof kind)} disabled={busy||running}><option value="all">Photos & videos</option><option value="image">Photos only</option><option value="video">Videos only</option></select></label>}
      </div>
      {tool!=='instagram-post'&&<details className="tool-dates"><summary>Publication dates (optional)</summary><div className="tool-filters"><label>From<input type="date" value={after} onChange={event=>setAfter(event.target.value)} disabled={busy||running}/></label><label>Through<input type="date" value={before} onChange={event=>setBefore(event.target.value)} disabled={busy||running}/></label></div><p className="field-note">Leave both dates empty for the whole profile. Posts without a date stay included.</p></details>}
      <button className="primary-button" type="submit" disabled={busy||running}>{busy?'Working…':running?'Scanning…':tool==='instagram-post'?'Find items':tool==='youtube-shorts'?'Scan all Shorts':'Scan entire profile'}<Icon name="arrow"/></button>
    </form>
    <p className="field-note tool-source-note">{tool==='instagram-profile'?'Scans every accessible public profile page and puts all found media into one ZIP. Instagram may block further pages; an interrupted scan is clearly marked incomplete.':tool==='instagram-post'?'Public Instagram photos, videos and mixed carousels. Private and sign-in-required posts cannot be retrieved.':'Scans the entire public Shorts tab and saves all found clips in one ZIP. Other channel tabs are excluded.'}</p>
    {sourceError&&<div className="tool-error"><p role="alert">{sourceError}</p><ErrorDetails area="download" code={error?errorCode:discovery?.error?.code}/>{tool==='instagram-profile'&&<a href="/tools/instagram-post">Use individual post links</a>}</div>}
    {discovery&&<section className="tool-results" aria-label="Found items">
      <header className="tool-results-heading"><div><h3>{discovery.count} {discovery.count===1?'item':'items'} found</h3><p className="field-note" role="status">{running?`Scanning all public posts${discovery.scanned?` · ${discovery.scanned} checked`:''}…`:incomplete?'This is an incomplete scan. You can save the items found as a partial ZIP.':tool==='instagram-post'?'Scan finished.':'Reached the end of the accessible profile.'}</p></div>{running&&<button className="text-button" type="button" disabled={busy} onClick={()=>void stop()}>Stop scan</button>}</header>
      {page.items.length>0&&<><label className="tool-search">Filter this page<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find an item by title"/></label>
        <div className="tool-selection"><p role="status">{selectedCount} selected across pages</p><div><button className="text-button" type="button" onClick={()=>{setAll(true);setExcluded(new Set())}}>Select all found</button><button className="text-button" type="button" disabled={!visible.length} onClick={()=>selectVisible(true)}>Select this page</button><button className="text-button" type="button" disabled={!selectedCount} onClick={()=>{setAll(false);setSelected(new Map());setExcluded(new Set())}}>Clear selection</button></div></div>
        <div className="tool-items">{visible.map(item=>{const checked=all?!excluded.has(item.id):selected.has(item.id);return <label className={`tool-item ${checked?'is-selected':''}`} key={item.id}><input type="checkbox" aria-label={`Select ${item.title}`} checked={checked} onChange={event=>{const checked=event.target.checked;if(all)setExcluded(current=>{const next=new Set(current);if(checked)next.delete(item.id);else next.add(item.id);return next});else setSelected(current=>{const next=new Map(current);if(checked)next.set(item.id,item);else next.delete(item.id);return next})}}/><span className="tool-item-art">{item.thumbnail&&/^\/v1\/convert\/artifacts\/[\w-]{36}\/preview$/.test(item.thumbnail)?<img src={remoteMedia.preview(item.thumbnail)} alt="" loading="lazy"/>:<Icon name={item.mediaType==='image'?'metadata':'video'}/>}<span>{item.mediaType==='image'?'Photo':'Video'}</span></span><span className="tool-item-title">{item.title}</span>{item.published&&/^\d{8}$/.test(item.published)&&<small>{`${item.published.slice(0,4)}-${item.published.slice(4,6)}-${item.published.slice(6,8)}`}</small>}</label>})}</div>
        {!visible.length&&<p className="field-note">No matching items on this page.</p>}
        <div className="tool-pagination"><button type="button" className="text-button" disabled={busy||!cursor.current} onClick={()=>void changePage()}>First page</button>{page.next&&<button type="button" className="text-button" disabled={busy} onClick={()=>void changePage(page.next!)}>Next page <Icon name="arrow"/></button>}</div></>}
      {!running&&discovery.count===0&&!sourceError&&<p>No accessible items matched. Try another public link or a different media filter.</p>}
      {selectedCount>0&&<div className="tool-download"><div><strong>{selectedCount} {selectedCount===1?'item':'items'} selected</strong><p className="field-note">{tool==='instagram-post'?'Photos keep their source format. Multiple items download together as a ZIP.':'All selected items, including other result pages, go into one ZIP.'}</p></div><button className="primary-button" type="button" disabled={running||busy||r.busy} onClick={()=>void(all?r.addToolCollection(discovery.id,[],{all:true,excludedIds:[...excluded]}):r.addToolCollection(discovery.id,[...selected.keys()]))}>{downloadLabel}<Icon name="download"/></button></div>}
    </section>}
    {r.error&&<div className="tool-error"><p role="alert">{r.error}</p><ErrorDetails area="download" code={r.errorCode}/></div>}
  </div>
}
