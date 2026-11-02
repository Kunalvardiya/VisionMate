import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { UseCamera } from '../hooks/useCamera'
import { CameraContext } from '../state/CameraContext'
import { CameraPage } from './Camera'
import { Dashboard } from './Dashboard'

function fakeCamera(overrides: Partial<UseCamera> = {}): UseCamera {
  return {
    status: 'off',
    error: null,
    devices: [],
    deviceId: null,
    setDeviceId: vi.fn(),
    stream: null,
    start: vi.fn(async () => {}),
    stop: vi.fn(),
    ...overrides,
  }
}

const dev = (deviceId: string, label: string) =>
  ({ deviceId, label, kind: 'videoinput', groupId: '' }) as MediaDeviceInfo

function renderWith(camera: UseCamera, ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <CameraContext.Provider value={camera}>{ui}</CameraContext.Provider>
    </MemoryRouter>,
  )
}

describe('Camera page', () => {
  it('idle: offers Start and shows the camera is off', () => {
    renderWith(fakeCamera(), <CameraPage />)
    expect(screen.getByRole('button', { name: 'Start camera' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Stop camera' })).toBeNull()
    expect(screen.getByText('Camera off')).toBeInTheDocument()
  })

  it('clicking Start calls start', async () => {
    const camera = fakeCamera()
    renderWith(camera, <CameraPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Start camera' }))
    expect(camera.start).toHaveBeenCalledOnce()
  })

  it('requesting: Start is disabled and status says starting', () => {
    renderWith(fakeCamera({ status: 'requesting' }), <CameraPage />)
    expect(screen.getByRole('button', { name: /Starting/ })).toBeDisabled()
  })

  it('on: shows Stop, Live status and the device selector', async () => {
    const camera = fakeCamera({
      status: 'on',
      deviceId: 'a',
      devices: [dev('a', 'HP Camera'), dev('b', 'USB Cam')],
    })
    renderWith(camera, <CameraPage />)
    expect(screen.getByRole('button', { name: 'Stop camera' })).toBeEnabled()
    expect(screen.getByText('Live')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Camera' }), 'b')
    expect(camera.setDeviceId).toHaveBeenCalledWith('b')
  })

  it('names unlabeled devices Camera 1, Camera 2', () => {
    renderWith(
      fakeCamera({ devices: [dev('a', ''), dev('b', '')], deviceId: 'a' }),
      <CameraPage />,
    )
    expect(screen.getByRole('option', { name: 'Camera 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Camera 2' })).toBeInTheDocument()
  })

  it('busy error is announced with guidance', () => {
    renderWith(
      fakeCamera({
        status: 'error',
        error: { kind: 'busy', message: 'The camera is in use by another app, such as Teams.' },
      }),
      <CameraPage />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('in use by another app')
  })

  it('permission error is announced', () => {
    renderWith(
      fakeCamera({
        status: 'error',
        error: { kind: 'permission-denied', message: 'Camera access was blocked. Check Privacy.' },
      }),
      <CameraPage />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Privacy')
  })

  it('states that the microphone is not enabled yet', () => {
    renderWith(fakeCamera(), <CameraPage />)
    expect(screen.getByText(/Microphone/)).toHaveTextContent(/Phase 5/)
  })
})

describe('Dashboard', () => {
  it('reads camera status from the shared camera state', () => {
    renderWith(fakeCamera({ status: 'on' }), <Dashboard />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows the microphone as not enabled', () => {
    renderWith(fakeCamera(), <Dashboard />)
    expect(screen.getByText(/Microphone/)).toBeInTheDocument()
    expect(screen.getAllByText(/Not enabled/).length).toBeGreaterThan(0)
  })

  it('links to feature pages and labels unbuilt ones with their phase', () => {
    renderWith(fakeCamera(), <Dashboard />)
    expect(screen.getByRole('link', { name: /Live Translator/ })).toHaveAttribute('href', '/translator')
    expect(screen.getByRole('link', { name: /Live Translator/ })).toHaveTextContent('Phase 5')
  })
})
