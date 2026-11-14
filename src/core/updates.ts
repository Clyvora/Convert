export const batchUpdate = {
  id: 'more-in-one-go-2026-11-13',
  version: '0.5.0-beta.1',
  date: '2026-11-14',
  title: 'More in one go.',
}

export const betaUpdate = {
  id: 'convert-beta',
  version: '0.3.0-beta.1',
  date: '2026-10-29',
  title: 'Hello, mewvi. A new name for your media.',
}

export const bugFixUpdate = {
  id: 'download-fixes-2026-10-30',
  version: '0.3.0-beta.2',
  date: '2026-10-30',
  title: 'Know your speed. Keep things moving.',
}

export const browserUpdate = {
  id: 'faster-downloads-2026-11-07',
  version: '0.4.0-beta.1',
  date: '2026-11-07',
  title: 'Less waiting. More mewvi.',
}

export const polishUpdate = {
  id: 'a-little-polish-2026-11-10',
  version: '0.4.0-beta.2',
  date: '2026-11-10',
  title: 'A little polish.',
}

export const servicesUpdate = {
  id: 'more-services-2026-11-11',
  version: '0.4.0-beta.3',
  date: '2026-11-11',
  title: 'More places to download.',
}

// Development milestones reconstructed from Git, rather than published releases.
export const convertArchive = [
  {
    id: 'convert-2026-09-08',
    version: 'Convert · 8 Sep',
    date: '2026-09-08',
    dateLabel: '8 September 2026',
    title: 'Links return. A new Clyvora look.',
    summary: 'Convert brought public SoundCloud links back into the app and adopted the Clyvora appearance that came before mewvi.',
    changes: [
      'Retrieve a public SoundCloud track, then add it to the conversion queue.',
      'A refreshed interface with dark and light themes, a remembered theme choice, and simpler format and quality controls.',
      'Broader input detection for AAC, M4A and MPEG transport stream files, alongside improvements to audio conversion.',
    ],
    commit: '62f0dabc0bcb64a4e4b0a45d175801138e1897a3',
  },
  {
    id: 'convert-2026-08-28',
    version: 'Convert · 28 Aug',
    date: '2026-08-28',
    dateLabel: '28 August 2026',
    title: 'A smaller focus: audio and video.',
    summary: 'Convert became a dedicated tool for converting local audio and video in the browser.',
    changes: [
      'Image conversion and link importing were removed from Convert, with those tasks directed to the separate Resize and Fetch projects.',
      'Local audio conversion, MP4 and WebM output, and extracting audio from video remained the core workflow.',
      'Selected files and filenames stayed on the device. Analytics and unused image, link-import and ZIP-export dependencies were removed.',
    ],
    commit: '0dc2de6918ad995ee89f4c8101fce451ee46880b',
  },
  {
    id: 'convert-2026-08-21',
    version: 'Convert · 21 Aug',
    date: '2026-08-21',
    dateLabel: '21 August 2026',
    title: 'Getting ready for the beta.',
    summary: 'The early converter received a round of reliability work ahead of its public beta.',
    changes: [
      'Versioned conversion-engine files and stricter caching helped prevent mismatched runtime files after an update.',
      'An offline reset action offered a way to clear cached runtime files when conversion stopped working.',
      'Automated checks covered the boundary between local conversion and link importing, alongside the existing image, audio and video workflow.',
    ],
    commit: '3bfc31b0c5763e044c9a4934466653bd956533b2',
  },
  {
    id: 'convert-2026-08-14',
    version: 'Convert · 14 Aug',
    date: '2026-08-14',
    dateLabel: '14 August 2026',
    title: 'Less clicking after conversion.',
    summary: 'The first follow-up work made it easier to get finished files out of Convert.',
    changes: [
      'Converted files started downloading automatically as each conversion finished.',
      'Public SoundCloud importing received connection and caching fixes, with imported media added to the queue for conversion.',
      'The interface, download handling and ZIP downloads were refined. Site navigation and product information were expanded, too.',
    ],
    commit: '5fc7ff0e89e1a7f1f316a5b0b5e41d37e13d4910',
  },
  {
    id: 'convert-2026-08-13',
    version: 'Convert · 13 Aug',
    date: '2026-08-13',
    dateLabel: '13 August 2026',
    title: 'Where Convert began.',
    summary: 'Before the cat and the mewvi name, there was Clyvora Convert: a browser-based converter for your own files.',
    changes: [
      'The first version converted PNG, JPG and WebP images, plus MP3 and WAV audio, directly on the device.',
      'That first day also added OGG and Opus audio, MP4 and WebM video, and a queue with settings and previews for individual files.',
      'Image sizing controls, saved preferences, progress and retry controls took shape alongside tests using the real browser conversion engine.',
    ],
    commit: '39e39a6',
  },
]

export type ConvertArchiveEntry = typeof convertArchive[number]
