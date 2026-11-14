import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import Tools from './Tools'
import { remoteMedia } from '../core/mediaClient'
import type { RemoteController } from '../core/useRemoteMedia'

vi.mock('../core/mediaClient',()=>({remoteMedia:{discoverTool:vi.fn(),discovery:vi.fn(),discoveryItems:vi.fn(),cancel:vi.fn(),preview:(value:string)=>`/api${value}`}}))
const controller={busy:false,error:'',errorCode:'',addToolCollection:vi.fn()} as unknown as RemoteController
const discovery={id:'scan',state:'ready',count:3,outcome:'completed'}
const photo={id:'1',mediaId:'image',provider:'Instagram',url:'https://www.instagram.com/p/post/',title:'First photo',mediaType:'image' as const}
const video={...photo,id:'2',mediaId:'video',title:'A video',mediaType:'video' as const}
beforeEach(()=>{
 vi.clearAllMocks();history.replaceState(null,'','/tools/instagram-post')
 vi.mocked(remoteMedia.discoverTool).mockResolvedValue(discovery)
 vi.mocked(remoteMedia.discoveryItems).mockImplementation(async(_id,cursor)=>cursor?{items:[video],next:null}:{items:[photo],next:'next'})
})
async function scan(){
 render(<Tools controller={controller}/>);fireEvent.change(screen.getByRole('textbox',{name:'Post link'}),{target:{value:'https://www.instagram.com/p/post/'}})
 fireEvent.click(screen.getByRole('button',{name:'Find items'}));await screen.findByRole('checkbox',{name:'Select First photo'})
}
it('keeps photo and video selections across pages and only queues explicitly chosen items',async()=>{
 await scan();fireEvent.click(screen.getByRole('checkbox',{name:'Select First photo'}))
 fireEvent.click(screen.getByRole('button',{name:'Next page'}));fireEvent.click(await screen.findByRole('checkbox',{name:'Select A video'}))
 expect(screen.getByText('2 selected across pages')).toBeVisible()
 fireEvent.click(screen.getByRole('button',{name:'Download selected'}))
 expect(controller.addToolCollection).toHaveBeenCalledWith('scan',['1','2'])
})
it('selects only matching visible items and keeps the filter separate from selection',async()=>{
 vi.mocked(remoteMedia.discoveryItems).mockResolvedValue({items:[photo,video],next:null})
 await scan();fireEvent.change(screen.getByRole('searchbox'),{target:{value:'photo'}})
 fireEvent.click(screen.getByRole('button',{name:'Select this page'}));expect(screen.getByText('1 selected across pages')).toBeVisible()
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:''}})
 expect(screen.getByRole('checkbox',{name:'Select A video'})).not.toBeChecked()
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
 vi.mocked(remoteMedia.cancel).mockResolvedValue({...discovery,state:'cancelled',count:1})
 await scan();fireEvent.click(screen.getByRole('button',{name:'Stop scan'}))
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Stop scan'})).not.toBeInTheDocument())
 expect(screen.getByRole('checkbox',{name:'Select First photo'})).toBeVisible()
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
