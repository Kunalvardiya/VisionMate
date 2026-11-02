import { test as base, expect } from '@playwright/test'

/**
 * Chromium's built-in fake camera ends its own track ~2s after starting on this setup
 * (reproduced with a bare getUserMedia call, independent of VisionMate). So e2e tests
 * replace getUserMedia with a canvas-backed MediaStream. Real-camera behaviour is checked manually.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 1280
        canvas.height = 720
        const ctx = canvas.getContext('2d')!
        let n = 0
        const draw = () => {
          ctx.fillStyle = `hsl(${(n++ * 3) % 360} 60% 40%)`
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = '#fff'
          ctx.font = '64px sans-serif'
          ctx.fillText(`test frame ${n}`, 80, 360)
        }
        draw()
        setInterval(draw, 66)
        return canvas.captureStream(15)
      }
    })
    await use(page)
  },
})

export { expect }
