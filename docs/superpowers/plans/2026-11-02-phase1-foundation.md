# VisionMate Phase 1 — Foundation and Live Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running FastAPI + React app where the user starts/stops the webcam in the browser, sees a live preview, and the frontend can send a downscaled JPEG frame to a real OpenCV-backed backend endpoint.

**Architecture:** The browser owns camera access (`getUserMedia`) and preview. The backend (Python 3.13, FastAPI) never touches the camera; it decodes frames the frontend sends via `POST /api/frames/inspect` and enforces localhost-only Origin/Host rules. Camera access, preview and frame processing are separate modules.

**Tech Stack:** Python 3.13, FastAPI, uvicorn, pydantic-settings, opencv-python-headless, numpy, pytest, httpx, ruff, pyright · React, TypeScript, Vite, Tailwind CSS, react-router, lucide-react, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-02-visionmate-design.md`

## Global Constraints

- Python 3.13 venv at `backend/.venv`; no GPU dependency; CPU only.
- Backend binds `127.0.0.1` only; API and WS enforce Origin allowlist (`http://localhost:5173`, `http://127.0.0.1:5173`, configurable) and Host allowlist (`localhost`, `127.0.0.1`, any port).
- `getUserMedia` is never called at page load, only from a user click; Stop must stop every track.
- Frames are never written to disk; no secrets in code; `.env` git-ignored, `.env.example` committed.
- Frame sampling defaults: `max_width=640`, `jpeg_quality=0.7`, `max_fps=5`, served from backend config.
- Dark theme default; the 7 nav items are Dashboard, Camera, AI Assistant, Text Recognition, Gesture Control, Live Translator, Settings. Unbuilt pages show "Not implemented yet — Phase N". No fake data, no dead buttons.
- Versions: install current stable releases, then record the exact versions installed in the README (Context7 is unauthorized; confirm APIs against installed package docs/types, not memory).
- Commits are part of each task; the user approves this plan, which includes them.

## Review Focus

1. Zero-byte, truncated, or non-JPEG bytes sent as `image/jpeg` → 400 with a message, never a 500. (Task 2)
2. A tiny JPEG that declares a huge size (e.g. 30000×30000) must be rejected before decoding, not exhaust memory. (Task 2)
3. Clicking Start twice, switching device while running, pressing Stop while "requesting", or leaving the page must never leave a live track (camera LED on). (Task 4)
4. Camera busy (Teams/Zoom/Voicemod) vs permission denied vs no camera show distinct, actionable messages; device labels are empty before permission and must still list sensibly. (Task 4, 5)
5. Backend not running or returning an error → the frame status line shows an error; the preview keeps working. (Task 6)

---

### Task 1: Backend scaffold, config, health, Origin/Host guard

**Files:**
- Create: `.gitignore`, `.env.example`, `backend/pyproject.toml`, `backend/app/__init__.py`, `backend/app/main.py`, `backend/app/config.py`, `backend/app/core/security.py`, `backend/app/api/health.py`, `backend/tests/conftest.py`, `backend/tests/test_security.py`, `backend/tests/test_health.py`

**Interfaces:**
- Produces: `Settings` (pydantic-settings; fields `allowed_origins: list[str]`, `allowed_hosts: list[str]`, `max_frame_bytes: int = 2_000_000`, `max_frame_side: int = 4096`, `frame_max_width: int = 640`, `frame_jpeg_quality: float = 0.7`, `frame_max_fps: int = 5`); `get_settings() -> Settings` (cached); `create_app(settings: Settings | None = None) -> FastAPI`; `GuardMiddleware` in `core/security.py`; router `api/health.py` exposing `GET /api/health` → `{"status": "ok", "version": str}`.

- [ ] **Step 1:** `git init` in the project root; create `.gitignore` (venv, `node_modules`, `.env`, `__pycache__`, `dist`, `*.sqlite`, Playwright output) and `.env.example`; create venv: `py -3.13 -m venv backend/.venv`; install deps into it and declare them in `backend/pyproject.toml` (include pytest config `testpaths=["tests"]`, ruff, pyright `typeCheckingMode="strict"` for `app/`).
- [ ] **Step 2: Write failing tests** in `test_security.py` using `TestClient` against `create_app()`:
  - `test_allowed_origin_passes`: `GET /api/health` with `Origin: http://localhost:5173` → 200.
  - `test_foreign_origin_rejected`: `Origin: https://evil.example` → 403.
  - `test_no_origin_passes_for_get`: no Origin header → 200 (curl/Playwright server-side checks).
  - `test_post_without_origin_rejected`: `POST /api/health` equivalent guard check on any POST route with no Origin → 403 (state-changing requests must carry an allowed Origin).
  - `test_bad_host_rejected`: `Host: attacker.example` → 400/403 (DNS rebinding).
  - `test_health_ok` in `test_health.py`.
