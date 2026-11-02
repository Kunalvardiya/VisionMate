import { useCallback, useEffect, useRef, useState } from 'react'

import {
  mapMediaError,
  UNPLUGGED_ERROR,
  UNSUPPORTED_ERROR,
  type CameraError,
} from '../lib/cameraErrors'

export type CameraStatus = 'off' | 'requesting' | 'on' | 'error'

export interface UseCamera {
  status: CameraStatus
  error: CameraError | null
  devices: MediaDeviceInfo[]
  deviceId: string | null
  setDeviceId: (id: string) => void
  stream: MediaStream | null
  start: () => Promise<void>
  stop: () => void
}

/**
 * Browser camera access. getUserMedia is only ever called from start() or a
 * device switch, never on mount. Every code path that ends a session stops all
 * tracks so the camera light goes off.
 */
export function useCamera(): UseCamera {
  const [status, setStatusState] = useState<CameraStatus>('off')
  const [error, setError] = useState<CameraError | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceIdState] = useState<string | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // Refs mirror state so overlapping calls (double click, stop mid-request) see the truth synchronously.
  const statusRef = useRef<CameraStatus>('off')
  const streamRef = useRef<MediaStream | null>(null)
  const requestRef = useRef(0)
  const endedCleanupRef = useRef<(() => void) | null>(null)

  const setStatus = useCallback((next: CameraStatus) => {
    statusRef.current = next
    setStatusState(next)
  }, [])

  const rememberDevice = useCallback((id: string | null) => {
    deviceIdRef.current = id
    setDeviceIdState(id)
  }, [])

  const release = useCallback(() => {
    endedCleanupRef.current?.()
    endedCleanupRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const refreshDevices = useCallback(async () => {
    const media = navigator.mediaDevices
    if (!media?.enumerateDevices) return
    try {
      const all = await media.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'videoinput'))
    } catch {
      // Listing devices is best-effort; the camera itself still works.
    }
  }, [])

  const open = useCallback(
    async (id: string | null) => {
      const request = ++requestRef.current
      release()
      setStream(null)
      setError(null)

      const media = navigator.mediaDevices
      if (!media?.getUserMedia) {
        setError(UNSUPPORTED_ERROR)
        setStatus('error')
        return
      }
      setStatus('requesting')

      let next: MediaStream
      try {
        next = await media.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            ...(id ? { deviceId: { exact: id } } : {}),
          },
        })
      } catch (e) {
        if (request !== requestRef.current) return
        setError(mapMediaError(e))
        setStatus('error')
        return
      }

      if (request !== requestRef.current) {
        next.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = next
      const tracks = next.getTracks()
      const onEnded = () => {
        if (streamRef.current !== next) return
        release()
        setStream(null)
        setError(UNPLUGGED_ERROR)
        setStatus('error')
      }
      tracks.forEach((track) => track.addEventListener('ended', onEnded))
      endedCleanupRef.current = () =>
        tracks.forEach((track) => track.removeEventListener('ended', onEnded))

      setStream(next)
      rememberDevice(id ?? tracks[0]?.getSettings().deviceId ?? null)
      setStatus('on')
      await refreshDevices()
    },
    [refreshDevices, release, rememberDevice, setStatus],
  )

  const start = useCallback(async () => {
    if (statusRef.current === 'on' || statusRef.current === 'requesting') return
    await open(deviceIdRef.current)
  }, [open])

  const stop = useCallback(() => {
    requestRef.current++
    release()
    setStream(null)
    setError(null)
    setStatus('off')
  }, [release, setStatus])

  const setDeviceId = useCallback(
    (id: string) => {
      rememberDevice(id)
      if (statusRef.current === 'on' || statusRef.current === 'requesting') void open(id)
    },
    [open, rememberDevice],
  )

  useEffect(() => {
    void refreshDevices()
    const media = navigator.mediaDevices
    const onChange = () => void refreshDevices()
    media?.addEventListener?.('devicechange', onChange)
    return () => {
      media?.removeEventListener?.('devicechange', onChange)
      requestRef.current++
      release()
    }
  }, [refreshDevices, release])

  return { status, error, devices, deviceId, setDeviceId, stream, start, stop }
}
