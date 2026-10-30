import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RemoteMedia from './RemoteMedia'
import { useRemoteMedia } from '../core/useRemoteMedia'
import { remoteMedia } from '../core/mediaClient'
import type { Inspection, Job } from '../core/mediaClient'

vi.mock('../core/mediaClient', () => ({ remoteMedia: { capabilities: vi.fn(), jobs: vi.fn(), inspect: vi.fn(), create: vi.fn(), preview: vi.fn(), discover: vi.fn(), discoveries: vi.fn(), discovery: vi.fn(), discoveryItems: vi.fn(), access: vi.fn(), cancel: vi.fn(), retry: vi.fn(), remove: vi.fn(), items: vi.fn() } }))
const inspection: Inspection = { id:'inspection',title:'Example clip',kind:'media',provider:'fixture',mediaId:'1',url:'https://example.com/video',creator:'Author',duration:1,published:null,thumbnail:null,count:null,countConfidence:'unknown',formats:[{id:'av',ext:'mp4',video:'h264',audio:'aac',height:720,width:1280,fps:30,bitrate:100,sampleRate:48000,channels:2,language:'en',size:100,sizeKind:'exact'}],subtitles:[],restrictions:[],expires:Date.now()+60000 }
const job: Job = { id:'job',state:'queued',created:Date.now(),expires:Date.now()+60000,total:1,completed:0,failed:0,bytes:0,stage:'Queued',output:{mode:'combined',container:'original',preset:'best'} }
function Harness() {
  const controller = useRemoteMedia()
  return <><button onClick={() => controller.setPanel('settings')}>Open settings</button><button onClick={() => controller.setPanel('queue')}>Open queue</button><RemoteMedia active controller={controller}/></>
}
let anchorClick: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks()
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  vi.mocked(remoteMedia.capabilities).mockResolvedValue({apiVersion:1,containers:['original','mp3','mp4'],engine:'fixture',enabledProviders:1,catalogMethod:'',limits:{items:1000,itemBytes:100,duration:7200}})
  vi.mocked(remoteMedia.jobs).mockResolvedValue({items:[],next:null})
  vi.mocked(remoteMedia.discoveries).mockResolvedValue({items:[],next:null})
  vi.mocked(remoteMedia.inspect).mockResolvedValue(inspection)
  vi.mocked(remoteMedia.create).mockResolvedValue(job)
  vi.mocked(remoteMedia.access).mockResolvedValue({url:'https://media.example/artifact',name:'clip.mp4',expires:Date.now()+60000})
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it('respects disabled automatic queue opening without disabling background delivery', async () => {
  localStorage.setItem('clyvora-convert-interface-v1',JSON.stringify({autoOpenQueue:false}))
  vi.mocked(remoteMedia.create).mockResolvedValue({...job,state:'ready',artifactId:'artifact'})
  const user=userEvent.setup();render(<Harness/>)
  await user.type(screen.getByLabelText('Public media link'),'https://example.com/video{Enter}')
  await waitFor(()=>expect(anchorClick).toHaveBeenCalledOnce())
  expect(screen.queryByRole('dialog',{name:'Downloads'})).not.toBeInTheDocument()
})

it('keeps ready work available for manual delivery when automatic downloading is disabled', async () => {
  localStorage.setItem('clyvora-convert-interface-v1',JSON.stringify({autoDownload:false}))
  vi.mocked(remoteMedia.create).mockResolvedValue({...job,state:'ready',artifactId:'artifact'})
  const user=userEvent.setup();render(<Harness/>)
  await user.type(screen.getByLabelText('Public media link'),'https://example.com/video{Enter}')
  await screen.findByRole('button',{name:'Download file'})
  expect(anchorClick).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button',{name:'Download file'}))
  await waitFor(()=>expect(anchorClick).toHaveBeenCalledOnce())
})

