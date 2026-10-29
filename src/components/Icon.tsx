export function Icon({ name }: { name: 'download' | 'convert' | 'settings' | 'about' | 'link' | 'arrow' | 'plus' | 'updates' | 'auto' | 'audio' | 'video' }) {
  const paths = {
    auto: <><path d="m10 3 2.2 6.8L19 12l-6.8 2.2L10 21l-2.2-6.8L1 12l6.8-2.2L10 3Z"/><path d="M19 2v4m-2-2h4m-1 14v4m-2-2h4"/></>,
    audio: <><path d="M9 17V5l11-2v12M9 9l11-2"/><ellipse cx="6" cy="17.5" rx="3" ry="2.5"/><ellipse cx="17" cy="15.5" rx="3" ry="2.5"/></>,
    video: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/><path d="m10 9 4 3-4 3V9Z" strokeWidth="1.3"/></>,
    updates: <><path d="M4 5v5h5M4.5 9A8 8 0 1 1 4 15"/><path d="M12 7v5l3 2"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 15v5h14v-5"/></>,
    convert: <><path d="M4 7h15l-4-4m5 14H5l4 4"/><path d="M20 7v4M4 17v-4"/></>,
    settings: <><path d="M8.72 5.20Q9.15 4.95 9.38 4.51L10.12 3.09Q10.35 2.64 10.85 2.64L13.15 2.64Q13.65 2.64 13.88 3.09L14.62 4.51Q14.85 4.95 15.28 5.20L16.25 5.76Q16.68 6.01 17.18 5.99L18.78 5.92Q19.28 5.89 19.53 6.33L20.68 8.32Q20.93 8.75 20.66 9.17L19.80 10.52Q19.53 10.94 19.53 11.44L19.53 12.56Q19.53 13.06 19.80 13.48L20.66 14.83Q20.93 15.25 20.68 15.68L19.53 17.67Q19.28 18.11 18.78 18.08L17.18 18.01Q16.68 17.99 16.25 18.24L15.28 18.80Q14.85 19.05 14.62 19.49L13.88 20.91Q13.65 21.36 13.15 21.36L10.85 21.36Q10.35 21.36 10.12 20.91L9.38 19.49Q9.15 19.05 8.72 18.80L7.75 18.24Q7.32 17.99 6.82 18.01L5.22 18.08Q4.72 18.11 4.47 17.67L3.32 15.68Q3.07 15.25 3.34 14.83L4.20 13.48Q4.47 13.06 4.47 12.56L4.47 11.44Q4.47 10.94 4.20 10.52L3.34 9.17Q3.07 8.75 3.32 8.32L4.47 6.33Q4.72 5.89 5.22 5.92L6.82 5.99Q7.32 6.01 7.75 5.76Z"/><circle cx="12" cy="12" r="3.2"/></>,
    about: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
    link: <><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
