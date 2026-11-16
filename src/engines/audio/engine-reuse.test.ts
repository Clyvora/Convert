import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {LocalMediaFfmpegEngine} from './AudioFfmpegEngine'
import {MediaConversionEngine} from './AudioConversionEngine'
import type {ConversionOptions} from '../../core/types'

const runtime=vi.hoisted(()=>({instances:[] as Array<{loaded:boolean;load:ReturnType<typeof vi.fn>;terminate:ReturnType<typeof vi.fn>}>,load:vi.fn(),exec:vi.fn()}))
vi.mock('@ffmpeg/ffmpeg',()=>({FFFSType:{WORKERFS:'WORKERFS'},FFmpeg:class {
 loaded=false
 load=vi.fn(async(config:unknown)=>{await runtime.load(config);this.loaded=true})
 terminate=vi.fn(()=>{this.loaded=false})
 createDir=vi.fn();mount=vi.fn();unmount=vi.fn();deleteFile=vi.fn();deleteDir=vi.fn();on=vi.fn();off=vi.fn()
 exec=vi.fn(async()=>runtime.exec());readFile=vi.fn(async()=>new Uint8Array([1,2,3]))
 constructor(){runtime.instances.push(this)}
}}))
const options:ConversionOptions={outputFormat:'flac',audioBitrate:192,audioChannels:'source',audioSampleRate:'source',videoQuality:'balanced',videoResolution:'original',videoCodec:'auto'}
beforeEach(()=>{runtime.instances.length=0;runtime.load.mockReset().mockResolvedValue(undefined);runtime.exec.mockReset().mockResolvedValue(0);vi.stubGlobal('crossOriginIsolated',true)})
afterEach(()=>vi.unstubAllGlobals())

it('reuses one prepared worker across audio and video files in a mixed batch',async()=>{
 const engine=new MediaConversionEngine(),signal=new AbortController().signal
 const audio={format:'wav' as const,kind:'audio' as const,extension:'wav',mimeType:'audio/wav'}
 await engine.prepare(audio,options)
 await engine.convert(new File(['tone'],'tone.wav'),audio,options,signal,()=>{})
 await engine.convert(new File(['video'],'video.webm'),{format:'webm',kind:'video',extension:'webm',mimeType:'video/webm'},{...options,outputFormat:'mp4'},signal,()=>{})
 expect(runtime.instances).toHaveLength(1);expect(runtime.instances[0].load).toHaveBeenCalledOnce()
 engine.dispose();expect(runtime.instances[0].terminate).toHaveBeenCalledOnce()
})
it('waits for a warm-up then switches to the verified core if the output changes to AAC',async()=>{
 let finish!:()=>void
 runtime.load.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve}))
 const engine=new LocalMediaFfmpegEngine(),prepared=engine.prepare('wav','mp3')
 await vi.waitFor(()=>expect(runtime.instances).toHaveLength(1))
 const converted=engine.convert(new File(['tone'],'tone.wav'),'wav',{...options,outputFormat:'m4a'})
 finish();await prepared;await converted
 expect(runtime.instances).toHaveLength(2)
 expect(runtime.instances[0].terminate).toHaveBeenCalledOnce()
 expect(runtime.instances[1].load.mock.calls[0][0]).toEqual(expect.objectContaining({coreURL:expect.stringContaining('/single/')}))
 engine.dispose()
})
it('an old failed warm-up cannot terminate a new worker after disposal',async()=>{
 let fail!:(error:Error)=>void
 runtime.load.mockImplementationOnce(()=>new Promise<void>((_resolve,reject)=>{fail=reject}))
 const engine=new LocalMediaFfmpegEngine()
 const old=engine.prepare('wav','flac').catch(error=>error)
 await vi.waitFor(()=>expect(runtime.instances).toHaveLength(1))
 engine.dispose();await engine.prepare('wav','flac')
 fail(new Error('Old worker terminated'))
 expect(await old).toMatchObject({code:'cancelled'})
 expect(runtime.instances[1].terminate).not.toHaveBeenCalled()
 await engine.convert(new File(['tone'],'tone.wav'),'wav',options)
 expect(runtime.instances).toHaveLength(2)
 engine.dispose()
})
it('keeps a successful single-thread fallback available for the conversion',async()=>{
 runtime.load.mockRejectedValueOnce(new Error('Multithreading unavailable'))
 const engine=new LocalMediaFfmpegEngine()
 await engine.prepare('wav','mp3')
 await engine.convert(new File(['tone'],'tone.wav'),'wav',{...options,outputFormat:'mp3'})
 expect(runtime.instances).toHaveLength(2);expect(engine.engineMode).toBe('single-thread')
 engine.dispose()
})
it('releases a large conversion worker and can convert the next file on the same engine',async()=>{
 const engine=new LocalMediaFfmpegEngine(),large=new File(['tone'],'large.wav')
 Object.defineProperty(large,'size',{value:1024**3})
 const result=await engine.convert(large,'wav',options)
 expect(result.blob.size).toBe(3);expect(result.engineMode).toBe('single-thread')
 expect(runtime.instances[0].terminate).toHaveBeenCalledOnce();expect(engine.isLoaded).toBe(false)
 await engine.convert(new File(['tone'],'next.wav'),'wav',options)
 expect(runtime.instances).toHaveLength(2);expect(engine.isLoaded).toBe(true)
 engine.dispose()
})
it('recovers from an actual memory-allocation error instead of reusing a failed worker',async()=>{
 const engine=new LocalMediaFfmpegEngine()
 runtime.exec.mockRejectedValueOnce(new RangeError('Array buffer allocation failed'))
 await expect(engine.convert(new File(['tone'],'tone.wav'),'wav',options)).rejects.toMatchObject({code:'memory-limit'})
 expect(runtime.instances[0].terminate).toHaveBeenCalledOnce()
 await expect(engine.convert(new File(['tone'],'retry.wav'),'wav',options)).resolves.toMatchObject({format:'flac'})
 expect(runtime.instances).toHaveLength(2);engine.dispose()
})
