import { useCallback } from 'react'

import type { FrameSampling } from '../lib/api'

/** Grab the current video frame, scaled down to `max_width` (never up), as a JPEG. */
export function useFrameCapture(video: HTMLVideoElement | null, sampling: FrameSampling | null) {
  const capture = useCallback((): Promise<Blob> => {
    if (!video) return Promise.reject(new Error('Camera preview is not available.'))
    if (!sampling) return Promise.reject(new Error('Frame settings have not loaded yet.'))
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return Promise.reject(new Error('There is no video frame yet. Wait for the preview to appear.'))
    }

    const scale = Math.min(1, sampling.max_width / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) return Promise.reject(new Error('Could not prepare the frame.'))
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the frame.'))),
        'image/jpeg',
        sampling.jpeg_quality,
      )
    })
  }, [video, sampling])

  return { capture }
}