- [ ] **Step 3:** Run `backend/.venv/Scripts/python -m pytest backend/tests -v`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement the interfaces above. `GuardMiddleware` is a pure ASGI/Starlette middleware that checks Host hostname (port ignored) against `allowed_hosts`, Origin (if present) against `allowed_origins`, and rejects POST/PUT/PATCH/DELETE lacking Origin. Register it in `create_app`; no wildcard CORS.
- [ ] **Step 5:** Run tests → PASS; run `ruff check backend` and `backend/.venv/Scripts/pyright backend/app` → clean.
- [ ] **Step 6:** Commit `feat(backend): scaffold app with health endpoint and origin/host guard`.

### Task 2: Frame inspect endpoint (OpenCV) and sampling config

**Files:**
- Create: `backend/app/services/__init__.py`, `backend/app/services/frames/__init__.py`, `backend/app/services/frames/decoder.py`, `backend/app/api/frames.py`, `backend/tests/test_frames.py`
- Modify: `backend/app/main.py` (include router)

**Interfaces:**
- Consumes: `Settings`, `create_app` from Task 1.
- Produces: `decode_jpeg(data: bytes, max_side: int) -> DecodedFrame` where `DecodedFrame` is a dataclass `(image: np.ndarray, width: int, height: int)`, raising `FrameError(status: int, message: str)`; `jpeg_dimensions(data: bytes) -> tuple[int, int]` reading the SOF header without decoding. Endpoints: `POST /api/frames/inspect` (raw body, `Content-Type: image/jpeg`) → `{"width": int, "height": int, "bytes": int, "decode_ms": float}`; `GET /api/frames/sampling` → `{"max_width": 640, "jpeg_quality": 0.7, "max_fps": 5}`.

- [ ] **Step 1: Write failing tests** in `test_frames.py` (generate JPEGs in the test with `cv2.imencode` on a numpy array; send with an allowed Origin header):
  - `test_valid_jpeg_returns_dimensions`: 320×240 → 200, `width==320`, `height==240`, `decode_ms>=0`.
  - `test_empty_body_400`, `test_truncated_jpeg_400` (cut valid bytes in half), `test_random_bytes_400`.
  - `test_png_bytes_with_jpeg_header_400` (PNG data labeled image/jpeg).
  - `test_wrong_content_type_415` (`image/png`, `text/plain`).
  - `test_oversized_body_413` (> `max_frame_bytes`).
  - `test_declared_huge_dimensions_413`: build a minimal valid JPEG header whose SOF declares 30000×30000 (patch the SOF width/height bytes of a small JPEG); assert 413 and that `cv2.imdecode` is not called (monkeypatch it to raise).
  - `test_sampling_defaults`: matches the Global Constraints values.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `jpeg_dimensions` (walk markers to the first SOFn), check dimensions against `max_frame_side` before `cv2.imdecode`, map failures to `FrameError`; router converts `FrameError` to JSON error `{"detail": message}`. Read the body with a size cap (stop reading past `max_frame_bytes`).
- [ ] **Step 4:** Run tests → PASS; ruff and pyright clean.
- [ ] **Step 5:** Commit `feat(backend): add OpenCV frame inspect endpoint and sampling config`.

### Task 3: Frontend scaffold and app shell

**Files:**
- Create: `frontend/` via Vite React-TS template; `frontend/vite.config.ts` (proxy `/api` → `http://127.0.0.1:8000`, `changeOrigin: false`; Vitest config), `frontend/src/main.tsx`, `src/App.tsx`, `src/components/Shell.tsx`, `src/components/NotImplemented.tsx`, `src/pages/{Dashboard,Camera,Assistant,TextRecognition,Gestures,Translator,Settings}.tsx`, `src/index.css`, `src/lib/nav.ts`, `frontend/src/components/Shell.test.tsx`

**Interfaces:**
- Produces: `NAV_ITEMS: {path: string; label: string; phase: number | null}[]` (7 entries, `phase` null for built pages: Dashboard, Camera, Settings shows its phase); `<Shell>` (sidebar + outlet, router via react-router `createBrowserRouter`); `<NotImplemented title: string; phase: number />`.

- [ ] **Step 1:** Invoke the **frontend-design** skill and choose a distinct visual direction (premium dark, restrained motion, accessible contrast, responsive collapse of the sidebar on narrow widths). Record the palette/type tokens in `src/index.css` as CSS variables used by Tailwind.
- [ ] **Step 2:** Scaffold Vite React-TS, add Tailwind (Vite plugin), react-router, lucide-react, Vitest + Testing Library. `npm run dev` serves on port 5173 (`strictPort`).
- [ ] **Step 3: Write failing test** `Shell.test.tsx`: renders all 7 labels from `NAV_ITEMS`; navigating to the Assistant route shows text "Not implemented yet" and "Phase 3"; nav links are keyboard-focusable with an accessible current-page indicator (`aria-current="page"`).
- [ ] **Step 4:** Run `npm test` → FAIL; implement shell, nav, placeholder pages (Assistant→3, Text Recognition→4, Gestures→6, Translator→5, Settings→7); Dashboard and Camera are filled in Task 5, so give them minimal headings only.
- [ ] **Step 5:** `npm test`, `npx tsc --noEmit`, `npm run build` → all clean.
- [ ] **Step 6:** Commit `feat(frontend): scaffold app shell with navigation`.

