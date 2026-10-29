import { mascotImages } from '../core/artwork'

/** Decorative companion; real status is always conveyed by the adjacent text. */
export default function Mascot({ pose = 'sitting', className = '' }: { pose?: keyof typeof mascotImages; className?: string }) {
  return <img className={`mascot mascot-pose-${pose} ${className}`} src={mascotImages[pose]} alt="" aria-hidden="true" width="176" height="176" decoding="async" fetchPriority={pose === 'sitting' ? 'high' : 'auto'} draggable={false}/>
}
