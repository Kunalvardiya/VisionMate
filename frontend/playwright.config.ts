import { defineConfig } from '@playwright/test'

// Uses the Edge already installed on Windows (Chromium-based), so no browser download is needed.
// Camera access is replaced by a canvas stream in e2e/fixtures.ts.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'msedge',
  },
  webServer: [
    {
      command: '.venv\\Scripts\\python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000',
      cwd: '../backend',
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  ],
})
