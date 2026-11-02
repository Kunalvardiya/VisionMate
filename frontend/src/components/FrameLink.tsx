import { useEffect, useState, type RefObject } from 'react'

import { useFrameCapture } from '../hooks/useFrameCapture'
import { getFrameSampling, inspectFrame, type FrameInfo, type FrameSampling } from '../lib/api'

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>
  enabled: boolean
}

type Result =
  | { kind: 'idle' }
  | { kind: 'ok'; info: FrameInfo; roundTripMs: number }
  | { kind: 'error'; message: string }

const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Frame test failed.')

/** Sends exactly one frame, only when the user asks, to prove the browser → OpenCV path works. */
export function FrameLink({ videoRef, enabled }: Props) {
  const [sampling, setSampling] = useState<FrameSampling | null>(null)
  const [result, setResult] = useState<Result>({ kind: 'idle' })
  const [busy, setBusy] = useState(false)
  // The <video> element is always mounted, so its ref is stable by the time the camera is on.
  const { capture } = useFrameCapture(videoRef.current, sampling)

  // Load frame settings from the backend; retry each time the camera is turned on.
  useEffect(() => {
    if (sampling) return
    let cancelled = false
    getFrameSampling()
      .then((value) => {
        if (!cancelled) setSampling(value)
      })
      .catch((e: unknown) => {
        if (!cancelled && enabled) setResult({ kind: 'error', message: messageOf(e) })
      })
    return () => {
      cancelled = true
    }
  }, [enabled, sampling])

  async function send() {
    setBusy(true)
    try {
      const frame = await capture()
      const started = performance.now()
      const info = await inspectFrame(frame)
      setResult({ kind: 'ok', info, roundTripMs: performance.now() - started })
    } catch (e) {
      setResult({ kind: 'error', message: messageOf(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-line flex flex-col gap-2 border-t pt-4 text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void send()}
          disabled={!enabled || !sampling || busy}
          className="border-line hover:bg-panel rounded-full border px-4 py-2 transition-colors disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Test frame link'}
        </button>
        <span className="text-muted">
          Sends one downscaled frame to the backend on this computer. Nothing is stored.
        </span>
      </div>
      {result.kind === 'ok' && (
        <p className="text-muted" data-testid="frame-result">
          Backend decoded {result.info.width}×{result.info.height} ({Math.round(result.info.bytes / 1024)} KB)
          in {result.info.decode_ms.toFixed(1)} ms. Round trip {Math.round(result.roundTripMs)} ms.
        </p>
      )}
      {result.kind === 'error' && (
        <p role="alert" className="text-danger" data-testid="frame-error">
          {result.message}
        </p>
      )}
    </div>
  )
}
