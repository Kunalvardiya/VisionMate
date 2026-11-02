import { useEffect, type RefObject } from 'react'

import type { CameraStatus } from '../hooks/useCamera'

interface Props {
  stream: MediaStream | null
  status: CameraStatus
  videoRef: RefObject<HTMLVideoElement | null>
}

const BRACKET = 'border-tally/70 absolute size-6'

/** Live preview inside a viewfinder frame. The video is mirrored for display only. */
export function CameraPreview({ stream, status, videoRef }: Props) {
  useEffect(() => {
    const video = videoRef.current
    if (video) video.srcObject = stream
  }, [stream, videoRef])

  return (
    <div className="bg-panel relative aspect-video w-full overflow-hidden rounded-2xl">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Live camera preview"
        className={`size-full -scale-x-100 object-cover ${stream ? '' : 'invisible'}`}
      />
      {!stream && (
        <div className="text-muted absolute inset-0 grid place-items-center text-center">
          <p>{status === 'requesting' ? 'Waiting for camera permission…' : 'Camera off'}</p>
        </div>
      )}
      <span className={`${BRACKET} top-4 left-4 rounded-tl-md border-t-2 border-l-2`} aria-hidden />
      <span className={`${BRACKET} top-4 right-4 rounded-tr-md border-t-2 border-r-2`} aria-hidden />
      <span className={`${BRACKET} bottom-4 left-4 rounded-bl-md border-b-2 border-l-2`} aria-hidden />
      <span className={`${BRACKET} right-4 bottom-4 rounded-br-md border-r-2 border-b-2`} aria-hidden />
    </div>
  )
}
