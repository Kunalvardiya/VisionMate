# VisionMate — Design Spec

Date: 2026-11-02 · Status: revised 2026-11-02 (browser camera + Python/OpenCV processing); awaiting user approval

## 1. Goal
A Windows desktop-class AI webcam assistant: object detection, scene Q&A, OCR, gestures, live speech translation. Runs on an ordinary CPU laptop; privacy-first; every service replaceable. Built in 7 phases; this spec fixes the overall architecture and details Phase 1.

## 2. Decisions (agreed)
- **Camera access and preview: browser (`getUserMedia`).** The React frontend opens the webcam and renders the live preview locally; preview frames never leave the browser. **Computer vision: Python/OpenCV in the backend**, fed by frames the frontend captures only when needed (snapshot, analysis request, or throttled sampling for detection/gestures), downscaled and JPEG-compressed before sending. Full-resolution frames are sent only for explicit snapshots/OCR where detail matters.
- Three independent, separately configurable concerns: **camera access** (frontend hook), **preview** (frontend component), **CV processing** (backend `FrameProcessor` pipeline).
- **Python 3.13** in a project venv (`backend/.venv`). 3.14 wheels also resolve, but 3.13 is the safer margin. Resolution of wheels was checked with pip dry-run only; nothing is verified to *run* until installed in the relevant phase.
- Stack: FastAPI + WebSockets, React + TypeScript + Vite + Tailwind, SQLAlchemy/SQLite (history off by default), Pydantic settings from environment / `.env`.
- CPU by default; GPU (RTX 4060) is an optional later setting.
- Desktop shell (Electron) deferred to Phase 7; until then the UI is served locally and opened in a browser.

## 3. Architecture
Backend packages under `backend/app/`:

| Package | Responsibility | Interface |
|---|---|---|
| `services/frames` | Decode/validate incoming JPEG with OpenCV, resize, hand to processors | `FrameProcessor` |
| `services/detection` | YOLO object detection (Phase 2) | `Detector` ABC |
| `services/scene` | Vision-LLM scene/Q&A via configurable provider (Phase 3) | `SceneProvider` ABC |
| `services/ocr` | Text recognition (Phase 4) | `OcrEngine` ABC |
| `services/gestures` | MediaPipe hands + gesture rules (Phase 6) | `GestureEngine` ABC |
| `services/speech` | STT, faster-whisper first (Phase 5) | `SpeechRecognizer` ABC |
| `services/translation` | Translation providers (Phase 5) | `Translator` ABC |
| `services/tts` | Text-to-speech (Phase 5) | `Synthesizer` ABC |
| `services/assistant` | Orchestrates snapshot + question → answer (Phase 3) | `AssistantService` |
| `api/` | Thin FastAPI routers; no business logic | — |
| `core/` | Shared types, settings, privacy state, security middleware | — |
| `db/` | SQLAlchemy models/session | — |

Rules: services never import each other or `api/`; the API layer wires them together. Each service has a fake/in-memory implementation used only in tests. Features can be switched off individually in settings.

Frontend: `pages/` (Dashboard, Camera, Assistant, Text, Gestures, Translator, Settings), `components/` (incl. `CameraPreview`), `hooks/` (incl. `useCamera`: permission, device list, start/stop, track-ended handling; `useFrameCapture`: downscale + JPEG encode via canvas), `lib/api`, `store/`.

Frame transport: `POST /api/frames/...` for on-demand requests (snapshot, analyze); a WebSocket with a latest-frame-wins, backpressure-aware sender (drop frames while the backend is busy) for later sampled streams (detection, gestures). Default sample size ~640px wide, quality ~0.7, configurable.

## 4. Privacy and security (applies from Phase 1)
- Camera/microphone start only from an explicit user click; `getUserMedia` is never called at page load. The browser's own permission prompt provides consent, and the camera tracks are stopped (LED off) on Stop.
- Status (`off | requesting | on | error`) is always visible in the UI; the backend only knows about frames it receives.
- Frames live only in memory on both sides; nothing is written to disk by default. Frames are sent to the backend only on explicit request or while a user-enabled analysis feature runs, and the UI shows when that is happening.
- Backend binds to `127.0.0.1` only. Because any web page can send requests to localhost, the API and WebSockets enforce an **Origin allowlist** (the app's own origin) and a Host check, defending against DNS rebinding and drive-by frame submission.
- API keys only via environment variables; `.env` is git-ignored; `.env.example` is committed.
- Any feature that sends data off-machine is labeled "Cloud" in the UI and requires a configured provider.

## 5. Phase 1 scope — foundation + live camera
Backend:
- `GET /api/health`.
- `POST /api/frames/inspect` — accepts a JPEG, decodes it with OpenCV, enforces size/type limits, returns real dimensions and decode time. This proves the frontend→OpenCV pipeline end to end without adding Phase 2 features; processors plug into `services/frames` later.
- Settings model for frame sampling (max width, JPEG quality, max fps) served from config.
- Origin/Host enforcement middleware.

Frontend:
- Vite + React + TS + Tailwind; dark theme default; app shell with the 7 nav items. Only Dashboard (camera/mic status cards) and Camera are functional; other pages show an explicit "Not implemented yet — Phase N" state. No fake data.
- `useCamera`: enumerate devices (labels appear after permission), start/stop with selected `deviceId`, ideal 1280×720 constraint, handle `NotAllowedError`, `NotFoundError`, `NotReadableError` (busy), `OverconstrainedError`, track `ended` (unplug), and `devicechange`.
- `useFrameCapture`: grab a downscaled JPEG from the video element; used by a dev-only status line showing last frame size/latency from `/api/frames/inspect` to verify the pipeline.
- Camera page: large preview, Start/Stop, device selector, status badge, error banner. Microphone status shows "Not enabled" until Phase 5.
- Visual design driven by the Frontend Design skill: premium dark UI, restrained motion, accessible contrast, responsive.

Testing:
- Backend (pytest): `/api/frames/inspect` with valid/corrupt/oversized/wrong-type input; Origin/Host rejection; health.
- Frontend: Playwright with Chromium's fake media device (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`) for start/stop, device select, permission-denied and device-unplugged states, and the frame-to-backend round trip; Vitest for `useCamera` error mapping.
- Real hardware smoke test on the HP camera in a real browser: the OS/browser permission prompt cannot be automated headlessly, so this is manual and reported as such.
- Pyright and `tsc` clean; code review at end of phase.

Out of scope for Phase 1: detection, AI, OCR, gestures, audio, history persistence, Electron.

## 6. Roadmap
Phase 2 detection + snapshots + scene description → 3 visual assistant + voice questions → 4 OCR → 5 speech translation → 6 gestures → 7 integration, optimization, Electron packaging. Each phase gets its own plan, tests, and code review; Security Guidance reviews Phases 3 and 5.

## 7. Open risks
- `getUserMedia` requires a secure context; `http://localhost` / `127.0.0.1` qualifies, so no TLS is needed in dev. The Electron shell (Phase 7) must grant media permission explicitly.
- Only one app can hold the camera at a time (Teams, Zoom, Voicemod may); the busy error must be clear.
- Torch/EasyOCR size; plan to prefer ONNX runtimes where quality allows (decide in Phases 2 and 4).
- Multiple virtual/IR camera devices ("Windows Virtual Camera Device") may appear in the device list; filter or label them.
- Context7 is not yet authorized; library APIs will be verified via docs/installed packages until it is.
