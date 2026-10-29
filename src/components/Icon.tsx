export function Icon({ name }: { name: 'download' | 'convert' | 'settings' | 'about' | 'link' | 'arrow' | 'plus' | 'updates' }) {
  const paths = {
    updates: <><path d="M4 5v5h5M4.5 9A8 8 0 1 1 4 15"/><path d="M12 7v5l3 2"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 15v5h14v-5"/></>,
    convert: <><path d="M4 7h15l-4-4m5 14H5l4 4"/><path d="M20 7v4M4 17v-4"/></>,
    settings: <><path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></>,
    about: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
    link: <><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
