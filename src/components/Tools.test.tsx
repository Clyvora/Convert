import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import Tools from './Tools'
import { remoteMedia } from '../core/mediaClient'
import type { RemoteController } from '../core/useRemoteMedia'

vi.mock('../core/mediaClient',()=>({remoteMedia:{discoverTool:vi.fn(),discoveries:vi.fn(),discovery:vi.fn(),discoveryItems:vi.fn(),selectionSummary:vi.fn(),cancel:vi.fn(),preview:(value:string)=>`/api${value}`}}))
const controller={busy:false,error:'',errorCode:'',addToolCollection:vi.fn()} as unknown as RemoteController
const discovery={id:'scan',state:'ready',count:3,outcome:'completed'}
const photo={id:'1',mediaId:'image',provider:'Instagram',url:'https://www.instagram.com/p/post/',title:'First photo',mediaType:'image' as const}
const video={...photo,id:'2',mediaId:'video',title:'A video',mediaType:'video' as const}
beforeEach(()=>{
 Element.prototype.scrollIntoView=vi.fn()
 vi.clearAllMocks();sessionStorage.clear();history.replaceState(null,'','/tools/instagram-post')
 vi.mocked(remoteMedia.discoveries).mockResolvedValue({items:[],next:null})
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue(discovery)
 vi.mocked(remoteMedia.discovery).mockResolvedValue({...discovery,state:'discovering',count:1})
 vi.mocked(remoteMedia.discoveryItems).mockImplementation(async(_id,cursor)=>cursor?{items:[video],next:null}:{items:[photo],next:'next'})
 vi.mocked(remoteMedia.selectionSummary).mockImplementation(async(_id,input)=>{const ids=input.all?['1','2'].filter(id=>!input.excludedIds?.includes(id)):input.itemIds||[];return {total:ids.length,photos:ids.includes('1')?1:0,videos:ids.includes('2')?1:0,other:0,found:3,sourceComplete:true}})
})
async function scan(){
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Post link'}),{target:{value:'https://www.instagram.com/p/post/'}})
 fireEvent.click(screen.getByRole('button',{name:'Find items'}));await screen.findByRole('checkbox',{name:'Select First photo'})
}
it('finds items beyond the original page, retains selected items through empty searches and restores the ZIP name',async()=>{
 vi.mocked(remoteMedia.discoveryItems).mockImplementation(async(_id,_cursor,query)=>({items:query==='video'?[video]:query==='nothing'?[]:[photo],next:null,...(query?{total:query==='video'?1:0}:{})}))
 const view=render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Post link'}),{target:{value:photo.url}})
 fireEvent.click(screen.getByRole('button',{name:'Find items'}));fireEvent.click(await screen.findByRole('checkbox',{name:'Select First photo'}))
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'video'}})
 fireEvent.click(await screen.findByRole('checkbox',{name:'Select A video'}))
 expect(remoteMedia.discoveryItems).toHaveBeenCalledWith('scan','','video')
 expect(await screen.findByText('1 photo · 1 video')).toBeVisible()
 fireEvent.change(screen.getByRole('textbox',{name:'ZIP name (optional)'}),{target:{value:'My favourites.zip'}})
 expect(screen.getByText(/My favourites\.zip/)).toBeVisible()
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'nothing'}})
 await screen.findByText('No items match this search. Your selections are kept.')
 fireEvent.click(screen.getByRole('button',{name:'Download selected'}))
 expect(controller.addToolCollection).toHaveBeenCalledWith('scan',['1','2'],{archiveName:'My favourites'})
 view.unmount();vi.mocked(remoteMedia.discovery).mockResolvedValue(discovery)
 render(<Tools controller={controller}/>);expect(await screen.findByRole('textbox',{name:'ZIP name (optional)'})).toHaveValue('My favourites.zip')
 expect(screen.getByRole('searchbox')).toHaveValue('nothing')
 expect(screen.getByText('2 selected across pages')).toBeVisible()
})
it('does not replace a newer search with an older response',async()=>{
 let resolveOld!:(value:{items:typeof photo[];next:null;total:number})=>void
 vi.mocked(remoteMedia.discoveryItems).mockImplementation(async(_id,_cursor,query)=>query==='old'?new Promise(resolve=>{resolveOld=resolve}):{items:query==='new'?[video]:[photo],next:null,total:1})
 await scan();fireEvent.change(screen.getByRole('searchbox'),{target:{value:'old'}})
 await waitFor(()=>expect(remoteMedia.discoveryItems).toHaveBeenCalledWith('scan','','old'))
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'new'}})
 expect(await screen.findByRole('checkbox',{name:'Select A video'})).toBeVisible()
 await act(async()=>resolveOld({items:[photo],next:null,total:1}))
 expect(screen.queryByRole('checkbox',{name:'Select First photo'})).not.toBeInTheDocument()
})
it('shows incomplete scans and validates custom ZIP names before submitting',async()=>{
 history.replaceState(null,'','/tools/instagram-profile')
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,state:'interrupted',outcome:'incomplete'})
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Profile link or @handle'}),{target:{value:'@demo'}})
 fireEvent.click(screen.getByRole('button',{name:'Scan entire profile'}))
 const name=await screen.findByRole('textbox',{name:'ZIP name (optional)'})
 fireEvent.change(name,{target:{value:'../escape'}})
 expect(screen.getByRole('button',{name:'Download partial ZIP'})).toBeDisabled()
 fireEvent.change(name,{target:{value:'Holiday'}})
 expect(screen.getByText('Holiday-partial.zip')).toBeVisible()
 expect(document.querySelector('.tool-companion')).toHaveClass('mascot-pose-attention')
 fireEvent.click(screen.getByRole('button',{name:'Download partial ZIP'}))
 expect(controller.addToolCollection).toHaveBeenCalledWith('scan',[],{all:true,excludedIds:[],archiveName:'Holiday'})
})
it('keeps photo and video selections across pages and only queues explicitly chosen items',async()=>{
 await scan();fireEvent.click(screen.getByRole('checkbox',{name:'Select First photo'}))
 fireEvent.click(screen.getByRole('button',{name:'Next page'}));fireEvent.click(await screen.findByRole('checkbox',{name:'Select A video'}))
 expect(screen.getByRole('heading',{name:'3 items found'})).toHaveFocus()
 expect(screen.getByText('2 selected across pages')).toBeVisible()
 fireEvent.click(screen.getByRole('button',{name:'Download selected'}))
 expect(controller.addToolCollection).toHaveBeenCalledWith('scan',['1','2'])
})
it('searches all found items and keeps search separate from selection',async()=>{
 vi.mocked(remoteMedia.discoveryItems).mockImplementation(async(_id,_cursor,query)=>({items:query?[photo]:[photo,video],next:null,total:query?1:2}))
 await scan();fireEvent.change(screen.getByRole('searchbox'),{target:{value:'photo'}})
 await screen.findByText('1 match across the whole scan')
 fireEvent.click(screen.getByRole('button',{name:'Select this page'}));expect(screen.getByText('1 selected across pages')).toBeVisible()
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:''}})
 expect(await screen.findByRole('checkbox',{name:'Select A video'})).not.toBeChecked()
 fireEvent.click(screen.getByRole('button',{name:'Clear selection'}));expect(screen.queryByRole('button',{name:'Download selected'})).not.toBeInTheDocument()
})
it('rejects a mismatched source before contacting the service',async()=>{
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Post link'}),{target:{value:'https://evil.example/p/post/'}})
 fireEvent.click(screen.getByRole('button',{name:'Find items'}));expect(await screen.findByRole('alert')).toHaveTextContent('Instagram link')
 expect(remoteMedia.discoverTool).not.toHaveBeenCalled()
})
it('explains blocked profile browsing and offers individual post links',async()=>{
 history.replaceState(null,'','/tools/instagram-profile')
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,state:'failed',count:0,error:{code:'PUBLIC_PROFILE_UNAVAILABLE',message:'Instagram did not expose this profile to public browsing.',retryable:false}})
 vi.mocked(remoteMedia.discoveryItems).mockResolvedValue({items:[],next:null})
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Profile link or @handle'}),{target:{value:'@nasa'}})
 fireEvent.click(screen.getByRole('button',{name:'Scan entire profile'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('public browsing')
 expect(screen.getByRole('link',{name:'Use individual post links'})).toHaveAttribute('href','/tools/instagram-post')
 expect(remoteMedia.discoverTool).toHaveBeenCalledWith(expect.objectContaining({url:'https://www.instagram.com/nasa/',tool:'instagram-profile',scope:'all'}),expect.any(AbortSignal))
})
it('polls a running scan and lets it stop without losing already found items',async()=>{
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,state:'discovering',count:1})
 vi.mocked(remoteMedia.cancel).mockResolvedValue({...discovery,state:'cancelled',count:1,error:{code:'CANCELLED',message:'Work was cancelled.',retryable:false}})
 await scan();fireEvent.click(screen.getByRole('button',{name:'Stop scan'}))
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Stop scan'})).not.toBeInTheDocument())
 expect(screen.getByRole('checkbox',{name:'Select First photo'})).toBeVisible()
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('does not render results from a request that finishes after leaving the tool',async()=>{
 let finish!:(value:typeof discovery)=>void
 vi.mocked(remoteMedia.discoverTool).mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
 const view=render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Post link'}),{target:{value:'https://www.instagram.com/p/post/'}})
 fireEvent.click(screen.getByRole('button',{name:'Find items'}));view.unmount()
 await act(async()=>finish(discovery));expect(remoteMedia.discoveryItems).not.toHaveBeenCalled()
})

it('scans an entire profile and archives all found items beyond the visible page',async()=>{
 history.replaceState(null,'','/tools/instagram-profile')
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,count:1201,scope:'all'})
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Profile link or @handle'}),{target:{value:'@publicprofile'}})
 expect(screen.queryByRole('combobox',{name:'Newest posts to check'})).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Scan entire profile'}));await screen.findByText('1201 selected across pages')
 await screen.findByRole('checkbox',{name:'Select First photo'})
 const input=vi.mocked(remoteMedia.discoverTool).mock.calls[0][0]
 expect(input.scope).toBe('all');expect(input.limit).toBeUndefined()
 fireEvent.click(screen.getByRole('button',{name:'Download profile ZIP'}))
 expect(controller.addToolCollection).toHaveBeenCalledWith('scan',[],{all:true,excludedIds:[]})
 fireEvent.click(screen.getByRole('button',{name:'Next page'}));fireEvent.click(await screen.findByRole('checkbox',{name:'Select A video'}))
 expect(screen.getByText('1200 selected across pages')).toBeVisible()
 fireEvent.click(screen.getByRole('button',{name:'Download selection ZIP'}))
 expect(controller.addToolCollection).toHaveBeenLastCalledWith('scan',[],{all:true,excludedIds:['2']})
})

