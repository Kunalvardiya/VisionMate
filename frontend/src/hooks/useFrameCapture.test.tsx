import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFrameCapture } from './useFrameCapture'

const sampling = { max_width: 640, jpeg_quality: 0.7, max_fps: 5 }

let sizes: { width: number; height: number }[]
let toBlobArgs: { type?: string; quality?: number } | null

beforeEach(() => {
  sizes = []
  toBlobArgs = null
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
  } as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    sizes.push({ width: this.width, height: this.height })
    toBlobArgs = { type, quality }
    cb(new Blob(['jpeg'], { type: 'image/jpeg' }))
  })
})

afterEach(() => vi.restoreAllMocks())

function videoOf(width: number, height: number) {
  return { videoWidth: width, videoHeight: height } as HTMLVideoElement
}

describe('useFrameCapture', () => {
  it('downscales a 1920x1080 frame to max_width keeping the aspect ratio', async () => {
    const { result } = renderHook(() => useFrameCapture(videoOf(1920, 1080), sampling))
    const blob = await result.current.capture()
    expect(sizes[0]).toEqual({ width: 640, height: 360 })
    expect(toBlobArgs).toEqual({ type: 'image/jpeg', quality: 0.7 })
    expect(blob.type).toBe('image/jpeg')
  })

  it('never upscales a small frame', async () => {
    const { result } = renderHook(() => useFrameCapture(videoOf(320, 240), sampling))
    await result.current.capture()
    expect(sizes[0]).toEqual({ width: 320, height: 240 })
  })

  it('rejects when the video has no frame yet', async () => {
    const { result } = renderHook(() => useFrameCapture(videoOf(0, 0), sampling))
    await expect(result.current.capture()).rejects.toThrow(/no video frame/i)
  })

  it('rejects when there is no video element or settings are not loaded', async () => {
    const a = renderHook(() => useFrameCapture(null, sampling))
    await expect(a.result.current.capture()).rejects.toThrow()
    const b = renderHook(() => useFrameCapture(videoOf(640, 480), null))
    await expect(b.result.current.capture()).rejects.toThrow(/settings/i)
  })
})
