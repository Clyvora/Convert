import { useEffect, useRef, useState } from 'react'
import { useSectionNavigation } from '../core/navigation'
import { remoteMedia } from '../core/mediaClient'
import { archiveBasename } from '../core/remoteContracts'
import type { Discovery, Item, Page, SelectionSummary, ToolKind } from '../core/remoteContracts'
import type { RemoteController } from '../core/useRemoteMedia'
import { toolCards, toolURL } from '../core/tools'
import { readToolDraft, saveToolDraft } from '../core/toolWorkspace'
import { Icon } from './Icon'
import ErrorDetails from './ErrorDetails'
import Mascot from './Mascot'
import './Tools.css'

const sections=['overview',...toolCards.map(tool=>tool.id)]
export default function Tools({controller:r,active=true}:{controller:RemoteController;active?:boolean}) {
  const section=useSectionNavigation('/tools',sections,'overview')
  const tool=toolCards.find(tool=>tool.id===section)
  const [opened,setOpened]=useState<ToolKind[]>(()=>tool?[tool.id]:[])
  const heading=useRef<HTMLHeadingElement>(null)
  useEffect(()=>{if(active){heading.current?.focus({preventScroll:true});window.scrollTo({top:0,left:0,behavior:'instant'})}},[section,active])
  useEffect(()=>{if(tool)setOpened(current=>current.includes(tool.id)?current:[...current,tool.id])},[tool])
  return <section className="tools-page" aria-label="Media tools">
    {!tool?<><header className="tools-intro"><p className="eyebrow">A little more mewvi</p><h2 ref={heading} tabIndex={-1}>Tools</h2><p>More than one link? Find the posts you want, then choose what to keep.</p></header>
      <div className="tools-grid">{toolCards.map(tool=><a className="tool-card" key={tool.id} href={`/tools/${tool.id}`}><span className="tool-card-icon"><Icon name={tool.icon}/></span><h3>{tool.name}</h3><p>{tool.description}{tool.id==='instagram-profile'&&<span className="tool-availability">Experimental · Limited availability</span>}</p><span className="tool-card-open">Open tool <Icon name="arrow"/></span></a>)}</div>
      <p className="field-note tools-limit">Public posts only. Availability depends on the source. You always review the items before downloading.</p>
    </>:<><a href="/tools" className="tools-back">← All tools</a><header className="tools-intro"><h2 ref={heading} tabIndex={-1}>{tool.name}</h2><p>{tool.description}</p></header></>}
    {toolCards.filter(card=>opened.includes(card.id)||tool?.id===card.id).map(card=><div key={card.id} hidden={!active||tool?.id!==card.id}><ToolWorkspace tool={card.id} controller={r}/></div>)}
  </section>
}