it('labels an interrupted full-profile archive as partial instead of complete',async()=>{
 history.replaceState(null,'','/tools/instagram-profile')
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,state:'failed',count:1,outcome:'incomplete',scope:'all'})
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Profile link or @handle'}),{target:{value:'@publicprofile'}})
 fireEvent.click(screen.getByRole('button',{name:'Scan entire profile'}))
 expect(await screen.findByRole('button',{name:'Download partial ZIP'})).toBeEnabled()
 expect(screen.queryByText('Reached the end of the accessible profile.')).not.toBeInTheDocument()
})

it('reloads finished results after a failed initial fetch without starting another scan',async()=>{
 vi.mocked(remoteMedia.discoveryItems).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue({items:[photo],next:null})
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Post link'}),{target:{value:'https://www.instagram.com/p/post/'}})
 fireEvent.click(screen.getByRole('button',{name:'Find items'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the found items')
 fireEvent.click(screen.getByRole('button',{name:'Reload results'}))
 expect(await screen.findByRole('checkbox',{name:'Select First photo'})).toBeVisible()
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
 expect(remoteMedia.discoverTool).toHaveBeenCalledTimes(1)
})

it('loads the final items when stopping a scan and keeps existing selections',async()=>{
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,state:'discovering',count:1})
 vi.mocked(remoteMedia.cancel).mockResolvedValue({...discovery,state:'cancelled',count:2,outcome:'cancelled'})
 vi.mocked(remoteMedia.discoveryItems).mockResolvedValueOnce({items:[photo],next:null}).mockResolvedValue({items:[photo,video],next:null})
 await scan();fireEvent.click(screen.getByRole('checkbox',{name:'Select First photo'}))
 fireEvent.click(screen.getByRole('button',{name:'Stop scan'}))
 expect(await screen.findByRole('checkbox',{name:'Select A video'})).toBeVisible()
 expect(screen.getByRole('checkbox',{name:'Select First photo'})).toBeChecked()
 expect(screen.getByText('1 selected across pages')).toBeVisible()
})

it('updates a completed scan even if its final result fetch fails and can reload without losing selection',async()=>{
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,state:'discovering',count:1})
 vi.mocked(remoteMedia.discovery).mockResolvedValue({...discovery,count:2})
 vi.mocked(remoteMedia.discoveryItems).mockResolvedValueOnce({items:[photo],next:null}).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue({items:[photo,video],next:null})
 await scan();fireEvent.click(screen.getByRole('checkbox',{name:'Select First photo'}))
 expect(await screen.findByRole('button',{name:'Reload results'},{timeout:4000})).toBeEnabled()
 expect(screen.queryByRole('button',{name:'Stop scan'})).not.toBeInTheDocument()
 expect(screen.getByRole('checkbox',{name:'Select First photo'})).toBeChecked()
 fireEvent.click(screen.getByRole('button',{name:'Reload results'}))
 expect(await screen.findByRole('checkbox',{name:'Select A video'})).toBeVisible()
 expect(screen.getByRole('checkbox',{name:'Select First photo'})).toBeChecked()
})

