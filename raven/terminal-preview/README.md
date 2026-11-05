# RAVEN terminal preview

> Handoff v2 (2026-11-01): the Case 017 investigation (the expanded «التوقيع الرابع») was removed from this copy: its route, data, tools, cloud backend, media tooling and tests. No story replaces it. `/case-017/` now redirects to this preview's home.

An isolated HTML/CSS/JavaScript preview for the cinematic RAVEN entrance: homepage, the two RAVEN 17 films and the Zarqa Al-Yamama teaser. Its pages are `noindex`.

## Opening film

The supplied 12-second RAVEN film plays once when a visitor opens the preview homepage document, then reveals the homepage. It starts muted, preserves the full portrait frame, and has sound, pause/resume and skip controls. Escape also skips; a blocked or failed video leaves the skip action available. Direct film links and internal navigation do not trigger the opening. Reduced motion, quiet mode and Save-Data skip automatic playback. The film is `assets/raven-intro.mp4` (1080×1920, 24 fps, 12.04 s); `raven-intro-poster.jpg` is a frame from it.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Cinematic homepage and film cards |
| `/raven-17/` | Series overview and two parts |
| `/raven-17/part-1/`, `/part-2/` | Individual film with resume and watched state |
| `/raven-17/part-3/` | Legacy alias to Part Two |
| `/zarqa/` | Upcoming film and existing teaser |
| `/case-017/` | Redirect to `/` (story removed) |

## Run locally

Serve the site root, not this directory:

```sh
python3 -m http.server 8786 --bind 127.0.0.1
```

Open <http://127.0.0.1:8786/raven/terminal-preview/>.

## Publish a coherent browser release

After changing browser JavaScript, styles or static entries:

```sh
node raven/terminal-preview/tools/stamp-release.mjs
node raven/terminal-preview/tools/stamp-release.mjs --check
```

Current release token: `abc27e4aad89ec10`.

## Tests

The remaining Playwright specs (opening, episodes, audio, shell, performance, release loading) run against a separately served copy:

```sh
cd raven/terminal-preview/tests
npm install
npx playwright install chromium
npm test
```

`RAVEN_PREVIEW_URL`, `RAVEN_BROWSER`, `RAVEN_TEST_OUTPUT` and `RAVEN_TEST_REPORT` work as before.

## State

Preview storage stays under `raven-preview:v1:` (language, quiet mode, film progress and notes, music preferences). Keys written by the removed investigation (`case`, `case-017:expansion-v3` and the imported legacy progress) are left untouched in the browser and are never read.

The single soundtrack plays `../../fourth-signature/assets/audio/raven-baqi-athar-320.mp3` («باقي أثر») unchanged. Audible films hold the song; it resumes only when the visitor has enabled music.
