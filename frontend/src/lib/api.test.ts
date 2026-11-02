import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, getFrameSampling, inspectFrame } from './api'

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('api', () => {
  it('getFrameSampling parses the backend settings', async () => {
    mockFetch(async () => json({ max_width: 640, jpeg_quality: 0.7, max_fps: 5 }))
    await expect(getFrameSampling()).resolves.toEqual({ max_width: 640, jpeg_quality: 0.7, max_fps: 5 })
  })

  it('inspectFrame posts the raw JPEG with its content type', async () => {
    const fetchMock = mockFetch(async () => json({ width: 640, height: 360, bytes: 1000, decode_ms: 2.5 }))
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    const info = await inspectFrame(blob)
    expect(info).toEqual({ width: 640, height: 360, bytes: 1000, decode_ms: 2.5 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/frames/inspect')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('image/jpeg')
    expect(init?.body).toBe(blob)
  })

  it('throws ApiError carrying the backend detail on a non-2xx response', async () => {
    mockFetch(async () => json({ detail: 'JPEG data is truncated' }, 400))
    const error = await inspectFrame(new Blob(['x'])).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('JPEG data is truncated')
    expect((error as ApiError).status).toBe(400)
  })

  it('throws ApiError when the backend cannot be reached', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await inspectFrame(new Blob(['x'])).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toMatch(/backend/i)
  })
})
