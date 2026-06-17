# LeMais

**LeMais is a local-first PWA for reading an EPUB while listening to the matching audiobook.**

It imports an audiobook file, the corresponding EPUB, and a subtitle/transcript file, then builds synchronization anchors between audio time and text position. The reader can move between listening and reading without losing context: open the reader from the player, sync the audio to the current page, or estimate where you are in the book from the current playback time.

[Live demo](https://jrenan.github.io/LeMais/)

## Why this exists

I often have both the audio and the EPUB version of the same book. Existing audiobook players and EPUB readers usually treat those as separate experiences. LeMais explores a lightweight way to bridge them: automatic anchor detection, manual correction, and simple interpolation between known matching points.

The goal is not perfect forced alignment. The goal is practical continuity: keep reading when you cannot listen, keep listening when you cannot read, and stay close enough to the same place in the book.

## Highlights

- **Audio + EPUB synchronization:** estimates matching positions between audio time and book text.
- **Automatic anchors from VTT:** cleans subtitle text and matches transcript windows against normalized EPUB text.
- **Manual anchor review:** adjust or create anchors when the automatic guess needs help.
- **Library mode:** anchored books remain available locally and can be opened independently.
- **Local-first storage:** books, covers, anchors, preferences, and progress stay in IndexedDB.
- **PWA install support:** works as an installable web app on mobile and desktop.
- **Offline app shell:** the interface is cached by a service worker after first load.
- **Reader-focused UX:** night mode, font size, touch navigation, sleep timer, and playback speed.
- **Backup flow:** export/import the local database as JSON.

## Demo Flow

1. Import an audiobook file.
2. Import the matching EPUB.
3. Import a `.vtt` subtitle/transcript file.
4. Let LeMais generate anchors automatically.
5. Review anchors when needed.
6. Read, listen, and sync between modes.

## Tech Stack

- Vanilla JavaScript
- IndexedDB
- Service Worker
- Web App Manifest
- Tailwind CSS browser runtime
- JSZip for EPUB parsing
- Lucide icons
- GitHub Pages deployment

The app has no backend dependency. Audio and book files are not uploaded to a server; they remain inside the user's browser storage.

## PWA on iPhone

Open the live URL in Safari:

```text
https://jrenan.github.io/LeMais/
```

Then:

1. Tap Share.
2. Choose "Add to Home Screen".
3. Open LeMais from the new icon.

The app shell works offline after the first load. The library is stored locally on the device, so the export feature should be used as a backup for large libraries.

## Running Locally

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

## Deploying

This is a static app. It can be hosted on GitHub Pages, Hostinger, Netlify, Vercel, Cloudflare Pages, or any HTTPS static server.

For a manual Hostinger upload, send these files and folders to `public_html`:

```text
index.html
app.js
styles.css
manifest.webmanifest
service-worker.js
.nojekyll
icons/
vendor/
```

HTTPS is required for the PWA/service worker outside `localhost`.

## Regenerating Icons

```bash
node scripts/generate-icons.js
```

This recreates:

```text
icons/apple-touch-icon.png
icons/icon-192.png
icons/icon-512.png
icons/maskable-512.png
```

## Project Status

LeMais is an experimental personal reading tool and portfolio project. The current synchronization model is intentionally pragmatic: high-confidence anchors plus linear interpolation. Future directions include better transcript alignment, cloud sync, richer EPUB layout preservation, and optional server-side processing for large libraries.
