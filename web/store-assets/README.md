# Chrome Web Store promotional images

Final upload-ready assets:

- `promotional-small.png` — 440 × 280 px, 24-bit RGB PNG
- `promotional-marquee.png` — 1400 × 560 px, 24-bit RGB PNG
- `screenshots/*.png` — five 1280 × 800 px, 24-bit RGB PNG screenshots

The small tile is intentionally text-free so it remains recognizable at reduced sizes and across locales. The marquee
uses one short product statement and keeps the visual language consistent with the extension icon.

The corresponding SVG files contain the editable vector overlays, and their generated background images are retained
alongside them. The marquee typography is added during export with Arial Bold because ImageMagick's local SVG renderer
cannot resolve macOS system fonts directly from SVG text nodes.

Run `npm run store-screenshots` to regenerate the upload-ready screenshots. The command requires ImageMagick, builds its
SVG composition in temporary files, and uses the current product screenshots from `src/welcome/images` so Store visuals
stay tied to verified UI. Product screenshots are resized with transparent rounded corners before composition.

Follow `dashboard-update-checklist.md` when applying the corresponding listing changes in the Chrome Web Store Developer
Dashboard.