it('replaces a broken thumbnail with a media icon and leaves the item selectable',async()=>{
 vi.mocked(remoteMedia.discoveryItems).mockResolvedValue({items:[{...photo,thumbnail:'/v1/convert/artifacts/12345678-1234-1234-1234-123456789012/preview'}],next:null})
 await scan()
 const image=screen.getByRole('checkbox',{name:'Select First photo'}).parentElement!.querySelector('img')!
 expect(image).toHaveAttribute('src',expect.stringContaining('/preview'))
 fireEvent.error(image)
 expect(image).not.toBeInTheDocument()
 expect(screen.getByRole('checkbox',{name:'Select First photo'}).parentElement!.querySelector('.tool-item-art > svg')).not.toBeNull()
 fireEvent.click(screen.getByRole('checkbox',{name:'Select First photo'}))
 expect(screen.getByText('1 selected across pages')).toBeVisible()
})

it('does not let a slow initial response replace newer results after a scan finishes',async()=>{
 let finish!:(value:{items:typeof photo[];next:null})=>void
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,state:'discovering',count:1})
 vi.mocked(remoteMedia.discovery).mockResolvedValue({...discovery,count:2})
 vi.mocked(remoteMedia.discoveryItems).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue({items:[photo,video],next:null})
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Post link'}),{target:{value:'https://www.instagram.com/p/post/'}})
 fireEvent.click(screen.getByRole('button',{name:'Find items'}))
 await screen.findByRole('checkbox',{name:'Select A video'},{timeout:4000})
 await act(async()=>finish({items:[photo],next:null}))
 expect(screen.getByRole('checkbox',{name:'Select A video'})).toBeVisible()
 expect(screen.getByRole('button',{name:'Find items'})).toBeEnabled()
})

