export const services = [
  { name: 'SoundCloud', id: 'soundcloud', icon: 'soundcloud', category: 'music', collection: true, links: ['Tracks', 'Playlists', 'Albums'], detail: 'Public audio tracks and sets. No private or subscriber-only audio.' },
  { name: 'YouTube', id: 'youtube', icon: 'youtube', category: 'video', collection: true, links: ['Videos', 'Shorts', 'Playlists'], detail: 'Public video and audio. Pick playlist items first. Tools can scan a channel’s Shorts and save a ZIP.' },
  { name: 'Spotify', id: 'spotify', icon: 'spotify', category: 'music', collection: false, links: ['Track links'], detail: 'Matches audio on YouTube. No Spotify albums or playlists.' },
  { name: 'Instagram', id: 'instagram', icon: 'instagram', category: 'video', collection: true, links: ['Video posts', 'Reels', 'Photos & carousels in Tools'], detail: 'Public video and audio. Use Tools for original photos, mixed carousels and accessible profile ZIPs. Profile access is limited; private and sign-in-required posts are unsupported.' },
  { name: 'TikTok', id: 'tiktok', icon: 'tiktok', category: 'video', collection: false, links: ['Video posts'], detail: 'Public videos. Photo slideshows and live streams are not supported.' },
  { name: 'X / Twitter', id: 'twitter', icon: 'x', category: 'video', collection: true, links: ['Video posts', 'Multi-video posts'], detail: 'Public videos. Pick individual clips from multi-video posts. Protected posts and image-only posts are not supported.' },
  { name: 'Facebook', id: 'facebook', icon: 'facebook', category: 'video', collection: false, links: ['Video posts', 'Reels'], detail: 'Public videos and reels. Some public links may fail when Facebook changes access. No private groups or sign-in-required videos.' },
  { name: 'Twitch', id: 'twitch', icon: 'twitch', category: 'video', collection: false, links: ['Clips'], detail: 'Public clips. Live streams and subscriber-only videos are not supported.' },
  { name: 'Bluesky', id: 'bluesky', icon: 'bluesky', category: 'video', collection: false, links: ['Video posts'], detail: 'Public videos playable without signing in. No image-only posts.' },
  { name: 'Pinterest', id: 'pinterest', icon: 'pinterest', category: 'video', collection: false, links: ['Video pins'], detail: 'Public video pins. Image-only pins are not supported.' },
  { name: 'Streamable', id: 'streamable', icon: 'streamable', category: 'video', collection: false, links: ['Clips'], detail: 'Public video clips that play without signing in.' },
  { name: 'Dailymotion', id: 'dailymotion', icon: 'dailymotion', category: 'video', collection: false, links: ['Videos'], detail: 'Public videos. Availability can vary by region.' },
  { name: 'Bandcamp', id: 'bandcamp', icon: 'bandcamp', category: 'music', collection: true, links: ['Tracks', 'Albums'], detail: 'Publicly playable audio. No paid downloads or private tracks.' },
  { name: 'Imgur', id: 'imgur', icon: 'imgur', category: 'video', collection: true, links: ['Video posts', 'GIF clips', 'Video albums'], detail: 'Public videos and animated clips. Pick video items from albums; still images are excluded. Auto handles silent clips in collections.' },
  { name: '9GAG', id: '9gag', icon: '9gag', category: 'video', collection: false, links: ['Video posts'], detail: 'Public video posts. Image-only posts are not supported.' },
  { name: 'Vimeo', id: 'vimeo', icon: 'vimeo', category: 'video', collection: false, links: ['Public videos', 'Player links'], detail: 'Public videos and audio where Vimeo allows anonymous playback. Some links require sign-in. Private, password-protected and paid videos are unsupported.' },
  { name: 'TED', id: 'ted', icon: 'ted', category: 'video', collection: false, links: ['Talks'], detail: 'Public TED talks as video or audio. Source quality and subtitle availability vary by talk.' },
  { name: 'Audius', id: 'audius', icon: 'audius.webp', category: 'music', collection: false, links: ['Tracks'], detail: 'Publicly streamable audio tracks. Paid, gated tracks and playlist downloads are not supported.' },
  { name: 'Internet Archive', id: 'archiveorg', icon: 'internetarchive', category: 'video', collection: true, links: ['Media files', 'File collections'], detail: 'Public audio and video items. Choose files from collections; use Audio for audio-only collections. Restricted borrowing, accounts and non-media files are unsupported.' },
  { name: 'Wikimedia Commons', id: 'wikimedia', icon: 'wikimediacommons', category: 'video', collection: false, links: ['Media file pages'], detail: 'Public video and audio from Commons File pages. Image-only pages and article pages are unsupported. Check the source’s reuse licence.' },
] as const

export function serviceIconPath(icon:string) {
  return `/platforms/${icon.includes('.')?icon:icon+'.svg'}`
}
