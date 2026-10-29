import sitting from '../assets/mascot/sitting.webp'
import working from '../assets/mascot/working.webp'
import confused from '../assets/mascot/confused.webp'
import ready from '../assets/mascot/ready.webp'
import sleeping from '../assets/mascot/sleeping.webp'
import local from '../assets/mascot/local.webp'
import curious from '../assets/mascot/curious.webp'
import pounce from '../assets/mascot/pounce.webp'

export const mascotImages = { sitting, working, confused, ready, sleeping, local, curious, pounce }

/** Start after the first page load, away from the critical rendering path. */
export function warmMascotImages() {
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
  const warm = () => {
    for (const src of Object.values(mascotImages)) {
      const image = new Image()
      image.decoding = 'async'
      image.fetchPriority = 'low'
      image.src = src
      void image.decode().catch(() => {})
    }
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 2000 })
  else globalThis.setTimeout(warm, 200)
}
