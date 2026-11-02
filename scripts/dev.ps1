# Starts the VisionMate backend (127.0.0.1:8000) and frontend (localhost:5173).
$root = Split-Path -Parent $PSScriptRoot
$backend = Start-Process -PassThru -NoNewWindow -WorkingDirectory "$root\backend" `
  -FilePath "$root\backend\.venv\Scripts\python.exe" `
  -ArgumentList "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "127.0.0.1", "--port", "8000"
try {
  Set-Location "$root\frontend"
  npm run dev
} finally {
  if (-not $backend.HasExited) { Stop-Process -Id $backend.Id }
}