it('inspects only on Download and preserves failed input', async () => {
  const user = userEvent.setup(); vi.mocked(remoteMedia.inspect).mockRejectedValue(new Error('Source unavailable'))
  render(<Harness/>)
  await user.type(screen.getByLabelText('Public media link'),'https://example.com/video')
  expect(remoteMedia.inspect).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button',{name:'Download'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Source unavailable')
  expect(screen.getByLabelText('Public media link')).toHaveValue('https://example.com/video')
  expect(document.querySelector('.download-companion')).toHaveAttribute('src',expect.stringMatching(/\/confused\.webp$/))
})
it('uses the curious pose while checking, then the running pose for queued work', async () => {
  let resolveInspection: (value: Inspection) => void = () => undefined
  vi.mocked(remoteMedia.inspect).mockImplementationOnce(() => new Promise(resolve => { resolveInspection = resolve }))
  const user = userEvent.setup(); render(<Harness/>)
  expect(document.querySelector('.download-companion')).toHaveAttribute('src',expect.stringMatching(/\/sitting\.webp$/))
  await user.type(screen.getByLabelText('Public media link'),'https://example.com/video{Enter}')
  await waitFor(() => expect(document.querySelector('.download-companion')).toHaveAttribute('src',expect.stringMatching(/\/curious\.webp$/)))
  await act(async () => resolveInspection(inspection))
  await waitFor(() => expect(document.querySelector('.download-companion')).toHaveAttribute('src',expect.stringMatching(/\/working\.webp$/)))
})
it('Auto submits combined media immediately without a second confirmation', async () => {
  const user = userEvent.setup(); render(<Harness/>)
  await user.type(screen.getByLabelText('Public media link'),'https://example.com/video{Enter}')
  await waitFor(() => expect(remoteMedia.create).toHaveBeenCalledOnce())
  expect(vi.mocked(remoteMedia.create).mock.calls[0][0]).toMatchObject({inspectionId:'inspection',output:{mode:'combined',container:'original'}})
  expect(await screen.findByRole('dialog',{name:'Downloads'})).toBeVisible()
})
it('Auto detects audio-only and silent video without inventing streams', async () => {
  const user = userEvent.setup();vi.mocked(remoteMedia.inspect).mockResolvedValueOnce({...inspection,formats:[{...inspection.formats[0],video:null}]})
  render(<Harness/>)
  await user.type(screen.getByLabelText('Public media link'),'https://example.com/audio{Enter}')
  await waitFor(() => expect(remoteMedia.create).toHaveBeenCalledOnce())
  expect(vi.mocked(remoteMedia.create).mock.calls[0][0]).toMatchObject({output:{mode:'audio',container:'original'}})
  await user.click(screen.getByRole('button',{name:'Close downloads'}))
  vi.mocked(remoteMedia.inspect).mockResolvedValue({...inspection,formats:[{...inspection.formats[0],audio:null}]})
  await user.clear(screen.getByLabelText('Public media link'));await user.type(screen.getByLabelText('Public media link'),'https://example.com/silent{Enter}')
  await waitFor(() => expect(remoteMedia.create).toHaveBeenCalledTimes(2))
  expect(vi.mocked(remoteMedia.create).mock.calls[1][0]).toMatchObject({output:{mode:'video'}})
})
it('keeps unavailable quality explicit and restores settings focus', async () => {
  localStorage.setItem('clyvora-convert-remote-preferences-v2',JSON.stringify({mode:'auto',videoContainer:'mp4',audioContainer:'mp3',options:{preset:'best',height:1080}}))
  const user = userEvent.setup(); render(<Harness/>)
  await user.type(screen.getByLabelText('Public media link'),'https://example.com/video{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
  expect(remoteMedia.create).not.toHaveBeenCalled()
  const trigger = screen.getByRole('button',{name:'Choose output settings'});await user.click(trigger)
  expect(screen.getByRole('button',{name:'Close settings'})).toHaveFocus()
  await user.selectOptions(screen.getByLabelText('Resolution'),'720')
  await user.keyboard('{Escape}')
  expect(trigger).toHaveFocus()
  await user.click(screen.getByRole('button',{name:'Download'}))
  await waitFor(() => expect(remoteMedia.create).toHaveBeenCalledOnce())
})
it('automatically delivers a newly-created ready artifact exactly once', async () => {
  const user = userEvent.setup()
  const ready = {...job,state:'ready' as const,artifactId:'artifact',completed:1,stage:'Ready'}
  vi.mocked(remoteMedia.create).mockResolvedValue(ready)
  render(<Harness/>);await user.type(screen.getByLabelText('Public media link'),'https://example.com/video{Enter}')
  await waitFor(() => expect(anchorClick).toHaveBeenCalledOnce())
  vi.mocked(remoteMedia.jobs).mockResolvedValue({items:[ready],next:null})
  await act(async () => { await new Promise(resolve => setTimeout(resolve,2500)) })
  expect(anchorClick).toHaveBeenCalledOnce()
})
it('never automatically downloads restored jobs', async () => {
  vi.mocked(remoteMedia.jobs).mockResolvedValue({items:[{...job,state:'ready',artifactId:'artifact',completed:1}],next:null})
  const user = userEvent.setup();render(<Harness/>)
  await user.click(screen.getByRole('button',{name:'Open queue'}));await screen.findByRole('button',{name:'Download file'})
  expect(remoteMedia.access).not.toHaveBeenCalled();expect(anchorClick).not.toHaveBeenCalled()
})

it('keeps clicked downloads queued until transfer confirmation, then moves them to Recent', async () => {
  const ready = {...job,state:'ready' as const,artifactId:'artifact',completed:1,stage:'Ready'}
  vi.mocked(remoteMedia.create).mockResolvedValue(ready)
  const user=userEvent.setup();render(<Harness/>);await user.type(screen.getByLabelText('Public media link'),'https://example.com/video{Enter}')
  await waitFor(()=>expect(anchorClick).toHaveBeenCalledOnce())
  expect(screen.getByRole('button',{name:'Download file'})).toBeVisible()
  expect(screen.queryByText(/Recent downloads/)).not.toBeInTheDocument()
  vi.mocked(remoteMedia.jobs).mockResolvedValue({items:[{...ready,deliveredAt:Date.now()}],next:null})
  await waitFor(()=>expect(screen.getByText('Recent downloads (1)')).toBeVisible(),{timeout:4000})
  expect(screen.queryByRole('button',{name:'Download file'})).not.toBeInTheDocument()
  await user.click(screen.getByText('Recent downloads (1)'));await user.click(screen.getByRole('button',{name:'Download again'}))
  expect(anchorClick).toHaveBeenCalledTimes(2)
})

it('retries a transient access failure without duplicating the actual download', async () => {
  const ready={...job,state:'ready' as const,artifactId:'artifact',completed:1,stage:'Ready'}
  vi.mocked(remoteMedia.jobs).mockResolvedValue({items:[ready],next:null});vi.mocked(remoteMedia.create).mockResolvedValue(ready)
  vi.mocked(remoteMedia.access).mockRejectedValueOnce(Object.assign(new Error('Try again'),{retryable:true}))
  const user=userEvent.setup();render(<Harness/>);await user.type(screen.getByLabelText('Public media link'),'https://example.com/video{Enter}')
  await waitFor(()=>expect(anchorClick).toHaveBeenCalledOnce(),{timeout:6000})
  expect(remoteMedia.access).toHaveBeenCalledTimes(2)
},10000)

it('keeps partial batches in the queue after their archive was transferred', async () => {
  vi.mocked(remoteMedia.jobs).mockResolvedValue({items:[{...job,state:'partial',total:2,completed:1,failed:1,artifactId:'archive',deliveredAt:Date.now()}],next:null})
  const user=userEvent.setup();render(<Harness/>);await user.click(screen.getByRole('button',{name:'Open queue'}))
  expect(await screen.findByRole('button',{name:'Retry failed items'})).toBeVisible()
  expect(screen.queryByText(/Recent downloads/)).not.toBeInTheDocument()
})

it('does not start a late automatic download after its job was removed', async () => {
  let finishAccess: (value: {url:string;name:string;expires:number}) => void = () => undefined
  vi.mocked(remoteMedia.access).mockImplementationOnce(()=>new Promise(resolve=>{finishAccess=resolve}))
  vi.mocked(remoteMedia.remove).mockResolvedValue({removed:true})
  vi.mocked(remoteMedia.create).mockResolvedValue({...job,state:'ready',artifactId:'artifact',completed:1})
  const user=userEvent.setup();render(<Harness/>);await user.type(screen.getByLabelText('Public media link'),'https://example.com/video{Enter}')
  await user.click(await screen.findByRole('button',{name:'Remove'}))
  await act(async()=>finishAccess({url:'https://media.example/artifact',name:'clip.mp4',expires:Date.now()+60000}))
  expect(anchorClick).not.toHaveBeenCalled()
})
it('opens selection for a collection and never enqueues it implicitly', async () => {
  vi.mocked(remoteMedia.inspect).mockResolvedValue({...inspection,kind:'playlist',formats:[]})
  const user = userEvent.setup();render(<Harness/>)
  await user.type(screen.getByLabelText('Public media link'),'https://example.com/list{Enter}')
  expect(await screen.findByRole('dialog',{name:'Choose collection items'})).toBeVisible()
  expect(remoteMedia.create).not.toHaveBeenCalled()
})
it('pastes on Enter with an empty input without inspecting', async () => {
  const user = userEvent.setup()
  vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('https://example.com/pasted')
  render(<Harness/>)
  await user.type(screen.getByLabelText('Public media link'),'{Enter}')
  await waitFor(() => expect(screen.getByLabelText('Public media link')).toHaveValue('https://example.com/pasted'))
  expect(remoteMedia.inspect).not.toHaveBeenCalled()
})
it('cancels an active job and retries eligible failures from the queue', async () => {
  vi.mocked(remoteMedia.jobs).mockResolvedValue({items:[job],next:null})
  vi.mocked(remoteMedia.cancel).mockResolvedValue({...job,state:'cancelled'})
  vi.mocked(remoteMedia.retry).mockResolvedValue(job)
  const user = userEvent.setup();render(<Harness/>)
  await user.click(screen.getByRole('button',{name:'Open queue'}))
  await user.click(await screen.findByRole('button',{name:'Cancel'}))
  expect(remoteMedia.cancel).toHaveBeenCalledWith('job')
  vi.mocked(remoteMedia.jobs).mockResolvedValue({items:[{...job,state:'failed',failed:1}],next:null})
  await act(async () => { await new Promise(resolve => setTimeout(resolve,2100)) })
  await user.click(await screen.findByRole('button',{name:'Retry failed items'}))
  expect(remoteMedia.retry).toHaveBeenCalledWith('job')
  expect(await screen.findByRole('button',{name:'Cancel'})).toBeVisible()
})
it('submits only explicitly selected collection items', async () => {
  const discovery = {id:'list',state:'ready',count:2,outcome:'completed'}
  vi.mocked(remoteMedia.inspect).mockResolvedValue({...inspection,kind:'playlist',formats:[]})
  vi.mocked(remoteMedia.discover).mockResolvedValue(discovery)
  vi.mocked(remoteMedia.discoveryItems).mockResolvedValue({items:[{id:'one',mediaId:'one',provider:'fixture',url:'https://example.com/one',title:'First clip'},{id:'two',mediaId:'two',provider:'fixture',url:'https://example.com/two',title:'Second clip'}],next:null})
  const user = userEvent.setup();render(<Harness/>)
  await user.type(screen.getByLabelText('Public media link'),'https://example.com/list{Enter}')
  await user.click(await screen.findByRole('button',{name:'Discover collection'}))
  await user.click(await screen.findByRole('button',{name:'First page / refresh'}))
  await user.click(await screen.findByLabelText('First clip'))
  await user.click(screen.getByRole('button',{name:'Download selected items'}))
  await waitFor(() => expect(remoteMedia.create).toHaveBeenCalledOnce())
  expect(vi.mocked(remoteMedia.create).mock.calls[0][0]).toMatchObject({discoveryId:'list',all:false,itemIds:['one']})
})

it('downloads Spotify matches as audio in Auto mode and identifies the source', async () => {
  vi.mocked(remoteMedia.inspect).mockResolvedValueOnce({...inspection,provider:'YouTube (Spotify match)',url:'https://www.youtube.com/watch?v=abcdefghijk',formats:[{...inspection.formats[0],video:null}]})
  const user=userEvent.setup();render(<Harness/>)
  await user.type(screen.getByLabelText('Public media link'),'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT{Enter}')
  await waitFor(()=>expect(remoteMedia.create).toHaveBeenCalledOnce())
  expect(vi.mocked(remoteMedia.create).mock.calls[0][0]).toMatchObject({output:{mode:'audio',container:'original'}})
  expect(screen.getByText('Audio matched on YouTube from your Spotify link.')).toBeInTheDocument()
})

it('shows current source speed and ETA in the download queue', async () => {
  vi.mocked(remoteMedia.jobs).mockResolvedValue({items:[{...job,state:'downloading',stage:'Downloading example',bytes:100,progressUpdatedAt:Date.now(),transferSpeed:1048576,transferEtaSeconds:30}],next:null})
  const user=userEvent.setup();render(<Harness/>);await user.click(screen.getByRole('button',{name:'Open queue'}))
  expect(await screen.findByText('Current source stream: 1.0 MB/s · ~30s remaining')).toBeVisible()
})

it('accepts pasted multiline links and displays an individual result for each', async () => {
  vi.mocked(remoteMedia.inspect).mockResolvedValueOnce({ ...inspection, id: 'first' }).mockResolvedValueOnce({ ...inspection, id: 'second' })
  const user = userEvent.setup();render(<Harness/>)
  fireEvent.change(screen.getByLabelText('Public media link'), { target: { value: 'https://example.com/one\nhttps://example.com/two' } })
  await user.click(screen.getByRole('button', { name: 'Download 2 links' }))
  await waitFor(() => expect(remoteMedia.create).toHaveBeenCalledTimes(2))
  await user.click(screen.getByRole('button', { name: 'Close downloads' }))
  expect(screen.getAllByText('Added to queue')).toHaveLength(2)
})
