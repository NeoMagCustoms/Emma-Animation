# PaperCut Animator (Stop-Motion, Client-Only)

Tiny browser app to import hand-drawn frames and export an animation, South-Park-style. No backend. Free to host on GitHub Pages. Offline-capable (PWA).

## Features
- Import PNG/JPG (bulk or single)
- Timeline: reorder, duplicate, delete
- Onion-skin with adjustable depth & opacity
- FPS slider + live preview
- Export **GIF** (built-in) or **WebM** (MediaRecorder)
- Local save/load via `localStorage`
- PWA: installable + offline

## Quick Start
1. **Download** this folder or clone the repo.
2. Open `index.html` locally to try it offline.
3. To host for free:
   - Push to a GitHub repo (e.g. `stopmotion-animator`).
   - GitHub → **Settings → Pages** → Source: `main` → Root (`/`).
   - Wait for deploy. Your app will be live at `https://<you>.github.io/stopmotion-animator/`

## Notes
- GIF export is simple; quality is OK for paper cutouts. For pro-grade output, export WebM and convert to MP4 with a desktop tool.
- `localStorage` can bloat with many frames; for big projects you may want an IndexedDB version.

## License
MIT for app code. `gifenc` is MIT.