it('keeps results and selections when switching to another tool and back',async()=>{
 await scan();fireEvent.click(screen.getByRole('checkbox',{name:'Select First photo'}))
 act(()=>{history.pushState(null,'','/tools/youtube-shorts');window.dispatchEvent(new PopStateEvent('popstate'))})
 expect(screen.getByRole('textbox',{name:'Channel link or @handle'})).toBeVisible()
 expect(screen.queryByRole('checkbox',{name:'Select First photo'})).not.toBeInTheDocument()
 act(()=>{history.pushState(null,'','/tools/instagram-post');window.dispatchEvent(new PopStateEvent('popstate'))})
 expect(screen.getByRole('checkbox',{name:'Select First photo'})).toBeChecked()
 expect(remoteMedia.discoverTool).toHaveBeenCalledTimes(1)
})

it('lets a scan stop while its first items request is still pending',async()=>{
 let finish!:(value:{items:typeof photo[];next:null})=>void
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,state:'discovering',count:1})
 vi.mocked(remoteMedia.cancel).mockResolvedValue({...discovery,state:'cancelled',count:1,outcome:'cancelled'})
 vi.mocked(remoteMedia.discoveryItems).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue({items:[photo],next:null})
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Post link'}),{target:{value:'https://www.instagram.com/p/post/'}})
 fireEvent.click(screen.getByRole('button',{name:'Find items'}))
 const stop=await screen.findByRole('button',{name:'Stop scan'})
 expect(stop).toBeEnabled();fireEvent.click(stop)
 await screen.findByRole('checkbox',{name:'Select First photo'})
 await act(async()=>finish({items:[],next:null}))
 expect(screen.getByRole('checkbox',{name:'Select First photo'})).toBeVisible()
 expect(screen.queryByRole('button',{name:'Stop scan'})).not.toBeInTheDocument()
})

