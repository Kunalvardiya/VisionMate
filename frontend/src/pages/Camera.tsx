import { useRef } from 'react'

import { CameraPreview } from '../components/CameraPreview'
import { StatusBadge } from '../components/StatusBadge'
import { useCameraContext } from '../state/CameraContext'

export function CameraPage() {
  const camera = useCameraContext()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const running = camera.status === 'on'
  const starting = camera.status === 'requesting'

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-5">
      <header className="flex items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Camera</h1>
        <StatusBadge status={camera.status} />
      </header>

      <CameraPreview stream={camera.stream} status={camera.status} videoRef={videoRef} />

      {camera.error && (
        <p role="alert" className="border-danger text-danger border-l-2 pl-4 text-sm leading-relaxed">
          {camera.error.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {running ? (
          <button
            type="button"
            onClick={camera.stop}
            className="bg-raised hover:bg-line rounded-full px-6 py-2.5 font-medium transition-colors"
          >
            Stop camera
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void camera.start()}
            disabled={starting}
            className="bg-tally text-ink rounded-full px-6 py-2.5 font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {starting ? 'Starting…' : 'Start camera'}
          </button>
        )}

        {camera.devices.length > 0 && (
          <label className="text-muted flex items-center gap-2 text-sm">
            Camera
            <select
              value={camera.deviceId ?? ''}
              onChange={(e) => camera.setDeviceId(e.target.value)}
              className="bg-panel text-text border-line rounded-lg border px-3 py-2"
            >
              {camera.deviceId === null && <option value="">Default camera</option>}
              {camera.devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="text-muted text-sm">
        Microphone: not enabled yet. Voice features arrive in Phase 5.
      </p>
      <p className="text-muted text-sm">
        Video stays in your browser. Nothing is recorded or sent anywhere unless you ask for it.
      </p>
    </section>
  )
}
