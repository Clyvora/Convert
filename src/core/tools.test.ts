import {expect,it} from 'vitest'
import {toolURL} from './tools'
it('normalizes handles and limits YouTube channel links to the Shorts tab',()=>{
 expect(toolURL('youtube-shorts','@YouTube')).toBe('https://www.youtube.com/@YouTube/shorts')
 expect(toolURL('instagram-profile','@nasa')).toBe('https://www.instagram.com/nasa/')
 expect(()=>toolURL('youtube-shorts','https://youtube.com/@name/videos')).toThrow()
 expect(()=>toolURL('instagram-profile','https://instagram.com/accounts/')).toThrow()
 for(const url of ['https://instagram.com.evil.example/p/test/','https://user:secret@instagram.com/p/test/','https://instagram.com:444/p/test/'])expect(()=>toolURL('instagram-post',url)).toThrow()
})
