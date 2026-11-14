import { useEffect, useRef, useState } from 'react'
import { errorReport, type ErrorReportInput } from '../core/errorReport'

export default function ErrorDetails(props: ErrorReportInput) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const [report, setReport] = useState('')
  const attempt = useRef(0)
  useEffect(() => () => { attempt.current++ }, [])
  useEffect(() => {
    if (state !== 'copied') return
    const timer = setTimeout(() => setState('idle'), 2200)
    return () => clearTimeout(timer)
  }, [state])
  async function copy() {
    const text = errorReport(props), current = ++attempt.current
    setReport(text)
    try { await navigator.clipboard.writeText(text); if (current === attempt.current) setState('copied') }
    catch { if (current === attempt.current) setState('manual') }
  }
  return <div className="error-details">
    <button type="button" className="text-button" onClick={() => void copy()}>Copy error details</button>
    {state === 'copied' && <span role="status">Error details copied.</span>}
    {state === 'manual' && <div className="error-details-manual"><p>Copy the details below. Links, filenames and error messages are excluded.</p><textarea aria-label="Error details" readOnly value={report} onFocus={event => event.currentTarget.select()}/></div>}
  </div>
}
