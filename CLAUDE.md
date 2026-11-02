# VisionMate — project guide

Windows AI webcam assistant. FastAPI backend (Python 3.13) + React/TypeScript frontend. Built phase by phase; see `docs/superpowers/specs/2026-11-02-visionmate-design.md` (design) and `docs/superpowers/plans/` (per-phase plans). **Current state: Phase 1 done. Do not start Phase 2 without the user asking.**

## Architecture

- Browser owns the camera (`getUserMedia`) and preview. Backend (OpenCV) only receives frames the frontend sends on demand, downscaled (`/api/frames/sampling`: 640px, quality 0.7, 5 fps max).
- Backend: `backend/app/{api,core,services}`. `api/` is thin routing; logic lives in `services/<name>/`; services never import each other or `api/`. Each future service (detection, scene, ocr, gestures, speech, translation, tts, assistant) is an interface plus swappable providers chosen by config.
- Frontend: `frontend/src/{pages,components,hooks,lib,state}`. `hooks/useCamera` (access), `components/CameraPreview` (preview), `hooks/useFrameCapture` + `lib/api` (frame transport) are independent.

## Rules

- Never call `getUserMedia` or the microphone except from a user click. Every exit path must stop all tracks.
- Backend binds `127.0.0.1`; `core/security.py` enforces Origin/Host allowlists. Keep POSTs requiring an allowed Origin.
- No frames or audio on disk by default. No secrets in code; `VISIONMATE_*` env vars / `.env` (git-ignored), `.env.example` committed.
- Unbuilt features must say "Not implemented yet — Phase N". No mock data, no dead buttons.
- Type-check strictly (pyright strict on `backend/app`, `tsc -b`). Write the failing test first.
- Do not claim something works unless it ran.

## Commands

```powershell
.\scripts\dev.ps1                                          # backend :8000 + frontend :5173
backend\.venv\Scripts\python -m pytest backend\tests       # backend tests
backend\.venv\Scripts\ruff check backend                   # lint
cd backend; .venv\Scripts\pyright                          # types
cd frontend; npm test                                      # unit tests (Vitest)
cd frontend; npx tsc -b                                    # types
cd frontend; npm run e2e                                   # Playwright on installed Edge, canvas camera stand-in
```

## Environment notes

- Default `python` on this machine is 3.14; the venv uses 3.13 (`py -3.13`).
- Edge's fake camera ends its track after ~2 s here, so e2e uses a canvas stream (`frontend/e2e/fixtures.ts`). Real camera = manual check.
- Context7 plugin needs authorizing via `/mcp` before use.
- Phase 2 will pick the YOLO runtime (prefer ONNX/onnxruntime over full torch for size); Phase 4 picks OCR (Tesseract is not installed).
