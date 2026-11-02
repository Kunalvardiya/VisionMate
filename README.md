# VisionMate

An AI webcam assistant for Windows laptops: object detection, scene questions, text recognition, gestures and live speech translation. It is built in phases. **Only Phase 1 exists today.**

## Status

| Feature | Status |
|---|---|
| App shell, 7 pages, dark theme | Done |
| Live webcam preview, start/stop, camera picker | Done (Phase 1) |
| Frontend → OpenCV backend frame link | Done (Phase 1) |
| Object detection, scene description | Not implemented yet (Phase 2) |
| AI assistant, voice questions | Not implemented yet (Phase 3) |
| Text recognition | Not implemented yet (Phase 4) |
| Live translator | Not implemented yet (Phase 5) |
| Gesture control | Not implemented yet (Phase 6) |
| Settings, packaging | Not implemented yet (Phase 7) |

## How it works

The **browser** opens the webcam (`getUserMedia`) and shows the preview. **Python/OpenCV** in the backend only processes frames the frontend sends on request. Preview video never leaves the browser.

## Privacy

- The camera starts only when you click **Start camera**, and the browser asks permission. **Stop camera** turns it off.
- Nothing is recorded or saved to disk.
- A frame goes to the backend only when you click **Test frame link**. The backend runs on your own computer (`127.0.0.1`).
- The backend rejects requests from other websites (Origin and Host checks), so a web page cannot trigger it.
- No API keys are needed yet. Future keys go in environment variables (see `.env.example`), never in code.

## Requirements

- Windows 10/11, Python 3.13, Node.js 22+, Edge or Chrome.

## Setup

```powershell
py -3.13 -m venv backend\.venv
backend\.venv\Scripts\python -m pip install fastapi "uvicorn[standard]" pydantic-settings opencv-python-headless numpy pytest httpx ruff pyright
cd frontend
npm install
```

Versions this was built and tested with: FastAPI 0.162.0, Uvicorn 0.54.0, Starlette 1.10.0, OpenCV 5.0.0, NumPy 2.5.4, pydantic-settings 2.16.2; Vite 8, React 19, TypeScript 7, Tailwind 4, Vitest 5, Playwright 1.64.

## Run

```powershell
.\scripts\dev.ps1
```

Then open http://localhost:5173 and go to **Camera**.

## Test

```powershell
backend\.venv\Scripts\python -m pytest backend\tests
cd frontend
npm test
npm run e2e
```

`npm run e2e` starts the backend and frontend if they are not running and drives the installed Edge. It replaces the camera with a canvas stream, because Edge's built-in fake camera ended its own track after about 2 seconds on the development machine (reproduced without any VisionMate code). **The real webcam and the browser permission prompt are checked by hand**, not by automated tests.

## Known limits

- Only one app can use the camera at a time. If Teams, Zoom or Voicemod has it, VisionMate shows a "camera in use" message.
- Microphone features do not exist yet.
