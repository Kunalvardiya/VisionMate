import type { CameraStatus } from '../hooks/useCamera'

const LABELS: Record<CameraStatus, string> = {
  off: 'Off',
  requesting: 'Starting',
  on: 'Live',
  error: 'Error',
}

/** The amber "tally" dot is reserved for a live camera, like the light on a studio camera. */
export function StatusBadge({ status }: { status: CameraStatus }) {
  const dot =
    status === 'on'
      ? 'bg-tally animate-[tally-pulse_2s_ease-in-out_infinite]'
      : status === 'requesting'
        ? 'bg-tally-dim'
        : status === 'error'
          ? 'bg-danger'
          : 'bg-line'
  return (
    <span className="inline-flex items-center gap-2 text-sm" role="status">
      <span className={`size-2.5 rounded-full ${dot}`} aria-hidden />
      {LABELS[status]}
    </span>
  )
}
