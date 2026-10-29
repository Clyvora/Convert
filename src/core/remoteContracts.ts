// Canonical contract. scripts/contracts.ts copies this file into the standalone frontend.
export const API_VERSION = 1;
export const containers = ['original', 'mp4', 'webm', 'mkv', 'mp3', 'm4a', 'opus', 'ogg', 'wav', 'flac'] as const;
export type Container = typeof containers[number];
export type Mode = 'combined' | 'audio' | 'video';
export type State = 'created' | 'queued' | 'downloading' | 'processing' | 'packaging' | 'ready' | 'partial' | 'failed' | 'cancelled' | 'interrupted' | 'expired';
export interface Output {
  mode: Mode; container: Container; preset: 'best' | 'smaller';
  height?: number; fps?: number; audioBitrate?: number; sampleRate?: number; channels?: number;
  language?: string; subtitle?: string; metadata?: boolean; chapters?: boolean; cover?: boolean;
  videoCodec?: 'source' | 'h264' | 'vp9' | 'av1';
  subtitleFormat?: 'embedded' | 'srt' | 'vtt';
}
export interface Format {
  id: string; ext: string; video: string | null; audio: string | null;
  width: number | null; height: number | null; fps: number | null; bitrate: number | null;
  sampleRate: number | null; channels: number | null; language: string | null;
  size: number | null; sizeKind: 'exact' | 'estimated' | 'unknown';
}
export interface Inspection {
  id: string; provider: string; mediaId: string; url: string; title: string; creator: string | null;
  duration: number | null; published: string | null; thumbnail: string | null;
  kind: 'media' | 'playlist' | 'channel' | 'profile' | 'post';
  count: number | null; countConfidence: 'exact' | 'estimated' | 'unknown';
  formats: Format[]; subtitles: string[]; restrictions: string[]; expires: number;
}
export interface Item { id: string; mediaId: string; provider: string; url: string; title: string; published?: string | null; state?: State; error?: ServiceError; artifactId?: string; subtitleArtifactId?: string }
export interface ServiceError { code: string; message: string; retryable: boolean; correlationId?: string; retryAfter?: number }
export interface Job {
  title?: string; deliveredAt?: number;
  id: string; state: State; created: number; expires: number; output: Output; total: number;
  completed: number; failed: number; bytes: number; totalBytes?: number; stage: string;
  artifactId?: string; error?: ServiceError;
}
export interface Discovery { id: string; state: string; count: number; outcome: string; error?: ServiceError; url?: string; lastJobId?: string }
export interface Page<T> { items: T[]; next: string | null }
export interface Capabilities { apiVersion: number; containers: Container[]; limits: { items: number; itemBytes: number; duration: number }; engine: string; enabledProviders: number; catalogMethod: string }

export const compatibility: Record<Exclude<Container, 'original'>, { kind: 'audio' | 'video'; video: string[]; audio: string[]; encoder: string; mime: string }> = {
  mp4: { kind: 'video', video: ['h264', 'avc1', 'hevc', 'hev1', 'hvc1', 'av01', 'av1'], audio: ['aac', 'mp4a', 'mp3'], encoder: 'libx264', mime: 'video/mp4' },
  webm: { kind: 'video', video: ['vp8', 'vp9', 'vp09', 'av01', 'av1'], audio: ['opus', 'vorbis'], encoder: 'libvpx-vp9', mime: 'video/webm' },
  mkv: { kind: 'video', video: ['*'], audio: ['*'], encoder: 'libx264', mime: 'video/x-matroska' },
  mp3: { kind: 'audio', video: [], audio: ['mp3'], encoder: 'libmp3lame', mime: 'audio/mpeg' },
  m4a: { kind: 'audio', video: [], audio: ['aac', 'mp4a'], encoder: 'aac', mime: 'audio/mp4' },
  opus: { kind: 'audio', video: [], audio: ['opus'], encoder: 'libopus', mime: 'audio/ogg' },
  ogg: { kind: 'audio', video: [], audio: ['vorbis'], encoder: 'libvorbis', mime: 'audio/ogg' },
  wav: { kind: 'audio', video: [], audio: ['pcm_s16le'], encoder: 'pcm_s16le', mime: 'audio/wav' },
  flac: { kind: 'audio', video: [], audio: ['flac'], encoder: 'flac', mime: 'audio/flac' },
};

export function parseOutput(value: unknown): Output {
  if (!value || typeof value !== 'object') throw new Error('Choose output settings.');
  const o = value as Output;
  const keys = new Set(['mode','container','preset','height','fps','audioBitrate','sampleRate','channels','language','subtitle','metadata','chapters','cover','videoCodec','subtitleFormat']);
  if (Object.keys(o).some(k => !keys.has(k)) || !['combined','audio','video'].includes(o.mode) || !containers.includes(o.container) || !['best','smaller'].includes(o.preset)) throw new Error('Invalid output settings.');
  if (o.container !== 'original' && (compatibility[o.container].kind === 'audio') !== (o.mode === 'audio')) throw new Error('Choose a container matching the media mode.');
  for (const [key, max] of [['height',16384],['fps',240],['audioBitrate',512],['sampleRate',192000],['channels',8]] as const) {
    const n = o[key]; if (n !== undefined && (!(key==='fps'?Number.isFinite(n):Number.isInteger(n)) || n < 1 || n > max)) throw new Error(`Invalid ${key}.`);
  }
  for (const key of ['language','subtitle'] as const) if (o[key] !== undefined && !/^[\w.-]{1,40}$/.test(o[key]!)) throw new Error(`Invalid ${key}.`);
  for (const key of ['metadata','chapters','cover'] as const) if (o[key] !== undefined && typeof o[key] !== 'boolean') throw new Error(`Invalid ${key}.`);
  if(o.videoCodec!==undefined&&!['source','h264','vp9','av1'].includes(o.videoCodec))throw new Error('Invalid video codec.');
  if(o.subtitleFormat!==undefined&&!['embedded','srt','vtt'].includes(o.subtitleFormat))throw new Error('Invalid subtitle format.');
  if(o.audioBitrate!==undefined&&![32,48,64,96,128,160,192,256,320].includes(o.audioBitrate))throw new Error('Choose a supported audio bitrate.');
  if(o.sampleRate!==undefined&&![8000,12000,16000,22050,24000,32000,44100,48000,88200,96000,176400,192000].includes(o.sampleRate))throw new Error('Choose a supported sample rate.');
  if(o.sampleRate!==undefined&&['opus','webm'].includes(o.container)&&![8000,12000,16000,24000,48000].includes(o.sampleRate))throw new Error('Opus requires an 8, 12, 16, 24 or 48 kHz sample rate. Choose 48 kHz.');
  if(o.container==='mp3'&&o.channels!==undefined&&o.channels>2)throw new Error('MP3 supports mono or stereo output.');
  return { ...o };
}