it('offers a new scan instead of polling forever when the service loses its scan record',async()=>{
 history.replaceState(null,'','/tools/instagram-profile')
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,state:'discovering',count:1})
 vi.mocked(remoteMedia.discovery).mockResolvedValueOnce({...discovery,state:'discovering',count:1}).mockRejectedValue(Object.assign(new Error('Scan expired'),{code:'EXPIRED'}))
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Profile link or @handle'}),{target:{value:'@publicprofile'}})
 fireEvent.click(screen.getByRole('button',{name:'Scan entire profile'}))
 await screen.findByRole('checkbox',{name:'Select First photo'})
 await screen.findByText(/Start a new scan/,{},{timeout:4000})
 expect(screen.getByRole('button',{name:'Scan entire profile'})).toBeEnabled()
 expect(screen.queryByRole('button',{name:'Stop scan'})).not.toBeInTheDocument()
 expect(screen.queryByRole('button',{name:'Download partial ZIP'})).not.toBeInTheDocument()
 expect(screen.getByRole('checkbox',{name:'Select First photo'})).toBeChecked()
})

it('keeps selections after a failed next-page load and reloads the requested page',async()=>{
 vi.mocked(remoteMedia.discoveryItems).mockResolvedValueOnce({items:[photo],next:'next'}).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue({items:[video],next:null})
 await scan();fireEvent.click(screen.getByRole('checkbox',{name:'Select First photo'}))
 fireEvent.click(screen.getByRole('button',{name:'Next page'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Your selection is kept')
 expect(screen.getByRole('checkbox',{name:'Select First photo'})).toBeChecked()
 fireEvent.click(screen.getByRole('button',{name:'Reload results'}))
 fireEvent.click(await screen.findByRole('checkbox',{name:'Select A video'}))
 expect(screen.getByText('2 selected across pages')).toBeVisible()
 fireEvent.click(screen.getByRole('button',{name:'Download selected'}))
 expect(controller.addToolCollection).toHaveBeenCalledWith('scan',['1','2'])
})

it('restores a scan, result page and cross-page selections after a reload',async()=>{
 const view=render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Post link'}),{target:{value:'https://www.instagram.com/p/post/'}})
 fireEvent.click(screen.getByRole('button',{name:'Find items'}));fireEvent.click(await screen.findByRole('checkbox',{name:'Select First photo'}))
 fireEvent.click(screen.getByRole('button',{name:'Next page'}));fireEvent.click(await screen.findByRole('checkbox',{name:'Select A video'}))
 view.unmount();vi.mocked(remoteMedia.discovery).mockResolvedValue({...discovery,tool:'instagram-post',url:photo.url})
 render(<Tools controller={controller}/>)
 expect(await screen.findByRole('checkbox',{name:'Select A video'})).toBeChecked()
 expect(screen.getByText('2 selected across pages')).toBeVisible()
 expect(screen.getByText(/Previous scan restored/)).toBeVisible()
 fireEvent.click(screen.getByRole('button',{name:'Download selected'}))
 expect(controller.addToolCollection).toHaveBeenLastCalledWith('scan',['1','2'])
 expect(remoteMedia.discoverTool).toHaveBeenCalledTimes(1)
})

it('recovers the latest owned interrupted scan on a later visit without rescanning',async()=>{
 history.replaceState(null,'','/tools/instagram-profile')
 vi.mocked(remoteMedia.discoveries).mockResolvedValue({items:[{...discovery,tool:'instagram-profile',state:'interrupted',outcome:'incomplete',url:'https://www.instagram.com/publicprofile/',mediaType:'image',after:'20261101'}],next:null})
 render(<Tools controller={controller}/>)
 expect(await screen.findByRole('button',{name:'Download partial ZIP'})).toBeEnabled()
 expect(screen.getByRole('textbox',{name:'Profile link or @handle'})).toHaveValue('https://www.instagram.com/publicprofile/')
 expect(screen.getByRole('combobox',{name:'Include'})).toHaveValue('image')
 expect(remoteMedia.discoverTool).not.toHaveBeenCalled()
 expect(remoteMedia.discoveries).toHaveBeenCalledWith('instagram-profile')
})

it('does not replace a new draft when previous-scan recovery arrives late',async()=>{
 let finish!:(value:Awaited<ReturnType<typeof remoteMedia.discoveries>>)=>void
 vi.mocked(remoteMedia.discoveries).mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Post link'}),{target:{value:'https://www.instagram.com/p/new/'}})
 await act(async()=>finish({items:[{...discovery,tool:'instagram-post',url:photo.url}],next:null}))
 expect(screen.getByRole('textbox',{name:'Post link'})).toHaveValue('https://www.instagram.com/p/new/')
 expect(screen.queryByText(/Previous scan restored/)).not.toBeInTheDocument()
})

it('loads later-page thumbnails through the owned preview endpoint and refreshes expired images',async()=>{
 const id='12345678-1234-1234-1234-123456789012'
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue({...discovery,id})
 vi.mocked(remoteMedia.discoveryItems).mockResolvedValue({items:[photo,{...video,thumbnail:`/v1/convert/artifacts/${id}/preview`}],next:null})
 await scan()
 const first=screen.getByRole('checkbox',{name:'Select First photo'}).parentElement!.querySelector('img')!
 expect(first).toHaveAttribute('src',`/api/v1/convert/discoveries/${id}/items/1/preview`)
 const second=screen.getByRole('checkbox',{name:'Select A video'}).parentElement!.querySelector('img')!
 fireEvent.error(second)
 expect(second).toHaveAttribute('src',`/api/v1/convert/discoveries/${id}/items/2/preview`)
 fireEvent.error(second)
 expect(screen.getByRole('checkbox',{name:'Select A video'}).parentElement!.querySelector('img')).toBeNull()
})
