import type { RouteObject } from 'react-router-dom'

import { Shell } from './components/Shell'
import { Assistant } from './pages/Assistant'
import { CameraPage } from './pages/Camera'
import { Dashboard } from './pages/Dashboard'
import { Gestures } from './pages/Gestures'
import { Settings } from './pages/Settings'
import { TextRecognition } from './pages/TextRecognition'
import { Translator } from './pages/Translator'

export const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/camera', element: <CameraPage /> },
      { path: '/assistant', element: <Assistant /> },
      { path: '/text', element: <TextRecognition /> },
      { path: '/gestures', element: <Gestures /> },
      { path: '/translator', element: <Translator /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
]
