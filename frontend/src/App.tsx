import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { routes } from './routes'
import { CameraProvider } from './state/CameraContext'

export default function App() {
  const [router] = useState(() => createBrowserRouter(routes))
  return (
    <CameraProvider>
      <RouterProvider router={router} />
    </CameraProvider>
  )
}
