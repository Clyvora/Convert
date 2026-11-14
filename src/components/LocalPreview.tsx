import { useEffect, useRef, useState } from 'react'

export default function LocalPreview({ url, mime, name }: { url: string; mime: string; name: string }) {
  const media = useRef<HTMLMediaElement | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const element = media.current
    element?.setAttribute('src', url)
    return () => { if (element) { element.pause(); element.removeAttribute('src'); element.load() } }
  }, [url])
  const props = { src: url, controls: true, preload: 'metadata', onError: () => setFailed(true), 'aria-label': `Preview ${name}` } as const
  return <div className="local-preview">
    {mime.startsWith('video/') ? <video {...props} playsInline ref={element => { media.current = element }}/> : <audio {...props} ref={element => { media.current = element }}/>}
    {failed && <p className="field-note" role="status">Your browser could not preview this file. You can still download it and open it in a media player.</p>}
  </div>
}
