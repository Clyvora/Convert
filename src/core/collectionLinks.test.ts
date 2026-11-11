import { expect, it } from 'vitest'
import { youtubePlaylistURL } from './collectionLinks'

it.each([
  'https://www.youtube.com/watch?v=BaW_jenozKc&list=PLBB231211A4F62143&t=42',
  'https://music.youtube.com/watch?v=BaW_jenozKc&list=PLBB231211A4F62143',
  'https://youtu.be/BaW_jenozKc?list=PLBB231211A4F62143&si=tracking',
])('offers the public playlist separately from its video: %s', input => {
  expect(youtubePlaylistURL(input)).toBe('https://www.youtube.com/playlist?list=PLBB231211A4F62143')
})

it.each([
  'https://youtube.com/watch?v=BaW_jenozKc',
  'https://youtube.com/playlist?list=PLBB231211A4F62143',
  'https://youtube.com/watch?v=BaW_jenozKc&list=WL',
  'https://youtube.com.evil.example/watch?v=BaW_jenozKc&list=PLBB231211A4F62143',
  'https://user:password@youtube.com/watch?v=BaW_jenozKc&list=PLBB231211A4F62143',
  'https://youtube.com:8443/watch?v=BaW_jenozKc&list=PLBB231211A4F62143',
  'https://youtube.com/watch?v=BaW_jenozKc&list=PLBB231211A4F62143\nhttps://example.com',
  'not a link',
])('does not offer a playlist for unrelated, private, invalid or multiple links: %s', input => {
  expect(youtubePlaylistURL(input)).toBeNull()
})
