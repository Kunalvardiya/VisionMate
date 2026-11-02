import { Link } from 'react-router-dom'

import { StatusBadge } from '../components/StatusBadge'
import { NAV_ITEMS } from '../lib/nav'
import { useCameraContext } from '../state/CameraContext'

const BLURBS: Record<string, string> = {
  '/camera': 'Live preview from your webcam.',
  '/assistant': 'Ask questions about what the camera sees.',
  '/text': 'Read text from documents and screens.',
  '/gestures': 'Control the app with your hands.',
  '/translator': 'Translate speech as you talk.',
  '/settings': 'Devices, models, languages and privacy.',
}

export function Dashboard() {
  const camera = useCameraContext()
  const features = NAV_ITEMS.filter((item) => item.path !== '/')

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">Welcome to VisionMate</h1>
        <p className="text-muted max-w-prose">
          Turn your laptop camera and microphone into a visual and voice assistant. Everything
          starts off and stays on this computer until you switch it on.
        </p>
      </header>

      <dl className="border-line grid grid-cols-1 gap-6 border-y py-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-muted text-sm">Camera</dt>
          <dd>
            <StatusBadge status={camera.status} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted text-sm">Microphone</dt>
          <dd className="text-sm">Not enabled. Arrives in Phase 5.</dd>
        </div>
      </dl>

      <ul className="grid gap-x-8 sm:grid-cols-2">
        {features.map((item) => (
          <li key={item.path} className="border-line border-b">
            <Link
              to={item.path}
              className="hover:bg-panel -mx-3 flex flex-col gap-0.5 rounded-lg px-3 py-4 transition-colors"
            >
              <span className="flex items-baseline justify-between gap-3 font-medium">
                {item.label}
                <span className="text-muted text-xs font-normal">
                  {item.phase === null ? 'Ready' : `Phase ${item.phase}`}
                </span>
              </span>
              <span className="text-muted text-sm">{BLURBS[item.path]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
