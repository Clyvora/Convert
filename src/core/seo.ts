export const siteOrigin = 'https://mewvi.xyz'
export const searchPages: Record<string, { title: string; description: string }> = {
  '/': { title: 'mewvi — Free Media Downloader & Online Converter', description: 'Download supported public audio and video links, or convert your own files privately in your browser. No account required. By Clyvora.' },
  '/local': { title: 'Private Audio & Video Converter — mewvi', description: 'Convert MP3, WAV, FLAC, MP4, WebM and more in your browser. Local files stay on your device. Choose formats and download your converted files.' },
  '/about': { title: 'About mewvi — Media Downloads & Local Conversion', description: 'Learn how mewvi handles public media downloads, private browser-based conversion, supported sources and beta limitations.' },
  '/about/privacy': { title: 'Privacy Policy — mewvi', description: 'How mewvi processes local files, public links, anonymous sessions, preferences and temporary downloads.' },
  '/about/terms': { title: 'Usage & Service Limits — mewvi', description: 'Understand permitted use, source availability, conversion limits and the public-media requirements of mewvi.' },
  '/about/community': { title: 'Help & Community — mewvi', description: 'Report a problem, contribute to mewvi, find the source code and follow product development.' },
  '/about/credits': { title: 'Credits & Open Source — mewvi', description: 'The projects, libraries and contributors behind mewvi, an audio and video tool by Clyvora.' },
  '/updates': { title: 'Product Updates — mewvi', description: 'Read the latest mewvi beta release notes, interface improvements, media features and known limitations.' },
}
export function pageSEO(path: string) {
  path = path.replace(/\/+$/, '') || '/'
  const page = searchPages[path]
  return { ...(page || { title: path.startsWith('/settings') ? 'Settings — mewvi' : 'Page Not Found — mewvi', description: 'Manage your mewvi preferences for audio and video downloads and local file conversion.' }), canonical: siteOrigin + path, robots: page ? 'index, follow, max-image-preview:large, max-snippet:-1' : 'noindex, follow' }
}
export function structuredData(path: string) {
  const page = pageSEO(path)
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': 'https://www.clyvora.tech/#organization', name: 'Clyvora', url: 'https://www.clyvora.tech/' },
    { '@type': 'WebSite', '@id': siteOrigin + '/#website', name: 'mewvi', alternateName: 'Clyvora Convert', url: siteOrigin + '/', publisher: { '@id': 'https://www.clyvora.tech/#organization' } },
    { '@type': 'WebApplication', '@id': siteOrigin + '/#app', name: 'mewvi', alternateName: 'Clyvora Convert', url: siteOrigin + '/', description: searchPages['/'].description, applicationCategory: 'MultimediaApplication', operatingSystem: 'Web browser', browserRequirements: 'JavaScript and WebAssembly enabled', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@id': 'https://www.clyvora.tech/#organization' } },
    { '@type': 'WebPage', '@id': page.canonical + '#webpage', url: page.canonical, name: page.title, description: page.description, inLanguage: 'en', isPartOf: { '@id': siteOrigin + '/#website' }, about: { '@id': siteOrigin + '/#app' } },
  ] }
}
export function updatePageSEO() {
  const path = location.pathname, page = pageSEO(path)
  document.title = page.title
  for (const [selector, content] of [
    ['meta[name="description"]', page.description], ['meta[name="robots"]', page.robots],
    ['meta[property="og:title"]', page.title], ['meta[property="og:description"]', page.description], ['meta[property="og:url"]', page.canonical],
    ['meta[name="twitter:title"]', page.title], ['meta[name="twitter:description"]', page.description],
  ]) document.querySelector(selector)?.setAttribute('content', content)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', page.canonical)
  const schema = document.querySelector('script[type="application/ld+json"]')
  if (schema) schema.textContent = JSON.stringify(structuredData(path))
}