### Task 4: `useCamera` hook and error mapping

**Files:**
- Create: `frontend/src/hooks/useCamera.ts`, `frontend/src/lib/cameraErrors.ts`, `frontend/src/lib/cameraErrors.test.ts`, `frontend/src/hooks/useCamera.test.tsx`

**Interfaces:**
- Produces:
  - `type CameraStatus = 'off' | 'requesting' | 'on' | 'error'`
  - `type CameraErrorKind = 'permission-denied' | 'no-device' | 'busy' | 'constraints' | 'unplugged' | 'unsupported' | 'unknown'`
  - `interface CameraError { kind: CameraErrorKind; message: string }`
  - `mapMediaError(e: unknown): CameraError` — `NotAllowedError`→permission-denied, `NotFoundError`→no-device, `NotReadableError`/`AbortError`→busy (message names Teams/Zoom/other apps), `OverconstrainedError`→constraints, missing `navigator.mediaDevices`→unsupported.
  - `useCamera(): { status: CameraStatus; error: CameraError | null; devices: MediaDeviceInfo[]; deviceId: string | null; setDeviceId(id: string): void; stream: MediaStream | null; start(): Promise<void>; stop(): void }`

- [ ] **Step 1: Write failing tests.** `cameraErrors.test.ts`: one case per DOMException name above plus a non-DOMException → `unknown`. `useCamera.test.tsx` with a mocked `navigator.mediaDevices` (`getUserMedia`, `enumerateDevices`, `addEventListener('devicechange')`) and fake tracks:
  - `does not call getUserMedia on mount`.
  - `start → status on, stream set, devices listed after start`.
  - `start twice calls getUserMedia once and leaves one live stream`.
  - `stop stops every track and returns to off`.
  - `stop while requesting discards the stream when the request resolves` (no live track afterwards).
  - `switching deviceId while on stops old tracks before opening the new stream`.
  - `track ended event → status error kind unplugged, tracks stopped`.
  - `unmount stops all tracks`.
  - `devicechange re-enumerates devices`.
  - `rejection maps through mapMediaError and sets status error`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Request video-only, `{width:{ideal:1280}, height:{ideal:720}, deviceId: {exact}}` when a device is selected; track the latest request with a counter to resolve the stop-while-requesting race; devices with empty labels are shown as "Camera 1", "Camera 2".
- [ ] **Step 4:** Run tests, `tsc` → clean.
- [ ] **Step 5:** Commit `feat(frontend): add useCamera hook with error mapping`.

### Task 5: Camera page, preview component, Dashboard status

