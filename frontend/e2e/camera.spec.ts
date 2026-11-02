import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

async function trackGetUserMedia(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __gumCalls: number }
    w.__gumCalls = 0
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = (constraints) => {
      w.__gumCalls++
      return original(constraints)
    }
  })
}

const videoWidth = (page: Page) =>
  page.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth)

/** Starts the camera and waits until the preview is actually delivering frames. */
const startCamera = async (page: Page) => {
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByRole('status')).toHaveText('Live')
  await expect.poll(() => videoWidth(page), { timeout: 10_000 }).toBeGreaterThan(0)
}

test('camera is not requested on page load', async ({ page }) => {
  await trackGetUserMedia(page)
  await page.goto('/camera')
  await expect(page.getByRole('status')).toHaveText('Off')
  expect(await page.evaluate(() => (window as unknown as { __gumCalls: number }).__gumCalls)).toBe(0)
})

test('start shows a live preview', async ({ page }) => {
  await page.goto('/camera')
  await startCamera(page)
  expect(await videoWidth(page)).toBeGreaterThan(0)
})

test('stop ends every camera track', async ({ page }) => {
  await page.goto('/camera')
  await startCamera(page)
  await page.evaluate(() => {
    const video = document.querySelector('video')!
    ;(window as unknown as { __track: MediaStreamTrack }).__track = (
      video.srcObject as MediaStream
    ).getVideoTracks()[0]
  })
  await page.getByRole('button', { name: 'Stop camera' }).click()
  await expect(page.getByRole('status')).toHaveText('Off')
  const state = await page.evaluate(() => (window as unknown as { __track: MediaStreamTrack }).__track.readyState)
  expect(state).toBe('ended')
})

test('permission denied shows guidance', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('denied', 'NotAllowedError'))
  })
  await page.goto('/camera')
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByRole('alert')).toContainText('Camera access was blocked')
  await expect(page.getByRole('status')).toHaveText('Error')
})

test('camera in use by another app shows guidance', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('busy', 'NotReadableError'))
  })
  await page.goto('/camera')
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByRole('alert')).toContainText('in use by another app')
})

test('frame link round trip reaches the real OpenCV backend', async ({ page }) => {
  await page.goto('/camera')
  await startCamera(page)
  const button = page.getByRole('button', { name: 'Test frame link' })
  await expect(button).toBeEnabled()
  await button.click()
  const result = page.getByTestId('frame-result')
  await expect(result).toContainText('Backend decoded')
  const text = (await result.textContent()) ?? ''
  const match = /decoded (\d+)×(\d+)/.exec(text)
  expect(match).not.toBeNull()
  expect(Number(match![1])).toBeLessThanOrEqual(640)
})

test('backend failure shows an error while the preview keeps running', async ({ page }) => {
  await page.route('**/api/frames/inspect', (route) => route.abort())
  await page.goto('/camera')
  await startCamera(page)
  await page.getByRole('button', { name: 'Test frame link' }).click()
  await expect(page.getByTestId('frame-error')).toContainText('backend')
  await expect(page.getByRole('status')).toHaveText('Live')
  expect(await videoWidth(page)).toBeGreaterThan(0)
})

test('a foreign origin cannot submit frames', async ({ request }) => {
  const response = await request.post('http://127.0.0.1:8000/api/frames/inspect', {
    headers: { Origin: 'https://evil.example', 'Content-Type': 'image/jpeg' },
    data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  })
  expect(response.status()).toBe(403)
})

test('camera keeps running when navigating to another page', async ({ page }) => {
  await page.goto('/camera')
  await startCamera(page)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('status')).toHaveText('Live')
})
