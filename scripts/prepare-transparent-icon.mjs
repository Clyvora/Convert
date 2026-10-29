// Use the supplied monochrome artwork as a luminance mask, preserving its exact silhouette.
import { readFileSync, writeFileSync } from 'node:fs'
const image = readFileSync(new URL('../public/brand-cat.webp', import.meta.url)).toString('base64')
function svg(favicon) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><style>rect{fill:white}${favicon ? '@media(prefers-color-scheme:light){rect{fill:#171717}}' : ''}</style><defs><mask id="cat" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256" style="mask-type:luminance"><image width="256" height="256" href="data:image/webp;base64,${image}"/></mask></defs><rect width="256" height="256" mask="url(#cat)"/></svg>`
}
writeFileSync(new URL('../public/brand-cat-transparent.svg', import.meta.url), svg(false))
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg(true))