function ToolWorkspace({tool,controller:r}:{tool:ToolKind;controller:RemoteController}) {
  const card=toolCards.find(card=>card.id===tool)!
  const [url,setURL]=useState(''),[kind,setKind]=useState<'all'|'image'|'video'>(tool==='youtube-shorts'?'video':'all')
  const [after,setAfter]=useState(''),[before,setBefore]=useState('')
  const [discovery,setDiscovery]=useState<Discovery|null>(null),[page,setPage]=useState<Page<Item>>({items:[],next:null})
  const [selected,setSelected]=useState<Set<string>>(new Set()),[query,setQuery]=useState('')
  const [search,setSearch]=useState(''),[archiveName,setArchiveName]=useState('')
  const [summary,setSummary]=useState<SelectionSummary|null>(null),[summaryError,setSummaryError]=useState(''),[summaryVersion,setSummaryVersion]=useState(0)
  const [all,setAll]=useState(tool!=='instagram-post'),[excluded,setExcluded]=useState<Set<string>>(new Set())
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[errorCode,setErrorCode]=useState('UNKNOWN_ERROR')
  const [resultsError,setResultsError]=useState('')
  const [recovery,setRecovery]=useState(''),[recovered,setRecovered]=useState(false),[recoveryVersion,setRecoveryVersion]=useState(0)
  const [cursor,setCursor]=useState(''),[reloadVersion,setReloadVersion]=useState(0),[loadingPage,setLoadingPage]=useState(false)
  const request=useRef<AbortController|null>(null),generation=useRef(0),discoveryRef=useRef(discovery),lock=useRef(false)
  const edited=useRef(false)
  const resultsHeading=useRef<HTMLHeadingElement>(null),focusResults=useRef(false)
  discoveryRef.current=discovery
  const discoveryId=discovery?.id,discoveryState=discovery?.state
  const unavailable=discovery?.error?.code==='SCAN_UNAVAILABLE'
  useEffect(()=>()=>{generation.current++;request.current?.abort()},[])
  useEffect(()=>{
    let stopped=false
    const revision=generation.current,draft=readToolDraft(tool)
    void (draft?remoteMedia.discovery(draft.id):remoteMedia.discoveries(tool).then(result=>result.items.find(item=>item.tool===tool))).then(result=>{
      if(stopped||edited.current||generation.current!==revision||!result)return
      setDiscovery(result);setURL(result.url||draft?.url||'')
      const date=(value?:string)=>value&&/^\d{8}$/.test(value)?`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`:''
      setKind(draft?.kind||result.mediaType||(tool==='youtube-shorts'?'video':'all'));setAfter(draft?.after||date(result.after));setBefore(draft?.before||date(result.before))
      if(draft){setSelected(new Set(draft.selected));setExcluded(new Set(draft.excluded));setAll(draft.all);setCursor(draft.cursor);setQuery(draft.query);setSearch(draft.query.trim());setArchiveName(draft.archiveName||'')}
      setRecovery('Previous scan restored. Your found items are available below.')
    }).catch(failure=>{
      if(stopped||edited.current||generation.current!==revision)return
      const code=failure&&typeof failure==='object'&&'code'in failure?String(failure.code):''
      setRecovery(['EXPIRED','NOT_FOUND','SESSION_REQUIRED'].includes(code)?'The previous scan has expired or belongs to an old session. Start a new scan.':'Could not check for a previous scan. You can try recovery again or start a new scan.')
      if(draft)setURL(draft.url)
    }).finally(()=>{if(!stopped)setRecovered(true)})
    return()=>{stopped=true}
  },[tool,recoveryVersion])
  useEffect(()=>{
    if(recovered&&discovery&&!unavailable)saveToolDraft(tool,{id:discovery.id,url,kind,after,before,all,selected:[...selected],excluded:[...excluded],cursor,query,archiveName})
  },[recovered,discovery,unavailable,tool,url,kind,after,before,all,selected,excluded,cursor,query,archiveName])
  useEffect(()=>{
    if(query.trim()===search)return
    const timer=setTimeout(()=>{setSearch(query.trim());setCursor('');setPage({items:[],next:null})},250)
    return()=>clearTimeout(timer)
  },[query,search])
  useEffect(()=>{
    if(!discoveryId||unavailable)return
    let stopped=false,timer:ReturnType<typeof setTimeout>
    setLoadingPage(true)
    const refresh=async()=>{
      let lost=false
      const checkLost=(failure:unknown)=>{
        const code=failure&&typeof failure==='object'&&'code'in failure?failure.code:''
        if(!stopped&&['EXPIRED','NOT_FOUND','SESSION_REQUIRED'].includes(String(code))){
          lost=true
          setDiscovery(current=>current?.id===discoveryId?{...current,state:'interrupted',outcome:'incomplete',error:{code:'SCAN_UNAVAILABLE',message:'This scan is no longer available from the download service. Start a new scan to retrieve the items again.',retryable:false}}:current)
          setResultsError('');setLoadingPage(false)
        }
        throw failure
      }
      const [next,items]=await Promise.allSettled([
        discoveryState==='discovering'?remoteMedia.discovery(discoveryId).then(value=>{
          if(!stopped&&discoveryRef.current?.id===discoveryId)setDiscovery(value)
          return value
        }).catch(checkLost):Promise.resolve(null),
        remoteMedia.discoveryItems(discoveryId,cursor,search).catch(checkLost),
      ])
      if(stopped||lost||discoveryRef.current?.id!==discoveryId)return
      if(items.status==='fulfilled'){
        setPage(items.value)
        setResultsError(next.status==='fulfilled'?'':'Could not refresh the scan status. Retrying automatically; your selection is kept.')
      }else setResultsError('Could not load the found items. Your selection is kept. Try loading the results again.')
      setLoadingPage(false)
      if((next.status==='fulfilled'&&next.value?next.value.state:discoveryState)==='discovering')timer=setTimeout(()=>void refresh(),2000)
    }
    void refresh()
    return()=>{stopped=true;clearTimeout(timer)}
  },[discoveryId,discoveryState,cursor,search,reloadVersion,unavailable])
  const found=discovery?.count
  useEffect(()=>{
    setSummary(null);setSummaryError('')
    if(!discoveryId||unavailable)return
    let stopped=false
    const timer=setTimeout(()=>{
      void remoteMedia.selectionSummary(discoveryId,{all,itemIds:all?[]:[...selected],excludedIds:all?[...excluded]:[]}).then(result=>{if(!stopped)setSummary(result)}).catch(()=>{if(!stopped)setSummaryError('Could not count photos and videos. Your selection is kept.')})
    },250)
    return()=>{stopped=true;clearTimeout(timer)}
  },[discoveryId,discoveryState,found,all,selected,excluded,unavailable,summaryVersion])
  useEffect(()=>{
    if(focusResults.current&&!loadingPage&&page.items.length){focusResults.current=false;resultsHeading.current?.focus({preventScroll:true});resultsHeading.current?.scrollIntoView({block:'start',behavior:'instant'})}
  },[page,loadingPage])
  const perform=async(work:()=>Promise<void>)=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');setErrorCode('UNKNOWN_ERROR')
    const revision=generation.current
    try{await work()}catch(failure){if(generation.current===revision){setError(failure instanceof Error?failure.message:'This tool could not finish.');setErrorCode(failure&&typeof failure==='object'&&'code'in failure?String(failure.code):'TOOL_REQUEST_FAILED')}}
    finally{lock.current=false;if(generation.current===revision)setBusy(false)}
  }
  const find=()=>perform(async()=>{
    edited.current=true;setRecovery('')
    const normalized=toolURL(tool,url)
    if(after&&before&&after>before)throw new Error('The start date must be before the end date.')
    const controller=new AbortController();request.current=controller
    const result=await remoteMedia.discoverTool({tool,url:normalized,scope:'all',mediaType:kind,after:after.replaceAll('-','')||undefined,before:before.replaceAll('-','')||undefined},controller.signal)
    if(controller.signal.aborted)return
    setCursor('');setURL(normalized);setDiscovery(result);setSelected(new Set());setAll(tool!=='instagram-post');setExcluded(new Set());setQuery('');setSearch('');setPage({items:[],next:null});setResultsError('');setRecovered(true)
  })
  const changePage=(next='')=>{
    focusResults.current=true
    setError('');setErrorCode('UNKNOWN_ERROR');setResultsError('');setCursor(next);setReloadVersion(value=>value+1)
  }
  const stop=()=>perform(async()=>{
    if(!discovery)return
    const revision=generation.current,id=discovery.id
    const stopped=await remoteMedia.cancel(id,true) as Discovery
    if(generation.current!==revision)return
    setDiscovery(stopped)
  })
  const reload=()=>changePage(cursor)
  const searching=query.trim()!==search
  const visible=searching?[]:page.items
  const selectVisible=(checked:boolean)=>{
    if(all)setExcluded(current=>{const next=new Set(current);for(const item of visible){if(checked)next.delete(item.id);else next.add(item.id)}return next})
    else setSelected(current=>{const next=new Set(current);for(const item of visible){if(checked)next.add(item.id);else next.delete(item.id)}return next})
  }
  const selectedCount=all?Math.max(0,(discovery?.count||0)-excluded.size):selected.size
  const running=discovery?.state==='discovering'
  const incomplete=Boolean(discovery&&!running&&(discovery.state!=='ready'||discovery.outcome!=='completed'))
  const zip=tool!=='instagram-post'||selectedCount>1
  let customName='',nameError=''
  if(zip&&archiveName.trim()){try{customName=archiveBasename(archiveName)}catch(error){nameError=(error as Error).message}}
  const filenamePreview=customName?`${customName}${incomplete?'-partial':''}.zip`:''
  const download=()=>{
    if(!discovery||nameError)return
    const options={...(all?{all:true,excludedIds:[...excluded]}:{}),...(customName&&zip?{archiveName:customName}:{})}
    void (Object.keys(options).length?r.addToolCollection(discovery.id,all?[]:[...selected],options):r.addToolCollection(discovery.id,[...selected]))
  }
  const downloadLabel=tool==='instagram-post'?'Download selected':incomplete?'Download partial ZIP':all&&excluded.size===0?tool==='youtube-shorts'?'Download all Shorts ZIP':'Download profile ZIP':'Download selection ZIP'
  const sourceError=error||(discovery?.state==='cancelled'&&discovery.error?.code==='CANCELLED'?'':discovery?.error?.message)
  return <div className="tool-workspace">
    {tool==='instagram-profile'&&<p className="tool-availability" role="note">Experimental: Instagram may stop public profile scans early. A complete profile download is not guaranteed.</p>}
    {recovery&&<p className="field-note" role="status">{recovery}{!discovery&&recovery.includes('try recovery again')&&<button className="text-button" type="button" onClick={()=>{edited.current=false;setRecoveryVersion(value=>value+1)}}>Recover previous scan</button>}</p>}
    <form className="tool-form" onSubmit={event=>{event.preventDefault();void find()}}>
      <label className="tool-link">{tool==='instagram-post'?'Post link':tool==='youtube-shorts'?'Channel link or @handle':'Profile link or @handle'}<input type="text" inputMode="url" autoComplete="off" spellCheck={false} placeholder={card.placeholder} value={url} onChange={event=>{edited.current=true;setURL(event.target.value)}} disabled={busy||running} required/></label>
      <div className="tool-filters">
        {tool!=='youtube-shorts'&&<label>Include<select value={kind} onChange={event=>{edited.current=true;setKind(event.target.value as typeof kind)}} disabled={busy||running}><option value="all">Photos & videos</option><option value="image">Photos only</option><option value="video">Videos only</option></select></label>}
      </div>
      {tool!=='instagram-post'&&<details className="tool-dates"><summary>Publication dates (optional)</summary><div className="tool-filters"><label>From<input type="date" value={after} onChange={event=>{edited.current=true;setAfter(event.target.value)}} disabled={busy||running}/></label><label>Through<input type="date" value={before} onChange={event=>{edited.current=true;setBefore(event.target.value)}} disabled={busy||running}/></label></div><p className="field-note">Leave both dates empty for the whole profile. Posts without a date stay included.</p></details>}
      <button className="primary-button" type="submit" disabled={busy||running}>{busy?'Working…':running?'Scanning…':tool==='instagram-post'?'Find items':tool==='youtube-shorts'?'Scan all Shorts':'Scan entire profile'}<Icon name="arrow"/></button>
    </form>
    <p className="field-note tool-source-note">{tool==='instagram-profile'?'Scans every accessible public profile page and puts all found media into one ZIP. Instagram may block further pages; an interrupted scan is clearly marked incomplete.':tool==='instagram-post'?'Public Instagram photos, videos and mixed carousels. Private and sign-in-required posts cannot be retrieved.':'Scans the entire public Shorts tab and saves all found clips in one ZIP. Other channel tabs are excluded.'}</p>
    {sourceError&&<div className="tool-error"><p role="alert">{sourceError}</p><ErrorDetails area="download" code={error?errorCode:discovery?.error?.code}/>{tool==='instagram-profile'&&<a href="/tools/instagram-post">Use individual post links</a>}</div>}
    {discovery&&<section className="tool-results" aria-label="Found items">
      <header className="tool-results-heading"><Mascot className="tool-companion" pose={unavailable||incomplete?'attention':running?'checking':'complete'}/><div><h3 ref={resultsHeading} tabIndex={-1}>{discovery.count} {discovery.count===1?'item':'items'} found</h3><p className="field-note" role="status">{running?`Scanning all public posts${discovery.scanned?` · ${discovery.scanned} checked`:''}…`:unavailable?'These results are no longer available to download.':incomplete?'This is an incomplete scan. You can save the items found as a partial ZIP.':tool==='instagram-post'?'Scan finished.':'Reached the end of the accessible profile.'}</p></div>{running&&<button className="text-button" type="button" disabled={busy} onClick={()=>void stop()}>Stop scan</button>}</header>
      {resultsError&&<div className="tool-error"><p role="alert">{resultsError}</p><button className="text-button" type="button" disabled={busy||loadingPage} onClick={reload}>Reload results</button></div>}
      {loadingPage&&!page.items.length&&<p className="field-note" role="status">Loading items…</p>}
      {discovery.count>0&&<><label className="tool-search">Search all found items<input type="search" maxLength={300} value={query} onChange={event=>{setQuery(event.target.value);setCursor('');focusResults.current=false}} placeholder="Find an item by title"/></label>
        {(searching||loadingPage)&&<p className="field-note" role="status">Searching found items…</p>}
        {search&&!searching&&!loadingPage&&page.total!==undefined&&<p className="field-note" role="status">{page.total} {page.total===1?'match':'matches'} across the whole scan</p>}
        <div className="tool-selection"><p role="status">{selectedCount} selected across pages</p><div><button className="text-button" type="button" onClick={()=>{setAll(true);setExcluded(new Set())}}>Select all found</button><button className="text-button" type="button" disabled={!visible.length} onClick={()=>selectVisible(true)}>Select this page</button><button className="text-button" type="button" disabled={!selectedCount} onClick={()=>{setAll(false);setSelected(new Set());setExcluded(new Set())}}>Clear selection</button></div></div>
        <div className="tool-items">{visible.map(item=>{const checked=all?!excluded.has(item.id):selected.has(item.id);return <label className={`tool-item ${checked?'is-selected':''}`} key={item.id}><input type="checkbox" aria-label={`Select ${item.title}`} checked={checked} onChange={event=>{const checked=event.target.checked;if(all)setExcluded(current=>{const next=new Set(current);if(checked)next.delete(item.id);else next.add(item.id);return next});else setSelected(current=>{const next=new Set(current);if(checked)next.add(item.id);else next.delete(item.id);return next})}}/><span className="tool-item-art"><ToolThumbnail key={item.thumbnail || item.id} item={item} discoveryId={discovery.id}/><span>{item.mediaType==='image'?'Photo':'Video'}</span></span><span className="tool-item-title">{item.title}</span>{item.published&&/^\d{8}$/.test(item.published)&&<small>{`${item.published.slice(0,4)}-${item.published.slice(4,6)}-${item.published.slice(6,8)}`}</small>}</label>})}</div>
        {!visible.length&&!loadingPage&&!searching&&!resultsError&&<p className="field-note">No items match this search. Your selections are kept.</p>}
        <div className="tool-pagination"><button type="button" className="text-button" disabled={busy||loadingPage||!cursor} onClick={()=>changePage()}>First page</button>{page.next&&<button type="button" className="text-button" disabled={busy||loadingPage} onClick={()=>changePage(page.next!)}>Next page <Icon name="arrow"/></button>}</div></>}
      {!running&&discovery.count===0&&!sourceError&&<p>No accessible items matched. Try another public link or a different media filter.</p>}
      {selectedCount>0&&!unavailable&&<div className="tool-download"><div className="tool-zip-summary"><strong>{selectedCount} {selectedCount===1?'item':'items'} selected</strong>
        <p className="field-note" role="status">{summary?`${summary.photos} ${summary.photos===1?'photo':'photos'} · ${summary.videos} ${summary.videos===1?'video':'videos'}${summary.other?` · ${summary.other} awaiting media type`:''}`:summaryError||'Counting selected photos and videos…'}</p>
        {summaryError&&<button className="text-button" type="button" onClick={()=>setSummaryVersion(value=>value+1)}>Retry counts</button>}
        <p className="field-note">{running?'Scan still running. More items may be found.':incomplete?'Incomplete scan — this ZIP will contain only the items found.':all&&excluded.size===0?'Complete scan · All found items selected.':'Complete scan · Selected items only.'}</p>
        <p className="field-note">{tool==='instagram-post'?'Photos keep their source format. Multiple items download together as a ZIP.':'All selected items, including other result pages, go into one ZIP.'}</p>
        {zip&&<div className="tool-archive-name"><label htmlFor={`zip-name-${tool}`}>ZIP name (optional)</label><input id={`zip-name-${tool}`} type="text" maxLength={120} value={archiveName} autoComplete="off" spellCheck={false} placeholder="Automatic name" aria-invalid={Boolean(nameError)} aria-describedby={`zip-name-note-${tool}`} onChange={event=>setArchiveName(event.target.value)}/><small id={`zip-name-note-${tool}`}>{nameError||filenamePreview||'Leave empty to use an automatic name.'}{!nameError&&!incomplete&&' Unfinished downloads add “-partial”.'}</small></div>}
      </div><button className="primary-button" type="button" disabled={running||busy||loadingPage||r.busy||Boolean(nameError)} onClick={download}>{downloadLabel}<Icon name="download"/></button></div>}
    </section>}
    {r.error&&<div className="tool-error"><p role="alert">{r.error}</p><ErrorDetails area="download" code={r.errorCode}/></div>}
  </div>
}

function ToolThumbnail({item,discoveryId}:{item:Item;discoveryId:string}) {
  const [failed,setFailed]=useState(false),[expired,setExpired]=useState(false)
  const stored=item.thumbnail&&/^\/v1\/convert\/artifacts\/[\w-]{36}\/preview$/.test(item.thumbnail)&&!expired?item.thumbnail:null
  const refresh=/^[\w-]{36}$/.test(discoveryId)&&/^\d+$/.test(item.id)?`/v1/convert/discoveries/${discoveryId}/items/${item.id}/preview`:null
  const source=stored||refresh
  return source&&!failed
    ? <img src={remoteMedia.preview(source)} alt="" loading="lazy" onError={()=>stored&&refresh?setExpired(true):setFailed(true)}/>
    : <Icon name={item.mediaType==='image'?'metadata':'video'}/>
}
