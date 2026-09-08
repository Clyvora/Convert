import { useEffect, useRef, useState } from 'react'
import { downloadMedia, resolveMedia } from '../core/mediaClient'
import { formatBytes } from '../core/format'
import { MorphText } from '../MorphText'

export default function PublicLinks({ onFile, onChooseFiles }: { onFile: (file: File) => Promise<void>; onChooseFiles: () => void }) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const retrieve = async () => {
    if (controller.current) return
    const abort = new AbortController(); controller.current = abort; setBusy(true); setError(''); setStatus('Checking public track…')
    try {
      const media = await resolveMedia(url, abort.signal)
      setStatus(`Retrieving ${media.title || 'public track'}…`)
      const result = await downloadMedia(media, abort.signal, (loaded, total) => setStatus(`Retrieving ${formatBytes(loaded)}${total ? ` of ${formatBytes(total)}` : ''}…`))
      abort.signal.throwIfAborted()
      await onFile(new File([result.blob], result.filename, { type: result.blob.type }))
      setStatus('Added to local files. Choose an output format and convert on this device.')
    } catch (failure) {
      setStatus(''); setError(abort.signal.aborted ? 'Retrieval cancelled. You can try again.' : failure instanceof Error ? failure.message : 'Retrieval failed. Try again.')
    } finally { controller.current = null; setBusy(false) }
  }
  return <div className={`unified-input ${url.length > 0 ? 'has-link' : ''} ${busy ? 'is-retrieving' : ''}`}>
    <h2>Start with a link or a file</h2>
    <form className="link-form" onSubmit={event => { event.preventDefault(); void retrieve() }}>
      <label htmlFor="public-url">SoundCloud link</label>
      <div className="link-input-row">
        <input id="public-url" type="url" required autoComplete="off" placeholder="Paste a SoundCloud track link" value={url} disabled={busy}
          onChange={event => { setUrl(event.target.value); setError(''); setStatus('') }} aria-describedby="input-privacy" />
        {url.length > 0 && !busy && <button type="button" className="clear-link" aria-label="Clear link" onClick={() => { setUrl(''); setError(''); setStatus(''); document.getElementById('public-url')?.focus() }}>×</button>}
      </div>
      <div className="input-actions">
        <div className="input-hint" aria-hidden={url.length > 0}><span className="input-or">or drop audio or video here</span></div>
        <button className={`primary-button input-primary ${busy ? 'is-cancel' : ''}`} type={url.length > 0 && !busy ? 'submit' : 'button'}
          aria-label={busy ? 'Cancel retrieval' : url.length > 0 ? 'Retrieve track' : 'Choose files'}
          onClick={() => { if (busy) controller.current?.abort(); else if (!url.length) onChooseFiles() }}>
          <MorphText>{busy ? 'Cancel retrieval' : url.length > 0 ? 'Retrieve track' : 'Choose files'}</MorphText>
          <svg className="input-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>
      </div>
    </form>
    <p className="input-privacy" id="input-privacy">{url.length > 0 ? 'Submitted links use Clyvora’s retrieval service. Public tracks only.' : 'Local files stay on this device. Links use a retrieval service.'}</p>
    {status && <p className="retrieval-status" role="status"><MorphText>{status}</MorphText></p>}
    {error && <p className="retrieval-error" role="alert">{error}</p>}
  </div>
}
