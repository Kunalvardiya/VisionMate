import { describe, expect, it } from 'vitest'

import { mapMediaError } from './cameraErrors'

const named = (name: string) => new DOMException('x', name)

describe('mapMediaError', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['NotFoundError', 'no-device'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['OverconstrainedError', 'constraints'],
  ])('maps %s to %s', (name, kind) => {
    expect(mapMediaError(named(name)).kind).toBe(kind)
  })

  it('names other apps in the busy message', () => {
    expect(mapMediaError(named('NotReadableError')).message).toMatch(/Teams|Zoom|another app/i)
  })

  it('points to Windows privacy settings when permission is denied', () => {
    expect(mapMediaError(named('NotAllowedError')).message).toMatch(/privacy/i)
  })

  it('falls back to unknown for unrecognised errors', () => {
    expect(mapMediaError(new Error('boom')).kind).toBe('unknown')
    expect(mapMediaError('weird').kind).toBe('unknown')
  })
})
