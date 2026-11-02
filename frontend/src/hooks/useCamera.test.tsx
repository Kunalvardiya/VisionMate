import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCamera } from './useCamera'

type Listener = () => void

function fakeTrack(deviceId = 'cam1') {
  const listeners = new Map<string, Set<Listener>>()
  const track = {
    readyState: 'live' as 'live' | 'ended',
    stop: vi.fn(() => {
      track.readyState = 'ended'
    }),
    getSettings: () => ({ deviceId }),
    addEventListener: (type: string, cb: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(cb)
    },
    removeEventListener: (type: string, cb: Listener) => listeners.get(type)?.delete(cb),
    emit: (type: string) => listeners.get(type)?.forEach((cb) => cb()),
  }
  return track
}
type FakeTrack = ReturnType<typeof fakeTrack>

const fakeStream = (tracks: FakeTrack[]) =>
  ({ getTracks: () => tracks, getVideoTracks: () => tracks }) as unknown as MediaStream

const device = (deviceId: string, label: string) =>
  ({ deviceId, label, kind: 'videoinput', groupId: '' }) as MediaDeviceInfo

let getUserMedia: ReturnType<typeof vi.fn>
let enumerateDevices: ReturnType<typeof vi.fn>
let deviceChange: Listener | null

beforeEach(() => {
  deviceChange = null
  getUserMedia = vi.fn(async () => fakeStream([fakeTrack()]))
  enumerateDevices = vi.fn(async () => [device('cam1', 'HP Camera'), device('cam2', 'USB Cam')])
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices,
      addEventListener: (_: string, cb: Listener) => (deviceChange = cb),
      removeEventListener: () => (deviceChange = null),
    },
  })
})

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
})

describe('useCamera', () => {
  it('does not call getUserMedia on mount', () => {
    renderHook(() => useCamera())
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('start turns the camera on and lists devices', async () => {
    const { result } = renderHook(() => useCamera())
    await act(() => result.current.start())
    expect(result.current.status).toBe('on')
    expect(result.current.stream).not.toBeNull()
    expect(result.current.devices.map((d) => d.label)).toEqual(['HP Camera', 'USB Cam'])
    expect(result.current.deviceId).toBe('cam1')
  })

  it('start twice calls getUserMedia once', async () => {
    const { result } = renderHook(() => useCamera())
    await act(async () => {
      await Promise.all([result.current.start(), result.current.start()])
    })
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('stop stops every track and returns to off', async () => {
    const track = fakeTrack()
    getUserMedia.mockResolvedValueOnce(fakeStream([track]))
    const { result } = renderHook(() => useCamera())
    await act(() => result.current.start())
    act(() => result.current.stop())
    expect(track.stop).toHaveBeenCalled()
    expect(result.current.status).toBe('off')
    expect(result.current.stream).toBeNull()
  })

  it('stop while requesting discards the stream when the request resolves', async () => {
    const track = fakeTrack()
    let resolve!: (s: MediaStream) => void
    getUserMedia.mockReturnValueOnce(new Promise<MediaStream>((r) => (resolve = r)))
    const { result } = renderHook(() => useCamera())
    let started!: Promise<void>
    act(() => {
      started = result.current.start()
    })
    expect(result.current.status).toBe('requesting')
    act(() => result.current.stop())
    await act(async () => {
      resolve(fakeStream([track]))
      await started
    })
    expect(track.stop).toHaveBeenCalled()
    expect(result.current.status).toBe('off')
    expect(result.current.stream).toBeNull()
  })

  it('switching device stops old tracks before opening the new stream', async () => {
    const first = fakeTrack('cam1')
    const second = fakeTrack('cam2')
    let stoppedBeforeSecond = -1
    getUserMedia
      .mockResolvedValueOnce(fakeStream([first]))
      .mockImplementationOnce(async (constraints: MediaStreamConstraints) => {
        stoppedBeforeSecond = first.stop.mock.calls.length
        expect(constraints.video).toMatchObject({ deviceId: { exact: 'cam2' } })
        return fakeStream([second])
      })
    const { result } = renderHook(() => useCamera())
    await act(() => result.current.start())
    await act(async () => result.current.setDeviceId('cam2'))
    await waitFor(() => expect(result.current.deviceId).toBe('cam2'))
    expect(stoppedBeforeSecond).toBeGreaterThan(0)
    expect(result.current.status).toBe('on')
  })

  it('switching device while a request is pending stops the stale stream', async () => {
    const stale = fakeTrack('cam1')
    const fresh = fakeTrack('cam2')
    let resolveFirst!: (s: MediaStream) => void
    getUserMedia
      .mockReturnValueOnce(new Promise<MediaStream>((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(fakeStream([fresh]))
    const { result } = renderHook(() => useCamera())
    let first!: Promise<void>
    act(() => {
      first = result.current.start()
    })
    await act(async () => result.current.setDeviceId('cam2'))
    await waitFor(() => expect(result.current.status).toBe('on'))
    await act(async () => {
      resolveFirst(fakeStream([stale]))
      await first
    })
    expect(stale.stop).toHaveBeenCalled()
    expect(fresh.stop).not.toHaveBeenCalled()
    expect(result.current.deviceId).toBe('cam2')
    expect(result.current.status).toBe('on')
  })

  it('unmount while a request is pending stops the stream when it resolves', async () => {
    const track = fakeTrack()
    let resolve!: (s: MediaStream) => void
    getUserMedia.mockReturnValueOnce(new Promise<MediaStream>((r) => (resolve = r)))
    const { result, unmount } = renderHook(() => useCamera())
    let started!: Promise<void>
    act(() => {
      started = result.current.start()
    })
    unmount()
    await act(async () => {
      resolve(fakeStream([track]))
      await started
    })
    expect(track.stop).toHaveBeenCalled()
  })

  it('track ended becomes an unplugged error and stops tracks', async () => {
    const track = fakeTrack()
    getUserMedia.mockResolvedValueOnce(fakeStream([track]))
    const { result } = renderHook(() => useCamera())
    await act(() => result.current.start())
    act(() => track.emit('ended'))
    expect(result.current.status).toBe('error')
    expect(result.current.error?.kind).toBe('unplugged')
    expect(track.stop).toHaveBeenCalled()
  })

  it('unmount stops all tracks', async () => {
    const track = fakeTrack()
    getUserMedia.mockResolvedValueOnce(fakeStream([track]))
    const { result, unmount } = renderHook(() => useCamera())
    await act(() => result.current.start())
    unmount()
    expect(track.stop).toHaveBeenCalled()
  })

  it('devicechange re-enumerates devices', async () => {
    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.devices).toHaveLength(2))
    enumerateDevices.mockResolvedValueOnce([device('cam1', 'HP Camera')])
    await act(async () => deviceChange?.())
    await waitFor(() => expect(result.current.devices).toHaveLength(1))
  })

  it('maps getUserMedia rejection to an error state', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'))
    const { result } = renderHook(() => useCamera())
    await act(() => result.current.start())
    expect(result.current.status).toBe('error')
    expect(result.current.error?.kind).toBe('permission-denied')
    expect(result.current.stream).toBeNull()
  })

  it('reports unsupported when mediaDevices is missing', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    const { result } = renderHook(() => useCamera())
    await act(() => result.current.start())
    expect(result.current.error?.kind).toBe('unsupported')
  })
})
