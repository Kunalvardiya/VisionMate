export interface FrameSampling {
  max_width: number
  jpeg_quality: number
  max_fps: number
}

export interface FrameInfo {
  width: number
  height: number
  bytes: number
  decode_ms: number
}

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new ApiError('Could not reach the VisionMate backend. Is it running?')
  }
  if (!response.ok) {
    let detail = `Backend returned ${response.status}`
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new ApiError(detail, response.status)
  }
  return response
}

export async function getFrameSampling(): Promise<FrameSampling> {
  return (await request('/api/frames/sampling')).json() as Promise<FrameSampling>
}

export async function inspectFrame(frame: Blob): Promise<FrameInfo> {
  const response = await request('/api/frames/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: frame,
  })
  return response.json() as Promise<FrameInfo>
}
