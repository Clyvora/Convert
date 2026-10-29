import { TextMorph } from 'torph/react'
import { useContext } from 'react'
import { MotionPreferenceContext } from './core/motionPreference'

export function MorphText({ children }: { children: string }) {
  const reduceMotion = useContext(MotionPreferenceContext)
  // Keep functional labels available in browsers without the animation APIs.
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && typeof Element.prototype.animate === 'function' && typeof Element.prototype.getAnimations === 'function'
  return supported && !reduceMotion
    ? <TextMorph as="span" duration={240} respectReducedMotion>{children}</TextMorph>
    : <span>{children}</span>
}
