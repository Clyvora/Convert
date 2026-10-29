const poses = {
  sitting: 'sitting', working: 'working', confused: 'confused',
  ready: 'ready', sleeping: 'sleeping', local: 'local', curious: 'curious', pounce: 'pounce',
} as const

/** Decorative companion; real status is always conveyed by the adjacent text. */
export default function Mascot({ pose = 'sitting', className = '' }: { pose?: keyof typeof poses; className?: string }) {
  return <img key={pose} className={`mascot mascot-pose-${pose} ${className}`} src={`/mascot/${poses[pose]}.png`} alt="" aria-hidden="true" width="176" height="176" draggable={false}/>
}
