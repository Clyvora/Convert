import {expect,it} from 'vitest'
import {MAX_LOCAL_FILE_BYTES,validateLocalFileSize} from './localLimits'

it('accepts audio/video sizes beyond the old caps and rejects the runtime boundary',()=>{
 for(const bytes of [301*1024**2,501*1024**2,1024**3,MAX_LOCAL_FILE_BYTES])expect(()=>validateLocalFileSize(bytes)).not.toThrow()
 for(const bytes of [0,-1,NaN,Infinity,1.5,2**31,5*1024**3])expect(()=>validateLocalFileSize(bytes)).toThrow()
})