**Files:**
- Create: `frontend/src/components/CameraPreview.tsx`, `frontend/src/components/StatusBadge.tsx`, `frontend/src/state/CameraContext.tsx`, `frontend/src/pages/Camera.test.tsx`
- Modify: `frontend/src/pages/Camera.tsx`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/App.tsx` (provider)

**Interfaces:**
- Consumes: `useCamera` (Task 4), `NotImplemented`, `Shell` (Task 3).
- Produces: `<CameraProvider>` exposing the `useCamera` return value so the camera stays on across page navigation and Dashboard reads the same status; `<CameraPreview stream: MediaStream | null; videoRef: Ref<HTMLVideoElement> />` (muted, `playsInline`, mirrored display only, accessible label); `<StatusBadge status: CameraStatus | 'off'|... label: string />`.

- [ ] **Step 1:** Invoke **frontend-design** for the Camera page: preview as the dominant element with a clear idle state, Start/Stop primary control, device selector, status badge, error banner with kind-specific guidance (including the Windows Settings → Privacy → Camera hint for permission-denied), microphone status shown as "Not enabled — arrives in Phase 5".
- [ ] **Step 2: Write failing tests** (mock `useCamera` via the provider): idle state shows Start and no video stream; clicking Start calls `start`; running state shows Stop and device select; error state renders the message for `busy` and `permission-denied` with `role="alert"`; Dashboard shows camera status from the same context and microphone "Not enabled".
- [ ] **Step 3:** Run → FAIL; implement; Dashboard also shows quick-access cards linking to each page (unbuilt ones labeled with their phase) and the welcome message. Do not show a recent-tasks list (history arrives later).
- [ ] **Step 4:** `npm test`, `tsc`, build → clean.
- [ ] **Step 5:** Commit `feat(frontend): camera page with live preview and dashboard status`.

### Task 6: Frame capture and backend round trip

**Files:**
- Create: `frontend/src/lib/api.ts`, `frontend/src/lib/api.test.ts`, `frontend/src/hooks/useFrameCapture.ts`, `frontend/src/hooks/useFrameCapture.test.tsx`, `frontend/src/components/FrameLink.tsx`
- Modify: `frontend/src/pages/Camera.tsx`

**Interfaces:**
- Produces: `interface FrameSampling { max_width: number; jpeg_quality: number; max_fps: number }`; `interface FrameInfo { width: number; height: number; bytes: number; decode_ms: number }`; `getFrameSampling(): Promise<FrameSampling>`; `inspectFrame(blob: Blob): Promise<FrameInfo>` (POST raw JPEG, throws `ApiError` with backend `detail` on non-2xx or network failure); `useFrameCapture(video: HTMLVideoElement | null, sampling: FrameSampling): { capture(): Promise<Blob> }` (scale so width ≤ `max_width`, keep aspect, `canvas.toBlob('image/jpeg', quality)`; rejects if the video has no frame); `<FrameLink>` — a small "Backend link" line on the Camera page showing last sent frame size, bytes, round-trip ms, or an error state; it sends one frame on user click of "Test frame link" only (no continuous transmission) and says that the frame stays on this computer.

- [ ] **Step 1: Write failing tests:** `api.test.ts` with mocked `fetch` (success parses; non-2xx → `ApiError` with detail; network failure → `ApiError`); `useFrameCapture.test.tsx` with a stubbed canvas: output width ≤ `max_width` and aspect preserved for 1920×1080 input; rejects when `videoWidth === 0`.
- [ ] **Step 2:** Run → FAIL; implement; wire `FrameLink` into the Camera page (enabled only while status is `on`).
- [ ] **Step 3:** With the backend running, manually verify against the real endpoint using the fake camera via Task 7's Playwright run (not mocked); `npm test`, `tsc` clean.
- [ ] **Step 4:** Commit `feat: send downscaled camera frame to backend inspect endpoint`.

### Task 7: End-to-end tests, docs, review

**Files:**
- Create: `frontend/playwright.config.ts`, `frontend/e2e/camera.spec.ts`, `README.md`, `CLAUDE.md`, `scripts/dev.ps1`

**Interfaces:**
- Consumes: everything above. `scripts/dev.ps1` starts uvicorn (`127.0.0.1:8000`) and `npm run dev` together.

- [ ] **Step 1:** Install Playwright Chromium (`npx playwright install chromium`; this downloads a browser, ~150 MB, and needs your OK). Configure Chromium launch args `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`, `webServer` entries for backend and frontend, base URL `http://localhost:5173`.
- [ ] **Step 2: Write e2e specs** (run against the real backend):
  - `camera not requested on load`: page load → no `getUserMedia` call (spy via `addInitScript`), status "Off".
  - `start shows live preview`: click Start → status On, `<video>` has non-zero `videoWidth`.
  - `stop turns camera off`: all tracks `readyState==='ended'`.
  - `permission denied`: override `getUserMedia` to throw `NotAllowedError` → alert with the permission message.
  - `frame link round trip`: click "Test frame link" → shows width ≤ 640 and a decode time from the real backend.
  - `backend down`: with the `/api/frames/inspect` route aborted → frame line shows an error while the preview stays on.
  - `foreign origin blocked`: Playwright `request` POST to `http://127.0.0.1:8000/api/frames/inspect` with `Origin: https://evil.example` → 403.
  - `navigation keeps camera running` (Camera → Dashboard shows On).
- [ ] **Step 3:** Run everything: `pytest`, `ruff`, `pyright`, `npm test`, `tsc`, `npm run build`, `npx playwright test` → all pass. Report any failure; do not skip.
- [ ] **Step 4:** Write `README.md` (prerequisites, install, run, test, exact installed versions, privacy behaviour, which features are not implemented) and `CLAUDE.md` (architecture, module boundaries, rules from Global Constraints, commands). Use the real commands from this plan.
- [ ] **Step 5:** Manual hardware check (cannot be automated): run `scripts/dev.ps1`, open `http://localhost:5173` in Chrome/Edge, grant camera, confirm the HP camera preview, Stop turns the camera LED off, and "Test frame link" returns sizes. Report the result honestly; ask the user to confirm the LED and prompt behavior.
- [ ] **Step 6:** Run `/code-review` over the Phase 1 code and the Security Guidance review of the Origin/Host guard and frame endpoint; fix findings.
- [ ] **Step 7:** Commit `docs: add README, CLAUDE.md and e2e tests for phase 1`.
