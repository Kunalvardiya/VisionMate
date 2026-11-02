import { createContext, useContext, type ReactNode } from 'react'

import { useCamera, type UseCamera } from '../hooks/useCamera'

export const CameraContext = createContext<UseCamera | null>(null)

/** Holds the one camera session so it survives page navigation and the Dashboard can read its status. */
export function CameraProvider({ children }: { children: ReactNode }) {
  const camera = useCamera()
  return <CameraContext.Provider value={camera}>{children}</CameraContext.Provider>
}

export function useCameraContext(): UseCamera {
  const value = useContext(CameraContext)
  if (!value) throw new Error('useCameraContext must be used inside <CameraProvider>')
  return value
}
