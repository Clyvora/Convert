export const IMAGE_OUTPUT_FORMATS = ['png', 'jpg', 'webp'] as const

export type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number]

export type ImageConversionPhase = 'decoding' | 'rendering' | 'encoding'

export interface ImageDimensions {
  readonly width: number
  readonly height: number
}

export interface ImageResizeOptions {
  readonly width?: number
  readonly height?: number
  readonly lockAspectRatio?: boolean
  readonly preventUpscale?: boolean
}

export interface ImageConversionOptions extends ImageResizeOptions {
  readonly outputFormat: ImageOutputFormat
  /** JPEG and WebP quality in the inclusive range 0–1. */
  readonly quality?: number
  /** An opaque #RGB or #RRGGBB color. Used only for JPEG output. */
  readonly jpgBackgroundColor?: string
  readonly signal?: AbortSignal
  readonly onProgress?: (phase: ImageConversionPhase) => void
}

export interface ImageConversionResult extends ImageDimensions {
  readonly blob: Blob
  readonly mimeType: ImageMimeType
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly usedOffscreenCanvas: boolean
}

export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp'

export interface ImageRenderPlan {
  readonly preserveTransparency: boolean
  readonly backgroundColor?: string
}
