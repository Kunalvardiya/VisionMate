import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { routes } from './routes'

export default function App() {
  const [router] = useState(() => createBrowserRouter(routes))
  return <RouterProvider router={router} />
}
