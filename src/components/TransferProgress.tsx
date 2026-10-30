import { useEffect, useState } from 'react'
import type { Job } from '../core/remoteContracts'
import { transferProgress } from '../core/transferProgress'

export default function TransferProgress({ job }: { job: Job }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (job.state !== 'downloading' || !job.progressUpdatedAt) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(timer)
  }, [job.state, job.progressUpdatedAt])
  const text = transferProgress(job, now)
  return text ? <p className="muted">{text}</p> : null
}
