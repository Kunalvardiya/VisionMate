export type CameraErrorKind =
  | 'permission-denied'
  | 'no-device'
  | 'busy'
  | 'constraints'
  | 'unplugged'
  | 'unsupported'
  | 'unknown'

export interface CameraError {
  kind: CameraErrorKind
  message: string
}

export const UNPLUGGED_ERROR: CameraError = {
  kind: 'unplugged',
  message: 'The camera stopped sending video. Check that it is connected, then start it again.',
}

export const UNSUPPORTED_ERROR: CameraError = {
  kind: 'unsupported',
  message: 'This browser cannot access cameras. Open VisionMate in a current version of Chrome or Edge.',
}

export function mapMediaError(error: unknown): CameraError {
  const name = error instanceof DOMException || error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        kind: 'permission-denied',
        message:
          'Camera access was blocked. Allow it in the browser address bar, and check Windows Settings → Privacy & security → Camera.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        kind: 'no-device',
        message: 'No camera was found. Connect a camera and try again.',
      }
    case 'NotReadableError':
    case 'AbortError':
      return {
        kind: 'busy',
        message:
          'The camera is in use by another app, such as Teams, Zoom or Voicemod. Close it, then start the camera again.',
      }
    case 'OverconstrainedError':
      return {
        kind: 'constraints',
        message: 'The selected camera does not support the requested video size. Pick another camera.',
      }
    default:
      return { kind: 'unknown', message: 'The camera could not be started. Try again.' }
  }
}
