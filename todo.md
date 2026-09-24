# CodedByKay - Image Utility

## App Description

**CodedByKay.ImageUtility** is a client-side web utility designed to convert images into efficient web image formats (such as WebP), compress videos, build timelapses from a sequence of still frames, and automatically generate thumbnail previews. Built using modern web standards (HTML5, CSS, and ES Modules), all operations occur directly within the browser for maximum performance and privacy. The user should be able to download the converted image and the thumbnail as a zip folder. The app should support converting multiple images. The user should be able to view what files will be converted and remove images as well before conversion. 

### Supported MIME Types & Formats
- `.jpg` / `.jpeg` : `image/jpeg`
- `.png` : `image/png`
- `.webp` : `image/webp`
- `.avif` : `image/avif`

## UI-style
## Neo-Brutalism

Bold colors, high contrast, thick borders, raw functionality, and intentionally "undesigned" aesthetics with rough edges.

### Key Features

- High contrast colors
- Thick borders
- Harsh shadows
- Raw typography
- Unconventional layouts

## TODO Checklist

### 1. Multi-Image Queue & File Management
- [x] Build drag-and-drop upload dropzone supporting `.jpg`, `.jpeg`, `.png`, `.webp`, and `.avif`.
- [x] Display visual queue preview showing uploaded files, thumbnail previews, file names, and initial sizes prior to conversion.
- [x] Add ability to view queued images and remove individual items from the queue before starting conversion.
- [x] Add "Clear Queue" and "Add More Images" queue controls.

### 2. Multi-Image Conversion & Thumbnail Engine
- [x] Build Canvas-based WebP conversion engine with configurable quality settings.
- [x] Implement automatic thumbnail generator with customizable dimensions.
- [x] Support batch conversion engine to process all queued images concurrently or sequentially.

### 3. ZIP Packaging & Download Options
- [x] Integrate client-side ZIP bundler (e.g., `jszip`) to package output files directly in the browser.
- [x] Organize output ZIP archive into structured subfolders (e.g., `/converted/` and `/thumbnails/`).
- [x] Provide "Download ZIP" for the entire batch as well as individual download buttons per converted image/thumbnail.

### 4. UX, Progress States & Accessibility Polish
- [x] Design modern, responsive UI with dark mode, clear visual feedback, and smooth micro-animations.
- [x] Display progress indicators, individual item conversion status, and file size savings.
- [x] Guarantee WCAG accessibility compliance (keyboard navigation, high contrast ratios, ARIA attributes).

### 5. Timelapse Builder (Drawing Recording → Video)
- [x] Add a "Timelapse" tab that accepts a bulk upload of JPEG/PNG/WebP frames (e.g. hundreds of frames exported by an Android drawing-recorder app).
- [x] Support uploading a whole folder (via a "Select Folder" picker or dragging a folder in) and a `.zip` of frames, so a 100+ image batch from a tablet doesn't need picking files one by one; ZIP entries are extracted client-side with JSZip.
- [x] Auto-sort frames by filename (natural/numeric order) on upload, matching how camera apps name sequential shots, with a one-click "Sort by Date Modified" fallback and manual ⬆️⬇️ per-frame reordering + removal.
- [x] Configurable frame rate, output resolution cap (for browser memory/speed safety on large batches), output format (MP4/WebM), and quality (CRF), plus an optional "freeze final frame" hold duration.
- [x] Live duration estimate (frame count ÷ fps) before building.
- [x] Build the timelapse client-side with the existing FFmpeg WASM pipeline (each frame is canvas-resized to a consistent resolution, then stitched via ffmpeg's image-sequence input) — no upload to any server.
- [x] Preview the finished video inline and download it as MP4/WebM.
