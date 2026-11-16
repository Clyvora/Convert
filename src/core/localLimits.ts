// Stay below the current runtime's signed 32-bit file-size boundary.
export const MAX_LOCAL_FILE_BYTES = 2 ** 31 - 1
export const LARGE_LOCAL_FILE_BYTES = 512 * 1024 ** 2

export function validateLocalFileSize(bytes: number): void {
  if(!Number.isSafeInteger(bytes)||bytes<1)throw new Error('Choose a non-empty audio or video file.')
  if(bytes>MAX_LOCAL_FILE_BYTES)throw new Error('Local conversion supports files smaller than 2 GB. Split this file into smaller parts before converting.')
}
